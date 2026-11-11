import * as THREE from "three";
import { pistolPixels } from "./weapon-art.js";
import { pixelWeaponMesh } from "./pixel-weapon-mesh.js";
// Original 24x16 stepped profile. Each rigid subassembly uses the same art as
// the paired inventory icon. Palm at zero; barrel along -Z. No curves/bevels.
export function createPistolModel(dark = false) {
  const root = new THREE.Group(),
    slide = new THREE.Group(),
    hammer = new THREE.Group();
  root.add(slide, hammer);
  for (const [part, parent] of [
    ["body", root],
    ["slide", slide],
    ["hammer", hammer],
  ]) {
    const mesh = pixelWeaponMesh(pistolPixels(dark, part));
    mesh.rotation.y = Math.PI / 2;
    parent.add(mesh);
  }
  const flash = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.065, 0.13),
    new THREE.MeshBasicMaterial({
      color: dark ? "#ffd281" : "#d5f5ff",
      transparent: true,
      depthWrite: false,
    }),
  );
  flash.position.set(0, 0.115, -0.37);
  flash.visible = false;
  root.add(flash);
  const casing = new THREE.Mesh(
    new THREE.BoxGeometry(0.012, 0.025, 0.012),
    new THREE.MeshLambertMaterial({ color: "#d4b769" }),
  );
  casing.visible = false;
  root.add(casing);
  root.userData = {
    kind: "pistols",
    item: "matthew_dual_pistols",
    weaponModel: "matthew_dual_pistols",
    pixelProfile: true,
    sourcePixels: [24, 16],
    finish: dark ? "black" : "silver",
    slide,
    hammer,
    flash,
    casing,
  };
  return root;
}

export const PISTOL_RECOIL_SECONDS = 0.18;
export function pistolRecoil(remaining) {
  const age = Math.max(0, PISTOL_RECOIL_SECONDS - Math.max(0, remaining));
  if (!(remaining > 0)) return { kick: 0, slide: 0, flash: false, age };
  const kick =
    age < 0.018
      ? age / 0.018
      : Math.exp(-(age - 0.018) * 23) * Math.max(0, 1 - age / 0.18);
  const slide =
    age < 0.018 ? age / 0.018 : Math.max(0, 1 - (age - 0.018) / 0.065);
  return { kick, slide, flash: age < 0.04, age };
}
export function animatePistolModel(model, remaining, effects = true) {
  const u = model?.userData;
  if (!u?.slide) return;
  const p = pistolRecoil(remaining);
  u.slide.position.z = p.slide * 0.048;
  u.hammer.rotation.x = -p.slide * 0.65;
  u.flash.visible = p.flash && effects;
  u.flash.scale.set(0.65 + p.kick * 0.35, 0.65 + p.kick * 0.35, 1.6 + p.kick);
  u.flash.rotation.z = p.age * 65;
  u.casing.visible = effects && remaining > 0 && p.age > 0.018 && p.age < 0.17;
  const t = Math.max(0, p.age - 0.018);
  u.casing.position.set(
    0.065 + t * 1.25,
    0.14 + t * 1.2 - t * t * 9,
    -0.025 + t * 0.35,
  );
  u.casing.rotation.set(t * 22, 0, t * 35);
}
