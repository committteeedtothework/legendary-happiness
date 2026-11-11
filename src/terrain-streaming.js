// Terrain ownership, scheduling and resource replacement are kept separate
// from camera, animation and combat rendering. All public renderer entrypoints
// delegate here so browser, standalone and desktop use the same pipeline.
import * as THREE from "three";
import { snapshotMeshChunks } from "./mesh-snapshot.js";
import { chunkKey } from "./world.js";
import { meshHorizon, terrainPlan } from "./horizon.js";
import {
  geometryFromData,
  drainTerrainResults,
  coarseCover,
} from "./terrain-stream.js";

export function entryRevision(r, entry) {
  if (!entry.span || entry.span === 1)
    return r.world.revisions.get(entry.key) || 0;
  let revision = 0;
  for (let dz = 0; dz < (entry.span || 1); dz++)
    for (let dx = 0; dx < (entry.span || 1); dx++)
      revision +=
        r.world.revisions.get(chunkKey(entry.cx + dx, entry.cz + dz)) || 0;
  return revision;
}

export function updateHorizonMask(r, x, z) {
  const ox = Math.floor(x / 16) - 16,
    oz = Math.floor(z / 16) - 16;
  if (
    !r.horizonMaskDirty &&
    r.horizonOrigin.value.x === ox &&
    r.horizonOrigin.value.y === oz
  )
    return;
  r.horizonOrigin.value.set(ox, oz);
  r.horizonMaskData.fill(0);
  // A completed detailed column owns every pixel. Coarse geometry is never
  // perforated while either its detailed replacement or its own worker is pending.
  for (const [key, mesh] of r.meshes) {
    if (mesh.userData.horizon) continue;
    const [cx, cz] = key.split(",").map(Number),
      dx = cx - ox,
      dz = cz - oz;
    if (dx >= 0 && dx < 32 && dz >= 0 && dz < 32)
      r.horizonMaskData[dx + dz * 32] = 255;
  }
  r.horizonMask.needsUpdate = true;
  r.horizonMaskDirty = false;
}

// At most one cheap heightfield tile per frame; never create collision chunks,
// containers or simulation state just to cover a temporarily unloaded region.
export function installTerrainPreview(r) {
  if (typeof r.world.terrain !== "function") return false;
  const entry = r.plan.find((e) => e.horizon && !r.meshes.has(e.key));
  if (!entry) return false;
  const revision = r.entryRevision(entry);
  const geometry = meshHorizon(r.world, entry.cx, entry.cz, {
    span: entry.span,
    step: 16,
    biomeColors: r.settings.biomeColors,
    texturePack: r.settings.texturePack,
  }).map(geometryFromData);
  r.installMesh(entry.cx, entry.cz, geometry, true, {
    ...entry,
    horizon: true,
    revision,
    preview: true,
  });
  return true;
}

export function loadAround(r, x, z, radius, budget = 1) {
  radius = r.settings.distantTerrain === false ? Math.min(radius, 6) : radius;
  const cx = Math.floor(x / 16),
    cz = Math.floor(z / 16),
    planKey = `${cx},${cz},${radius}`;
  if (r.planKey !== planKey || !r.plan) {
    r.planKey = planKey;
    r.plan = terrainPlan(cx, cz, radius);
    r.planKeys = new Set(r.plan.map((e) => e.key));
    r.planEntries = new Map(r.plan.map((e) => [e.key, e]));
    r.streamSettled = false;
  }
  r.streamCenter = { cx, cz };
  const streamStart = performance.now();
  drainTerrainResults(r);
  if (
    budget === 1 &&
    r.streamSettled &&
    r.settledRevision === r.world.meshRevision &&
    r.settledEpoch === r.epoch &&
    r.settledDirtySize === r.world.dirty.size &&
    !r.jobs.size
  )
    return;
  const pending = new Set(
    [...r.jobs.values()].filter((j) => j.epoch === r.epoch).map((j) => j.key),
  );
  let built = 0,
    incomplete = false;
  // Existing edited meshes take priority over streaming new terrain.
  const edited = r.plan.filter(
    (e) => r.meshes.has(e.key) && r.world.dirty.has(e.key),
  );
  for (const entry of [...edited, ...r.plan]) {
    const { key, distance } = entry,
      mesh = r.meshes.get(key),
      horizon = entry.horizon || distance > 8,
      surfaceOnly = !!horizon || distance > 4,
      revision = r.entryRevision(entry);
    if (
      mesh &&
      !mesh.userData.preview &&
      !r.world.dirty.has(key) &&
      mesh.userData.surfaceOnly === surfaceOnly &&
      mesh.userData.horizon === !!horizon &&
      mesh.userData.revision === revision
    )
      continue;
    incomplete = true;
    if (pending.has(key)) continue;
    // Keep explicit bootstrap/fallback builds synchronous. Ordinary edits
    // are meshed off-thread from copies of authoritative loaded cells.
    const immediate = budget > 1 || !r.workers.length || r.workerFallback;
    if (immediate) {
      if (horizon)
        r.installMesh(
          entry.cx,
          entry.cz,
          meshHorizon(r.world, entry.cx, entry.cz, {
            span: entry.span || 1,
            step: entry.span > 1 ? (r.settings.distantDetail ?? 4) : 2,
            biomeColors: r.settings.biomeColors,
            texturePack: r.settings.texturePack,
          }).map(geometryFromData),
          true,
          { ...entry, horizon: true, revision },
        );
      else r.rebuild(r.world.ensure(entry.cx, entry.cz), surfaceOnly);
      if (++built >= budget) break;
    } else {
      if (
        r.jobs.size >= Math.max(2, r.workers.length * 2) ||
        performance.now() - streamStart > 3
      )
        break;
      const slot = r.workers.find((s) => !s.busy);
      if (!slot) break;
      const ticket = ++r.ticket;
      const job = {
        ...entry,
        ticket,
        revision,
        epoch: r.epoch,
        surfaceOnly,
        horizon,
      };
      r.jobs.set(ticket, job);
      slot.busy = true;
      slot.ticket = ticket;
      const edits = {};
      for (let dz = -1; dz <= (entry.span || 1); dz++)
        for (let dx = -1; dx <= (entry.span || 1); dx++)
          for (const [ex, ey, ez, id] of r.world.editChunks.get(
            chunkKey(entry.cx + dx, entry.cz + dz),
          ) || [])
            edits[`${ex},${ey},${ez}`] = id;
      const snapshot = !horizon
        ? snapshotMeshChunks(r.world, entry.cx, entry.cz)
        : { chunks: undefined, transfers: [] };
      pending.add(key);
      slot.worker.postMessage(
        {
          ...job,
          chunks: snapshot.chunks,
          seed: r.world.seed,
          dimension: r.world.dimension,
          generationVersion: r.world.generationVersion,
          edits,
          portals: r.world.portals,
          palm: r.world.palm,
          ambientOcclusion: r.settings.ambientOcclusion !== false,
          biomeColors: r.settings.biomeColors !== false,
          biomeBlend: r.settings.biomeBlend ?? 2,
          texturePack: r.settings.texturePack,
          distantDetail: r.settings.distantDetail ?? 4,
          relicClaimed: r.world.relicClaimed,
          itemLightSources: r.world.itemLightSources || [],
        },
        snapshot.transfers,
      );
    }
  }
  if (budget === 1 && r.workers.length && !r.workerFallback)
    installTerrainPreview(r);
  for (const [key, group] of r.meshes) {
    const [mx, mz] = key.split(",").map(Number);
    const distance = Math.hypot(mx - cx, mz - cz);
    const horizon = group.userData.horizon;
    const limit = horizon ? radius + 6 : Math.min(radius, 8) + 2;
    const coveredRetirement =
      !horizon &&
      distance > Math.min(radius, 8) + 0.75 &&
      coarseCover(r, mx, mz);
    if (distance <= limit && !coveredRetirement) continue;
    r.scene.remove(group);
    group.children.forEach((mesh) => mesh.geometry.dispose());
    r.meshes.delete(key);
    r.worldAnimations.removeChunk(key);
    r.horizonMaskDirty = true;
  }
  if (r.world.chunks.size > 160) r.world.unload(cx, cz, 6);
  r.streamSettled = !incomplete && r.jobs.size === 0;
  r.settledRevision = r.world.meshRevision;
  r.settledEpoch = r.epoch;
  r.settledDirtySize = r.world.dirty.size;
}

export function installTerrainMesh(
  r,
  cx,
  cz,
  geometries,
  surfaceOnly = false,
  entry = {},
) {
  r.streamSettled = false;
  const key = entry.key || chunkKey(cx, cz),
    old = r.meshes.get(key);
  if (old) {
    r.scene.remove(old);
    old.children.forEach((m) => m.geometry.dispose());
  }
  const group = new THREE.Group();
  geometries.forEach((g, i) => {
    if (g) {
      const m = new THREE.Mesh(
        g,
        entry.horizon
          ? i
            ? r.horizonWaterMaterial
            : r.horizonMaterial
          : i
            ? r.waterMaterial
            : r.material,
      );
      m.castShadow = !entry.horizon && i === 0;
      m.receiveShadow = true;
      group.add(m);
    }
  });
  if (!entry.horizon && !old && coarseCover(r, cx, cz))
    group.userData.arrivalAt = performance.now();
  group.userData.preview = !!entry.preview;
  group.userData.surfaceOnly = surfaceOnly;
  group.userData.horizon = !!entry.horizon;
  group.userData.revision = entry.revision ?? (r.world.revisions.get(key) || 0);
  group.position.set(cx * 16, 0, cz * 16);
  r.meshes.set(key, group);
  r.horizonMaskDirty = true;
  r.scene.add(group);
  r.worldAnimations.setChunk(key, entry.worldVisuals || []);
  r.world.dirty.delete(key);
}
