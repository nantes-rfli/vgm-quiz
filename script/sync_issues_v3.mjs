/**
 * sync_issues_v3.mjs (v3.1)
 * Like v2, but supports optional `state` in specs ("open"|"closed").
 * - Match by `id` marker (<!-- issue-id: ... -->) or title (first-time)
 * - Update title/body/labels as before
 * - If `state` provided and differs from current, PATCH state accordingly
 */
import fs from 'node:fs';

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
  const res = await fetch(`https://api.github.com${pathname}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${res.status} ${res.statusText} for ${pathname}: ${t}`);
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

function deDupe(arr) { return Array.from(new Set(arr)); }

function normSpec(i) {
  const id = (i.id || '').trim();
  const title = (i.title || '').trim();
  const labels = deDupe(i.labels || []);
  let body = (i.body || '').trim();
  let state = i.state;
  if (state && !['open','closed'].includes(state)) state = undefined;
  if (id) {
    const marker = `<!-- issue-id: ${id} -->`;
    if (!body.includes(marker)) body = `${marker}\n\n${body}`;
  }
  return { id, title, labels, body, state };
}

function indexIssues(issues) {
  const byTitle = new Map();   // title -> Issue[] (keep duplicates)
  const byId = new Map();
  for (const it of issues) {
    if (it.title) {
      const arr = byTitle.get(it.title) || [];
      arr.push(it);
      byTitle.set(it.title, arr);
    }
    const m = (it.body || '').match(/<!--\s*issue-id:\s*([a-z0-9-]+)\s*-->/i);
    if (m) byId.set(m[1], it);
  }
  return { byTitle, byId };
}

async function main() {
  const [owner, repo] = REPO.split('/');
  const specs = readSpecs().map(normSpec);
  if (specs.length === 0) { console.log('No issue specs found.'); return; }

  // Labels
  const labelSet = new Set(); for (const s of specs) for (const l of s.labels) labelSet.add(l);
  const labelDefs = Array.from(labelSet).map(name => {
    const color = name.startsWith('roadmap:') ? '7fdbff'
      : name.startsWith('area:') ? 'b10dc9'
      : name.startsWith('type:') ? 'ff851b'
      : '0e8a16';
    return { name, color };
  });
  await ensureLabels(owner, repo, labelDefs);

  const issues = await listIssues(owner, repo);
  const { byTitle, byId } = indexIssues(issues);

  for (const s of specs) {
    const titleArr = byTitle.get(s.title) || [];
    let target = s.id ? byId.get(s.id) : (titleArr[0] || null);

    // fallback when spec has id but existing issue lacks marker: match by title (prefer open)
    if (!target && s.id && titleArr.length > 0) {
      target = titleArr.find(it => it.state === 'open') || titleArr[0];
    }

    if (!target) {
      const created = await gh(`/repos/${owner}/${repo}/issues`, {
        method: 'POST',
        body: JSON.stringify({ title: s.title, body: s.body, labels: s.labels, state: s.state }),
      });
      console.log(`Created #${created.number}: ${created.title} (${created.state})`);
      continue;
    }

    // Title/body/labels update
    const currentLabels = (target.labels || []).map(l => l.name);
    const wantLabels = s.labels;
    const labelsChanged = JSON.stringify(deDupe(currentLabels).sort()) !== JSON.stringify(deDupe(wantLabels).sort());
    const bodyChanged = (target.body || '').trim() !== s.body;
    const titleChanged = (target.title || '') !== s.title;

    const patch = {};
    if (labelsChanged) patch.labels = wantLabels;
    if (bodyChanged) patch.body = s.body;
    if (titleChanged) patch.title = s.title;

    // State update
    if (s.state && s.state !== target.state) patch.state = s.state;

    if (Object.keys(patch).length > 0) {
      const updated = await gh(`/repos/${owner}/${repo}/issues/${target.number}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      console.log(`Updated #${updated.number}: ${updated.title} (${updated.state})`);
    } else {
      console.log(`No change: #${target.number} ${target.title} (${target.state})`);
    }

    // Close duplicate-by-title issues when spec is closed
    if (s.state === 'closed' && (titleArr.length > 1)) {
      for (const it of titleArr) {
        if (it.number === target.number) continue;
        if (it.state === 'closed') continue;
        await gh(`/repos/${owner}/${repo}/issues/${it.number}`, {
          method: 'PATCH',
          body: JSON.stringify({ state: 'closed' }),
        });
        console.log(`Closed duplicate by title #${it.number}: ${it.title}`);
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
