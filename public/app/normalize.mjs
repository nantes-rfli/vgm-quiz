// Answer normalization v1.2
// - NFKC + lowercase
// - &/＆ → and
// - Leading articles (the/a/an) stripped
// - Dash normalization to spaces; long vowel mark compression
// - Punctuation removal
// - Roman numerals ↔ Arabic numerals (1–20)

// 先頭冠詞を剥がす（英語のみ・語頭限定）
function stripLeadingArticles(s) {
  return s.replace(/^(?:the|a|an)\s+/, '');
}

// &/＆ → and
function ampToAnd(s) {
  return s.replace(/(?:&|＆)/g, ' and ');
}


// ローマ数字相互変換（単語境界で安全に）
const ROMAN = [
  ['xx',20],['xix',19],['xviii',18],['xvii',17],['xvi',16],['xv',15],
  ['xiv',14],['xiii',13],['xii',12],['xi',11],['x',10],
  ['ix',9],['viii',8],['vii',7],['vi',6],['v',5],['iv',4],['iii',3],['ii',2],['i',1]
];
function romanToArabicSafe(s) {
  for (const [r, n] of ROMAN) {
    const re = new RegExp(`\\b${r}\\b`, 'g');
    s = s.replace(re, String(n));
  }
  return s;
}
function arabicToRomanSafe(s) {
  // 1–20 に限定（誤変換防止）
  const map = {
    20:'xx',19:'xix',18:'xviii',17:'xvii',16:'xvi',15:'xv',
    14:'xiv',13:'xiii',12:'xii',11:'xi',10:'x',9:'ix',8:'viii',
    7:'vii',6:'vi',5:'v',4:'iv',3:'iii',2:'ii',1:'i'
  };
  return s.replace(/\b([1-9]|1[0-9]|20)\b/g, (_, d) => map[d] || _);
}

export function normalize(str) {
  if (str == null) return '';
  let s = String(str);
  // v1.1: NFKC + lower
  s = s.normalize('NFKC').toLowerCase();
  // v1.2: 追加の軽微ルール
  s = ampToAnd(s);
  s = stripLeadingArticles(s);
  // 余分な空白を一旦畳む
  s = s.replace(/[\s\u3000]+/g, ' ').trim();
  // ダッシュ類（ASCII hyphen, en/em/figure/minus, 波ダッシュ）を空白に
  s = s.replace(/[\-\u2010-\u2015\u2212\u301C\uFF5E]/g, ' ');
  // 長音記号（ー）は削除せず、連続を1つに圧縮（カタカナ音価を残す）
  s = s.replace(/ー{2,}/g, 'ー');
  // 記号・句読点の削除（既存＋軽微拡張）
  s = s.replace(/[!"#$%\'()*+,./:;<=>?@\[\]^_`{|}~。、！？”’]/g, ' ');
  s = s.replace(/・/g, '');
  // ローマ数字 ←→ アラビア数字（境界安全）
  s = romanToArabicSafe(s);
  s = arabicToRomanSafe(s);

  // CJK 間のスペースは削除（英単語間は保持）
  // Hiragana/Katakana/Han/compat & 長音記号の間の空白を除去
  s = s.replace(/(?<=[\u3040-\u30FF\u3400-\u9FFF\uF900-\uFAFF\uFF66-\uFF9Dー])\s+(?=[\u3040-\u30FF\u3400-\u9FFF\uF900-\uFAFF\uFF66-\uFF9Dー])/g, '');
  // 最終空白畳み
  return s.replace(/\s+/g, ' ').trim();
}

export default { normalize };

