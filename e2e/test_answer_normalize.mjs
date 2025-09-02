import { normalize } from '../public/app/normalize.mjs';
import assert from 'node:assert/strict';

function eq(a, b, msg) {
  assert.equal(normalize(a), normalize(b), `${msg} | got "${normalize(a)}" vs "${normalize(b)}"`);
}

const cases = [];

// Roman numerals ↔ Arabic
eq('Final Fantasy VII', 'final-fantasy 7', 'Roman VII should equal 7');
eq('Dragon Quest X', 'dragon quest 10', 'Roman X should equal 10');
eq('kingdom hearts iii', 'Kingdom Hearts 3', 'iii should equal 3');

// Punctuation / separators / whitespace
eq('NieR:Automata', 'nier automata', 'Colon should be ignored');
eq('Metal Gear Solid — Peace Walker', 'metal gear solid peace walker', 'Dashes should be ignored');
eq('Resident Evil 2 / Biohazard RE:2', 'Resident Evil 2 Biohazard RE 2', 'Slashes/colons ignored');

// JP: spaces / middle dot / long vowel
eq('ポケットモンスター　赤', 'ポケットモンスター赤', 'JP spaces ignored');
eq('ドラゴン・クエスト', 'ドラゴンクエスト', 'Middle dot ignored');
eq('ドンキーコング', 'ドンキーーーコング', 'Long vowel marks ignored');

console.log('[normalize] all tests passed');
// Edge cases (light): series naming / punctuation / numerals
cases.push(['Dragon Quest III', 'ドラゴン・クエストIII']);
cases.push(['Castlevania Dracula X', 'Castlevania ＆ Dracula X']); // fullwidth & variant
cases.push(['Chrono Trigger', 'chrono〜trigger']); // wave dash removal
cases.push(['Street Fighter 2 Turbo', 'Street Fighter II Turbo']); // roman numeral boundaries
