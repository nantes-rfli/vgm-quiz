import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayController } from '../public/app/play-controller.mjs';

test('start/stop set and clear timer', async (t) => {
  let now = 0;
  const pc = createPlayController({ now: () => now });
  let timedOut = false;
  pc.start(1000, { onTimeout: () => { timedOut = true; } });
  // fast-forward "time"
  now = 1500;
  // wait a tick for interval (200ms) to check
  await new Promise(r => setTimeout(r, 250));
  assert.equal(timedOut, true);
  pc.stop();
});

test('afterAnswer invokes onAnswer hook', () => {
  const pc = createPlayController();
  let got = null;
  pc.onAnswer((p) => { got = p; });
  pc.afterAnswer({ correct: true, remaining: 2 });
  assert.deepEqual(got, { correct: true, remaining: 2 });
});

test('stop() is idempotent', () => {
  const pc = createPlayController({ now: () => Date.now() });
  pc.start(10, { onTimeout: () => {} });
  pc.stop();
  pc.stop();
  // if no exception, pass
  assert.ok(true);
});
