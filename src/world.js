import {
  emittedLight,
  dirtyLightRegion,
  nearbyBlockLight,
} from "./block-light.js";
import { generateEdition } from "./edition-generation.js";
import {
  registerEditionChunk,
  tickEditionWorld,
} from "./edition-interactions.js";
import { blockParts } from "./block-shapes.js";
import { registerAquatic, setAquaticCell } from "./aquatic.js";
import { generateOcean } from "./ocean-generation.js";
import { generatePalm } from "./palm-terrain.js";
import { generateSpacedOres, generateMineshafts } from "./cave-update.js";
import {
  wakeDynamicsChunk,
  initDynamics,
  notifyDynamics,
  restoreDynamics,
  simulateDynamics,
  isWater,
  fluid,
} from "./block-dynamics.js";
import { carveCaveSystems } from "./caves.js";
import { cinderTerrain, generateCinderworld } from "./cinderworld.js";
import { createWeather, precipitation } from "./weather.js";
import { variedTerrain, surfaceBlock, decorateTrees } from "./biomes.js";
import {
  B,
  BLOCKS,
  MIN_Y,
  MAX_Y,
  CHUNK,
  SEA,
  GENERATION_VERSION,
} from "./data.js";
import { generateRelic } from "./relic.js";
import { hashSeed, hash, noise2, noise3, fractal } from "./random.js";
import { blockBounds, doorId, rayBounds } from "./doors.js";
import {
  villageTerrain,
  generateVillages,
  nearbyVillages,
} from "./villages.js";
export const chunkKey = (x, z) => `${x},${z}`;
export const coordKey = (x, y, z) => `${x},${y},${z}`;
export const index = (x, y, z) => (y - MIN_Y) * 256 + z * 16 + x;
export class World {
  constructor(
    seed,
    edits = {},
    dimension = "overworld",
    generationVersion = GENERATION_VERSION,
  ) {
    this.seed = String(seed);
    this.generationVersion = generationVersion;
    this.terrainCache = new Map();
    this.settlements = {};
    this.relicClaimed = false;
    this.caneRoots = new Set();
    this.revisions = new Map();
    this.meshRevision = 0;
    this.dimension = dimension;
    this.seedInt = hashSeed(
      dimension === "overworld" ? seed : `${seed}:cinderwild`,
    );
    this.weather = createWeather(this.seedInt);
    this.skyCache = new Map();
    this.portals = {};
    this.chunks = new Map();
    this.edits = new Map(Object.entries(edits));
    this.editChunks = new Map();
    this.dirty = new Set();
    this.containers = {};
    this.cropTicks = {};
    this.tick = 0;
    this.pending = [];
    this.generatedLights = new Set();
    initDynamics(this);
    for (const [key, id] of this.edits) {
      const [x, y, z] = key.split(",").map(Number),
        ck = chunkKey(Math.floor(x / 16), Math.floor(z / 16));
      if (!this.editChunks.has(ck)) this.editChunks.set(ck, []);
      this.editChunks.get(ck).push([x, y, z, id]);
    }
  }
  restoreDynamics(timers = {}) {
    restoreDynamics(this, timers);
  }
  terrain(x, z) {
    const key = Number.isInteger(x) && Number.isInteger(z) ? `${x},${z}` : null;
    if (key && this.terrainCache.has(key)) return this.terrainCache.get(key);
    const base = this.baseTerrain(x, z);
    const result =
      this.dimension === "overworld" && this.generationVersion >= 3
        ? villageTerrain(this, x, z, base)
        : base;
    if (key) {
      if (this.terrainCache.size >= 16384) this.terrainCache.clear();
      this.terrainCache.set(key, result);
    }
    return result;
  }
  nearbyVillages(x, z, radius = 64) {
    return nearbyVillages(this, x, z, radius);
  }
  baseTerrain(x, z) {
    if (this.dimension === "cinderwild" && this.generationVersion >= 7)
      return cinderTerrain(this, x, z);
    if (this.dimension === "cinderwild")
      return {
        h: Math.floor(
          58 +
            fractal(x / 65, z / 65, this.seedInt) * 35 +
            noise2(x / 17, z / 17, this.seedInt + 8) * 9,
        ),
        biome: "cinderwild",
        river: 1,
        land: 1,
      };
    if (this.generationVersion >= 4)
      return variedTerrain(x, z, this.seedInt, this.generationVersion);
    const s = this.seedInt,
      land = fractal(x / 170, z / 170, s),
      mount = fractal(x / 70, z / 70, s + 71),
      temp = noise2(x / 240, z / 240, s + 41),
      wet = noise2(x / 160, z / 160, s + 93);
    const river = Math.abs(noise2(x / 92, z / 92, s + 999) - 0.5);
    let h = Math.floor(
      49 + land * 35 + Math.pow(Math.max(0, mount - 0.53) * 3, 2) * 24,
    );
    if (river < 0.032) h = Math.min(h, 58 + Math.floor(river * 100));
    const lake = noise2(x / 30, z / 30, s + 13);
    if (lake > 0.81) h = Math.min(h, 59);
    const biome =
      temp > 0.62
        ? "desert"
        : temp < 0.32
          ? "alpine"
          : wet > 0.49
            ? "woodland"
            : "meadow";
    return { h, biome, river, land };
  }
  ensure(cx, cz) {
    const key = chunkKey(cx, cz);
    if (this.chunks.has(key)) return this.chunks.get(key);
    const data = new Uint16Array(256 * (MAX_Y - MIN_Y + 1)),
      chunk = { cx, cz, data, maxY: SEA + 1, key };
    this.chunks.set(key, chunk);
    this.meshRevision++;
    if (this.dimension === "cinderwild") {
      const result = this.generateCinder(chunk);
      registerAquatic(this, chunk);
      registerEditionChunk(this, chunk);
      wakeDynamicsChunk(this, cx, cz);
      return result;
    }
    const s = this.seedInt;
    const put = (x, y, z, id) => {
      if (x >= 0 && x < 16 && z >= 0 && z < 16 && y >= MIN_Y && y <= MAX_Y) {
        data[index(x, y, z)] = id;
        if (id === B.sugar_cane)
          this.caneRoots.add(coordKey(cx * 16 + x, y, cz * 16 + z));
        if (id === B.torch || id === B.glow_crystal || BLOCKS[id]?.light)
          this.generatedLights.add(coordKey(cx * 16 + x, y, cz * 16 + z));
        chunk.maxY = Math.max(chunk.maxY, y);
      }
    };
    for (let z = 0; z < 16; z++)
      for (let x = 0; x < 16; x++) {
        const wx = cx * 16 + x,
          wz = cz * 16 + z,
          { h, biome } = this.terrain(wx, wz),
          beach = h <= SEA + 1,
          sand = beach || biome === "desert";
        for (
          let y = this.surfaceOnly ? Math.max(MIN_Y, h - 18) : MIN_Y;
          y <= Math.max(h, SEA);
          y++
        ) {
          let id;
          if (y === MIN_Y) id = B.bedrock;
          else if (this.generationVersion >= 4 && (y > h || y > h - 4))
            id = surfaceBlock({ h, biome }, y, s);
          else if (
            this.generationVersion >= 4 &&
            biome === "badlands" &&
            y > h - 10
          )
            id = B.terracotta;
          else if (y > h) id = B.water;
          else if (y === h)
            id = sand
              ? (
                  this.generationVersion < 3
                    ? hash(wx, 0, wz, s + 212) > 0.72
                    : beach && hash(wx, 0, wz, s + 212) > 0.85
                )
                ? B.gravel
                : B.sand
              : biome === "alpine" && h > 83
                ? B.snow
                : B.grass;
          else if (y > h - 4) id = sand ? B.sand : B.dirt;
          else {
            id = B.stone;
            const r = hash(wx, y, wz, s);
            if (this.generationVersion < 12 && r < 0.012 && y < 16)
              id = B.diamond_ore;
            else if (this.generationVersion < 12 && r < 0.045 && y < 60)
              id = B.iron_ore;
            else if (this.generationVersion < 12 && r < 0.08) id = B.coal_ore;
            else if (
              this.generationVersion >= 3 &&
              this.generationVersion < 12 &&
              r < 0.1 &&
              y < 32
            )
              id = B.lapis_ore;
            else if (this.generationVersion < 8 && y < -35 && r > 0.985)
              id = B.obsidian;
            if (
              this.generationVersion >= 10 &&
              this.generationVersion < 12 &&
              id === B.stone
            ) {
              const metal = hash(wx, y, wz, s + 1020);
              if (metal < 0.022 && y > -16 && y < 96) id = B.copper_ore;
              else if (metal < 0.032 && y < 32) id = B.gold_ore;
              else if (metal < 0.034 && h > 85 && y < 80) id = B.emerald_ore;
              else if (metal > 0.985 && y < h - 5)
                id = [B.granite, B.diorite, B.andesite][
                  Math.abs(
                    Math.floor(wx / 7) + Math.floor(y / 7) + Math.floor(wz / 7),
                  ) % 3
                ];
            }
            if (y > h - 20 && y < h - 4 && r > 0.94) id = B.gravel;
            if (this.generationVersion < 12 && y > MIN_Y + 4 && y < h - 6) {
              const cave = noise3(wx / 19, y / 13, wz / 19, s + 821);
              if (
                cave > 0.72 ||
                (Math.abs(noise2(wx / 42, wz / 42, s + 372) - 0.5) < 0.014 &&
                  y > h - 34 &&
                  y < h - 5)
              )
                id = B.air;
            }
          }
          put(x, y, z, id);
        }
      }
    if (this.generationVersion >= 9 && !this.surfaceOnly)
      carveCaveSystems(this, chunk, put);
    // Gen 8: coherent underground cave chambers with lava and cooled obsidian rims.
    // Anchors are evaluated outside each chunk, so seams do not cut the pools.
    if (this.generationVersion >= 8 && !this.surfaceOnly) {
      for (
        let rz = Math.floor((cz * 16 - 8) / 64);
        rz <= Math.floor((cz * 16 + 23) / 64);
        rz++
      )
        for (
          let rx = Math.floor((cx * 16 - 8) / 64);
          rx <= Math.floor((cx * 16 + 23) / 64);
          rx++
        ) {
          const px = rx * 64 + 12 + Math.floor(hash(rx, 2, rz, s + 9081) * 40),
            pz = rz * 64 + 12 + Math.floor(hash(rx, 3, rz, s + 9081) * 40),
            py = -42 + Math.floor(hash(rx, 4, rz, s + 9081) * 60),
            radius = 4 + Math.floor(hash(rx, 5, rz, s + 9081) * 3);
          for (
            let z = Math.max(0, pz - radius - cz * 16);
            z < Math.min(16, pz + radius + 1 - cz * 16);
            z++
          )
            for (
              let x = Math.max(0, px - radius - cx * 16);
              x < Math.min(16, px + radius + 1 - cx * 16);
              x++
            ) {
              const d = Math.hypot(cx * 16 + x - px, cz * 16 + z - pz);
              if (
                d > radius ||
                py + 6 >= this.terrain(cx * 16 + x, cz * 16 + z).h - 10
              )
                continue;
              put(x, py - 1, z, B.stone);
              put(x, py, z, d > radius - 1.45 ? B.obsidian : B.lava);
              for (
                let y = py + 1;
                y <= py + 1 + Math.floor((1 - d / (radius + 1)) * 4);
                y++
              )
                put(x, y, z, B.air);
            }
        }
    }
    if (this.generationVersion >= 12 && !this.surfaceOnly) {
      generateSpacedOres(this, chunk, put);
      generateMineshafts(this, chunk, put);
    }
    if (this.generationVersion >= 4) decorateTrees(this, chunk, put);
    else {
      // Evaluate tree anchors beyond the edge; clipping gives identical trees across chunk boundaries.
      for (let az = -3; az < 19; az++)
        for (let ax = -3; ax < 19; ax++) {
          const wx = cx * 16 + ax,
            wz = cz * 16 + az,
            t = this.terrain(wx, wz);
          if (t.h <= SEA + 1 || t.biome === "desert" || t.biome === "alpine")
            continue;
          const r = hash(wx, 0, wz, s + 291);
          if (r > (t.biome === "woodland" ? 0.026 : 0.006)) continue;
          const height = 4 + Math.floor(hash(wx, 1, wz, s) * 3);
          for (let y = 1; y <= height; y++) put(ax, t.h + y, az, B.log);
          for (let dy = height - 2; dy <= height + 1; dy++)
            for (let dz = -2; dz <= 2; dz++)
              for (let dx = -2; dx <= 2; dx++) {
                if (
                  Math.abs(dx) + Math.abs(dz) > 3 ||
                  (dy === height + 1 && (Math.abs(dx) > 1 || Math.abs(dz) > 1))
                )
                  continue;
                const x = ax + dx,
                  z = az + dz,
                  y = t.h + dy;
                if (
                  x >= 0 &&
                  x < 16 &&
                  z >= 0 &&
                  z < 16 &&
                  !data[index(x, y, z)]
                )
                  put(x, y, z, B.leaves);
              }
        }
    }
    // Small original stone waystations: seeded structures, no village simulation.
    for (
      let rz = Math.floor((cz * 16 - 8) / 96);
      rz <= Math.floor((cz * 16 + 24) / 96);
      rz++
    )
      for (
        let rx = Math.floor((cx * 16 - 8) / 96);
        rx <= Math.floor((cx * 16 + 24) / 96);
        rx++
      ) {
        const wx = rx * 96 + 20 + Math.floor(hash(rx, 0, rz, s + 55) * 40),
          wz = rz * 96 + 20 + Math.floor(hash(rx, 1, rz, s + 55) * 40),
          t = this.terrain(wx, wz);
        if (hash(rx, 2, rz, s) > 0.34 || t.h <= SEA + 2) continue;
        for (let dz = -3; dz <= 3; dz++)
          for (let dx = -3; dx <= 3; dx++) {
            put(wx + dx - cx * 16, t.h, wz + dz - cz * 16, B.cobble);
            if (Math.abs(dx) === 3 || Math.abs(dz) === 3)
              for (let y = 1; y < 4; y++)
                if (!(dz === -3 && dx === 0))
                  put(wx + dx - cx * 16, t.h + y, wz + dz - cz * 16, B.cobble);
            if (Math.abs(dx) === 3 || Math.abs(dz) === 3)
              put(wx + dx - cx * 16, t.h + 4, wz + dz - cz * 16, B.planks);
          }
      }
    if (this.generationVersion >= 3) {
      for (let z = 0; z < 16; z++)
        for (let x = 0; x < 16; x++) {
          const wx = cx * 16 + x,
            wz = cz * 16 + z,
            t = this.terrain(wx, wz),
            r = hash(wx, 0, wz, s + 4002);
          if (
            t.h > SEA + 1 &&
            t.biome !== "desert" &&
            t.biome !== "alpine" &&
            !["badlands", "ocean", "stony_peaks", "snowy_taiga"].includes(
              t.biome,
            ) &&
            data[index(x, t.h + 1, z)] === B.air &&
            r < 0.115
          )
            put(
              x,
              t.h + 1,
              z,
              r < 0.012
                ? B.poppy
                : r < 0.023
                  ? B.cornflower
                  : this.generationVersion >= 4 &&
                      ["pine_forest", "marsh"].includes(t.biome)
                    ? B.fern
                    : B.wild_grass,
            );
        }
      if (this.generationVersion >= 4)
        for (let z = 0; z < 16; z++)
          for (let x = 0; x < 16; x++) {
            const wx = cx * 16 + x,
              wz = cz * 16 + z,
              t = this.terrain(wx, wz);
            if (
              !t.village &&
              ["desert", "badlands"].includes(t.biome) &&
              t.h > SEA + 2 &&
              hash(wx, 0, wz, s + 870) < 0.009
            )
              for (
                let dy = 1;
                dy <= 2 + Math.floor(hash(wx, 1, wz, s) * 2);
                dy++
              )
                put(x, t.h + dy, z, B.cactus);
          }
      generateVillages(this, chunk, put);
      if (this.generationVersion >= 7)
        for (let z = 0; z < 16; z++)
          for (let x = 0; x < 16; x++) {
            const wx = cx * 16 + x,
              wz = cz * 16 + z,
              t = this.terrain(wx, wz);
            if (
              t.biome === "jungle" &&
              !t.village &&
              hash(wx, 0, wz, s + 711) < 0.035
            )
              for (
                let dy = 1;
                dy <= 3 + Math.floor(hash(wx, 1, wz, s) * 3);
                dy++
              )
                if (data[index(x, t.h + dy, z)] === B.air)
                  put(x, t.h + dy, z, B.bamboo);
          }
      for (let z = 0; z < 16; z++)
        for (let x = 0; x < 16; x++) {
          const wx = cx * 16 + x,
            wz = cz * 16 + z,
            t = this.terrain(wx, wz);
          if (
            t.h < SEA ||
            t.h > SEA + 1 ||
            data[index(x, t.h + 1, z)] !== B.air ||
            hash(wx, 0, wz, s + 701) > 0.24
          )
            continue;
          if (
            [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ].some(([dx, dz]) => this.terrain(wx + dx, wz + dz).h < SEA)
          ) {
            put(x, t.h + 1, z, B.sugar_cane);
            put(x, t.h + 2, z, B.sugar_cane);
          }
        }
    }
    // Legacy terrain stays identical; new worlds only generate obsidian underground.
    if (this.generationVersion < 8)
      for (let z = 0; z < 16; z++)
        for (let x = 0; x < 16; x++) {
          const wx = cx * 16 + x,
            wz = cz * 16 + z,
            ax = Math.floor(wx / 64) * 64 + 32,
            az = Math.floor(wz / 64) * 64 + 32;
          if ((wx - ax) ** 2 + (wz - az) ** 2 <= 5) {
            const t = this.terrain(wx, wz);
            if (t.h > SEA + 1) put(x, t.h, z, B.obsidian);
          }
        }
    if (this.generationVersion >= 10)
      for (let z = 0; z < 16; z++)
        for (let x = 0; x < 16; x++) {
          const t = this.terrain(cx * 16 + x, cz * 16 + z);
          if (
            t.h < SEA &&
            hash(
              Math.floor((cx * 16 + x) / 3),
              0,
              Math.floor((cz * 16 + z) / 3),
              s + 1021,
            ) > 0.72
          )
            for (let d = 0; d < 2; d++) put(x, t.h - d, z, B.clay);
        }
    generateRelic(this, chunk, put);
    generatePalm(this, chunk, put);
    generateOcean(this, chunk, put);
    generateEdition(this, chunk, put);
    for (const [x, y, z, id] of this.editChunks.get(key) || [])
      put(x - cx * 16, y, z - cz * 16, id);
    this.dirty.add(key);
    wakeDynamicsChunk(this, cx, cz);
    registerAquatic(this, chunk);
    registerEditionChunk(this, chunk);
    return chunk;
  }
  generateCinder(chunk) {
    if (this.generationVersion >= 7) return generateCinderworld(this, chunk);
    const { cx, cz, data, key } = chunk,
      seed = this.seedInt;
    for (let z = 0; z < 16; z++)
      for (let x = 0; x < 16; x++) {
        const wx = cx * 16 + x,
          wz = cz * 16 + z,
          { h } = this.terrain(wx, wz);
        for (
          let y = this.surfaceOnly ? Math.max(MIN_Y, h - 18) : MIN_Y;
          y <= Math.max(68, h);
          y++
        ) {
          let id = y === MIN_Y ? B.bedrock : y > h ? B.lava : B.cinderstone;
          if (
            y > MIN_Y + 3 &&
            y < h - 5 &&
            noise3(wx / 17, y / 13, wz / 17, seed + 42) > 0.76
          )
            id = B.air;
          if (id === B.cinderstone && hash(wx, y, wz, seed) > 0.97)
            id = B.emberglass;
          if (
            id === B.cinderstone &&
            y < h - 6 &&
            hash(wx, y, wz, seed + 1) < 0.025
          )
            id = B.diamond_ore;
          data[index(x, y, z)] = id;
        }
        chunk.maxY = Math.max(chunk.maxY, h, 68);
        if (h > 70 && hash(wx, 1, wz, seed) > 0.985) {
          const height = 2 + Math.floor(hash(wx, 2, wz, seed) * 6);
          for (let y = h + 1; y < h + height; y++) {
            data[index(x, y, z)] = B.basalt;
            chunk.maxY = Math.max(chunk.maxY, y);
          }
          data[index(x, h + height, z)] = B.emberglass;
          chunk.maxY = Math.max(chunk.maxY, h + height);
        }
      }
    for (const [x, y, z, id] of this.editChunks.get(key) || []) {
      data[index(x - cx * 16, y, z - cz * 16)] = id;
      chunk.maxY = Math.max(chunk.maxY, y);
    }
    this.dirty.add(key);
    return chunk;
  }
  get(x, y, z) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (y < MIN_Y) return B.bedrock;
    if (y > MAX_Y) return B.air;
    const cx = Math.floor(x / 16),
      cz = Math.floor(z / 16);
    return this.ensure(cx, cz).data[index(x - cx * 16, y, z - cz * 16)];
  }
  skyHeight(x, z) {
    x = Math.floor(x);
    z = Math.floor(z);
    const key = `${x},${z}`;
    if (this.skyCache.has(key)) return this.skyCache.get(key);
    const cx = Math.floor(x / 16),
      cz = Math.floor(z / 16),
      c = this.ensure(cx, cz);
    let y = Math.min(MAX_Y, c.maxY);
    while (
      y > MIN_Y &&
      !BLOCKS[c.data[index(x - cx * 16, y, z - cz * 16)]]?.solid
    )
      y--;
    if (this.skyCache.size >= 4096) this.skyCache.clear();
    this.skyCache.set(key, y);
    return y;
  }
  set(x, y, z, id) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (y <= MIN_Y || y > MAX_Y) return false;
    const cx = Math.floor(x / 16),
      cz = Math.floor(z / 16),
      key = chunkKey(cx, cz),
      lx = x - cx * 16,
      lz = z - cz * 16;
    const c = this.ensure(cx, cz),
      old = c.data[index(lx, y, lz)];
    if (old === id) return false;
    this.caveLightCache?.clear();
    this.skyCache.delete(`${x},${z}`);
    this.meshRevision++;
    if (id === B.sugar_cane) this.caneRoots.add(coordKey(x, y, z));
    else this.caneRoots.delete(coordKey(x, y, z));
    c.data[index(lx, y, lz)] = id;
    if (emittedLight(old) || emittedLight(id)) c.lightSources = null;
    // A wall edit can uncover or occlude a nearby lamp across chunk boundaries.
    let lightingChanged = !!(emittedLight(old) || emittedLight(id));
    if (!lightingChanged) lightingChanged = nearbyBlockLight(this, x, y, z);
    if (lightingChanged) dirtyLightRegion(this, x, z);
    setAquaticCell(this, x, y, z, id);
    if (BLOCKS[id]?.crop || BLOCKS[id]?.sapling)
      (this.editionPlants ||= new Set()).add(coordKey(x, y, z));
    notifyDynamics(this, x, y, z, old, id);
    const oldDoor = BLOCKS[old]?.door;
    if (oldDoor && !BLOCKS[id]?.door) {
      const otherY = y + (oldDoor.upper ? -1 : 1);
      if (
        this.get(x, otherY, z) ===
        doorId(oldDoor.facing, oldDoor.open, !oldDoor.upper, oldDoor.base)
      )
        this.set(x, otherY, z, B.air);
    }
    if (id !== B.torch && id !== B.glow_crystal && !BLOCKS[id]?.light)
      this.generatedLights.delete(coordKey(x, y, z));
    else this.generatedLights.add(coordKey(x, y, z));
    c.maxY = Math.max(c.maxY, y);
    this.edits.set(coordKey(x, y, z), id);
    let entries = this.editChunks.get(key);
    if (!entries) this.editChunks.set(key, (entries = []));
    const edit = entries.find((e) => e[0] === x && e[1] === y && e[2] === z);
    if (edit) edit[3] = id;
    else entries.push([x, y, z, id]);
    // Mesh faces, connected shapes and vertex AO read a one-cell halo.
    // Interior edits affect one chunk, edge edits two, corner edits four.
    const xs = lx === 0 ? [-1, 0] : lx === 15 ? [0, 1] : [0];
    const zs = lz === 0 ? [-1, 0] : lz === 15 ? [0, 1] : [0];
    for (const dz of zs)
      for (const dx of xs) {
        const k = chunkKey(cx + dx, cz + dz);
        this.revisions.set(k, (this.revisions.get(k) || 0) + 1);
        this.dirty.add(k);
      }
    if (!fluid(old) && !fluid(id)) this.pending.push([x, y, z], [x, y + 1, z]);
    else {
      const above = this.chunks.get(key)?.data[index(lx, y + 1, lz)];
      if (
        BLOCKS[above]?.door ||
        [B.sand, B.red_sand, B.gravel, B.sugar_cane].includes(above)
      )
        this.pending.push([x, y + 1, z]);
    }
    return true;
  }
  solid(x, y, z) {
    return BLOCKS[this.get(x, y, z)].solid;
  }
  exportEdits() {
    return Object.fromEntries(this.edits);
  }
  unload(cx, cz, radius) {
    let removed = false;
    for (const [key, c] of this.chunks)
      if (Math.abs(c.cx - cx) > radius || Math.abs(c.cz - cz) > radius) {
        this.chunks.delete(key);
        this.dirty.delete(key);
        removed = true;
      }
    if (removed) this.meshRevision++;
    if (removed)
      for (const key of this.skyCache.keys()) {
        const [x, z] = key.split(",").map(Number);
        if (
          Math.abs(Math.floor(x / 16) - cx) > radius ||
          Math.abs(Math.floor(z / 16) - cz) > radius
        )
          this.skyCache.delete(key);
      }
    if (removed)
      for (const set of [this.caneRoots, this.generatedLights])
        for (const pos of set) {
          const [x, , z] = pos.split(",").map(Number);
          if (
            !this.chunks.has(chunkKey(Math.floor(x / 16), Math.floor(z / 16)))
          )
            set.delete(pos);
        }
  }
  // Install a validated full worker chunk without repeating terrain generation.
  // Existing loaded cells and saved containers always retain authority.
  adoptGeneratedChunk(payload) {
    if (
      !payload?.full ||
      !Number.isInteger(payload.cx) ||
      !Number.isInteger(payload.cz) ||
      !ArrayBuffer.isView(payload.data) ||
      payload.data.length !== 256 * (MAX_Y - MIN_Y + 1)
    )
      return false;
    const key = chunkKey(payload.cx, payload.cz);
    if (
      this.chunks.has(key) ||
      (this.revisions.get(key) || 0) !== payload.revision
    )
      return false;
    const c = {
      cx: payload.cx,
      cz: payload.cz,
      key,
      data: payload.data,
      maxY: payload.maxY,
      lightSources: payload.meta.lights,
    };
    this.chunks.set(key, c);
    this.meshRevision++;
    for (const p of payload.meta.registeredLights) this.generatedLights.add(p);
    for (const p of payload.meta.canes) this.caneRoots.add(p);
    this.editionPlants ||= new Set();
    for (const p of payload.meta.plants) this.editionPlants.add(p);
    this.aquaticCells ||= new Map();
    for (const [p, id] of payload.meta.aquatic) this.aquaticCells.set(p, id);
    for (const [p, value] of payload.meta.containers)
      if (!this.containers[p]) this.containers[p] = value;
    wakeDynamicsChunk(this, c.cx, c.cz);
    return true;
  }
  findSpawn() {
    for (let radius = 0; radius < 180; radius += 4)
      for (let a = 0; a < 8; a++) {
        const x = Math.round(Math.cos((a * Math.PI) / 4) * radius) + 8,
          z = Math.round(Math.sin((a * Math.PI) / 4) * radius) + 8,
          t = this.terrain(x, z);
        if (
          t.h > SEA + 2 &&
          t.biome !== "desert" &&
          this.get(x, t.h + 1, z) === B.air &&
          this.get(x, t.h + 2, z) === B.air
        )
          return { x: x + 0.5, y: t.h + 1.01, z: z + 0.5 };
      }
    if (this.generationVersion >= 13) {
      // A broad desert can fill the whole spawn search. Use its real surface,
      // rather than the old fixed Y fallback, which could be inside a dune.
      for (let radius = 0; radius < 180; radius += 4)
        for (let a = 0; a < 8; a++) {
          const x = Math.round(Math.cos((a * Math.PI) / 4) * radius) + 8;
          const z = Math.round(Math.sin((a * Math.PI) / 4) * radius) + 8;
          const t = this.terrain(x, z);
          if (
            t.h > SEA + 2 &&
            this.get(x, t.h + 1, z) === B.air &&
            this.get(x, t.h + 2, z) === B.air
          )
            return { x: x + 0.5, y: t.h + 1.01, z: z + 0.5 };
        }
    }
    return { x: 8.5, y: 100, z: 8.5 };
  }
  raycast(
    origin,
    direction,
    reach = 4.5,
    solidOnly = false,
    targetFluids = false,
  ) {
    let x = Math.floor(origin.x),
      y = Math.floor(origin.y),
      z = Math.floor(origin.z);
    const step = [
        direction.x >= 0 ? 1 : -1,
        direction.y >= 0 ? 1 : -1,
        direction.z >= 0 ? 1 : -1,
      ],
      ds = [direction.x, direction.y, direction.z],
      os = [origin.x, origin.y, origin.z],
      pos = [x, y, z],
      delta = ds.map((v) => (v === 0 ? Infinity : Math.abs(1 / v))),
      max = ds.map((v, i) =>
        v === 0 ? Infinity : ((v > 0 ? pos[i] + 1 : pos[i]) - os[i]) / v,
      );
    let distance = 0,
      normal = { x: 0, y: 0, z: 0 };
    for (let n = 0; n < 160 && distance <= reach; n++) {
      [x, y, z] = pos;
      const id = this.get(x, y, z);
      if (
        id !== B.air &&
        (!fluid(id) ||
          BLOCKS[id]?.aquaticWater ||
          (targetFluids && fluid(id).source)) &&
        id !== B.portal &&
        (!solidOnly || BLOCKS[id]?.solid)
      ) {
        if (
          !BLOCKS[id]?.edition &&
          !BLOCKS[id]?.bounds &&
          !BLOCKS[id]?.door &&
          !BLOCKS[id]?.relic &&
          id !== B.cactus &&
          id !== B.chest
        )
          return { x, y, z, id, normal: { ...normal }, distance };
        const hit = blockParts(id, this, x, y, z)
          .map((bounds) => rayBounds(origin, direction, x, y, z, bounds, reach))
          .filter(Boolean)
          .sort((a, b) => a.distance - b.distance)[0];
        if (hit) return { x, y, z, id, ...hit };
      }
      const axis =
        max[0] < max[1] ? (max[0] < max[2] ? 0 : 2) : max[1] < max[2] ? 1 : 2;
      distance = max[axis];
      pos[axis] += step[axis];
      max[axis] += delta[axis];
      normal = { x: 0, y: 0, z: 0 };
      normal[["x", "y", "z"][axis]] = -step[axis];
    }
    return null;
  }
  simulate(center, radius = 96) {
    this.tick++;
    simulateDynamics(this, center, radius);
    tickEditionWorld(this, center, radius);
    const batch = this.pending.splice(0, 120);
    for (const [x, y, z] of batch) {
      if (!this.chunks.has(chunkKey(Math.floor(x / 16), Math.floor(z / 16))))
        continue;
      const id = this.get(x, y, z);
      if (
        id === B.sugar_cane &&
        ![B.sugar_cane, B.grass, B.dirt, B.sand, B.red_sand, B.moss].includes(
          this.get(x, y - 1, z),
        )
      )
        this.set(x, y, z, B.air);
      if (BLOCKS[id]?.snowLayers && !this.solid(x, y - 1, z)) {
        this.set(x, y, z, B.air);
        continue;
      }
      const door = BLOCKS[id]?.door;
      if (door) {
        const baseY = y - Number(door.upper);
        if (
          !this.solid(x, baseY - 1, z) ||
          this.get(x, baseY + (door.upper ? 0 : 1), z) !==
            doorId(door.facing, door.open, !door.upper, door.base)
        )
          this.set(x, y, z, B.air);
      }
      if (
        (id === B.sand ||
          id === B.red_sand ||
          id === B.gravel ||
          BLOCKS[id]?.key.endsWith("_concrete_powder")) &&
        !this.solid(x, y - 1, z)
      ) {
        this.set(x, y, z, B.air);
        this.set(x, y - 1, z, id);
      }
    }
    if (this.tick % 400 === 0)
      for (const key of [...this.caneRoots]) {
        const [x, y, z] = key.split(",").map(Number);
        if (!this.chunks.has(chunkKey(Math.floor(x / 16), Math.floor(z / 16))))
          continue;
        if (this.get(x, y, z) !== B.sugar_cane) {
          this.caneRoots.delete(key);
          continue;
        }
        if (this.get(x, y - 1, z) === B.sugar_cane) continue;
        if (
          ![
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].some(([dx, dz]) => isWater(this.get(x + dx, y - 1, z + dz)))
        )
          continue;
        let top = y;
        while (top < y + 3 && this.get(x, top, z) === B.sugar_cane) top++;
        if (top < y + 3 && this.get(x, top, z) === B.air)
          this.set(x, top, z, B.sugar_cane);
      }
    // Crop growth is deliberately simplified: hydrated farmland and a clear sky.
    if (this.tick % 100 === 0)
      for (const [key, state] of Object.entries(this.cropTicks)) {
        const [x, y, z] = key.split(",").map(Number);
        if (this.get(x, y, z) !== B.crop) {
          delete this.cropTicks[key];
          continue;
        }
        let hydrated =
          this.weather.kind !== "clear" &&
          this.weather.intensity > 0.5 &&
          precipitation(this.terrain(x, z).biome, y) === "rain" &&
          this.skyHeight(x, z) <= y;
        for (let dz = -4; dz <= 4 && !hydrated; dz++)
          for (let dx = -4; dx <= 4; dx++)
            if (isWater(this.get(x + dx, y - 1, z + dz))) {
              hydrated = true;
              break;
            }
        if (hydrated && this.terrain(x, z).h <= y)
          state.age = Math.min(7, state.age + 1);
      }
  }
}
