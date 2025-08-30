// Answer normalization v1.1
// - NFKC + lowercase
// - Roman numerals (I,V,X,L,C,D,M / Ⅶ 等もNFKCでOK) → Arabic numerals
// - 非意味文字の除去：空白/各種ダッシュ/スラッシュ/中点/長音「ー」/記号/括弧 等
// - 依存なし・小さく実装。ブラウザ/Nodeのどちらでも動作。

function toNFKCLower(s) {
  return String(s ?? '').normalize('NFKC').trim().toLowerCase();
}

function romanToIntToken(tok) {
  const map = { i:1, v:5, x:10, l:50, c:100, d:500, m:1000 };
  let total = 0, prev = 0;
  for (let i = tok.length - 1; i >= 0; i--) {
    const val = map[tok[i]];
    if (!val) return null;
    if (val < prev) total -= val; else { total += val; prev = val; }
  }
  if (total <= 0 || total > 3999) return null;
  return total;
}

function replaceRomanNumerals(s) {
  // 単独トークンのローマ数字だけ数値化（英数以外に挟まれているものを対象）
  return s.replace(/(^|[^a-z0-9])([mdclxvi]{1,7})(?=($|[^a-z0-9]))/g, (m, pre, tok) => {
    const n = romanToIntToken(tok);
    if (n == null) return m;
    return pre + String(n);
  });
}

const NON_MEANINGFUL_CLASS = [
  '\\s','\\u00A0','\\u2000-\\u200B','\\u202F\\u205F\\u3000', // 空白
  '、。·・，．','!"#$%&\\\'“”‘’\\(\\)\\[\\]｢｣「」『』【】〈〉《》{}＜＞<>', // 句読点/括弧
  ':：;；\\.?？,!！','_','\\\\','\\/', // 区切り類
  '\\u2010-\\u2015','\\u2212','\\u30FB','\\u30FC','\\-－−' // ダッシュ/中点/長音/マイナス
].join('');
const NON_MEANINGFUL_RE = new RegExp('[' + NON_MEANINGFUL_CLASS + ']+', 'g');

export function normalize(input) {
  let s = toNFKCLower(input);
  s = replaceRomanNumerals(s);        // 先にローマ数字を処理
  s = s.replace(NON_MEANINGFUL_RE, ''); // 非意味文字を除去
  return s;
}

export default { normalize };

