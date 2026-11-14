import { alignNockedArrow } from "./arrow-model.js";
import { equipArmorVisuals } from "./armor-models.js";
import { armorPalette } from "./armor-art.js";
import {
  poseThirdPersonWeapon,
  configureWeaponDisplay,
} from "./weapon-poses.js";
import { isWeapon } from "./weapon-art.js";
import { animateRangedWeapon } from "./ranged-weapon-models.js";
import { animateArticulatedPlayer } from "./player-motion.js";
import {
  createPistolModel,
  animatePistolModel,
  pistolRecoil,
} from "./pistol-model.js";
import * as THREE from "three";
import { isFlatItem } from "./item-shapes.js";
import { ITEMS } from "./data.js";
import { skinFor } from "./skins.js";
import { skinMaterial, skinBoxGeometry } from "./skin-art.js";
import { createHeldModel } from "./first-person.js";
// Every outfit shares the classic 8px head, 8x12 torso and 4x12 limbs.
// The authoritative collision body, camera height and weapon models are unchanged.
export const PLAYER_PROPORTIONS = Object.freeze({
  pixel: 1.8 / 32,
  head: [0.45, 0.45, 0.45],
  body: [0.45, 0.675, 0.225],
  leg: [0.225, 0.675, 0.225],
  arm: [0.225, 0.675, 0.225],
});
export function createPlayerModel(skinId, equipment = [], held, atlas) {
  const s = skinFor(skinId),
    root = new THREE.Group(),
    rig = new THREE.Group();
  root.add(rig);
  const materials = {};
  const mat = (color) =>
    (materials[color] ||= new THREE.MeshLambertMaterial({ color }));
  function box(parent, size, pos, color) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat(color));
    mesh.position.set(...pos);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const textured = (parent, size, pos, part, side = 1, range, cover) => {
    const material = skinMaterial(skinId, part, side, cover);
    const mesh = new THREE.Mesh(
      skinBoxGeometry(size, material.map, range),
      material,
    );
    mesh.position.set(...pos);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = `skin-${part}`;
    mesh.userData = { skinPart: part, side, sourceRows: range || null };
    parent.add(mesh);
    return mesh;
  };
  const joint = (x, y) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    rig.add(g);
    return g;
  };
  const legs = [-1, 1].map((side) => {
    const leg = joint(side * 0.1125, 0.675);
    textured(
      leg,
      PLAYER_PROPORTIONS.leg,
      [0, -0.3375, 0],
      "leg",
      side,
      undefined,
      {
        leggings:
          ITEMS[equipment[2]?.id]?.armorSlot === 2 &&
          armorPalette(equipment[2].id).family !== "chainmail",
        boots:
          ITEMS[equipment[3]?.id]?.armorSlot === 3 &&
          armorPalette(equipment[3].id).family !== "chainmail",
      },
    );
    return leg;
  });
  const body = textured(rig, PLAYER_PROPORTIONS.body, [0, 1.0125, 0], "body");
  const forearms = [];
  const arms = [-1, 1].map((side) => {
    const arm = joint(side * 0.3375, 1.35);
    textured(arm, [0.225, 0.3, 0.225], [0, -0.15, 0], "sleeve", side, [
      0,
      16 / 3,
    ]);
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    arm.add(elbow);
    textured(elbow, [0.225, 0.195, 0.225], [0, -0.0975, 0], "sleeve", side, [
      16 / 3,
      8.8,
    ]);
    textured(
      elbow,
      [0.225, 0.18, 0.225],
      [0, -0.285, 0],
      "hand",
      side,
      [8.8, 12],
    );
    forearms.push(elbow);
    return arm;
  });
  const head = new THREE.Group();
  head.position.y = 1.35;
  rig.add(head);
  textured(head, PLAYER_PROPORTIONS.head, [0, 0.225, 0], "head");
  const coat = [],
    accessories = [];
  if (s.style === "dante" || s.style === "vergil") {
    for (const side of [-1, 1]) {
      const tail = new THREE.Group();
      tail.position.set(side * 0.1125, 0.7, 0.12);
      rig.add(tail);
      box(tail, [0.222, 0.54, 0.016], [0, -0.27, 0], s.shirt);
      box(
        tail,
        [0.018, 0.54, 0.018],
        [side * 0.1, -0.27, -0.002],
        s.style === "vergil" ? s.accent : "#6f1e30",
      );
      coat.push(tail);
      tail.userData.coveredBy = "legs";
      accessories.push(tail);
    }
    if (s.style === "vergil") {
      const sheath = box(
        rig,
        [0.045, 0.75, 0.045],
        [-0.28, 0.54, 0.15],
        "#252b38",
      );
      sheath.rotation.z = -0.2;
      sheath.userData.coveredBy = "legs";
      accessories.push(sheath);
      const hilt = box(
        rig,
        [0.045, 0.17, 0.045],
        [-0.19, 0.99, 0.15],
        s.accent,
      );
      hilt.rotation.z = -0.2;
      hilt.userData.coveredBy = "legs";
      accessories.push(hilt);
      const guard = box(
        rig,
        [0.11, 0.025, 0.09],
        [-0.21, 0.91, 0.15],
        s.accent,
      );
      guard.userData.coveredBy = "legs";
      accessories.push(guard);
    }
  }
  if (s.style === "astronaut") {
    const pack = box(rig, [0.3, 0.43, 0.1], [0, 1.03, 0.165], s.shirt);
    pack.userData.coveredBy = "chest";
    accessories.push(pack);
  }
  const armorEquipment=equipment.map(s=>s?.id==="elytra"?null:s);
  const armor = equipArmorVisuals(
    { rig, head, body, arms, forearms, legs },
    armorEquipment,
    accessories,
  );
  const grip = new THREE.Group();
  const blockHeld = ITEMS[held]?.block !== undefined;
  grip.position.set(0, -0.6, blockHeld ? -0.02 : -0.07);
  grip.rotation.x = blockHeld ? -0.1 : -0.85;
  if (forearms.length) {
    grip.position.y = -0.3;
    forearms[1].add(grip);
  } else arms[1].add(grip);
  const heldModel = createHeldModel(held, atlas);
  if (heldModel) {
    if (isFlatItem(held)) heldModel.position.z -= 0.11;
    heldModel.scale.setScalar(1.1);
    if (isWeapon(held) && held !== "matthew_dual_pistols")
      configureWeaponDisplay(heldModel, held, "third");
    grip.add(heldModel);
  }
  const leftGrip = new THREE.Group();
  if (held === "matthew_dual_pistols") {
    leftGrip.position.copy(grip.position);
    leftGrip.rotation.copy(grip.rotation);
    const left = createPistolModel(true);
    left.scale.setScalar(1.1);
    leftGrip.add(left);
    forearms[0].add(leftGrip);
  }
  const elytraWings=[];
  if(equipment[1]?.id==="elytra")for(const sign of[-1,1]){const wing=new THREE.Group();wing.position.set(sign*.08,1.25,.17);wing.rotation.z=sign*.15;box(wing,[.35,.72,.05],[sign*.12,-.28,.02],"#8b7f9c");rig.add(wing);elytraWings.push(wing);}
  root.userData = {
    elytraWings,
    coat,
    armor,
    accessories,
    leftGrip,
    rig,
    head,
    arms,
    forearms,
    legs,
    body,
    grip,
    skin: skinId,
    heldId: held,
    heldKind:
      ITEMS[held]?.tool ||
      (ITEMS[held]?.block !== undefined ? "block" : "item"),
  };
  return root;
}
export function animatePlayerModel(
  model,
  p,
  dt,
  moving,
  action = 0,
  actionKind = "attack",
  pistolRemaining = 0,
  pistolEffects = true,
  visualAction = null,
  visualContext = {},
) {
  model.userData.elytraWings?.forEach((w,i)=>{w.rotation.z+=((i?1:-1)*(p.gliding?.9:.15)-w.rotation.z)*(1-Math.exp(-dt*10));});
  if (model.userData.heldKind !== "pistols") {
    animateArticulatedPlayer(
      model,
      p.gliding?{...p,swimming:true}:p,
      dt,
      moving,
      action,
      actionKind,
      visualAction,
    );
    if (dt > 0) {
      poseThirdPersonWeapon(
        model,
        p,
        visualAction,
        action,
        actionKind,
        visualContext,
      );
      animateRangedWeapon(
        model.userData.grip.children[0],
        p,
        visualContext.time ?? 0,
        visualContext.held,
      );
      if (model.userData.heldId === "bow")
        alignNockedArrow(
          model.userData.grip.children[0],
          new THREE.Vector3(
            -Math.sin(p.yaw || 0) * Math.cos(p.pitch || 0),
            Math.sin(p.pitch || 0),
            -Math.cos(p.yaw || 0) * Math.cos(p.pitch || 0),
          ),
        );
    }
    return;
  }
  const u = model.userData;

  u.stride = (u.stride || 0) + (moving ? dt * (p.sprinting ? 14 : 9) : 0);
  const alpha = 1 - Math.exp(-14 * dt),
    gait = moving ? (p.sprinting ? 0.65 : 0.4) : 0;
  u.gait = (u.gait || 0) + (gait - (u.gait || 0)) * alpha;
  u.legs.forEach(
    (g, i) => (g.rotation.x = Math.sin(u.stride + i * Math.PI) * u.gait),
  );
  u.arms.forEach((g, i) => {
    g.rotation.x =
      -Math.sin(u.stride + i * Math.PI) * u.gait * 0.8 +
      (i === 1 ? -action * 1.6 : 0);
  });
  const use = actionKind === "eat" || actionKind === "use";
  const thrust = u.heldKind === "spear";
  const swimming = p.inWater && !p.onGround;
  u.arms.forEach((arm, i) => {
    u.forearms?.[i]?.rotation.set(0, 0, 0);
    arm.rotation.z = 0;
    arm.rotation.y = 0;
    if (swimming) arm.rotation.x = Math.sin(u.stride + i * Math.PI) * 0.6 + 1.5;
    else if (!p.onGround && !p.flying) arm.rotation.z = (i ? 1 : -1) * 0.12;
    if (i === 1 && action > 0) {
      arm.rotation.x = use
        ? action * 2.0
        : thrust
          ? action * 1.45
          : action * (actionKind === "place" ? 1.25 : 1.8);
      arm.rotation.y = use ? 0 : thrust ? -action * 0.15 : -action * 0.5;
      arm.rotation.z = use ? -action * 0.2 : thrust ? 0 : action * 0.5;
    }
  });
  u.body.rotation.z =
    actionKind === "attack" ? Math.sin(action * Math.PI) * 0.035 : 0;
  u.grip.rotation.x =
    u.heldKind === "block"
      ? -0.1
      : thrust
        ? -1.4 - u.arms[1].rotation.x
        : (use ? -1.05 : -0.85) - u.arms[1].rotation.x * 0.65;
  if (u.heldKind === "pistols") {
    const kick = pistolRecoil(pistolRemaining).kick;
    u.carry =
      (u.carry || 0) +
      ((p.sprinting && moving && pistolRemaining <= 0 ? 1 : 0) -
        (u.carry || 0)) *
        alpha;
    u.arms.forEach((arm, i) => {
      const firing = i === (p.matthewHand || 0) ? kick : 0;
      arm.rotation.x = 1.3 + p.pitch * 0.6 + firing * 0.24 - u.carry * 0.65;
      arm.rotation.y = (i ? -1 : 1) * (0.07 + u.carry * 0.18);
      arm.rotation.z = (i ? 1 : -1) * (firing * 0.035 + u.carry * 0.12);
    });
    u.grip.rotation.x = u.leftGrip.rotation.x = -1.3 + p.pitch * 0.4;
    animatePistolModel(
      u.grip.children[0],
      p.matthewHand === 1 ? pistolRemaining : 0,
      pistolEffects,
    );
    animatePistolModel(
      u.leftGrip.children[0],
      p.matthewHand === 1 ? 0 : pistolRemaining,
      pistolEffects,
    );
  }
  u.coat?.forEach((tail, i) => {
    const target =
      (moving ? 0.12 : 0) +
      Math.abs(Math.sin(u.stride + i * 0.5)) * u.gait * 0.2 +
      Math.min(0.2, Math.abs(p.vy || 0) * 0.012);
    tail.rotation.x += (-target - tail.rotation.x) * alpha;
    tail.rotation.z = (i ? 1 : -1) * (0.035 + u.gait * 0.08);
  });
  u.head.rotation.x = p.pitch;
  u.rig.rotation.x = p.crouching ? 0.18 : 0;
  u.rig.position.y = p.crouching ? -0.25 : 0;
}
