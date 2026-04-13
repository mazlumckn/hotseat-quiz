const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'config.js');
const input = String(process.argv[2] || '').trim();

if (!input) {
  console.error('Usage: npm run api:set -- https://api.example.com');
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(input);
} catch {
  console.error('Invalid URL. Example: https://api.example.com');
  process.exit(1);
}

if (!['http:', 'https:'].includes(parsed.protocol)) {
  console.error('Only http/https supported.');
  process.exit(1);
}

const clean = parsed.toString().replace(/\/+$/, '');
const raw = fs.readFileSync(configPath, 'utf8');

if (!/apiBase\s*:\s*['"][^'"]*['"]/.test(raw)) {
  console.error('config.js does not contain an apiBase field.');
  process.exit(1);
}

const next = raw.replace(/apiBase\s*:\s*['"][^'"]*['"]/, `apiBase: '${clean}'`);
fs.writeFileSync(configPath, next, 'utf8');
console.log(`apiBase updated in config.js -> ${clean}`);
