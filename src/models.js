import {buildEndModel} from "./end-models.js";
import { buildAquaticModel } from "./aquatic-models.js";
import { buildColdWildlife } from "./cold-wildlife-models.js";
import { buildWatcherModel } from "./watcher-model.js";
import { createBoatModel, buildFlierModel } from "./expedition-models.js";
import { buildNightModel } from "./night-models.js";
import { buildExpansionModel } from "./expansion-models.js";
import { buildInfernalModel } from "./infernal-models.js";
import { VILLAGE_STYLES } from "./village-styles.js";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { HOSTILE_TYPES, MOB_INFO } from "./data.js";
import { hash } from "./random.js";
import { buildOverworldModel } from "./overworld-models.js";
function makeMaterial(base, style = "cloth") {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 16;
  const c = canvas.getContext("2d");
  c.fillStyle = base;
  c.fillRect(0, 0, 16, 16);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      if (style === "storybook" && (x % 4 !== 0 || y % 4 !== 0)) continue;
      const r = hash(x, y, base.length + style.length);
      if (style === "cow" && hash(x >> 2, y >> 2, 52) > 0.56)
        c.fillStyle = "#46372b";
      else
        c.fillStyle =
          r > 0.7 ? "#ffffff18" : r < 0.2 ? "#00000018" : "#00000000";
      c.fillRect(
        x,
        y,
        style === "storybook" ? 2 : 1,
        style === "storybook" ? 2 : 1,
      );
    }
  const map = new THREE.CanvasTexture(canvas);
  map.magFilter = map.minFilter = THREE.NearestFilter;
  map.colorSpace = THREE.SRGBColorSpace;
  const result = new THREE.MeshLambertMaterial({ map });
  if (style === "storybook") result.userData.paletteColor = base;
  return result;
}
const unitBox = new THREE.BoxGeometry(1, 1, 1);
unitBox.userData.shared = true;
function mergeStatic(parent, exclude) {
  const batches = new Map();
  for (const m of parent.children)
    if (m.isMesh && m !== exclude) {
      if (!batches.has(m.material)) batches.set(m.material, []);
      batches.get(m.material).push(m);
    }
  for (const [material, parts] of batches)
    if (parts.length > 1) {
      const copies = parts.map((m) => {
        m.updateMatrix();
        return m.geometry.clone().applyMatrix4(m.matrix);
      });
      const geometry = mergeGeometries(copies);
      geometry.userData.shared = false;
      copies.forEach((g) => g.dispose());
      parts.forEach((m) => parent.remove(m));
      parent.add(new THREE.Mesh(geometry, material));
    }
}
export function createMobModel(entity) {
  if (entity.type === "boat") return createBoatModel();
  const palette = new Map();
  const material = (base, style = "cloth") => {
    const key = base + style;
    if (!palette.has(key)) palette.set(key, makeMaterial(base, style));
    return palette.get(key);
  };
  const g = new THREE.Group(),
    type = entity.type,
    hostile = HOSTILE_TYPES.has(type),
    villager = type === "villager";
  const base = material(
    type === "iron_golem"
      ? "#c2c8bc"
      : villager
        ? VILLAGE_STYLES[entity.style]?.robe || "#81533c"
        : type === "cow"
          ? "#e1d6bb"
          : type === "chicken"
            ? "#e9e6db"
            : type === "rabbit"
              ? "#a78661"
              : type === "grazer"
                ? "#d68e8b"
                : type === "woolling"
                  ? "#ece7d4"
                  : type === "emberling"
                    ? "#a64f33"
                    : type === "stalker"
                      ? "#46414f"
                      : "#537259",
    type === "cow" ? "cow" : "cloth",
  );
  const dark = material(
    type === "grazer"
      ? "#bd7777"
      : type === "cow"
        ? "#604536"
        : villager
          ? "#594035"
          : type === "chicken"
            ? "#dca54d"
            : type === "woolling"
              ? "#a8937b"
              : "#614a38",
  );
  const skin = material(
    villager ? "#b98b67" : type === "woolling" ? "#aa9380" : "#d2ae7e",
  );
  const box = (parent, w, h, d, x, y, z, mat = base) => {
    const mesh = new THREE.Mesh(unitBox, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    parent.add(mesh);
    return mesh;
  };
  const limb = (w, h, d, x, y, z, mat) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    box(pivot, w, h, d, 0, -h / 2, 0, mat);
    g.add(pivot);
    return pivot;
  };
  const head = new THREE.Group();
  g.add(head);
  g.userData.head = head;
  g.userData.legs = [];
  g.userData.wings = [];
  if (
    buildEndModel(entity, { g, head, box, limb, material }) ||
    buildAquaticModel(entity, { g, head, box, limb, material }) ||
    buildColdWildlife(entity, { g, head, box, limb, material }) ||
    buildFlierModel(entity, { g, head, box, material }) ||
    buildOverworldModel(entity, { g, head, box, limb, material }) ||
    buildWatcherModel(type, { g, head, box, limb, material }) ||
    buildInfernalModel(type, { g, head, box, limb, material }) ||
    buildNightModel(type, { g, head, box, limb, material }) ||
    buildExpansionModel(type, { g, head, box, limb, material })
  ) {
  } else if (type === "iron_golem") {
    box(g, 1.04, 1.05, 0.56, 0, 1.45, 0, base);
    box(g, 0.77, 0.3, 0.48, 0, 0.83, 0, base);
    box(g, 0.28, 0.32, 0.32, 0, 2.07, 0, base);
    box(g, 1.4, 0.2, 0.38, 0, 2.02, 0, base);
    head.position.set(0, 2.28, -0.04);
    box(head, 0.5, 0.53, 0.47, 0, 0.15, 0, base);
    box(head, 0.16, 0.18, 0.16, 0, 0.04, -0.29, base);
    for (const x of [-0.14, 0.14]) {
      box(head, 0.09, 0.045, 0.025, x, 0.22, -0.25, material("#78553e"));
      box(head, 0.14, 0.055, 0.025, x, 0.3, -0.25, material("#74816e"));
    }
    for (const [x, y] of [
      [-0.28, 1.7],
      [-0.22, 1.5],
      [-0.15, 1.3],
      [0.3, 1.1],
    ])
      box(g, 0.12, 0.24, 0.018, x, y, -0.29, material("#698058"));
    g.userData.arms = [
      limb(0.3, 1.3, 0.38, -0.7, 2.1, 0, base),
      limb(0.3, 1.3, 0.38, 0.7, 2.1, 0, base),
    ];
    g.userData.legs = [
      limb(0.32, 0.7, 0.36, -0.27, 0.7, 0, base),
      limb(0.32, 0.7, 0.36, 0.27, 0.7, 0, base),
    ];
  } else if (hostile || villager) {
    box(g, 0.5, 0.78, 0.3, 0, 1.02, 0, base);
    box(g, 0.18, 0.14, 0.22, 0, 1.44, 0, base);
    head.position.set(0, 1.58, 0);
    box(head, 0.49, 0.5, 0.45, 0, 0.13, 0, villager ? skin : dark);
    for (const x of [-0.13, 0.13]) {
      box(head, 0.13, 0.085, 0.025, x, 0.18, -0.235, material("#eee9dc"));
      box(
        head,
        0.055,
        0.075,
        0.028,
        x,
        0.175,
        -0.252,
        material(
          villager ? "#436c36" : type === "shade" ? "#b6c66e" : "#d75734",
        ),
      );
    }
    if (villager) {
      if (["snow", "pine"].includes(entity.style)) {
        box(head, 0.55, 0.12, 0.5, 0, 0.42, 0, base);
        box(head, 0.09, 0.47, 0.48, -0.27, 0.16, 0, base);
        box(head, 0.09, 0.47, 0.48, 0.27, 0.16, 0, base);
      }
      if (["desert", "badlands"].includes(entity.style)) {
        box(
          head,
          0.56,
          0.13,
          0.52,
          0,
          0.4,
          0,
          material(VILLAGE_STYLES[entity.style].trim),
        );
        box(head, 0.5, 0.17, 0.5, 0, 0.51, 0, base);
      }
      box(head, 0.12, 0.18, 0.14, 0, 0.01, -0.28, skin);
      for (const x of [-0.13, 0.13])
        box(head, 0.16, 0.04, 0.03, x, 0.285, -0.236, dark);
      g.userData.foldedArms = [-1, 1].map((side) => {
        const arm = new THREE.Group();
        arm.position.set(side * 0.31, 1.37, 0);
        box(arm, 0.19, 0.39, 0.24, 0, -0.195, 0, base);
        box(arm, 0.31, 0.16, 0.22, -side * 0.09, -0.4, -0.15, base);
        box(arm, 0.12, 0.14, 0.21, -side * 0.235, -0.4, -0.15, skin);
        mergeStatic(arm);
        g.add(arm);
        return arm;
      });
      box(g, 0.55, 0.25, 0.34, 0, 0.65, 0, base);
      const apron = material(
        entity.profession === "farmer"
          ? "#9b7f3a"
          : entity.profession === "mason"
            ? "#a9a5a0"
            : "#d7d1bc",
      );
      box(g, 0.32, 0.5, 0.035, 0, 1, -0.17, apron);
      if (
        entity.profession === "farmer" &&
        !["snow", "pine", "desert", "badlands"].includes(entity.style)
      ) {
        box(head, 0.72, 0.09, 0.68, 0, 0.44, 0, material("#bb9c4f"));
        box(head, 0.52, 0.19, 0.5, 0, 0.55, 0, material("#b39148"));
      }
    } else {
      g.userData.arms = [
        limb(0.17, 0.65, 0.18, -0.35, 1.38, -0.12, base),
        limb(0.17, 0.65, 0.18, 0.35, 1.38, -0.12, base),
      ];
      g.userData.arms.forEach((a) => (a.rotation.x = -1.15));
    }
    g.userData.legs = [
      limb(0.2, 0.6, 0.23, -0.145, 0.6, 0, dark),
      limb(0.2, 0.6, 0.23, 0.145, 0.6, 0, dark),
    ];
  } else if (type === "chicken") {
    box(g, 0.42, 0.4, 0.5, 0, 0.42, 0, base);
    head.position.set(0, 0.7, -0.22);
    box(head, 0.3, 0.34, 0.28, 0, 0, 0, base);
    box(head, 0.2, 0.09, 0.18, 0, -0.04, -0.21, dark);
    box(head, 0.11, 0.14, 0.08, 0, -0.15, -0.15, material("#bf4435"));
    box(head, 0.1, 0.12, 0.19, 0, 0.23, 0, material("#bf4435"));
    for (const x of [-0.155, 0.155])
      box(head, 0.015, 0.065, 0.065, x, 0.03, -0.06, material("#24211e"));
    g.userData.wings = [
      limb(0.08, 0.28, 0.35, -0.26, 0.58, 0, base),
      limb(0.08, 0.28, 0.35, 0.26, 0.58, 0, base),
    ];
    g.userData.legs = [
      limb(0.055, 0.25, 0.065, -0.105, 0.25, 0, dark),
      limb(0.055, 0.25, 0.065, 0.105, 0.25, 0, dark),
    ];
  } else if (type === "rabbit") {
    box(g, 0.4, 0.35, 0.55, 0, 0.3, 0, base);
    head.position.set(0, 0.52, -0.25);
    box(head, 0.31, 0.3, 0.3, 0, 0, 0, base);
    for (const x of [-0.1, 0.1]) {
      box(head, 0.09, 0.34, 0.09, x, 0.29, 0.01, base);
      box(head, 0.045, 0.25, 0.015, x, 0.29, -0.045, material("#c39487"));
      box(head, 0.055, 0.065, 0.025, x, 0.04, -0.16, material("#292321"));
    }
    box(g, 0.14, 0.15, 0.14, 0, 0.37, 0.32, skin);
    for (const x of [-0.15, 0.15])
      for (const z of [-0.2, 0.19])
        g.userData.legs.push(
          limb(0.1, z > 0 ? 0.19 : 0.15, 0.18, x, 0.17, z, dark),
        );
  } else {
    const cow = type === "cow",
      sheep = type === "woolling",
      pig = type === "grazer";
    box(
      g,
      cow ? 0.78 : 0.7,
      cow ? 0.74 : 0.6,
      cow ? 1.15 : 1,
      0,
      cow ? 0.94 : 0.78,
      0,
      base,
    );
    head.position.set(0, cow ? 1.15 : 0.98, cow ? -0.64 : -0.57);
    box(head, 0.46, 0.46, 0.46, 0, 0, 0, sheep ? dark : base);
    for (const x of [-0.15, 0.15]) {
      box(head, 0.07, 0.075, 0.025, x, 0.07, -0.24, material("#2e2622"));
    }
    box(head, 0.3, 0.18, 0.13, 0, -0.1, -0.29, pig ? dark : cow ? skin : dark);
    if (pig || sheep)
      for (const side of [-1, 1]) {
        const ear = box(
          head,
          0.13,
          0.15,
          0.12,
          side * 0.26,
          0.14,
          0.02,
          sheep ? dark : base,
        );
        ear.rotation.z = side * -0.28;
      }
    if (pig)
      for (const x of [-0.07, 0.07])
        box(head, 0.045, 0.05, 0.02, x, -0.09, -0.365, material("#774b4a"));
    if (cow) {
      for (const x of [-0.24, 0.24]) {
        box(head, 0.13, 0.12, 0.2, x, 0.09, 0, dark);
        box(head, 0.09, 0.2, 0.09, x, 0.31, 0.07, skin);
      }
      box(g, 0.27, 0.16, 0.25, 0, 0.54, 0.22, material("#bc8b83"));
    }
    if (sheep) box(head, 0.5, 0.14, 0.47, 0, 0.25, 0.01, base);
    for (const x of [-0.23, 0.23])
      for (const z of [-0.34, 0.34])
        g.userData.legs.push(
          limb(0.16, cow ? 0.6 : 0.48, 0.18, x, cow ? 0.6 : 0.48, z, dark),
        );
    const tail = box(g, 0.1, 0.27, 0.1, 0, cow ? 1 : 0.8, 0.58, base);
    tail.rotation.x = -0.35;
    g.userData.tail = tail;
  }
  // Static pieces sharing a material are batched; joint groups stay independent.
  const joints = [];
  g.traverse((o) => {
    if (o.isGroup && o !== g) joints.push(o);
  });
  for (const joint of joints) mergeStatic(joint);
  mergeStatic(g, g.userData.tail);
  const bounds = new THREE.Box3().setFromObject(g),
    rig = new THREE.Group();
  const height = MOB_INFO[type]?.height || 1.95;
  for (const child of [...g.children]) rig.add(child);
  rig.scale.y = height / Math.max(0.1, bounds.max.y);
  g.add(rig);
  g.userData.rig = rig;
  g.userData.materials = [...palette.values()];
  for (const mat of g.userData.materials)
    mat.userData.restEmissive = mat.emissive.clone();
  g.userData.shadow = null;
  return g;
}
