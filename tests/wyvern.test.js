import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  wyvernSession,
  wyvernInput,
  stepWyvern,
  restoreWyvernSession,
  WYVERN_GAPS,
} from "../src/wyvern-simulation.js";
import { WYVERN_CINEMA } from "../src/wyvern-choreography.js";
import { WYVERN_TOWER, WYVERN_SCALE, runwayPoint } from "../src/wyvern-space.js";
import { nearestTitanSurface } from "../src/titan-contact.js";
import {
  titanSession,
  titanInput,
  stepTitan,
} from "../src/giganto-simulation.js";
const tick = (s, n, input = {}) => {
  const events = [];
  for (let i = 0; i < n; i++) {
    stepWyvern(s, input, 1 / 60);
    assert.ok(
      s.events.every((e) => typeof e.type === "string"),
      "all event types must be strings",
    );
    events.push(...s.events);
  }
  return events;
};
function fight(phase = 1) {
  const s = wyvernSession({ drain: 0 });
  Object.assign(s, { stage: "combat", emerald: true, phase });
  Object.assign(s.avatar, { x: 0, y: 65, z: -43, onGround: false, yaw: Math.PI });
  s.wyvern.yaw = Math.PI;s.wyvern.flightTime=6;
  return s;
}
function timedParry(s) {
  const w=s.wyvern;
  return !w.parryUsed && (w.missiles.some(m=>!m.reflected&&m.eta-m.age<0.1) ||
    (["claws","bite"].includes(w.mode)&&w.timer<0.1));
}
function parryUntilOpen(s,max=900) {
  const events=[];
  for(let i=0;i<max&&!s.wyvern.open;i++) {stepWyvern(s,{parry:timedParry(s),boost:s.wyvern.mode==="missiles"},1/60);events.push(...s.events);}
  return events;
}
function walk(s, target, max = 600) {
  for (let i = 0; i < max; i++) {
    s.avatar.yaw=s.wyvern.open>0?Math.PI:0;
    const p = s.avatar,
      dx = target.x - p.x,
      dz = target.z - p.z,
      n = Math.hypot(dx, dz);
    if (n < 0.7) return;
    stepWyvern(
      s,
      { moveX: dx / Math.max(0.01, n), moveY: -dz / Math.max(0.01, n) },
      1 / 60,
    );
  }
  assert.fail(
    "Could not walk to " +
      JSON.stringify(target) +
      " from " +
      JSON.stringify(s.avatar),
  );
}
test("Wyvern tower supports real walking from base to summit and requires a homing launch", () => {
  const s = wyvernSession();
  s.stage = "traversal";
  Object.assign(s.avatar, WYVERN_TOWER[0], { onGround: true, yaw: 0 });
  for (let i = 1; i < WYVERN_TOWER.length; i += 3) walk(s, WYVERN_TOWER[i]);
  walk(s, WYVERN_TOWER.at(-1));
  assert.ok(s.avatar.y >= 79);
  assert.equal(s.wyvern.section, "tower");
  assert.equal(wyvernInput(s, "homing"), true);
  assert.equal(s.wyvern.section, "boarding");
  tick(s, 70);
  assert.equal(s.wyvern.section, "runway");
  assert.ok(s.rings > 80);
});
test("the three-lane runway has playable gaps, homing bridges, nonduplicated rings and a final emerald objective", () => {
  const s = wyvernSession();
  s.stage = "traversal";
  Object.assign(s.avatar, WYVERN_TOWER.at(-1), { onGround: true });
  wyvernInput(s, "homing");
  tick(s, 70);
  let guard = 0;
  while (s.wyvern.section === "runway" && guard++ < 7000) {
    for (let i = 0; i < WYVERN_GAPS.length; i++)
      if (s.wyvern.gate <= i && WYVERN_GAPS[i] - s.wyvern.rail < 15)
        wyvernInput(s, "homing");
    stepWyvern(s, { boost: true }, 1 / 60);
  }
  assert.equal(s.wyvern.section, "emerald");
  const rings = s.rings;
  tick(s, 20);
  assert.equal(s.rings, rings);
  s.avatar.yaw=Math.atan2(s.avatar.x,s.avatar.z);
  tick(s, 90, { forward: true });
  assert.equal(s.stage, "transform");
  assert.equal(s.emerald, true);
  tick(s, Math.ceil(WYVERN_CINEMA.transform * 60) + 1);
  assert.equal(s.stage, "combat");
  assert.equal(s.checkpoint, "combat");
});
test("leaving the ribbon falls safely without snapping back or duplicating pickups", () => {
  const s = wyvernSession();
  s.stage = "traversal";
  s.wyvern.section = "runway";
  s.wyvern.rail = WYVERN_GAPS[0] - 2;
  Object.assign(s.avatar,runwayPoint(s.wyvern.rail),{onGround:true});
  tick(s,90,{right:true,boost:true});
  tick(s,300,{});
  assert.equal(s.wyvern.section,"tower");
  assert.ok(s.avatar.y<5);
  s.wyvern.ringIds = ["rail:1"];
  const r = restoreWyvernSession(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(r.wyvern.ringIds, ["rail:1"]);
});
test("armor blocks attacks until one missile is parried", () => {
  const s = fight(),
    hp = s.hp;
  wyvernInput(s, "hit");
  tick(s, 25);
  assert.equal(s.hp, hp);
  const events = parryUntilOpen(s);
  assert.ok(events.filter((e) => e.type === "parry").length === 1);
  assert.ok(s.wyvern.open > 0);
  wyvernInput(s, "hit");
  tick(s, 90); // Includes the successful parry slow motion and counter contact.
  assert.ok(s.hp < hp);
  assert.ok(s.events.every((e) => Number.isFinite(e.at)));
  for (const mode of ["claws", "bite"]) {
    const far = fight();
    far.avatar.x = 120;
    far.wyvern.mode = mode;
    far.wyvern.timer = 0.1;
    far.wyvern.aim = { ...far.avatar };
    tick(far, 30, { parry: true });
    assert.equal(far.wyvern.open, 0);
    assert.equal(far.rings, 80, "close attacks cannot reach across the arena");
  }
});
test("phase two also opens from a single missile parry; holding never grants indefinite protection", () => {
  const s = fight(2),
    events = parryUntilOpen(s);
  assert.equal(events.filter((e) => e.type === "parry").length, 1);
  assert.ok(s.wyvern.open > 0);
  const strict = fight();
  strict.config.strictParry = true;
  tick(strict, 600, { parry: true });
  assert.equal(strict.wyvern.open, 0);
  assert.ok(strict.rings < 80);
});
test("shared Sonic specials use visible Wyvern regions, real swept hits, free ability launches and animation recovery", () => {
  for (const action of [
    "hit",
    "homing",
    "boom",
    "cross",
    "shot",
    "rush",
    "spin",
    "stomp",
    "cyclone",
    "loop",
  ]) {
    const s = fight();
    s.wyvern.open = 13;
    const energy = s.energy,
      hp = s.hp;
    assert.equal(wyvernInput(s, action), true, action);
    const events = tick(s, 240);
    assert.ok(s.hp < hp, action + " must connect");
    assert.ok(
      events.some((e) => e.type === "hit"),
      action,
    );
    assert.ok(s.projectiles.length <= 8);
    if (action !== "hit")
      assert.equal(s.energy,undefined);
  }
});
test("half-health, barrage timing, tail slam, dive timing, jaw struggle and missile explosion form one gated victory", () => {
  const s = fight();
  s.wyvern.open = 10;
  s.hp = s.maxHp * 0.5 + 1;
  wyvernInput(s, "hit");
  tick(s, 20);
  assert.equal(s.stage, "phase");
  assert.equal(s.phase, 2);
  tick(s, WYVERN_CINEMA.phase * 60 + 10);
  assert.equal(s.stage, "combat");
  s.wyvern.open = 10;
  Object.assign(s.avatar,{x:0,y:65,z:26*WYVERN_SCALE,vx:0,vy:0,vz:0});
  s.hp = s.maxHp * 0.12 + 1;
  wyvernInput(s, "hit");
  tick(s, 30);
  assert.equal(s.stage, "wyvern-volley");
  while ((s.qte.age % 3) / 3 < 0.56 || (s.qte.age % 3) / 3 > 0.64) tick(s, 1);
  assert.equal(wyvernInput(s, "hit"), true);
  tick(s, 1);
  assert.equal(s.stage, "wyvern-slam");
  tick(s, WYVERN_CINEMA.slam * 60 + 5);
  assert.equal(s.stage, "combat");
  assert.equal(s.wyvern.slamDone, true);
  s.hp = s.maxHp * 0.04 + 1;
  s.wyvern.open = 10;
  Object.assign(s.avatar, { x: 0, y: 65, z: -43 });
  for (const key in s.cooldowns) s.cooldowns[key] = 0;
  wyvernInput(s, "hit");
  tick(s, 30);
  assert.equal(s.stage, "wyvern-dive");
  while ((s.qte.age % 3) / 3 < 0.56 || (s.qte.age % 3) / 3 > 0.64) tick(s, 1);
  wyvernInput(s, "jump");
  tick(s, 1);
  assert.equal(s.stage, "wyvern-hold");
  for (let i = 0; i < 16; i++) {
    tick(s, 6);
    wyvernInput(s, "hit");
  }
  tick(s, 1);
  assert.equal(s.stage, "wyvern-launch");
  tick(s, WYVERN_CINEMA.launch * 60 + 1);
  assert.equal(s.stage, "wyvern-barrage");
  while ((s.qte.age % 3) / 3 < 0.56 || (s.qte.age % 3) / 3 > 0.64) tick(s, 1);
  wyvernInput(s, "hit");
  tick(s, 1);
  assert.equal(s.stage, "wyvern-mouth");
  for (let i = 0; i < 16; i++) {
    tick(s, 6);
    wyvernInput(s, "hit");
  }
  tick(s, 1);
  assert.equal(s.stage, "wyvern-missile");
  for (let i = 0; i < 16; i++) {
    tick(s, 6);
    wyvernInput(s, "hit");
  }
  tick(s, 1);
  assert.equal(s.stage, "finale");
  const e = tick(s, WYVERN_CINEMA.finale * 60 + 10);
  assert.equal(s.stage, "victory");
  assert.equal(s.won, true);
  assert.equal(e.filter((e) => e.type === "wyvern-explosion").length, 1);
  assert.ok(s.returnPortal);
});
test("missed QTEs retry without health reset; cinematic protection and defeat/retry preserve the checkpoint", () => {
  const s = fight(2);
  s.stage = "wyvern-dive";
  s.hp = 3200;
  s.qte = { kind: "timing", hits: 0, need: 1, left: 6, age: 0, lastTap: -10 };
  const hp = s.hp;
  wyvernInput(s, "hit");
  assert.equal(s.qte.hits, 0);
  tick(s, 400);
  assert.equal(s.hp, hp);
  assert.ok(s.qte.left > 0);
  s.stage = "combat";
  s.qte = null;
  s.checkpoint = "phase2";
  s.config.drain = 3;
  s.rings = 0.01;
  tick(s, 2);
  assert.equal(s.stage, "defeat");
  assert.equal(wyvernInput(s, "retry"), true);
  assert.equal(s.phase, 2);
  assert.equal(s.hp, s.maxHp * 0.5);
  assert.equal(s.rings, 220);
});
test("saves preserve progress, cooldowns, ring counts and stable return portals, and reject malformed sessions", () => {
  const s = fight();
  s.cooldowns.shot = 6;
  s.wyvern.ringIds = ["field:1", "field:1", "rail:3"];
  s.stage = "wyvern-mouth";
  s.qte = { kind: "mash", hits: 7, need: 16, left: 3, age: 3, lastTap: 2 };
  const r = restoreWyvernSession(JSON.parse(JSON.stringify(s)));
  assert.equal(r.qte.hits, 7);
  assert.equal(r.cooldowns.shot, 6);
  assert.deepEqual(r.wyvern.ringIds, ["field:1", "rail:3"]);
  assert.equal(
    restoreWyvernSession({
      schema: 1,
      titan: "wyvern",
      stage: "hacked",
      id: "x",
    }),
    null,
  );
});
test("optimized Wyvern carries real skinning, embedded textures and named original animations; Giganto remains a separate simulation", () => {
  const b = readFileSync("public/models/wyvern/wyvern.glb"),
    j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)));
  assert.ok(b.length < 4e6);
  assert.ok(j.skins[0].joints.length > 100);
  for (const name of ["flight", "claw_left", "claw_right", "bite", "defeat"])
    assert.ok(j.animations.some((a) => a.name === name));
  assert.ok(j.images.every((i) => Number.isInteger(i.bufferView)));
  const g = titanSession({ cinematics: false });
  assert.equal(g.titan, undefined);
  for (let i = 0; i < 30; i++) stepTitan(g, {});
  assert.equal(g.stage, "traversal");
  assert.equal(titanInput(g, "jump"), true);
});
test("normal default health is beatable through the actual parry and combo loop without changing boss HP", () => {
  const s = fight();
  s.config.drain = 1;
  s.rings = 400;
  const phases = new Set(),
    stages = new Set();
  let ticks = 0;
  while (!["victory", "defeat"].includes(s.stage) && ticks++ < 60 * 420) {
    phases.add(s.phase);
    stages.add(s.stage);
    if (s.qte) {
      const u = (s.qte.age % 3) / 3;
      if (
        (s.qte.kind === "mash" && ticks % 6 === 0) ||
        (s.qte.kind === "timing" && u > 0.56 && u < 0.64)
      )
        wyvernInput(s, "hit");
    }
    if (s.stage === "combat" && s.wyvern.open > 0) {
      for (const a of ["cyclone", "rush", "spin", "boom", "cross"])
        if (!s.strike && s.cooldowns[a] <= 0) wyvernInput(s, a);
    }
    s.avatar.yaw=s.wyvern.open>0?Math.PI:0;
    const p = s.avatar,
      dx = -p.x,
      dz = p.z + 43,
      dy = 65 - p.y;
    stepWyvern(
      s,
      {
        parry: timedParry(s),
        hit: s.wyvern.open > 0,
        moveX: s.wyvern.open>0 && Math.abs(dx)>0.7 ? -Math.sign(dx) : 0,
        moveY: s.wyvern.open>0 && Math.abs(dz)>0.7 ? -Math.sign(dz) : 0,
        up: dy > 1,
        down: dy < -1,
        boost: s.wyvern.mode === "missiles" || Math.hypot(dx, dz) > 32,
      },
      1 / 60,
    );
  }
  assert.equal(
    s.stage,
    "victory",
    JSON.stringify({
      stage: s.stage,
      hp: s.hp,
      rings: s.rings,
      time: s.time,
      mode: s.wyvern.mode,
    }),
  );
  assert.equal(phases.size, 2);
  for (const stage of [
    "phase",
    "wyvern-volley",
    "wyvern-slam",
    "wyvern-dive",
    "wyvern-mouth",
    "finale",
  ])
    assert.ok(stages.has(stage), stage);
  assert.ok(s.time > 45 && s.time < 420, s.time + " seconds");
  console.log(
    "Normal Wyvern encounter seconds:",
    s.time.toFixed(1),
    "rings left:",
    s.rings.toFixed(1),
  );
});
test("Wyvern stays silent without audio capabilities and tears down safely", async () => {
  const { WyvernAudio } = await import("../src/wyvern-audio.js");
  const s = wyvernSession();
  const game = { settings: { volume: 0, musicVolume: 0 },
    giganto: { record: { config: s.config }, session: s },
    audio: { context: null, master: null, updateVolume() {} } };
  const a = new WyvernAudio(game);
  assert.equal(a.prepare(s), undefined);
  a.frame(s, true);
  a.pause(s);
  a.silence();
  assert.equal(a.score, null);
  assert.equal(a.bus, null);
});
