import { weaponActionPose } from "./weapon-motion.js";
import {
  customItemMotion,
  javaSwingPose,
  javaEatPose,
} from "./java-item-motion.js";
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (x) => x * x * (3 - 2 * x);
const customDuration = (kind, tool) =>
  kind === "fire"
    ? 0.18
    : kind === "eat"
      ? 0.65
      : kind === "attack"
        ? tool === "axe"
          ? 0.5
          : 0.36
        : 0.28;

export const actionDuration = (kind, tool, id) =>
  customItemMotion(id, tool)
    ? customDuration(kind, tool)
    : kind === "eat"
      ? 1.6
      : 0.3;

// Visual actions never schedule damage, item consumption or simulation ticks.
export function actionPose(kind, progress, tool, direction = 1, id) {
  if (!customItemMotion(id, tool)) {
    if (kind === "use" && ["bow", "crossbow", "shield"].includes(id || tool))
      return { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, trail: 0 };
    return kind === "eat" ? javaEatPose(progress) : javaSwingPose(progress);
  }
  const weapon = weaponActionPose(kind, progress, tool, direction);
  if (weapon) return weapon;
  const p = clamp(progress),
    envelope = Math.sin(p * Math.PI);
  const pose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, trail: 0 };
  if (kind === "fire" && tool === "pistols") {
    // Recoil belongs to the firing hand. Never jab both wrists toward a shot.
    return pose;
  } else if (kind === "attack") {
    if (tool === "spear") {
      pose.z = -envelope * 0.35;
      pose.x = -envelope * 0.12;
      pose.rx = -envelope * 0.38;
      pose.y = envelope * 0.03;
    } else if (tool === "sword") {
      const cut = smooth(clamp((p - 0.18) / 0.35));
      pose.x = envelope * (0.07 - cut * 0.29) * direction;
      pose.y = envelope * (0.12 - cut * 0.12);
      pose.z = -envelope * 0.17;
      pose.rx = -envelope * 0.6;
      pose.ry = envelope * (0.3 - cut * 0.8) * direction;
      pose.rz = envelope * (0.5 - cut * 1.8) * direction;
      pose.trail =
        p > 0.2 && p < 0.65 ? Math.sin(((p - 0.2) / 0.45) * Math.PI) : 0;
    } else {
      const strike = smooth(clamp((p - 0.22) / 0.3));
      pose.y = envelope * (tool ? 0.16 - strike * 0.11 : 0.025);
      pose.x = -envelope * 0.1;
      pose.z = -envelope * (tool ? 0.16 : 0.24);
      pose.rx = envelope * (tool ? 0.6 - strike * 1.6 : -0.35);
      pose.rz = envelope * (tool ? 0.2 : -0.2);
    }
  } else if (kind === "mine") {
    const strike = smooth(clamp((p - 0.18) / 0.38));
    if (tool === "shovel" || tool === "hoe") {
      pose.z = -envelope * 0.2;
      pose.y = -envelope * 0.07;
      pose.rx = -envelope * 0.65;
      pose.ry = -envelope * 0.18;
    } else {
      pose.rx = envelope * (0.65 - strike * 1.25);
      pose.rz = envelope * (0.25 - strike * 0.6);
      pose.x = -envelope * 0.09;
      pose.y = envelope * 0.06;
      pose.z = -envelope * 0.12;
    }
  } else if (kind === "place") {
    pose.z = -envelope * 0.22;
    pose.y = envelope * 0.055;
    pose.rx = -envelope * 0.35;
    pose.ry = -envelope * 0.2;
  } else if (kind === "use") {
    pose.x = -envelope * 0.11;
    pose.y = envelope * 0.08;
    pose.rx = -envelope * 0.28;
    pose.ry = envelope * 0.22;
    pose.rz = envelope * 0.12;
  } else if (kind === "eat") {
    pose.x = -envelope * 0.25;
    pose.y = envelope * 0.23 + Math.sin(p * Math.PI * 10) * envelope * 0.012;
    pose.z = envelope * 0.13;
    pose.rx = -envelope * 0.55;
    pose.rz = envelope * 0.55;
  } else {
    pose.z = -envelope * 0.12;
    pose.y = envelope * 0.025;
    pose.rx = -envelope * 0.3;
    pose.rz = -envelope * 0.12;
  }
  return pose;
}

export class FirstPersonAnimator {
  constructor() {
    this.phase = 0;
    this.equip = 0;
    this.recoil = 0;
    this.landing = 0;
    this.sway = { x: 0, y: 0 };
    this.crouch = 0;
    this.sprint = 0;
    this.action = null;
  }
  trigger(kind, tool, itemId) {
    if (kind === "hurt") {
      this.recoil = 1;
      return;
    }
    if (kind === "equip") {
      this.equip = 1;
      return;
    }
    if (
      kind === "attack" &&
      this.action?.kind === kind &&
      this.action.age < (customItemMotion(itemId, tool) ? 0.09 : 0.15)
    )
      return;
    if (kind === "attack" && customItemMotion(itemId, tool))
      this.combo = -(this.combo || -1);
    this.action = {
      kind,
      tool,
      itemId,
      direction: customItemMotion(itemId, tool) ? this.combo || 1 : 1,
      age: 0,
      duration: actionDuration(kind, tool, itemId),
    };
  }
  reset() {
    this.action = null;
    this.recoil = 0;
    this.landing = 0;
  }
  step(
    dt,
    player,
    { moving = false, mining = false, bobbing = true, tool, itemId } = {},
  ) {
    dt = clamp(dt, 0, 0.1);
    const ease = 1 - Math.exp(-14 * dt);
    if (this.grounded === false && player.onGround)
      this.landing = clamp(Math.abs(this.lastVy || 0) / 15);
    this.grounded = player.onGround;
    this.lastVy = player.vy;
    this.phase +=
      dt * (moving ? (player.sprinting ? 13 : player.crouching ? 6 : 9) : 1.6);
    this.crouch += ((player.crouching ? 1 : 0) - this.crouch) * ease;
    const yawDelta =
      this.yaw === undefined
        ? 0
        : Math.atan2(
            Math.sin(player.yaw - this.yaw),
            Math.cos(player.yaw - this.yaw),
          );
    const pitchDelta = this.pitch === undefined ? 0 : player.pitch - this.pitch;
    this.yaw = player.yaw;
    this.pitch = player.pitch;
    this.sway.x += (clamp(yawDelta * 1.8, -0.045, 0.045) - this.sway.x) * ease;
    this.sway.y +=
      (clamp(-pitchDelta * 1.8, -0.035, 0.035) - this.sway.y) * ease;
    this.equip = Math.max(
      0,
      this.equip - dt / (customItemMotion(itemId, tool) ? 0.24 : 0.15),
    );
    this.recoil = Math.max(0, this.recoil - dt / 0.35);
    this.landing *= Math.exp(-12 * dt);
    let pose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, trail: 0 };
    if (this.action) {
      this.action.age += dt;
      pose = actionPose(
        this.action.kind,
        this.action.age / this.action.duration,
        this.action.tool ?? tool,
        this.action.direction,
        this.action.itemId ?? itemId,
      );
      if (this.action.age >= this.action.duration) this.action = null;
    } else if (mining) {
      this.miningPhase =
        (this.miningPhase || 0) + dt / actionDuration("mine", tool, itemId);
      pose = actionPose("mine", this.miningPhase % 1, tool, 1, itemId);
    }
    if (!customItemMotion(itemId, tool)) {
      // Ordinary carried objects do not acquire sprint rolls, idle flutter or
      // extra swimming strokes. Walking bob and camera lag are shared.
      const stride = bobbing && moving && player.onGround ? 0.025 : 0;
      pose.x += Math.sin(this.phase) * stride;
      pose.y += Math.abs(Math.cos(this.phase)) * stride - this.equip * 0.6;
      pose.rx += this.sway.y * 0.35;
      pose.ry += this.sway.x * 0.35;
      const swimming =
        !itemId &&
        player.inWater &&
        !player.flying &&
        (!player.onGround || !!player.underwater);
      this.swim =
        (this.swim || 0) + ((swimming ? 1 : 0) - (this.swim || 0)) * ease;
      this.swimPhase = (this.swimPhase || 0) + dt * (moving ? 4.1 : 2.1);
      if (bobbing && !itemId) {
        pose.x += Math.sin(this.swimPhase) * this.swim * 0.035;
        pose.y += Math.cos(this.swimPhase * 2) * this.swim * 0.024;
        pose.rx += Math.sin(this.swimPhase) * this.swim * 0.12;
      }
      this.sprint = 0;
      return pose;
    }
    const stride =
      bobbing && moving && player.onGround
        ? player.sprinting
          ? 0.026
          : 0.015
        : 0;
    pose.x += this.sway.x + Math.sin(this.phase) * stride;
    pose.y +=
      this.sway.y +
      Math.cos(this.phase * 2) * stride * 0.65 -
      this.equip ** 2 * 0.4 -
      this.crouch * 0.035 -
      this.landing * 0.07;
    this.sprint +=
      ((player.sprinting && moving && !mining && !this.action ? 1 : 0) -
        (this.sprint || 0)) *
      ease;
    if (!Number.isFinite(this.sprint)) this.sprint = 0;
    pose.x -= this.sprint * 0.035;
    pose.y -= this.sprint * 0.045;
    pose.rz += this.sprint * 0.22;
    pose.z += this.recoil * 0.08;
    pose.rx += this.recoil * 0.22 + clamp(player.vy || 0, -15, 9) * 0.003;
    pose.rz +=
      (bobbing ? Math.sin(this.phase * 0.5) * 0.008 : 0) + this.recoil * 0.16;
    if (tool !== "pistols") {
      const swimming =
        player.inWater &&
        !player.flying &&
        (!player.onGround || !!player.underwater);
      this.swim =
        (this.swim || 0) + ((swimming ? 1 : 0) - (this.swim || 0)) * ease;
      this.swimPhase = (this.swimPhase || 0) + dt * (moving ? 4.1 : 2.1);
      if (bobbing) {
        pose.x += Math.sin(this.swimPhase) * this.swim * 0.035;
        pose.y += Math.cos(this.swimPhase * 2) * this.swim * 0.024;
        pose.z += Math.sin(this.swimPhase) * this.swim * 0.04;
        pose.rx += Math.sin(this.swimPhase) * this.swim * 0.12;
        pose.rz += Math.cos(this.swimPhase) * this.swim * 0.06;
      }
    } else if (bobbing && moving && player.inWater) {
      pose.y += Math.sin(this.phase) * 0.035;
      pose.rx += Math.sin(this.phase) * 0.15;
    }
    return pose;
  }
}
