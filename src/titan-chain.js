import { TITAN_ACTIONS } from "./titan-combat.js";
const melee = ["punch", "combo", "heavy", "finisher"];
export const TITAN_CHAIN = Object.freeze({ buffer: 0.32, recovery: 0.085 });
export function titanChainReady(s) {
  const a = s.strike;
  if (!a) return true;
  if(a.homing)return a.connected&&a.homing.phase==='recovery'&&a.homing.recoveryAge>0.085;
  const m = TITAN_ACTIONS[a.move];
  return (
    !["loop", "counter"].includes(a.move) &&
    a.next >= m.contacts.length &&
    (a.connected || ["boom", "cross", "shot"].includes(a.move)) &&
    a.elapsed >= m.contacts.at(-1) + TITAN_CHAIN.recovery
  );
}
// One intent, not a list of future attacks. Cooldowns are set at launch.
export function bufferTitanMove(s, action, held = false) {
  const a = s.strike,
    m = TITAN_ACTIONS[a?.move];
  if (!a || !m || s.qte || s.counterScene || s.knockback || s.action === "hurt")
    return false;
  const next = TITAN_ACTIONS[action === "hit" ? "punch" : action];
  if (!next || action === "counter" || action === "dodge") return false;
  if(a.homing?.parry&&action==='hit'){
    s.queuedMove={action,serial:a.serial,until:s.time+Math.max(0.4,a.duration-a.elapsed+0.15)};
    return true;
  }
  const remaining = a.duration - a.elapsed;
  if (a.elapsed < Math.max(0.06, m.contacts.at(-1) - 0.12) || remaining > 0.43)
    return false;
  const cooldown = s.cooldowns[action] || 0;
  if (cooldown > Math.max(remaining, TITAN_CHAIN.buffer) + 0.01) return false;
  if (held && s.queuedMove && s.queuedMove.action !== "hit") return false;
  s.queuedMove = {
    action,
    serial: a.serial,
    until: s.time + Math.max(TITAN_CHAIN.buffer, remaining + 0.05),
  };
  return true;
}
export function takeTitanMove(s) {
  const q = s.queuedMove;
  if (!q) return null;
  if (
    s.stage !== "combat" ||
    s.qte ||
    s.counterScene ||
    s.action === "hurt" ||
    s.dodge > 0 ||
    s.time > q.until ||
    (s.strike && s.strike.serial !== q.serial)
  ) {
    s.queuedMove = null;
    return null;
  }
  if (!titanChainReady(s)) return null;
  if (s.strike && melee.includes(s.strike.move) && q.action === "hit")
    s.cooldowns.hit = 0;
  if (s.strike) s.strike = null;
  s.action = "idle";
  s.actionTime = 0;
  s.queuedMove = null;
  return q.action;
}
