import {
  weatherColumnLoaded,
  weatherRoof,
  weatherBodyLoaded,
} from "./weather-spatial.js";
import { playerHeight, playerEye } from "./player-body.js";
import { tickSnow } from "./snow.js";
import { B, BLOCKS, MOB_INFO } from "./data.js";
import { hash } from "./random.js";
import { moveBody } from "./physics.js";
export const WEATHER_KINDS = ["clear", "rain", "thunder", "hail", "tornado"];
export function biomeWeatherProfile(biome) {
  if (["desert", "badlands"].includes(biome))
    return { rate: 0.5, storm: 0, hail: 0, tornado: 0, dry: true };
  if (
    ["alpine", "snowy_taiga", "frozen_ocean", "deep_frozen_ocean"].includes(
      biome,
    )
  )
    return { rate: 2.2, storm: 0.06, hail: 0.1, tornado: 0.005 };
  if (biome === "jungle" || biome === "marsh")
    return { rate: 3, storm: 0.4, hail: 0.01, tornado: 0.01 };
  if (biome?.includes("ocean"))
    return { rate: 1.5, storm: 0.3, hail: 0.04, tornado: 0.005 };
  return { rate: 1, storm: 0.21, hail: 0.11, tornado: 0.04 };
}
export function createWeather(seed = 0) {
  return {
    kind: "clear",
    override: null,
    remaining: 6000 + Math.floor(hash(seed, 2, 71) * 12000),
    serial: 0,
    intensity: 0,
    nextStrike: 0,
    strike: null,
    funnel: null,
  };
}
export function restoreWeather(value, seed = 0) {
  const base = createWeather(seed);
  if (!value || typeof value !== "object") return base;
  return {
    ...base,
    kind: WEATHER_KINDS.includes(value.kind) ? value.kind : "clear",
    override: WEATHER_KINDS.includes(value.override) ? value.override : null,
    remaining: Number.isFinite(value.remaining)
      ? Math.max(1, Math.min(72000, Math.floor(value.remaining)))
      : base.remaining,
    serial: Math.max(0, Math.floor(value.serial || 0)),
    intensity: Math.max(0, Math.min(1, Number(value.intensity) || 0)),
    nextStrike: Math.max(0, Number(value.nextStrike) || 0),
    strike:
      value.strike &&
      ["x", "y", "z", "tick"].every((k) => Number.isFinite(value.strike[k]))
        ? { ...value.strike }
        : null,
    funnel:
      value.funnel &&
      ["x", "z", "age", "seed"].every((k) => Number.isFinite(value.funnel[k]))
        ? {
            ...value.funnel,
            heading: Number.isFinite(value.funnel.heading)
              ? value.funnel.heading
              : undefined,
            drift: Number.isFinite(value.funnel.drift)
              ? Math.max(-1, Math.min(1, value.funnel.drift))
              : 0,
          }
        : null,
  };
}
export function setWeather(world, kind) {
  const w = (world.weather ||= createWeather(world.seedInt));
  w.override = WEATHER_KINDS.includes(kind) ? kind : null;
  if (w.override) w.kind = w.override;
  w.remaining = 6000;
  w.nextStrike = 0;
  w.funnel = null;
  if (kind === "clear") w.strike = null;
  return w;
}
export function tickWeather(game) {
  const world = game.world;
  if (world.dimension === "cinderwild" || world.dimension === "end") return;
  const w = (world.weather ||= createWeather(world.seedInt));
  const climate = biomeWeatherProfile(
    world.terrain(game.player.x, game.player.z).biome,
  );
  if (w.override) w.kind = w.override;
  else if ((w.remaining -= w.kind === "clear" ? climate.rate : 1) <= 0) {
    w.serial++;
    const r = hash(world.seedInt, w.serial, 819);
    w.kind =
      w.kind === "clear" && !climate.dry
        ? r < climate.tornado
          ? "tornado"
          : r < climate.tornado + climate.hail
            ? "hail"
            : r < climate.tornado + climate.hail + climate.storm
              ? "thunder"
              : "rain"
        : "clear";
    w.remaining =
      w.kind === "clear"
        ? 6000 + Math.floor(r * 18000)
        : 4000 + Math.floor(r * 8000);
  }
  w.intensity += ((w.kind === "clear" ? 0 : 1) - w.intensity) * 0.0035;
  if (
    ["thunder", "tornado"].includes(w.kind) &&
    w.intensity > 0.5 &&
    world.tick >= w.nextStrike
  ) {
    const n = w.serial++ + world.tick,
      angle = hash(n, 2, world.seedInt) * Math.PI * 2,
      r = 18 + hash(n, 3, world.seedInt) * 45;
    const x = Math.floor(game.player.x + Math.sin(angle) * r),
      z = Math.floor(game.player.z + Math.cos(angle) * r),
      t = world.terrain(x, z);
    if (precipitation(t.biome, t.h) !== "none")
      w.strike = { x, y: Math.max(t.h, 62) + 1, z, tick: world.tick, seed: n };
    w.nextStrike =
      world.tick + 100 + Math.floor(hash(n, 4, world.seedInt) * 240);
  }
  if (w.kind === "tornado") {
    if (!w.funnel) {
      const angle = hash(w.serial, 11, world.seedInt) * Math.PI * 2;
      w.funnel = {
        x: game.player.x + Math.cos(angle) * 58,
        z: game.player.z + Math.sin(angle) * 58,
        age: 0,
        seed: world.tick + world.seedInt,
        heading: angle + Math.PI,
        drift: hash(w.serial, 9, world.seedInt) * 2 - 1,
      };
      game.ui?.announce?.(
        "TORNADO WARNING",
        "A funnel is approaching. Get beneath a solid roof.",
      );
    }
    w.funnel.age++;
    // A seeded track crosses the warning area instead of drifting away forever.
    // It never homes in on the player; a funnel can be outrun or sheltered from.
    const f = w.funnel;
    f.drift ??= 0;
    f.heading ??= Math.atan2(game.player.z - f.z, game.player.x - f.x);
    const heading = f.heading + Math.sin(f.age / 480 + (f.drift || 0)) * 0.35;
    f.x += Math.cos(heading) * 0.085;
    f.z += Math.sin(heading) * 0.085;
    if (world.tick % 4 === 0 && w.intensity > 0.55) {
      const people = [
        game.player,
        ...(game.multiplayer?.peers?.values?.() || []),
      ].map((p) => p.player || p);
      for (const bodies of [game.entities || [], game.drops || []])
        for (const body of bodies) {
          // Cull before any roof/collision query, including persisted distant mobs.
          if (
            body.hp <= 0 ||
            body.count <= 0 ||
            !Number.isFinite(body.x + body.y + body.z)
          )
            continue;
          const dx = f.x - body.x,
            dz = f.z - body.z,
            d = Math.hypot(dx, dz);
          if (
            d <= 0.1 ||
            d >= 18 ||
            !weatherColumnLoaded(world, body.x, body.z)
          )
            continue;
          const roof = weatherRoof(world, body.x, body.z);
          if (roof === null || body.y + 0.7 <= roof) continue;
          const height =
            body.type === "boat"
              ? 0.5
              : body.type
                ? MOB_INFO[body.type]?.height || 1
                : 0.25;
          const width =
            body.type === "boat"
              ? 1.3
              : body.type
                ? MOB_INFO[body.type]?.width || 0.6
                : 0.25;
          const mx = (dx / d - dz / d) * 0.25,
            mz = (dz / d + dx / d) * 0.25;
          if (!weatherBodyLoaded(world, body, mx, mz, width)) continue;
          moveBody(world, body, mx, 0, mz, height, width);
          body.vy = Math.max(body.vy || 0, d < 9 ? 3 : 0);
        }
      // Loose vegetation is debris. Buildings, containers and terrain remain safe.
      if (world.tick % 20 === 0)
        for (let i = 0; i < 4; i++) {
          const x = Math.floor(f.x + (hash(f.age, i, 1, f.seed) - 0.5) * 12),
            z = Math.floor(f.z + (hash(f.age, i, 2, f.seed) - 0.5) * 12);
          if (!world.chunks.has(`${Math.floor(x / 16)},${Math.floor(z / 16)}`))
            continue;
          const y = weatherRoof(world, x, z) + 1,
            id = world.get(x, y, z);
          if (
            [B.wild_grass, B.fern, B.poppy, B.cornflower].includes(id) &&
            !people.some((p) => Math.hypot(p.x - x, p.z - z) < 1)
          )
            world.set(x, y, z, B.air);
        }
    }
  } else w.funnel = null;
  tickSnow(game, precipitation);
  tickWeatherDamage(game);
}
export function tickWeatherDamage(game) {
  const world = game.world,
    w = world.weather;
  if (!w || world.dimension === "cinderwild") return;
  if (
    w.intensity < 0.55 ||
    game.mode === "creative" ||
    game.difficulty === "peaceful"
  )
    return;
  const p = game.player,
    view = weatherAt(world, p);
  if (!view.exposed || p.health <= 0) return;
  if (w.kind === "hail" && view.type !== "none" && world.tick % 60 === 0)
    game.damage?.(1, "hailstones");
  if (w.kind === "tornado" && w.funnel) {
    const dx = w.funnel.x - p.x,
      dz = w.funnel.z - p.z,
      d = Math.hypot(dx, dz);
    if (
      d < 28 &&
      d > 0.1 &&
      p.y <
        Math.max(
          62,
          world.terrain(Math.floor(w.funnel.x), Math.floor(w.funnel.z)).h,
        ) +
          62
    ) {
      const force = (1 - d / 28) * w.intensity;
      if (
        weatherBodyLoaded(
          world,
          p,
          (dx / d - (dz / d) * 1.8) * force * 0.18,
          (dz / d + (dx / d) * 1.8) * force * 0.18,
          p.standData?.transformed ? 0.9 : 0.6,
        )
      )
        moveBody(
          world,
          p,
          (dx / d - (dz / d) * 1.8) * force * 0.18,
          0,
          (dz / d + (dx / d) * 1.8) * force * 0.18,
          playerHeight(p),
          p.standData?.transformed ? 0.9 : 0.6,
        );
      if (d < 13) p.vy = Math.max(p.vy, 4 + force * 2);
      if (world.tick % 40 === 0) game.damage?.(1, "tornado debris");
    }
  }
}
export function precipitation(biome, height = 70) {
  if (["desert", "badlands", "cinderwild"].includes(biome)) return "none";
  return [
    "alpine",
    "snowy_taiga",
    "frozen_ocean",
    "deep_frozen_ocean",
  ].includes(biome) || height > 140
    ? "snow"
    : "rain";
}
export function weatherAt(world, p) {
  const w = world.weather || createWeather(world.seedInt),
    t = world.terrain(p.x, p.z);
  const cinder = world.dimension === "cinderwild",
    kind = cinder ? "clear" : w.kind;
  const intensity = cinder ? 0 : w.intensity,
    type = precipitation(t.biome, Math.max(t.h, p.y));
  const roof = weatherRoof(world, p.x, p.z) ?? t.h;
  return {
    kind,
    intensity,
    type,
    rain: type === "rain" ? intensity : 0,
    snow: type === "snow" ? intensity : 0,
    exposed: p.y + playerEye(p) > roof + 0.1,
    roof,
    biome: t.biome,
    storm: ["thunder", "hail", "tornado"].includes(kind) && intensity > 0.5,
    hail: kind === "hail" && type !== "none" ? intensity : 0,
    funnel: cinder ? null : w.funnel,
    flash:
      !cinder && w.strike
        ? Math.max(0, 1 - (world.tick - w.strike.tick) / 5)
        : 0,
    strike: cinder ? null : w.strike,
  };
}
