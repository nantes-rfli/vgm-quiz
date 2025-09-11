// Simple test API loaded only when ?mock=1 is in the URL.
// Provides normalization consistent with spec v1.2 and alias loading.
// Exposes window.__testAPI = { normalize, normalizeMatch, ready }.
(() => {
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('mock') !== '1') return;
  } catch (_) {
    // no-op
    return;
  }

  // 現状の絶対/固定パスは Pages 配下 (/vgm-quiz/) で 404 になりやすい。
  // location 基準で相対解決する。
  function resolve(url) {
    return new URL(url, location.href).href;
  }

  const aliasUrls = [
    resolve('../build/aliases.json'),
    resolve('./aliases_local.json')
  ];

  const romanToArabic = Object.fromEntries([
    [1,'I'],[2,'II'],[3,'III'],[4,'IV'],[5,'V'],[6,'VI'],[7,'VII'],[8,'VIII'],[9,'IX'],[10,'X'],
    [11,'XI'],[12,'XII'],[13,'XIII'],[14,'XIV'],[15,'XV'],[16,'XVI'],[17,'XVII'],[18,'XVIII'],[19,'XIX'],[20,'XX']
  ].map(([n,r]) => [r, String(n)]));

  function removeDiacritics(s) {
    // Convert to NFKD and strip combining marks (accents/diacritics)
    // Use explicit ranges for broad browser compatibility.
    // Combining Diacritical Marks:      U+0300–U+036F
    // Combining Diacritical Marks Ext.: U+1AB0–U+1AFF
    // Combining Diacritical Marks Sup.: U+1DC0–U+1DFF
    // Combining Diacritical Marks for Symbols: U+20D0–U+20FF
    // Combining Half Marks: U+FE20–U+FE2F
    return s
      .normalize('NFKD')
      .replace(/[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\uFE20-\uFE2F]/g, '');
  }

  function nfkcLower(s) {
    // Normalize to NFKC and lowercase first, then remove diacritics to fold "é" -> "e"
    return removeDiacritics(s.normalize('NFKC').toLowerCase());
  }

  function stripPunctSpacesLongDash(s) {
    // remove punctuation, spaces, and Japanese choonpu "ー"
    return s.replace(/[\s\u3000\u30FC\-\u2010-\u2015_.,:;!?"'’‘“”\/\\(){}\[\]<>@#\$%^&~`+=|•··…]/g, '');
  }

  function andAmp(s) {
    return s.replace(/\&/g, 'and');
  }

  function romanToArabicFold(s) {
    // Replace standalone roman numerals I..XX to arabic 1..20
    return s.replace(/\b(?:X|IX|IV|V|I|VI|VII|VIII|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)\b/gi, (m) => {
      const u = m.toUpperCase();
      return romanToArabic[u] || m;
    });
  }

  function dropArticles(s) {
    return s.replace(/\b(the|a|an)\b/gi, '');
  }

  function normalizeCore(s) {
    return stripPunctSpacesLongDash(andAmp(dropArticles(romanToArabicFold(nfkcLower(s)))));
  }

  async function loadAliases() {
    const out = {};
    for (const u of aliasUrls) {
      try {
        const res = await fetch(u, { cache: 'no-store' });
        if (!res.ok) continue;
        const m = await res.json();
        for (const [k, arr] of Object.entries(m || {})) {
          if (!out[k]) out[k] = new Set();
          for (const v of arr) out[k].add(v);
        }
      } catch (_) {}
    }
    // Convert sets to arrays
    const map = {};
    for (const [k, set] of Object.entries(out)) map[k] = Array.from(set);
    return map;
  }

  function normalizeWithAliases(s, aliasesMap) {
    const base = normalizeCore(s);
    // If base matches any alias key or value, fold to the key's normalized form.
    // Build a normalized lookup.
    const normMap = new Map(); // normalized string -> canonical normalized
    for (const [canon, list] of Object.entries(aliasesMap || {})) {
      const nCanon = normalizeCore(canon);
      normMap.set(nCanon, nCanon);
      for (const v of (list || [])) {
        normMap.set(normalizeCore(v), nCanon);
      }
    }
    if (normMap.has(base)) return normMap.get(base);
    return base;
  }

  const ready = (async () => {
    const aliases = await loadAliases();
    function normalize(s) {
      return normalizeWithAliases(String(s || ''), aliases);
    }
    function normalizeMatch(a, b) {
      return normalize(a) === normalize(b);
    }
    window.__testAPI = { normalize, normalizeMatch, ready: Promise.resolve(true) };
    return true;
  })();
})();
