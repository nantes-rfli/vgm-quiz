// Question selection pipeline (front) — v0.1
// - decade buckets (e.g., 1990s, 2000s, unknown)
// - shuffle inside each bucket using provided RNG
// - round-robin across buckets to produce an index order
// Usage:
//   const order = orderByYearBucket(questions, rng); // returns array of indices
//   const reordered = order.map(i => questions[i]);

function decadeOf(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return 'unknown';
  return `${Math.floor(y / 10) * 10}s`;
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function orderByYearBucket(questions, rng = Math.random) {
  // group indices by decade
  const buckets = new Map(); // decade -> indices[]
  questions.forEach((q, i) => {
    const yr = q?.track?.year;
    const k = decadeOf(yr);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(i);
  });
  // shuffle inside each bucket
  for (const [, idxs] of buckets) shuffleInPlace(idxs, rng);
  // round-robin across buckets
  const keys = Array.from(buckets.keys());
  let remaining = questions.length;
  const out = [];
  let p = 0;
  while (remaining > 0 && keys.length > 0) {
    const k = keys[p % keys.length];
    const bin = buckets.get(k);
    const v = bin.shift();
    if (v != null) {
      out.push(v);
      remaining--;
    }
    if (bin.length === 0) {
      buckets.delete(k);
      keys.splice(p % keys.length, 1);
      // don't advance p when removing current bucket
      continue;
    }
    p++;
  }
  return out;
}

export default { orderByYearBucket };
