# IPTV Auto Update Setup

This project now supports legal/FTA IPTV auto-refresh.

## Source file
- Edit `iptv-sources.json`.
- Add or remove source entries in `sources`.
- Set `"active": false` to disable a source without deleting it.

Example:
```json
{
  "refreshMinutes": 30,
  "sources": [
    {
      "name": "My Legal Provider",
      "url": "https://example.com/my-legal-playlist.m3u",
      "active": true
    }
  ]
}
```

## Refresh cycle
- Default refresh interval is every 30 minutes.
- You can change it from `iptv-sources.json` (`refreshMinutes`) or env var:
  - `IPTV_REFRESH_MINUTES=15`

## Runtime behavior
- `stream-server.js` auto-refreshes sources in background.
- `GET /api/live-channels` returns current cached list.
- `GET /api/live-channels?refresh=1` forces an immediate refresh.
- Last successful list is saved to `iptv-cache.json` and reused if sources are temporarily unavailable.
- Channels with duplicate stream URLs are merged into one item with `backupUrls`.
- `GET /api/proxy-stream` supports automatic failover to `fallback` URLs.
- Stream health results are persisted in `iptv-health.json` and used to reorder links.

## Health and diagnostics
- `GET /health` includes:
  - `iptvCached`
  - `iptvAge`
  - `iptvTotal`
  - `iptvRefreshMinutes`
  - `iptvSources` (per-source success/failure)
  - `iptvHealthEntries` / `iptvDeadUrls`

## APK / Remote backend notes
- For mobile APK builds, do not use `localhost` as API base.
- Set backend public URL with:
  - server env: `PUBLIC_BASE_URL=https://api.your-domain.com`
  - app runtime config: `config.js` (`window.CINEMATIC_CONFIG.apiBase`)
  - or in-app setting under Live TV panel.
