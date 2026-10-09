// Content: the person's folio.json, edited from Studio. Saving validates first (a broken folio.json would
// break every design), and every save is a version (content/<n>.json) so a bad edit is undoable.
// Resume uploads are kept locally in .folio/inputs/ and read by an agent (a "content" job): extracting a
// resume well needs a model, and folio itself never sends files anywhere.

import { readFile, writeFile } from 'node:fs/promises';
import { validate } from './schema.js';
import { fetchGitHub, mergeGitHub } from './github.js';

export const MAX_UPLOAD = 10 * 1024 * 1024;
const UPLOAD_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/zip': 'zip', // LinkedIn data export
};

async function snapshot(store, raw, note) {
  const index = await store.data.readJSON('content/index.json', []);
  const n = index.length ? index[index.length - 1].n + 1 : 1;
  await store.data.writeJSON(`content/${n}.json`, raw);
  index.push({ n, at: new Date().toISOString(), note });
  await store.data.writeJSON('content/index.json', index);
  return n;
}

export async function readContent(configPath) {
  const raw = JSON.parse(await readFile(configPath, 'utf8'));
  return { content: raw, ...validate(raw) };
}

export async function contentVersions(store) {
  return (await store.data.readJSON('content/index.json', [])).slice().reverse();
}

// Replace folio.json with an edited version. Keys Studio doesn't edit (theme, style, accent…) are kept.
export async function writeContent(store, configPath, next, note = 'you edited') {
  if (!next || typeof next !== 'object' || Array.isArray(next)) throw new Error('content must be an object');
  const { errors } = validate(next);
  if (errors.length) throw new Error(`not saved, fix these first: ${errors.join('; ')}`);
  return store.data.withLock('content', async () => {
    const cur = JSON.parse(await readFile(configPath, 'utf8'));
    if (!(await store.data.readJSON('content/index.json', [])).length) await snapshot(store, cur, 'before Studio edits');
    const merged = { ...cur, ...next, theme: cur.theme, style: cur.style, accent: next.accent ?? cur.accent };
    if (merged.style === undefined) delete merged.style;
    if (merged.accent === undefined) delete merged.accent;
    // Saving without changes isn't a new version.
    if (JSON.stringify(merged) === JSON.stringify(cur)) {
      const index = await store.data.readJSON('content/index.json', []);
      return { content: cur, version: index.length ? index[index.length - 1].n : null, unchanged: true, ...validate(cur) };
    }
    await writeFile(configPath, `${JSON.stringify(merged, null, 2)}\n`);
    const n = await snapshot(store, merged, note);
    return { content: merged, version: n, ...validate(merged) };
  });
}

export async function restoreContent(store, configPath, n) {
  const old = await store.data.readJSON(`content/${Number(n)}.json`, null);
  if (!old) throw new Error(`no content version ${n}`);
  return writeContent(store, configPath, old, `restored v${n}`);
}

export async function importGitHub(store, configPath, user) {
  if (!/^[A-Za-z0-9-]{1,39}$/.test(String(user || ''))) throw new Error('enter a GitHub username');
  const cur = JSON.parse(await readFile(configPath, 'utf8'));
  const { config, added } = mergeGitHub(cur, await fetchGitHub(user));
  const saved = await writeContent(store, configPath, config, `imported GitHub ${user}`);
  return { ...saved, added };
}

export async function saveUpload(store, { name, type, body }) {
  const ext = UPLOAD_TYPES[String(type || '').split(';')[0].trim()];
  if (!ext) throw new Error('upload a PDF, DOCX, text file or LinkedIn export (zip)');
  if (body.length > MAX_UPLOAD) throw new Error('file is over 10 MB');
  const base = String(name || 'resume').replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'resume';
  const key = `inputs/${base}.${ext}`;
  await store.data.writeBytes(key, body);
  return { key, path: `.folio/${key}`, bytes: body.length };
}

export function contentBrief({ files, cli }) {
  return `# Fill in the person's content

They uploaded: ${files.map((f) => `\`${f}\``).join(', ')}. Read ${files.length > 1 ? 'them' : 'it'} and fill \`folio.json\` (their content).

Follow skills/folio/SKILL.md, step 3 ("Write the content"), exactly:
- **Never invent facts.** No made-up numbers, employers, dates, degrees or star counts. Copy credentials verbatim.
- Outcome-first bullets, one-line project pitches, a headline of 10 words or fewer, an about of 2–3 sentences.
- Never add a phone number or street address.
- Keep anything already in folio.json that the files don't contradict; when sources disagree, use the most recent and tell the person.

Check it with \`${cli} validate\`, then tell the person to review it in Studio → Content, where every field is editable and every save can be undone.
`;
}
