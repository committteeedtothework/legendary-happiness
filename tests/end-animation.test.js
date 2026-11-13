import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { B } from "../src/data.js";
import { createWorldAnimation } from "../src/world-animation-models.js";
import { WorldAnimations } from "../src/world-animations.js";
import { dragoonHead } from "../src/end-hitboxes.js";
import { injectSurfaceAnimation } from "../src/surface-animation.js";
test("brewing animation follows real bottle/progress slots and stops bubbling when brewing finishes", () => {
  const scene = new T.Scene(),
    animations = new WorldAnimations(scene, {
      texture: new T.Texture(),
      pack: "renewed",
    });
  animations.setChunk("0,0", [{ x: 1, y: 1, z: 1, id: B.brewing_stand }]);
  const record = {
      progress: 30,
      slots: [{ id: "water_bottle" }, null, { id: "awkward_potion" }],
    },
    game = {
      active: true,
      running: true,
      settings: { particles: "all" },
      player: { x: 1, y: 1, z: 1 },
      world: { containers: { "1,1,1": record } },
      ui: { screen: "play" },
    };
  animations.update(game, 1 / 60, 1);
  const m = [...animations.models.values()][0];
  assert.equal(m.userData.bubbles.visible, true);
  assert.deepEqual(
    m.userData.liquids.map((x) => x.visible),
    [true, false, true],
  );
  const p = m.userData.bubbles.children[0].position.clone();
  animations.update(game, 1 / 60, 2);
  assert.ok(p.distanceTo(m.userData.bubbles.children[0].position) > 0);
  record.progress = 0;
  animations.update(game, 1 / 60, 3);
  assert.equal(m.userData.bubbles.visible, false);
  animations.clear();
  assert.equal(scene.children.length, 0);
});
test("the lowered perch head remains reachable above the central End floor in every heading", () => {
  for (let i = 0; i < 16; i++) {
    const h = dragoonHead({
      x: 0,
      y: 61.5,
      z: 0,
      yaw: (i * Math.PI) / 8,
      mode: "perch",
    });
    assert.ok(h.y > 61 && h.y < 64);
    assert.ok(Math.abs(Math.hypot(h.x, h.z) - 11) < 1e-6);
  }
});
test("surface shader is tile-local, keeps opacity for lava and supports a disabled animation path", () => {
  const shader = { uniforms: {}, fragmentShader: "#include <map_fragment>" },
    time = { value: 1 },
    enabled = { value: 0 };
  injectSurfaceAnimation(shader, time, enabled);
  assert.equal(shader.uniforms.endSurfaceTime, time);
  assert.equal(shader.uniforms.endSurfaceEnabled, enabled);
  assert.ok(shader.fragmentShader.includes("diffuseColor.a=1.0"));
  assert.ok(shader.fragmentShader.includes("step(h,flame)"));
  assert.ok(!shader.fragmentShader.includes("texture2D"));
});
