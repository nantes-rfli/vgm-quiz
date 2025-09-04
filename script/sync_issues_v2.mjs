/**
 * Sync GitHub issues from JSON specs in docs/issues/*.json (v2)
 * - Prefer matching by "id" (hidden body marker: <!-- issue-id: ... -->)
 * - Fallback to title for first-time migration
 * - Labels are auto-created if missing
 * - Idempotent updates: update body/labels/title only when changed
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
    let data;
    try {
      data = JSON.parse(fs.readFileSync(full, 'utf-8'));
    } catch (e) {
      throw new Error(`Failed to parse ${full}: ${e.message}`);
    }
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

async function listIssues(owner, repo) {
  const gather = async (state) => gh(`/repos/${owner}/${repo}/issues?state=${state}&per_page=100`);
  const open = await gather('open');
  const closed = await gather('closed');
  return [...open, ...closed].filter(x => !x.pull_request);
}

function deDupe(arr) {
  return Array.from(new Set(arr));
}

function normSpec(i) {
  const id = (i.id || "").trim();
  const title = (i.title || "").trim();
  const labels = deDupe(i.labels || []);
  let body = (i.body || "").trim();
  if (id) {
    const marker = `<!-- issue-id: ${id} -->`;
    if (!body.includes(marker)) {
      body = `${marker}\n\n${body}`;
    }
  }
  return { id, title, labels, body };
}

function indexIssuesByIdAndTitle(issues) {
  const byTitle = new Map();
  const byId = new Map(); // from body marker
  for (const it of issues) {
    if (it.title) byTitle.set(it.title, it);
    const body = (it.body || "");
    const m = body.match(/<!--\s*issue-id:\s*([a-z0-9-]+)\s*-->/i);
    if (m) byId.set(m[1], it);
  }
  return { byTitle, byId };
}

async function main() {
  const [owner, repo] = REPO.split('/');
  const specs = readSpecs().map(normSpec);
  if (specs.length === 0) {
    console.log('No issue specs found.');
    return;
  }

  // Prepare labels
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

  const issues = await listIssues(owner, repo);
  const { byTitle, byId } = indexIssuesByIdAndTitle(issues);

  for (const s of specs) {
    const target = s.id ? byId.get(s.id) : byTitle.get(s.title);
    if (!target) {
      // Create new
      const created = await gh(`/repos/${owner}/${repo}/issues`, {
        method: 'POST',
        body: JSON.stringify({
          title: s.title,
          body: s.body,
          labels: s.labels,
        }),
      });
      console.log(`Created #${created.number}: ${created.title}`);
      continue;
    }

    // Prepare patch fields if changed
    const currentLabels = (target.labels || []).map(l => l.name);
    const wantLabels = s.labels;
    const labelsChanged = JSON.stringify(deDupe(currentLabels).sort()) !== JSON.stringify(deDupe(wantLabels).sort());
    const wantBody = s.body;
    const bodyChanged = (target.body || "").trim() !== wantBody;
    const titleChanged = (target.title || "") !== s.title;

    if (labelsChanged || bodyChanged || titleChanged) {
      const updated = await gh(`/repos/${owner}/${repo}/issues/${target.number}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: titleChanged ? s.title : undefined,
          body: bodyChanged ? wantBody : undefined,
          labels: labelsChanged ? wantLabels : undefined,
        }),
      });
      console.log(`Updated #${updated.number}: ${updated.title}`);
    } else {
      console.log(`No change: #${target.number} ${target.title}`);
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

