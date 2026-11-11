import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  titanSession,
  stepTitan,
  titanInput,
  restoreTitanSession,
  TITAN_MOVES,
} from "../src/giganto-simulation.js";
import { titanAtmosphere } from "../src/titan-atmosphere.js";
import {
  arenaMetres,
  arenaUnits,
  sonicLength,
  withArenaMetres,
} from "../src/titan-metrics.js";
import {
  TRANSFORM_EVENTS,
  EMERALD_COLORS,
  tickTransformation,
  sonicSuper,
  emeraldGeometry,
  TitanTransformationView,
} from "../src/titan-transformation.js";
import {
  freshTitanTactics,
  recordTitanPressure,
  updateTitanTactics,
  titanGuarding,
  titanRecovery,
  chooseTitanTactic,
} from "../src/titan-tactics.js";
import { TitanGroundFX } from "../src/titan-ground-fx.js";
import { arenaConfig } from "../src/titan-settings.js";
import { ageTitanEvents } from "../src/titan-timing.js";
const fight = () => {
  const s = titanSession({ drain: 0, cinematics: false });
  Object.assign(s, {
    stage: "combat",
    emerald: true,
    rings: 400,
    idle: 999,
    iframes: 0,
  });
  Object.assign(s.avatar, { x: 0, y: 57, z: 5 });
  return s;
};
const run = (s, seconds, input = {}, fps = 60) => {
  const events = [];
  for (let i = 0; i < Math.round(seconds * fps); i++) {
    stepTitan(s, input, 1 / fps);
    events.push(...s.events);
  }
  return events;
};
test("queued cinematic and transformation sounds carry their true age after fixed-step catch-up", () => {
  const s = { time: 10 };
  const events = [
    { type: "cinematic-cue", at: 9.8, age: 0.03 },
    { type: "transformation-cue", at: 9.9, age: 0.01 },
    { type: "shot", at: 9.95, age: 0 },
    { type: "hit", at: 9.8, amount: 34 },
  ];
  assert.equal(ageTitanEvents(s, events), events);
  assert.ok(Math.abs(events[0].age - 0.23) < 1e-8);
  assert.ok(Math.abs(events[1].age - 0.11) < 1e-8);
  assert.ok(Math.abs(events[2].age - 0.05) < 1e-8);
  assert.equal(events[3].age, undefined);
  assert.equal(events[3].amount, 34);
});
test("arena cycle is continuous, periodic, sim-clocked and independent of phase jumps and world settings", () => {
  const s = fight();
  s.config.arenaWeather = "clear";
  const day = titanAtmosphere(s);
  s.time = s.config.arenaDayLength*0.6;
  const night = titanAtmosphere(s);
  assert.equal(day.day, 1);
  assert.equal(night.day, 0);
  assert.ok(night.key > 1 && night.key < day.key);
  s.time = s.config.arenaDayLength;
  assert.ok(Math.abs(titanAtmosphere(s).phase - day.phase) < 1e-10);
  let before = titanAtmosphere(s);
  for (let t = 0; t < s.config.arenaDayLength; t += 0.1) {
    s.time = t;
    const a = titanAtmosphere(s);
    if (t > 0) {
      assert.ok(Math.abs(a.key - before.key) < 0.03);
      assert.ok(
        Math.hypot(
          a.dir.x - before.dir.x,
          a.dir.y - before.dir.y,
          a.dir.z - before.dir.z,
        ) < 0.1,
      );
    }
    before = a;
  }
  s.time = 80;
  s.config.arenaWeather = "auto";
  s.phase = 1;
  const weather = titanAtmosphere(s).weather;
  s.phase = 2;
  s.phaseStartedAt = 80;
  assert.equal(titanAtmosphere(s).weather, weather);
  s.config.dynamicSky = false;
  s.time = 999;
  assert.equal(titanAtmosphere(s).day, 1);
  const frozen = JSON.stringify(titanAtmosphere(s));
  assert.equal(JSON.stringify(titanAtmosphere(s)), frozen);
  assert.equal(
    arenaConfig({ arenaDayLength: 1, aggression: 99 }).arenaDayLength,
    600,
  );
  assert.equal(arenaConfig({ aggression: 99 }).aggression, 1.5);
});
test("colossal metres preserve Sonic size and project correctly; renderer state restores even after an exception", () => {
  const s = fight(); s.config.titanScale = 1.6;
  const
    scene = new T.Scene(),
    camera = new T.PerspectiveCamera(67, 16 / 9, 0.15, 1600),
    key = new T.DirectionalLight(),
    point = new T.PointLight("white", 3, 18);
  scene.fog = new T.FogExp2("gray", 0.001);
  scene.add(point, key, key.target);
  camera.position.set(2, 8, 30);
  camera.lookAt(0, 5, 0);
  camera.updateMatrixWorld();
  const p = new T.Vector3(0, 5, 0),
    ndc = p.clone().project(camera),
    near = camera.near,
    shadow = key.shadow.camera.far;
  assert.deepEqual(arenaUnits(s, arenaMetres(s, { x: 1, y: 95, z: 2 })), {
    x: 1,
    y: 95,
    z: 2,
  });
  assert.equal(sonicLength(s, 3.2) * 1.6, 3.2);
  assert.equal(arenaMetres(s, { x: 0, y: 95, z: 0 }).y, 152);
  assert.throws(
    () =>
      withArenaMetres(scene, camera, key, s, () => {
        assert.equal(scene.scale.x, 1.6);
        assert.equal(point.distance, 28.8);
        assert.ok(
          p.clone().multiplyScalar(1.6).project(camera).distanceTo(ndc) < 1e-8,
        );
        throw new Error("render failure");
      }),
    /render failure/,
  );
  assert.equal(scene.scale.x, 1);
  assert.equal(camera.near, near);
  assert.equal(key.shadow.camera.far, shadow);
  assert.equal(point.distance, 18);
  assert.equal(point.intensity, 3);
  assert.equal(scene.fog.density, 0.001);
  assert.ok(camera.position.distanceTo(new T.Vector3(2, 8, 30)) < 1e-8);
});
test("all six transformation contacts fire exactly once at 30/60/144 Hz and restore without replay", () => {
  for (const fps of [30, 60, 144]) {
    const s = fight(),
      events = [];
    s.stage = "transform";
    s.original = {};
    s.stageTime = 0;
    assert.equal(sonicSuper(s), false);
    for (let i = 0; i <= fps * 6; i++) {
      s.stageTime = i / fps;
      tickTransformation(s, (_, type, p) => events.push({ type, ...p }));
    }
    assert.deepEqual(
      events.map((e) => e.cue),
      TRANSFORM_EVENTS.map((e) => e[0]),
    );
    assert.equal(sonicSuper(s), true);
    const restored = restoreTitanSession(
      JSON.parse(JSON.stringify({ ...s, stageTime: 4 })),
    );
    const re = [];
    tickTransformation(restored, (_, type, p) => re.push(p));
    assert.equal(re.length, 0);
  }
});
test("seven distinct solid faceted gems spiral inward without mutating simulation or duplicating Sonic", () => {
  const geo = emeraldGeometry(),
    normals = geo.attributes.normal;
  assert.ok(!geo.index && geo.attributes.position.count > 100);
  for (let i = 0; i < normals.count; i++)
    assert.ok(
      Math.abs(new T.Vector3().fromBufferAttribute(normals, i).length() - 1) <
        1e-5,
    );
  geo.dispose();
  assert.equal(new Set(EMERALD_COLORS).size, 7);
  const scene = new T.Scene(),
    v = new TitanTransformationView(scene),
    s = fight(),
    sonic = new T.Group(),
    hand = new T.Object3D();
  sonic.add(hand);
  sonic.userData.bones = { handR: hand };
  sonic.position.set(0, 93, 0);
  scene.add(sonic);
  scene.updateMatrixWorld(true);
  s.stage = "transform";
  let orbit = 0;
  for (const time of [2.7, 4.2]) {
    s.stageTime = time;
    const before = JSON.stringify(s);
    v.update(s, sonic);
    assert.equal(JSON.stringify(s), before);
    assert.equal(v.gems.length, 7);
    assert.equal(v.group.visible, true);
    const r = v.gems.reduce(
      (n, g) =>
        n +
        Math.hypot(
          g.position.x - sonic.position.x,
          g.position.z - sonic.position.z,
        ),
      0,
    );
    if (time === 2.7) orbit = r;
    else assert.ok(r < orbit * 0.2);
  }
  s.stageTime = 4.5;
  v.update(s, sonic);
  assert.equal(v.group.visible, false);
  assert.equal(sonicSuper(s), true);
});
test("adaptive guard has anticipation and release windows, directional defense, counter escape and cooldown", () => {
  const s = fight(),
    events = [];
  s.tactics = freshTitanTactics();
  for (let i = 0; i < 6; i++) recordTitanPressure(s, 150);
  updateTitanTactics(s, 1 / 60, (_, type) => events.push(type));
  assert.deepEqual(events, ["boss-guard"]);
  const front = { point: { x: 0, y: 57, z: 10 } },
    rear = { point: { x: 0, y: 57, z: -30 } };
  assert.equal(titanGuarding(s, front, "punch"), false);
  updateTitanTactics(s, 0.3, () => {});
  assert.equal(titanGuarding(s, front, "punch"), true);
  assert.equal(titanGuarding(s, rear, "punch"), false);
  assert.equal(titanGuarding(s, front, "counter"), false);
  s.tactics.guard = 0.1;
  assert.equal(titanGuarding(s, front, "punch"), false);
  s.tactics.chain = 8;
  s.tactics.pressure = 2;
  updateTitanTactics(s, 0.2, () => assert.fail("cooldown bypassed"));
  assert.ok(
    titanRecovery({ ...s, phase: 2 }, 4) < titanRecovery({ ...s, phase: 1 }, 4),
  );
  assert.equal(chooseTitanTactic(s, ["pulse"]), "pulse");
});
test("front guard reduces actual contact damage, while Sonic retains free lateral movement", () => {
  const normal = fight();
  titanInput(normal, "hit");
  run(normal, 0.4);
  const damage = normal.maxHp - normal.hp;
  const guarded = fight();
  guarded.tactics.guard = 0.9;
  titanInput(guarded, "hit");
  const e = run(guarded, 0.4);
  assert.ok(damage > 0);
  assert.equal(guarded.maxHp - guarded.hp, damage * 0.25);
  assert.ok(e.some((x) => x.type === "block"));
  const x = guarded.avatar.x;
  guarded.strike = null;
  guarded.action = "idle";
  guarded.tactics.guard = 0.8;
  run(guarded, 0.2, { right: true });
  assert.ok(guarded.avatar.x !== x);
});
test("aerial pulse sweeps once and permits vertical escape or a timely parry at different frame rates", () => {
  for (const fps of [30, 60, 144])
    for (const escape of ["none", "vertical", "parry"]) {
      const s = fight();
      s.attack = "pulse";
      Object.assign(s.avatar, { x: 0, y: 57, z: 50 });
      s.attackAim = { ...s.avatar };
      s.attackTime = TITAN_MOVES.pulse.tell + 0.25;
      if (escape === "vertical") s.avatar.y += 12;
      const e = run(s, 0.7, { parry: escape === "parry" }, fps),
        hits = e.filter((x) => x.type === "impact");
      assert.equal(hits.length, escape === "none" ? 1 : 0, `${fps} ${escape}`);
      if (escape === "parry")
        assert.equal(e.filter((x) => x.type === "parry").length, 1);
    }
});
test("grab carries Sonic continuously toward the jaw, with working escape counter and outward failed throw", () => {
  for (const win of [true, false]) {
    const s = fight();
    s.qte = {
      kind: "crunch",
      from: { ...s.avatar },
      left: 4.2,
      need: 11,
      hits: 0,
    };
    s.attack = "crunch";
    const old = { ...s.avatar };
    run(s, 1 / 60);
    assert.ok(Math.hypot(s.avatar.y - old.y, s.avatar.z - old.z) < 0.2);
    run(s, 0.7);
    assert.ok(s.avatar.y > 79 && s.avatar.z > 19);
    if (win) s.qte.hits = 11;
    const events = run(s, win ? 1 / 60 : 3.7);
    assert.equal(s.qte, null);
    if (win) {
      assert.ok(events.some((e) => e.type === "qte-win"));
      assert.ok(s.hp < s.maxHp);
    } else {
      assert.ok(events.some((e) => e.type === "grab-throw"));
      assert.ok(s.knockback?.left > 0);
      assert.equal(s.rings, 361);
    }
  }
});
test("impact geometry, craters and dynamic light slots remain bounded, freeze while paused, expire and obey toggles", () => {
  const scene = new T.Scene(),
    floor = new T.Mesh(
      new T.PlaneGeometry(10, 10),
      new T.MeshStandardMaterial(),
    ),
    fx = new TitanGroundFX(scene, floor, new T.Texture()),
    camera = new T.PerspectiveCamera(),
    s = fight();
  for (let i = 0; i < 200; i++)
    fx.event(
      { type: "stomp", eventId: `stomp${i}`, point: { x: i % 8, y: 0, z: 2 } },
      s,
    );
  fx.update(s, camera);
  assert.equal(fx.events.length, 12);
  assert.ok(fx.seen.size <= 96);
  assert.equal(fx.craters.length, 6);
  assert.ok(fx.stones.count <= 72);
  assert.equal(fx.lights.length, 2);
  const matrix = Array.from(fx.stones.instanceMatrix.array);
  fx.update(s, camera);
  assert.deepEqual(Array.from(fx.stones.instanceMatrix.array), matrix);
  s.config.groundEffects = false;
  fx.update(s, camera);
  assert.equal(fx.stones.count, 0);
  assert.ok(fx.craters.every((v) => v.w === 0));
  s.time += 11;
  fx.update(s, camera);
  assert.equal(fx.events.length, 0);
  assert.ok(fx.lights.every((l) => l.intensity === 0));
});
