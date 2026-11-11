// Hit count, Phantom Rush and Quick Cyloop have independent state. Numerical
// thresholds are DCSMCRAFT tuning, not claimed production-game constants.
export const TITAN_COMBO = Object.freeze({ gap: 4, phantomHits: 20, phantomDuration: 8, cyloopHits: 12, liftDuration: 4 });
export function registerTitanHit(s, emit) {
  s.combo = Math.min(9999, (s.combo || 0) + 1);
  s.comboTime = TITAN_COMBO.gap;
  const charge=Math.min(2,(s.cyloopCharge ?? 1)+1/TITAN_COMBO.cyloopHits);
  s.cyloopCharge=Math.abs(charge-Math.round(charge))<1e-8 ? Math.round(charge) : charge;
  if (s.phantom <= 0) {
    s.phantomCharge = Math.min(1, (s.phantomCharge || 0) + 1 / TITAN_COMBO.phantomHits);
    if (s.phantomCharge >= 1 - 1e-8) {
      s.phantom = TITAN_COMBO.phantomDuration;
      s.phantomCharge = 1;
      emit(s, "phantom");
    }
  }
}
export function tickTitanCombo(s, dt) {
  if (s.stage !== "combat" || s.qte || s.counterScene) return;
  if (!s.strike) s.comboTime = Math.max(0, s.comboTime - dt);
  if (s.phantom > 0) {
    s.phantom = Math.max(0, s.phantom - dt);
    if (!s.phantom) s.phantomCharge = 0;
  }
  if (!s.comboTime) {
    s.combo = s.comboStep = 0;
    if (!s.phantom) s.phantomCharge = Math.max(0, (s.phantomCharge || 0) - dt * 0.25);
  }
  s.cyloopHold = Math.max(0, (s.cyloopHold || 0) - dt);
}
export function breakTitanCombo(s) {
  s.combo = s.comboTime = s.comboStep = s.phantom = s.phantomCharge = 0;
}
export function restoreTitanCombo(s, raw) {
  const bounded = (v, lo, hi, fallback = 0) => Number.isFinite(v) ? Math.max(lo, Math.min(hi,v)) : fallback;
  s.combo = Math.floor(bounded(raw.combo,0,9999));
  s.comboStep = Math.floor(bounded(raw.comboStep,0,3));
  s.comboTime = bounded(raw.comboTime,0,TITAN_COMBO.gap);
  s.phantom = bounded(raw.phantom,0,TITAN_COMBO.phantomDuration);
  s.phantomCharge = bounded(raw.phantomCharge,0,1);
  s.cyloopCharge = bounded(raw.cyloopCharge,0,2,1);
  s.cyloopHold = bounded(raw.cyloopHold,0,TITAN_COMBO.liftDuration);
  if (s.stage === "combat" && s.cyloopHold>0) {
    s.stagger = Math.max(s.stagger,s.cyloopHold);
    s.idle = Math.max(s.idle,s.cyloopHold+0.4);
  }
}
