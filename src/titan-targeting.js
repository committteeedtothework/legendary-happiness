import {
  titanBodyRegions,
  regionContact,
  nearestTitanSurface,
} from "./titan-contact.js";
import { sonicContact, sonicLength } from "./titan-metrics.js";
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export function titanTargetContact(s, from = sonicContact(s)) {
  const region =
    s.lock &&
    s.targetLock?.id &&
    titanBodyRegions(s).find((r) => r.id === s.targetLock.id);
  return region ? regionContact(region, from) : nearestTitanSurface(s, from);
}
export function acquireTitanTarget(s) {
  const from = sonicContact(s),
    yaw = s.avatar.yaw,
    pitch = s.avatar.pitch || 0,
    max = sonicLength(s, 1100);
  let best = null,
    score = Infinity;
  for (const r of titanBodyRegions(s)) {
    const c = regionContact(r, from);
    if (c.distance > max) continue;
    const dx = c.point.x - from.x,
      dy = c.point.y - from.y,
      dz = c.point.z - from.z;
    const angle = Math.abs(wrap(Math.atan2(-dx, -dz) - yaw));
    const elevation = Math.abs(Math.atan2(dy, Math.hypot(dx, dz)) + pitch);
    const value =
      angle * 24 +
      elevation * 12 +
      Math.sqrt(c.distance / sonicLength(s, 1)) * 1.5;
    if (value < score) {
      best = c;
      score = value;
    }
  }
  // Reachable nearby contact wins over a distant, camera-aligned limb. This
  // keeps a basic jab from steering away from the surface already in reach.
  const near=nearestTitanSurface(s,from);
  if(near.distance<=sonicLength(s,18)&&(!best||best.distance>near.distance*1.4+sonicLength(s,2)))best=near;
  s.targetLock = {
    id: best?.id ?? null,
    lastYaw: yaw,
    lastPitch: pitch,
    manualGrace: 0.8,
  };
  return best;
}
export function toggleTitanTarget(s) {
  s.lock = !s.lock;
  if (s.lock) acquireTitanTarget(s);
  else s.targetLock = null;
  return s.lock;
}
export function tickTitanTarget(s, dt) {
  if (s.stage !== "combat" || !s.lock) {
    s.targetLock = null;
    return;
  }
  if (
    !s.targetLock?.id ||
    !titanBodyRegions(s).some((r) => r.id === s.targetLock.id)
  )
    acquireTitanTarget(s);
  const state = s.targetLock;
  if (!state?.id) {
    s.lock = false;
    return;
  }
  const p = s.avatar,
    contact = titanTargetContact(s);
  if (contact.distance > sonicLength(s, 1250)) {
    s.lock = false;
    s.targetLock = null;
    return;
  }
  if (
    Math.abs(wrap(p.yaw - state.lastYaw)) > 0.0001 ||
    Math.abs((p.pitch || 0) - (state.lastPitch || 0)) > 0.0001
  )
    state.manualGrace = 1.1;
  state.manualGrace = Math.max(0, (state.manualGrace || 0) - dt);
  if (!state.manualGrace && !s.qte && !s.counterScene && !s.strike?.orbit) {
    const angle = Math.atan2(p.x - contact.point.x, p.z - contact.point.z),
      delta = wrap(angle - p.yaw);
    // A soft lock keeps the chosen body part in view without moving Sonic.
    p.yaw += Math.max(
      -dt * 1.8,
      Math.min(dt * 1.8, delta * (1 - Math.exp(-dt * 2.5))),
    );
  }
  if (!state.manualGrace && !s.qte && !s.counterScene && !s.strike?.orbit) {
    const desired = -Math.atan2(
      contact.point.y - (p.y + sonicLength(s, 1.8)),
      Math.hypot(contact.point.x - p.x, contact.point.z - p.z),
    );
    p.pitch = Math.max(
      -1.25,
      Math.min(
        1.25,
        (p.pitch || 0) + (desired - (p.pitch || 0)) * (1 - Math.exp(-dt * 2.5)),
      ),
    );
  }
  state.lastYaw = p.yaw;
  state.lastPitch = p.pitch || 0;
}
