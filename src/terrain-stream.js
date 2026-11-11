import * as THREE from "three";
export const geometryFromData = (data) => {
  if (!data) return null;
  const g = new THREE.BufferGeometry();
  for (const key of ["position", "normal", "uv", "color"])
    g.setAttribute(
      key,
      new THREE.BufferAttribute(data[key], key === "uv" ? 2 : 3),
    );
  g.setAttribute(
    "blockLight",
    new THREE.BufferAttribute(
      data.blockLight || new Float32Array(data.position.length / 3),
      1,
    ),
  );
  g.setIndex(new THREE.BufferAttribute(data.indices, 1));
  g.computeBoundingSphere();
  return g;
};

export function queueTerrainResult(r, slot, data) {
  slot.busy = false;
  const job = r.jobs.get(data.ticket);
  if (!job || job.epoch !== r.epoch) {
    r.jobs.delete(data.ticket);
    return;
  }
  if (data.error) {
    r.jobs.delete(data.ticket);
    r.workerFallback = true;
    return;
  }
  if (r.entryRevision(job) !== job.revision) {
    r.jobs.delete(data.ticket);
    return;
  }
  r.workerCacheStats = data.cacheStats;
  (r.readyMeshes ||= []).push({ job, data });
}
export function drainTerrainResults(
  r,
  budget = 2.5,
  clock = () => performance.now(),
) {
  const start = clock();
  if (r.streamCenter && r.readyMeshes?.length > 1) {
    const priority = ({ job }) => {
      if (r.meshes?.has(job.key) && r.world?.dirty.has(job.key)) return -1;
      const distance = Math.hypot(
        job.cx - r.streamCenter.cx,
        job.cz - r.streamCenter.cz,
      );
      return job.horizon ? 3 + distance / 100 : distance;
    };
    r.readyMeshes.sort((a, b) => priority(a) - priority(b));
  }
  let installed = 0,
    adopted = 0;
  while (r.readyMeshes?.length && installed < 2) {
    if (installed && clock() - start >= budget) break;
    const { job, data } = r.readyMeshes.shift();
    r.jobs.delete(job.ticket);
    const expected = r.planEntries?.get(job.key);
    const wrongDetail =
      expected &&
      (job.horizon !== !!(expected.horizon || expected.distance > 8) ||
        job.surfaceOnly !== !!(expected.horizon || expected.distance > 4));
    if (
      wrongDetail ||
      job.epoch !== r.epoch ||
      r.entryRevision(job) !== job.revision ||
      (r.planKeys && !r.planKeys.has(job.key))
    )
      continue;
    if (data.generated && r.world?.adoptGeneratedChunk?.(data.generated))
      adopted++;
    r.installMesh(
      job.cx,
      job.cz,
      data.groups.map(geometryFromData),
      job.surfaceOnly,
      { ...job, worldVisuals: data.worldVisuals || [] },
    );
    installed++;
  }
  const stats = (r.streamStats ||= {
    installed: 0,
    uploadMs: 0,
    maxUploadMs: 0,
  });
  stats.installed += installed;
  stats.adopted = (stats.adopted || 0) + adopted;
  stats.uploadMs = clock() - start;
  stats.maxUploadMs = Math.max(stats.maxUploadMs, stats.uploadMs);
  return installed;
}
export function coarseCover(r, cx, cz) {
  return r.meshes.has(`${Math.floor(cx / 4) * 4},${Math.floor(cz / 4) * 4},h4`);
}
export function injectTerrainCoverage(shader, r, horizon = false) {
  // Detailed meshes are always opaque. Only the coarse layer samples ownership.
  if (!horizon) return;
  shader.uniforms.dcsmCoverage = { value: r.horizonMask };
  shader.uniforms.dcsmOrigin = r.horizonOrigin;
  shader.vertexShader =
    "varying vec2 dcsmXZ;\n" +
    shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\ndcsmXZ=(modelMatrix*vec4(transformed-normal*.002,1.)).xz;",
    );
  shader.fragmentShader =
    "varying vec2 dcsmXZ;uniform sampler2D dcsmCoverage;uniform vec2 dcsmOrigin;\n" +
    shader.fragmentShader.replace(
      "#include <clipping_planes_fragment>",
      `#include <clipping_planes_fragment>
 vec2 cell=floor(dcsmXZ/16.)-dcsmOrigin;
 if(all(greaterThanEqual(cell,vec2(0.)))&&all(lessThan(cell,vec2(32.)))&&texture2D(dcsmCoverage,(cell+.5)/32.).r>.5)discard;`,
    );
}
