/**
 * Export a snapshot of roadmap Issues into docs/issues/STATE.md and state.json
 * - Filters issues that have at least one label starting with "roadmap:"
 * - Groups by roadmap label (e.g., v1.5, v1.7)
 * - Writes both machine-readable JSON and human-readable Markdown
 */
import fs from 'node:fs';

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY;
if (!TOKEN || !REPO) {
  console.error("GITHUB_TOKEN or GITHUB_REPOSITORY missing");
  process.exit(1);
}

const [owner, repo] = REPO.split('/');
const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function gh(pathname) {
  const res = await fetch(`https://api.github.com${pathname}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${pathname}\n${text}`);
  }
  return res.json();
}

async function listIssues() {
  const gather = async (state) => gh(`/repos/${owner}/${repo}/issues?state=${state}&per_page=100&sort=updated&direction=desc`);
  const open = await gather('open');
  const closed = await gather('closed');
  return [...open, ...closed].filter(x => !x.pull_request);
}

function toRecord(x) {
  const roadmap = (x.labels || [])
    .map(l => typeof l === 'string' ? l : l.name)
    .filter(n => n && n.startsWith('roadmap:'));
  if (roadmap.length === 0) return null;
  return {
    number: x.number,
    title: x.title,
    state: x.state,
    html_url: x.html_url,
    labels: (x.labels || []).map(l => typeof l === 'string' ? l : l.name),
    assignees: (x.assignees || []).map(a => a.login),
    milestone: x.milestone?.title || null,
    updated_at: x.updated_at,
    roadmap,
  };
}

function groupByRoadmap(recs) {
  const m = new Map();
  for (const r of recs) {
    for (const tag of r.roadmap) {
      const key = tag.replace('roadmap:', '');
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(r);
    }
  }
  for (const [k, arr] of m.entries()) {
    arr.sort((a,b) => b.updated_at.localeCompare(a.updated_at));
  }
  return m;
}

function mdTable(rows) {
  const header = "| # | Title | State | Labels | Assignees | Updated |\n|---:|---|---|---|---|---|\n";
  return header + rows.map(r => {
    const labels = r.labels.join(", ");
    const ass = r.assignees.join(", ");
    return `| ${r.number} | [${r.title}](${r.html_url}) | ${r.state} | ${labels} | ${ass} | ${r.updated_at} |`;
  }).join("\n") + "\n";
}

async function main() {
  const issues = await listIssues();
  const recs = issues.map(toRecord).filter(Boolean);
  const grouped = groupByRoadmap(recs);

  const outDir = 'docs/issues';
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(`${outDir}/state.json`, JSON.stringify({ exported_at: new Date().toISOString(), items: recs }, null, 2));

  let md = `# Issues snapshot\n\nExported at: ${new Date().toISOString()}\n\n`;
  const keys = Array.from(grouped.keys()).sort();
  for (const k of keys) {
    md += `## ${k}\n\n`;
    md += mdTable(grouped.get(k));
    md += "\n";
  }
  fs.writeFileSync(`${outDir}/STATE.md`, md, 'utf-8');
  console.log("Wrote docs/issues/STATE.md and state.json");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
