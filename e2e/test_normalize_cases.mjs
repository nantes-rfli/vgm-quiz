// e2e/test_normalize_cases.mjs
import assert from 'node:assert/strict';
import { normalize as n } from '../public/app/normalize.mjs';

const same = (a, b, msg) => assert.equal(n(a), n(b), msg || `${a} == ${b}`);

(async () => {
  // 冠詞無視
  same('The Legend of Zelda', 'legend of zelda', 'strip leading article');

  // & → and
  same('Castlevania & Dracula X', 'castlevania and dracula x', '& -> and');

  // ダッシュ類
  same('chrono–trigger', 'chrono trigger', 'en-dash');
  same('chrono—trigger', 'chrono trigger', 'em-dash');
  same('final-fantasy vi', 'final fantasy vi', 'hyphen to space');

  // ローマ数字 相互変換（境界安全）
  same('Final Fantasy VI', 'Final Fantasy 6', 'roman VI');
  same('DRAGON QUEST XI', 'dragon quest 11', 'roman XI');
  same('Mega Man X', 'Mega Man 10', 'roman X=10 (title case)');

  // 句読点・空白
  same('Chrono  Trigger!!  ', 'chrono trigger', 'punct & spaces');

  console.log('[OK] normalize v1.2 assertions passed');
})();

