import { createArrowModel } from "./arrow-model.js";
import * as THREE from "three";
import { weaponPixels } from "./weapon-art.js";
import { pixelWeaponMesh, pixelRootData } from "./pixel-weapon-mesh.js";
export function createRangedWeapon(id) {
  if (!["bow", "crossbow", "shield"].includes(id)) return null;
  const root = new THREE.Group(),
    p = weaponPixels(id);
  root.userData = { ...pixelRootData(p), editionWeapon: true, drawMeshes: [] };
  if (id === "bow") root.userData.centerToGrip[0] *= -1;
  for (let i = 0; i < (id === "shield" ? 1 : 4); i++) {
    const art = weaponPixels(id, i);
    if (id === "bow" && i > 0) {
      // Draw only the bow/string here; a rigid 3D arrow supplies the nock/tip.
      for (const row of art.grid)
        for (let x = 0; x < row.length; x++)
          if (["H", "M", "o"].includes(row[x])) row[x] = ".";
      const src = art.grid.map((row) => [...row]);
      for (let y = 0; y < art.height; y++)
        for (let x = 0; x < art.width; x++)
          if (
            src[y][x] === "." &&
            [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ].some(
              ([dx, dy]) =>
                src[y + dy]?.[x + dx] && src[y + dy][x + dx] !== ".",
            )
          )
            art.grid[y][x] = "o";
    }
    const mesh = pixelWeaponMesh(art);
    if (id === "bow") {
      mesh.scale.x = -1;
      mesh.userData.stringNock = new THREE.Vector3(
        (4.5 - i - p.anchor[0]) * p.unit,
        (p.anchor[1] - 8.5) * p.unit,
        0,
      );
    }
    mesh.visible = i === 0;
    root.add(mesh);
    root.userData.drawMeshes.push(mesh);
  }
  if (id === "bow") {
    const arrow = createArrowModel();
    arrow.visible = false;
    root.add(arrow);
    root.userData.nockedArrow = arrow;
  }
  return root;
}
export function animateRangedWeapon(model, player, time, stack) {
  if (!model?.userData.editionWeapon) return;
  const u = model.userData,
    draw =
      player.editionDraw?.id === u.item
        ? Math.max(
            0,
            Math.min(
              1,
              (time - player.editionDraw.start) /
                (u.item === "crossbow" ? 1.25 : 1),
            ),
          )
        : 0;
  const stage =
    u.item === "crossbow" && stack?.charged
      ? 3
      : draw <= 0
        ? 0
        : draw < 0.65
          ? 1
          : draw < 0.9
            ? 2
            : 3;
  u.drawStage = stage;
  if (u.item === "bow")
    u.drawMeshes.forEach(
      (m) => (m.scale.x = u.displayContext === "third" ? 1 : -1),
    );
  if (u.nockedArrow) u.nockedArrow.visible = stage > 0;
  u.drawMeshes.forEach(
    (m, i) => (m.visible = i === Math.min(stage, u.drawMeshes.length - 1)),
  );
}
