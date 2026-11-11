import * as THREE from "three";
import { ITEMS } from "./data.js";
import { armorTexture, armorPalette } from "./armor-art.js";
import { faceBoxGeometry } from "./pixel-surfaces.js";
export function armorMesh(id, part, size, at, range) {
  const map = armorTexture(id, part),
    m = new THREE.Mesh(
      faceBoxGeometry(size, map, range),
      new THREE.MeshLambertMaterial({
        map,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
      }),
    );
  m.position.set(...at);
  m.name = "equipped-" + id + "-" + part;
  m.castShadow = m.receiveShadow = true;
  m.material.userData.sharedMap = true;
  m.userData = { armor: id, armorPart: part, sourceRows: range || null };
  return m;
}
export function equipArmorVisuals(
  { rig, head, body, arms, forearms, legs },
  equipment,
  accessories = [],
) {
  const pieces = [];
  const add = (parent, id, part, size, at, range) => {
    const m = armorMesh(id, part, size, at, range);
    parent.add(m);
    pieces.push(m);
    return m;
  };
  equipment.forEach((stack, slot) => {
    const id = stack?.id;
    if (ITEMS[id]?.armorSlot !== slot) return;
    if (slot === 0) add(head, id, "head", [0.483, 0.483, 0.483], [0, 0.225, 0]);
    if (slot === 1) {
      add(body, id, "body", [0.48, 0.668, 0.261], [0, 0, 0]);
      arms.forEach((arm, i) => {
        add(arm, id, "arm", [0.247, 0.312, 0.247], [0, -0.15, 0], [0, 16 / 3]);
        add(
          forearms[i],
          id,
          "arm",
          [0.247, 0.205, 0.247],
          [0, -0.0975, 0],
          [16 / 3, 8.8],
        );
        if (armorPalette(id).family !== "chainmail") {
          arm.children[0].visible = false;
          forearms[i].children[0].visible = false;
        }
      });
    }
    if (slot === 2) {
      add(rig, id, "belt", [0.468, 0.085, 0.25], [0, 0.695, 0]);
      legs.forEach((leg, i) =>
        add(
          leg,
          id,
          "leg",
          [0.242, 0.483, 0.256],
          [(i ? 1 : -1) * 0.0125, -0.235, 0],
          [0, 8.5],
        ),
      );
    }
    if (slot === 3)
      legs.forEach((leg, i) =>
        add(
          leg,
          id,
          "leg",
          [0.248, 0.219, 0.28],
          [(i ? 1 : -1) * 0.0155, -0.565, -0.012],
          [8.1, 12],
        ),
      );
  });
  const chest = ITEMS[equipment[1]?.id]?.armorSlot === 1,
    leggings = ITEMS[equipment[2]?.id]?.armorSlot === 2;
  for (const a of accessories)
    if (
      (a.userData.coveredBy === "chest" && chest) ||
      (a.userData.coveredBy === "legs" && (leggings || chest))
    )
      a.visible = false;
  return pieces;
}
