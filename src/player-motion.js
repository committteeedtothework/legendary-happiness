import { weaponActionPose } from "./weapon-motion.js";
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// A visual rig only: the authoritative upright player collision body is unchanged.
export function animateArticulatedPlayer(
  model,
  p,
  dt,
  moving,
  action = 0,
  kind = "attack",
  visualAction = null,
) {
  if (dt <= 0) return;
  const u = model.userData,
    alpha = 1 - Math.exp(-12 * Math.min(dt, 0.1));
  u.motionTime = (u.motionTime || 0) + dt;
  const swimming = !!p.inWater && !p.flying && (!p.onGround || !!p.underwater);
  u.swim = mix(u.swim || 0, swimming ? 1 : 0, alpha);
  u.prone = mix(u.prone || 0, swimming && moving ? 1 : 0, alpha);
  u.crouch = mix(u.crouch || 0, p.crouching && !swimming ? 1 : 0, alpha);
  u.stride =
    (u.stride || 0) +
    (moving ? dt * (p.sprinting ? 13 : p.crouching ? 6 : 8.2) : 0);
  u.gait = mix(
    u.gait || 0,
    moving && !swimming ? (p.sprinting ? 0.63 : p.crouching ? 0.22 : 0.39) : 0,
    alpha,
  );
  u.swimPhase = (u.swimPhase || 0) + dt * (moving ? 4.1 : 2.1);
  const t = u.motionTime,
    phase = u.stride,
    swimPhase = u.swimPhase,
    s = u.swim,
    prone = u.prone;
  const breathing = Math.sin(t * 1.9) * 0.007;
  u.legs.forEach((leg, i) => {
    const sign = i ? 1 : -1;
    const land = Math.sin(phase + i * Math.PI) * u.gait;
    const kick =
      Math.sin(swimPhase * 1.7 + i * Math.PI) *
      (prone * 0.35 + (s - prone) * 0.12);
    leg.rotation.x = mix(land, kick, s);
    leg.rotation.z = sign * (s * 0.055 + u.crouch * 0.035);
  });
  let weapon = null;
  if (visualAction)
    weapon = weaponActionPose(
      visualAction.kind,
      visualAction.age / visualAction.duration,
      u.heldKind,
      visualAction.direction || 1,
    );
  const active = weapon
    ? Math.max(
        ...["x", "y", "z", "rx", "ry", "rz"].map((k) => Math.abs(weapon[k])),
      )
    : Math.abs(action);
  u.arms.forEach((arm, i) => {
    const side = i ? 1 : -1,
      walk = -Math.sin(phase + i * Math.PI) * u.gait * 0.82;
    let rx = walk + (i === 1 && u.heldKind !== "item" ? 0.12 : 0),
      ry = 0,
      rz = side * (0.035 + breathing);
    let bend = i === 1 && u.heldKind !== "item" ? 0.18 : 0;
    if (!p.onGround && !p.flying && !swimming) {
      rx += clamp(-(p.vy || 0) * 0.018, -0.13, 0.15);
      rz += side * 0.12;
      bend += 0.12;
    }
    if (s > 0.001) {
      const stroke = swimPhase + (i ? 0 : Math.PI),
        reach = Math.sin(stroke);
      rx = mix(
        rx,
        prone * (2.3 + reach * 0.65) + (1 - prone) * (0.6 + reach * 0.25),
        s,
      );
      ry = mix(ry, side * (0.2 + Math.cos(stroke) * 0.26), s);
      rz = mix(rz, side * (0.33 + Math.cos(stroke) * 0.23), s);
      bend = mix(bend, 0.45 + Math.max(0, -reach) * 0.65, s);
    }
    if (i === 1 && active > 0) {
      const use = kind === "eat" || kind === "use";
      if (weapon) {
        rx = 0.18 - weapon.rx * 1.4 + Math.abs(weapon.z) * 2.5;
        ry = weapon.ry * 0.8;
        rz = -weapon.rz * 0.65;
        bend = 0.2 + Math.abs(weapon.rx) * 0.4;
      } else {
        rx = action * (use ? 1.9 : 1.55);
        ry = -action * (use ? 0.05 : 0.32);
        rz = action * (use ? -0.18 : 0.25);
        bend = 0.15 + action * 0.45;
      }
    }
    arm.rotation.set(rx, ry, rz);
    if (u.forearms?.[i]) u.forearms[i].rotation.x = -bend;
  });
  // Lean around hip height so a prone head stays near the water surface, with
  // smooth treading and recovery rather than a frozen walking cycle in water.
  const lean =
    -prone * (1.22 - clamp(p.pitch || 0, -0.7, 0.7) * 0.3) + u.crouch * 0.18;
  u.rig.rotation.x = lean;
  u.rig.position.y =
    0.8 * (1 - Math.cos(lean)) -
    u.crouch * 0.25 +
    breathing +
    s * Math.sin(swimPhase * 2) * 0.018;
  u.rig.position.z = -0.8 * Math.sin(lean);
  u.rig.rotation.z = Math.sin(phase) * u.gait * 0.025;
  u.body.rotation.y = weapon
    ? weapon.ry * 0.16
    : Math.sin(phase) * u.gait * 0.025;
  u.body.rotation.z = weapon ? -weapon.rz * 0.05 : 0;
  u.head.rotation.x = clamp((p.pitch || 0) - lean * 0.55, -1.1, 1.1);
  const wrist =
    u.heldKind === "block" ? -0.1 : u.heldKind === "spear" ? -1.0 : -0.62;
  u.grip.rotation.x =
    wrist -
    u.arms[1].rotation.x * 0.48 +
    (u.forearms?.[1]?.rotation.x || 0) * -0.35;
  u.grip.rotation.z = weapon ? weapon.rz * 0.16 : 0;
  u.coat?.forEach((tail, i) => {
    const target =
      -(moving ? 0.12 : 0) -
      Math.abs(Math.sin(phase + i * 0.5)) * u.gait * 0.2 -
      s * 0.25;
    tail.rotation.x = mix(tail.rotation.x, target, alpha);
    tail.rotation.z = (i ? 1 : -1) * (0.035 + u.gait * 0.08 + s * 0.1);
  });
}

export function inheritPlayerMotion(previous, next) {
  const from = previous?.userData,
    to = next?.userData;
  if (!from || !to || from.heldKind === "pistols" || to.heldKind === "pistols")
    return;
  for (const key of [
    "motionTime",
    "swimPhase",
    "swim",
    "prone",
    "crouch",
    "stride",
    "gait",
  ])
    if (Number.isFinite(from[key])) to[key] = from[key];
}
