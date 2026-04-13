const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.WEB_PORT || 8080);
const ROOT = __dirname;

app.use(express.static(ROOT, {
  extensions: ['html'],
  maxAge: 0,
}));

app.get('/health', (_req, res) => {
  res.json({ ok: true, port: PORT });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Cinematic Web Server running: http://127.0.0.1:${PORT}`);
});
