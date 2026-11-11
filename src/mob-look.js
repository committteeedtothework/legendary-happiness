const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const NECK_YAW_LIMIT = Math.PI / 3,
  NECK_PITCH_LIMIT = 0.32;
export function shortestAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
export function boundedLook(
  currentYaw,
  currentPitch,
  targetYaw,
  targetPitch,
  dt,
) {
  const alpha = 1 - Math.exp(-12 * Math.max(0, Math.min(0.1, dt)));
  return {
    yaw:
      clamp(shortestAngle(currentYaw), -NECK_YAW_LIMIT, NECK_YAW_LIMIT) +
      (clamp(shortestAngle(targetYaw), -NECK_YAW_LIMIT, NECK_YAW_LIMIT) -
        clamp(shortestAngle(currentYaw), -NECK_YAW_LIMIT, NECK_YAW_LIMIT)) *
        alpha,
    pitch:
      clamp(currentPitch, -NECK_PITCH_LIMIT, NECK_PITCH_LIMIT) +
      (clamp(targetPitch, -NECK_PITCH_LIMIT, NECK_PITCH_LIMIT) -
        clamp(currentPitch, -NECK_PITCH_LIMIT, NECK_PITCH_LIMIT)) *
        alpha,
  };
}
