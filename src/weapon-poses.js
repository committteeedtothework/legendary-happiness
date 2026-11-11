import { alignNockedArrow } from "./arrow-model.js";
import * as THREE from "three";
import { isWeapon } from "./weapon-art.js";
import { ITEMS } from "./data.js";
// Numeric display facts, Java Edition 26.3. See reference/weapon-poses-26.3.json.
// Art is original. The Third-person socket is normalized to this rig's palm.
export const JAVA_WEAPON_DISPLAY = Object.freeze({
  handheld: {
    first: {
      rotation: [0, -90, 25],
      translation: [1.13, 3.2, 1.13],
      scale: 0.68,
    },
    third: { rotation: [0, -90, 55], translation: [0, 4, 0.5], scale: 0.85 },
  },
  mace: {
    first: { rotation: [0, -90, 25], translation: [0, 3, 0.8], scale: 0.9 },
    third: { rotation: [0, -90, 55], translation: [0, 4, 1], scale: 1 },
  },
  spear: {
    first: {
      rotation: [-20, 90, -35],
      translation: [3.13, 2, 0.13],
      scale: [1.36, 1.36, 0.68],
    },
    third: {
      rotation: [5, 270, -40],
      translation: [0, 2, 2],
      scale: [1.7, 1.7, 0.85],
    },
  },
  trident_throwing: {
    third: { rotation: [0, 90, 180], translation: [8, -17, 9], scale: 1 },
  },
  bow: {
    first: {
      rotation: [0, -90, 25],
      translation: [1.13, 3.2, 1.13],
      scale: 0.68,
    },
    third: {
      rotation: [-80, 260, -40],
      translation: [-1, -2, 2.5],
      scale: 0.9,
    },
  },
  crossbow: {
    first: {
      rotation: [-90, 0, -55],
      translation: [1.13, 3.2, 1.13],
      scale: 0.68,
    },
    third: { rotation: [-90, 0, -60], translation: [2, 0.1, -3], scale: 0.9 },
  },
  shield: {
    first: {
      rotation: [0, 180, 5],
      translation: [-10, 1.75, -10],
      scale: 1.25,
    },
    third: { rotation: [0, 90, 0], translation: [10, 6, -4], scale: 1 },
  },
  shield_blocking: {
    first: {
      rotation: [0, 180, -5],
      translation: [-15, 3.25, -11],
      scale: 1.25,
    },
    third: { rotation: [45, 155, 0], translation: [-3.49, 11, -2], scale: 1 },
  },
  trident: {
    first: { rotation: [0, -90, 25], translation: [-3, 17, 1], scale: 1 },
    third: { rotation: [0, 60, 0], translation: [11, 17, -2], scale: 1 },
  },
});
const rad = Math.PI / 180,
  q = new THREE.Quaternion(),
  v = new THREE.Vector3();
export function weaponDisplayKind(id) {
  return ["bow", "crossbow", "shield", "trident", "mace"].includes(id)
    ? id
    : ITEMS[id]?.tool === "spear"
      ? "spear"
      : "handheld";
}
export function configureWeaponDisplay(
  model,
  id,
  context = "first",
  blocking = false,
  throwing = false,
) {
  if (!model || !isWeapon(id) || id === "matthew_dual_pistols") return;
  const kind =
      id === "shield" && blocking
        ? "shield_blocking"
        : id === "trident" && throwing && context === "third"
          ? "trident_throwing"
          : weaponDisplayKind(id),
    d = JAVA_WEAPON_DISPLAY[kind][context];
  model.rotation.set(...d.rotation.map((a) => a * rad), "XYZ");
  const scales = Array.isArray(d.scale) ? d.scale : [d.scale, d.scale, d.scale];
  model.scale.fromArray(scales).multiplyScalar(context === "third" ? 0.9 : 1);
  if (id === "devin_sword") model.rotateZ(-Math.PI / 4);
  if (id === "shield") model.rotateY(Math.PI / 2);
  if (context === "first") {
    // Generated sprites are centered in Java. Our meshes have a real grip at
    // zero, so carry the center-to-grip correction through the display matrix.
    v.fromArray(model.userData.centerToGrip || [0, 0, 0])
      .multiply(model.scale)
      .applyQuaternion(model.quaternion);
    model.position.set(...d.translation.map((n) => n / 16)).add(v);
    // Entity-style shields/tridents have their own original geometry origin.
    // Keep their handle in the same mount, rather than importing entity meshes.
    if (id === "shield")
      model.position.set(
        blocking ? -0.12 : 0.12,
        blocking ? 0.04 : -0.08,
        -0.12,
      );
    if (id === "trident" || ITEMS[id]?.tool === "spear")
      model.position.set(0.05, -0.05, 0);
  } else model.position.set(0, 0, 0);
  model.userData.displayContext = context;
  model.userData.displayKind = kind;
}
export function mountPixelWeapon(rig, id, pose, camera, player, time, game) {
  const model = rig.grip.children.find((m) => m.userData.weaponModel === id);
  configureWeaponDisplay(model, id, "first", !!player.shieldRaised);
  rig.grip.position.set(0, 0, 0);
  rig.wrist.rotation.set(0, 0, 0);
  rig.root.position.set(0.56, -0.52, -0.72);
  rig.root.rotation.set(0, Math.PI / 4, 0);
  // Unlike the previous silhouette fit, Java's mount is fixed in camera units.
  // Resizing must not change the weapon scale/angle or pin moving tips to edges.
  rig.restMount ??= new THREE.Vector3();
  rig.restMount.copy(rig.root.position);
  const use = weaponUsePose(id, player, time, game);
  rig.root.position.add(v.set(pose.x + use.x, pose.y + use.y, pose.z + use.z));
  q.setFromEuler(
    new THREE.Euler(pose.rx + use.rx, pose.ry + use.ry, pose.rz + use.rz),
  );
  rig.root.quaternion.premultiply(q);
  if (id === "bow") alignNockedArrow(model, new THREE.Vector3(0, 0, -1));
}
export function weaponUsePose(id, p, time, game) {
  const r = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, trail: 0 };
  if (id === "shield" && p.shieldRaised)
    return { ...r, x: -0.28, y: 0.12, z: -0.08, ry: 0.25 };
  if (id === "trident" && game?.tridentCharge?.stack?.id === id) {
    const draw = Math.min(
      1,
      Math.max(0, (game.tickCount - game.tridentCharge.start) / 10),
    );
    return {
      ...r,
      x: -0.28 * draw,
      y: 0.26 * draw,
      z: 0.1 * draw,
      rx: -1.15 * draw,
      ry: 0.35 * draw,
      rz: 0.1 * draw,
    };
  }
  if (id === "crossbow" && game?.inventory.held?.charged && !p.editionDraw)
    return { ...r, x: -0.18, y: 0.06, ry: 0.175 };
  if (p.editionDraw?.id === id) {
    const d = Math.min(
      1,
      Math.max(
        0,
        (time - p.editionDraw.start) / (id === "crossbow" ? 1.25 : 1),
      ),
    );
    return id === "bow"
      ? {
          ...r,
          x: -0.28,
          y: 0.14,
          z: 0.04 * d,
          rx: -0.18,
          ry: -0.35,
          rz: -0.16,
        }
      : { ...r, x: -0.22, y: 0.08, z: 0.06 * d, rx: 0, ry: -0.25, rz: 0.06 };
  }
  return r;
}
export function poseThirdPersonWeapon(
  model,
  p,
  visualAction,
  action,
  kind,
  context = {},
) {
  const u = model.userData,
    id = u.heldId;
  if (!isWeapon(id) || id === "matthew_dual_pistols") return;
  const right = u.arms[1],
    left = u.arms[0],
    pitch = p.pitch || 0,
    drawing =
      p.editionDraw?.id === id || (id === "crossbow" && context.held?.charged);
  const active =
    (action > 0 || visualAction) && ["attack", "mine", "place"].includes(kind);
  const special = ["devin_sword"].includes(id) || ITEMS[id]?.tool === "spear";
  // Retain swimming strokes. On land, Java's straight cuboid arms carry/use
  // the same rigid socket; no compensating wrist rotation or detached elbow.
  if (!p.inWater) {
    u.forearms.forEach((a) => a.rotation.set(0, 0, 0));
    if (active && !special) {
      const t = visualAction
        ? Math.max(0, Math.min(1, visualAction.age / visualAction.duration))
        : Math.max(0, Math.min(1, action));
      const arc = Math.sin(Math.sqrt(t) * Math.PI),
        yaw = -Math.sin(Math.sqrt(t) * Math.PI * 2) * 0.2;
      right.rotation.x = visualAction
        ? 1.2 * arc - Math.sin(t * Math.PI) * (0.7 - pitch) * 0.45
        : Math.abs(action) * 1.55;
      right.rotation.y = yaw * 2;
      right.rotation.z = -Math.sin(t * Math.PI) * 0.4;
      u.body.rotation.y = yaw;
    }
    if (drawing && id === "bow") {
      right.rotation.set(Math.PI / 2 + pitch, -0.1, 0);
      left.rotation.set(Math.PI / 2 + pitch, 0.4, 0);
    } else if (drawing && id === "crossbow") {
      const d = Math.min(
        1,
        Math.max(0, ((context.time ?? 0) - (p.editionDraw?.start ?? 0)) / 1.25),
      );
      right.rotation.set(Math.PI / 2 + pitch, -0.3, 0);
      left.rotation.set(Math.PI / 2 + pitch, 0.85 - d * 0.55, 0);
    } else if (id === "shield" && p.shieldRaised)
      right.rotation.set(1.05 + pitch, -0.5, -0.1);
    else if (id === "trident" && context.tridentCharge)
      right.rotation.set(Math.PI - 0.1 + pitch, -0.1, 0);
  }
  // Java's hand item layer basis, then model display rotation. The real grip
  // remains at the palm for all action states and every original silhouette.
  u.grip.rotation.set(-Math.PI / 2, Math.PI, 0);
  configureWeaponDisplay(
    u.grip.children[0],
    id,
    "third",
    !!p.shieldRaised,
    !!context.tridentCharge,
  );
}
