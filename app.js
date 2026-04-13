/* ============================================================
   CINEMATIC – App Logic v4
   Full detail screen + multi-source player + complete features
   ============================================================ */

/* ── Icon Renderer ───────────────────────────────────────── */
function loadHighResTransparentIcon(canvasId, imagePath) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = imagePath;
  img.onload = () => {
    const W = img.width, H = img.height;
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const offCtx = off.getContext('2d');
    offCtx.drawImage(img, 0, 0, W, H);
    const data = offCtx.getImageData(0, 0, W, H);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const b = (d[i] + d[i+1] + d[i+2]) / 3;
      if (b < 38) d[i+3] = 0;
      else if (b < 82) d[i+3] = Math.round(((b - 38) / 44) * 255);
    }
    offCtx.putImageData(data, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  };
}

document.addEventListener('DOMContentLoaded', () => {

  /* ── Icons ─────────────────────────────────────── */
  /* ── Icons ─────────────────────────────────────── */
  loadHighResTransparentIcon('home-icon-canvas',    'icons/home-icon.jpg');
  loadHighResTransparentIcon('movies-icon-canvas',  'icons/movies-icon.jpg');
  loadHighResTransparentIcon('center-icon-canvas',  'icons/center-icon.jpg');
  loadHighResTransparentIcon('library-icon-canvas', 'icons/library-icon.png');
  loadHighResTransparentIcon('profile-icon-canvas', 'icons/profile-icon.jpg');


  /* ── TMDB Config ────────────────────────────────── */
  const KEY  = '8265bd1679663a7ea12ac168da84d2e8';
  const BASE = 'https://api.themoviedb.org/3';
  const W500 = 'https://image.tmdb.org/t/p/w500';
  const W300 = 'https://image.tmdb.org/t/p/w300';
  const ORIG = 'https://image.tmdb.org/t/p/original';

  /* Expose globals for detail.js */
  window._api  = (path) => {
    const sep = path.includes('?') ? '&' : '?';
    return fetch(`${BASE}${path}${sep}api_key=${KEY}`).then(r => r.ok ? r.json() : Promise.reject(r.status));
  };
  window._W500 = W500;
  window._W300 = W300;
  window._ORIG = ORIG;

  const GENRES = {
    28:'Action', 18:'Drama', 35:'Comedy', 27:'Horror', 878:'Sci-Fi',
    10749:'Romance', 53:'Thriller', 16:'Animation', 12:'Adventure',
    80:'Crime', 99:'Documentary', 14:'Fantasy', 36:'History',
    10751:'Family', 10759:'Action & Adv.', 10765:'Sci-Fi & Fantasy',
    9648:'Mystery', 10402:'Music', 37:'Western'
  };

  async function api(path) { return window._api(path); }

  /* ── Toast ──────────────────────────────────────── */
  window.showToast = function(msg) {
    let t = document.getElementById('cinematic-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'cinematic-toast';
      t.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
        background:rgba(0,212,200,0.95);color:#001a1a;padding:10px 22px;border-radius:20px;
        font-size:13px;font-weight:700;z-index:9999;opacity:0;transition:opacity 0.3s;
        max-width:300px;text-align:center;font-family:Inter,sans-serif;pointer-events:none;
        white-space:nowrap;box-shadow:0 4px 20px rgba(0,212,200,0.4);`;
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2400);
  };

  /* ── State ──────────────────────────────────────── */
  let heroItems   = [];
  let heroIndex   = 0;
  let heroTimer   = null;
  let currentItem = null;

  /* ══════════ VIDEO PLAYER MODAL ══════════════════ */
  const videoModal    = document.getElementById('video-modal');
  const videoIframe   = document.getElementById('video-iframe');
  const videoCloseBtn = document.getElementById('video-close-btn');
  const videoTitleEl  = document.getElementById('video-modal-title');
  const trackControlsEl = document.getElementById('video-track-controls');
  const audioTrackSelect = document.getElementById('audio-track-select');
  const subtitleTrackSelect = document.getElementById('subtitle-track-select');
  const API_BASE_KEY = 'cinematic_api_base';
  const DEFAULT_API_BASE = 'http://localhost:3001';
  const AUDIO_PREF_KEY = 'cinematic_audio_pref';
  const SUB_PREF_KEY = 'cinematic_sub_pref';
  const getPref = (key) => {
    try { return localStorage.getItem(key); } catch { return null; }
  };
  const setPref = (key, value) => {
    try {
      if (value === null || value === undefined || value === '') localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {}
  };
  const normalizeApiBase = (raw) => {
    const value = String(raw || '').trim();
    if (!value) return '';
    return value.replace(/\/+$/, '');
  };
  const getApiBase = () => {
    let queryApi = '';
    try {
      queryApi = new URLSearchParams(window.location.search).get('apiBase') || '';
    } catch {}

    const stored = getPref(API_BASE_KEY);
    const configured = window.CINEMATIC_CONFIG && typeof window.CINEMATIC_CONFIG.apiBase === 'string'
      ? window.CINEMATIC_CONFIG.apiBase
      : '';
    const selected = normalizeApiBase(queryApi || stored || configured || DEFAULT_API_BASE) || DEFAULT_API_BASE;
    let finalBase = DEFAULT_API_BASE;
    try {
      const parsed = new URL(selected);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol');
      finalBase = parsed.toString().replace(/\/+$/, '');
    } catch {}

    if (queryApi) setPref(API_BASE_KEY, finalBase);
    return finalBase;
  };
  const STREAM_SERVER = getApiBase();
  const buildApiUrl = (path, params) => {
    const base = `${STREAM_SERVER}/`;
    const cleanPath = String(path || '').replace(/^\/+/, '');
    const url = new URL(cleanPath, base);
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([k, v]) => {
        if (v === null || v === undefined || v === '') return;
        url.searchParams.set(k, String(v));
      });
    }
    return url.toString();
  };

  /* Iframe fallback sources (used when stream server not running) */
  const SOURCES = {
    movie: [
      (id)       => `https://vidlink.pro/movie/${id}?primaryColor=00d4c8&secondaryColor=001a1a&iconColor=00d4c8`,
      (id)       => `https://embed.su/embed/movie/${id}`,
      (id)       => `https://vidsrc.to/embed/movie/${id}`,
      (id)       => `https://autoembed.cc/movie/tmdb-${id}`,
    ],
    tv: [
      (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=00d4c8&secondaryColor=001a1a&iconColor=00d4c8`,
      (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`,
      (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
      (id, s, e) => `https://autoembed.cc/tv/tmdb-${id}-${s}-${e}`,
    ]
  };
  let srcIdx   = 0;
  let vidId    = null;
  let vidType  = 'movie';
  let vidSeason= 1;
  let vidEp    = 1;
  let liveDirectUrl = '';
  let hlsInstance = null;
  let streamServerOnline = false;
  let healthAbortController = null;

  /* Check if stream server is online */
  if (typeof AbortController !== 'undefined') {
    healthAbortController = new AbortController();
    setTimeout(() => healthAbortController?.abort(), 2000);
  }
  fetch(buildApiUrl('/health'), healthAbortController ? { signal: healthAbortController.signal } : undefined)
    .then(r => r.json())
    .then(d => {
      streamServerOnline = d.ok;
      console.log('Stream server:', d.ok ? 'online' : 'offline', STREAM_SERVER);
    })
    .catch(() => { streamServerOnline = false; });

  /* ── HLS Player setup ──────────────────────────── */
  const videoEl = document.getElementById('hls-video');
  const LANG_LABELS = {
    tr: 'Türkçe',
    en: 'İngilizce',
    es: 'İspanyolca',
    fr: 'Fransızca',
    de: 'Almanca',
    it: 'İtalyanca',
    ru: 'Rusça',
    ar: 'Arapça',
    ja: 'Japonca',
    ko: 'Korece',
  };

  function resolveTrackLabel(lang, name, type = 'audio') {
    const code = String(lang || '').toLowerCase().trim();
    const base = LANG_LABELS[code] || (code ? code.toUpperCase() : '');
    const hint = String(name || '').trim();
    if (hint && base && !hint.toLowerCase().includes(base.toLowerCase())) return `${base} • ${hint}`;
    if (hint) return hint;
    if (base) {
      if (type === 'audio' && code === 'tr') return 'Türkçe Dublaj';
      if (type === 'subtitle' && code === 'tr') return 'Türkçe Altyazı';
      return base;
    }
    return type === 'audio' ? 'Varsayılan Ses' : 'Altyazı';
  }

  function setTrackControlsVisible(show) {
    if (!trackControlsEl) return;
    trackControlsEl.style.display = show ? 'flex' : 'none';
  }

  function resetTrackSelectors() {
    if (audioTrackSelect) {
      audioTrackSelect.innerHTML = '<option value="-1">Varsayılan</option>';
      audioTrackSelect.disabled = true;
    }
    if (subtitleTrackSelect) {
      subtitleTrackSelect.innerHTML = '<option value="-1">Kapalı</option>';
      subtitleTrackSelect.disabled = true;
    }
  }

  function applyTrackPreferences() {
    const wantedAudio = getPref(AUDIO_PREF_KEY);
    const wantedSub = getPref(SUB_PREF_KEY);

    if (hlsInstance && audioTrackSelect && wantedAudio) {
      const match = Array.from(audioTrackSelect.options).find((o) => o.dataset.lang === wantedAudio);
      if (match) {
        audioTrackSelect.value = match.value;
        hlsInstance.audioTrack = Number(match.value);
      }
    }

    if (subtitleTrackSelect && wantedSub) {
      if (wantedSub === 'off') subtitleTrackSelect.value = '-1';
      else {
        const match = Array.from(subtitleTrackSelect.options).find((o) => o.dataset.lang === wantedSub);
        if (match) subtitleTrackSelect.value = match.value;
      }
    }

    if (hlsInstance && subtitleTrackSelect) {
      const subIdx = Number(subtitleTrackSelect.value);
      hlsInstance.subtitleTrack = Number.isFinite(subIdx) ? subIdx : -1;
      if (typeof hlsInstance.subtitleDisplay === 'boolean') hlsInstance.subtitleDisplay = subIdx >= 0;
    } else if (videoEl && subtitleTrackSelect) {
      const subIdx = Number(subtitleTrackSelect.value);
      Array.from(videoEl.textTracks || []).forEach((track, idx) => {
        track.mode = subIdx === idx ? 'showing' : 'disabled';
      });
    }
  }

  function populateHlsTrackSelectors() {
    if (!hlsInstance) return;
    const audioTracks = Array.isArray(hlsInstance.audioTracks) ? hlsInstance.audioTracks : [];
    const subtitleTracks = Array.isArray(hlsInstance.subtitleTracks) ? hlsInstance.subtitleTracks : [];

    if (audioTrackSelect) {
      audioTrackSelect.innerHTML = '<option value="-1">Varsayılan</option>';
      if (audioTracks.length === 0) {
        audioTrackSelect.disabled = true;
      } else {
        audioTracks.forEach((track, idx) => {
          const opt = document.createElement('option');
          opt.value = String(idx);
          opt.textContent = resolveTrackLabel(track.lang, track.name, 'audio');
          opt.dataset.lang = (track.lang || '').toLowerCase();
          audioTrackSelect.appendChild(opt);
        });
        const currentAudioIdx = typeof hlsInstance.audioTrack === 'number' ? hlsInstance.audioTrack : 0;
        audioTrackSelect.value = String(currentAudioIdx >= 0 ? currentAudioIdx : -1);
        audioTrackSelect.disabled = false;
      }
    }

    if (subtitleTrackSelect) {
      subtitleTrackSelect.innerHTML = '<option value="-1">Kapalı</option>';
      subtitleTracks.forEach((track, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx);
        opt.textContent = resolveTrackLabel(track.lang, track.name, 'subtitle');
        opt.dataset.lang = (track.lang || '').toLowerCase();
        subtitleTrackSelect.appendChild(opt);
      });
      const currentSubIdx = typeof hlsInstance.subtitleTrack === 'number' ? hlsInstance.subtitleTrack : -1;
      subtitleTrackSelect.value = String(currentSubIdx >= 0 ? currentSubIdx : -1);
      subtitleTrackSelect.disabled = subtitleTracks.length === 0;
    }

    setTrackControlsVisible(audioTracks.length > 0 || subtitleTracks.length > 0);
    applyTrackPreferences();
  }

  function populateNativeSubtitleSelector() {
    if (!videoEl || !subtitleTrackSelect) return;
    const textTracks = Array.from(videoEl.textTracks || []);
    subtitleTrackSelect.innerHTML = '<option value="-1">Kapalı</option>';

    if (!textTracks.length) {
      subtitleTrackSelect.disabled = true;
      setTrackControlsVisible(false);
      return;
    }

    textTracks.forEach((track, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = resolveTrackLabel(track.language, track.label, 'subtitle');
      opt.dataset.lang = (track.language || '').toLowerCase();
      subtitleTrackSelect.appendChild(opt);
    });

    subtitleTrackSelect.disabled = false;
    if (audioTrackSelect) {
      audioTrackSelect.innerHTML = '<option value="-1">Varsayılan</option>';
      audioTrackSelect.disabled = true;
    }
    setTrackControlsVisible(true);
    applyTrackPreferences();
  }

  function destroyHls() {
    if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
    if (videoEl) {
      videoEl.pause();
      videoEl.src = '';
      videoEl.onloadedmetadata = null;
      try {
        if (videoEl.textTracks) {
          videoEl.textTracks.onaddtrack = null;
          videoEl.textTracks.onchange = null;
        }
      } catch {}
    }
    resetTrackSelectors();
    setTrackControlsVisible(false);
  }

  function showIframeMode() {
    if (videoEl) videoEl.style.display = 'none';
    videoIframe.style.display = 'block';
    document.getElementById('hls-loading')?.remove();
    setTrackControlsVisible(false);
  }

  function showHlsMode() {
    videoIframe.style.display   = 'none';
    videoIframe.src             = '';
    if (videoEl) videoEl.style.display = 'block';
  }

  function showLoadingOverlay(msg = 'Loading ad-free stream…') {
    let ov = document.getElementById('hls-loading');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'hls-loading';
      ov.style.cssText = `position:absolute;inset:0;background:#070b0f;display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:14px;z-index:10;`;
      ov.innerHTML = `
        <div style="width:40px;height:40px;border:3px solid rgba(0,212,200,0.2);border-top-color:#00d4c8;
          border-radius:50%;animation:spin 0.8s linear infinite;"></div>
        <div id="hls-loading-msg" style="color:#00d4c8;font-size:13px;font-weight:700;font-family:Inter,sans-serif;">${msg}</div>
        <div style="color:#5a6a7a;font-size:11px;font-family:Inter,sans-serif;">Reklamsız stream yükleniyor…</div>`;
      document.querySelector('.video-container')?.appendChild(ov);
    } else {
      document.getElementById('hls-loading-msg').textContent = msg;
    }
  }

  /* ── Play with HLS.js ──────────────────────────── */
  function playHls(m3u8Url) {
    showHlsMode();
    document.getElementById('hls-loading')?.remove();
    document.getElementById('source-switch-btn').style.display = 'none';

    destroyHls();
    if (!videoEl) return;

    const bindNativeTrackRefresh = () => {
      videoEl.onloadedmetadata = () => {
        populateNativeSubtitleSelector();
        videoEl.play().catch(() => {});
      };
      try {
        if (videoEl.textTracks) {
          videoEl.textTracks.onaddtrack = () => populateNativeSubtitleSelector();
          videoEl.textTracks.onchange = () => populateNativeSubtitleSelector();
        }
      } catch {}
    };

    const directPlayable = /\.(mp4|webm|ogg)(\?|$)/i.test(m3u8Url);
    if (directPlayable) {
      bindNativeTrackRefresh();
      videoEl.src = m3u8Url;
      return;
    }

    if (window.Hls && window.Hls.isSupported()) {
      hlsInstance = new window.Hls({ enableWorker: true, lowLatencyMode: false });
      hlsInstance.loadSource(m3u8Url);
      hlsInstance.attachMedia(videoEl);
      hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, () => {
        populateHlsTrackSelectors();
        videoEl.play().catch(() => {});
      });
      hlsInstance.on(window.Hls.Events.AUDIO_TRACKS_UPDATED, () => populateHlsTrackSelectors());
      hlsInstance.on(window.Hls.Events.SUBTITLE_TRACKS_UPDATED, () => populateHlsTrackSelectors());
      hlsInstance.on(window.Hls.Events.AUDIO_TRACK_SWITCHED, () => {
        if (!audioTrackSelect) return;
        const idx = typeof hlsInstance.audioTrack === 'number' ? hlsInstance.audioTrack : -1;
        audioTrackSelect.value = String(idx >= 0 ? idx : -1);
      });
      hlsInstance.on(window.Hls.Events.SUBTITLE_TRACK_SWITCH, () => {
        if (!subtitleTrackSelect) return;
        const idx = typeof hlsInstance.subtitleTrack === 'number' ? hlsInstance.subtitleTrack : -1;
        subtitleTrackSelect.value = String(idx >= 0 ? idx : -1);
      });
      hlsInstance.on(window.Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.warn('HLS error, falling back to iframe');
          destroyHls();
          fallbackToIframe();
        }
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      bindNativeTrackRefresh();
      videoEl.src = m3u8Url;
    } else {
      fallbackToIframe();
    }
  }

  /* ── Fallback to iframe ────────────────────────── */
  function fallbackToIframe() {
    destroyHls();
    showIframeMode();
    if (vidType === 'live' && liveDirectUrl) {
      videoIframe.src = liveDirectUrl;
      const srcBtn = document.getElementById('source-switch-btn');
      if (srcBtn) srcBtn.style.display = 'none';
    } else {
      loadSrc();
    }
    window.open = () => null;
  }

  /* ── Try stream server → SSE extract ──────────── */
  function tryStreamServer() {
    showLoadingOverlay('Reklamsız stream bulunuyor…');
    let evtSource;
    try {
      evtSource = new EventSource(buildApiUrl('/api/extract', {
        id: vidId,
        type: vidType,
        s: vidSeason,
        e: vidEp,
      }));
    } catch {
      fallbackToIframe(); return;
    }

    const timeout = setTimeout(() => {
      evtSource.close();
      fallbackToIframe();
    }, 30000);

    evtSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.status === 'loading') {
          document.getElementById('hls-loading-msg') && (document.getElementById('hls-loading-msg').textContent = data.message);
        } else if (data.status === 'ready') {
          clearTimeout(timeout);
          evtSource.close();
          showToast('✓ Reklamsız stream bulundu!');
          playHls(data.url);
        } else if (data.status === 'fallback' || data.status === 'error') {
          clearTimeout(timeout);
          evtSource.close();
          showToast('⚠ Normal player kullanılıyor');
          fallbackToIframe();
        }
      } catch {}
    };

    evtSource.onerror = () => {
      clearTimeout(timeout);
      evtSource.close();
      fallbackToIframe();
    };
  }

  /* ── Open Video ────────────────────────────────── */
  window.openVideo = function(id, type, title, season = 1, episode = 1) {
    if (!id) return;
    vidId    = id;
    vidType  = type === 'tv' ? 'tv' : 'movie';
    vidSeason= season;
    vidEp    = episode;
    liveDirectUrl = '';
    srcIdx   = 0;
    videoTitleEl.textContent = title || 'Now Playing';
    window.open = () => null; // Block popup ads

    destroyHls();
    videoModal.classList.add('open');
    videoModal.classList.remove('active');
    document.body.style.overflow = 'hidden';

    if (streamServerOnline) {
      tryStreamServer();   // Ad-free HLS ilk seçenek
    } else {
      fallbackToIframe();  // Server çalışmıyorsa iframe
    }
  };

  /* ── Open Direct HLS (Canlı TV için) ────────────── */
  window.openVideoDirect = function(m3u8Url, title) {
    destroyHls();
    vidType = 'live';
    liveDirectUrl = m3u8Url;
    videoModal.classList.add('open');
    videoModal.classList.remove('active');
    videoTitleEl.textContent = title || 'Canlı Yayın';
    document.body.style.overflow = 'hidden';
    
    showHlsMode();
    showLoadingOverlay('Canlı yayın başlatılıyor…');
    setTimeout(() => {
      playHls(m3u8Url);
    }, 500);
  };

  window.openTrailer = function(ytKey) {
    destroyHls();
    showIframeMode();
    videoIframe.src = `https://www.youtube.com/embed/${ytKey}?autoplay=1`;
    videoTitleEl.textContent = 'Trailer';
    videoModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('source-switch-btn').style.display = 'none';
  };

  function loadSrc() {
    const srcs = SOURCES[vidType] || SOURCES.movie;
    const url  = srcs[srcIdx % srcs.length](vidId, vidSeason, vidEp);
    videoIframe.src = url;
    const srcBtn = document.getElementById('source-switch-btn');
    if (srcBtn) {
      srcBtn.textContent = `Kaynak ${srcIdx + 1}/${srcs.length} — Değiştir`;
      srcBtn.style.display = 'block';
    }
    window.open = () => null;
  }

  function closeVideo() {
    destroyHls();
    videoModal.classList.remove('open');
    videoModal.classList.remove('active');
    videoIframe.src = '';
    videoIframe.style.display = 'block';
    document.getElementById('hls-loading')?.remove();
    document.body.style.overflow = '';
  }

  videoCloseBtn.addEventListener('click', closeVideo);
  document.getElementById('video-modal-bg').addEventListener('click', closeVideo);

  document.getElementById('source-switch-btn').addEventListener('click', () => {
    const srcs = SOURCES[vidType] || SOURCES.movie;
    srcIdx = (srcIdx + 1) % srcs.length;
    loadSrc();
    showToast(`Trying Source ${srcIdx + 1}…`);
  });

  if (audioTrackSelect) {
    audioTrackSelect.addEventListener('change', () => {
      const idx = Number(audioTrackSelect.value);
      if (hlsInstance) {
        hlsInstance.audioTrack = Number.isFinite(idx) ? idx : -1;
      }
      const selected = audioTrackSelect.options[audioTrackSelect.selectedIndex];
      const lang = (selected?.dataset?.lang || '').toLowerCase();
      setPref(AUDIO_PREF_KEY, lang || null);
    });
  }

  if (subtitleTrackSelect) {
    subtitleTrackSelect.addEventListener('change', () => {
      const subIdx = Number(subtitleTrackSelect.value);

      if (hlsInstance) {
        hlsInstance.subtitleTrack = Number.isFinite(subIdx) ? subIdx : -1;
        if (typeof hlsInstance.subtitleDisplay === 'boolean') hlsInstance.subtitleDisplay = subIdx >= 0;
      } else if (videoEl) {
        Array.from(videoEl.textTracks || []).forEach((track, idx) => {
          track.mode = subIdx === idx ? 'showing' : 'disabled';
        });
      }

      if (subIdx < 0) {
        setPref(SUB_PREF_KEY, 'off');
      } else {
        const selected = subtitleTrackSelect.options[subtitleTrackSelect.selectedIndex];
        const lang = (selected?.dataset?.lang || '').toLowerCase();
        setPref(SUB_PREF_KEY, lang || null);
      }
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeVideo();
      if (window.Detail) window.Detail.close();
      closeSearch();
    }
  });

  /* ══════════ HERO SLIDER ═════════════════════════ */
  const heroSlidesEl = document.getElementById('hero-slides');
  const heroDotsEl   = document.getElementById('hero-dots');
  const heroTitleEl  = document.getElementById('hero-title-text');
  const heroYearEl   = document.getElementById('hero-year');
  const heroGenreEl  = document.getElementById('hero-genre');
  const heroRatEl    = document.getElementById('hero-rating-val');
  const heroOvEl     = document.getElementById('hero-overview');

  function buildHero(items) {
    heroItems = items.filter(m => m.backdrop_path).slice(0, 7);
    if (!heroItems.length) return;
    heroSlidesEl.innerHTML = '';
    heroDotsEl.innerHTML   = '';
    heroItems.forEach((item, i) => {
      const slide = document.createElement('div');
      slide.className = 'hero-slide' + (i === 0 ? ' active' : '');
      slide.style.backgroundImage = `url(${ORIG}${item.backdrop_path})`;
      heroSlidesEl.appendChild(slide);

      const dot = document.createElement('div');
      dot.className = 'hero-dot' + (i === 0 ? ' active' : '');
      dot.addEventListener('click', () => goHero(i));
      heroDotsEl.appendChild(dot);
    });
    goHero(0);
    clearInterval(heroTimer);
    heroTimer = setInterval(() => goHero(heroIndex + 1), 5500);
  }

  function goHero(idx) {
    if (!heroItems.length) return;
    idx = ((idx % heroItems.length) + heroItems.length) % heroItems.length;
    heroSlidesEl.querySelectorAll('.hero-slide').forEach((s, i) => s.classList.toggle('active', i === idx));
    heroDotsEl.querySelectorAll('.hero-dot').forEach((d, i)    => d.classList.toggle('active', i === idx));
    heroIndex  = idx;
    currentItem = heroItems[idx];
    const item  = currentItem;
    const title = item.title || item.name || '';
    const year  = (item.release_date || item.first_air_date || '').slice(0, 4);
    const gs    = (item.genre_ids || []).slice(0, 3).map(id => GENRES[id]).filter(Boolean);
    heroTitleEl.textContent = title;
    heroYearEl.textContent  = year;
    heroGenreEl.textContent = gs.join(' · ') || 'Entertainment';
    heroRatEl.textContent   = item.vote_average ? item.vote_average.toFixed(1) : '–';
    heroOvEl.textContent    = item.overview || '';
  }

  /* Hero buttons */
  document.getElementById('watch-now-btn').addEventListener('click', () => {
    if (!currentItem) return;
    const type = currentItem.media_type || (currentItem.title ? 'movie' : 'tv');
    window.openVideo(currentItem.id, type, currentItem.title || currentItem.name);
  });

  /* Hero → Info → opens Detail screen */
  document.getElementById('info-btn').addEventListener('click', () => {
    if (!currentItem) return;
    const type = currentItem.media_type || (currentItem.title ? 'movie' : 'tv');
    window.Detail.open(currentItem.id, type, currentItem.title || currentItem.name);
  });

  /* ══════════ CAROUSEL CARDS ══════════════════════ */
  function makeCard(item, mediaType, rank) {
    const type  = mediaType || item.media_type || (item.title ? 'movie' : 'tv');
    const title = item.title || item.name || '';
    const imgSrc= item.poster_path ? W500 + item.poster_path : '';

    const card = document.createElement('div');
    card.className = 'poster-card';

    // Poster image
    const img = document.createElement('img');
    img.className = 'poster-img';
    img.alt       = title;
    img.loading   = 'lazy';
    img.src       = imgSrc || `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect fill="%231a2030" width="200" height="300"/></svg>`;
    img.onerror   = () => { img.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect fill="%231a2030" width="200" height="300"/></svg>`; };
    card.appendChild(img);

    // Rank badge
    if (rank !== undefined) {
      const rb = document.createElement('div');
      rb.className = 'poster-rank';
      rb.textContent = '#' + rank;
      card.appendChild(rb);
    }

    // Rating badge
    if (item.vote_average && item.vote_average > 0) {
      const ratEl = document.createElement('div');
      ratEl.style.cssText = `position:absolute;top:7px;right:7px;background:rgba(0,0,0,0.72);
        color:#f5c518;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;
        backdrop-filter:blur(4px);display:flex;align-items:center;gap:2px;`;
      ratEl.innerHTML = `<svg width="9" height="9" viewBox="0 0 24 24" fill="#f5c518"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>${item.vote_average.toFixed(1)}`;
      card.appendChild(ratEl);
    }

    // Play overlay on hover
    const overlay = document.createElement('div');
    overlay.className = 'poster-overlay';
    overlay.innerHTML = `
      <div style="width:100%;display:flex;flex-direction:column;align-items:center;gap:4px;">
        <div class="poster-play-btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#001a1a"><polygon points="5,3 19,12 5,21"/></svg>
        </div>
        <span style="color:#fff;font-size:10px;font-weight:700;text-align:center;
          background:rgba(0,0,0,0.65);border-radius:3px;padding:2px 5px;
          max-width:95%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${title}</span>
      </div>`;
    card.appendChild(overlay);

    /* Click → Detail Screen (not directly to video) */
    card.addEventListener('click', () => {
      window.Detail.open(item.id, type, title);
    });

    return card;
  }

  function fillTrack(id, items, mediaType, showRank) {
    const track = document.getElementById(id);
    if (!track) return;
    track.innerHTML = '';
    (items || []).slice(0, 12).forEach((item, i) => {
      track.appendChild(makeCard(item, mediaType, showRank ? i + 1 : undefined));
    });
  }

  /* ══════════ SEARCH ══════════════════════════════ */
  const searchOverlay = document.getElementById('search-overlay');
  const searchInput   = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  let   searchTimer   = null;

  document.getElementById('search-btn').addEventListener('click', () => {
    searchOverlay.classList.add('open');
    setTimeout(() => searchInput.focus(), 80);
  });

  function closeSearch() {
    searchOverlay.classList.remove('open');
    searchInput.value = '';
    searchResults.innerHTML = '<p class="search-hint">Search for any movie or TV show…</p>';
    clearTimeout(searchTimer);
  }
  window.closeSearch = closeSearch;

  document.getElementById('search-close-btn').addEventListener('click', closeSearch);
  searchOverlay.addEventListener('click', e => { if (e.target === searchOverlay) closeSearch(); });

  async function doSearch(q) {
    if (!q.trim()) { searchResults.innerHTML = '<p class="search-hint">Search for any movie or TV show…</p>'; return; }
    searchResults.innerHTML = '<p class="search-hint">Searching…</p>';
    try {
      const data  = await api(`/search/multi?query=${encodeURIComponent(q)}&page=1`);
      const items = (data.results || []).filter(r => r.media_type !== 'person' && (r.poster_path || r.backdrop_path)).slice(0, 10);
      if (!items.length) { searchResults.innerHTML = '<p class="search-hint">No results found.</p>'; return; }
      searchResults.innerHTML = '';
      items.forEach(item => {
        const title  = item.title || item.name;
        const year   = (item.release_date || item.first_air_date || '').slice(0, 4);
        const poster = item.poster_path ? W300 + item.poster_path : '';
        const row    = document.createElement('div');
        row.className = 'search-result-item';
        row.innerHTML = `
          ${poster ? `<img class="search-result-poster" src="${poster}" alt="${title}" loading="lazy"/>` : '<div class="search-result-poster" style="background:var(--surface-2)"></div>'}
          <div class="search-result-info">
            <div class="search-result-title">${title}</div>
            <div class="search-result-meta">${item.media_type === 'tv' ? 'TV Show' : 'Movie'}${year ? ' · ' + year : ''}${item.vote_average ? ' · ⭐ ' + item.vote_average.toFixed(1) : ''}</div>
          </div>`;
        row.addEventListener('click', () => {
          closeSearch();
          window.Detail.open(item.id, item.media_type, title);
        });
        searchResults.appendChild(row);
      });
    } catch { searchResults.innerHTML = '<p class="search-hint">Search failed. Try again.</p>'; }
  }

  searchInput.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => doSearch(e.target.value), 380);
  });

  /* ══════════ BOTTOM NAV — Screen Switcher ════════ */
  const navBtns = document.querySelectorAll('.nav-btn[data-tab]');
  const screens = document.querySelectorAll('.screen');

  function switchScreen(tabName, screenId) {
    // Hide all screens
    screens.forEach(s => s.classList.remove('active'));
    // Show target screen
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
    // Update active nav button
    navBtns.forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-btn[data-screen="${screenId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Sekmeye özel yükleme
    if (tabName === 'mylist')  renderMyList('all');
    if (tabName === 'library') loadTvScreen();
    if (tabName === 'movies')  loadMoviesScreen();
    if (tabName === 'profile') loadLiveTvScreen();
  }

  /* ══════════ DİZİLER (TV Shows) EKRANI ════════════ */
  let tvScreenLoaded = false;
  let tvCurrentGenre = 'all';

  async function loadTvScreen(genreId) {
    // İlk yüklemede veya tür değişince tüm veriyi çek
    if (tvScreenLoaded && !genreId) return;
    tvScreenLoaded = true;
    tvCurrentGenre = genreId || 'all';

    // Skeleton'ları geri getir
    ['tvs-trending-track','tvs-onair-track','tvs-popular-track','tvs-toprated-track','tvs-airing-track'].forEach(id => {
      const t = document.getElementById(id);
      if (t) t.innerHTML = '<div class="poster-card skeleton"></div>'.repeat(4);
    });

    try {
      const genreParam = genreId && genreId !== 'all' ? `&with_genres=${genreId}` : '';

      const [trending, onAir, popular, topRated, airingToday] = await Promise.all([
        genreId && genreId !== 'all'
          ? api(`/discover/tv?sort_by=popularity.desc${genreParam}&page=1`)
          : api('/trending/tv/week?page=1'),
        api(`/tv/on_the_air?page=1${genreParam}`),
        api(`/tv/popular?page=1${genreParam}`),
        api(`/tv/top_rated?page=1${genreParam}`),
        api(`/tv/airing_today?page=1${genreParam}`),
      ]);

      // Featured hero — trending'den 1 numara
      buildTvFeatured(trending.results?.[0]);

      // Carousels
      fillTrack('tvs-trending-track', trending.results, 'tv');
      fillTrack('tvs-onair-track',    onAir.results,    'tv');
      fillTrack('tvs-popular-track',  popular.results,  'tv');
      fillTrack('tvs-toprated-track', topRated.results, 'tv', true);
      fillTrack('tvs-airing-track',   airingToday.results, 'tv');

    } catch (err) {
      console.error('TV ekranı yükleme hatası:', err);
      showToast('Veri yüklenemedi, tekrar deniyor…');
      setTimeout(() => loadTvScreen(genreId), 3000);
    }
  }

  function buildTvFeatured(show) {
    const box = document.getElementById('tvs-featured');
    if (!box || !show) return;
    const img   = show.backdrop_path ? (window._ORIG + show.backdrop_path) : (show.poster_path ? window._W500 + show.poster_path : '');
    const title = show.name || show.title || '';
    const year  = (show.first_air_date || '').slice(0, 4);
    const rating = show.vote_average ? show.vote_average.toFixed(1) : '';

    box.innerHTML = `
      <div class="tvs-featured-inner" id="tvs-featured-clickable">
        <img class="tvs-featured-img" src="${img}" alt="${title}" onerror="this.style.display='none'"/>
        <div class="tvs-featured-gradient"></div>
        <div class="tvs-featured-content">
          <div class="tvs-featured-badge">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
            ÖNCÜ DİZİ
          </div>
          <div class="tvs-featured-title">${title}</div>
          <div class="tvs-featured-meta">
            ${year ? `<span>${year}</span>` : ''}
            ${rating ? `<span class="tvs-featured-rating"><svg width="10" height="10" viewBox="0 0 24 24" fill="#f5c518"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>${rating}</span>` : ''}
          </div>
        </div>
        <button class="tvs-featured-play">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#001a1a"><polygon points="5,3 19,12 5,21"/></svg>
        </button>
      </div>`;

    box.querySelector('.tvs-featured-inner').addEventListener('click', (e) => {
      if (!e.target.closest('.tvs-featured-play')) {
        window.Detail.open(show.id, 'tv', title);
      }
    });
    box.querySelector('.tvs-featured-play').addEventListener('click', (e) => {
      e.stopPropagation();
      window.openVideo(show.id, 'tv', title, 1, 1);
    });
  }

  // Tür filtre butonları (Diziler)
  document.querySelectorAll('.tvs-genre-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tvs-genre-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tvScreenLoaded = false;
      loadTvScreen(btn.dataset.genre !== 'all' ? btn.dataset.genre : null);
    });
  });

  /* ══════════ FİLMLER (Movies) EKRANI ════════════ */
  let moviesScreenLoaded = false;
  let moviesCurrentGenre = 'all';

  async function loadMoviesScreen(genreId) {
    if (moviesScreenLoaded && !genreId) return;
    moviesScreenLoaded = true;
    moviesCurrentGenre = genreId || 'all';

    // Skeleton'ları geri getir
    ['movies-nowplaying-track','movies-trending-track','movies-popular-track','movies-toprated-track','movies-upcoming-track'].forEach(id => {
      const t = document.getElementById(id);
      if (t) t.innerHTML = '<div class="poster-card skeleton"></div>'.repeat(4);
    });

    try {
      const genreParam = genreId && genreId !== 'all' ? `&with_genres=${genreId}` : '';

      const [nowPlaying, trending, popular, topRated, upcoming] = await Promise.all([
        api(`/movie/now_playing?page=1${genreParam}`),
        genreId && genreId !== 'all'
          ? api(`/discover/movie?sort_by=popularity.desc${genreParam}&page=1`)
          : api('/trending/movie/week?page=1'),
        api(`/movie/popular?page=1${genreParam}`),
        api(`/movie/top_rated?page=1${genreParam}`),
        api(`/movie/upcoming?page=1${genreParam}`)
      ]);

      buildMoviesFeatured(trending.results?.[0] || nowPlaying.results?.[0]);

      fillTrack('movies-nowplaying-track', nowPlaying.results, 'movie');
      fillTrack('movies-trending-track',   trending.results,   'movie');
      fillTrack('movies-popular-track',    popular.results,    'movie');
      fillTrack('movies-toprated-track',   topRated.results,   'movie', true);
      fillTrack('movies-upcoming-track',   upcoming.results,   'movie');

    } catch (err) {
      console.error('Filmler ekranı yükleme hatası:', err);
      showToast('Veri yüklenemedi, tekrar deniyor…');
      setTimeout(() => loadMoviesScreen(genreId), 3000);
    }
  }

  function buildMoviesFeatured(movie) {
    const box = document.getElementById('movies-featured');
    if (!box || !movie) return;
    const img   = movie.backdrop_path ? (window._ORIG + movie.backdrop_path) : (movie.poster_path ? window._W500 + movie.poster_path : '');
    const title = movie.title || movie.name || '';
    const year  = (movie.release_date || '').slice(0, 4);
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : '';

    box.innerHTML = `
      <div class="movies-featured-inner" id="movies-featured-clickable">
        <img class="movies-featured-img" src="${img}" alt="${title}" onerror="this.style.display='none'"/>
        <div class="movies-featured-gradient"></div>
        <div class="movies-featured-content">
          <div class="movies-featured-badge">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
            HAFTANIN FİLMİ
          </div>
          <div class="movies-featured-title">${title}</div>
          <div class="movies-featured-meta">
            ${year ? `<span>${year}</span>` : ''}
            ${rating ? `<span class="movies-featured-rating"><svg width="10" height="10" viewBox="0 0 24 24" fill="#f5c518"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>${rating}</span>` : ''}
          </div>
        </div>
        <button class="movies-featured-play">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#001a1a"><polygon points="5,3 19,12 5,21"/></svg>
        </button>
      </div>`;

    box.querySelector('.movies-featured-inner').addEventListener('click', (e) => {
      if (!e.target.closest('.movies-featured-play')) {
        window.Detail.open(movie.id, 'movie', title);
      }
    });
    box.querySelector('.movies-featured-play').addEventListener('click', (e) => {
      e.stopPropagation();
      window.openVideo(movie.id, 'movie', title);
    });
  }

  // Tür filtre butonları (Filmler)
  document.querySelectorAll('.movies-genre-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.movies-genre-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      moviesScreenLoaded = false;
      loadMoviesScreen(btn.dataset.genre !== 'all' ? btn.dataset.genre : null);
    });
  });

  /* ══════════ CANLI TV (Live TV) EKRANI ════════════ */
  let liveTvData = null;
  let currentTvCat = 'all';
  const IPTV_URL_KEY = 'cinematic_iptv_url';
  let liveTvLastFetchMs = 0;
  const LIVE_TV_CLIENT_CACHE_MS = 2 * 60 * 1000;
  let liveTvAutoRefreshTimer = null;

  async function loadLiveTvScreen(force = false) {
    const cacheAge = Date.now() - liveTvLastFetchMs;
    if (liveTvData && !force && cacheAge < LIVE_TV_CLIENT_CACHE_MS) return;

    const statusObj = document.getElementById('livetv-status');
    const statusTxt = document.getElementById('livetv-status-text');
    const grid      = document.getElementById('livetv-grid');
    const catBar    = document.getElementById('livetv-cat-bar');

    statusTxt.innerText = 'Yükleniyor...';
    statusObj.querySelector('.livetv-dot').style.background = '#ffc107';

    try {
      const customUrl = getPref(IPTV_URL_KEY);
      const url = buildApiUrl('/api/live-channels', {
        url: customUrl || null,
        refresh: !customUrl && force ? 1 : null,
      });

      const res = await fetch(url);
      const data = await res.json();

      if (!data.ok) throw new Error(data.error);

      liveTvData = data.groups;
      liveTvLastFetchMs = Date.now();
      renderLiveTvCategories(Object.keys(data.groups));
      renderLiveTvGrid('all');

      statusTxt.innerText = customUrl ? 'Özel Liste' : 'Bağlı';
      statusObj.querySelector('.livetv-dot').style.background = '#00f2ea';

    } catch (err) {
      console.error('IPTV Hatası:', err);
      statusTxt.innerText = 'Bağlantı Hatası';
      statusObj.querySelector('.livetv-dot').style.background = '#ff4b4b';
      document.getElementById('livetv-empty').style.display = 'block';
      grid.innerHTML = '';
    }
  }

  function renderLiveTvCategories(cats) {
    const bar = document.getElementById('livetv-cat-bar');
    bar.innerHTML = `<button class="livetv-cat-btn ${currentTvCat==='all'?'active':''}" data-cat="all">Tümü</button>`;
    
    cats.forEach(cat => {
      bar.innerHTML += `<button class="livetv-cat-btn ${currentTvCat===cat?'active':''}" data-cat="${cat}">${cat}</button>`;
    });

    bar.querySelectorAll('.livetv-cat-btn').forEach(btn => {
      btn.onclick = () => {
        bar.querySelectorAll('.livetv-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTvCat = btn.dataset.cat;
        renderLiveTvGrid(currentTvCat);
      };
    });
  }

  function renderLiveTvGrid(cat) {
    const grid = document.getElementById('livetv-grid');
    const empty = document.getElementById('livetv-empty');
    grid.innerHTML = '';
    empty.style.display = 'none';

    let channels = [];
    if (cat === 'all') {
      Object.values(liveTvData).forEach(group => channels = [...channels, ...group]);
    } else {
      channels = liveTvData[cat] || [];
    }

    if (channels.length === 0) {
      empty.style.display = 'block';
    } else {
      channels.forEach(ch => {
        const card = document.createElement('div');
        card.className = 'livetv-card';
        const logoUrl = ch.logo || 'https://via.placeholder.com/48/000000/FFFFFF?text=' + ch.name[0];
        
        card.innerHTML = `
          <img class="livetv-logo" src="${logoUrl}" alt="" onerror="this.src='https://via.placeholder.com/48/222?text=TV'">
          <div class="livetv-info">
            <span class="livetv-name">${ch.name}</span>
            <span class="livetv-group">${cat === 'all' ? (ch.tvgId || 'CANLI') : cat}</span>
          </div>
        `;

        card.onclick = () => playLiveStream(ch);
        grid.appendChild(card);
      });
    }
  }

  function playLiveStream(channelOrUrl, maybeName) {
    const channel = (channelOrUrl && typeof channelOrUrl === 'object')
      ? channelOrUrl
      : { url: channelOrUrl, name: maybeName || 'Canlı Yayın', backupUrls: [] };

    const primaryUrl = channel.url;
    if (!primaryUrl) {
      showToast('Kanal bağlantısı bulunamadı');
      return;
    }

    const backups = Array.isArray(channel.backupUrls)
      ? channel.backupUrls.filter(Boolean)
      : [];
    const fallbackPart = backups.length
      ? `&fallback=${encodeURIComponent(JSON.stringify(backups))}`
      : '';

    showToast(`${channel.name} Başlatılıyor...`);
    // İlk URL başarısızsa backend otomatik backup URL'lere geçer.
    const proxyUrl = `${buildApiUrl('/api/proxy-stream', { url: primaryUrl, track: 1 })}${fallbackPart}`;
    window.openVideoDirect(proxyUrl, channel.name);
  }

  // Settings Panel Toggle
  document.getElementById('livetv-settings-btn').onclick = () => {
    const panel = document.getElementById('livetv-custom-panel');
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    document.getElementById('livetv-custom-url').value = getPref(IPTV_URL_KEY) || '';
    const apiInput = document.getElementById('livetv-api-url');
    if (apiInput) apiInput.value = getPref(API_BASE_KEY) || '';
  };

  document.getElementById('livetv-custom-load').onclick = () => {
    const url = document.getElementById('livetv-custom-url').value.trim();
    if (url) {
      setPref(IPTV_URL_KEY, url);
      liveTvData = null; // force reload
      loadLiveTvScreen(true);
      document.getElementById('livetv-custom-panel').style.display = 'none';
      showToast('Özel liste yüklendi');
    }
  };

  document.getElementById('livetv-custom-reset').onclick = () => {
    setPref(IPTV_URL_KEY, null);
    liveTvData = null;
    loadLiveTvScreen(true);
    document.getElementById('livetv-custom-panel').style.display = 'none';
    showToast('Varsayılan listeye dönüldü');
  };

  const apiSaveBtn = document.getElementById('livetv-api-save');
  if (apiSaveBtn) {
    apiSaveBtn.onclick = () => {
      const input = document.getElementById('livetv-api-url');
      const value = (input?.value || '').trim();
      if (!value) return;

      try {
        const parsed = new URL(value);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid protocol');
        setPref(API_BASE_KEY, parsed.toString().replace(/\/+$/, ''));
        showToast('Backend adresi kaydedildi, yenileniyor...');
        setTimeout(() => window.location.reload(), 450);
      } catch {
        showToast('Gecerli bir backend URL girin');
      }
    };
  }

  const apiResetBtn = document.getElementById('livetv-api-reset');
  if (apiResetBtn) {
    apiResetBtn.onclick = () => {
      setPref(API_BASE_KEY, null);
      showToast('Backend ayari temizlendi');
      setTimeout(() => window.location.reload(), 450);
    };
  }

  function startLiveTvAutoRefresh() {
    if (liveTvAutoRefreshTimer) return;
    liveTvAutoRefreshTimer = setInterval(() => {
      const profileScreen = document.getElementById('screen-profile');
      if (!profileScreen || !profileScreen.classList.contains('active')) return;
      loadLiveTvScreen(false);
    }, LIVE_TV_CLIENT_CACHE_MS);
  }
  startLiveTvAutoRefresh();

  /* ══════════ LISTEM ════════════════════════════════ */

  const MY_LIST_KEY = 'cinematic_mylist';

  function getMyList() {
    try { return JSON.parse(localStorage.getItem(MY_LIST_KEY) || '[]'); }
    catch { return []; }
  }
  function saveMyList(list) {
    localStorage.setItem(MY_LIST_KEY, JSON.stringify(list));
  }

  window.toggleMyList = function(item) {
    let list = getMyList();
    const exists = list.find(i => i.id === item.id);
    if (exists) {
      list = list.filter(i => i.id !== item.id);
      showToast('Listeden kaldırıldı');
    } else {
      list.unshift({ id: item.id, type: item.type, title: item.title, poster: item.poster });
      showToast('✓ Listeme eklendi!');
    }
    saveMyList(list);
    return !exists; // true = eklendi
  };

  window.isInMyList = function(id) {
    return getMyList().some(i => i.id === id);
  };

  function renderMyList(filter) {
    const grid  = document.getElementById('mylist-grid');
    const empty = document.getElementById('mylist-empty');
    const count = document.getElementById('mylist-count');
    if (!grid) return;

    let list = getMyList();
    if (filter === 'movie') list = list.filter(i => i.type === 'movie');
    if (filter === 'tv')    list = list.filter(i => i.type === 'tv');

    count.textContent = `${list.length} içerik`;
    grid.innerHTML = '';

    if (!list.length) {
      empty.style.display = 'flex';
      return;
    }
    empty.style.display = 'none';

    list.forEach(item => {
      const card = document.createElement('div');
      card.className = 'mylist-card';

      const img = document.createElement('img');
      img.src     = item.poster ? (window._W500 + item.poster) : '';
      img.alt     = item.title;
      img.loading = 'lazy';
      img.onerror = () => { img.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect fill="%231a2030" width="200" height="300"/></svg>`; };
      card.appendChild(img);

      const overlay = document.createElement('div');
      overlay.className = 'mylist-card-overlay';
      overlay.innerHTML = `<span class="mylist-card-title">${item.title}</span>`;
      card.appendChild(overlay);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'mylist-card-remove';
      removeBtn.title = 'Listeden kaldır';
      removeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      removeBtn.addEventListener('click', e => {
        e.stopPropagation();
        let l = getMyList().filter(i => i.id !== item.id);
        saveMyList(l);
        card.style.transition = 'opacity 0.25s, transform 0.25s';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.85)';
        setTimeout(() => renderMyList(filter), 270);
        showToast('Listeden kaldırıldı');
      });
      card.appendChild(removeBtn);

      card.addEventListener('click', () => {
        window.Detail.open(item.id, item.type, item.title);
      });

      grid.appendChild(card);
    });
  }

  // Filtre butonları
  document.querySelectorAll('.mylist-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mylist-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderMyList(btn.dataset.filter);
    });
  });

  // "My List" hero butonunu listeye bağla
  document.getElementById('add-list-btn').addEventListener('click', () => {
    if (!currentItem) return;
    const type  = currentItem.media_type || (currentItem.title ? 'movie' : 'tv');
    const title = currentItem.title || currentItem.name;
    const added = window.toggleMyList({ id: currentItem.id, type, title, poster: currentItem.poster_path });
    const btn   = document.getElementById('add-list-btn');
    if (btn) {
      btn.style.background = added ? 'var(--cyan)' : '';
      btn.style.color      = added ? '#001a1a' : '';
    }
  });


  /* ── Her tab için ikon animasyonu ─────────────────── */
  const NAV_ANIMS = {
    home:     'nav-anim-bounce',
    movies:   'nav-anim-spin',
    discover: 'nav-anim-pulse',
    library:  'nav-anim-wiggle',
    profile:  'nav-anim-heartbeat',
  };

  function playNavAnim(btn) {
    const svg = btn.querySelector('.nav-svg-icon');
    if (!svg) return;
    svg.classList.remove('animating');   // önceki animasyonu sıfırla
    void svg.offsetWidth;               // reflow → yeniden tetikle
    svg.classList.add('animating');
    // Tüm child animasyonları bitince sınıfı kaldır
    const longest = Math.max(...[...svg.querySelectorAll('*')].map(el => {
      const s = getComputedStyle(el);
      return (parseFloat(s.animationDuration)||0)*1000 + (parseFloat(s.animationDelay)||0)*1000;
    }).filter(Boolean), 0) || 600;
    setTimeout(() => svg.classList.remove('animating'), longest + 50);
  }

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab      = btn.dataset.tab;
      const screenId = btn.dataset.screen;
      playNavAnim(btn);
      switchScreen(tab, screenId);
    });
  });


  /* ══════════ CATEGORY TABS ════════════════════════ */
  document.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const filter = tab.dataset.filter;
      document.querySelectorAll('.carousel-track').forEach(t => {
        t.innerHTML = '<div class="poster-card skeleton"></div><div class="poster-card skeleton"></div><div class="poster-card skeleton"></div><div class="poster-card skeleton"></div>';
      });
      if (filter === 'movie') {
        const [t, p] = await Promise.all([api('/trending/movie/day?page=1'), api('/movie/popular?page=1')]).catch(() => [{results:[]},{results:[]}]);
        buildHero(t.results); fillTrack('trending-tv-track', t.results, 'movie');
        fillTrack('trending-movies-track', p.results, 'movie');
      } else if (filter === 'tv') {
        const [t, p] = await Promise.all([api('/trending/tv/day?page=1'), api('/tv/popular?page=1')]).catch(() => [{results:[]},{results:[]}]);
        buildHero(t.results); fillTrack('trending-tv-track', t.results, 'tv');
        fillTrack('popular-tv-track', p.results, 'tv');
      } else if (filter === 'trending') {
        loadAllSections();
      } else if (filter === 'new') {
        const [u, a] = await Promise.all([api('/movie/upcoming?page=1'), api('/tv/airing_today?page=1')]).catch(() => [{results:[]},{results:[]}]);
        fillTrack('trending-movies-track', u.results, 'movie');
        fillTrack('trending-tv-track', a.results, 'tv');
      } else {
        loadAllSections();
      }
    });
  });

  /* ══════════ GENRE PILLS ══════════════════════════ */
  document.querySelectorAll('.genre-pill').forEach(pill => {
    pill.addEventListener('click', async () => {
      document.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const gid = pill.dataset.genreId;
      const [movies, tv] = await Promise.all([
        api(`/discover/movie?with_genres=${gid}&sort_by=popularity.desc&page=1`).catch(() => ({results:[]})),
        api(`/discover/tv?with_genres=${gid}&sort_by=popularity.desc&page=1`).catch(() => ({results:[]})),
      ]);
      fillTrack('trending-tv-track',     [...movies.results.slice(0,6), ...tv.results.slice(0,6)], null);
      fillTrack('trending-movies-track', movies.results, 'movie');
      showToast(`Showing: ${pill.textContent.trim()}`);
    });
  });

  /* ══════════ NETWORK CARDS ════════════════════════ */
  document.querySelectorAll('.network-card').forEach(card => {
    card.addEventListener('click', async () => {
      const netId = card.dataset.networkId;
      const name  = card.dataset.name;
      showToast(`Loading ${name}…`);
      try {
        const data = await api(`/discover/tv?with_networks=${netId}&sort_by=popularity.desc&page=1`);
        if (data.results && data.results.length) {
          fillTrack('trending-tv-track', data.results, 'tv');
          showToast(`Showing: ${name} Series`);
          document.querySelector('.carousel-section').scrollIntoView({ behavior: 'smooth' });
        }
      } catch { showToast('Could not load. Try again.'); }
    });
  });

  /* ══════════ NOTIFICATION BTN ════════════════════ */
  document.getElementById('notif-btn').addEventListener('click', () => showToast('🔔 No new notifications'));

  /* ══════════ LOAD ALL SECTIONS ════════════════════ */
  async function loadAllSections() {
    try {
      const [trendMov, trendTv, nowPlay, upcoming, topRated, popTv] = await Promise.all([
        api('/trending/movie/day?page=1'),
        api('/trending/tv/day?page=1'),
        api('/movie/now_playing?page=1'),
        api('/movie/upcoming?page=1'),
        api('/movie/top_rated?page=1'),
        api('/tv/popular?page=1'),
      ]);

      // Hero: mix trending movies + TV
      buildHero([...trendMov.results, ...trendTv.results.slice(0, 2)]);

      fillTrack('trending-tv-track',     trendTv.results,  'tv');
      fillTrack('box-office-track',      nowPlay.results,  'movie', true);
      fillTrack('trending-movies-track', upcoming.results, 'movie');
      fillTrack('top-rated-track',       topRated.results, 'movie');
      fillTrack('popular-tv-track',      popTv.results,    'tv');

    } catch (err) {
      console.error('Load failed:', err);
      showToast('Connection issue. Retrying in 4s…');
      setTimeout(loadAllSections, 4000);
    }
  }

  /* ══════════ INIT ════════════════════════════════ */
  loadAllSections();
});
