// Daily mode module extracted by v1.12 UI-slim Phase 2 (step 1)

import { normalize as normalizeV2 } from './normalize.mjs';
import { getQueryParam } from './utils-ui.mjs';

// ---------------------
// Daily 1-question mode
// ---------------------
const DAILY = {
  active: false,
  dateStr: null,        // 'YYYY-MM-DD'
  wanted: null,         // { id?: string, title?: string }
  mapLoaded: false,
};

function todayJST() {
  // 'YYYY-MM-DD' を JST で作る
  const fmt = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const [{ value: y }, , { value: m }, , { value: d }] = fmt.formatToParts(new Date());
  return `${y}-${m}-${d}`;
}

function detectDailyParam() {
  const v = getQueryParam('daily');
  if (!v) return null;
  if (v === '1' || v === 'true') return todayJST();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
}

function initDaily() {
  const date = detectDailyParam();
  if (!date) return;
  DAILY.active = true;
  DAILY.dateStr = date;
}

function pickDailyWantedFromMap() {
  if (!DAILY.active) return;
  const entry = DAILY.map?.[DAILY.dateStr];
  if (!entry) return;
  if (typeof entry === 'string') {
    DAILY.wanted = { id: entry }; // 旧式：そのままID扱い
  } else if (entry && typeof entry === 'object') {
    DAILY.wanted = { id: entry.id, title: entry.title };
  }
}

// タイトル/IDの正規化一致
function normKey(s) { return normalizeV2(String(s || '')); }

// 質問配列を 1 問に絞る（可能なら該当トラックを優先）
function applyDailyRestriction(qs) {
  if (!DAILY.active || !Array.isArray(qs) || qs.length === 0) return qs;
  // 優先順位: ID → タイトル（正規化一致）
  let idx = -1;
  if (DAILY.wanted?.id) {
    const target = normKey(DAILY.wanted.id);
    idx = qs.findIndex(q => normKey(q?.track?.id) === target);
  }
  if (idx < 0 && DAILY.wanted?.title) {
    const target = normKey(DAILY.wanted.title);
    idx = qs.findIndex(q => normKey(q?.track?.title) === target);
  }
  if (idx < 0) idx = 0; // フォールバック
  return [qs[idx]];
}

export { DAILY, detectDailyParam, initDaily, pickDailyWantedFromMap, applyDailyRestriction };

