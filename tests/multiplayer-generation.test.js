import test from "node:test";
import assert from "node:assert/strict";
import { Multiplayer } from "../src/multiplayer.js";
import { World } from "../src/world.js";
function fixture() {
  const game = {
    resetControls() {
      this.controlsReset = true;
    },
    renderer: {
      setWorld(w) {
        this.world = w;
      },
      loadAround() {
        this.loaded = true;
      },
    },
    ui: { play() {}, toast() {} },
    resume() {
      this.resumed = true;
    },
  };
  const session = Object.create(Multiplayer.prototype);
  session.game = game;
  session.sessionReady = false;
  return { game, session };
}
function snapshot(generationVersion) {
  return {
    mode: "creative",
    dimension: "overworld",
    seed: "Shared generator check",
    name: "Shared world",
    difficulty: "normal",
    generationVersion,
    player: { x: 8.5, y: 200, z: 8.5 },
    spawn: { x: 8.5, y: 200, z: 8.5 },
    entities: [],
    drops: [],
    time: 6000,
    tickCount: 0,
  };
}
test("Creative guests can adopt the current terrain generator and every supported legacy world without losing building access", () => {
  const current = new World("shared").generationVersion;
  for (const version of [...new Set([2, 3, 4, 5, 6, 7, 8, current])]) {
    const { game, session } = fixture();
    session.adopt(snapshot(version));
    assert.equal(game.world.generationVersion, version);
    assert.equal(game.renderer.world, game.world);
    assert.equal(game.active, true);
    assert.equal(game.mode, "creative");
    assert.equal(game.player.flying, true);
    assert.equal(game.inventory.slots[0].id, "grass");
    assert.equal(game.inventory.slots[0].count, 64);
    assert.equal(game.controlsReset, true);
    assert.equal(game.resumed, true);
  }
});
test("shared-world admission rejects unsupported future generators and malformed world modes before touching local state", () => {
  const current = new World("shared").generationVersion;
  for (const change of [
    { generationVersion: current + 1 },
    { generationVersion: 1 },
    { generationVersion: 8.5 },
    { generationVersion: "9" },
    { mode: "adventure" },
    { dimension: "unknown" },
    { seed: null },
  ]) {
    const { game, session } = fixture();
    assert.throws(
      () => session.adopt({ ...snapshot(current), ...change }),
      /Unsupported shared world/,
    );
    assert.equal(game.world, undefined);
    assert.equal(game.controlsReset, undefined);
  }
});

test("Survival guests adopt personal inventory and saved health without Creative flight or catalog grants", () => {
  const { game, session } = fixture();
  session.adopt({
    ...snapshot(10),
    mode: "survival",
    player: { x: 8, y: 200, z: 8, health: 7, food: 9, xp: 3 },
    inventory: { slots: [{ id: "log", count: 2 }] },
  });
  assert.equal(game.mode, "survival");
  assert.equal(game.player.health, 7);
  assert.equal(game.player.food, 9);
  assert.equal(game.player.flying, false);
  assert.equal(game.inventory.slots[0].id, "log");
  assert.equal(game.inventory.slots[1], null);
});
