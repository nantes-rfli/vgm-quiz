function _equalCanon(a, b) {
  try {
    if (!a || !b) return false;
    return canonical(a.title) === canonical(b.title)
      && canonical(a.game) === canonical(b.game)
      && canonical(a.composer) === canonical(b.composer);
  } catch (_) { return false; }
}

function _pickOverride(track, type, canonical) {
  try {
    const chosen = (typeof window !== 'undefined') && window.__DAILY_AUTO_CHOSEN;
    if (!chosen || !chosen.choices) return null;
    // ensure we're on the same record (avoid accidental cross-use)
    const a = { title: track.title, game: track.game, composer: track.composer };
    const b = { title: chosen.title, game: chosen.game, composer: chosen.composer };
    if (!_equalCanon(a, b)) return null;
    // choose field
    const field = type === 'title-game' ? 'game' : 'composer';
    const arr = (chosen.choices && chosen.choices[field]) || null;
    if (!Array.isArray(arr) || arr.length < 2) return null;
    // ensure correct is included
    const correct = track[field];
    const canon = v => canonical(v);
    const hasCorrect = arr.some(v => canon(v) === canon(correct));
    const dedup = [];
    const seen = new Set();
    const push = (v) => { const c = canon(v); if (!seen.has(c)) { seen.add(c); dedup.push(v); } };
    if (!hasCorrect) push(correct);
    arr.forEach(push);
    // trim/pad to 4
    while (dedup.length < 4) dedup.push(correct);
    return dedup.slice(0, 4);
  } catch (e) {
    console.warn('[mc] override choices failed', e);
    return null;
  }
}

function generateChoices(track, type, tracks, canonical) {
  // 1) Try override from daily_auto (when ?auto=1 and choices exist)
  const overridden = _pickOverride(track, type, canonical);
  if (overridden) return overridden;
  // 2) Fallback to built-in heuristics
  const field = type === 'title-game' ? 'game' : 'composer';
  const correct = track[field];
  const used = new Set([canonical(correct)]);
  let candidates = tracks.filter(t => t !== track && (t.year === track.year || t.composer === track.composer));
  candidates.sort(() => Math.random() - 0.5);
  const dummies = [];
  for (const t of candidates) {
    const val = t[field];
    const canon = canonical(val);
    if (!used.has(canon)) {
      used.add(canon);
      dummies.push(val);
      if (dummies.length === 3) break;
    }
  }
  if (dummies.length < 3) {
    const others = tracks.filter(t => t !== track);
    others.sort(() => Math.random() - 0.5);
    for (const t of others) {
      const val = t[field];
      const canon = canonical(val);
      if (!used.has(canon)) {
        used.add(canon);
        dummies.push(val);
        if (dummies.length === 3) break;
      }
    }
  }
  return [correct, ...dummies];
}

if (typeof module !== 'undefined') {
  module.exports = { generateChoices };
} else {
  window.generateChoices = generateChoices;
}
