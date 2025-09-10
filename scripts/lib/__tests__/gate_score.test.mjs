import test from 'node:test';
import assert from 'node:assert/strict';
import { computeGateScore, guardScore, providerTrust, clamp01 } from '../../lib/gate_score.mjs';

test('clamp01 clamps values', () => {
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(2), 1);
  assert.equal(clamp01(0.5), 0.5);
});

test('providerTrust mapping', () => {
  assert.equal(providerTrust('apple'), 1.00);
  assert.equal(providerTrust('youtube_official'), 0.85);
  assert.equal(providerTrust('youtube'), 0.35);
  assert.equal(providerTrust('stub'), 0.10);
  assert.equal(providerTrust('unknown'), 0.20);
});

test('guardScore penalties', () => {
  const base = { meta:{ provenance:{ source:'x',provider:'apple',id:'1',collected_at:'t',hash:'h',license_hint:'preview' } }, composer:['a'], dedup:{theta:0.0} };
  assert.equal(guardScore(base), 1.0);
  assert.equal(guardScore({ ...base, meta:{ provenance:{...base.meta.provenance, license_hint:'unknown'} } }) <= 0.5, true);
  assert.equal(guardScore({ ...base, composer:[] }) <= 0.8, true);
  assert.equal(guardScore({ ...base, dedup:{theta:0.95} }), 0);
});

test('computeGateScore in [0,1]', () => {
  const o = { meta:{ provenance:{ source:'x',provider:'apple',id:'1',collected_at:'t',hash:'h',license_hint:'preview' } }, composer:['a'], dedup:{theta:0.0} };
  const s = computeGateScore(o);
  assert.ok(s >= 0 && s <= 1);
});
