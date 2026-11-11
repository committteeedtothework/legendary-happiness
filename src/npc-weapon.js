import * as THREE from "three";
import { createWeaponModel } from "./weapon-models.js";
import { createRangedWeapon } from "./ranged-weapon-models.js";
import { configureWeaponDisplay } from "./weapon-poses.js";
// Reuse the player's original pixel art for NPC equipment, not decorative
// substitute cuboids. Creature AI, damage and collision bodies never read this.
export function attachNPCWeapon(parent, id, at, scale = 1) {
  const socket = new THREE.Group(),
    model = createWeaponModel(id) || createRangedWeapon(id);
  socket.position.set(...at);
  socket.rotation.set(-Math.PI / 2, Math.PI, 0);
  socket.scale.setScalar(scale);
  configureWeaponDisplay(model, id, "third");
  socket.add(model);
  parent.add(socket);
  socket.userData.weapon = id;
  return socket;
}
