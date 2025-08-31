'use strict';
// Lightweight normalizer (v1.2相当の縮約版) for Node-side scripts
// ローマ数字は「単独トークン」のみ数値化（単語中の v/i/x は置換しない）
const ROMAN_MAP_ENTRIES = [
  ["xx",20],["xix",19],["xviii",18],["xvii",17],["xvi",16],["xv",15],["xiv",14],["xiii",13],["xii",12],["xi",11],
  ["x",10],["ix",9],["viii",8],["vii",7],["vi",6],["v",5],["iv",4],["iii",3],["ii",2],["i",1]
];
const ROMAN_MAP = new Map(ROMAN_MAP_ENTRIES);
const ROMAN_TOKEN_RE = new RegExp(
  "\\b(?:" + ROMAN_MAP_ENTRIES.map(([r]) => r).join("|") + ")\\b",
  "g"
);
function toNFKC(s){ return s.normalize ? s.normalize('NFKC') : s; }
function stripDiacritics(s){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function romanToArabicTokensOnly(s){
  return s.replace(ROMAN_TOKEN_RE, (m) => String(ROMAN_MAP.get(m)));
}
function normalizeAnswer(s){
  if(!s) return '';
  let t = toNFKC(String(s)).toLowerCase();
  t = stripDiacritics(t);
  t = t.replace(/&/g,' and ');
  t = romanToArabicTokensOnly(t);
  t = t.replace(/[\p{P}\p{S}\s\u30FC\-]/gu,''); // punctuation/symbols/spaces/長音/ハイフン
  return t;
}
module.exports = { normalizeAnswer };
