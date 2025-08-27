function generateChoices(track, type, tracks, canonical) {
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
