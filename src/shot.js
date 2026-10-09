// Screenshots of the built site in headless Chrome over the DevTools protocol. No npm dependencies:
// uses whatever Chrome/Chromium/Edge/Brave is installed, or CHROME_PATH.

import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from './build.js';
import { FolioError } from './errors.js';
import { launch } from './cdp.js';

const CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

export function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  return CANDIDATES.find((p) => existsSync(p)) ?? null;
}

const DEVICES = {
  desktop: { width: 1440, viewport: 900, scale: 1, mobile: false },
  mobile: { width: 390, viewport: 844, scale: 2, mobile: true },
};
const MAX_HEIGHT = 12000;
// Sideways-scrolling designs (horizontal panels) are one screen tall, so vertical slices miss everything
// after the first panel. Find the scroller: the page itself, or a large overflow-x container.
const FIND_HSCROLL = `(() => {
  const se = document.scrollingElement;
  if (se && se.scrollWidth > innerWidth + 40) return { doc: true, width: se.scrollWidth, view: innerWidth };
  for (const el of document.querySelectorAll('body *')) {
    const ox = getComputedStyle(el).overflowX;
    if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth * 1.3 && el.clientWidth > innerWidth * 0.6 && el.clientHeight > innerHeight * 0.5) {
      el.setAttribute('data-folio-hscroll', '');
      return { doc: false, width: el.scrollWidth, view: el.clientWidth };
    }
  }
  return null;
})()`;
const MAX_PANELS = 12;

export async function shoot({ config = 'folio.json', theme, out = 'folio-shots', schemes = ['light', 'dark'], devices = ['desktop', 'mobile'], pure = false } = {}) {
  const bin = findChrome();
  if (!bin) {
    throw new FolioError('No Chrome/Chromium found. Install one or set CHROME_PATH=/path/to/chrome. (Agents: use your own browser/screenshot tool on `folio dev` instead.)');
  }
  for (const d of devices) if (!DEVICES[d]) throw new FolioError(`Unknown device "${d}". Use: ${Object.keys(DEVICES).join(', ')}`);

  const work = await mkdtemp(join(tmpdir(), 'folio-shot-'));
  const outDir = resolve(out);
  try {
    const site = join(work, 'site');
    const { profile } = await build({ config, out: site, theme, pure });
    const index = join(site, 'index.html');
    await mkdir(outDir, { recursive: true });

    const files = [];
    const slug = profile.theme.replace(/[^\w.-]+/g, '_');

    // A real viewport (so 100vh heroes stay one screen tall) and real phone emulation. Slices are true
    // scrolled screens, exactly what a visitor sees.
    const browser = await launch(bin);
    try {
      for (const device of devices) {
        const d = DEVICES[device];
        for (const scheme of schemes) {
          const measured = await browser.open(pathToFileURL(index).href, { width: d.width, height: d.viewport, mobile: d.mobile, scale: d.scale, scheme });
          const height = Math.min(Math.max(measured, d.viewport), MAX_HEIGHT);
          const file = join(outDir, `${slug}-${device}-${scheme}.png`);
          await writeFile(file, await browser.fullPage(d.width, height));
          files.push({ file, device, scheme, height, truncated: measured > MAX_HEIGHT });
          const hs = await browser.evaluate(FIND_HSCROLL);
          if (hs) {
            const count = Math.min(MAX_PANELS, Math.ceil(hs.width / hs.view - 0.05));
            for (let i = 0; i < count; i++) {
              const x = Math.min(i * hs.view, hs.width - hs.view);
              await browser.evaluate(hs.doc ? `window.scrollTo(${x}, 0)` : `document.querySelector('[data-folio-hscroll]').scrollLeft = ${x}`);
              const panelFile = join(outDir, `${slug}-${device}-${scheme}-panel${i + 1}.png`);
              await writeFile(panelFile, await browser.capture());
              files.push({ file: panelFile, device, scheme, height: d.viewport, part: `panel ${i + 1}/${count}` });
            }
            await browser.evaluate(hs.doc ? 'window.scrollTo(0, 0)' : "document.querySelector('[data-folio-hscroll]').scrollLeft = 0");
          }
          if (height > d.viewport * 1.5) {
            const count = Math.ceil(height / d.viewport);
            for (let i = 0; i < count; i++) {
              const partFile = join(outDir, `${slug}-${device}-${scheme}-part${i + 1}.png`);
              await writeFile(partFile, await browser.screen(i * d.viewport));
              files.push({ file: partFile, device, scheme, height: d.viewport, part: `${i + 1}/${count}` });
            }
          }
        }
      }
      return { files, theme: profile.theme, errors: [...new Set(browser.errors)] };
    } finally {
      await browser.close();
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
