import { inheritPlayerMotion } from "../src/player-motion.js";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ITEMS, MOB_INFO } from "../src/data.js";
import {
  createWeaponModel,
  weaponBlueprint,
  WEAPON_FAMILIES,
} from "../src/weapon-models.js";
import { createHeldModel, createDroppedModel } from "../src/first-person.js";
import { actionPose, FirstPersonAnimator } from "../src/animation.js";
import { createPlayerModel, animatePlayerModel } from "../src/player-model.js";
import { createPistolModel } from "../src/pistol-model.js";
import { createMobModel } from "../src/models.js";
import {
  INFERNAL_STYLES,
  animateInfernalModel,
} from "../src/infernal-models.js";
import { ArcaneEffects, animateMagic } from "../src/arcane-effects.js";
import { cleanPose } from "../src/multiplayer.js";
import { modelFingerprint } from "./helpers/model-fingerprint.js";
import { mockCanvas } from "./helpers/mock-canvas.js";
const reference = JSON.parse(
  readFileSync(
    new URL("./fixtures/model-reference-v170.json", import.meta.url),
  ),
);
const weapons = Object.keys(ITEMS).filter(
  (id) => WEAPON_FAMILIES.has(ITEMS[id].tool) && ITEMS[id].block === undefined,
);
const player = () => ({
  x: 0,
  y: 200,
  z: 0,
  onGround: true,
  vy: 0,
  pitch: 0.15,
  yaw: 0.25,
  sprinting: true,
  matthewHand: 1,
  health: 20,
});
function finiteModel(model) {
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    assert.ok(o.matrixWorld.elements.every(Number.isFinite));
    if (o.isMesh)
      assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));
  });
}
test("all 43 non-pistol weapons/tools use finite thin pixel silhouettes, a consistent palm origin and bounded batches", () => {
  assert.ok(weapons.length >= 43);
  for (const id of weapons) {
    const b = weaponBlueprint(id),
      m = createWeaponModel(id),
      size = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
    assert.equal(m.userData.weaponModel, id);
    assert.ok(b.grid.flat().some((c) => c === "h"));
    assert.ok(size.y > 0.5 && size.y < 1.3);
    assert.ok(size.z > 0.02 && size.z < 0.09);
    assert.ok(size.x > 0.1 && size.x <= 1);
    finiteModel(m);
    let draws = 0;
    m.traverse((o) => {
      if (o.isMesh) draws++;
    });
    assert.ok(draws <= 5);
    const d = createDroppedModel(id);
    const ds = new THREE.Box3().setFromObject(d).getSize(new THREE.Vector3());
    assert.ok(Math.abs(Math.max(ds.x, ds.y, ds.z) - 0.38) < 1e-5);
  }
  assert.equal(createWeaponModel("matthew_dual_pistols"), null);
});
test("Devin has a genuinely golden grip, broad stepped cyan blade, pixel ridges and anchored rather than orbiting glints", () => {
  const b = weaponBlueprint("devin_sword"),
    m = createWeaponModel("devin_sword");
  assert.equal(m.userData.goldenGrip, true);
  assert.equal(m.userData.bladeRidges, 8);
  for (let y = 23; y < 29; y++)
    assert.ok(["h", "H", "G"].includes(b.grid[y][11]));
  const glints = m.children.filter((o) => o.userData.magicGlint !== undefined),
    positions = glints.map((o) => o.position.toArray());
  assert.equal(glints.length, 3);
  for (let i = 0; i < 120; i++) animateMagic(m, i / 60);
  assert.deepEqual(
    glints.map((o) => o.position.toArray()),
    positions,
  );
  animateMagic(m, 2, false);
  assert.ok(glints.every((o) => !o.visible));
  animateMagic(m, 2, true);
  assert.ok(glints.every((o) => o.visible));
  finiteModel(m);
});
test("ordinary weapon families share a Java-style swing; custom spear and Devin curves remain distinct", () => {
  const middle = [];
  for (const family of WEAPON_FAMILIES) {
    for (const kind of ["attack", "mine", "use"])
      for (const p of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
        const pose = actionPose(kind, p, family);
        assert.ok(Object.values(pose).every(Number.isFinite));
        if (p === 0 || p === 1)
          assert.ok(Object.values(pose).every((n) => Math.abs(n) < 1e-9));
      }
    middle.push(JSON.stringify(actionPose("attack", 0.5, family)));
  }
  assert.equal(new Set(middle).size, 2);
  assert.ok(actionPose("attack", 0.5, "spear").z < -0.25);
  assert.equal(actionPose("attack", 0.35, "sword").trail, 0);
  assert.ok(actionPose("attack", 0.35, "sword", 1, "devin_sword").trail > 0);
});
test("articulated elbows retain palm contact for every weapon, armor and staged action without modifying player state", () => {
  for (const id of weapons) {
    const m = createPlayerModel(
        "devin",
        [{ id: "iron_helmet" }, { id: "iron_chestplate" }],
        id,
      ),
      p = player(),
      before = JSON.stringify(p),
      u = m.userData;
    assert.equal(u.forearms.length, 2);
    assert.equal(u.grip.parent, u.forearms[1]);
    for (const kind of ["attack", "mine", "use"])
      for (const age of [0.1, 0.3, 0.7, 0.95]) {
        animatePlayerModel(m, p, 1 / 60, true, 0.7, kind, 0, true, {
          kind,
          age,
          duration: 1,
          direction: 1,
        });
        m.updateMatrixWorld(true);
        const grip = u.grip.getWorldPosition(new THREE.Vector3()),
          palm = u.forearms[1].children[1].getWorldPosition(
            new THREE.Vector3(),
          );
        assert.ok(grip.distanceTo(palm) < 0.1, `${id} ${kind} detached`);
        finiteModel(m);
      }
    assert.equal(JSON.stringify(p), before);
  }
});
test("swimming has a prone stroke, continuous stationary treading, bent elbows, smooth exit and a paused rig", () => {
  const m = createPlayerModel("devin", [], "iron_sword"),
    p = { ...player(), inWater: true, onGround: false, sprinting: false },
    u = m.userData,
    before = JSON.stringify(p);
  for (let i = 0; i < 90; i++) animatePlayerModel(m, p, 1 / 60, false);
  assert.ok(u.swim > 0.99 && u.prone < 0.01);
  const a = u.arms[0].rotation.x;
  for (let i = 0; i < 30; i++) animatePlayerModel(m, p, 1 / 60, false);
  assert.ok(Math.abs(a - u.arms[0].rotation.x) > 0.03);
  for (let i = 0; i < 90; i++) animatePlayerModel(m, p, 1 / 60, true);
  assert.ok(u.prone > 0.99 && u.rig.rotation.x < -1);
  u.rig.updateMatrix();
  const hip = new THREE.Vector3(0, 0.8, 0).applyMatrix4(u.rig.matrix);
  assert.ok(
    Math.abs(hip.z) < 0.01,
    "Swimming rotates around the hip without sliding the model ahead of the player",
  );
  const swapped = createPlayerModel("devin", [], "devin_sword");
  inheritPlayerMotion(m, swapped);
  animatePlayerModel(swapped, p, 1 / 60, true);
  assert.ok(swapped.userData.prone > 0.99);
  assert.ok(
    Math.abs(swapped.userData.swimPhase - u.swimPhase - 4.1 / 60) < 1e-9,
  );
  assert.ok(u.forearms.every((a) => a.rotation.x < -0.1));
  const snapshot = modelFingerprint(m);
  animatePlayerModel(m, p, 0, false);
  assert.equal(modelFingerprint(m), snapshot);
  assert.equal(JSON.stringify(p), before);
  p.inWater = false;
  p.onGround = true;
  for (let i = 0; i < 150; i++) animatePlayerModel(m, p, 1 / 60, false);
  assert.ok(u.swim < 0.001 && Math.abs(u.rig.rotation.x) < 0.001);
  finiteModel(m);
});
test("wading and Creative flight do not trigger swimming; first-person paddling settles consistently across frame rates", () => {
  for (const flags of [
    { inWater: true, onGround: true },
    { inWater: true, onGround: false, flying: true },
  ]) {
    const m = createPlayerModel("explorer", [], null);
    for (let i = 0; i < 60; i++)
      animatePlayerModel(m, { ...player(), ...flags }, 1 / 60, true);
    assert.ok(m.userData.swim < 0.001);
  }
  const submerged = createPlayerModel("explorer", [], null);
  for (let i = 0; i < 60; i++)
    animatePlayerModel(
      submerged,
      { ...player(), inWater: true, underwater: true, onGround: true },
      1 / 60,
      true,
    );
  assert.ok(
    submerged.userData.swim > 0.99,
    "Fully submerged movement retains the swimming pose near the bottom",
  );
  const end = [];
  for (const hz of [30, 60, 144]) {
    const a = new FirstPersonAnimator(),
      p = { ...player(), onGround: false, inWater: true };
    for (let i = 0; i < hz; i++)
      assert.ok(
        Object.values(a.step(1 / hz, p, { moving: true, tool: "sword" })).every(
          Number.isFinite,
        ),
      );
    assert.ok(a.swim > 0.99);
    end.push(a.swimPhase);
    const phase = a.swimPhase;
    a.step(0, p, { moving: true, tool: "sword" });
    assert.equal(a.swimPhase, phase);
  }
  assert.ok(Math.max(...end) - Math.min(...end) < 1e-8);
});
test("co-op appearance packets preserve safe water/ground flags and bound visual velocity", () => {
  const p = cleanPose({
    ...player(),
    inWater: true,
    underwater: true,
    onGround: false,
    vy: 10000,
    held: "devin_sword",
  });
  assert.equal(p.inWater, true);
  assert.equal(p.underwater, true);
  assert.equal(p.onGround, false);
  assert.equal(p.vy, 100);
  assert.equal(cleanPose({ ...player(), vy: NaN }).vy, 0);
});
test("all eight Cinderworld foe designs retain their collision height and bounded batches with distinct articulated silhouettes", () => {
  const old = globalThis.document;
  globalThis.document = {
    createElement: () => ({ getContext: () => ({ fillRect() {} }) }),
  };
  try {
    const fingerprints = [];
    for (const type of INFERNAL_STYLES) {
      const m = createMobModel({ type }),
        size = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
      assert.equal(m.userData.infernalStyle, type);
      assert.ok(
        Math.abs(size.y - (MOB_INFO[type]?.height || 1.95)) < 0.05,
        type,
      );
      let draws = 0;
      m.traverse((o) => {
        if (o.isMesh) draws++;
      });
      assert.ok(draws < 30, `${type}: ${draws} batches`);
      assert.ok(
        m.userData.materials.some(
          (mat) => mat.userData.restEmissive.getHex() !== 0,
        ),
      );
      for (let i = 0; i < 60; i++)
        animateInfernalModel(
          m,
          {
            type,
            attack: 1,
            castTicks: 12,
            special: type === "mad_titan" ? "slam" : null,
          },
          i / 60,
          1 / 60,
          true,
          0.8,
        );
      finiteModel(m);
      fingerprints.push(modelFingerprint(m));
    }
    assert.equal(new Set(fingerprints).size, 8);
  } finally {
    globalThis.document = old;
  }
});
test("Matthew pistol pixel geometry replaces the old smooth profile while first-person fire timing stays preserved; updated skin rigs keep both palms attached", () => {
  for (const dark of [false, true])
    assert.ok(createPistolModel(dark).userData.pixelProfile);
  const p = player();
  delete p.health;
  // The player appearance is intentionally new; do not compare the entire old
  // player's mesh hash. The new gun art is covered by weapon-style tests; preserve fire timing below.
  for (const { skin } of reference.pistolPlayer) {
    const m = createPlayerModel(skin, [], "matthew_dual_pistols");
    for (let i = 0; i < 60; i++)
      animatePlayerModel(m, p, 1 / 60, true, 0, "fire", i < 10 ? 0.15 : 0);
    const u = m.userData;
    assert.equal(u.grip.parent, u.forearms[1]);
    assert.equal(u.leftGrip.parent, u.forearms[0]);
    finiteModel(m);
    for (const [i, grip] of [u.leftGrip, u.grip].entries()) {
      const palm = u.forearms[i].children[1].getWorldPosition(
        new THREE.Vector3(),
      );
      assert.ok(
        grip.getWorldPosition(new THREE.Vector3()).distanceTo(palm) < 0.1,
      );
    }
  }
  const a = new FirstPersonAnimator();
  a.trigger("fire", "pistols");
  for (let i = 0; i < 60; i++)
    assert.deepEqual(
      a.step(1 / 60, p, { tool: "pistols", moving: true }),
      reference.pistolAnimator[i],
    );
});
test("solid block models and pistol audio/effects remain unchanged; door inventory items are flat", () => {
  for (const [id, hash] of Object.entries(reference.blocks))
    if (id !== "oak_door")
      assert.equal(
        modelFingerprint(
          (() => {
            const m = createHeldModel(id, { texture: new THREE.Texture() }),
              sourceUV = new THREE.BoxGeometry().attributes.uv,
              uv = m.children[0].geometry.attributes.uv;
            const block = ITEMS[id].block;
            for (let face = 0; face < 6; face++)
              for (let i = face * 4; i < face * 4 + 4; i++) {
                const tile = block * 3 + [1, 1, 0, 2, 1, 1][face];
                uv.setXY(
                  i,
                  ((tile % 16) + 0.015 + sourceUV.getX(i) * 0.97) / 16,
                  1 -
                    (Math.floor(tile / 16) + 0.985 - sourceUV.getY(i) * 0.97) /
                      32,
                );
              }
            return m;
          })(),
        ),
        hash,
        id,
      );
  const restore = mockCanvas();
  try {
    assert.equal(createHeldModel("oak_door").userData.flatCutout, true);
  } finally {
    restore();
  }
  for (const [file, hash] of Object.entries(reference.sourceHashes).filter(
    ([file]) => ["pistol-audio.js", "trickster-effects.js"].includes(file),
  ))
    assert.equal(
      createHash("sha256")
        .update(readFileSync(new URL("../src/" + file, import.meta.url)))
        .digest("hex"),
      hash,
      file,
    );
});

test("planted Devin display matches the inventory weapon, fits the old target cell, hides on claim and respects Minimal particles", async () => {
  const { World } = await import("../src/world.js");
  const { relicSite } = await import("../src/relic.js");
  const { B } = await import("../src/data.js");
  const old = globalThis.document;
  globalThis.document = {
    createElement: () => ({ getContext: () => ({ fillRect() {} }) }),
  };
  try {
    const world = new World("Wildflower"),
      site = relicSite(world),
      p = { x: site.x, y: site.y, z: site.z + 4 },
      scene = new THREE.Scene(),
      fx = new ArcaneEffects(scene);
    world.ensure(Math.floor(site.x / 16), Math.floor(site.z / 16));
    fx.update(world, p, null, 1, 0.016, true, "minimal");
    assert.equal(fx.relicDisplay?.visible, true);
    assert.equal(fx.relicDisplay.userData.goldenGrip, true);
    const bounds = new THREE.Box3().setFromObject(fx.relicDisplay);
    assert.ok(bounds.min.y >= site.y + 1 && bounds.max.y <= site.y + 2);
    assert.equal(world.get(site.x, site.y + 1, site.z), B.devin_relic_blade);
    assert.ok(
      fx.relicDisplay.children
        .filter((o) => o.userData.magicGlint !== undefined)
        .every((o) => !o.visible),
    );
    world.relicClaimed = true;
    fx.update(world, p, null, 2, 0.016, true, "all");
    assert.equal(fx.relicDisplay.visible, false);
    world.relicClaimed = false;
    world.set(site.x, site.y + 1, site.z, B.air);
    fx.update(world, p, null, 3, 0.016, true, "all");
    assert.equal(fx.relicDisplay.visible, false);
  } finally {
    globalThis.document = old;
  }
});
