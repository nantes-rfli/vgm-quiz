/**
 * Gate scoring utilities (v1.12)
 * Keep in sync with docs/OPERATIONS_GATE.md
 */
import { PROVIDER_TRUST } from '../config/providers.mjs';

export function clamp01(x){ return Math.max(0, Math.min(1, Number(x))); }

export function notabilityOf(o){
  // 初期ヒューリスティク: previewありなら0.75、なければ0.55（SPEC整備までは互換を維持）
  const lic = o?.meta?.provenance?.license_hint || 'unknown';
  return lic === 'preview' ? 0.75 : 0.55;
}

export function providerTrust(p){
  const v = String(p||'').toLowerCase();
  if (v in PROVIDER_TRUST) return PROVIDER_TRUST[v];
  return PROVIDER_TRUST.__default;
}

export function guardScore(o){
  // 初期値 1.0 からの減点（provenance欠落=0、license unknown×0.5、composer欠落×0.8、dedup θ減点）
  let g = 1.0;
  const prov = o?.meta?.provenance || {};
  const provKeys = ['source','provider','id','collected_at','hash','license_hint'];
  const provOk = provKeys.every(k => !!prov[k]);
  if (!provOk) return 0;

  if ((prov.license_hint||'unknown') === 'unknown') g *= 0.5;
  const comp = Array.isArray(o?.composer) ? o.composer : (Array.isArray(o?.track?.composer) ? o.track.composer : []);
  if (!comp.length) g *= 0.8;
  const theta = Number(o?.dedup?.theta || 0);
  if (theta >= 0.95) return 0;
  if (theta >= 0.85) g *= 0.5;
  return clamp01(g);
}

export function computeGateScore(o){
  const notab = notabilityOf(o);
  const ptrust = providerTrust(o?.meta?.provenance?.provider);
  const g = guardScore(o);
  const s = 0.5*notab + 0.3*ptrust + 0.2*g;
  return clamp01(s);
}
