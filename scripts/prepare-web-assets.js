const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'www');

const filesToCopy = [
  'index.html',
  'app.js',
  'detail.js',
  'style.css',
  'detail.css',
  'config.js',
];

const dirsToCopy = [
  'icons',
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cleanOutDir() {
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  ensureDir(outDir);
}

function copyFile(relPath) {
  const src = path.join(root, relPath);
  const dest = path.join(outDir, relPath);
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(relPath) {
  const src = path.join(root, relPath);
  const dest = path.join(outDir, relPath);
  fs.cpSync(src, dest, { recursive: true });
}

function main() {
  cleanOutDir();

  for (const relPath of filesToCopy) {
    copyFile(relPath);
  }

  for (const relPath of dirsToCopy) {
    copyDir(relPath);
  }

  console.log(`Prepared web assets in: ${outDir}`);
}

main();
