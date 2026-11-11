import { importedRig } from "./titan-imports.js";
import { sampleTitanArmorPose } from "./titan-animation.js";
import { extractTitanClimbSurface } from "./titan-climb-surface.js";
import { makeArmorGuide } from "./titan-climb.js";
// One cached CPU-only skeleton, independent of render cadence and scene graph.
// Shared geometry/textures remain in the existing bounded imported-asset cache.
export function createTitanDeformingArmor(asset) {
  const rig = importedRig(asset);
  const surface = extractTitanClimbSurface(rig, (clock) =>
    sampleTitanArmorPose(rig.userData, clock),
  );
  surface.guide = makeArmorGuide(surface);
  surface.update(0);
  return surface;
}
