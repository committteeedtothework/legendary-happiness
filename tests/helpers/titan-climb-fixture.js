import { createTitanDeformingArmor } from "../../src/titan-climb-rig.js";
import fs from "node:fs";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { importedRig, disposeImportedRig } from "../../src/titan-imports.js";
import {
  extractTitanClimbSurface,
  installTitanClimbSurface,
} from "../../src/titan-climb-surface.js";
import { makeArmorGuide } from "../../src/titan-climb.js";
globalThis.self ||= globalThis;
globalThis.ProgressEvent ||= class {
  constructor(t, p) {
    Object.assign(this, p);
  }
};
let cached;
export function climbFixture() {
  return (cached ||= (async () => {
    const b = fs.readFileSync(
        new URL("../../public/models/titan/giganto.glb", import.meta.url),
      ),
      len = b.readUInt32LE(12),
      g = JSON.parse(b.subarray(20, 20 + len)),
      bin = b.subarray(28 + len);
    g.images = [];
    g.textures = [];
    g.extensionsRequired = [];
    g.extensionsUsed = [];
    for (const m of g.materials) {
      for (const k of Object.keys(m)) if (k.endsWith("Texture")) delete m[k];
      for (const k of Object.keys(m.pbrMetallicRoughness || {}))
        if (k.endsWith("Texture")) delete m.pbrMetallicRoughness[k];
    }
    for (const m of g.meshes) for (const p of m.primitives) delete p.extensions;
    g.buffers = [
      {
        byteLength: bin.length,
        uri: "data:application/octet-stream;base64," + bin.toString("base64"),
      },
    ];
    const gltf = await new GLTFLoader().parseAsync(JSON.stringify(g), ""),
      asset = { role: "giganto", gltf, metadata: g.extras.dcsmRig },
      rig = importedRig(asset),
      surface = createTitanDeformingArmor(asset);
    installTitanClimbSurface(surface);
    disposeImportedRig(rig);
    return { surface, asset };
  })());
}
