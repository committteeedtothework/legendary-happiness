import { B, BLOCKS, MIN_Y } from "./data.js";
import { aquaticCell } from "./aquatic.js";
import { prepareWorkerChunks } from "./terrain-worker-cache.js";
import { applyMeshSnapshot } from "./mesh-snapshot.js";
import { meshHorizon } from "./horizon.js";
import { World } from "./world.js";
import { meshChunk } from "./mesher.js";
let world, signature;
const contexts = new Map();
let stamps;
self.onmessage = ({ data: job }) => {
  try {
    const next = [
      job.seed,
      job.dimension,
      job.generationVersion,
      job.surfaceOnly,
      job.epoch ?? 0,
      JSON.stringify([job.portals, job.palm, job.relicClaimed]),
    ].join(":");
    if (next !== signature) {
      let saved = contexts.get(next);
      if (!saved) {
        if (contexts.size >= 2) contexts.delete(contexts.keys().next().value);
        saved = {
          world: new World(job.seed, {}, job.dimension, job.generationVersion),
          stamps: new Map(),
        };
        const ensure = saved.world.ensure.bind(saved.world);
        saved.world.ensure = (cx, cz) => {
          const existing = saved.world.chunks.get(`${cx},${cz}`);
          if (existing) return existing;
          const c = ensure(cx, cz),
            meta = {
              lights: c.lightSources || [],
              registeredLights: [],
              plants: [],
              canes: [],
              aquatic: [],
              containers: [],
            };
          for (let i = 0; i < c.data.length; i++) {
            const id = c.data[i],
              b = BLOCKS[id];
            if (
              id !== B.sugar_cane &&
              !b?.crop &&
              !b?.sapling &&
              !aquaticCell(id)
            )
              continue;
            const pos = `${cx * 16 + (i % 16)},${MIN_Y + Math.floor(i / 256)},${cz * 16 + Math.floor((i % 256) / 16)}`;
            if (id === B.sugar_cane) meta.canes.push(pos);
            if (b?.crop || b?.sapling) meta.plants.push(pos);
            if (aquaticCell(id)) meta.aquatic.push([pos, id]);
          }
          for (const [pos, value] of Object.entries(saved.world.containers)) {
            const [x, , z] = pos.split(",").map(Number);
            if (Math.floor(x / 16) === cx && Math.floor(z / 16) === cz)
              meta.containers.push([pos, value]);
          }
          const belongs = (pos) => {
            const [x, , z] = pos.split(",").map(Number);
            return Math.floor(x / 16) === cx && Math.floor(z / 16) === cz;
          };
          meta.registeredLights = [...saved.world.generatedLights].filter(
            belongs,
          );
          meta.canes = [...saved.world.caneRoots].filter(belongs);
          c.streamMeta = meta;
          return c;
        };
        contexts.set(next, saved);
      }
      world = saved.world;
      stamps = saved.stamps;
      world.surfaceOnly = job.surfaceOnly;
      signature = next;
    }
    // Only nearby chunks are retained in the worker; transfer buffers never detach game state.
    prepareWorkerChunks(world, job, stamps);
    world.revisions.clear();
    world.editionPlants?.clear();
    world.pending.length = 0;
    world.fluidQueue.clear();
    world.fluidBuckets.forEach((b) => (b.length = 0));
    world.dirty.clear();
    world.skyCache.clear();
    world.containers = {};
    world.cropTicks = {};
    world.generatedLights.clear();
    world.caneRoots.clear();
    world.aquaticCells?.clear();
    world.edits = new Map(Object.entries(job.edits || {}));
    world.editChunks.clear();
    for (const [pos, id] of world.edits) {
      const [x, y, z] = pos.split(",").map(Number),
        key = `${Math.floor(x / 16)},${Math.floor(z / 16)}`;
      if (!world.editChunks.has(key)) world.editChunks.set(key, []);
      world.editChunks.get(key).push([x, y, z, id]);
    }
    world.itemLightSources = job.itemLightSources || [];
    world.palm = job.palm || null;
    world.portals = job.portals || {};
    world.relicClaimed = !!job.relicClaimed;
    applyMeshSnapshot(world, job.chunks);
    if (!job.horizon)
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) world.ensure(job.cx + dx, job.cz + dz);
    const groups = job.horizon
      ? meshHorizon(world, job.cx, job.cz, {
          span: job.span || 1,
          step: job.span > 1 ? job.distantDetail || 4 : 2,
          biomeColors: job.biomeColors,
          texturePack: job.texturePack,
        })
      : meshChunk(world, world.ensure(job.cx, job.cz), {
          surfaceOnly: job.surfaceOnly,
          interactiveModels: true,
          ambientOcclusion: job.ambientOcclusion,
          biomeColors: job.biomeColors,
          biomeBlend: job.biomeBlend,
          texturePack: job.texturePack,
        });
    const cacheStats = { chunks: world.chunks.size, contexts: contexts.size };
    const buffers = groups
      .filter(Boolean)
      .flatMap((g) => Object.values(g).map((a) => a.buffer));
    const worldVisuals = job.horizon
      ? []
      : world.ensure(job.cx, job.cz).worldVisuals || [];
    let generated;
    if (
      !job.horizon &&
      !job.surfaceOnly &&
      !job.chunks?.some((c) => c.key === job.key)
    ) {
      const c = world.ensure(job.cx, job.cz);
      if (c.streamMeta) {
        generated = {
          full: true,
          cx: c.cx,
          cz: c.cz,
          maxY: c.maxY,
          data: c.data.slice(),
          meta: c.streamMeta,
          revision: job.revision || 0,
        };
        buffers.push(generated.data.buffer);
      }
    }
    self.postMessage(
      { ticket: job.ticket, groups, worldVisuals, cacheStats, generated },
      buffers,
    );
  } catch (error) {
    self.postMessage({ ticket: job.ticket, error: error.message });
  }
};
