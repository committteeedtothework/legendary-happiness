import { isWeapon } from "./weapon-art.js";
import { mountPixelWeapon } from "./weapon-poses.js";
import * as THREE from "three";
import { ITEMS } from "./data.js";
import { isFlatItem } from "./item-shapes.js";
import { cacheItemSilhouette, anchorHeldItem } from "./item-framing.js";
import { updateHandRig, cacheHandBounds } from "./first-person.js";

const clamp = (x) => Math.max(0, Math.min(1, x));
const radians = Math.PI / 180;
const swing = new THREE.Quaternion(),
  rotation = new THREE.Euler(),
  facing = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    Math.PI / 4,
  ),
  inverseFacing = facing.clone().invert();

// Explicit exceptions: ordinary swords/axes/picks/maces share the Java swing.
// Gameplay abilities, pistol recoil and the game's custom spears keep their rigs.
export function customItemMotion(id, tool = ITEMS[id]?.tool) {
  return (
    id === "devin_sword" ||
    id === "matthew_dual_pistols" ||
    tool === "pistols" ||
    tool === "spear"
  );
}
export function javaSwingPose(progress) {
  const p = clamp(progress);
  if (p === 0 || p === 1)
    return { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, trail: 0 };
  const arc = Math.sin(Math.sqrt(p) * Math.PI);
  // A single forward swing with an early arc and a smooth return. The fixed
  // hand-facing frame surrounds the Y/Z/X swing, independently of item art.
  rotation.set(
    -80 * arc * radians,
    -20 * Math.sin(p * p * Math.PI) * radians,
    -20 * arc * radians,
    "YZX",
  );
  swing.setFromEuler(rotation).premultiply(facing).multiply(inverseFacing);
  rotation.setFromQuaternion(swing, "XYZ");
  return {
    x: -0.4 * arc,
    y: 0.2 * Math.sin(2 * Math.PI * Math.sqrt(p)),
    z: -0.2 * Math.sin(p * Math.PI),
    rx: rotation.x,
    ry: rotation.y,
    rz: rotation.z,
    trail: 0,
  };
}
export function javaEatPose(progress) {
  const p = clamp(progress),
    envelope = Math.min(1, p / 0.12, (1 - p) / 0.12);
  return {
    x: -0.3 * envelope,
    y: (0.24 + Math.abs(Math.cos(p * Math.PI * 16)) * 0.018) * envelope,
    z: 0.08 * envelope,
    rx: -0.12 * envelope,
    ry: 0.5 * envelope,
    rz: 0.25 * envelope,
    trail: 0,
  };
}
export function javaUsePose(id, player, time, game) {
  const pose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, trail: 0 };
  if (id === "shield" && player.shieldRaised) {
    Object.assign(pose, {
      x: -0.22,
      y: 0.12,
      z: 0.06,
      rx: -0.1,
      ry: 0.35,
      rz: -0.12,
    });
  } else if (id === "trident" && game?.tridentCharge?.stack?.id === id) {
    const draw = clamp((game.tickCount - game.tridentCharge.start) / 10);
    Object.assign(pose, {
      x: 0.025 * draw,
      y: 0.09 * draw,
      z: 0.08 * draw,
      rx: -1.2 * draw,
      ry: -0.25 * draw,
      rz: 0.1 * draw,
    });
  } else if (player.editionDraw?.id === id) {
    const draw = clamp(
      (time - player.editionDraw.start) / (id === "crossbow" ? 1.25 : 1),
    );
    Object.assign(pose, {
      x: -0.25,
      y: 0.13,
      z: 0.08 + draw * 0.035,
      rx: -0.15,
      ry: -0.5,
      rz: id === "bow" ? -0.2 : -0.06,
    });
  }
  return pose;
}
// Keep the grip in the same lower-right screen region at different aspect
// ratios. The reference's blade may extend beyond the right edge naturally.
export function heldMountX(camera, z = -0.72) {
  return (0.62 * Math.abs(z)) / camera.projectionMatrix.elements[0];
}
export function heldRestRoll(id) {
  const tool = ITEMS[id]?.tool;
  return [
    "sword",
    "pickaxe",
    "axe",
    "shovel",
    "hoe",
    "mace",
    "trident",
  ].includes(tool)
    ? -35 * radians
    : tool === "spear"
      ? -0.2
      : 0;
}
// Fit the REST pose only. Applying the swing afterwards avoids changing its
// vertical arc/rotations to pin each moving corner to the viewport edge.
export function mountJavaItem(
  rig,
  id,
  pose,
  camera,
  player = {},
  time = 0,
  game,
) {
  if (isWeapon(id) && id !== "matthew_dual_pistols") {
    mountPixelWeapon(rig, id, pose, camera, player, time, game);
    const mesh = rig.grip.children.find((m) => m.userData.weaponModel === id);
    const key = `${id}:${!!player.shieldRaised}:${mesh?.userData.drawStage || 0}`;
    if (
      rig.weaponPoseKey !== key ||
      (id === "bow" && mesh?.userData.drawStage > 0)
    ) {
      cacheHandBounds(rig);
      if (rig.weaponPoseKey !== key) cacheItemSilhouette(rig);
      rig.weaponPoseKey = key;
    }
    updateHandRig(rig);
    return;
  }
  const tool = ITEMS[id]?.tool,
    flat = isFlatItem(id),
    block = ITEMS[id]?.block !== undefined && !flat;
  const depth = tool ? -0.62 : -0.72;
  rig.root.position.set(heldMountX(camera, depth), -0.52, depth);
  rig.root.rotation.set(
    0,
    // Existing cube art is authored at -0.35 rad. Neutralize that local turn
    // so camera perspective exposes both cube sides instead of a flat face.
    block ? 0.35 : flat ? -0.12 : 0,
    heldRestRoll(id),
  );
  updateHandRig(rig);
  anchorHeldItem(rig, camera, tool ? 1.28 : 0.94);
  rig.restMount ??= new THREE.Vector3();
  rig.restMount.copy(rig.root.position);
  const use = javaUsePose(id, player, time, game);
  rig.root.position.x += pose.x + use.x;
  rig.root.position.y += pose.y + use.y;
  rig.root.position.z += pose.z + use.z;
  rotation.set(pose.rx + use.rx, pose.ry + use.ry, pose.rz + use.rz, "XYZ");
  swing.setFromEuler(rotation);
  rig.root.quaternion.premultiply(swing);
  updateHandRig(rig);
}
