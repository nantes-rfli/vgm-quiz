// Generic UI helpers extracted by v1.12 UI-slim Phase 1

async function yieldToMain() {
  return new Promise(requestAnimationFrame);
}

function getQueryParam(name) {
  try { return new URLSearchParams(location.search).get(name); }
  catch { return null; }
}

function getQueryBool(key) {
  try {
    const v = new URLSearchParams(location.search).get(key);
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

// Deterministic PRNG helpers
function xfnv1a(str) {
  // 32-bit FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export { yieldToMain, getQueryParam, getQueryBool, xfnv1a, mulberry32 };

