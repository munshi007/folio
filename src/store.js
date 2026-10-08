// Storage boundary. Everything that persists Studio data goes through a Store, never through fs directly,
// so a hosted version can swap FsStore for a database + object storage without touching the library logic.
//
// Two namespaces:
//   data   – folio's own records (library index, versions, events), under <project>/.folio/
//   themes – design source files the user and their agent edit, under <project>/themes/
// Keys are relative paths with forward slashes; they never contain "..".

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, readdir, rename } from 'node:fs/promises';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';

const KEY_RE = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

function checkKey(key) {
  if (typeof key !== 'string' || !KEY_RE.test(key) || key.split('/').some((s) => s === '..' || s === '.')) {
    throw new Error(`invalid store key: ${JSON.stringify(key)}`);
  }
  return key;
}

class FsNamespace {
  constructor(root) {
    this.root = resolve(root);
  }
  path(key) {
    const file = resolve(this.root, checkKey(key));
    const rel = relative(this.root, file);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`key escapes store: ${key}`);
    return file;
  }
  async exists(key) {
    return existsSync(this.path(key));
  }
  async readText(key) {
    const file = this.path(key);
    return existsSync(file) ? readFile(file, 'utf8') : null;
  }
  // Write to a temp file then rename, so a crash mid-write never leaves a half-written record.
  async writeText(key, text) {
    const file = this.path(key);
    await mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, text);
    await rename(tmp, file);
  }
  async readJSON(key, fallback = null) {
    const text = await this.readText(key);
    if (text == null) return fallback;
    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }
  async writeJSON(key, value) {
    await this.writeText(key, `${JSON.stringify(value, null, 2)}\n`);
  }
  // Immediate children of a directory key ('' = root).
  async list(prefix = '') {
    const dir = prefix ? this.path(prefix) : this.root;
    if (!existsSync(dir)) return [];
    return (await readdir(dir)).sort();
  }
}

export class FsStore {
  constructor(projectDir) {
    this.projectDir = resolve(projectDir);
    this.data = new FsNamespace(join(this.projectDir, '.folio'));
    this.themes = new FsNamespace(join(this.projectDir, 'themes'));
  }
}

export function openStore(projectDir) {
  return new FsStore(projectDir);
}
