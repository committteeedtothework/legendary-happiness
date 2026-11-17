import { B, BLOCKS, makeStack } from "./data.js";
import { collides } from "./physics.js";
import { playerActors } from "./pvp.js";

export const VERITY = Object.freeze({
  bpm: 112,
  beat: 60 / 112,
  beats: 256,
  arrival: 2.4,
  departure: 3,
  firstVisit: 1800,
  revisit: 12000,
  radius: 8,
  perfect: 0.14,
  good: 0.31,
  inputBuffer: 0.14,
  steps: ["left", "right", "kick", "clap", "left", "right", "kick", "clap"],
});
export const danceLocked = (p) =>
  !!p?.verityDance && ["arrival", "dance", "bow"].includes(p.verityDance.phase);
const validPosition = (p) => p && [p.x, p.y, p.z].every(Number.isFinite);
export function verityRecord(world) {
  const all = (world.settlements ||= {});
  let s = all["lord-verity"];
  if (!s || s.version !== 1)
    s = all["lord-verity"] = {
      version: 1,
      next: Math.max(0, world.tick || 0) + VERITY.firstVisit,
      visits: 0,
    };
  return s;
}
function actors(g) {
  if (g.multiplayer?.connected && !g.multiplayer.isGuest && g.multiplayer.game)
    return playerActors(g);
  return [
    { id: "local", player: g.player, inventory: g.inventory, context: g },
  ];
}
export function safeDanceFloor(g, p) {
  if (
    !validPosition(p) ||
    !p.onGround ||
    p.health <= 0 ||
    p.multiplayerAway ||
    p.inWater ||
    p.underwater ||
    p.flying ||
    p.boatId ||
    p.horseId ||
    p.riptide ||
    p.burning ||
    p.standData?.trial?.phase === "trial" ||
    p.standData?.transformed
  )
    return false;
  if (p.pvpLastCombat !== undefined && g.tickCount - p.pvpLastCombat < 160)
    return false;
  const id = g.world.get(p.x, p.y - 0.06, p.z);
  return (
    !!BLOCKS[id]?.solid &&
    ![B.magma, B.fire, B.cactus].includes(id) &&
    !collides(g.world, p, 1.8, 0.6)
  );
}
export function findVeritySpot(g, p) {
  // Never clear terrain, place a stage, move a player or spawn inside a build.
  for (const angle of [0, 0.65, -0.65, 1.3, -1.3, Math.PI]) {
    const a = (p.yaw || 0) + angle,
      x = p.x - Math.sin(a) * 5,
      z = p.z - Math.cos(a) * 5;
    const y = g.world.skyHeight(x, z) + 1;
    if (!Number.isFinite(y) || Math.abs(y - p.y) > 1.6) continue;
    const q = { x, y: y + 0.02, z };
    if (
      !collides(g.world, q, 2.65, 1.1) &&
      BLOCKS[g.world.get(x, y - 0.05, z)]?.solid &&
      !g.world.raycast(
        { x: p.x, y: p.y + 1.1, z: p.z },
        { x: (x - p.x) / 5, y: 0, z: (z - p.z) / 5 },
        4.4,
      )
    )
      return q;
  }
  return null;
}
export function summonVerity(g) {
  if (
    g.dimension !== "overworld" ||
    g.multiplayer?.isGuest ||
    g.giganto?.active
  )
    return false;
  const s = verityRecord(g.world);
  if (s.active) return false;
  const who = actors(g).find((a) => safeDanceFloor(g, a.player) && !a.menu);
  if (!who) return false;
  const q = findVeritySpot(g, who.player);
  if (!q) return false;
  s.visits++;
  s.active = {
    ...q,
    id: `verity:${s.visits}`,
    age: 0,
    phase: "arrival",
    participants: [],
    yaw: Math.atan2(who.player.x - q.x, who.player.z - q.z),
  };
  return true;
}
export function clearVerityDance(p) {
  delete p.verityDance;
}
export const VERITY_DURATION =
  VERITY.arrival + VERITY.beat * VERITY.beats + VERITY.departure;
export const VERITY_KEYS = Object.freeze({
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  KeyW: "kick",
  ArrowUp: "kick",
  KeyS: "clap",
  ArrowDown: "clap",
  Space: "clap",
  KeyF: "clap",
});
export function nextVerityBeat(d) {
  let beat = Math.max(
    0,
    Math.ceil(((d?.time || 0) - VERITY.good) / VERITY.beat),
  );
  while (beat < VERITY.beats && d?.used?.includes(beat)) beat++;
  return beat;
}
export function verityHitBeat(d, step) {
  if (!d || d.phase !== "dance" || !VERITY.steps.includes(step)) return -1;
  const nearest = Math.round(d.time / VERITY.beat);
  return (
    [nearest, nearest - 1, nearest + 1].find(
      (beat) =>
        beat >= 0 &&
        beat < VERITY.beats &&
        !d.used?.includes(beat) &&
        VERITY.steps[beat % VERITY.steps.length] === step &&
        Math.abs(d.time - beat * VERITY.beat) <= VERITY.good,
    ) ?? -1
  );
}
export function verityStickStep(move, previous) {
  const x = move?.x || 0,
    y = move?.y || 0,
    strength = Math.max(Math.abs(x), Math.abs(y));
  if (strength < (previous ? 0.28 : 0.58)) return null;
  if (strength < 0.58) return previous;
  return Math.abs(x) > Math.abs(y)
    ? x < 0
      ? "left"
      : "right"
    : y < 0
      ? "kick"
      : "clap";
}
export function scoreVerityStep(g, p, step) {
  const d = p.verityDance,
    beat = verityHitBeat(d, step);
  if (beat < 0) return false;
  const error = Math.abs(d.time - beat * VERITY.beat);
  (d.used ||= []).push(beat);
  d.score += error <= VERITY.perfect ? 2 : 1;
  d.feedback = error <= VERITY.perfect ? "PERFECT" : "GOOD";
  d.feedbackUntil = d.time + 0.4;
  return true;
}
export function tickVerity(g, { dropItem } = {}) {
  if (g.multiplayer?.isGuest) return;
  if (g.dimension !== "overworld") {
    for (const a of actors(g)) clearVerityDance(a.player);
    return;
  }
  const s = verityRecord(g.world),
    people = actors(g),
    now = g.world.tick || g.tickCount || 0;
  if (!s.active) {
    // A paused singleplayer menu never advances world ticks. In co-op only
    // players present in this dimension can be selected by the authority.
    if (
      now >= s.next &&
      g.rules?.doMobSpawning !== false &&
      !g.giganto?.active
    ) {
      if (!summonVerity(g)) s.next = now + 200;
    }
    for (const a of people)
      if (a.player.verityDance) clearVerityDance(a.player);
    return;
  }
  const r = s.active;
  r.age += 0.05;
  r.phase =
    r.age < VERITY.arrival
      ? "arrival"
      : r.age < VERITY.arrival + VERITY.beat * VERITY.beats
        ? "dance"
        : "bow";
  for (const a of people) {
    const p = a.player;
    if (
      p.verityDance &&
      (p.verityDance.id !== r.id ||
        p.health <= 0 ||
        p.multiplayerAway ||
        !validPosition(p) ||
        Math.hypot(p.x - r.x, p.z - r.z) > VERITY.radius + 3)
    )
      clearVerityDance(p);
    if (
      !p.verityDance &&
      r.age < VERITY.arrival &&
      Math.hypot(p.x - r.x, p.z - r.z) <= VERITY.radius &&
      safeDanceFloor(g, p) &&
      !a.menu
    ) {
      p.verityDance = {
        id: r.id,
        phase: "arrival",
        time: 0,
        score: 0,
        used: [],
        yaw: p.yaw,
        pitch: p.pitch,
      };
      r.participants.push(a.id);
      p.vx = p.vy = p.vz = 0;
      delete p.editionDraw;
      delete p.tricksterDash;
      p.shieldRaised = false;
      if (a.context) delete a.context.tridentCharge;
      const peer = g.multiplayer?.peerForPlayer?.(p);
      if (peer) {
        peer.keys.clear();
        peer.mine = false;
        peer.teleport = true;
      }
      if (a.peer || a.resume) {
        a.keys = new Set();
        a.mine = false;
        a.teleport = true;
      }
    }
    const d = p.verityDance;
    if (!d) continue;
    d.phase = r.phase;
    d.time = Math.max(0, r.age - VERITY.arrival);
    if (!safeSupport(g, p)) {
      clearVerityDance(p);
      continue;
    }
    if (r.phase === "bow" && !d.rewarded) {
      d.rewarded = true;
      if (d.score >= VERITY.beats) {
        p.xp = (p.xp || 0) + 5;
        const stack = makeStack("emerald", 1),
          left = a.inventory?.add(stack);
        if (left)
          dropItem?.(
            a.context || g,
            { ...stack, count: left },
            p.x,
            p.y + 0.5,
            p.z,
            20,
          );
      }
      p.verityBest = Math.max(p.verityBest || 0, d.score);
    }
  }
  if (
    r.age >= VERITY.arrival + VERITY.beat * VERITY.beats + VERITY.departure ||
    !people.some((a) => a.player.verityDance?.id === r.id)
  ) {
    for (const a of people)
      if (a.player.verityDance?.id === r.id) clearVerityDance(a.player);
    s.active = null;
    s.next = now + VERITY.revisit;
  }
}
function safeSupport(g, p) {
  return (
    p.health > 0 &&
    !p.multiplayerAway &&
    !p.inWater &&
    !p.burning &&
    !!BLOCKS[g.world.get(p.x, p.y - 0.08, p.z)]?.solid
  );
}

export function cleanDanceVisual(d) {
  if (
    !d ||
    typeof d.id !== "string" ||
    d.id.length > 40 ||
    !["arrival", "dance", "bow"].includes(d.phase) ||
    !Number.isFinite(d.time)
  )
    return null;
  return {
    id: d.id,
    phase: d.phase,
    time: Math.max(0, Math.min(VERITY_DURATION, d.time)),
  };
}
