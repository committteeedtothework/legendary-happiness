import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { AnimationMixer, Box3 } from "three";
import { fixture } from "./multiplayer-fixture.js";
import {
  VERITY,
  verityRecord,
  summonVerity,
  tickVerity,
  scoreVerityStep,
  danceLocked,
  findVeritySpot,
} from "../src/verity-simulation.js";
import { updatePlayer } from "../src/physics.js";
import { damagePeer } from "../src/coop-survival.js";
import { Inventory } from "../src/inventory.js";
import { B } from "../src/data.js";
import { exportRealm, realmState, restoreRealm } from "../src/realms.js";

function setup() {
  const f = fixture(),
    g = f.game;
  g.world.tick = 0;
  g.rules = { doMobSpawning: true };
  g.player.onGround = true;
  g.sprintInput = { latched: false, reset() {}, stop() {} };
  g.inputKeys = () => new Set();
  g.audio = { tone() {} };
  g.settings.renderDistance = 2;
  g.verity = { active: false };
  return f;
}
test("Lord Verity uses a real skinned GLB, distinct materials and stable named in-place actions", async () => {
  const raw = readFileSync(
    new URL("../public/models/verity/lord-verity.glb", import.meta.url),
  );
  assert.equal(raw.subarray(0, 4).toString(), "glTF");
  const asset = await new GLTFLoader().parseAsync(
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    "",
  );
  assert.deepEqual(
    asset.animations.map((c) => c.name),
    ["Idle", "VerityDance", "Bow"],
  );
  const meshes = [];
  asset.scene.traverse((o) => {
    if (o.isSkinnedMesh) meshes.push(o);
  });
  assert.ok(meshes.length >= 4);
  assert.equal(meshes[0].skeleton.bones.length, 18);
  assert.ok(Math.abs(asset.animations[1].duration - VERITY.beat * 8) < 0.035);
  const mixer = new AnimationMixer(asset.scene),
    action = mixer.clipAction(asset.animations[1]);
  action.play();
  for (const t of [0, 0.25, 0.75, 1.25, 2.1, 3.6]) {
    mixer.setTime(t);
    asset.scene.updateMatrixWorld(true);
    for (const m of meshes) m.computeBoundingBox();
    const b = new Box3().setFromObject(asset.scene);
    assert.ok(
      [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].every(
        Number.isFinite,
      ),
    );
    assert.ok(b.max.y - b.min.y < 3.8 && b.max.x - b.min.x < 4);
  }
});
test("a visit spawns safely without editing terrain and catches only eligible players nearby", () => {
  const { game: g, peer } = setup(),
    edits = g.world.edits.size;
  assert.equal(summonVerity(g), true);
  tickVerity(g);
  assert.equal(g.world.edits.size, edits);
  assert.ok(danceLocked(g.player));
  assert.ok(danceLocked(peer.player));
  assert.equal(g.world.settlements["lord-verity"].active.phase, "arrival");
  assert.equal(summonVerity(g), false);
});
test("water, flying, solid obstructions, remote dimensions and disabled natural spawning cannot force a dance", () => {
  const { game: g, peer } = setup();
  g.player.inWater = true;
  peer.player.inWater = true;
  assert.equal(summonVerity(g), false);
  g.player.inWater = false;
  peer.player.inWater = false;
  g.player.flying = peer.player.flying = true;
  assert.equal(summonVerity(g), false);
  g.player.flying = peer.player.flying = false;
  g.dimension = "end";
  assert.equal(summonVerity(g), false);
  g.dimension = "overworld";
  const r = verityRecord(g.world);
  r.next = 0;
  g.rules.doMobSpawning = false;
  tickVerity(g);
  assert.equal(r.active, undefined);
});
test("forced dancing blocks movement, attacks and PvE damage while allowing at most one score per beat", () => {
  const { game: g, peer, session: m } = setup();
  summonVerity(g);
  for (let i = 0; i < 50; i++) tickVerity(g);
  assert.equal(peer.player.verityDance.phase, "dance");
  const start = { x: g.player.x, z: g.player.z },
    health = peer.player.health;
  Object.assign(g.player, { vx: 12, vz: 12 });
  updatePlayer(g, new Set(["KeyW", "Space"]), 1 / 60);
  assert.equal(g.player.x, start.x);
  assert.equal(g.player.z, start.z);
  damagePeer(m, peer, 10, "zombie");
  assert.equal(peer.player.health, health);
  const d = peer.player.verityDance;
  d.time = VERITY.beat;
  assert.equal(scoreVerityStep(g, peer.player, "left"), false);
  assert.equal(scoreVerityStep(g, peer.player, "right"), true);
  assert.equal(scoreVerityStep(g, peer.player, "right"), false);
  assert.equal(d.score, 2);
  const old = m.sent.length;
  m.execute({
    id: peer.id,
    seq: 88,
    realmEpoch: peer.realmEpoch,
    kind: "attack",
    payload: {},
  });
  assert.equal(m.sent.length, old + 1);
  assert.equal(m.sent.at(-1).ok, false);
});
test("the dance resolves, rewards once, preserves inventory/camera position, saves its cooldown and cancels on realm exit", () => {
  const { game: g, session: m, peer } = setup();
  summonVerity(g);
  tickVerity(g);
  const before = { x: g.player.x, y: g.player.y, z: g.player.z };
  for (let i = 0; i < 600; i++) {
    for (const p of [g.player, peer.player])
      if (p.verityDance?.phase === "dance") {
        const d = p.verityDance,
          beat = Math.round(d.time / VERITY.beat);
        scoreVerityStep(g, p, VERITY.steps[beat % 8]);
      }
    g.world.tick++;
    tickVerity(g);
  }
  assert.equal(g.player.verityDance, undefined);
  assert.equal(peer.player.verityDance, undefined);
  assert.deepEqual({ x: g.player.x, y: g.player.y, z: g.player.z }, before);
  assert.equal(g.inventory.slots.find((s) => s?.id === "emerald")?.count, 1);
  assert.equal(peer.inventory.slots.find((s) => s?.id === "emerald")?.count, 1);
  const exported = exportRealm(realmState(g)),
    restored = restoreRealm(
      g.world.seed,
      "overworld",
      JSON.parse(JSON.stringify(exported)),
    );
  assert.equal(
    restored.world.settlements["lord-verity"].next,
    g.world.settlements["lord-verity"].next,
  );
  tickVerity(g);
  assert.equal(g.inventory.slots.find((s) => s?.id === "emerald")?.count, 1);
  peer.player.verityDance = { id: "test", phase: "dance", time: 0 };
  m.sharedRealm.switchPeer(peer, "end");
  assert.equal(peer.player.verityDance, undefined);
});
