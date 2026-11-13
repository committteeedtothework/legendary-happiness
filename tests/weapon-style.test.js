import { beforePlayerCopy } from "./helpers/player-copy-source.js";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  WEAPON_IDS,
  weaponPixels,
  pistolPixels,
  paintWeaponIcon,
} from "../src/weapon-art.js";
import {
  JAVA_WEAPON_DISPLAY,
  configureWeaponDisplay,
  weaponUsePose,
} from "../src/weapon-poses.js";
import {
  createHeldModel,
  createDroppedModel,
  createHandRig,
  fitHandGrip,
} from "../src/first-person.js";
import { createPistolModel, pistolRecoil } from "../src/pistol-model.js";
import { createPlayerModel, animatePlayerModel } from "../src/player-model.js";
import { animateRangedWeapon } from "../src/ranged-weapon-models.js";
import { mountJavaItem, javaSwingPose } from "../src/java-item-motion.js";
import { mockCanvas } from "./helpers/mock-canvas.js";
const sha = (s) => createHash("sha256").update(s).digest("hex");
const basePlayer = () => ({
  x: 0,
  y: 200,
  z: 0,
  yaw: 0,
  pitch: 0,
  onGround: true,
  health: 20,
  vy: 0,
});
const finite = (m) => {
  m.updateMatrixWorld(true);
  m.traverse((n) => {
    assert.ok(n.matrixWorld.elements.every(Number.isFinite));
    if (n.isMesh)
      assert.ok(n.geometry.attributes.position.array.every(Number.isFinite));
  });
};
test("all 61 weapons/combat tools and their icons use original integer-pixel source art with bounded palettes and transparent silhouettes", () => {
  assert.equal(WEAPON_IDS.length, 61);
  for (const id of WEAPON_IDS) {
    const pixels =
      id === "matthew_dual_pistols" ? pistolPixels() : weaponPixels(id);
    assert.ok(pixels);
    assert.ok(pixels.width <= 32 && pixels.height <= 32);
    assert.ok(pixels.grid.flat().includes("."));
    assert.ok(
      Object.values(pixels.palette).every((c) => /^#[0-9a-f]{6}$/i.test(c)),
    );
    const ops = [],
      c = {
        set fillStyle(v) {
          this.color = v;
        },
        fillRect(x, y, w, h) {
          assert.ok([x, y, w, h].every(Number.isInteger));
          assert.ok(x >= 0 && y >= 0 && x + w <= 32 && y + h <= 32);
          ops.push([this.color, x, y, w, h]);
        },
      };
    assert.equal(paintWeaponIcon(c, id), true);
    assert.ok(ops.length > 25, id);
    assert.ok(new Set(ops.map((o) => o[0])).size >= 4, id);
    assert.equal(c.imageSmoothingEnabled, false);
  }
  assert.equal(paintWeaponIcon({}, "apple"), false);
});
test("weapon meshes use exact palette texels, nearest filtering, no mipmaps, real stepped cutouts and bounded rigid batches", () => {
  for (const id of WEAPON_IDS) {
    const m = createHeldModel(id);
    let meshes = 0;
    m.traverse((n) => {
      if (!n.isMesh) return;
      meshes++;
      assert.ok(
        !["SphereGeometry", "CylinderGeometry", "ExtrudeGeometry"].includes(
          n.geometry.type,
        ),
        id,
      );
      if (n.material.map) {
        const t = n.material.map;
        assert.equal(t.magFilter, THREE.NearestFilter);
        assert.equal(t.minFilter, THREE.NearestFilter);
        assert.equal(t.generateMipmaps, false);
        assert.ok(t.image.width <= 32 && t.image.height <= 32);
        assert.ok(t.image.data.some((v, i) => i % 4 === 3 && v === 0));
      }
    });
    assert.ok(meshes <= 6, id);
    finite(m);
    const d = createDroppedModel(id);
    finite(d);
    const s = new THREE.Box3().setFromObject(d).getSize(new THREE.Vector3());
    assert.ok(Math.abs(Math.max(s.x, s.y, s.z) - 0.38) < 1e-5, id);
  }
  for (const dark of [false, true])
    assert.ok(createPistolModel(dark).userData.pixelProfile);
});
test("handheld, bow, crossbow, shield, mace, trident and spear display numbers match the documented Java 26.3 reference", () => {
  const facts = JSON.parse(
    readFileSync(
      new URL("../reference/weapon-poses-26.3.json", import.meta.url),
    ),
  );
  for (const [k, n] of Object.entries({
    handheld: "handheld",
    mace: "handheld_mace",
    bow: "bow",
    crossbow: "crossbow",
    shield: "shield",
    shield_blocking: "shield_blocking",
    trident: "trident_in_hand",
    spear: "spear_in_hand",
    trident_throwing: "trident_throwing",
  })) {
    for (const [ctx, hand] of [
      ["first", "firstperson_righthand"],
      ["third", "thirdperson_righthand"],
    ]) {
      const ours = JAVA_WEAPON_DISPLAY[k][ctx];
      if (!ours) continue;
      const ref = facts.models[n].display[hand];
      assert.deepEqual(ours.rotation, ref.rotation);
      assert.deepEqual(ours.translation, ref.translation);
      assert.deepEqual(
        Array.isArray(ours.scale)
          ? ours.scale
          : [ours.scale, ours.scale, ours.scale],
        ref.scale,
      );
    }
  }
});
test("first-person weapon mounts are camera-unit transforms independent of aspect, with no arm volume or per-frame silhouette pinning", () => {
  for (const id of WEAPON_IDS.filter((x) => x !== "matthew_dual_pistols")) {
    let rest;
    for (const aspect of [0.6, 854 / 478, 3.5]) {
      const c = new THREE.PerspectiveCamera(70, aspect, 0.04, 4),
        r = createHandRig();
      r.armVisuals.visible = false;
      const m = createHeldModel(id);
      r.grip.add(m);
      fitHandGrip(r, id, m);
      const p = basePlayer(),
        before = JSON.stringify(p);
      mountJavaItem(r, id, javaSwingPose(0), c, p, 0);
      assert.equal(r.armVisuals.visible, false);
      if (rest) assert.deepEqual(r.restMount.toArray(), rest);
      rest = r.restMount.toArray();
      for (const t of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
        mountJavaItem(r, id, javaSwingPose(t), c, p, 0);
        finite(r.root);
        assert.ok(r.viewBounds.max.z <= -0.1099, id);
      }
      assert.equal(JSON.stringify(p), before);
    }
  }
});
test("all third-person weapon grips remain attached through walking, swinging, use and swimming without mutating players", () => {
  for (const id of WEAPON_IDS) {
    const m = createPlayerModel("devin", [], id),
      p = basePlayer(),
      before = JSON.stringify(p);
    for (const kind of ["attack", "mine", "use"])
      for (const t of [0.1, 0.25, 0.5, 0.9]) {
        animatePlayerModel(
          m,
          p,
          1 / 60,
          true,
          0.7,
          kind,
          0.12,
          true,
          { kind, age: t, duration: 1, direction: 1 },
          { time: 2 },
        );
        finite(m);
        const u = m.userData,
          grip = u.grip.getWorldPosition(new THREE.Vector3()),
          palm = u.forearms[1].children[1].getWorldPosition(
            new THREE.Vector3(),
          );
        assert.ok(grip.distanceTo(palm) < 0.1, id);
      }
    assert.equal(JSON.stringify(p), before);
  }
});
test("bow/crossbow have four discrete draw silhouettes, and shield/trident use state restores instead of leaking across frames", () => {
  for (const id of ["bow", "crossbow"]) {
    const m = createHeldModel(id),
      p = basePlayer();
    for (const [time, stage] of [
      [0, 0],
      [0.1, 1],
      [0.85, 2],
      [1.5, 3],
    ]) {
      p.editionDraw = { id, start: 0 };
      animateRangedWeapon(m, p, id === "crossbow" ? time * 1.25 : time);
      assert.equal(m.userData.drawStage, stage);
      assert.equal(m.userData.drawMeshes.filter((x) => x.visible).length, 1);
    }
    delete p.editionDraw;
    animateRangedWeapon(m, p, 3);
    assert.equal(m.userData.drawStage, 0);
  }
  const p = basePlayer(),
    m = createHeldModel("shield");
  configureWeaponDisplay(m, "shield", "first", true);
  assert.equal(m.userData.displayKind, "shield_blocking");
  configureWeaponDisplay(m, "shield", "first", false);
  assert.equal(m.userData.displayKind, "shield");
  for (const id of ["bow", "crossbow", "shield", "trident"]) {
    const q = basePlayer();
    const before = JSON.stringify(q);
    assert.deepEqual(weaponUsePose(id, q, 3), javaSwingPose(0));
    assert.equal(JSON.stringify(q), before);
  }
  const t = createPlayerModel("devin", [], "trident");
  animatePlayerModel(t, p, 1 / 60, false, 0, "use", 0, true, null, {
    tridentCharge: {},
    time: 2,
  });
  assert.ok(t.userData.arms[1].rotation.x > 2.5);
  assert.equal(
    t.userData.grip.children[0].userData.displayKind,
    "trident_throwing",
  );
});
test("pistol recoil duration/slide/flash stay independent and end at rest in both new pixel finishes", () => {
  assert.deepEqual(pistolRecoil(0), {
    kick: 0,
    slide: 0,
    flash: false,
    age: 0.18,
  });
  const a = pistolRecoil(0.17);
  assert.ok(a.kick > 0 && a.slide > 0 && a.flash);
  assert.equal(pistolRecoil(0.01).flash, false);
});
test("combat stats and unrelated simulation retain their prior source outside arrow recovery and silent hand swings", () => {
  const hashes = JSON.parse(
    readFileSync(
      new URL("../reference/weapon-gameplay-2.7.15.json", import.meta.url),
    ),
  );
  for (const [file, h] of Object.entries(hashes)) {
    if(["src/data.js","src/models.js","src/textures.js","src/audio.js","src/soundscape.js","src/hostile-combat.js","src/weather.js"].includes(file))continue; // 2.20 End content; see end-compatibility.test.js.
    if (["src/main.js", "src/multiplayer.js", "src/physics.js", "src/coop-survival.js", "src/equipment.js", "src/simulation.js", "src/ecology.js", "src/aquatic.js", "src/realms.js", "src/relic.js", "src/invasion.js", "src/devils-palm.js", "src/rift-trial.js"].includes(file)) continue; // 2.7.18 adds saved/relayed embedded arrows and silent swings.
    let b = readFileSync(new URL("../" + file, import.meta.url));
    b = beforePlayerCopy(file, b);
    if (file === "src/data.js")
      b = Buffer.from(
        b
          .toString()
          .replace(
            /export const VERSION = "[^"]+"/,
            'export const VERSION = "2.7.15"',
          ),
      );
    assert.equal(sha(b), h, file);
  }
});

test("NPC bows, Guardian equipment and the Dread Knight blade use the same pixel source without changing creature bodies or stats", async () => {
  const { createMobModel } = await import("../src/models.js");
  const restore = mockCanvas();
  try {
    for (const [type, items] of [
      ["skeleton", ["bow"]],
      ["devin_guardian", ["golden_sword", "shield"]],
      ["dread_knight", ["hellfire_sword"]],
    ]) {
      const m = createMobModel({ type });
      let found = [];
      m.traverse((n) => {
        if (n.userData.weaponModel) found.push(n.userData.weaponModel);
      });
      for (const id of items) assert.ok(found.includes(id), type + " " + id);
      finite(m);
    }
  } finally {
    restore();
  }
});
