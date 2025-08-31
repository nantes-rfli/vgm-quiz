'use strict';
// Heuristic difficulty (1 easy .. 5 hard) — placeholder but stable
// Factors: string length, composer/game frequency (common = easier), year recency
function scoreCandidate(c, freq){
  let s = 0;
  const len = (c.title||'').length;
  if (len <= 12) s += 0; else if (len <= 20) s += 1; else s += 2;

  const cf = freq.composer.get(c.norm.composer) || 1;
  const gf = freq.game.get(c.norm.game) || 1;
  // very common titles feel easier
  if (cf >= 20) s -= 1; else if (cf <= 2) s += 1;
  if (gf >= 30) s -= 1; else if (gf <= 2) s += 1;

  const y = c.year || 0;
  if (y >= 2015) s += 1; else if (y <= 1995 && y>0) s -= 1;

  // clamp to 1..5
  let diff = Math.max(1, Math.min(5, 3 + s));
  return diff;
}

function buildFreq(cands){
  const composer = new Map();
  const game = new Map();
  for(const c of cands){
    composer.set(c.norm.composer, 1 + (composer.get(c.norm.composer)||0));
    game.set(c.norm.game, 1 + (game.get(c.norm.game)||0));
  }
  return { composer, game };
}

module.exports = { scoreCandidate, buildFreq };
