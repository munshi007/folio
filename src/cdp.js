// Minimal Chrome DevTools Protocol client for screenshots. Needs a global WebSocket (Node 22+).
// Why not just `chrome --screenshot`? It can only capture the window, so a full page means a window as tall
// as the page, which blows up every `100vh` hero. CDP keeps a real viewport and captures beyond it.

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const cdpAvailable = () => typeof globalThis.WebSocket === 'function';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch(bin) {
  const profile = await mkdtemp(join(tmpdir(), 'folio-chrome-'));
  const proc = spawn(
    bin,
    ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', 'about:blank'],
    { stdio: 'ignore' },
  );
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(portFile); i++) await sleep(100);
  if (!existsSync(portFile)) {
    proc.kill();
    throw new Error('Chrome did not start its DevTools endpoint');
  }
  const [port] = (await readFile(portFile, 'utf8')).split('\n');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const pageTarget = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((ok, fail) => {
    ws.onopen = ok;
    ws.onerror = () => fail(new Error('could not connect to Chrome'));
  });

  let id = 0;
  const pending = new Map();
  const waiters = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { ok, fail } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? fail(new Error(msg.error.message)) : ok(msg.result);
    } else if (msg.method) {
      for (const w of [...waiters]) if (w.method === msg.method) {
        waiters.splice(waiters.indexOf(w), 1);
        w.ok(msg.params);
      }
    }
  };
  const send = (method, params = {}) =>
    new Promise((ok, fail) => {
      const n = ++id;
      pending.set(n, { ok, fail });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const once = (method, timeout = 20_000) =>
    new Promise((ok, fail) => {
      const w = { method, ok };
      waiters.push(w);
      setTimeout(() => {
        const i = waiters.indexOf(w);
        if (i !== -1) {
          waiters.splice(i, 1);
          fail(new Error(`timed out waiting for ${method}`));
        }
      }, timeout);
    });

  await send('Page.enable');
  await send('Runtime.enable');
  const pageErrors = [];
  waiters.push({ method: 'Runtime.exceptionThrown', ok: function onErr(p) {
    pageErrors.push(p.exceptionDetails?.exception?.description?.split('\n')[0] || p.exceptionDetails?.text || 'script error');
    waiters.push({ method: 'Runtime.exceptionThrown', ok: onErr });
  } });

  return {
    // Load a URL in an emulated device/scheme and wait for fonts + a beat for layout. Returns page height.
    errors: pageErrors,
    async open(url, { width, height, mobile, scale = 1, scheme }) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
      await send('Emulation.setEmulatedMedia', {
        features: [
          { name: 'prefers-color-scheme', value: scheme },
          { name: 'prefers-reduced-motion', value: 'reduce' },
        ],
      });
      const loaded = once('Page.loadEventFired');
      await send('Page.navigate', { url });
      await loaded;
      const { result } = await send('Runtime.evaluate', {
        expression: "(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => new Promise(r => setTimeout(r, 350))).then(() => Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0))",
        awaitPromise: true,
        returnByValue: true,
      });
      return result.value;
    },
    async evaluate(expression) {
      const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
      return result.value;
    },
    async fullPage(width, height) {
      const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 } });
      return Buffer.from(data, 'base64');
    },
    // A real screen at scroll position y: sticky headers and fixed elements appear as a visitor sees them.
    async screen(y) {
      await send('Runtime.evaluate', { expression: `window.scrollTo(0, ${Number(y)})` });
      await sleep(120);
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      return Buffer.from(data, 'base64');
    },
    async close() {
      try {
        ws.close();
      } catch {}
      proc.kill();
      await sleep(150);
      await rm(profile, { recursive: true, force: true }).catch(() => {});
    },
  };
}
