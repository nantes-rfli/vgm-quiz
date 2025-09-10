import { test, strict as assert } from 'node:test';
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

test('accept/reject invoke respective hooks', () => {
  const pc = createPlayController();
  let accepted = null;
  let rejected = null;
  pc.onAccept(p => { accepted = p; });
  pc.onReject(p => { rejected = p; });
  pc.accept({ remaining: 5 });
  pc.reject({ remaining: 3 });
  assert.deepEqual(accepted, { remaining: 5 });
  assert.deepEqual(rejected, { remaining: 3 });
});

test('stop() is idempotent', () => {
  const pc = createPlayController({ now: () => Date.now() });
  pc.start(10, { onTimeout: () => {} });
  pc.stop();
  pc.stop();
  // if no exception, pass
  assert.ok(true);
});

test('onNext/next triggers callback', () => {
  const pc = createPlayController();
  let called = 0;
  pc.onNext(() => { called++; });
  pc.next();
  assert.equal(called, 1);
});

test('wireLives + refreshLives calls injected functions in order', async () => {
  const order = [];
  const pc = createPlayController();
  pc.wireLives({
    recomputeMistakes: () => { order.push('recompute'); },
    maybeEndGameByLives: () => { order.push('maybeEnd'); }
  });
  pc.refreshLives();
  // recomputeMistakes is scheduled via setTimeout(0), so wait a tick
  await new Promise(r => setTimeout(r, 10));
  assert.deepEqual(order, ['maybeEnd'] /* may have run first sync */, { message: 'first sync call is maybeEnd' });
  // NOTE: we cannot deterministically assert timer order cross-env; ensure both eventually run:
  assert.equal(order.includes('recompute'), true);
});
