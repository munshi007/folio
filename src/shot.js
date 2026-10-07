// Full-page screenshots of the built site with headless Chrome. No npm dependencies:
// uses whatever Chrome/Chromium/Edge/Brave is installed, or CHROME_PATH.

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { build } from './build.js';
import { FolioError } from './errors.js';
import { cdpAvailable, launch } from './cdp.js';

const run = promisify(execFile);

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
  desktop: { width: 1440, minHeight: 900, part: 1600, viewport: 900, scale: 1, mobile: false },
  mobile: { width: 390, minHeight: 844, part: 1300, viewport: 844, scale: 2, mobile: true },
};
const MAX_HEIGHT = 12000;
// Headless Chrome won't make a window narrower than ~500px, so phones render inside an iframe.
const FRAME_WINDOW = 500;

function flags(scheme) {
  return [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--allow-file-access-from-files',
    '--force-prefers-reduced-motion', // reveal-on-scroll content shows immediately
    `--blink-settings=preferredColorScheme=${scheme === 'light' ? 1 : 0}`,
  ];
}

async function chrome(bin, args) {
  const { stdout } = await run(bin, args, { timeout: 60_000, maxBuffer: 20 * 1024 * 1024 });
  return stdout;
}

// Measure after web fonts finish: pages often grow once real fonts replace the fallbacks.
const MEASURE = `<script>addEventListener('load',()=>(document.fonts?document.fonts.ready:Promise.resolve()).then(()=>setTimeout(()=>{document.title='folio-h:'+document.documentElement.scrollHeight},300)))</script>`;

// Renders index.html in an iframe of ?w= width, shifted up by ?y= px. Used for phone widths and for page slices.
const FRAME = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#8a8a8a;overflow:hidden}iframe{display:block;border:0;position:relative}</style>
<iframe src="index.html" scrolling="no"></iframe>
<script>const q=new URLSearchParams(location.search),f=document.querySelector('iframe');f.style.width=(q.get('w')||390)+'px';f.style.top=-(q.get('y')||0)+'px';
f.onload=()=>{const d=f.contentDocument;(d.fonts?d.fonts.ready:Promise.resolve()).then(()=>setTimeout(()=>{const h=d.documentElement.scrollHeight;f.style.height=h+'px';document.title='folio-h:'+h},300))}</script>`;

async function measure(bin, url, windowWidth, scheme) {
  const dom = await chrome(bin, [...flags(scheme), `--window-size=${windowWidth},900`, '--virtual-time-budget=4000', '--dump-dom', url]);
  const m = dom.match(/folio-h:(\d+)/);
  return m ? Number(m[1]) : null;
}

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
    const html = await readFile(index, 'utf8');
    await writeFile(join(site, 'measure.html'), html.replace('</body>', `${MEASURE}</body>`));
    await writeFile(join(site, 'frame.html'), FRAME);
    const frameUrl = (w, y = 0) => `${pathToFileURL(join(site, 'frame.html')).href}?w=${w}&y=${y}`;
    await mkdir(outDir, { recursive: true });

    const files = [];
    const slug = profile.theme.replace(/[^\w.-]+/g, '_');

    // Preferred path: DevTools protocol, a real viewport (so 100vh heroes stay one screen tall) and real phone
    // emulation. Slices are true scrolled screens, exactly what a visitor sees.
    if (cdpAvailable()) {
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
        var errors = [...new Set(browser.errors)];
      } finally {
        await browser.close();
      }
      return { files, theme: profile.theme, errors };
    }

    // Fallback (Node < 22): plain `chrome --screenshot`. Pages using 100vh may come out stretched.
    for (const device of devices) {
      const { width, minHeight, part } = DEVICES[device];
      const framed = device === 'mobile';
      const win = framed ? FRAME_WINDOW : width;
      for (const scheme of schemes) {
        const measured = await measure(bin, framed ? frameUrl(width) : pathToFileURL(join(site, 'measure.html')).href, win, scheme);
        const height = Math.min(Math.max(measured ?? minHeight, minHeight), MAX_HEIGHT);
        const file = join(outDir, `${slug}-${device}-${scheme}.png`);
        await chrome(bin, [...flags(scheme), `--window-size=${win},${height}`, '--virtual-time-budget=4000', `--screenshot=${file}`, framed ? frameUrl(width) : pathToFileURL(index).href]);
        files.push({ file, device, scheme, height, truncated: (measured ?? 0) > MAX_HEIGHT });

        // Long pages shrink to illegible thumbnails, so also cut viewport-sized slices you can actually read.
        if (height > part * 1.5) {
          const count = Math.ceil(height / part);
          for (let i = 0; i < count; i++) {
            const partFile = join(outDir, `${slug}-${device}-${scheme}-part${i + 1}.png`);
            await chrome(bin, [...flags(scheme), `--window-size=${win},${part}`, '--virtual-time-budget=4000', `--screenshot=${partFile}`, frameUrl(width, i * part)]);
            files.push({ file: partFile, device, scheme, height: part, part: `${i + 1}/${count}` });
          }
        }
      }
    }
    return { files, theme: profile.theme };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
