import { spinAngle } from "./titan-advanced.js";
import { titanCyloopLift } from "./titan-cyloop.js";
// Arena metres. The world and player never inherit the Titan's transform.
export const TITAN_ORIGIN = Object.freeze({ x: 0, z: 0, yaw: 0 });
export function titanPose(s) {
  const b = s?.boss || TITAN_ORIGIN;
  const lift = titanCyloopLift(s);
  return s?.attack === "spin" || lift
    ? { ...b, lift, yaw: (b.yaw || 0) + (s?.attack === "spin" ? spinAngle(s) : 0) } : b;
}
export function titanBodyHeight(pose) {
  const t = pose?.walk
    ? Math.max(0, Math.min(1, (pose.walk.elapsed - 0.45) / 2.4))
    : 0;
  return (pose?.lift || 0) -1.5 * Math.sin(t * Math.PI);
}
export function titanWorldPoint(s, p, pose = titanPose(s)) {
  const c = Math.cos(pose.yaw || 0),
    n = Math.sin(pose.yaw || 0);
  return {
    x: (pose.x || 0) + p.x * c + p.z * n,
    y: p.y + titanBodyHeight(pose),
    z: (pose.z || 0) + p.z * c - p.x * n,
  };
}
export function titanLocalPoint(s, p, pose = titanPose(s)) {
  const c = Math.cos(pose.yaw || 0),
    n = Math.sin(pose.yaw || 0),
    x = p.x - (pose.x || 0),
    z = p.z - (pose.z || 0);
  return { x: x * c - z * n, y: p.y - titanBodyHeight(pose), z: z * c + x * n };
}
export function titanWorldVector(s, p, pose = titanPose(s)) {
  return titanWorldPoint(s, p, { x: 0, z: 0, yaw: pose.yaw });
}
export const titanTurn = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
