import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { auditTitanGlb } from "../scripts/audit-titan-glb.mjs";
import {
  importedRig,
  updateImportedSonic,
  updateImportedGiganto,
  disposeImportedRig,
  sonicSoleHeight,
} from "../src/titan-imports.js";
import { disposeTitanObject } from "../src/giganto-models.js";
import { titanSession } from "../src/giganto-simulation.js";
globalThis.self ||= globalThis;
globalThis.ProgressEvent ||= class ProgressEvent {
  constructor(type, init = {}) {
    this.type = type;
    Object.assign(this, init);
  }
};
const cache = {};
async function asset(role) {
  if (cache[role]) return cache[role];
  const b = fs.readFileSync(
      new URL(`../public/models/titan/${role}.glb`, import.meta.url),
    ),
    len = b.readUInt32LE(12),
    g = JSON.parse(b.subarray(20, 20 + len)),
    bin = b.subarray(28 + len);
  // Unit tests load the real geometry/skins/clips, omitting image decode only.
  // Browser tests parse the exact complete file, including all actual textures.
  const metadata = g.extras.dcsmRig,
    superIndex = g.extras.dcsmSuperMaterial;
  g.extensionsRequired = [];
  g.extensionsUsed = [];
  g.images = [];
  g.textures = [];
  for (const mat of g.materials) {
    for (const key of Object.keys(mat))
      if (key.endsWith("Texture")) delete mat[key];
    for (const key of Object.keys(mat.pbrMetallicRoughness || {}))
      if (key.endsWith("Texture")) delete mat.pbrMetallicRoughness[key];
  }
  for (const mesh of g.meshes)
    for (const pr of mesh.primitives) delete pr.extensions;
  g.buffers = [
    {
      byteLength: bin.length,
      uri: "data:application/octet-stream;base64," + bin.toString("base64"),
    },
  ];
  const gltf = await new GLTFLoader().parseAsync(JSON.stringify(g), "");
  const a = {
    role,
    gltf,
    metadata,
    superMaterial:
      role === "sonic"
        ? await gltf.parser.getDependency("material", superIndex)
        : undefined,
  };
  cache[role] = a;
  return a;
}
test("both finished GLBs pass real container, embedded image, skin, clip-name, socket and triangle-budget checks", () => {
  for (const role of ["sonic", "giganto"]) {
    const b = fs.readFileSync(
        new URL(`../public/models/titan/${role}.glb`, import.meta.url),
      ),
      r = auditTitanGlb(b, role);
    assert.equal(r.valid, true, JSON.stringify(r.errors));
    assert.ok(r.animationNames.length >= 20);
    assert.ok(r.images.every((i) => i.embedded));
    assert.ok(r.triangles < 60000);
  }
});
test("every real imported clip targets existing skinned joints with finite bounded deformation, including raised Super quills", async () => {
  for (const role of ["sonic", "giganto"]) {
    const a = await asset(role),
      r = importedRig(a),
      u = r.userData;
    let skinned = 0;
    r.traverse((o) => {
      if (o.isSkinnedMesh) {
        skinned++;
        const j = o.geometry.attributes.skinIndex,
          w = o.geometry.attributes.skinWeight;
        for (let i = 0; i < j.count; i++) {
          let sum = 0;
          for (let k = 0; k < 4; k++) {
            const n = j.array[i * 4 + k],
              v = w.array[i * 4 + k];
            assert.ok(n < o.skeleton.bones.length);
            assert.ok(v >= 0 && Number.isFinite(v));
            sum += v;
          }
          assert.ok(Math.abs(sum - 1) < 0.002);
        }
      }
    });
    assert.ok(skinned > 0);
    for (const clip of a.gltf.animations) {
      u.mixer.stopAllAction();
      const action = u.mixer.clipAction(clip);
      action.reset().play();
      for (const t of [0, clip.duration * 0.5, clip.duration * 0.97]) {
        u.mixer.setTime(t);
        r.updateMatrixWorld(true);
        const box = new T.Box3();
        r.traverse((o) => {
          if (o.isSkinnedMesh) {
            o.skeleton.update();
            o.computeBoundingBox();
            box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld));
          }
        });
        assert.ok(
          [...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite),
          role + " " + clip.name,
        );
        const size = box.getSize(new T.Vector3());
        assert.ok(
          size.length() < (role === "sonic" ? 9 : 190),
          role + " " + clip.name + " " + size.toArray(),
        );
      }
    }
    disposeImportedRig(r);
  }
});
test("Sonic changes animation and blue/gold materials without moving the simulated avatar, and restores the base pose after held parry", async () => {
  const r = importedRig(await asset("sonic")),
    s = titanSession({ drain: 0 });
  const before = JSON.stringify(s);
  updateImportedSonic(r, s, 1 / 60);
  assert.equal(JSON.stringify(s), before);
  assert.equal(r.userData.currentClip, "idle");
  s.stage = "transform";
  s.emerald = true;
  updateImportedSonic(r, s, 1 / 60);
  assert.equal(r.userData.super, false);
  s.stageTime = 4.25;
  updateImportedSonic(r, s, 1 / 60);
  assert.ok(r.userData.blueMaterials[0][1].userData.titanGold.value > 0);
  assert.ok(r.userData.blueMaterials[0][1].userData.titanGold.value < 1);
  s.stageTime = 4.5;
  updateImportedSonic(r, s, 1 / 60);
  assert.equal(r.userData.super, true);
  assert.equal(r.userData.currentClip, "transform");
  s.stage = "combat";
  s.parryHeld = true;
  updateImportedSonic(r, s, 1 / 60);
  assert.equal(r.userData.currentClip, "parry");
  s.parryHeld = false;
  s.action = "punch";
  s.actionTime = 0.2;
  updateImportedSonic(r, s, 1 / 60);
  assert.match(r.userData.currentClip, /attack_/);
  s.stage = "traversal";
  s.emerald = false;
  s.action = "idle";
  updateImportedSonic(r, s, 1 / 60);
  assert.equal(r.userData.super, false);
  disposeImportedRig(r);
});
test("Giganto arm windup/strike and beam/grab poses follow the existing attack clock and animated sockets remain attached", async () => {
  const r = importedRig(await asset("giganto")),
    s = titanSession({ drain: 0 });
  s.stage = "combat";
  s.emerald = true;
  for (const [attack, time, clip] of [
    ["swing", 0.5, "arm_swing_windup"],
    ["swing", 1.6, "arm_swing"],
    ["slap", 0.4, "arm_slap_windup"],
    ["slap", 1.3, "arm_slap"],
    ["crunch", 0.5, "grab_windup"],
    ["crunch", 2, "grab"],
    ["beam", 0.5, "beam_charge"],
  ]) {
    s.attack = attack;
    s.attackTime = time;
    updateImportedGiganto(r, s, 1 / 60);
    assert.equal(r.userData.currentClip, clip);
  }
  s.qte = { kind: "beam", left: 3 };
  updateImportedGiganto(r, s, 1 / 60);
  assert.equal(r.userData.currentClip, "beam_fire");
  r.updateMatrixWorld(true);
  assert.ok(
    r.userData.jawSocket
      .getWorldPosition(new T.Vector3())
      .toArray()
      .every(Number.isFinite),
  );
  assert.equal(r.userData.laserSockets.filter(Boolean).length, 10);
  const original = JSON.stringify(s);
  s.phase = 2;
  s.stage = "phase";
  updateImportedGiganto(r, s, 1 / 60);
  assert.equal(r.userData.currentClip, "awakening");
  s.stage = "finale";
  updateImportedGiganto(r, s, 1 / 60);
  assert.equal(r.userData.currentClip, "finale_brace");
  disposeImportedRig(r);
});
test("forked encounters own independent skeletons, mixers and materials while sharing bounded cached mesh resources", async () => {
  const a = await asset("sonic"),
    r = importedRig(a),
    q = importedRig(a);
  assert.notEqual(r.userData.bones.head, q.userData.bones.head);
  assert.notEqual(r.userData.materials[0], q.userData.materials[0]);
  const s = titanSession({ drain: 0 });
  s.emerald = true;
  s.stage = "combat";
  s.action = "punch";
  s.actionTime = 0.12;
  for (let n = 0; n < 30; n++) updateImportedSonic(r, s, 1 / 60);
  assert.equal(q.userData.super, false);
  let materialDisposals = 0;
  for (const material of r.userData.materials)
    material.addEventListener("dispose", () => materialDisposals++);
  disposeImportedRig(r);
  disposeTitanObject(r);
  assert.equal(materialDisposals, r.userData.materials.length);
  disposeImportedRig(q);
  disposeTitanObject(q);
});

test("locomotion/attack blends keep bind limb scales and bounded active actions at 30, 60 and 144 FPS", async () => {
  for (const rate of [30, 60, 144]) {
    const r = importedRig(await asset("sonic")),
      s = titanSession({ drain: 0 }),
      u = r.userData;
    s.stage = "combat";
    s.emerald = true;
    s.avatar.y = 57;
    for (let i = 0; i < rate * 4; i++) {
      s.time = i / rate;
      s.avatar.vz = i % rate < rate / 2 ? 30 : 0;
      s.avatar.onGround = i < rate;
      s.action = i % Math.ceil(rate / 3) < rate / 6 ? "punch" : "idle";
      s.actionTime = 0.2;
      s.strike = s.action === "punch" ? { hand: "R", duration: 0.32 } : null;
      updateImportedSonic(r, s, 1 / rate);
      for (const [bone, scale] of u.bindScales)
        assert.ok(bone.scale.distanceTo(scale) < 1e-8);
      assert.ok(
        [...u.actions.values()].filter((a) => a.isScheduled()).length <= 3,
      );
      if (i % Math.ceil(rate / 4) === 0) {
        r.updateMatrixWorld(true);
        const box = new T.Box3();
        r.traverse((o) => {
          if (o.isSkinnedMesh) {
            o.skeleton.update();
            o.computeBoundingBox();
            box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld));
          }
        });
        const size = box
          .getSize(new T.Vector3())
          .multiplyScalar(s.config.colossalScale ? s.config.titanScale : 1);
        assert.ok(
          size.y > 2.6 && size.y < 5,
          `${rate} ${u.currentClip}: ${size.y}`,
        );
      }
    }
    disposeImportedRig(r);
  }
});
test("procedural IK cannot accumulate on an unchanged or paused animation sample", async () => {
  for (const role of ["sonic", "giganto"]) {
    const r = importedRig(await asset(role)),
      s = titanSession({ drain: 0 }),
      update = role === "sonic" ? updateImportedSonic : updateImportedGiganto;
    s.stage = "combat";
    s.emerald = true;
    s.parryHeld = true;
    s.avatar.y = 57;
    s.avatar.z = 25;
    for (let i = 0; i < 25; i++) update(r, s, 1 / 60);
    const bones = Object.values(r.userData.bones),
      before = bones.map((b) => b.quaternion.clone());
    for (let i = 0; i < 100; i++) update(r, s, 0);
    bones.forEach((b, i) =>
      assert.ok(
        b.quaternion
          .toArray()
          .every((v, j) => Math.abs(v - before[i].toArray()[j]) < 0.00001),
        `${role} ${b.name}: ${b.quaternion.toArray()} / ${before[i].toArray()}`,
      ),
    );
    disposeImportedRig(r);
  }
});
test("runtime homing, Cross Slash and left/right stomp clips animate the existing skeleton without adding meshes", async () => {
  for (const role of ["sonic", "giganto"]) {
    const r = importedRig(await asset(role)),
      u = r.userData,
      names =
        role === "sonic"
          ? ["homing_attack", "cross_slash"]
          : ["stomp_L", "stomp_R"];
    const count = () => {
        let n = 0;
        r.traverse((o) => {
          if (o.isMesh) n++;
        });
        return n;
      },
      meshes = count();
    for (const name of names) {
      const clip = u.actions.get(name).getClip();
      assert.ok(clip.tracks.length > 5);
      assert.ok(clip.tracks.every((t) => t.name.endsWith(".quaternion")));
      assert.ok(clip.tracks.some((t) => new Set(t.values).size > 4));
      u.mixer.stopAllAction();
      const a = u.actions.get(name);
      a.reset().setEffectiveWeight(1).play();
      u.mixer.setTime(clip.duration * 0.45);
      r.updateMatrixWorld(true);
      assert.equal(count(), meshes);
      for (const bone of Object.values(u.bones))
        assert.ok(bone.quaternion.toArray().every(Number.isFinite));
    }
    disposeImportedRig(r);
  }
});

test("both stomp plants bring the imported ankle back to the real sole height and the shockwave origin", async () => {
  const { titanStompWave } = await import("../src/titan-contact.js");
  for (const side of ["L", "R"]) {
    const r = importedRig(await asset("giganto")),
      s = titanSession({ drain: 0 });
    Object.assign(s, {
      stage: "combat",
      attack: "stomp",
      swatSide: side,
      attackTime: 1.95,
    });
    s.avatar.z = 25;
    const ankle = r.userData.model.getObjectByName(
      side === "L" ? "Foot_L_092" : "Foot_R_098",
    );
    for (let i = 0; i < 30; i++) updateImportedGiganto(r, s, 1 / 60);
    const p = ankle.getWorldPosition(new T.Vector3()),
      wave = titanStompWave(s);
    assert.ok(wave.active);
    assert.ok(Math.abs(p.y - 1.48) < 0.18, p.toArray());
    assert.ok(
      Math.hypot(p.x - wave.center.x, p.z - wave.center.z) < 0.18,
      p.toArray(),
    );
    disposeImportedRig(r);
  }
});

test("a moving/turning imported Titan plants its feet and keeps both knee hit regions aligned", async () => {
  const { beginTitanStep } = await import("../src/titan-mobility.js"),
    { titanBodyRegions, titanFootPath } = await import(
      "../src/titan-contact.js"
    );
  const { stepTitan } = await import("../src/giganto-simulation.js");
  const r = importedRig(await asset("giganto")),
    s = titanSession({ drain: 0 });
  s.stage = "combat";
  s.emerald = true;
  s.idle = 999;
  s.avatar.x = 50;
  s.avatar.z = 35;
  Object.assign(s.boss, { x: 15, z: -8, yaw: 0.2 });
  beginTitanStep(s);
  for (let i = 0; i < 170; i++) {
    stepTitan(s, {}, 1 / 60);
    updateImportedGiganto(r, s, 1 / 60);
    assert.equal(r.position.x, s.boss.x);
    assert.equal(r.rotation.y, s.boss.yaw);
    if (!s.boss.walk || i % 12) continue;
    for (const side of ["L", "R"]) {
      const foot = r.userData.footBindings
          .get(side)
          .foot.getWorldPosition(new T.Vector3()),
        target = titanFootPath(s, side),
        knee = r.userData.bones["knee" + side].getWorldPosition(
          new T.Vector3(),
        ),
        region = titanBodyRegions(s).find((q) => q.id === side + " shin");
      assert.ok(
        foot.distanceTo(new T.Vector3(target.x, target.y, target.z)) < 0.2,
        `${side} ${i}: ${foot.toArray()} / ${JSON.stringify(target)} hip ${r.userData.bones["leg" + side].getWorldPosition(new T.Vector3()).toArray()}`,
      );
      assert.ok(
        knee.distanceTo(new T.Vector3(region.a.x, region.a.y, region.a.z)) <
          0.3,
        `${side} ${i}: ${knee.toArray()} / ${JSON.stringify(region.a)}`,
      );
    }
  }
  disposeImportedRig(r);
});

test("cinematic struggle, contact and finisher poses retain original mesh counts, bind scales, airborne defeat limbs and stable paused joints", async () => {
  const { makeTitanCounter, TITAN_FINALE } = await import(
      "../src/titan-cinematics.js"
    ),
    { nearestTitanSurface, titanFinalePosition } = await import(
      "../src/titan-contact.js"
    );
  const sonic = importedRig(await asset("sonic")),
    boss = importedRig(await asset("giganto")),
    s = titanSession({ drain: 0 });
  Object.assign(s, { stage: "combat", emerald: true, phase: 2 });
  Object.assign(s.avatar, { x: 0, y: 57, z: 5 });
  const counts = new Map();
  for (const r of [sonic, boss]) {
    let n = 0;
    r.traverse((o) => {
      if (o.isMesh) n++;
    });
    counts.set(r, n);
  }
  s.qte = { kind: "beam", left: 2, hits: 0, need: 8 };
  for (let i = 0; i < 15; i++) updateImportedSonic(sonic, s, 1 / 60);
  assert.equal(sonic.userData.currentClip, "brace_beam");
  s.qte = null;
  s.counterScene = makeTitanCounter(
    s,
    "beam",
    nearestTitanSurface(s, { ...s.avatar, y: s.avatar.y + 1.8 }),
  );
  const { titanCounterPosition, titanCounterContact } = await import(
    "../src/titan-cinematics.js"
  );
  s.counterScene.elapsed = 0.85;
  Object.assign(s.avatar, titanCounterPosition(s));
  for (let i = 0; i < 15; i++) updateImportedSonic(sonic, s, 1 / 60);
  const kick = sonic.userData.model
      .getObjectByName("LeftFoot")
      .getWorldPosition(new T.Vector3()),
    contact = titanCounterContact(s).point;
  assert.ok(
    kick.distanceTo(new T.Vector3(contact.x, contact.y, contact.z)) < 0.3,
    `${kick.toArray()} / ${JSON.stringify(contact)}`,
  );
  s.counterScene = null;
  s.stage = "finale";
  s.stageTime = TITAN_FINALE.contact;
  s.cinematicFrom = { x: 0, y: 57, z: 5 };
  Object.assign(s.avatar, titanFinalePosition(s.cinematicFrom, s.stageTime, s));
  for (let i = 0; i < 15; i++) {
    updateImportedSonic(sonic, s, 1 / 60);
    updateImportedGiganto(boss, s, 1 / 60);
  }
  assert.equal(sonic.userData.currentClip, "boost_flight");
  assert.equal(boss.userData.currentClip, "finale_collapse");
  const end = sonic.userData.model
    .getObjectByName("RightFoot")
    .getWorldPosition(new T.Vector3());
  assert.ok(
    sonic.position.distanceTo(
      new T.Vector3(s.avatar.x, s.avatar.y + 0.12, s.avatar.z),
    ) < 0.05,
  );
  assert.ok(end.toArray().every(Number.isFinite));
  s.stageTime = 6;
  Object.assign(s.avatar, titanFinalePosition(s.cinematicFrom, 6, s));
  for (let i = 0; i < 15; i++) {
    updateImportedGiganto(boss, s, 1 / 60);
    updateImportedSonic(sonic, s, 1 / 60);
  }
  for (const side of ["L", "R"]) {
    const p = boss.userData.footBindings
      .get(side)
      .foot.getWorldPosition(new T.Vector3());
    assert.ok(p.toArray().every(Number.isFinite) && p.y > 3, p.toArray());
  }
  for (const root of [sonic, boss]) {
    let meshes = 0;
    root.traverse((o) => {
      if (o.isMesh) meshes++;
    });
    assert.equal(meshes, counts.get(root));
    for (const [bone, scale] of root.userData.bindScales)
      assert.deepEqual(bone.scale.toArray(), scale.toArray());
    const poses = Object.values(root.userData.bones).map((b) =>
      b.quaternion.toArray(),
    );
    for (let i = 0; i < 30; i++) {
      if (root === sonic) updateImportedSonic(root, s, 0);
      else updateImportedGiganto(root, s, 0);
    }
    assert.ok(
      Object.values(root.userData.bones).every((b, i) =>
        b.quaternion
          .toArray()
          .every((q, j) => Math.abs(q - poses[i][j]) < 0.0001),
      ),
    );
    disposeImportedRig(root);
  }
});

test("a finisher interrupted from walking lifts the defeated body with stable finite feet", async () => {
  const { beginTitanStep } = await import("../src/titan-mobility.js"),
    { stepTitan } = await import("../src/giganto-simulation.js");
  const r = importedRig(await asset("giganto")),
    s = titanSession({ drain: 0 });
  Object.assign(s, { stage: "combat", emerald: true, idle: 999 });
  Object.assign(s.avatar, { x: 50, y: 57, z: 35 });
  beginTitanStep(s);
  for (let i = 0; i < 60; i++) stepTitan(s, {}, 1 / 60);
  assert.ok(s.boss.walk);
  s.stage = "finale";
  s.stageTime = 6;
  for (let i = 0; i < 20; i++) updateImportedGiganto(r, s, 1 / 60);
  for (const side of ["L", "R"]) {
    const p = r.userData.footBindings
      .get(side)
      .foot.getWorldPosition(new T.Vector3());
    assert.ok(
      p.toArray().every(Number.isFinite) && p.y > 3,
      `${side}: ${p.toArray()}`,
    );
  }
  disposeImportedRig(r);
});

test("jump/fall animation clocks start at entry even late in a trial, and paused sampling freezes them", async () => {
  const r = importedRig(await asset("sonic")),
    s = titanSession({ climbMode: "ruins" });
  s.stage = "traversal";
  s.time = 200;
  Object.assign(s.avatar, { y: 5, onGround: false, vy: 12, vx: 0, vz: 0 });
  updateImportedSonic(r, s, 1 / 60);
  assert.equal(r.userData.currentClip, "jump_spin");
  assert.equal(r.userData.body.time, 0);
  s.time += 0.2;
  updateImportedSonic(r, s, 0.2);
  assert.ok(Math.abs(r.userData.body.time - 0.2) < 1e-6);
  const clock = r.userData.body.time;
  updateImportedSonic(r, s, 0);
  assert.equal(r.userData.body.time, clock);
  s.time += 0.05;
  s.avatar.vy = -3;
  updateImportedSonic(r, s, 1 / 60);
  assert.equal(r.userData.currentClip, "jump_fall");
  assert.equal(r.userData.body.time, 0);
  disposeImportedRig(r);
});
test("Super Sonic only selects boost flight during actual boosting, including after fast knockback", async () => {
  const r = importedRig(await asset("sonic")),
    s = titanSession();
  s.stage = "combat";
  s.emerald = true;
  s.avatar.onGround = false;
  s.avatar.y = 57;
  s.avatar.vx = 40;
  s.boosting = false;
  updateImportedSonic(r, s, 1 / 60);
  assert.ok(
    ["flight_left", "flight_right", "flight_forward"].includes(
      r.userData.currentClip,
    ),
  );
  s.boosting = true;
  s.time += 0.1;
  updateImportedSonic(r, s, 0.1);
  assert.equal(r.userData.currentClip, "boost_flight");
  s.boosting = false;
  s.time += 0.1;
  updateImportedSonic(r, s, 0.1);
  assert.ok(
    ["flight_left", "flight_right", "flight_forward"].includes(
      r.userData.currentClip,
    ),
  );
  disposeImportedRig(r);
});
test("interrupted pose transitions preserve the displayed pre-IK pose, leave bounded actions, and never change bind scales", async () => {
  for (const role of ["sonic", "giganto"]) {
    const r = importedRig(await asset(role)),
      u = r.userData,
      s = titanSession();
    s.stage = "combat";
    s.emerald = true;
    s.avatar.y = 57;
    const update =
      role === "sonic" ? updateImportedSonic : updateImportedGiganto;
    for (let i = 0; i < 24; i++) {
      s.time += 1 / 60;
      update(r, s, 1 / 60);
    }
    for (let i = 0; i < 12; i++) {
      if (role === "sonic") {
        s.action = i % 2 ? "dodge" : "shot";
        s.actionTime = i % 2 ? 0.3 : 0.9;
        s.strike = null;
      } else {
        s.attack = i % 2 ? "swing" : "slap";
        s.attackTime = 0.2;
      }
      const before = new Map(
        [...u.displayPose].map(([b, p]) => [b, p.q.clone()]),
      );
      update(r, s, 0);
      for (const [b, q] of before)
        if (!u.layeredBones.has(b))
          assert.ok(
            q
              .clone()
              .normalize()
              .angleTo(u.displayPose.get(b).q.clone().normalize()) < 1e-6,
            role + " " + b.name,
          );
      s.time += 1 / 144;
      update(r, s, 1 / 144);
      assert.ok(
        [...u.actions.values()].filter((a) => a.isScheduled()).length <= 4,
      );
      for (const [b, scale] of u.bindScales)
        assert.ok(b.scale.distanceTo(scale) < 1e-8);
    }
    disposeImportedRig(r);
  }
});
test("a stationary climber carried by Giganto selects wall idle instead of a frozen running stride", async () => {
  const { climbFixture } = await import("./helpers/titan-climb-fixture.js");
  await climbFixture();
  const { stepTitan } = await import("../src/giganto-simulation.js");
  const r = importedRig(await asset("sonic")),
    s = titanSession();
  s.stage = "traversal";
  Object.assign(s.avatar, { x: 4.8, y: 0.05, z: -1.9 });
  for (let i = 0; i < 35; i++) stepTitan(s, { forward: true }, 1 / 60);
  assert.ok(s.climb.attached);
  assert.ok(s.climb.speed > 1);
  updateImportedSonic(r, s, 1 / 60);
  assert.equal(r.userData.currentClip, "wall_run");
  for (let i = 0; i < 60; i++) stepTitan(s, {}, 1 / 60);
  assert.equal(s.climb.speed, 0);
  assert.equal(s.action, "wall_idle");
  updateImportedSonic(r, s, 1 / 60);
  assert.equal(r.userData.currentClip, "wall_idle");
  disposeImportedRig(r);
});

test("guard IK eases in and out without advancing while paused or overriding a dodge", async () => {
  const r = importedRig(await asset("sonic")),
    s = titanSession();
  s.stage = "combat";
  s.emerald = true;
  Object.assign(s.avatar, { x: 0, y: 57, z: 25, onGround: false });
  updateImportedSonic(r, s, 1 / 60);
  s.parryHeld = true;
  s.time += 1 / 60;
  updateImportedSonic(r, s, 1 / 60);
  const first = r.userData.guardWeight;
  assert.ok(first > 0 && first < 0.3);
  for (let i = 0; i < 30; i++) {
    s.time += 1 / 60;
    updateImportedSonic(r, s, 1 / 60);
  }
  assert.ok(r.userData.guardWeight > 0.99);
  const held = r.userData.guardWeight;
  updateImportedSonic(r, s, 0);
  assert.equal(r.userData.guardWeight, held);
  s.parryHeld = false;
  s.time += 1 / 60;
  updateImportedSonic(r, s, 1 / 60);
  assert.ok(r.userData.guardWeight < held && r.userData.guardWeight > 0.5);
  s.parryHeld = true;
  s.action = "dodge";
  s.actionTime = 0.3;
  s.time += 1 / 60;
  updateImportedSonic(r, s, 1 / 60);
  assert.equal(r.userData.currentClip, "dodge");
  assert.ok(r.userData.guardWeight < held);
  disposeImportedRig(r);
});
test("double-sweep uses its own torso clip and rendered hand recovery starts continuously at the last contact pose", async () => {
  const r = importedRig(await asset("giganto")),
    s = titanSession();
  s.stage = "combat";
  s.emerald = true;
  s.attack = "sweep";
  s.attackTime = 3.23;
  s.time = 200;
  for (let i = 0; i < 20; i++) updateImportedGiganto(r, s, 1 / 60);
  assert.equal(r.userData.currentClip, "double_sweep");
  r.updateMatrixWorld(true);
  const before = Object.fromEntries(
    ["L", "R"].map((side) => [
      side,
      r.userData.bones["hand" + side].getWorldPosition(new T.Vector3()),
    ]),
  );
  s.attack = "idle";
  s.attackTime = 0;
  s.time += 1 / 60;
  updateImportedGiganto(r, s, 1 / 60);
  r.updateMatrixWorld(true);
  for (const side of ["L", "R"])
    assert.ok(
      r.userData.bones["hand" + side]
        .getWorldPosition(new T.Vector3())
        .distanceTo(before[side]) < 0.15,
      side,
    );
  const held = r.userData.bones.handL.getWorldPosition(new T.Vector3());
  updateImportedGiganto(r, s, 0);
  r.updateMatrixWorld(true);
  assert.ok(
    r.userData.bones.handL.getWorldPosition(new T.Vector3()).distanceTo(held) <
      0.001,
  );
  for (let i = 0; i < 40; i++) {
    s.time += 1 / 60;
    updateImportedGiganto(r, s, 1 / 60);
  }
  r.updateMatrixWorld(true);
  assert.ok(
    r.userData.bones.handL
      .getWorldPosition(new T.Vector3())
      .distanceTo(before.L) > 3,
  );
  disposeImportedRig(r);
});

test("normal Sonic boosts with both hands behind his torso, eases the arm correction and never moves the physical avatar", async () => {
  for (const hz of [30, 60, 144]) {
    const r = importedRig(await asset("sonic")),
      s = titanSession({ drain: 0 });
    s.stage = "traversal";
    Object.assign(s.avatar, {
      x: 50,
      y: 0,
      z: 30,
      vx: 0,
      vz: 30,
      onGround: true,
      yaw: Math.PI,
    });
    s.boosting = true;
    const before = JSON.stringify(s);
    for (let i = 0; i < hz; i++) updateImportedSonic(r, s, 1 / hz);
    assert.equal(JSON.stringify(s), before);
    assert.equal(r.userData.currentClip, "boost_run");
    r.updateMatrixWorld(true);
    for (const side of ["L", "R"]) {
      const p = r.worldToLocal(
        r.userData.bones["hand" + side].getWorldPosition(new T.Vector3()),
      );
      assert.ok(
        p.z < -0.2,
        JSON.stringify({
          hz,
          side,
          p,
          bones: ["armL", "elbowL", "handL"].map((k) => [
            k,
            r.worldToLocal(
              r.userData.bones[k].getWorldPosition(new T.Vector3()),
            ),
          ]),
        }),
      );
      assert.ok(p.y < 2.5, JSON.stringify(p));
      const shoulder = r.worldToLocal(
        r.userData.bones["arm" + side].getWorldPosition(new T.Vector3()),
      );
      assert.ok(shoulder.z - p.z > 0.6, JSON.stringify({ shoulder, p }));
    }
    r.updateMatrixWorld(true);
    assert.ok(sonicSoleHeight(r.userData) >= s.avatar.y + 0.01999);
    assert.ok(r.userData.groundOffset < 0.4);
    const w = r.userData.boostArmWeight;
    updateImportedSonic(r, s, 0);
    assert.equal(r.userData.boostArmWeight, w);
    s.boosting = false;
    s.avatar.vz = 0;
    updateImportedSonic(r, s, 1 / hz);
    assert.ok(r.userData.boostArmWeight > 0 && r.userData.boostArmWeight < w);
    for (let i = 0; i < hz; i++) updateImportedSonic(r, s, 1 / hz);
    assert.equal(r.userData.currentClip, "idle");
    assert.ok(
      Math.abs(r.position.x - s.avatar.x) < 1e-6 &&
        Math.abs(r.position.z - s.avatar.z) < 1e-6,
    );
    disposeImportedRig(r);
  }
});

test("combo kicks and Grand Slam use distinct contact-timed clips, keep scale and never leave an unposed transition frame", async () => {
  const r = importedRig(await asset("sonic")),
    s = titanSession({ drain: 0 });
  s.stage = "combat";
  s.emerald = true;
  Object.assign(s.avatar, { x: 0, y: 57, z: 30, onGround: false });
  updateImportedSonic(r, s, 1 / 60);
  for (const [move, name, at, duration] of [
    ["heavy", "combo_kick", 0.18, 0.4],
    ["finisher", "combo_finisher", 0.25, 0.55],
    ["counter", "grand_slam", 0.48, 1.2],
  ]) {
    s.action = move === "counter" ? "counter" : "punch";
    s.strike = { move, elapsed: at, duration };
    s.actionTime = duration - at;
    const before = new Map(
      [...r.userData.displayPose].map(([b, p]) => [b, p.q.clone()]),
    );
    updateImportedSonic(r, s, 0);
    for (const [b, q] of before)
      if (!r.userData.layeredBones.has(b))
        assert.ok(
          q
            .clone()
            .normalize()
            .angleTo(r.userData.displayPose.get(b).q.clone().normalize()) <
            1e-6,
        );
    for (let i = 0; i < 15; i++) updateImportedSonic(r, s, 1 / 60);
    assert.equal(r.userData.currentClip, name);
    for (const [b, scale] of r.userData.bindScales)
      assert.ok(b.scale.distanceTo(scale) < 1e-8);
  }
  s.strike = null;
  s.action = "idle";
  s.actionTime = 0;
  for (let i = 0; i < 30; i++) updateImportedSonic(r, s, 1 / 60);
  r.updateMatrixWorld(true);
  for (const side of ["L", "R"]) {
    const hand = r.worldToLocal(
      r.userData.bones["hand" + side].getWorldPosition(new T.Vector3()),
    );
    assert.ok(hand.y < 2.25, JSON.stringify(hand));
  }
  disposeImportedRig(r);
});

test("cold-loaded Sonic and both Homing Shot endpoints retain posed arms instead of exposing a bind T-pose", async () => {
  const r = importedRig(await asset("sonic")),
    s = titanSession();
  const check = () => {
    r.updateMatrixWorld(true);
    for (const side of ["L", "R"]) {
      const hand = r.worldToLocal(
          r.userData.bones["hand" + side].getWorldPosition(new T.Vector3()),
        ),
        arm = r.worldToLocal(
          r.userData.bones["arm" + side].getWorldPosition(new T.Vector3()),
        );
      assert.ok(
        arm.y - hand.y > 0.2,
        JSON.stringify({ side, arm, hand, clip: r.userData.currentClip }),
      );
    }
  };
  check();
  s.stage = "combat";
  s.emerald = true;
  s.action = "shot";
  Object.assign(s.avatar, { x: 50, y: 50, z: 50, onGround: false });
  for (const t of [0, 1.149999]) {
    s.actionTime = 1.15 - t;
    for (let i = 0; i < 30; i++) updateImportedSonic(r, s, 1 / 60);
    assert.equal(r.userData.currentClip, "homing_shot");
    check();
  }
  disposeImportedRig(r);
});

test("directional flight and every combat ability use finite full-body rotations without changing limb scales or adding meshes", async () => {
  const root = importedRig(await asset("sonic")),
    u = root.userData,
    s = titanSession();
  s.stage = "combat";
  s.emerald = true;
  Object.assign(s.avatar, { y: 57, z: 45, onGround: false });
  s.lock = false;
  const matrices = () => {
      let n = 0;
      root.traverse((o) => {
        if (o.isMesh) n++;
      });
      return n;
    },
    count = matrices();
  const names = [
    "fly",
    "flight_forward",
    "flight_rise",
    "flight_fall",
    "flight_left",
    "flight_right",
    "boost_flight",
    "attack_left",
    "attack_right",
    "combo_left",
    "combo_right",
    "combo_kick",
    "combo_finisher",
    "homing_attack",
    "homing_shot",
    "sonic_boom",
    "wild_rush",
    "quick_cyloop",
    "cross_slash",
    "grand_slam",
    "parry",
    "dodge",
    "damage",
  ];
  for (const name of names) {
    const a = u.actions.get(name);
    assert.ok(a, name);
    const clip = a.getClip();
    assert.ok(clip.tracks.length >= 11, name);
    assert.ok(clip.tracks.every((t) => t.name.endsWith(".quaternion")));
    for (const t of clip.tracks)
      assert.ok([...t.values].every(Number.isFinite), name);
  }
  const seen = new Set();
  for (const velocity of [
    [0, 0, 0],
    [0, 8, 0],
    [0, -8, 0],
    [0, 0, 17],
    [17, 0, 0],
    [-17, 0, 0],
  ]) {
    Object.assign(s.avatar, {
      vx: velocity[0],
      vy: velocity[1],
      vz: velocity[2],
      yaw: 0,
    });
    for (let i = 0; i < 40; i++) {
      s.time += 1 / 60;
      updateImportedSonic(root, s, 1 / 60);
    }
    seen.add(u.currentClip);
    for (const [bone, scale] of u.bindScales)
      assert.ok(bone.scale.equals(scale));
  }
  assert.ok(
    seen.has("fly") &&
      seen.has("flight_rise") &&
      seen.has("flight_fall") &&
      seen.has("flight_forward"),
  );
  assert.ok(seen.size >= 5);
  assert.equal(matrices(), count);
  disposeImportedRig(root);
  disposeTitanObject(root);
});

test('Super quills use one continuous head deformation, leave face vertices unchanged and never add skin scale',async()=>{
 const r=importedRig(await asset('sonic')),u=r.userData,s=titanSession();Object.assign(s,{stage:'combat',emerald:true});s.avatar.onGround=false;
 assert.ok(u.quillMorphs.length>0);
 for(const mesh of u.quillMorphs){const a=mesh.geometry.attributes.position,b=mesh.geometry.morphAttributes.position[0];
  for(let i=0;i<a.count;i++){assert.ok(Number.isFinite(b.getY(i)));assert.ok(Math.abs(b.getY(i)-a.getY(i))<3);if(a.getZ(i)>-0.1)assert.ok(Math.abs(b.getY(i)-a.getY(i))<1e-6);}
 }
 for(let i=0;i<45;i++){s.time+=1/60;updateImportedSonic(r,s,1/60);}
 assert.ok(u.quillMorphs.every(m=>m.morphTargetInfluences[0]>0.98));
 assert.ok([...u.bindScales].every(([b,scale])=>b.scale.distanceTo(scale)<1e-8));disposeImportedRig(r);
});
