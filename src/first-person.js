import { armorTexture, armorPalette } from "./armor-art.js";
import { configureWeaponDisplay } from "./weapon-poses.js";
import { isWeapon } from "./weapon-art.js";
import { cacheItemSilhouette } from "./item-framing.js";
import { editionBlockModel, editionWeaponModel } from "./edition-models.js";
import { createCorpseModel } from "./stand-models.js";
import { createWeaponModel } from "./weapon-models.js";
import { createPistolModel } from "./pistol-model.js";
import * as THREE from "three";
import { BLOCKS, ITEMS } from "./data.js";
import { itemIconCanvas } from "./textures.js";
import { isFlatItem } from "./item-shapes.js";
import { blockArtUV } from "./block-art.js";
import { armAppearanceFor } from "./skins.js";
import { skinPartTexture, skinBoxGeometry } from "./skin-art.js";

const HAND_SOCKET = new THREE.Vector3(0, -0.04, 0.025);
const HAND_UNITS = 0.16 / 0.18;
export const HAND_REST_Y = -0.22;
// The item base now fills the lower-right forearm area rather than hovering
// above a missing palm. Coordinates are mirrored for the left pistol.
export const ITEM_REST_OFFSET = Object.freeze({ x: 0.035, y: -0.15, z: 0.04 });

function box(parent, size, position, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}
export function createHandRig() {
  const root = new THREE.Group(),
    wrist = new THREE.Group(),
    grip = new THREE.Group(),
    armVisuals = new THREE.Group();
  // Keep the cosmetic arm separate from the animated item socket. Hiding this
  // group also hides gloves/armor without changing their appearance state.
  armVisuals.name = "first-person-arm";
  root.add(wrist, armVisuals);
  root.position.set(0.37, HAND_REST_Y, -0.72);
  wrist.rotation.set(-0.12, -0.12, -0.13);
  const appearance = armAppearanceFor("explorer");
  const skin = new THREE.MeshLambertMaterial({ color: appearance.skin });
  const sleeve = new THREE.MeshLambertMaterial({ color: appearance.sleeve });
  // A classic rectangular arm: its skin and sleeve share one straight axis.
  // There are no separate palms, finger bars or knuckles to poke through items.
  const forearm = box(armVisuals, [0.16, 1, 0.16], [0, 0, 0], skin);
  const cuff = box(armVisuals, [0.16, 1, 0.16], [0, 0, 0], sleeve);
  forearm.name = "block-hand";
  cuff.name = "block-sleeve";
  grip.position.copy(HAND_SOCKET);
  wrist.add(grip);
  const glove = box(
    armVisuals,
    [0.167, 1, 0.167],
    [0, 0, 0],
    new THREE.MeshLambertMaterial({ color: "#292833" }),
  );
  glove.name = "block-glove";
  glove.visible = false;
  const shoulder = box(
    armVisuals,
    [0.187, 1, 0.223],
    [0, 0, 0],
    new THREE.MeshLambertMaterial(),
  );
  shoulder.name = "armor-shoulder";
  shoulder.visible = false;
  const rig = {
    root,
    wrist,
    grip,
    armVisuals,
    sleeve,
    skin,
    glove,
    shoulder,
    appearance,
    forearm,
    cuff,
    viewBounds: new THREE.Box3(),
    localViewBounds: null,
    armBounds: new THREE.Box3(),
    arm: {
      anchor: new THREE.Vector3(),
      hand: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      inverse: new THREE.Matrix4(),
      shift: new THREE.Vector3(),
    },
  };
  updateHandRig(rig);
  return rig;
}

export function applyHandAppearance(rig, appearance, armorId) {
  rig.appearance = appearance;
  rig.skin.color.set("#ffffff");
  rig.sleeve.color.set("#ffffff");
  for (const [mesh, part, material] of [
    [rig.forearm, "hand", rig.skin],
    [rig.cuff, "sleeve", rig.sleeve],
  ]) {
    const map = skinPartTexture(
      appearance.id,
      part,
      rig.root.scale.x < 0 ? -1 : 1,
    );
    if (material.map !== map) {
      material.map = map;
      material.userData.sharedMap = true;
      material.needsUpdate = true;
      mesh.geometry.dispose();
      mesh.geometry = skinBoxGeometry(
        [0.16, 1, 0.16],
        map,
        part === "hand" ? [8.8, 12] : [0, 8.8],
      );
    }
  }
  // Gloves are texels in the shared arm sheet, not slightly enlarged boxes.
  rig.glove.visible = false;
  rig.glove.userData.texturedGlove = !!appearance.glove;
  const equipped = ITEMS[armorId]?.armorSlot === 1;
  rig.shoulder.visible = equipped;
  rig.cuff.visible = !equipped || armorPalette(armorId).family === "chainmail";
  if (equipped) {
    const map = armorTexture(armorId, "arm");
    if (rig.shoulder.material.map !== map) {
      rig.shoulder.material.map = map;
      rig.shoulder.material.color.set("#ffffff");
      rig.shoulder.material.alphaTest = 0.5;
      rig.shoulder.material.side = THREE.DoubleSide;
      rig.shoulder.material.userData.sharedMap = true;
      rig.shoulder.material.needsUpdate = true;
      rig.shoulder.geometry.dispose();
      rig.shoulder.geometry = skinBoxGeometry([0.178, 1, 0.178], map, [0, 8.8]);
    }
    rig.shoulder.userData.armor = armorId;
  } else delete rig.shoulder.userData.armor;
}

const armAxis = new THREE.Vector3(0, 1, 0);
export function updateHandRig(rig) {
  const { root, wrist, forearm, cuff, glove, shoulder, arm } = rig;
  // Coordinates belong to the view-model camera, not the moving wrist. Mirrored
  // left-hand rigs use the same solve; held items keep their rigid sockets.
  // Keep all held geometry in front of the view camera near plane, even at
  // the extreme of eating, recoil and long-weapon follow-through animations.
  if (!rig.localViewBounds) cacheHandBounds(rig);
  root.updateWorldMatrix(true, false);
  wrist.updateWorldMatrix(false, false);
  rig.viewBounds.copy(rig.localViewBounds).applyMatrix4(wrist.matrixWorld);
  if (rig.viewBounds.max.z > -0.11) {
    const shift = rig.viewBounds.max.z + 0.11;
    root.position.z -= shift;
    rig.viewBounds.min.z -= shift;
    rig.viewBounds.max.z -= shift;
  }
  if (!rig.armVisuals.visible) {
    // An item-only view has no arm to solve or reserve camera clearance for.
    // The cached real item geometry above remains guarded against clipping.
    root.updateMatrixWorld(true);
    return;
  }
  root.updateMatrix();
  wrist.updateMatrix();
  arm.inverse.copy(root.matrix).invert();
  arm.anchor
    .set(root.scale.x < 0 ? -0.48 : 0.48, -1.1, -0.4)
    .applyMatrix4(arm.inverse);
  arm.hand.copy(HAND_SOCKET).applyMatrix4(wrist.matrix);
  arm.direction.subVectors(arm.anchor, arm.hand);
  const length = arm.direction.length();
  arm.direction.normalize();
  forearm.quaternion.setFromUnitVectors(armAxis, arm.direction);
  cuff.quaternion.copy(forearm.quaternion);
  // Equal square sections meet exactly: no floating wrist, sleeve lip or
  // coplanar side surfaces that flicker as the arm moves.
  const handLength = Math.min(
    rig.appearance.handLength * HAND_UNITS,
    length * 0.5,
  );
  forearm.position
    .copy(arm.hand)
    .addScaledVector(arm.direction, handLength / 2);
  forearm.scale.y = handLength;
  // Fingerless gloves have the same exposed tip and wrist as the F5 costume.
  // Their outer faces sit clear of the skin, rather than flickering coplanarly.
  const gloveStyle = rig.appearance.glove;
  const gloveStart = Math.min(
    (gloveStyle?.start || 0) * HAND_UNITS,
    handLength,
  );
  const gloveEnd = Math.min((gloveStyle?.end || 0) * HAND_UNITS, handLength);
  glove.position
    .copy(arm.hand)
    .addScaledVector(arm.direction, (gloveStart + gloveEnd) / 2);
  glove.quaternion.copy(forearm.quaternion);
  glove.scale.y = Math.max(0.001, gloveEnd - gloveStart);
  cuff.position
    .copy(arm.hand)
    .addScaledVector(arm.direction, (length + handLength) / 2);
  cuff.scale.y = length - handLength;
  const shoulderLength = length - handLength;
  shoulder.position
    .copy(arm.hand)
    .addScaledVector(arm.direction, handLength + shoulderLength / 2);
  shoulder.quaternion.copy(cuff.quaternion);
  shoulder.scale.y = shoulderLength;
  // The cached rigid-item box cannot describe a freshly solved long sleeve,
  // glove or shoulder. Guard those real sections too, including extreme equip,
  // swimming and recoil poses, without rebuilding the item bounds every frame.
  root.updateMatrixWorld(true);
  for (const section of [forearm, cuff, glove, shoulder]) {
    if (!section.visible) continue;
    if (!section.geometry.boundingBox) section.geometry.computeBoundingBox();
    rig.armBounds
      .copy(section.geometry.boundingBox)
      .applyMatrix4(section.matrixWorld);
    rig.viewBounds.union(rig.armBounds);
  }
  if (rig.viewBounds.max.z > -0.11) {
    const shift = rig.viewBounds.max.z + 0.11;
    root.position.z -= shift;
    rig.viewBounds.translate(arm.shift.set(0, 0, -shift));
    root.updateMatrixWorld(true);
  }
}
// Cache actual held geometry at equip. Only a visible empty hand reserves a
// hand cap; hidden arms never contribute placeholder volume or clearance.
export function cacheHandBounds(rig) {
  rig.root.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(rig.wrist.matrixWorld).invert(),
    local = rig.armVisuals.visible
      ? new THREE.Box3(
          new THREE.Vector3(-0.12, -0.14, -0.12),
          new THREE.Vector3(0.12, 0.12, 0.12),
        )
      : new THREE.Box3(),
    part = new THREE.Box3(),
    matrix = new THREE.Matrix4();
  rig.wrist.traverseVisible((mesh) => {
    if (!mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    matrix.multiplyMatrices(inverse, mesh.matrixWorld);
    part.copy(mesh.geometry.boundingBox).applyMatrix4(matrix);
    local.union(part);
  });
  if (local.isEmpty()) local.set(new THREE.Vector3(), new THREE.Vector3());
  // Rigid content is cached once at equip; leave slack for slide recoil/glints.
  rig.localViewBounds = local.expandByScalar(0.075);
}
export function fitHandGrip(rig, id, model) {
  const pistol = id === "matthew_dual_pistols",
    flat = isFlatItem(id),
    block = ITEMS[id]?.block !== undefined && !flat;
  // Use the actual square hand tip as the socket, never the old finger cage.
  rig.grip.position.copy(HAND_SOCKET);
  if (model) {
    model.position.set(
      0,
      pistol ? 0.025 : 0,
      flat ? -0.005 : pistol ? -0.015 : 0,
    );
    if (block) {
      // Keep the hand tip inside the rotated block's lower rear portion.
      // Fitting only its camera bounds cannot establish physical contact.
      const cube = model.children[0];
      model.position.copy(cube.position).negate();
      model.position.y += 0.105;
      // Rest on the square hand tip instead of burying the forearm in the cube.
      model.position.z -= 0.005;
    }
  }
  if (isWeapon(id) && !pistol) {
    rig.grip.position.set(0, 0, 0);
    configureWeaponDisplay(model, id, "first");
  }
  rig.root.userData.gripStyle = pistol
    ? "pistol"
    : flat
      ? "flat"
      : block
        ? "support"
        : "handle";
  cacheHandBounds(rig);
  if (!rig.armVisuals.visible) cacheItemSilhouette(rig);
  else rig.itemSilhouette = null;
}
export function createHeldModel(id, atlas) {
  const item = ITEMS[id];
  if (!item) return null;
  if (id === "saint_corpse_part") return createCorpseModel();
  if (id === "matthew_dual_pistols") return createPistolModel();
  const weapon = createWeaponModel(id);
  if (weapon) return weapon;
  const editionWeapon = editionWeaponModel(id);
  if (editionWeapon) return editionWeapon;
  if (isFlatItem(id)) return createFlatTool(id);
  const edition = editionBlockModel(id, atlas);
  if (edition) return edition;
  const g = new THREE.Group();
  g.userData.kind = item.block !== undefined ? "block" : item.tool || "item";
  if (item.block !== undefined) {
    const door = BLOCKS[item.block].door;
    const geometry = new THREE.BoxGeometry(
      door ? 0.15 : 0.235,
      door ? 0.32 : 0.235,
      door ? 0.035 : 0.235,
    );
    const uv = geometry.attributes.uv;
    for (let face = 0; face < 6; face++) {
      for (let i = face * 4; i < face * 4 + 4; i++) {
        const [u, v] = blockArtUV(
          item.block,
          face,
          uv.getX(i),
          uv.getY(i),
          atlas.pack,
        );
        uv.setXY(i, u, v);
      }
    }
    const cube = new THREE.Mesh(
      geometry,
      new THREE.MeshLambertMaterial({ map: atlas.texture, alphaTest: 0.5 }),
    );
    cube.material.userData.sharedMap = true;
    cube.position.set(-0.025, 0.11, door ? -0.055 : -0.18);
    cube.rotation.y = -0.35;
    g.add(cube);
  }
  return g;
}

function createFlatTool(id) {
  const root = new THREE.Group();
  const map = new THREE.CanvasTexture(itemIconCanvas(id));
  map.magFilter = map.minFilter = THREE.NearestFilter;
  map.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.24),
    new THREE.MeshLambertMaterial({
      map,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    }),
  );
  mesh.position.set(0, 0.075, -0.025);
  root.add(mesh);
  root.userData = { kind: "item", flatCutout: true, item: id };
  return root;
}
export function createDroppedModel(id, atlas) {
  const item = ITEMS[id];
  if (!item) return new THREE.Group();
  const model = createHeldModel(id, atlas);
  const bounds = new THREE.Box3().setFromObject(model),
    size = bounds.getSize(new THREE.Vector3()),
    center = bounds.getCenter(new THREE.Vector3());
  // Root offset preserves rigid tool grips while normalising dropped silhouettes.
  const root = new THREE.Group(),
    scale = 0.38 / Math.max(size.x, size.y, size.z, 0.01);
  model.position.sub(center);
  root.add(model);
  root.scale.setScalar(scale);
  root.userData.droppedItem = id;
  root.userData.flatCutout = !!model.userData.flatCutout;
  return root;
}
