import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  wyvernSession,
  wyvernInput,
  stepWyvern,
  restoreWyvernSession,
} from "../src/wyvern-simulation.js";
import {
  WYVERN_CINEMA,
  WYVERN_QTE,
  WYVERN_QTE_STAGES,
  wyvernFlightFrame,
  wyvernDaylight,
  wyvernMissilePoint,
  wyvernQteTargetScale,
} from "../src/wyvern-choreography.js";
import { WYVERN_RAIL_LENGTH, runwayPoint, WYVERN_SCALE, WYVERN_REST_LIFT } from "../src/wyvern-space.js";
const tick = (s, n, input = {}) => {
  const ev = [];
  for (let i = 0; i < n; i++) {
    stepWyvern(s, input, 1 / 60);
    ev.push(...s.events);
  }
  return ev;
};
const combat = () => {
  const s = wyvernSession({ drain: 0 });
  Object.assign(s, { stage: "combat", emerald: true, rings: 400 });
  Object.assign(s.avatar, { x: 0, y: 65, z: -43, onGround: false });
  s.avatar.yaw=Math.PI;s.wyvern.yaw=Math.PI;s.wyvern.flightTime=6;return s;
};
test("red timing ring meets the fixed white target inside the actual accepted input window", () => {
  const u = 1 - WYVERN_QTE.target;
  assert.ok(u >= WYVERN_QTE.low && u <= WYVERN_QTE.high);
  const markup = readFileSync(
    new URL("../src/titan-hud.js", import.meta.url),
    "utf8",
  );
  const outer = Number(markup.match(/class="qte-time"[^>]*\br="(\d+)"/)[1]),
    inner = Number(markup.match(/class="qte-effort"[^>]*\br="(\d+)"/)[1]);
  assert.ok(
    Math.abs(outer * (1 - u) - inner * wyvernQteTargetScale(outer, inner)) <
      1e-8,
  );
  const s = combat();
  s.stage = "wyvern-barrage";
  s.qte = {
    kind: "timing",
    hits: 0,
    need: 1,
    left: 6,
    age: u * WYVERN_QTE.period,
    lastTap: -10,
  };
  assert.equal(wyvernInput(s, "hit"), true);
  assert.equal(s.qte.hits, 1);
});
test("boost closes the pursuit gap, then one missile parry blinks Sonic forward to expose Wyvern", () => {
  const s=combat(),hp=s.hp;
  tick(s,120,{boost:true});assert.equal(s.wyvern.mode,"missiles");assert.equal(s.wyvern.open,0);assert.equal(s.hp,hp);
  let parries=0;
  for(let i=0;i<900&&!s.wyvern.open;i++) {
    const w=s.wyvern,parry=!w.parryUsed&&(w.missiles.some(m=>!m.reflected&&m.eta-m.age<0.1)||(["claws","bite"].includes(w.mode)&&w.timer<0.1));
    stepWyvern(s,{boost:w.mode==="missiles",parry},1/60);parries+=s.events.filter(e=>e.type==="parry").length;
  }
  assert.ok(s.wyvern.open>0);assert.equal(parries,1);
});
test("a landed counter spins Wyvern once, has a single contact event, and blends back into a live damage window", () => {
  const s = combat();
  s.wyvern.open = 10;
  s.counter = 2;
  wyvernInput(s, "hit");
  tick(s, 35);
  assert.equal(s.stage, "wyvern-counter");
  const hp = s.hp;
  const e = tick(s, WYVERN_CINEMA.counter * 60 + 1);
  assert.equal(s.hp, hp);
  assert.equal(e.filter((e) => e.type === "counter-impact").length, 1);
  assert.equal(s.stage, "combat");
  assert.ok(s.wyvern.open > 9.8 && s.wyvern.open <= 10);
  assert.ok(Math.hypot(s.avatar.x, s.avatar.y - (66-WYVERN_SCALE), s.avatar.z + 26*WYVERN_SCALE) < 0.1);
  assert.equal(s.wyvern.counterUsed, true);
});
test("all finishing timing and mash stages save and restore progress, flight motion and one-shot cues", () => {
  for (const [stage, kind] of Object.entries(WYVERN_QTE_STAGES)) {
    const s = combat();
    s.stage = stage;
    s.wyvern.flightTime = 73.5;
    s.wyvern.counterUsed = true;
    s.wyvern.counterCues = 1;
    s.qte = {
      kind,
      hits: kind === "mash" ? 5 : 0,
      need: kind === "mash" ? 16 : 1,
      left: 4,
      age: 2,
      lastTap: 1.9,
    };
    const r = restoreWyvernSession(JSON.parse(JSON.stringify(s)));
    assert.equal(r.stage, stage);
    assert.equal(r.qte.kind, kind);
    assert.equal(r.qte.hits, s.qte.hits);
    assert.equal(r.wyvern.flightTime, 73.5);
    assert.equal(r.wyvern.counterCues, 1);
    assert.equal(r.wyvern.counterUsed, true);
  }
});
test("flight frame is smooth at multiple frame rates, daylight advances through pursuit and freezes after victory", () => {
  const frames = [];
  for (const hz of [30, 60, 144]) {
    const s = combat();
    s.avatar.x = 120;
    s.avatar.z = 120;
    for (let i = 0; i < hz * 4; i++) stepWyvern(s, {}, 1 / hz);
    frames.push(wyvernFlightFrame(s));
  }
  for (const f of frames) {
    for (const k of ["x", "y", "z", "yaw"]) assert.ok(Number.isFinite(f[k]));
    assert.ok(Math.abs(f.x - frames[0].x) < 1e-7);
  }
  const s = combat();
  s.wyvern.flightTime = 90;
  const day = wyvernDaylight(s),
    frame = wyvernFlightFrame(s);
  s.stage = "victory";
  s.won = true;
  tick(s, 120);
  assert.deepEqual(wyvernFlightFrame(s), frame);
  assert.equal(wyvernDaylight(s), day);
  assert.ok(day > 0.05 && day < 0.2);
});
test("long ribbon keeps old saved chase progress and pickups without repeated conversion; missiles arrive at their actual targets", () => {
  const s = wyvernSession();
  s.stage = "traversal";
  s.wyvern.section = "runway";
  delete s.wyvern.trackVersion;
  s.wyvern.rail = 240;
  s.wyvern.ringIds = ["rail:3"];
  const r = restoreWyvernSession(JSON.parse(JSON.stringify(s)));
  assert.equal(r.wyvern.rail, WYVERN_RAIL_LENGTH * 0.5);
  assert.equal(r.wyvern.trackVersion, 2);
  assert.deepEqual(r.wyvern.ringIds, ["rail:3"]);
  assert.equal(
    restoreWyvernSession(JSON.parse(JSON.stringify(r))).wyvern.rail,
    r.wyvern.rail,
  );
  const end = runwayPoint(WYVERN_RAIL_LENGTH);
  assert.ok(Math.hypot(end.x, end.y - (66+WYVERN_REST_LIFT+7*WYVERN_SCALE), end.z - 9*WYVERN_SCALE) < 1e-9);
  const m = {
    id: 2,
    from: { x: 0, y: 66, z: 0 },
    target: { x: 8, y: 65, z: 26 },
    eta: 2.8,
    age: 0,
  };
  assert.deepEqual(wyvernMissilePoint(m), m.from);
  m.age = m.eta;
  const p = wyvernMissilePoint(m);
  assert.ok(
    Math.hypot(p.x - m.target.x, p.y - m.target.y, p.z - m.target.z) < 1e-8,
  );
});
