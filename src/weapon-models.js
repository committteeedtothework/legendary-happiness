import * as THREE from "three";
import { WEAPON_FAMILIES, weaponPixels } from "./weapon-art.js";
import { pixelWeaponMesh, pixelRootData } from "./pixel-weapon-mesh.js";
export { WEAPON_FAMILIES };
export const weaponBlueprint = weaponPixels;
export function createWeaponModel(id) {
  const p = weaponPixels(id);
  if (!p || !WEAPON_FAMILIES.has(p.kind)) return null;
  const root = new THREE.Group();
  root.add(pixelWeaponMesh(p));
  root.userData = {
    ...pixelRootData(p),
    bladeRidges: p.legendary ? 8 : 0,
    goldenGrip: p.legendary,
  };
  if (p.legendary) {
    for (let i = 0; i < 3; i++) {
      const glint = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.012, 0.012),
        new THREE.MeshBasicMaterial({
          color: i === 1 ? "#ffe494" : "#a6f8ed",
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        }),
      );
      glint.position.set((i % 2 ? 1 : -1) * 0.09, 0.24 + i * 0.13, 0.035);
      glint.userData.magicGlint = i;
      root.add(glint);
    }
  }
  return root;
}
