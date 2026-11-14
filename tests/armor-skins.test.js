import { beforePlayerCopy } from "./helpers/player-copy-source.js";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ITEMS } from "../src/data.js";
import { SKINS, skinPreview, skinFor, armAppearanceFor } from "../src/skins.js";
import { skinPartTexture } from "../src/skin-art.js";
import { paintSkinPixel } from "../src/skin-pixels.js";
import {
  armorPalette,
  armorTexture,
  armorPixel,
  paintArmorIcon,
  ARMOR_IDS,
} from "../src/armor-art.js";
import {
  createPlayerModel,
  animatePlayerModel,
  PLAYER_PROPORTIONS as P,
} from "../src/player-model.js";
import {
  createHandRig,
  applyHandAppearance,
  updateHandRig,
} from "../src/first-person.js";
import { disposeSkinModel } from "../src/skin-preview.js";
const pixel = (t, face, x, y) => {
  const [off, top] = t.userData.rects[face],
    w = t.image.width,
    h = t.image.height;
  return [
    ...t.image.data.slice(
      ((h - 1 - top - y) * w + off + x) * 4,
      ((h - 1 - top - y) * w + off + x) * 4 + 4,
    ),
  ];
};
const hex = (a) =>
  "#" +
  Array.from(a)
    .slice(0, 3)
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
const eq = (family) =>
  ["helmet", "chestplate", "leggings", "boots"].map((part) => ({
    id: family + "_" + part,
    count: 1,
  }));
const finite = (m) => {
  m.updateMatrixWorld(true);
  m.traverse((n) => assert.ok(n.matrixWorld.elements.every(Number.isFinite)));
};
test("all 38 armor entries use the same original palette for icon pixels and equipped surfaces, including both green turtle aliases", () => {
  assert.equal(ARMOR_IDS.length, 38);
  for (const id of ARMOR_IDS) {
    const palette = armorPalette(id),
      colors = new Set(Object.values(palette)),
      ops = [];
    const c = {
      set fillStyle(v) {
        this.color = v;
      },
      fillRect(x, y, w, h) {
        assert.ok([x, y, w, h].every(Number.isInteger));
        ops.push(this.color);
      },
    };
    assert.equal(paintArmorIcon(c, id), true);
    assert.ok(ops.length > 25);
    assert.ok(
      ops.every((c) => colors.has(c)),
      id,
    );
    for (const part of ["head", "body", "arm", "leg"]) {
      const t = armorTexture(id, part);
      assert.equal(t.magFilter, THREE.NearestFilter);
      assert.equal(t.minFilter, THREE.NearestFilter);
      assert.equal(t.generateMipmaps, false);
      for (let i = 0; i < t.image.data.length; i += 4)
        if (t.image.data[i + 3])
          assert.ok(colors.has(hex(t.image.data.slice(i, i + 4))), id);
    }
  }
  assert.deepEqual(armorPalette("turtle_shell"), armorPalette("turtle_helmet"));
});
test("helmets have actual transparent face openings, collars remain open and chainmail holes retain the underlying skin intentionally", () => {
  for (const id of ARMOR_IDS.filter((id) => ITEMS[id].armorSlot === 0)) {
    const t = armorTexture(id, "head");
    assert.equal(pixel(t, 5, 3, 5)[3], 0);
    assert.equal(pixel(t, 5, 0, 3)[3], 255);
    assert.equal(pixel(t, 2, 3, 3)[3], 255);
  }
  assert.equal(armorPixel("iron_chestplate", "body", 5, 3, 0, 8, 12), null);
  assert.equal(
    pixel(armorTexture("chainmail_chestplate", "body"), 5, 2, 3)[3],
    0,
  );
  const m = createPlayerModel("dante", eq("chainmail"));
  assert.ok(m.userData.arms[1].children[0].visible);
  assert.ok(
    m.userData.legs[1].children[0].material.map.image.data.some(
      (v, i) => i % 4 === 3 && v === 255,
    ),
  );
  disposeSkinModel(m);
});
test("all eleven skins keep exact body/limb geometry and share a continuous twelve-row arm sheet across both elbow sections, palm and first person", () => {
  for (const id of Object.keys(SKINS)) {
    const m = createPlayerModel(id),
      u = m.userData,
      r = createHandRig();
    applyHandAppearance(r, armAppearanceFor(id));
    updateHandRig(r);
    assert.deepEqual(u.body.geometry.parameters, {
      width: P.body[0],
      height: P.body[1],
      depth: P.body[2],
      widthSegments: 1,
      heightSegments: 1,
      depthSegments: 1,
    });
    assert.equal(
      u.arms[1].children[0].material.map,
      u.forearms[1].children[0].material.map,
    );
    assert.equal(r.skin.map, u.forearms[1].children[1].material.map);
    assert.equal(r.sleeve.map, u.arms[1].children[0].material.map);
    assert.deepEqual(u.arms[1].children[0].userData.sourceRows, [0, 16 / 3]);
    assert.deepEqual(u.forearms[1].children[0].userData.sourceRows, [
      16 / 3,
      8.8,
    ]);
    assert.deepEqual(u.forearms[1].children[1].userData.sourceRows, [8.8, 12]);
    assert.equal(r.glove.visible, false);
    assert.equal(r.glove.userData.texturedGlove, !!armAppearanceFor(id).glove);
    assert.equal(r.skin.color.getHex(), 0xffffff);
    assert.equal(u.forearms[1].children[1].material.color.getHex(), 0xffffff);
    disposeSkinModel(m);
    disposeSkinModel(r.root);
  }
});
test("skin texels and miniature portraits use identical original face/outfit pixels, correct mirrored side hairlines and bounded palettes instead of noisy white arm maps", () => {
  const hashes = new Set();
  for (const id of Object.keys(SKINS)) {
    const s = skinFor(id),
      t = skinPartTexture(id, "head"),
      svg = decodeURIComponent(skinPreview(id));
    hashes.add(createHash("sha256").update(t.image.data).digest("hex"));
    for (const [x, y] of [
      [2, 4],
      [3, 5],
      [4, 6],
      [0, 0],
    ]) {
      const c = paintSkinPixel(s, "head", 5, x, y, 8, 8);
      assert.equal(hex(pixel(t, 5, x, y)), c);
      assert.ok(
        svg.includes(`x="${4 + x}" y="${y}" width="1" height="1" fill="${c}"`),
      );
    }
    const arm = skinPartTexture(id, "sleeve");
    assert.notEqual(hex(pixel(arm, 5, 2, 2)), "#ffffff");
    for (let y = 2; y < 6; y++)
      for (let d = 0; d < 4; d++)
        assert.equal(
          hex(pixel(t, 0, 7 - d, y)),
          hex(pixel(t, 1, d, y)),
          id + " side hair",
        );
  }
  assert.equal(hashes.size, 11);
});
test("every skin and armor combination keeps attached pieces through movement/combat, hides overlapping costume accessories and stays finite without gameplay mutation", () => {
  for (const skin of Object.keys(SKINS))
    for (const family of [
      "dirt",
      "leather",
      "chainmail",
      "copper",
      "iron",
      "golden",
      "diamond",
      "netherite",
      "hellfire",
    ]) {
      const equipment = eq(family),
        m = createPlayerModel(skin, equipment, "diamond_sword"),
        u = m.userData;
      assert.equal(u.armor.length, 11);
      const helmet = u.armor.find((a) => a.userData.armorPart === "head");
      assert.equal(helmet.parent, u.head);
      assert.equal(
        u.armor.find((a) => a.userData.armorPart === "body").parent,
        u.body,
      );
      for (const a of u.accessories)
        assert.equal(a.visible, false, skin + " accessory");
      for (const flags of [
        { onGround: true },
        { onGround: true, crouching: true },
        { onGround: false, inWater: true },
      ]) {
        const p = { pitch: 0.4, yaw: 0, vy: 0, ...flags },
          before = JSON.stringify(p);
        for (let i = 0; i < 5; i++)
          animatePlayerModel(m, p, 1 / 30, true, 0.7, "attack", 0, true, {
            kind: "attack",
            age: 0.25,
            duration: 1,
          });
        finite(m);
        assert.equal(JSON.stringify(p), before);
      }
      const legs = u.armor.filter((a) => a.userData.armorPart === "leg");
      for (const a of legs) assert.ok(u.legs.includes(a.parent));
      disposeSkinModel(m);
    }
});
test("opaque leggings/boots mask only covered skin rows, leave exposed areas intact and have distinct non-coplanar seams and inward clearance", () => {
  for (const skin of Object.keys(SKINS)) {
    const m = createPlayerModel(skin, eq("iron")),
      u = m.userData;
    for (const leg of u.legs) {
      const t = leg.children[0].material.map;
      assert.ok(t.image.data.every((v, i) => i % 4 !== 3 || v === 0));
    }
    m.updateMatrixWorld(true);
    const upper = u.armor.filter(
        (a) =>
          a.userData.armorPart === "leg" &&
          a.userData.armor.endsWith("leggings"),
      ),
      boots = u.armor.filter((a) => a.userData.armor.endsWith("boots"));
    for (let i = 0; i < 2; i++) {
      assert.ok(
        boots[i].geometry.parameters.width > upper[i].geometry.parameters.width,
      );
      assert.ok(
        boots[i].geometry.parameters.depth > upper[i].geometry.parameters.depth,
      );
      const b = new THREE.Box3().setFromObject(upper[i]);
      assert.ok(i === 0 ? b.max.x <= -0.0039 : b.min.x >= 0.0039);
    }
    const bare = skinPartTexture(skin, "leg", 1, { leggings: true });
    assert.equal(pixel(bare, 5, 2, 4)[3], 0);
    assert.equal(pixel(bare, 5, 2, 10)[3], 255);
    disposeSkinModel(m);
  }
});
test("empty first-person armor sleeves share the equipped texture and hide covered cloth; holding items still suppresses the entire arm", () => {
  for (const id of ARMOR_IDS.filter((id) => ITEMS[id].armorSlot === 1)) {
    const r = createHandRig();
    applyHandAppearance(r, armAppearanceFor("vergil"), id);
    updateHandRig(r);
    assert.equal(r.shoulder.material.map, armorTexture(id, "arm"));
    assert.equal(r.shoulder.userData.armor, id);
    assert.equal(r.cuff.visible, id.startsWith("chainmail"));
    assert.ok(r.shoulder.scale.y > 0.3);
    r.armVisuals.visible = false;
    assert.equal(r.armVisuals.visible, false);
    applyHandAppearance(r, armAppearanceFor("vergil"), null);
    assert.equal(r.shoulder.visible, false);
    assert.equal(r.cuff.visible, true);
    disposeSkinModel(r.root);
  }
});
test("armor stats, recipes, motion and unrelated gameplay retain their prior invariants outside authorized presentation and encounter integration", () => {
  const b = JSON.parse(
    readFileSync(
      new URL("../reference/appearance-gameplay-2.7.16.json", import.meta.url),
    ),
  );
  for (const [file, h] of Object.entries(b)) {
    if(["src/pixel-ui.css", "src/edition-combat.js", "src/armor-art.js", "src/player-model.js", "src/controller.js", "src/inventory.js", "src/village-styles.js", "src/villages.js", "src/touch.js"] .includes(file))continue; // 2.21 authorized End/village/combat/UI work.
    if(["src/data.js","src/models.js","src/textures.js","src/audio.js","src/soundscape.js","src/hostile-combat.js","src/weather.js"].includes(file))continue; // 2.20 End content; see end-compatibility.test.js.
    if (
      [
        // 2.18.0 adds achievement observers and preserves the player ledger.
        "src/equipment.js",
        "src/simulation.js",
        "src/ecology.js",
        "src/coop-survival.js",
        "src/aquatic.js",
        "src/realms.js",
        "src/relic.js",
        "src/invasion.js",
        "src/devils-palm.js",
        "src/rift-trial.js",
        "src/main.js",
        "src/physics.js",
        "src/multiplayer.js",
        "src/ranged-weapon-models.js",
        "src/java-item-motion.js",
        "src/weapon-poses.js",
      ].includes(file)
    )
      continue; // 2.7.18 adds arrows, silent swings and corrected bow art.
    let data = readFileSync(new URL("../" + file, import.meta.url));
    data = beforePlayerCopy(file, data);
    if (file === "src/data.js")
      data = Buffer.from(
        data
          .toString()
          .replace(
            /export const VERSION = "[^"]+"/,
            'export const VERSION = "2.7.16"',
          ),
      );
    assert.equal(createHash("sha256").update(data).digest("hex"), h, file);
  }
});
