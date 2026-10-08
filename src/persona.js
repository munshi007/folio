// The persona: how folio reads a person, in a form they can see and correct. Every design brief starts here.
//
// An agent writes it from the resume, repos and the person's own answers (`folio persona write`); the person
// edits dials, worlds and answers in Studio, or asks for a re-read with a one-line correction, which becomes a
// job the agent picks up. Every save is a version (persona/<n>.json), so a bad re-read is one click to undo.

const DIALS = ['energy', 'warmth', 'techDepth', 'playfulness', 'formality'];
const TRAIT_KEYS = ['mood', 'voice', 'signature', 'taste', 'edge'];
const SOURCES = ['resume', 'github', 'linkedin', 'answers', 'you', 'site'];
export const QUESTIONS = {
  feel: { title: 'How should people feel when they land on your site?', options: ['Energized', 'Warm & curious', 'Playful', 'Calm & impressed'] },
  show: { title: 'Which side of you should it show most?', options: ['Building things', 'Study & research', 'Life outside work', 'Mostly the work'] },
  taste: { title: 'Visually, what do you usually like?', options: ['Light & airy', 'Colorful & bold', 'Crafted & tactile', 'Sleek product-like'] },
};

const str = (v, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const strList = (v, maxItems = 12, max = 80) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, maxItems) : []);

export function validatePersona(p) {
  const errors = [];
  if (!p || typeof p !== 'object' || Array.isArray(p)) return ['persona must be a JSON object'];
  if (!str(p.headline)) errors.push('headline: one line, how you read them (e.g. "Builds it. Proves it.")');
  if (!Array.isArray(p.traits) || !p.traits.length) errors.push('traits: at least one {key, value, quote, source}');
  (p.traits || []).forEach((t, i) => {
    if (!TRAIT_KEYS.includes(t?.key)) errors.push(`traits[${i}].key: one of ${TRAIT_KEYS.join(', ')}`);
    if (!str(t?.value)) errors.push(`traits[${i}].value: required`);
    if (t?.source && !SOURCES.includes(t.source)) errors.push(`traits[${i}].source: one of ${SOURCES.join(', ')}`);
  });
  for (const d of DIALS) {
    const v = p.dials?.[d];
    if (v != null && !(Number.isInteger(v) && v >= 0 && v <= 10)) errors.push(`dials.${d}: whole number 0–10`);
  }
  for (const [k, q] of Object.entries(QUESTIONS)) {
    const bad = (p.answers?.[k] || []).filter((a) => !q.options.includes(a));
    if (bad.length) errors.push(`answers.${k}: unknown option ${bad.join(', ')}`);
  }
  return errors;
}

export function normalizePersona(p) {
  return {
    headline: str(p.headline, 120),
    lede: str(p.lede, 400),
    traits: (p.traits || []).filter((t) => TRAIT_KEYS.includes(t?.key)).map((t) => ({ key: t.key, value: str(t.value, 160), quote: str(t.quote, 240), source: SOURCES.includes(t.source) ? t.source : 'resume' })).slice(0, 8),
    dials: Object.fromEntries(DIALS.map((d) => [d, Number.isInteger(p.dials?.[d]) ? Math.min(10, Math.max(0, p.dials[d])) : 5])),
    worlds: strList(p.worlds, 10, 60),
    answers: Object.fromEntries(Object.entries(QUESTIONS).map(([k, q]) => [k, (p.answers?.[k] || []).filter((a) => q.options.includes(a))])),
    implications: strList(p.implications, 8, 160),
    avoid: strList(p.avoid, 8, 120),
  };
}

export async function readPersona(store) {
  const p = await store.data.readJSON('persona.json', null);
  if (!p) return null;
  const versions = await store.data.readJSON('persona/index.json', []);
  return { ...p, versions: versions.slice().reverse() };
}

// Save a full persona as a new version. `note` says why (agent read, your edit, re-read, restore).
export async function writePersona(store, input, note = 'saved') {
  const errors = validatePersona(input);
  if (errors.length) throw new Error(`persona has problems: ${errors.join('; ')}`);
  return store.data.withLock('persona', async () => {
    const versions = await store.data.readJSON('persona/index.json', []);
    const n = versions.length ? versions[versions.length - 1].n + 1 : 1;
    const prev = await store.data.readJSON('persona.json', null);
    const persona = { v: 1, n, updatedAt: new Date().toISOString(), corrections: prev?.corrections ?? [], ...normalizePersona(input) };
    await store.data.writeJSON(`persona/${n}.json`, persona);
    versions.push({ n, at: persona.updatedAt, note: str(note, 120) });
    await store.data.writeJSON('persona/index.json', versions);
    await store.data.writeJSON('persona.json', persona);
    return persona;
  });
}

// Small edits from Studio (dials, worlds, answers) without an agent: merge, then save as a version.
export async function patchPersona(store, patch) {
  const cur = await store.data.readJSON('persona.json', null);
  if (!cur) throw new Error('no persona yet: ask your agent to read your profile first');
  const next = { ...cur };
  if (patch.dials) next.dials = { ...cur.dials, ...patch.dials };
  if (patch.worlds) next.worlds = patch.worlds;
  if (patch.answers) next.answers = { ...cur.answers, ...patch.answers };
  const what = Object.keys(patch).filter((k) => ['dials', 'worlds', 'answers'].includes(k));
  if (!what.length) throw new Error('nothing to change (dials, worlds or answers)');
  return writePersona(store, next, `you edited ${what.join(', ')}`);
}

export async function restorePersona(store, n) {
  const old = await store.data.readJSON(`persona/${Number(n)}.json`, null);
  if (!old) throw new Error(`no persona version ${n}`);
  return writePersona(store, old, `restored v${n}`);
}

export async function addCorrection(store, text) {
  const t = str(text, 300);
  if (!t) throw new Error('say what is off, in a line');
  return store.data.withLock('persona', async () => {
    const cur = await store.data.readJSON('persona.json', null);
    if (!cur) throw new Error('no persona yet');
    cur.corrections = [...(cur.corrections || []), { at: new Date().toISOString(), text: t }];
    await store.data.writeJSON('persona.json', cur);
    return cur;
  });
}

// The brief an agent gets for a persona job (first read or a re-read with the person's correction).
export function personaBrief({ correction = null, cli, current = null, answers = null }) {
  return `# Persona ${correction ? 're-read' : 'read'}

${correction ? `The person read their persona card and said: **“${correction}”**. Re-read them with that in mind. Change what they asked; keep what they didn't object to.\n\nCurrent persona (v${current?.n ?? '?'}):\n\n\`\`\`json\n${JSON.stringify(current ? { headline: current.headline, lede: current.lede, traits: current.traits, dials: current.dials, worlds: current.worlds, implications: current.implications, avoid: current.avoid } : {}, null, 2)}\n\`\`\`\n` : `Read the person from folio.json, their resume and GitHub READMEs.${answers ? ` They answered the three taste questions: ${JSON.stringify(answers)}. Put these in \"answers\" and let them shape the read.` : ''}`}

A CV is written in someone's most formal voice. Don't let it make the persona one-note and serious: their answers and own words outrank the CV's tone.

Write the persona as JSON and save it with \`${cli} persona write <file.json>\` (it validates and keeps every version). Shape:

\`\`\`json
{
  "headline": "one line, how you read them",
  "lede": "two sentences in plain words",
  "traits": [{ "key": "mood|voice|signature|taste|edge", "value": "...", "quote": "their own words, verbatim", "source": "resume|github|linkedin|answers|you|site" }],
  "dials": { "energy": 0-10, "warmth": 0-10, "techDepth": 0-10, "playfulness": 0-10, "formality": 0-10 },
  "worlds": ["their fields and interests, as visual cultures to draw from"],
  "answers": { "feel": [], "show": [], "taste": [] },
  "implications": ["what this means for the design"],
  "avoid": ["what would feel wrong for them"]
}
\`\`\`

Quotes must be their real words; never invent a trait you can't back with a quote or an answer.
`;
}
