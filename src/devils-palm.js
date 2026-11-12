import { recordAchievement } from "./achievements.js";
import { B, SEA } from "./data.js";
import { hash, hashSeed } from "./random.js";
import { relicSite } from "./relic.js";
import { STANDS, palmConfig, fateWeights, selectFate } from "./stands-data.js";
import { PALM_RADIUS, palmContains, invalidatePalm } from "./palm-terrain.js";
import {
  standRecord,
  tickStand,
  tickStandProjectiles,
} from "./stand-abilities.js";

export function ensurePalm(world) {
  const state = (world.palm ||= {
    version: 1,
    revision: 0,
    serial: 0,
    sites: [],
    nextMove: 0,
    search: 0,
    nextSearch: 0,
    config: palmConfig(),
  });
  state.config = palmConfig(state.config);
  return state;
}
export function palmContexts(g) {
  return [
    g,
    ...(g.multiplayer?.connected && !g.multiplayer.isGuest
      ? [...g.multiplayer.peers.values()].map((p) => p.context)
      : []),
  ];
}
function safeSite(g, x, z) {
  const w = g.world,
    r = PALM_RADIUS + 8;
  if (Math.hypot(x - g.spawn.x, z - g.spawn.z) < 200) return false;
  if (
    (w.palm?.sites || []).some((s) => Math.hypot(s.x - x, s.z - z) < r * 2 + 40)
  )
    return false;
  if (
    (w.protectedAreas || []).some(
      (a) => Math.hypot(a.x - x, a.z - z) < a.radius + r,
    )
  )
    return false;
  for (let cz = Math.floor((z - r) / 16); cz <= Math.floor((z + r) / 16); cz++)
    for (
      let cx = Math.floor((x - r) / 16);
      cx <= Math.floor((x + r) / 16);
      cx++
    )
      if (w.editChunks.get(`${cx},${cz}`)?.length) return false;
  if (
    w
      .nearbyVillages(x, z, r + 80)
      .some((v) => Math.hypot(v.x - x, v.z - z) < r + 75)
  )
    return false;
  const temple = relicSite(w);
  if (temple && Math.hypot(temple.x - x, temple.z - z) < r + 80) return false;
  for (const record of Object.values(w.settlements))
    if (
      record?.x !== undefined &&
      Math.hypot(record.x - x, record.z - z) < r + 40
    )
      return false;
  if (
    palmContexts(g).some(
      (ctx) => Math.hypot(ctx.player.x - x, ctx.player.z - z) < r + 24,
    )
  )
    return false;
  const values = [
    [0, 0],
    [-50, -50],
    [50, 50],
    [-50, 50],
    [50, -50],
  ].map(([a, b]) => w.terrain(x + a, z + b).h);
  return (
    Math.min(...values) > SEA + 3 &&
    Math.max(...values) - Math.min(...values) < 22 &&
    Math.max(...values) < 220
  );
}
export function seekPalmSite(g, attempts = 6) {
  const w = g.world,
    state = ensurePalm(w);
  for (let i = 0; i < attempts; i++) {
    const n = state.search++,
      a = hash(n, state.serial, 7, w.seedInt + 753) * Math.PI * 2,
      r = 640 + hash(n, 1, state.serial, w.seedInt + 90) * 1600;
    const x = Math.floor(g.spawn.x + Math.cos(a) * r),
      z = Math.floor(g.spawn.z + Math.sin(a) * r),
      t = w.terrain(x, z),
      preferred = ["desert", "badlands"].includes(t.biome);
    if (
      hash(n, 2, state.serial, w.seedInt) >
        state.config.rarity * (preferred ? 1 : n > 200 ? 0.12 : 0) ||
      !safeSite(g, x, z)
    )
      continue;
    return {
      id: `palm:${++state.serial}`,
      serial: state.serial,
      x,
      y: t.h,
      z,
      angle: hash(n, 4, 0, w.seedInt) * Math.PI * 2,
      seed: w.seedInt ^ Math.imul(state.serial, 104729),
      phase: "active",
    };
  }
  return null;
}
export function addPalmSite(g, site) {
  const state = ensurePalm(g.world);
  state.sites.push(site);
  state.revision++;
  state.nextMove = g.tickCount + state.config.relocationDays * 24000;
  invalidatePalm(g.world, [site]);
  g.renderer && (g.renderer.epoch++, g.renderer.jobs?.clear());
  return site;
}
function modified(w, site) {
  for (
    let cz = Math.floor((site.z - PALM_RADIUS) / 16);
    cz <= Math.floor((site.z + PALM_RADIUS) / 16);
    cz++
  )
    for (
      let cx = Math.floor((site.x - PALM_RADIUS) / 16);
      cx <= Math.floor((site.x + PALM_RADIUS) / 16);
      cx++
    )
      if (w.editChunks.get(`${cx},${cz}`)?.length) return true;
  return false;
}
export function relocatePalm(g) {
  const state = ensurePalm(g.world),
    contexts = palmContexts(g);
  if (contexts.some((ctx) => ctx.player.standData?.trial?.phase === "trial"))
    return false;
  if (
    state.sites.some(
      (s) =>
        s.phase === "active" &&
        contexts.some((ctx) => palmContains(s, ctx.player, 25)),
    )
  )
    return false;

  const next = seekPalmSite(g, 12);
  if (!next) return false;
  const old = state.sites.filter((s) => s.phase === "active");
  // Preserve discovered/edited formations as harmless ruins; untouched ground
  // regenerates from its original seed. The player's edit layer always wins.
  for (const s of old) {
    s.phase = "ruin";
    const offline = Object.values(g.multiplayer?.savedPlayers || {}).some(
      (record) =>
        record.player &&
        palmContains({ ...s, phase: "active" }, record.player, 25),
    );
    if (!modified(g.world, s) && !s.chamberInitialized && !offline) {
      state.sites = state.sites.filter((o) => o !== s);
      for (const [key, c] of Object.entries(g.world.containers))
        if (c.palmSite === s.id) delete g.world.containers[key];
    }
  }
  state.sites.push(next);
  state.revision++;
  state.nextMove = g.tickCount + state.config.relocationDays * 24000;
  invalidatePalm(g.world, [...old, next]);
  g.renderer && (g.renderer.epoch++, g.renderer.jobs?.clear());
  return true;
}
function persist(g) {
  g.save?.()?.catch?.(() =>
    g.ui?.toast?.("Save failed. Export a backup before closing."),
  );
}
function corpseReward(g, site, s, config) {
  if (hash(s.soul, s.serial, 19, g.world.seedInt) >= config.corpseChance / 100)
    return;
  site.corpseClaims ||= [];
  if (site.corpseClaims.includes(s.soul)) return;
  site.corpseClaims.push(s.soul);
  const x = site.x + 16,
    y = site.y - 13,
    z = site.z + 8,
    key = `${x},${y},${z}`;
  // Load the normal chest once; never recreate a destroyed or mined chest.
  const id = g.world.get(x, y, z),
    chest = g.world.containers[key];
  if (id === B.chest && chest) {
    const slot = chest.slots.findIndex((o) => !o);
    if (slot >= 0) {
      chest.slots[slot] = { id: "saint_corpse_part", count: 1 };
      g.ui?.toast?.("Something ancient stirs beneath the ruined shrine...");
      return;
    }
  }
  const remaining = g.inventory.add({ id: "saint_corpse_part", count: 1 });
  if (remaining)
    (g.drops ||= []).push({
      id: "saint_corpse_part",
      count: 1,
      uid: `corpse:${s.soul}:${s.serial}`,
      x: g.player.x,
      y: g.player.y + 1,
      z: g.player.z,
      vy: 0,
      age: 0,
      delay: 10,
    });
}
export function resolvePalmTrial(g, site) {
  const s = standRecord(g.player),
    t = s.trial,
    c = palmConfig(g.world.palm?.config);
  if (
    !t ||
    t.phase !== "trial" ||
    t.elapsed < Math.round(c.trialSeconds * 20) ||
    g.player.health <= 0
  )
    return false;
  const weights = fateWeights(c, s.failures),
    roll = hash(s.soul, t.serial, site.serial, g.world.seedInt + 9781),
    outcome =
      g.devStands && s.forceOutcome
        ? s.forceOutcome
        : selectFate(roll, weights);
  delete s.forceOutcome;
  // Commit the ledger before emitting effects, death, rewards or a save. Reload,
  // duplicate commands and repeated simulation frames cannot roll it again.
  t.phase = "resolved";
  t.outcome = outcome;
  s.lastFate = { serial: t.serial, site: site.id, roll, weights, outcome };
  if (outcome === "stand") {
    const choices = Object.keys(STANDS),
      chosen =
        g.devStands && s.forceStand && STANDS[s.forceStand]
          ? s.forceStand
          : choices[
              Math.floor(
                hash(s.soul, t.serial, 91, g.world.seedInt) * choices.length,
              )
            ];
    delete s.forceStand;
    s.id = chosen;
    recordAchievement(g,"stand-awaken");
    s.summoned = true;
    s.energy = 100;
    s.cooldowns = {};
    s.failures = 0;
    s.level = 1;
    s.xp = 0;
    s.awakeningUntil = g.tickCount + 60;
    s.transformed = false;
    s.effect = {
      kind: "awaken",
      tick: g.tickCount,
      x: g.player.x,
      y: g.player.y,
      z: g.player.z,
    };
    g.ui?.announce?.(
      "YOUR STAND HAS AWAKENED!",
      `${STANDS[chosen].name} · ${STANDS[chosen].primary.name}`,
    );
    g.ui?.toast?.(
      `${STANDS[chosen].name}: ${STANDS[chosen].description}`,
      8000,
    );
    g.audio?.standSound?.("awaken");
    corpseReward(g, site, s, c);
  } else {
    s.failures = (s.failures || 0) + 1;
    if (outcome === "death") {
      s.effect = {
        kind: "reject",
        tick: g.tickCount,
        x: g.player.x,
        y: g.player.y,
        z: g.player.z,
      };
      g.ui?.announce?.(
        "THE DEVIL'S PALM HAS REJECTED YOU.",
        g.mode === "creative" && !c.creativeDeath
          ? "Creative protects you from this fate."
          : "The sand falls silent.",
      );
      g.audio?.standSound?.("reject");
      if (g.mode !== "creative" || c.creativeDeath) {
        g.player.hurt = 0;
        g.damage(1000000, "the Devil's Palm", c.creativeDeath);
      }
    } else {
      g.ui?.announce?.(
        "THE PRESENCE FADES",
        "You survived. No Stand answered.",
      );
      g.audio?.standSound?.("neutral");
    }
  }
  persist(g);
  return true;
}
export function tickPalm(g, damage) {
  if (g.multiplayer?.isGuest) return;
  const contexts = palmContexts(g);
  for (const ctx of contexts) {
    const s = standRecord(ctx.player);
    s.soul ??= hashSeed(
      `${g.id || g.world.seed}:${ctx.standIdentity || "host"}`,
    );
    ctx.standFriends = () => contexts.map((o) => o.player);
    tickStand(ctx);
  }
  tickStandProjectiles(g, damage);
  if (g.world.dimension !== "overworld") {
    for (const ctx of contexts)
      if (ctx.player.standData) ctx.player.standData.trial = null;
    return;
  }
  const state = ensurePalm(g.world),
    active = state.sites.filter((s) => s.phase === "active");
  if (
    g.tickCount >= (state.nextSearch || 0) &&
    active.length < state.config.activeCount
  ) {
    state.nextSearch = g.tickCount + 20;
    const site = seekPalmSite(g);
    if (site) addPalmSite(g, site);
  }
  if (
    state.nextMove &&
    g.tickCount >= state.nextMove &&
    g.tickCount % 100 === 0
  )
    relocatePalm(g);
  for (const ctx of contexts) {
    const p = ctx.player,
      s = standRecord(p),
      site = state.sites.find((o) => palmContains(o, p));
    if (p.health <= 0) {
      s.trial = null;
      continue;
    }
    if (!site) {
      if (s.trial?.phase === "trial") {
        s.trial = null;
        ctx.ui?.toast?.("You escaped the presence. No fate was rolled.");
        persist(ctx);
      } else s.trial = null;
      continue;
    }
    if (s.id && !state.config.allowReplacement) {
      if (s.trial?.phase === "trial") {
        s.trial = null;
        persist(ctx);
      }
      continue;
    }
    if (!s.trial) {
      s.serial = (s.serial || 0) + 1;
      s.trial = {
        site: site.id,
        serial: s.serial,
        phase: "trial",
        elapsed: 0,
        started: g.tickCount,
        signal: 0,
        nextPhenomenon: 80,
      };
      ctx.ui?.announce?.(
        "You feel an unnatural presence...",
        "The wind seems to whisper your name.",
      );
      ctx.audio?.standSound?.("presence");
      persist(ctx);
    }
    const t = s.trial;
    if (t.phase !== "trial") continue;
    if (t.site !== site.id) {
      s.trial = null;
      continue;
    }
    t.elapsed++;
    t.intensity = Math.min(1, t.elapsed / (state.config.trialSeconds * 20));
    if (t.elapsed >= (t.nextPhenomenon || 100)) {
      t.signalTick = t.elapsed;
      t.nextPhenomenon =
        t.elapsed +
        80 +
        Math.floor(
          hash(s.soul, t.serial, t.signal, g.world.seedInt + 12) * 100,
        );
      t.signal++;
      t.phenomenon = Math.floor(
        hash(s.soul, t.serial, t.signal, g.world.seedInt) * 4,
      );
      ctx.audio?.standSound?.(
        ["whisper", "tremor", "whisper", "wind"][t.phenomenon],
      );
      if (ctx.mode !== "creative") {
        p.exhaustion = (p.exhaustion || 0) + 1.8;
        if (t.phenomenon === 1 && p.health > 3)
          ctx.damage(1, "the Devil's Palm");
      }
      if (t.phenomenon === 2)
        for (const e of g.entities)
          if (
            e.hp > 0 &&
            !["villager", "iron_golem", "watcher"].includes(e.type) &&
            Math.hypot(e.x - p.x, e.z - p.z) < 16
          )
            e.flee = Math.max(e.flee || 0, 100);
    }
    resolvePalmTrial(ctx, site);
  }
}
export function configurePalm(g, input) {
  if (g.multiplayer?.isGuest) return false;
  const s = ensurePalm(g.world),
    next = palmConfig({ ...s.config, ...input });
  if (
    next.activeCount < s.config.activeCount &&
    palmContexts(g).some((c) => c.player.standData?.trial?.phase === "trial")
  ) {
    g.ui?.toast?.("Finish active trials before reducing the Palm count.");
    return false;
  }
  const active = s.sites.filter((o) => o.phase === "active");
  for (const site of active.slice(next.activeCount)) site.phase = "ruin";
  s.config = next;
  s.revision++;
  s.nextMove = g.tickCount + s.config.relocationDays * 24000;
  persist(g);
  return true;
}
export function palmDev(g, args) {
  if (!g.devStands || g.multiplayer?.isGuest)
    throw Error("Palm development commands are disabled in this build.");
  const state = ensurePalm(g.world),
    s = standRecord(g.player);
  if (args[0] === "spawn") {
    const x = Math.floor(g.player.x + 140),
      z = Math.floor(g.player.z),
      y = g.world.terrain(x, z).h;
    // Debug is deliberately opt-in, but still refuses player edits/protected land.
    if (
      !safeSite({ ...g, spawn: { x: g.player.x - 1000, z: g.player.z } }, x, z)
    )
      throw Error(
        "Debug site is occupied, protected or too uneven. Move to clear ground.",
      );
    return addPalmSite(g, {
      id: `palm:${++state.serial}`,
      serial: state.serial,
      x,
      y,
      z,
      seed: g.world.seedInt,
      angle: 0,
      phase: "active",
    });
  }
  if (args[0] === "trial") {
    const site = state.sites.find((o) => palmContains(o, g.player));
    if (!site) throw Error("Enter a Palm first.");
    s.trial = null;
    s.id = null;
    return true;
  }
  if (
    args[0] === "outcome" &&
    ["stand", "death", "neutral"].includes(args[1])
  ) {
    s.forceOutcome = args[1];
    if (STANDS[args[2]]) s.forceStand = args[2];
    return true;
  }
  if (args[0] === "relocate") return relocatePalm(g);
  throw Error(
    "Use /palmdev spawn | trial | outcome stand|death|neutral [tusk|lonesome|monsters|cream|d4c] | relocate.",
  );
}
