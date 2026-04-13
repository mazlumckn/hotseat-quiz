/* ============================================================
   CINEMATIC – Detail Screen Logic
   ============================================================ */

/* Loaded by app.js after DOMContentLoaded. Receives global
   helpers: api(), W300, W500, ORIG, GENRES, openVideo(), showToast()
   All functions are attached to window.Detail namespace.          */

window.Detail = (() => {

  const PROFILE_BASE = 'https://image.tmdb.org/t/p/w185';
  const EP_STILL     = 'https://image.tmdb.org/t/p/w300';
  const myList       = JSON.parse(localStorage.getItem('cinematic_mylist') || '[]');

  /* ── Build/get the overlay DOM ─────────────────── */
  function getScreen() {
    let sc = document.getElementById('detail-screen');
    if (sc) return sc;

    sc = document.createElement('div');
    sc.id = 'detail-screen';
    sc.className = 'detail-screen';
    document.body.appendChild(sc);
    return sc;
  }

  function saveList() {
    localStorage.setItem('cinematic_mylist', JSON.stringify(myList));
  }

  /* ── OPEN DETAIL ────────────────────────────────── */
  async function open(id, rawType, title) {
    const type = rawType === 'tv' ? 'tv' : 'movie';
    const sc   = getScreen();
    sc.innerHTML = '';
    sc.classList.remove('exiting');

    // Show loading state immediately
    sc.classList.add('open', 'entering');
    document.body.style.overflow = 'hidden';

    sc.innerHTML = `
      <button class="detail-back-btn" id="detail-back-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 12H5M5 12l7 7M5 12l7-7"/></svg>
      </button>
      <div class="detail-loading">
        <div class="detail-spinner"></div>
        <span>Loading…</span>
      </div>`;

    document.getElementById('detail-back-btn').addEventListener('click', close);

    setTimeout(() => sc.classList.remove('entering'), 400);

    try {
      // Fetch detail + credits + videos + similar — all parallel
      const [detail, credits, videos, similar] = await Promise.all([
        window._api(`/${type}/${id}`),
        window._api(`/${type}/${id}/credits`),
        window._api(`/${type}/${id}/videos`),
        window._api(`/${type}/${id}/similar`),
      ]);
      renderDetail(sc, detail, credits, videos, similar, type);
    } catch (e) {
      sc.innerHTML = `
        <button class="detail-back-btn" id="detail-back-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 12H5M5 12l7 7M5 12l7-7"/></svg>
        </button>
        <div class="detail-loading">
          <span style="color:#e74c3c">Failed to load. Check your connection.</span>
          <button onclick="window.Detail.close()" style="margin-top:12px;background:var(--cyan);color:#001a1a;border:none;padding:10px 24px;border-radius:8px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;">Go Back</button>
        </div>`;
      document.getElementById('detail-back-btn').addEventListener('click', close);
    }
  }

  /* ── CLOSE ─────────────────────────────────────── */
  function close() {
    const sc = document.getElementById('detail-screen');
    if (!sc) return;
    sc.classList.add('exiting');
    document.body.style.overflow = '';
    setTimeout(() => {
      sc.classList.remove('open', 'exiting');
      sc.innerHTML = '';
    }, 260);
  }

  /* ── RENDER FULL DETAIL ─────────────────────────── */
  function renderDetail(sc, d, credits, videos, similar, type) {
    const isTV      = type === 'tv';
    const title     = d.title || d.name || '';
    const year      = (d.release_date || d.first_air_date || '').slice(0, 4);
    const rating    = d.vote_average ? d.vote_average.toFixed(1) : '–';
    const runtime   = isTV ? `${d.number_of_seasons} season${d.number_of_seasons > 1 ? 's' : ''}` : fmtRuntime(d.runtime);
    const tagline   = d.tagline || '';
    const overview  = d.overview || '';
    const genres    = (d.genres || []).map(g => g.name).join(', ');
    const backdrop  = d.backdrop_path ? `${window._ORIG}${d.backdrop_path}` : '';
    const poster    = d.poster_path   ? `${window._W500}${d.poster_path}`   : '';
    const inList    = myList.some(m => m.id === d.id);
    const trailer   = findTrailer(videos);

    // Cast & Crew
    const cast      = (credits.cast  || []).slice(0, 20);
    const director  = (credits.crew  || []).filter(c => c.job === 'Director').slice(0, 2);
    const writers   = (credits.crew  || []).filter(c => ['Screenplay','Story','Writer'].includes(c.job)).slice(0, 2);

    // Seasons (TV)
    const seasons   = isTV ? (d.seasons || []).filter(s => s.season_number > 0) : [];

    sc.innerHTML = `
      <!-- Hero Backdrop -->
      <div class="detail-hero">
        ${backdrop ? `<img class="detail-backdrop" src="${backdrop}" alt="${title}" loading="eager"/>` : '<div class="detail-hero" style="background:var(--surface-2)"></div>'}
        <div class="detail-hero-gradient"></div>
        <button class="detail-back-btn" id="detail-back-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M19 12H5M5 12l7 7M5 12l7-7"/>
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="detail-body">

        <!-- Poster + Info -->
        <div class="detail-top-row">
          ${poster
            ? `<img class="detail-poster" src="${poster}" alt="${title}" loading="lazy"/>`
            : `<div class="detail-poster-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div>`
          }
          <div class="detail-info">
            <h1 class="detail-title">${title}</h1>
            ${tagline ? `<p class="detail-tagline">"${tagline}"</p>` : ''}
            <div class="detail-meta-row">
              ${year    ? `<span class="detail-badge badge-year">${year}</span>` : ''}
              ${rating !== '–' ? `<span class="detail-badge badge-rating">⭐ ${rating}</span>` : ''}
              <span class="detail-badge badge-type">${isTV ? 'TV Show' : 'Movie'}</span>
              ${runtime ? `<span class="detail-badge badge-runtime">${runtime}</span>` : ''}
              ${d.status === 'Returning Series' ? '<span class="detail-badge badge-status">● Ongoing</span>' : ''}
            </div>
            ${genres ? `<p class="detail-genres">${genres}</p>` : ''}
            ${director.length ? `<div class="crew-row">
              <div class="crew-item"><span class="crew-role">Director</span><span class="crew-name">${director.map(c=>c.name).join(', ')}</span></div>
            </div>` : ''}
          </div>
        </div>

        <!-- Stats Row -->
        <div class="detail-stats-row">
          <div class="detail-stat">
            <span class="detail-stat-val">${rating}</span>
            <span class="detail-stat-label">Rating</span>
          </div>
          <div class="detail-stat">
            <span class="detail-stat-val">${d.vote_count ? numFmt(d.vote_count) : '–'}</span>
            <span class="detail-stat-label">Votes</span>
          </div>
          <div class="detail-stat">
            <span class="detail-stat-val">${isTV ? (d.number_of_episodes || '–') : (runtime || '–')}</span>
            <span class="detail-stat-label">${isTV ? 'Episodes' : 'Runtime'}</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="detail-actions">
          <button class="detail-watch-btn" id="detail-watch-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
            Watch Now
          </button>
          <button class="detail-list-btn ${inList ? 'added' : ''}" id="detail-list-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${inList ? 'var(--cyan)' : 'none'}" stroke="${inList ? 'var(--cyan)' : 'currentColor'}" stroke-width="2.5">
              ${inList ? '<path d="M20 6L9 17l-5-5"/>' : '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'}
            </svg>
            ${inList ? 'In List' : 'My List'}
          </button>
          ${trailer ? `
          <button class="detail-trailer-btn" id="detail-trailer-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
            Trailer
          </button>` : ''}
        </div>

        <!-- Tab Navigation -->
        <div class="detail-tabs">
          <button class="detail-tab active" data-tab="about">About</button>
          ${cast.length ? '<button class="detail-tab" data-tab="cast">Cast & Crew</button>' : ''}
          ${isTV ? '<button class="detail-tab" data-tab="episodes">Episodes</button>' : ''}
          ${(similar.results || []).length ? '<button class="detail-tab" data-tab="similar">Similar</button>' : ''}
        </div>

        <!-- Tab Content Panels -->
        <div id="tab-about" class="detail-section">
          <div class="detail-section-title">Overview</div>
          <p class="detail-overview clamped" id="detail-overview-text">${overview || 'No description available.'}</p>
          ${overview && overview.length > 200 ? '<button class="detail-read-more" id="read-more-btn">Read more ↓</button>' : ''}

          ${writers.length ? `
          <div style="margin-top:14px">
            <div class="crew-row">
              <div class="crew-item"><span class="crew-role">Written by</span><span class="crew-name">${writers.map(c=>c.name).join(', ')}</span></div>
            </div>
          </div>` : ''}

          ${d.production_companies && d.production_companies.length ? `
          <div style="margin-top:14px">
            <div class="crew-row">
              <div class="crew-item"><span class="crew-role">Production</span><span class="crew-name">${d.production_companies.slice(0,2).map(c=>c.name).join(', ')}</span></div>
            </div>
          </div>` : ''}

          ${isTV && seasons.length ? `
          <div style="margin-top:14px">
            <div class="crew-row">
              <div class="crew-item"><span class="crew-role">Seasons</span><span class="crew-name">${d.number_of_seasons}</span></div>
              <div class="crew-item"><span class="crew-role">Episodes</span><span class="crew-name">${d.number_of_episodes}</span></div>
              ${d.networks && d.networks[0] ? `<div class="crew-item"><span class="crew-role">Network</span><span class="crew-name">${d.networks[0].name}</span></div>` : ''}
            </div>
          </div>` : ''}
        </div>

        <div id="tab-cast" class="detail-section" style="display:none">
          <div class="detail-section-title">Cast</div>
          <div class="cast-track" id="detail-cast-track">
            ${cast.map(c => `
              <div class="cast-card">
                <img class="cast-photo" src="${c.profile_path ? PROFILE_BASE + c.profile_path : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><circle cx="30" cy="30" r="30" fill="%231a2030"/><circle cx="30" cy="22" r="11" fill="%23456"/><path d="M10 55 Q30 40 50 55" fill="%23456"/></svg>'}" alt="${c.name}" loading="lazy"/>
                <div class="cast-name">${c.name}</div>
                <div class="cast-character">${c.character || ''}</div>
              </div>`).join('')}
          </div>
        </div>

        <div id="tab-episodes" class="detail-section" style="display:none">
          ${isTV && seasons.length ? `
          <div class="season-selector" id="season-selector">
            ${seasons.map((s, i) => `
              <button class="season-tab ${i === 0 ? 'active' : ''}" data-season="${s.season_number}">
                Season ${s.season_number}
              </button>`).join('')}
          </div>
          <div class="episodes-list" id="episodes-list">
            <div class="detail-loading"><div class="detail-spinner"></div><span>Loading episodes…</span></div>
          </div>` : '<p style="color:var(--muted);font-size:13px;padding:10px 0;">No episodes available.</p>'}
        </div>

        <div id="tab-similar" class="detail-section" style="display:none">
          <div class="similar-track" id="similar-track">
            ${(similar.results || []).slice(0, 15).map(m => `
              <div class="similar-card" data-id="${m.id}" data-type="${m.media_type || type}" data-title="${(m.title||m.name||'').replace(/"/g,'')}" >
                <img class="similar-poster" src="${m.poster_path ? window._W500 + m.poster_path : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="110" height="165"><rect fill="%231a2030" width="110" height="165"/></svg>'}" alt="${m.title||m.name}" loading="lazy"/>
                <div class="similar-title">${m.title || m.name}</div>
              </div>`).join('')}
          </div>
        </div>

      </div><!-- /detail-body -->
    `;

    // ── Wire up events ────────────────────────────
    document.getElementById('detail-back-btn').addEventListener('click', close);

    // Watch Now
    const watchBtn = document.getElementById('detail-watch-btn');
    if (watchBtn) {
      watchBtn.addEventListener('click', () => {
        // If TV — default season 1 ep 1; if user selected different season in episode tab, use that
        const currentSeason  = sc.querySelector('.season-tab.active');
        const currentEp      = sc.querySelector('.episode-card.selected');
        const s = currentSeason  ? parseInt(currentSeason.dataset.season)  : 1;
        const e = currentEp      ? parseInt(currentEp.dataset.episode)     : 1;
        window.openVideo(d.id, type, title, s, e);
        close();
      });
    }

    // My List
    const listBtn = document.getElementById('detail-list-btn');
    if (listBtn) {
      listBtn.addEventListener('click', () => {
        const idx = myList.findIndex(m => m.id === d.id);
        if (idx === -1) {
          myList.push({ id: d.id, type, title, poster: d.poster_path });
          saveList();
          window.showToast('✓ Added to My List');
          listBtn.querySelector('svg').setAttribute('fill', 'var(--cyan)');
          listBtn.querySelector('svg').setAttribute('stroke', 'var(--cyan)');
          listBtn.querySelector('svg').innerHTML = '<path d="M20 6L9 17l-5-5"/>';
          listBtn.lastChild.textContent = ' In List';
          listBtn.classList.add('added');
        } else {
          myList.splice(idx, 1);
          saveList();
          window.showToast('Removed from My List');
          listBtn.querySelector('svg').setAttribute('fill', 'none');
          listBtn.querySelector('svg').setAttribute('stroke', 'currentColor');
          listBtn.querySelector('svg').innerHTML = '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>';
          listBtn.lastChild.textContent = ' My List';
          listBtn.classList.remove('added');
        }
      });
    }

    // Trailer
    const trailerBtn = document.getElementById('detail-trailer-btn');
    if (trailerBtn && trailer) {
      trailerBtn.addEventListener('click', () => {
        window.openTrailer(trailer.key);
        close();
      });
    }

    // Read more
    const rmBtn = document.getElementById('read-more-btn');
    if (rmBtn) {
      rmBtn.addEventListener('click', () => {
        const ovEl = document.getElementById('detail-overview-text');
        ovEl.classList.toggle('clamped');
        rmBtn.textContent = ovEl.classList.contains('clamped') ? 'Read more ↓' : 'Read less ↑';
      });
    }

    // Tabs
    sc.querySelectorAll('.detail-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        sc.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        ['about','cast','episodes','similar'].forEach(id => {
          const el = document.getElementById('tab-' + id);
          if (el) el.style.display = 'none';
        });
        const target = document.getElementById('tab-' + tab.dataset.tab);
        if (target) target.style.display = 'block';

        // Lazy-load episodes when tab clicked
        if (tab.dataset.tab === 'episodes' && isTV && seasons.length) {
          const firstSeason = seasons[0].season_number;
          loadEpisodes(d.id, firstSeason, type);
        }
      });
    });

    // Episode season tabs
    if (isTV) {
      const seasonSel = sc.querySelector('#season-selector');
      if (seasonSel) {
        seasonSel.querySelectorAll('.season-tab').forEach(sTab => {
          sTab.addEventListener('click', () => {
            seasonSel.querySelectorAll('.season-tab').forEach(t => t.classList.remove('active'));
            sTab.classList.add('active');
            loadEpisodes(d.id, parseInt(sTab.dataset.season), type);
          });
        });
        // Auto-load first season if episodes tab is already visible
        loadEpisodes(d.id, seasons[0].season_number, type);
      }
    }

    // Similar card clicks
    sc.querySelectorAll('.similar-card').forEach(card => {
      card.addEventListener('click', () => {
        open(parseInt(card.dataset.id), card.dataset.type, card.dataset.title);
      });
    });
  }

  /* ── LOAD EPISODES ──────────────────────────────── */
  async function loadEpisodes(showId, seasonNum, type) {
    const epList = document.getElementById('episodes-list');
    if (!epList) return;
    epList.innerHTML = `<div class="detail-loading"><div class="detail-spinner"></div><span>Loading…</span></div>`;
    try {
      const data = await window._api(`/tv/${showId}/season/${seasonNum}`);
      const eps  = (data.episodes || []);
      if (!eps.length) { epList.innerHTML = '<p style="color:var(--muted);font-size:13px;">No episodes found.</p>'; return; }
      epList.innerHTML = '';
      eps.forEach(ep => {
        const card = document.createElement('div');
        card.className = 'episode-card';
        card.dataset.episode = ep.episode_number;
        const still = ep.still_path ? EP_STILL + ep.still_path : '';
        card.innerHTML = `
          <div class="episode-thumb">
            ${still ? `<img class="episode-thumb-img" src="${still}" alt="Ep ${ep.episode_number}" loading="lazy"/>` : '<div style="width:100%;height:100%;background:var(--surface-2);"></div>'}
            <div class="episode-play-icon">
              <div class="ep-play-circle">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#001a1a"><polygon points="5,3 19,12 5,21"/></svg>
              </div>
            </div>
          </div>
          <div class="episode-info">
            <div class="episode-num">Episode ${ep.episode_number}${ep.air_date ? ' · ' + ep.air_date.slice(0,4) : ''}</div>
            <div class="episode-title">${ep.name || 'Episode ' + ep.episode_number}</div>
            ${ep.runtime ? `<div class="episode-runtime">${ep.runtime} min</div>` : ''}
            ${ep.overview ? `<div class="episode-overview">${ep.overview}</div>` : ''}
          </div>`;
        card.addEventListener('click', () => {
          epList.querySelectorAll('.episode-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          card.style.borderColor = 'var(--cyan)';
          window.openVideo(showId, 'tv', '', seasonNum, ep.episode_number);
        });
        epList.appendChild(card);
      });
    } catch {
      epList.innerHTML = '<p style="color:var(--muted);font-size:13px;">Failed to load episodes.</p>';
    }
  }

  /* ── HELPERS ─────────────────────────────────────── */
  function fmtRuntime(min) {
    if (!min) return '';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h ? `${h}h ${m}m` : `${m}m`;
  }

  function numFmt(n) {
    return n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n);
  }

  function findTrailer(videos) {
    const results = videos.results || [];
    return results.find(v => v.site === 'YouTube' && v.type === 'Trailer') ||
           results.find(v => v.site === 'YouTube' && v.type === 'Teaser') ||
           null;
  }

  return { open, close };
})();
