import { createHash } from "node:crypto";
export function modelFingerprint(model) {
  model.updateMatrixWorld(true);
  const meshes = [];
  model.traverse((o) => {
    if (o.isMesh)
      meshes.push({
        matrix: o.matrixWorld.elements,
        geometry: Object.fromEntries(
          Object.entries(o.geometry.attributes)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => [k, Array.from(v.array)]),
        ),
        index: o.geometry.index ? Array.from(o.geometry.index.array) : null,
        materials: (Array.isArray(o.material) ? o.material : [o.material]).map(
          (m) => ({
            color: m.color?.getHexString(),
            emissive: m.emissive?.getHexString(),
            side: m.side,
            opacity: m.opacity,
            transparent: m.transparent,
            alphaTest: m.alphaTest,
          }),
        ),
      });
  });
  return createHash("sha256").update(JSON.stringify(meshes)).digest("hex");
}
