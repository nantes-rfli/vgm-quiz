const test = require('node:test');
const assert = require('node:assert');
const { generateChoices } = require('../public/mc.js');

test('generateChoices returns 4 unique options including correct', () => {
  const tracks = [
    { title: 'T1', game: 'GameA', composer: 'Comp1', year: '1990' },
    { title: 'T2', game: 'GameB', composer: 'Comp1', year: '1990' },
    { title: 'T3', game: 'GameC', composer: 'Comp1', year: '1990' },
    { title: 'T4', game: 'GameD', composer: 'Comp1', year: '1990' },
    { title: 'T5', game: 'GameE', composer: 'Comp2', year: '1991' }
  ];
  const opts = generateChoices(tracks[0], 'title-game', tracks, s => s.toLowerCase());
  assert.equal(opts.length, 4);
  assert.ok(opts.includes('GameA'));
  const set = new Set(opts.map(s => s.toLowerCase()));
  assert.equal(set.size, 4);
});
