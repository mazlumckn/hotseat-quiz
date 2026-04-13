const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const DEFAULT_SOURCE_CONFIG = {
  refreshMinutes: 30,
  sources: [
    {
      name: 'IPTV-org Turkey',
      url: 'https://iptv-org.github.io/iptv/countries/tr.m3u',
      active: true,
    },
    {
      name: 'IPTV-org Turkish Language',
      url: 'https://iptv-org.github.io/iptv/languages/tur.m3u',
      active: true,
    },
  ],
};

const BLOCKED_KEYWORDS = ['adult', 'xxx', 'porn', '18+'];
const CATEGORY_KEYWORDS = [
  { keys: ['news', 'haber'], category: 'Haberler' },
  { keys: ['sport', 'spor'], category: 'Spor' },
  { keys: ['movie', 'cinema', 'entertainment', 'eglence'], category: 'Eglence' },
  { keys: ['documentary', 'belgesel', 'history'], category: 'Belgesel' },
  { keys: ['music', 'muzik'], category: 'Muzik' },
  { keys: ['kids', 'cocuk', 'child'], category: 'Cocuk' },
  { keys: ['religious', 'dini', 'islam'], category: 'Dini' },
  { keys: ['general', 'national', 'ulusal', 'generalist'], category: 'Ulusal' },
];
const CATEGORY_ORDER = ['Ulusal', 'Haberler', 'Spor', 'Eglence', 'Belgesel', 'Muzik', 'Cocuk', 'Dini', 'Diger'];

const DEAD_FAIL_STREAK = 3;
const DEAD_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const URL_HEALTH_SAVE_DEBOUNCE_MS = 1200;

class IPTVManager {
  constructor(options = {}) {
    this.sourcesFile = options.sourcesFile || path.join(__dirname, 'iptv-sources.json');
    this.cacheFile = options.cacheFile || path.join(__dirname, 'iptv-cache.json');
    this.healthFile = options.healthFile || path.join(__dirname, 'iptv-health.json');
    this.refreshMinutes = Number(options.refreshMinutes || process.env.IPTV_REFRESH_MINUTES || 30);
    this.fetchTimeoutMs = Number(options.fetchTimeoutMs || process.env.IPTV_FETCH_TIMEOUT_MS || 15000);
    this.logger = options.logger || console;

    this.cacheData = null;
    this.cacheTime = 0;
    this.refreshPromise = null;
    this.scheduler = null;
    this.lastError = null;
    this.lastSourceReport = [];
    this.lastRefreshReason = 'startup';

    this.urlHealth = new Map();
    this.healthSaveTimer = null;

    this.loadPersistedCache();
    this.loadHealthStore();
  }

  startScheduler() {
    if (this.scheduler) return;
    const intervalMs = Math.max(5, this.refreshMinutes) * 60 * 1000;

    this.scheduler = setInterval(() => {
      this.refresh({ reason: 'scheduler', force: true }).catch((err) => {
        this.logger.warn('IPTV scheduler refresh failed:', err.message);
      });
    }, intervalMs);

    if (typeof this.scheduler.unref === 'function') this.scheduler.unref();

    setTimeout(() => {
      this.refresh({ reason: 'startup', force: true }).catch((err) => {
        this.logger.warn('IPTV startup refresh failed:', err.message);
      });
    }, 1500);
  }

  async getChannels({ forceRefresh = false } = {}) {
    if (!forceRefresh && this.cacheData && this.isCacheFresh()) {
      return this.cacheData;
    }

    try {
      return await this.refresh({ reason: forceRefresh ? 'manual-force' : 'cache-miss', force: true });
    } catch (err) {
      if (this.cacheData) {
        return {
          ...this.cacheData,
          stale: true,
          warning: 'Live source refresh failed, serving cached channels.',
          refreshError: err.message,
        };
      }
      return { ok: false, error: err.message || 'IPTV sources could not be loaded.' };
    }
  }

  async fetchCustomChannels(customUrl) {
    const parsedUrl = this.validateSourceUrl(customUrl);
    const channels = await this.fetchAndParseM3U(parsedUrl, 'Custom Source');
    const normalized = this.mergeAndRankChannels(channels);
    const groups = this.groupChannels(normalized);
    return {
      ok: true,
      source: 'custom',
      total: normalized.length,
      groups,
      updatedAt: new Date().toISOString(),
      meta: { sourceCount: 1, refreshMinutes: 0 },
    };
  }

  markStreamResult(url, ok, statusCode = 0) {
    let key;
    try {
      key = this.normalizeUrlKey(url);
    } catch {
      return;
    }

    const now = Date.now();
    const rec = this.urlHealth.get(key) || {
      okCount: 0,
      failCount: 0,
      failStreak: 0,
      lastOk: 0,
      lastFail: 0,
      lastStatus: 0,
      lastChecked: 0,
    };

    rec.lastChecked = now;
    if (ok) {
      rec.okCount += 1;
      rec.failStreak = 0;
      rec.lastOk = now;
      rec.lastStatus = statusCode || 200;
    } else {
      rec.failCount += 1;
      rec.failStreak += 1;
      rec.lastFail = now;
      rec.lastStatus = Number(statusCode || 0);
    }

    this.urlHealth.set(key, rec);
    this.scheduleHealthStoreSave();
  }

  getStats() {
    const ageMinutes = this.cacheTime ? Math.round((Date.now() - this.cacheTime) / 60000) : null;
    const healthEntries = this.urlHealth.size;
    let deadUrls = 0;
    for (const [url, rec] of this.urlHealth.entries()) {
      if (this.isUrlDead(url, rec)) deadUrls += 1;
    }

    return {
      cached: !!this.cacheData,
      ageMinutes,
      ageLabel: ageMinutes === null ? 'yok' : `${ageMinutes} dk`,
      total: this.cacheData?.total || 0,
      lastUpdatedAt: this.cacheData?.updatedAt || null,
      lastError: this.lastError,
      refreshMinutes: this.refreshMinutes,
      sources: this.lastSourceReport,
      lastRefreshReason: this.lastRefreshReason,
      healthEntries,
      deadUrls,
    };
  }

  isCacheFresh() {
    return Date.now() - this.cacheTime < Math.max(5, this.refreshMinutes) * 60 * 1000;
  }

  async refresh({ reason = 'manual', force = false } = {}) {
    if (!force && this.cacheData && this.isCacheFresh()) {
      return this.cacheData;
    }
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this.performRefresh(reason).finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  async performRefresh(reason) {
    const sources = this.getActiveSources();
    if (!sources.length) {
      throw new Error('No active IPTV sources configured.');
    }

    const settled = await Promise.allSettled(
      sources.map((source) => this.fetchAndParseM3U(source.url, source.name))
    );

    const mergedChannels = [];
    const sourceReport = [];

    settled.forEach((result, idx) => {
      const source = sources[idx];
      if (result.status === 'fulfilled') {
        mergedChannels.push(...result.value);
        sourceReport.push({
          name: source.name,
          url: source.url,
          ok: true,
          channels: result.value.length,
          error: null,
        });
      } else {
        sourceReport.push({
          name: source.name,
          url: source.url,
          ok: false,
          channels: 0,
          error: result.reason?.message || 'Unknown fetch error',
        });
      }
    });

    this.lastSourceReport = sourceReport;
    this.lastRefreshReason = reason;

    if (!mergedChannels.length) {
      this.lastError = 'All IPTV sources failed.';
      throw new Error('Hicbir kaynaktan kanal cekilemedi.');
    }

    const normalized = this.mergeAndRankChannels(mergedChannels);
    if (!normalized.length) {
      this.lastError = 'All candidate streams were filtered.';
      throw new Error('Kullanilabilir kanal bulunamadi.');
    }

    const groups = this.groupChannels(normalized);
    const payload = {
      ok: true,
      source: 'aggregated',
      total: normalized.length,
      groups,
      updatedAt: new Date().toISOString(),
      stale: false,
      meta: {
        refreshMinutes: this.refreshMinutes,
        sourceCount: sources.length,
        successfulSources: sourceReport.filter((s) => s.ok).length,
        healthEntries: this.urlHealth.size,
      },
    };

    this.cacheData = payload;
    this.cacheTime = Date.now();
    this.lastError = null;
    this.savePersistedCache(payload);
    return payload;
  }

  getActiveSources() {
    const fileConfig = this.loadSourceConfigFile();
    const refreshMinutesFromFile = Number(fileConfig.refreshMinutes);
    if (Number.isFinite(refreshMinutesFromFile) && refreshMinutesFromFile >= 5) {
      this.refreshMinutes = refreshMinutesFromFile;
    }

    const rawSources = Array.isArray(fileConfig.sources) ? fileConfig.sources : DEFAULT_SOURCE_CONFIG.sources;
    return rawSources
      .filter((src) => src && src.active !== false)
      .map((src) => ({
        name: String(src.name || 'IPTV Source').trim(),
        url: this.validateSourceUrl(src.url),
      }))
      .filter((src) => !!src.url);
  }

  loadSourceConfigFile() {
    try {
      if (!fs.existsSync(this.sourcesFile)) {
        fs.writeFileSync(this.sourcesFile, JSON.stringify(DEFAULT_SOURCE_CONFIG, null, 2), 'utf8');
        return DEFAULT_SOURCE_CONFIG;
      }
      const raw = fs.readFileSync(this.sourcesFile, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      this.logger.warn('Could not read iptv source config, using defaults:', err.message);
      return DEFAULT_SOURCE_CONFIG;
    }
  }

  loadPersistedCache() {
    try {
      if (!fs.existsSync(this.cacheFile)) return;
      const raw = fs.readFileSync(this.cacheFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.payload || parsed.payload.ok !== true) return;

      this.cacheData = parsed.payload;
      this.cacheTime = Number(parsed.cacheTime || Date.now());
      this.lastError = null;
    } catch (err) {
      this.logger.warn('Could not read persisted IPTV cache:', err.message);
    }
  }

  savePersistedCache(payload) {
    try {
      fs.writeFileSync(
        this.cacheFile,
        JSON.stringify(
          {
            cacheTime: Date.now(),
            payload,
          },
          null,
          2
        ),
        'utf8'
      );
    } catch (err) {
      this.logger.warn('Could not persist IPTV cache:', err.message);
    }
  }

  loadHealthStore() {
    try {
      if (!fs.existsSync(this.healthFile)) return;
      const raw = fs.readFileSync(this.healthFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.entries) return;

      const entries = parsed.entries;
      Object.keys(entries).forEach((key) => {
        const rec = entries[key];
        if (!rec || typeof rec !== 'object') return;
        this.urlHealth.set(key, {
          okCount: Number(rec.okCount || 0),
          failCount: Number(rec.failCount || 0),
          failStreak: Number(rec.failStreak || 0),
          lastOk: Number(rec.lastOk || 0),
          lastFail: Number(rec.lastFail || 0),
          lastStatus: Number(rec.lastStatus || 0),
          lastChecked: Number(rec.lastChecked || 0),
        });
      });
    } catch (err) {
      this.logger.warn('Could not read iptv health store:', err.message);
    }
  }

  scheduleHealthStoreSave() {
    if (this.healthSaveTimer) return;
    this.healthSaveTimer = setTimeout(() => {
      this.healthSaveTimer = null;
      this.saveHealthStore();
    }, URL_HEALTH_SAVE_DEBOUNCE_MS);
    if (typeof this.healthSaveTimer.unref === 'function') this.healthSaveTimer.unref();
  }

  saveHealthStore() {
    try {
      const entries = {};
      for (const [key, value] of this.urlHealth.entries()) {
        entries[key] = value;
      }
      fs.writeFileSync(
        this.healthFile,
        JSON.stringify(
          {
            updatedAt: new Date().toISOString(),
            entries,
          },
          null,
          2
        ),
        'utf8'
      );
    } catch (err) {
      this.logger.warn('Could not persist iptv health store:', err.message);
    }
  }

  validateSourceUrl(urlValue) {
    const url = String(urlValue || '').trim();
    if (!url) throw new Error('Bos IPTV kaynak URL');
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`Gecersiz URL: ${url}`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`Desteklenmeyen protokol: ${parsed.protocol}`);
    }
    return parsed.toString();
  }

  normalizeUrlKey(urlValue) {
    const parsed = new URL(String(urlValue || '').trim());
    parsed.hash = '';
    return parsed.toString();
  }

  async fetchAndParseM3U(url, sourceName) {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' },
      timeout: this.fetchTimeoutMs,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const content = await response.text();
    return this.parseM3U(content, sourceName);
  }

  parseM3U(text, sourceName) {
    const lines = text.split('\n');
    const channels = [];
    let current = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF')) {
        const attrs = {};
        const attrRegex = /([a-zA-Z0-9-]+)="([^"]*)"/g;
        let m;
        while ((m = attrRegex.exec(line)) !== null) {
          attrs[m[1]] = m[2];
        }

        const commaPos = line.indexOf(',');
        const title = commaPos > -1 ? line.slice(commaPos + 1).trim() : attrs['tvg-name'] || 'Kanal';
        current = {
          name: title || attrs['tvg-name'] || 'Kanal',
          logo: attrs['tvg-logo'] || '',
          group: attrs['group-title'] || '',
          tvgId: attrs['tvg-id'] || '',
          url: '',
          source: sourceName,
        };
        continue;
      }

      if (current && line.startsWith('#EXTGRP:')) {
        current.group = line.slice(8).trim();
        continue;
      }

      if (current && !line.startsWith('#')) {
        if (this.isSupportedStreamUrl(line)) {
          current.url = line;
          channels.push(current);
        }
        current = null;
      }
    }

    return channels;
  }

  isSupportedStreamUrl(value) {
    const url = String(value || '').trim();
    if (!url) return false;
    return /^https?:\/\//i.test(url);
  }

  mergeAndRankChannels(channels) {
    const map = new Map();

    for (const channel of channels) {
      if (!channel || !channel.url) continue;
      if (this.isBlockedChannel(channel)) continue;

      const nameNorm = this.normalizeName(channel.name);
      const key = channel.tvgId
        ? `id:${String(channel.tvgId).toLowerCase()}`
        : `name:${nameNorm}`;

      if (!map.has(key)) {
        map.set(key, {
          name: channel.name || 'Kanal',
          logo: channel.logo || '',
          group: channel.group || '',
          tvgId: channel.tvgId || '',
          source: channel.source || '',
          candidates: new Set(),
        });
      }

      const row = map.get(key);
      if (!row.logo && channel.logo) row.logo = channel.logo;
      if (!row.group && channel.group) row.group = channel.group;
      if (!row.tvgId && channel.tvgId) row.tvgId = channel.tvgId;
      row.candidates.add(channel.url);
    }

    const out = [];
    for (const row of map.values()) {
      const ranked = this.rankCandidateUrls(Array.from(row.candidates));
      if (!ranked.length) continue;

      out.push({
        name: row.name,
        logo: row.logo,
        group: row.group,
        tvgId: row.tvgId,
        source: row.source,
        url: ranked[0],
        backupUrls: ranked.slice(1, 6),
        candidateCount: ranked.length,
      });
    }
    return out;
  }

  rankCandidateUrls(urls) {
    const unique = [...new Set(urls.filter((u) => this.isSupportedStreamUrl(u)))];
    const scored = unique.map((url) => {
      const key = this.normalizeUrlKey(url);
      const rec = this.urlHealth.get(key);
      return {
        url,
        score: this.getUrlScore(key, rec),
        dead: this.isUrlDead(key, rec),
      };
    });

    const alive = scored
      .filter((x) => !x.dead)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.url);

    if (alive.length) {
      const deadFallback = scored
        .filter((x) => x.dead)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .map((x) => x.url);
      return [...alive, ...deadFallback];
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 1)
      .map((x) => x.url);
  }

  getUrlScore(key, rec) {
    if (!rec) return 0;
    const now = Date.now();
    let score = 0;
    score += rec.okCount * 2;
    score -= rec.failCount;
    score -= rec.failStreak * 3;

    if (rec.lastOk && now - rec.lastOk < 24 * 60 * 60 * 1000) score += 3;
    if (rec.lastFail && now - rec.lastFail < 10 * 60 * 1000) score -= 2;
    if (this.isUrlDead(key, rec)) score -= 50;
    return score;
  }

  isUrlDead(_key, rec) {
    if (!rec) return false;
    if (rec.failStreak < DEAD_FAIL_STREAK) return false;
    if (rec.lastOk && Date.now() - rec.lastOk <= DEAD_COOLDOWN_MS) return false;
    return true;
  }

  isBlockedChannel(channel) {
    const probe = `${channel.name || ''} ${channel.group || ''}`.toLowerCase();
    return BLOCKED_KEYWORDS.some((word) => probe.includes(word));
  }

  normalizeName(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  groupChannels(channels) {
    const groups = {};

    for (const ch of channels) {
      const category = this.mapGroup(ch.group);
      if (!groups[category]) groups[category] = [];
      groups[category].push({
        name: ch.name,
        logo: ch.logo,
        url: ch.url,
        backupUrls: ch.backupUrls || [],
        tvgId: ch.tvgId,
        source: ch.source,
        candidateCount: ch.candidateCount || 1,
      });
    }

    const sorted = {};
    CATEGORY_ORDER.forEach((cat) => {
      if (groups[cat]) sorted[cat] = groups[cat];
    });
    Object.keys(groups).forEach((cat) => {
      if (!sorted[cat]) sorted[cat] = groups[cat];
    });

    return sorted;
  }

  mapGroup(raw) {
    const value = String(raw || '').toLowerCase().trim();
    if (!value) return 'Diger';

    for (const item of CATEGORY_KEYWORDS) {
      if (item.keys.some((k) => value.includes(k))) {
        return item.category;
      }
    }
    return raw || 'Diger';
  }
}

module.exports = IPTVManager;
