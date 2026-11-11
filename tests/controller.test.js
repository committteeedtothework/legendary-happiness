import test from "node:test";
import assert from "node:assert/strict";
import {
  controllerConfig,
  controllerFamily,
  readController,
  radialDeadzone,
  padGlyph,
  menuButtonNames,
} from "../src/controller-data.js";
const pad = (id = "Xbox", axes = [0, 0, 0, 0], on = []) => ({
  id,
  mapping: "standard",
  axes,
  buttons: Array.from({ length: 18 }, (_, i) => ({
    pressed: on.includes(i),
    value: on.includes(i) ? 1 : 0,
  })),
});
test("controller identities, manual profiles and platform menu conventions are deterministic", () => {
  for (const [id, f] of [
    ["054c-0ce6", "playstation"],
    ["Nintendo Switch Pro", "switch"],
    ["XInput 045e", "xbox"],
    ["USB Generic 1234", "generic"],
  ])
    assert.equal(controllerFamily(id), f);
  assert.equal(controllerFamily("Xbox", "switch"), "switch");
  assert.equal(padGlyph("playstation", "attack"), "□");
  assert.equal(padGlyph("switch", "jump"), "B");
  assert.equal(menuButtonNames("switch").confirm, "crouch");
  assert.equal(menuButtonNames("xbox").cancel, "crouch");
});
test("analog sticks retain partial speed, circular limits and finite output with noisy or missing devices", () => {
  assert.deepEqual(radialDeadzone(0.1, -0.1), { x: 0, y: 0 });
  const a = radialDeadzone(0.6, 0);
  assert.ok(a.x > 0.4 && a.x < 0.6);
  assert.equal(Math.hypot(...Object.values(radialDeadzone(1, 1))), 1);
  assert.deepEqual(readController(null).move, { x: 0, y: 0 });
  const r = readController(pad("Sony", [NaN, Infinity, 0.6, -0.6]));
  assert.deepEqual(r.move, { x: 0, y: 0 });
  assert.ok(r.look.x > 0 && r.look.y < 0);
  assert.equal(
    readController(pad("Sony", [0, 0, 0.6, -0.6]), { invertY: true }).look.y,
    -r.look.y,
  );
});
test("raw controllers support remapped buttons, axes, disabled bindings and axis triggers without corrupting defaults", () => {
  const cfg = controllerConfig({
    preset: "custom",
    moveX: 4,
    moveY: 5,
    leftTriggerAxis: 6,
    bindings: { jump: 17, attack: -1 },
  });
  const p = pad("odd", [0, 0, 0, 0, 0.8, -0.8, 1], [17, 2]);
  const r = readController(p, cfg);
  assert.equal(r.buttons.jump, true);
  assert.equal(r.buttons.attack, false);
  assert.equal(r.buttons.use, true);
  assert.ok(r.move.x > 0.6 && r.move.y < -0.6);
  assert.equal(readController(pad()).buttons.jump, false);
  const bad = controllerConfig({
    deadzone: 99,
    lookSensitivity: NaN,
    bindings: { jump: 999 },
    moveX: Infinity,
  });
  assert.equal(bad.deadzone, 0.45);
  assert.equal(bad.lookSensitivity, 2.6);
  assert.equal(bad.bindings.jump, 63);
  assert.equal(bad.moveX, 0);
  assert.deepEqual(controllerConfig(controllerConfig()), controllerConfig());
});
test("raw input handoff ignores a stationary held stick and reacts to a deliberate new movement or axis trigger", async () => {
  const { controllerActivity } = await import("../src/controller-data.js");
  const a = readController(pad("Xbox", [0.8, 0, 0, 0]));
  assert.equal(controllerActivity(null, a), true);
  assert.equal(controllerActivity(a, a), false);
  const noise = readController(pad("Xbox", [0.801, 0, 0, 0]));
  assert.equal(controllerActivity(a, noise), false);
  assert.equal(
    controllerActivity(a, readController(pad("Xbox", [0.4, 0, 0, 0]))),
    true,
  );
  const released = readController(pad("raw", [0, 0, 0, 0, -1]), {
      rightTriggerAxis: 4,
    }),
    held = readController(pad("raw", [0, 0, 0, 0, 1]), { rightTriggerAxis: 4 });
  assert.equal(controllerActivity(released, held), true);
});
test("slow deliberate movement can reclaim input from the handoff anchor without treating a held button as a fresh press", async () => {
  const { controllerActivity } = await import("../src/controller-data.js");
  const anchor = readController(pad("Xbox", [0.5, 0, 0, 0], [0]));
  let previous = anchor,
    activated = false;
  for (const v of [0.51, 0.52, 0.53, 0.54, 0.55, 0.56, 0.57, 0.58, 0.59, 0.6]) {
    const now = readController(pad("Xbox", [v, 0, 0, 0], [0]));
    activated ||= controllerActivity(previous, now, anchor);
    previous = now;
  }
  assert.equal(activated, true);
  const release = readController(pad("Xbox", [0.5, 0, 0, 0], []));
  assert.equal(
    controllerActivity(release, anchor, anchor),
    true,
    "re-press uses current button edges",
  );
});
