const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const cwd = path.resolve(__dirname, '..');

function writeFixtures() {
  fs.writeFileSync(
    path.join(cwd, 'perf-test.m3u'),
    '#EXTM3U\n#EXTINF:-1 tvg-id="demo.news" group-title="News",Demo News\nhttp://127.0.0.1:8080/perf-test.m3u8\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(cwd, 'perf-test.m3u8'),
    '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:4\n#EXTINF:4,\nperf-seg1.ts\n#EXTINF:4,\nperf-seg2.ts\n#EXT-X-ENDLIST\n',
    'utf8'
  );
  fs.writeFileSync(path.join(cwd, 'perf-seg1.ts'), 'segment1data', 'utf8');
  fs.writeFileSync(path.join(cwd, 'perf-seg2.ts'), 'segment2data', 'utf8');
}

function cleanupFixtures() {
  ['perf-test.m3u', 'perf-test.m3u8', 'perf-seg1.ts', 'perf-seg2.ts'].forEach((name) => {
    try {
      fs.unlinkSync(path.join(cwd, name));
    } catch {}
  });
}

function waitFor(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode >= 200 && res.statusCode < 500) return resolve();
        if (Date.now() - start > timeoutMs) return reject(new Error(`Timeout: ${url}`));
        setTimeout(tick, 250);
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) return reject(new Error(`Timeout: ${url}`));
        setTimeout(tick, 250);
      });
    };
    tick();
  });
}

function requestOnce(url) {
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const req = http.get(url, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, ms });
      });
    });
    req.on('error', () => {
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      resolve({ ok: false, ms });
    });
    req.setTimeout(8000, () => req.destroy(new Error('timeout')));
  });
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function runLoad(name, url, { durationMs, concurrency }) {
  const endAt = Date.now() + durationMs;
  let total = 0;
  let errors = 0;
  const lats = [];

  async function worker() {
    while (Date.now() < endAt) {
      const result = await requestOnce(url);
      total += 1;
      if (!result.ok) errors += 1;
      lats.push(result.ms);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  lats.sort((a, b) => a - b);

  const avg = lats.reduce((a, b) => a + b, 0) / (lats.length || 1);
  return {
    name,
    total,
    errors,
    errorRate: total ? (errors / total) * 100 : 0,
    rps: total / (durationMs / 1000),
    avg,
    p50: percentile(lats, 50),
    p95: percentile(lats, 95),
    p99: percentile(lats, 99),
  };
}

function print(result) {
  console.log(
    `${result.name}\n` +
      `  total=${result.total} errors=${result.errors} err%=${result.errorRate.toFixed(2)}\n` +
      `  rps=${result.rps.toFixed(1)} avg=${result.avg.toFixed(1)}ms p50=${result.p50.toFixed(1)}ms p95=${result.p95.toFixed(1)}ms p99=${result.p99.toFixed(1)}ms`
  );
}

async function main() {
  writeFixtures();
  const web = spawn('node', ['web-server.js'], { cwd, stdio: 'ignore' });
  const api = spawn('node', ['stream-server.js'], { cwd, stdio: 'ignore' });

  try {
    await waitFor('http://127.0.0.1:8080/health');
    await waitFor('http://127.0.0.1:3001/health');

    const health = await runLoad('GET /health', 'http://127.0.0.1:3001/health', {
      durationMs: 5000,
      concurrency: 30,
    });

    const customUrl = encodeURIComponent('http://127.0.0.1:8080/perf-test.m3u');
    const liveChannels = await runLoad(
      'GET /api/live-channels?url=local',
      `http://127.0.0.1:3001/api/live-channels?url=${customUrl}`,
      {
        durationMs: 5000,
        concurrency: 12,
      }
    );

    const playlistUrl = encodeURIComponent('http://127.0.0.1:8080/perf-test.m3u8');
    const liveProxy = await runLoad(
      'GET /api/proxy-stream?url=local-m3u8',
      `http://127.0.0.1:3001/api/proxy-stream?url=${playlistUrl}`,
      {
        durationMs: 5000,
        concurrency: 16,
      }
    );

    print(health);
    print(liveChannels);
    print(liveProxy);

    const all = [health, liveChannels, liveProxy];
    const hasErrors = all.some((r) => r.errors > 0);
    if (hasErrors) {
      process.exitCode = 1;
    }
  } finally {
    api.kill('SIGKILL');
    web.kill('SIGKILL');
    cleanupFixtures();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
