import test from "node:test";
import assert from "node:assert/strict";
import {
  titanSession,
  titanInput,
  stepTitan,
  chooseTitanAttack,
  restoreTitanSession,
  TITAN_MOVES,
} from "../src/giganto-simulation.js";
import { TITAN_ACTIONS } from "../src/titan-combat.js";
import { titanStompWave } from "../src/titan-contact.js";
import { advanceTitanTrails } from "../src/titan-trails.js";
import {
  initializeArenaSettings,
  arenaAudioSettings,
  arenaQuality,
} from "../src/titan-settings.js";
import { TitanAudio } from "../src/giganto-audio.js";
const fight = () => {
  const s = titanSession({ cinematicPace: 1, cinematics: false, drain: 0 });
  s.stage = "combat";
  s.emerald = true;
  s.rings = 400;
  s.idle = 999;
  s.iframes = 0;
  Object.assign(s.avatar, { x: 0, y: 57, z: 18 });
  return s;
};
const ticks = (s, n, input = {}, rate = 60) => {
  const events = [];
  for (let i = 0; i < n; i++) {
    stepTitan(s, input, 1 / rate);
    events.push(...s.events);
  }
  return events;
};
test("homing travels physically, strikes once, respects distance, and can be cancelled before contact", () => {
  const s = fight();
  s.avatar.z = 26;
  const before = { ...s.avatar };
  assert.ok(titanInput(s, "homing"));
  assert.deepEqual(s.avatar, before);
  assert.equal(s.energy, undefined);
  ticks(s, 16);
  assert.ok(s.avatar.z < before.z - 5);
  assert.equal(s.hp, s.maxHp);
  const hits = ticks(s, 45).filter((e) => e.type === "hit");
  assert.equal(hits.length, 1);
  assert.equal(s.maxHp - s.hp, 500);
  const c = fight();
  titanInput(c, "homing");
  ticks(c, 6);
  titanInput(c, "dodge");
  ticks(c, 70);
  assert.equal(c.hp, c.maxHp);
  const far = fight();
  far.avatar.z = 130;
  assert.equal(titanInput(far, "homing"), false);
  assert.equal(far.energy, undefined);
});
test("Sonic Boom and Cross Slash release on kick contact, fly, and never deal duplicate projectile damage", () => {
  for (const [move, hits, damage] of [
    ["boom", 4, 1200],
    ["cross", 2, 1360],
  ]) {
    const s = fight();
    s.avatar.z = 28;
    assert.ok(titanInput(s, move));
    ticks(s, Math.floor(TITAN_ACTIONS[move].contacts[0] * 60) - 1);
    assert.equal(s.projectiles.length, 0);
    assert.equal(s.hp, s.maxHp);
    const release = ticks(s, 2);
    assert.ok(release.some((e) => e.type === move));
    assert.ok(s.projectiles.length > 0);
    assert.equal(s.hp, s.maxHp);
    const e = ticks(s, 100);
    assert.equal(e.filter((e) => e.type === "hit").length, hits);
    assert.equal(s.maxHp - s.hp, damage);
    assert.equal(s.projectiles.length, 0);
  }
  const away = fight();
  away.lock = false;
  away.avatar.yaw = Math.PI;
  away.avatar.z = 30;
  titanInput(away, "cross");
  ticks(away, 120);
  assert.equal(away.hp, away.maxHp);
});
test("delayed projectiles cannot damage protected cinematics or survive exit/checkpoint restores", () => {
  const s = fight();
  s.avatar.z = 30;
  titanInput(s, "boom");
  ticks(s, 19);
  assert.equal(s.projectiles.length, 1);
  s.stage = "phase";
  const hp = s.hp;
  ticks(s, 20);
  assert.equal(s.hp, hp);
  s.original = {};
  const restored = restoreTitanSession(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(restored.projectiles, []);
});
test("stomp has a visible travelling wave and supports flying, dodge and parry escapes with one damage event", () => {
  for (const escape of ["none", "fly", "dodge", "parry"]) {
    const s = fight();
    s.avatar.y = escape === "fly" ? 12 : 0.05;
    s.avatar.z = 25;
    s.attack = "stomp";
    s.swatSide = "L";
    s.attackAim = { ...s.avatar };
    const tell = TITAN_MOVES.stomp.tell;
    ticks(s, Math.floor((tell + 0.28) * 60));
    assert.equal(s.rings, 400);
    const wave = titanStompWave(s);
    assert.ok(wave.radius < 2);
    const events = [];
    for (let i = 0; i < 65; i++) {
      if (escape === "dodge" && i === 10) titanInput(s, "dodge");
      stepTitan(s, { parry: escape === "parry" }, 1 / 60);
      events.push(...s.events);
    }
    assert.equal(
      events.filter((e) => e.type === "impact").length,
      escape === "none" ? 1 : 0,
      escape,
    );
    if (escape === "parry") assert.ok(events.some((e) => e.type === "parry"));
  }
});
test("boss selection avoids the last two attacks and chooses stomps/swats only at reachable heights", () => {
  const s = fight();
  s.avatar.y = 0.05;
  s.avatar.z = 25;
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    const recent = [...s.recentAttacks],
      move = chooseTitanAttack(s);
    s.sequence++;
    assert.ok(!recent.includes(move));
    seen.add(move);
  }
  assert.ok(seen.has("stomp") && seen.has("sweep"));
  s.avatar.y = 126;
  for (let i = 0; i < 20; i++) {
    const m = chooseTitanAttack(s);
    s.sequence++;
    assert.ok(!["swat", "stomp"].includes(m));
  }
  s.phase = 2;
  s.avatar.y = 57;
  for (let i = 0; i < 30; i++) {
    seen.add(chooseTitanAttack(s));
    s.sequence++;
  }
  assert.ok(seen.has("beam") && seen.has("crunch"));
});
test("attack release events are unique, occur at windup completion and differ across retries", () => {
  const s = fight();
  s.attack = "sweep";
  s.attackTime = 0;
  const e = ticks(s, 180);
  const release = e.filter((e) => e.type === "boss-release");
  assert.equal(release.length, 1);
  assert.ok(release[0].at >= TITAN_MOVES.sweep.tell);
  assert.ok(release[0].at < TITAN_MOVES.sweep.tell + 1 / 30);
  assert.equal(new Set(e.map((e) => e.eventId)).size, e.length);
  s.checkpoint = "combat";
  s.stage = "defeat";
  titanInput(s, "retry");
  assert.equal(s.attempt, 1);
  assert.ok(s.events.at(-1).eventId.includes(":1:"));
});
test("contact timing and damage remain stable at 30, 60 and 144 simulation steps per second", () => {
  for (const rate of [30, 60, 144])
    for (const [move, damage] of [
      ["hit", 180],
      ["cross", 1360],
      ["homing", 500],
    ]) {
      const s = fight();
      s.avatar.z = 5;
      titanInput(s, move);
      const events = ticks(s, rate * 2, {}, rate);
      assert.equal(s.maxHp - s.hp, damage, `${rate} ${move}`);
      assert.equal(
        events.filter((e) => e.type === "hit").length,
        move === "cross" ? 2 : 1,
      );
    }
});
test("trails are thin bounded history only for explicit speed actions; pause, hurt, movies and teleports leave no afterimages", () => {
  for (const rate of [30, 60, 144]) {
    const h = { segments: [] },
      s = fight();
    s.stage = "traversal";
    s.emerald = false;
    s.action = "rush";
    let previous = { x: 30, y: 55, z: 20 };
    for (let i = 0; i < rate * 2; i++) {
      s.time = i / rate;
      const p = { ...previous, z: previous.z + 36 / rate };
      advanceTitanTrails(h, previous, p, s, 1 / rate);
      previous = p;
    }
    assert.ok(h.segments.length >= 2 && h.segments.length <= 5, rate);
    const count = h.segments.length;
    advanceTitanTrails(h, previous, previous, s, 0);
    assert.equal(h.segments.length, count);
    s.action = "hurt";
    advanceTitanTrails(h, previous, previous, s, 1 / rate);
    assert.equal(h.segments.length, 0);
    s.action = "rush";
    advanceTitanTrails(h, previous, { x: 100, y: 90, z: 0 }, s, 1 / rate);
    assert.equal(h.segments.length, 0);
  }
});
function audioGame() {
  const nodes = [],
    sources = [];
  const node = () => {
    const n = {
      connections: [],
      connect(x) {
        this.connections.push(x);
      },
      disconnect() {
        this.disconnected = true;
      },
    };
    nodes.push(n);
    return n;
  };
  const param = () => ({
    value: 1,
    setTargetAtTime(v) {
      this.value = v;
    },
    setValueAtTime(v) {
      this.value = v;
    },
    linearRampToValueAtTime(v) {
      this.value = v;
    },
    exponentialRampToValueAtTime(v) {
      this.value = v;
    },
    cancelScheduledValues() {},
  });
  const context = {
    currentTime: 0,
    state: "running",
    sampleRate: 24000,
    createGain: () => ({ ...node(), gain: param() }),
    createBuffer: (n, length) => ({
      getChannelData: () => new Float32Array(length),
    }),
    createBufferSource: () => {
      const n = {
        ...node(),
        playbackRate: param(),
        start(t) {
          this.started = t;
        },
        stop() {
          this.stopped = true;
        },
      };
      sources.push(n);
      return n;
    },
  };
  const settings = {
    volume: 0.2,
    musicVolume: 0.1,
    musicEnabled: false,
    graphics: 1,
    shadows: false,
  };
  const session = fight();
  Object.assign(session.config, {
    masterVolume: 0.8,
    musicVolume: 0.65,
    effectsVolume: 0.4,
    music: false,
  });
  const game = {
    settings,
    audio: {
      context,
      master: { ...node(), gain: param() },
      compressor: node(),
      updateVolume() {},
    },
    giganto: { session, record: { config: session.config } },
  };
  return { game, context, sources, nodes };
}
test("arena audio uses isolated master/effects preferences, deduplicates events and stops all effect voices on pause and exit", () => {
  const { game, context, sources } = audioGame(),
    saved = JSON.stringify(game.settings),
    audio = new TitanAudio(game),
    s = game.giganto.session;
  audio.frame(s, true);
  assert.equal(audio.master.gain.value, 0.8);
  assert.equal(audio.bus.gain.value, 0.4);
  assert.equal(game.audio.master.gain.value, 0);
  assert.equal(audio.master.connections[0], game.audio.compressor);
  const e = { type: "hit", eventId: "contact1", at: s.time, amount: 34 };
  audio.event(e);
  audio.event(e);
  assert.equal(sources.length, 1);
  context.currentTime += 0.1;
  audio.event({ ...e, eventId: "contact2" });
  assert.equal(sources.length, 2);
  audio.pause(s);
  assert.ok(sources.every((q) => q.stopped && q.disconnected));
  assert.equal(audio.foley.voices.size, 0);
  assert.equal(audio.foley.gains.size, 0);
  audio.event({ ...e, eventId: "paused" });
  assert.equal(sources.length, 2);
  audio.frame(s, true);
  context.currentTime += 0.1;
  audio.event({ ...e, eventId: "contact3" });
  assert.equal(sources.length, 3);
  audio.silence();
  assert.equal(sources[2].stopped, true);
  assert.equal(game.audio.master.gain.value, 0.2);
  assert.equal(audio.master, null);
  assert.equal(JSON.stringify(game.settings), saved);
});
test("arena settings copy initial levels once, clamp controls, and cannot modify saved overworld preferences", () => {
  const s = fight(),
    world = { volume: 0.4, musicVolume: 0.3, graphics: 3 },
    saved = JSON.stringify(world);
  initializeArenaSettings(s.config, world);
  world.volume = 0.9;
  assert.equal(arenaAudioSettings(s.config, world).volume, 0.4);
  s.config.graphicsQuality = "low";
  assert.equal(arenaQuality(s.config, world), 1);
  world.volume = 0.4;
  assert.equal(JSON.stringify(world), saved);
});

test("phase-two dorsal damage follows finite sky rays with a warning, instead of invisible rear-quadrant cones", async () => {
  const { titanDorsalRay } = await import("../src/titan-dorsal.js");
  const ray = titanDorsalRay(0),
    p = {
      x: (ray.from.x + ray.to.x) * 0.5,
      y: (ray.from.y + ray.to.y) * 0.5 - 1.8,
      z: (ray.from.z + ray.to.z) * 0.5,
    };
  for (const [clock, parry, hits] of [
    [0.5, false, 0],
    [1.5, false, 1],
    [1.5, true, 0],
  ]) {
    const s = fight();
    s.phase = 2;
    s.stageTime = clock;
    Object.assign(s.avatar, p);
    const e = ticks(s, 20, { parry });
    assert.equal(e.filter((e) => e.type === "impact").length, hits);
    if (parry) assert.equal(e.filter((e) => e.type === "parry").length, 1);
  }
  const safe = fight();
  safe.phase = 2;
  safe.stageTime = 1.5;
  Object.assign(safe.avatar, { x: 0, y: 45, z: -35 });
  assert.equal(ticks(safe, 30).filter((e) => e.type === "impact").length, 0);
});

test("camera boom cannot hide Sonic across the Titan's torso when yaw reverses at close range", async () => {
  const { clearTitanCamera, titanCameraBlocked } = await import(
    "../src/titan-camera.js"
  );
  const s = fight();
  Object.assign(s.avatar, { x: 0, y: 57, z: 5, yaw: Math.PI });
  const obscured = { x: 0, y: 62, z: -30 };
  assert.equal(titanCameraBlocked(s, obscured), true);
  const clear = clearTitanCamera(s, obscured, 38);
  assert.equal(titanCameraBlocked(s, clear), false);
  assert.equal(s.avatar.yaw, Math.PI);
  for (const y of [20, 57, 68, 85])
    for (const angle of [0, 0.8, 2, Math.PI]) {
      s.avatar.y = y;
      s.avatar.x = Math.sin(angle) * 38;
      s.avatar.z = Math.cos(angle) * 38;
      const q = clearTitanCamera(
        s,
        { x: -s.avatar.x, y: y + 5, z: -s.avatar.z },
        38,
      );
      assert.equal(titanCameraBlocked(s, q), false, `${y} ${angle}`);
    }
});
test("phase and finishing cinematic poses follow the actual score cursor after hitches; paused/unrelated music cannot advance them", async () => {
  const { alignTitanCinematic } = await import("../src/titan-timing.js");
  const s = fight();
  s.stage = "phase";
  s.stageTime = 0.1;
  const score = {
    context: { currentTime: 12.5, state: "running" },
    current: { section: "transition", offset: 121, when: 10 },
  };
  alignTitanCinematic(s, score);
  assert.equal(s.stageTime, 2.5);
  score.context.state = "suspended";
  score.context.currentTime = 14;
  alignTitanCinematic(s, score);
  assert.equal(s.stageTime, 2.5);
  score.context.state = "running";
  score.current.section = "phaseTwo";
  alignTitanCinematic(s, score);
  assert.equal(s.stageTime, 2.5);
  s.stage = "finale";
  s.stageTime = 0.1;
  score.current = { section: "finale", offset: 240, when: 14 };
  score.context.currentTime = 16;
  alignTitanCinematic(s, score);
  assert.equal(s.stageTime, 5);
  score.context.currentTime = 30;
  alignTitanCinematic(s, score);
  assert.equal(s.stageTime, 7);
});

test("cinematic Foley follows fresh cue events only, deduplicates contact and stops at a skipped counter", () => {
  const { game, context, sources } = audioGame(),
    audio = new TitanAudio(game),
    s = game.giganto.session;
  audio.frame(s, true);
  const cue = (cue, id, age = 0) => ({
    type: "cinematic-cue",
    cue,
    eventId: id,
    at: s.time,
    age,
  });
  audio.event(cue("charge", "old", 3));
  assert.equal(sources.length, 0);
  audio.event(cue("launch", "launch"));
  assert.equal(sources.length, 1);
  audio.event(cue("launch", "launch"));
  assert.equal(sources.length, 1);
  context.currentTime += 0.3;
  audio.event(cue("contact", "contact"));
  assert.equal(sources.length, 2);
  audio.event({ type: "cinematic-skip", eventId: "skip", at: s.time });
  assert.ok(sources.every((q) => q.stopped));
  assert.equal(audio.foley.voices.size, 0);
  audio.pause(s);
  audio.event(cue("rupture", "paused"));
  assert.equal(sources.length, 2);
  audio.silence();
});
