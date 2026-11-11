import { TITAN_POWER_SCALE } from "./titan-balance.js";
import { titanLocalPoint } from "./titan-space.js";
export function freshTitanTactics() {
  return {
    pressure: 0,
    chain: 0,
    lastHit: -100,
    guard: 0,
    guardCooldown: 0,
    retaliation: 0,
    camp: 0,
    lastPosition: null,
  };
}
export function updateTitanTactics(s, dt, emit) {
  const a = (s.tactics ||= freshTitanTactics());
  if (s.stage !== "combat" || s.config.adaptiveBoss === false) return;
  a.pressure *= Math.exp(-dt * 0.45);
  a.guardCooldown = Math.max(0, a.guardCooldown - dt);
  a.retaliation = Math.max(0, a.retaliation - dt);
  a.guard = Math.max(0, a.guard - dt);
  const p = s.avatar,
    prev = a.lastPosition;
  a.camp =
    prev && Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z) < dt * 3
      ? Math.min(8, a.camp + dt)
      : Math.max(0, a.camp - dt * 2);
  a.lastPosition = { x: p.x, y: p.y, z: p.z };
  if (
    a.chain >= 6 &&
    a.pressure > 0.42 &&
    !a.guardCooldown &&
    !a.guard &&
    s.attack === "idle" &&
    !s.stagger &&
    !s.qte &&
    !s.counterScene
  ) {
    a.guard = 1.25;
    a.guardCooldown = 10;
    a.retaliation = 3.2;
    a.chain = 0;
    s.idle = Math.min(s.idle, 0.25);
    emit(s, "boss-guard", { duration: a.guard });
  }
}
export function titanGuarding(s, contact, kind) {
  if (
    !s.tactics?.guard ||
    s.tactics.guard > 1.05 ||
    s.tactics.guard < 0.18 ||
    s.config.adaptiveBoss === false ||
    ["counter", "perfectCounter", "struggle"].includes(kind)
  )
    return false;
  const p = titanLocalPoint(s, contact.point);
  return p.z > -8 && Math.abs(p.x) < 28;
}
export function recordTitanPressure(s, amount) {
  const a = (s.tactics ||= freshTitanTactics());
  a.chain = s.time - a.lastHit < 2 ? a.chain + 1 : 1;
  a.lastHit = s.time;
  a.pressure = Math.min(
    2,
    a.pressure + Math.min(0.22, amount / (700 * TITAN_POWER_SCALE) + 0.06),
  );
}
export function titanRecovery(s, recover) {
  if (s.config.adaptiveBoss === false) return recover;
  const a = Math.max(0.7, Math.min(1.5, s.config.aggression || 1));
  return Math.max(
    1.05,
    (recover *
      (s.phase === 2 ? 0.67 : 0.86) *
      (s.config.difficulty === "easy" ? 1.18 : 1)) /
      a,
  );
}
export function chooseTitanTactic(s, choices) {
  const local = titanLocalPoint(s, s.avatar),
    distance = Math.hypot(local.x, local.z),
    a = s.tactics;
  const weighted = [];
  for (const move of choices) {
    let w = 2;
    if (move === "pulse" && (distance > 55 || (a?.camp || 0) > 2)) w += 5;
    if (move === "crunch" && (a?.retaliation || 0) > 0) w += 6;
    if (move === "swat" && (a?.pressure || 0) > 0.35) w += 4;
    if (move === "beam" && distance > 65) w += 5;
    if (move === "stomp" && s.avatar.y < 8) w += 3;
    if (move === "sweep" && s.phase === 2) w += 2;
    for (let i = 0; i < w; i++) weighted.push(move);
  }
  const seed = Math.imul(s.sequence + 1, 2654435761) >>> 0;
  return weighted[seed % weighted.length];
}
export function titanPulse(s, time = s.attackTime) {
  const tell =
    1.55 * ({ easy: 1.25, normal: 1, hard: 0.85 }[s.config.difficulty] || 1);
  const elapsed = time - tell;
  return {
    active: s.attack === "pulse" && elapsed >= 0 && elapsed <= 1.2,
    center: {
      x: s.boss?.x || 0,
      y: s.attackAim?.y ?? s.avatar.y,
      z: s.boss?.z || 0,
    },
    radius: Math.max(0, elapsed) * 100,
    tell,
  };
}
