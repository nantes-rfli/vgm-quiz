/**
 * Sync GitHub issues from JSON specs in docs/issues/*.json
 * - Idempotent by title: if an issue with the same title exists, update labels/body; else create.
 * - Labels are auto-created if missing.
 * - Uses GITHUB_TOKEN / GITHUB_REPOSITORY.
 */
import fs from 'node:fs';
import path from 'node:path';

const ISSUES_DIR = 'docs/issues';
const REPO = process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.GITHUB_TOKEN;

if (!REPO || !TOKEN) {
  console.error('Missing GITHUB_REPOSITORY or GITHUB_TOKEN');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function gh(pathname, init = {}) {
  const url = `https://api.github.com${pathname}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText} for ${pathname}: ${text}`);
  }
  return res.json();
}

function readSpecs() {
  if (!fs.existsSync(ISSUES_DIR)) return [];
  const files = fs.readdirSync(ISSUES_DIR).filter(f => f.endsWith('.json'));
  let items = [];
  for (const f of files) {
    const full = `${ISSUES_DIR}/${f}`;
    const data = JSON.parse(fs.readFileSync(full, 'utf-8'));
    if (Array.isArray(data)) items.push(...data);
  }
  return items;
}

async function ensureLabels(owner, repo, labels) {
  const existing = await gh(`/repos/${owner}/${repo}/labels?per_page=100`);
  const names = new Set(existing.map(l => l.name));
  for (const lab of labels) {
    if (!names.has(lab.name)) {
      await gh(`/repos/${owner}/${repo}/labels`, {
        method: 'POST',
        body: JSON.stringify({
          name: lab.name,
          color: lab.color || '0e8a16',
          description: lab.description || '',
        }),
      });
      names.add(lab.name);
    }
  }
}

async function listIssuesByTitle(owner, repo) {
  let all = [];
  for (const state of ['open','closed']) {
    const arr = await gh(`/repos/${owner}/${repo}/issues?state=${state}&per_page=100`);
    all = all.concat(arr.filter(x => !x.pull_request));
  }
  const map = new Map();
  for (const it of all) map.set(it.title, it);
  return map;
}

function deDupe(arr) {
  return Array.from(new Set(arr));
}

function normalizeIssue(i) {
  return {
    title: i.title.trim(),
    body: (i.body || '').trim(),
    labels: deDupe(i.labels || []),
  };
}

async function main() {
  const [owner, repo] = REPO.split('/');
  const specs = readSpecs().map(normalizeIssue);
  if (specs.length === 0) {
    console.log('No issue specs found.');
    return;
  }

  const labelSet = new Set();
  for (const s of specs) for (const l of s.labels) labelSet.add(l);
  const labelDefs = Array.from(labelSet).map(name => {
    const color = name.startsWith('roadmap:') ? '7fdbff'
      : name.startsWith('area:') ? 'b10dc9'
      : name.startsWith('type:') ? 'ff851b'
      : '0e8a16';
    return { name, color };
  });
  await ensureLabels(owner, repo, labelDefs);

  const byTitle = await listIssuesByTitle(owner, repo);

  for (const s of specs) {
    const existing = byTitle.get(s.title);
    if (!existing) {
      const created = await gh(`/repos/${owner}/${repo}/issues`, {
        method: 'POST',
        body: JSON.stringify({
          title: s.title,
          body: s.body,
          labels: s.labels,
        }),
      });
      console.log(`Created #${created.number}: ${created.title}`);
    } else {
      const currentLabels = existing.labels?.map(l => l.name) || [];
      const needBody = (existing.body || '').trim() !== s.body;
      const needLabels = JSON.stringify(deDupe(currentLabels.sort())) !== JSON.stringify(deDupe(s.labels.slice().sort()));
      if (needBody || needLabels) {
        const updated = await gh(`/repos/${owner}/${repo}/issues/${existing.number}`, {
          method: 'PATCH',
          body: JSON.stringify({
            body: needBody ? s.body : undefined,
            labels: needLabels ? s.labels : undefined,
          }),
        });
        console.log(`Updated #${updated.number}: ${updated.title}`);
      } else {
        console.log(`No change: #${existing.number} ${existing.title}`);
      }
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
