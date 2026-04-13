/* ============================================================
   CINEMATIC - Stream Server
   - Ad-filtered extractor (Puppeteer)
   - HLS + live proxy
   - IPTV aggregation endpoint (via iptv-manager)
   ============================================================ */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const IPTVManager = require('./iptv-manager');

const app = express();
const PORT = Number(process.env.PORT || process.env.STREAM_PORT || 3001);
const DEFAULT_FETCH_TIMEOUT_MS = Number(process.env.STREAM_FETCH_TIMEOUT_MS || 15000);
const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
const ENABLE_WEB_FALLBACK = String(process.env.ENABLE_WEB_FALLBACK || '0') === '1';
const IPTV_DATA_DIR = String(process.env.IPTV_DATA_DIR || __dirname).trim() || __dirname;

try {
  fs.mkdirSync(IPTV_DATA_DIR, { recursive: true });
} catch {}

const iptvManager = new IPTVManager({
  sourcesFile: process.env.IPTV_SOURCES_FILE || path.join(__dirname, 'iptv-sources.json'),
  cacheFile: process.env.IPTV_CACHE_FILE || path.join(IPTV_DATA_DIR, 'iptv-cache.json'),
  healthFile: process.env.IPTV_HEALTH_FILE || path.join(IPTV_DATA_DIR, 'iptv-health.json'),
  refreshMinutes: Number(process.env.IPTV_REFRESH_MINUTES || 30),
  fetchTimeoutMs: Number(process.env.IPTV_FETCH_TIMEOUT_MS || 15000),
  logger: console,
});
iptvManager.startScheduler();

app.use(cors());
app.use(express.json());

if (ENABLE_WEB_FALLBACK) {
  app.use(express.static(__dirname, { extensions: ['html'], maxAge: 0 }));
  app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));
}

const CHROME_PATHS = [
  String(process.env.CHROME_PATH || '').trim(),
  String(process.env.PUPPETEER_EXECUTABLE_PATH || '').trim(),
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `C:\\Users\\${process.env.USERNAME || ''}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
].filter(Boolean);
const chromePath = CHROME_PATHS.find((p) => fs.existsSync(p));

const STREAM_CACHE = new Map();
const STREAM_CACHE_TTL_MS = 10 * 60 * 1000;

const AD_DOMAINS = [
  'googlesyndication', 'doubleclick', 'amazon-adsystem', 'adservice.google',
  'googletagmanager', 'taboola', 'outbrain', 'criteo', 'pubmatic',
  'rubiconproject', 'adnxs', 'openx', 'exoclick', 'propellerads',
  'popcash', 'adsterra', 'clickadu', 'trafficfactory', 'vidazoo',
  'bidswitch', 'spotxchange', 'casalemedia', 'adsystem',
];

function cacheGet(key) {
  const hit = STREAM_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > STREAM_CACHE_TTL_MS) return null;
  return hit.value;
}

function cacheSet(key, value) {
  STREAM_CACHE.set(key, { value, at: Date.now() });
}

function isAdUrl(url) {
  return AD_DOMAINS.some((d) => String(url || '').includes(d));
}

function parseHttpUrl(rawUrl, label = 'URL') {
  const value = String(rawUrl || '').trim();
  if (!value) throw new Error(`${label} is required`);

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid ${label}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);
  }

  return parsed;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isLikelyPlaylist(targetUrl, contentType = '') {
  const u = String(targetUrl || '').toLowerCase();
  const ct = String(contentType || '').toLowerCase();
  return (
    u.includes('.m3u8') ||
    u.includes('.m3u') ||
    u.includes('playlist') ||
    u.includes('manifest') ||
    ct.includes('mpegurl') ||
    ct.includes('m3u')
  );
}

function parseFallbackUrls(raw) {
  if (!raw) return [];
  const value = String(raw).trim();
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x || '').trim()).filter(Boolean);
  } catch {}

  return value.split(',').map((x) => x.trim()).filter(Boolean);
}

function getRequestBase(req) {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL;

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] || '')
    .split(',')[0]
    .trim();
  const host = forwardedHost || String(req.headers.host || '').split(',')[0].trim();
  const proto = forwardedProto || req.protocol || 'http';

  if (!host) return `http://localhost:${PORT}`;
  return `${proto}://${host}`;
}

function buildAbsoluteUrl(req, pathName, params = {}) {
  const base = `${getRequestBase(req).replace(/\/+$/, '')}/`;
  const url = new URL(String(pathName || '').replace(/^\/+/, ''), base);
  Object.entries(params).forEach(([k, v]) => {
    if (v === null || v === undefined || v === '') return;
    url.searchParams.set(k, String(v));
  });
  return url.toString();
}

async function proxyFetch(targetUrl, referer = 'https://vidlink.pro') {
  return fetchWithTimeout(
    targetUrl,
    {
      headers: {
        Referer: referer,
        Origin: new URL(referer).origin,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
        Accept: '*/*',
      },
    },
    DEFAULT_FETCH_TIMEOUT_MS
  );
}

async function extractStreamUrl(id, type, season, episode) {
  const cacheKey = `${type}-${id}-${season}-${episode}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  if (!chromePath) return null;

  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch {
    return null;
  }

  const embedUrl =
    type === 'tv'
      ? `https://vidlink.pro/tv/${id}/${season}/${episode}`
      : `https://vidlink.pro/movie/${id}`;

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--mute-audio',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-sync',
        '--no-first-run',
      ],
    });

    const page = await browser.newPage();
    let streamUrl = null;

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
    );
    await page.setRequestInterception(true);

    page.on('request', (req) => {
      const reqUrl = req.url();
      if (isAdUrl(reqUrl)) {
        req.abort();
        return;
      }
      if (!streamUrl && (reqUrl.includes('.m3u8') || reqUrl.includes('/master') || reqUrl.includes('playlist'))) {
        if (!reqUrl.includes('googlevideo') && !reqUrl.includes('youtube')) {
          streamUrl = reqUrl;
        }
      }
      req.continue();
    });

    page.on('response', (res) => {
      const resUrl = res.url();
      if (!streamUrl && resUrl.includes('.m3u8')) {
        streamUrl = resUrl;
      }
    });

    await page.goto(embedUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await new Promise((r) => setTimeout(r, 8000));

    if (streamUrl) {
      const payload = { url: streamUrl, source: 'vidlink' };
      cacheSet(cacheKey, payload);
      return payload;
    }
    return null;
  } catch (err) {
    console.error('Puppeteer extract failed:', err.message);
    return null;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
  }
}

app.get('/api/stream', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.json({ ok: false, error: 'id is required' });
  return res.json({ ok: false, status: 'extracting', message: 'Use /api/extract SSE endpoint' });
});

app.get('/api/extract', async (req, res) => {
  const { id, type = 'movie', s = 1, e = 1 } = req.query;
  if (!id) return res.json({ ok: false, error: 'id is required' });

  const seasonNum = Number.parseInt(s, 10) || 1;
  const episodeNum = Number.parseInt(e, 10) || 1;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  send({ status: 'loading', message: 'Extracting stream (~10s)...' });

  try {
    const result = await extractStreamUrl(id, type, seasonNum, episodeNum);
    if (result) {
      const proxyUrl = buildAbsoluteUrl(req, '/hls', { url: result.url });
      send({ status: 'ready', url: proxyUrl, direct: result.url, source: result.source });
    } else {
      const fallback =
        type === 'tv'
          ? `https://vidlink.pro/tv/${id}/${seasonNum}/${episodeNum}`
          : `https://vidlink.pro/movie/${id}`;
      send({ status: 'fallback', url: fallback, message: 'No direct stream found. Using embed fallback.' });
    }
  } catch (err) {
    send({ status: 'error', message: err.message });
  }

  res.end();
});

app.get('/hls', async (req, res) => {
  const targetUrlRaw = decodeURIComponent(req.query.url || '');
  const refererRaw = decodeURIComponent(req.query.ref || 'https://vidlink.pro');
  if (!targetUrlRaw) return res.status(400).send('URL required');

  try {
    const targetUrl = parseHttpUrl(targetUrlRaw, 'target URL');
    const referer = parseHttpUrl(refererRaw || targetUrl.origin, 'referer URL');

    const upstream = await proxyFetch(targetUrl.toString(), referer.toString());
    if (!upstream.ok) {
      return res.status(502).send(`Upstream error: HTTP ${upstream.status}`);
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', contentType);

    if (isLikelyPlaylist(targetUrl.toString(), contentType)) {
      const text = await upstream.text();
      const rewritten = text
        .split('\n')
        .map((line) => {
          const t = line.trim();
          if (!t || t.startsWith('#')) return line;
          const abs = new URL(t, targetUrl.toString()).toString();
          return buildAbsoluteUrl(req, '/hls', {
            url: abs,
            ref: referer.toString(),
          });
        })
        .join('\n');

      return res.send(rewritten);
    }

    if (!upstream.body) return res.status(502).send('Empty upstream response');
    upstream.body.pipe(res);
  } catch (err) {
    console.error('HLS proxy error:', err.message);
    res.status(502).send('Proxy error');
  }
});

app.get('/api/live-channels', async (req, res) => {
  const forceRefresh = req.query.refresh === '1';
  const customUrl = req.query.url;

  try {
    if (customUrl) {
      const customData = await iptvManager.fetchCustomChannels(customUrl);
      return res.json(customData);
    }
    const data = await iptvManager.getChannels({ forceRefresh });
    return res.json(data);
  } catch (err) {
    return res.json({ ok: false, error: err.message || 'IPTV list failed to load' });
  }
});

app.get('/api/proxy-stream', async (req, res) => {
  const targetUrlRaw = decodeURIComponent(req.query.url || '');
  if (!targetUrlRaw) return res.status(400).send('URL required');

  try {
    const trackHealth = req.query.track === '1';
    const primaryUrl = parseHttpUrl(targetUrlRaw, 'target URL').toString();
    const fallbackRaw = parseFallbackUrls(req.query.fallback);
    const fallbackUrls = fallbackRaw
      .map((u) => {
        try {
          return parseHttpUrl(u, 'fallback URL').toString();
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter((u) => u !== primaryUrl);

    const candidates = [primaryUrl, ...fallbackUrls];
    let upstream = null;
    let activeUrl = null;

    for (const candidate of candidates) {
      try {
        const response = await fetchWithTimeout(
          candidate,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              Accept: '*/*',
              Referer: new URL(candidate).origin,
            },
          },
          DEFAULT_FETCH_TIMEOUT_MS
        );

        if (!response.ok) {
          if (trackHealth) iptvManager.markStreamResult(candidate, false, response.status);
          continue;
        }

        upstream = response;
        activeUrl = candidate;
        if (trackHealth) iptvManager.markStreamResult(candidate, true, response.status);
        break;
      } catch {
        if (trackHealth) iptvManager.markStreamResult(candidate, false, 0);
      }
    }

    if (!upstream || !activeUrl) {
      return res.status(502).send('All stream candidates failed');
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', contentType);

    if (isLikelyPlaylist(activeUrl, contentType)) {
      const text = await upstream.text();
      const rewritten = text
        .split('\n')
        .map((line) => {
          const t = line.trim();
          if (!t || t.startsWith('#')) return line;
          const abs = new URL(t, activeUrl).toString();
          return buildAbsoluteUrl(req, '/api/proxy-stream', { url: abs });
        })
        .join('\n');

      return res.send(rewritten);
    }

    if (!upstream.body) return res.status(502).send('Empty upstream response');
    upstream.body.pipe(res);
  } catch (err) {
    console.error('Live proxy error:', err.message);
    res.status(502).send(`Proxy error: ${err.message}`);
  }
});

app.get('/health', (_req, res) => {
  const iptvStats = iptvManager.getStats();
  const mem = process.memoryUsage();
  res.json({
    ok: true,
    chrome: !!chromePath,
    cache: STREAM_CACHE.size,
    uptimeSec: Math.round(process.uptime()),
    memoryMb: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    },
    iptvCached: iptvStats.cached,
    iptvAge: iptvStats.ageLabel,
    iptvTotal: iptvStats.total,
    iptvUpdatedAt: iptvStats.lastUpdatedAt,
    iptvRefreshMinutes: iptvStats.refreshMinutes,
    iptvLastError: iptvStats.lastError,
    iptvSources: iptvStats.sources,
    iptvHealthEntries: iptvStats.healthEntries,
    iptvDeadUrls: iptvStats.deadUrls,
    chromePath,
    publicBase: PUBLIC_BASE_URL || null,
    webFallback: ENABLE_WEB_FALLBACK,
  });
});

app.listen(PORT, () => {
  const baseForLog = PUBLIC_BASE_URL || `http://localhost:${PORT}`;
  console.log(`\\nCinematic Stream Server running: ${baseForLog}`);
  console.log(`  Chrome: ${chromePath || 'NOT FOUND'}`);
  console.log(`  Web fallback: ${ENABLE_WEB_FALLBACK ? 'enabled' : 'disabled'}`);
  console.log(`  Live TV: ${baseForLog}/api/live-channels`);
  console.log(`  Health:  ${baseForLog}/health\\n`);
});
