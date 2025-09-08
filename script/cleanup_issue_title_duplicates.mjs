/**
 * Standalone: Close duplicate open issues that share the same title.
 * Canonical: prefer issue that contains an <!-- issue-id: ... --> marker; else most recently updated.
 */
const REPO = process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.GITHUB_TOKEN;

if (!REPO || !TOKEN) {
  console.error('Missing GITHUB_REPOSITORY or GITHUB_TOKEN');
  process.exit(1);
}

const [owner, repo] = REPO.split('/');
const base = 'https://api.github.com';

async function gh(path, init = {}) {
  const res = await fetch(base + path, {
    ...init,
    headers: {
      'authorization': `Bearer ${TOKEN}`,
      'accept': 'application/vnd.github+json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
  const ctype = res.headers.get('content-type') || '';
  return ctype.includes('application/json') ? res.json() : res.text();
}

async function run() {
  const open = [];
  let page = 1;
  while (true) {
    const arr = await gh(`/repos/${owner}/${repo}/issues?state=open&per_page=100&page=${page}`);
    if (!Array.isArray(arr) || arr.length === 0) break;
    open.push(...arr.filter(x => !x.pull_request));
    page++;
    if (arr.length < 100) break;
  }

  const byTitle = new Map();
  for (const it of open) {
    const key = it.title.trim();
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key).push(it);
  }

  for (const [title, list] of byTitle.entries()) {
    if (list.length < 2) continue;
    let keep = list.find(x => /<!--\s*issue-id:\s*[-a-z0-9]+\s*-->/.test(x.body || ''));
    if (!keep) keep = list.slice().sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
    for (const it of list) {
      if (it.number === keep.number) continue;
      await gh(`/repos/${owner}/${repo}/issues/${it.number}`, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'closed' }),
      });
      await gh(`/repos/${owner}/${repo}/issues/${it.number}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: `Closed as duplicate of #${keep.number} (title match).` }),
      });
      console.log(`[cleanup] closed dup #${it.number} -> keep #${keep.number}: ${title}`);
    }
  }
}

run().catch(e => { console.error(e); process.exit(1); });
