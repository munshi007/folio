import { execFileSync } from 'node:child_process';
import { mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FolioError } from './build.js';

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function tryGit(args, cwd) {
  try {
    return git(args, cwd);
  } catch {
    return '';
  }
}

// owner/repo from https://github.com/o/r(.git) or git@github.com:o/r(.git)
export function parseGitHubRemote(remote) {
  const m = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export function pagesUrl({ owner, repo }) {
  return repo.toLowerCase() === `${owner.toLowerCase()}.github.io`
    ? `https://${owner.toLowerCase()}.github.io/`
    : `https://${owner.toLowerCase()}.github.io/${repo}/`;
}

// Publish a built folder to the gh-pages branch of the current repo's origin.
// The gh-pages branch is replaced wholesale on each deploy; nothing else in the repo is touched.
export async function deploy({ outDir, cwd = process.cwd(), branch = 'gh-pages' }) {
  const remote = tryGit(['remote', 'get-url', 'origin'], cwd);
  if (!remote) {
    throw new FolioError(
      'No git remote "origin" here. Create a GitHub repo first, e.g.\n  git init && gh repo create my-portfolio --public --source=. --push',
    );
  }
  const gh = parseGitHubRemote(remote);

  const tmp = await mkdtemp(join(tmpdir(), 'folio-deploy-'));
  try {
    await cp(outDir, tmp, { recursive: true });
    git(['init', '-q', '-b', branch], tmp);
    git(['add', '-A'], tmp);
    const identity = tryGit(['config', 'user.email'], cwd)
      ? []
      : ['-c', 'user.name=folio', '-c', 'user.email=folio@users.noreply.github.com'];
    git([...identity, 'commit', '-q', '-m', `folio: publish ${new Date().toISOString()}`], tmp);
    git(['push', '-q', '--force', remote, `${branch}:${branch}`], tmp);
  } catch (e) {
    throw new FolioError(`Deploy failed: ${(e.stderr || e.message).toString().trim()}`);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }

  // Best effort: switch GitHub Pages on for that branch if the gh CLI is available.
  let pagesEnabled = false;
  if (gh) {
    try {
      execFileSync('gh', ['api', `repos/${gh.owner}/${gh.repo}/pages`, '-X', 'POST', '-f', `source[branch]=${branch}`, '-f', 'source[path]=/'], { stdio: 'ignore' });
      pagesEnabled = true;
    } catch {
      // Already enabled, or gh missing / not logged in. Either way the push succeeded.
    }
  }
  return { url: gh ? pagesUrl(gh) : null, remote, pagesEnabled };
}
