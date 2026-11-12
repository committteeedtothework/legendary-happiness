import {titanTargetContact} from "./titan-targeting.js";
import { sonicLength } from "./titan-metrics.js";
import { nearestTitanSurface, point } from "./titan-contact.js";
// A live shoulder shot, never a stored actor position or a movement lock.
export function titanMoveShot(s) {
  if (
    s.stage !== "combat" ||
    !s.strike ||
    s.qte ||
    s.counterScene ||
    s.config.moveCamera === false
  )
    return null;
  const p = s.avatar,
    move = s.strike.move;
  const back = sonicLength(
    s,
    {
      loop: 20,
      rush: 17,
      homing: 16,
      cyclone: 17,
      stomp: 17,
      shot: 16,
      cross: 15,
      boom: 15,
      counter: 16,
    }[move] || 13,
  );
  let yaw = p.yaw;
  if (move === "loop" && s.strike.orbit) {
    const c = s.strike.orbit.center;
    yaw = Math.atan2(p.x - c.x, p.z - c.z);
  }
  const focus = point(p.x, p.y + sonicLength(s, 1.9), p.z);
  // Keep a little of the target in the shot while Sonic stays the focal subject.
  if (s.lock) {
    const hit = titanTargetContact(s, focus).point;
    const dx = hit.x - focus.x,
      dy = hit.y - focus.y,
      dz = hit.z - focus.z;
    const d = Math.hypot(dx, dy, dz) || 1,
      w = Math.min(sonicLength(s, 0.65), d * 0.04) / d;
    focus.x += dx * w;
    focus.y += dy * w;
    focus.z += dz * w;
  }
  const duration=Math.max(0.1,s.strike.duration || 1),u=Math.max(0,Math.min(1,(s.strike.elapsed || 0)/duration));
  const arc=Math.sin(u*Math.PI)*0.12;
  yaw+=move==='cross'?-arc:move==='rush'||move==='cyclone'?arc:0;
  const shoulder = sonicLength(s, (move === "cross" ? -2 : 2.2)*(1-Math.sin(u*Math.PI)*0.2));
  const cp = Math.cos(p.pitch);
  return {
    position: point(
      p.x + Math.sin(yaw) * back * cp + Math.cos(yaw) * shoulder,
      p.y +
        sonicLength(s, move === "stomp" ? 5 : 3.8) +
        Math.sin(p.pitch) * back,
      p.z + Math.cos(yaw) * back * cp - Math.sin(yaw) * shoulder,
    ),
    target: focus,
    fov: Math.max(
      45,
      Math.min(
        100,
        (s.config.cameraFov || 67) +
          (move === "loop" || move === "rush" ? 4 : -2),
      ),
    ),
  };
}
// Transport the camera boom with the actor before easing rotation/composition.
// Large teleports and stage/retry changes reset history instead of dragging it.
export function titanCameraTransport(history, s) {
  const previous = history.avatar;
  const active = ["traversal","combat","victory"].includes(s.stage) && !s.qte && !s.counterScene;
  const key = `${s.stage}:${s.attempt || 0}`;
  history.avatar = { x: s.avatar.x, y: s.avatar.y, z: s.avatar.z };
  const same = history.key === key && history.active && active;
  history.key = key;
  history.active = active;
  if (!same || !previous) return point(0, 0, 0);
  const delta = point(
    s.avatar.x - previous.x,
    s.avatar.y - previous.y,
    s.avatar.z - previous.z,
  );
  return Math.hypot(delta.x, delta.y, delta.z) <= 35 ? delta : point(0, 0, 0);
}
