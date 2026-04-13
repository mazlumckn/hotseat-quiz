const path = require('path');
const puppeteer = require('puppeteer-core');

const outDir = path.join(__dirname);
const fileUrl = `file:///${path.join(__dirname, 'bottom-bar-mockups.html').replace(/\\/g, '/')}`;
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 860, deviceScaleFactor: 2 });
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 300));

  await page.screenshot({
    path: path.join(outDir, 'bottom-bar-overview.png'),
    fullPage: true,
  });

  const targets = [
    { id: '#mock-a', name: 'bottom-bar-variant-a.png' },
    { id: '#mock-b', name: 'bottom-bar-variant-b.png' },
    { id: '#mock-c', name: 'bottom-bar-variant-c.png' },
  ];

  for (const t of targets) {
    const el = await page.$(t.id);
    if (!el) continue;
    await el.screenshot({ path: path.join(outDir, t.name) });
  }

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
