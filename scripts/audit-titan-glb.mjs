// Offline preflight for imported Titan assets. This does not certify visual quality,
// skin deformation, collision alignment or browser performance; those require the
// real Three.js renderer and the complete encounter playthrough.
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const contract = JSON.parse(
  await readFile(
    new URL("../reference/titan-assets/model-contract.json", import.meta.url),
    "utf8",
  ),
);
function imageSize(data, mime) {
  if (
    mime === "image/png" &&
    data.length >= 24 &&
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return [data.readUInt32BE(16), data.readUInt32BE(20)];
  if (mime === "image/jpeg" && data[0] === 255 && data[1] === 216) {
    let p = 2;
    while (p + 4 <= data.length) {
      if (data[p++] !== 255) continue;
      let marker = data[p++];
      while (marker === 255 && p < data.length) marker = data[p++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      const len = data.readUInt16BE(p);
      if (len < 2 || p + len > data.length) break;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker) &&
        len >= 7
      )
        return [data.readUInt16BE(p + 5), data.readUInt16BE(p + 3)];
      p += len;
    }
  }
  if (
    mime === "image/webp" &&
    data.length >= 30 &&
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.toString("ascii", 8, 12) === "WEBP"
  ) {
    const type = data.toString("ascii", 12, 16);
    if (type === "VP8X")
      return [1 + data.readUIntLE(24, 3), 1 + data.readUIntLE(27, 3)];
    if (
      type === "VP8 " &&
      data[23] === 157 &&
      data[24] === 1 &&
      data[25] === 42
    )
      return [data.readUInt16LE(26) & 16383, data.readUInt16LE(28) & 16383];
    if (type === "VP8L" && data[20] === 47) {
      const n = data.readUInt32LE(21);
      return [(n & 16383) + 1, ((n >>> 14) & 16383) + 1];
    }
  }
  return null;
}
export function auditTitanGlb(bytes, profile) {
  const spec = contract[profile];
  if (!spec?.targetTriangles) throw Error("Profile must be sonic or giganto");
  const buffer = Buffer.from(bytes),
    errors = [],
    warnings = [];
  if (
    buffer.length < 20 ||
    buffer.toString("ascii", 0, 4) !== "glTF" ||
    buffer.readUInt32LE(4) !== 2 ||
    buffer.readUInt32LE(8) !== buffer.length
  )
    throw Error("Not a complete glTF 2.0 binary file");
  let gltf,
    bin = null;
  const chunks = [];
  for (let p = 12; p < buffer.length; ) {
    if (p + 8 > buffer.length) throw Error("Truncated GLB chunk header");
    const len = buffer.readUInt32LE(p),
      type = buffer.readUInt32LE(p + 4);
    p += 8;
    if (len % 4 || p + len > buffer.length)
      throw Error("Invalid GLB chunk bounds/alignment");
    const data = buffer.subarray(p, p + len);
    chunks.push(type);
    if (type === 0x4e4f534a) {
      if (gltf) throw Error("Duplicate GLB JSON chunk");
      gltf = JSON.parse(data.toString("utf8").trim());
    }
    if (type === 0x004e4942) {
      if (bin) throw Error("Duplicate GLB BIN chunk");
      bin = data;
    }
    p += len;
  }
  if (!gltf || !bin || chunks[0] !== 0x4e4f534a)
    throw Error("GLB must contain JSON first and embedded BIN data");
  if (gltf.asset?.version !== "2.0")
    errors.push("Asset version is not glTF 2.0");
  const views = gltf.bufferViews || [],
    accessors = gltf.accessors || [],
    nodes = gltf.nodes || [],
    skins = gltf.skins || [],
    meshes = gltf.meshes || [];
  if (
    gltf.buffers?.length !== 1 ||
    gltf.buffers.some((b) => b.uri) ||
    gltf.buffers?.[0]?.byteLength > bin.length
  )
    errors.push("All model buffers must be embedded in the GLB BIN chunk");
  const embedded = (viewId) => {
    const v = views[viewId];
    if (
      !v ||
      v.buffer !== 0 ||
      !Number.isInteger(v.byteLength) ||
      v.byteLength < 0 ||
      !Number.isInteger(v.byteOffset ?? 0) ||
      (v.byteOffset ?? 0) < 0 ||
      (v.byteOffset ?? 0) + v.byteLength > bin.length
    )
      return null;
    return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
  };
  views.forEach((v, i) => {
    if (!embedded(i)) errors.push(`Invalid embedded bufferView ${i}`);
  });
  for (const [i, texture] of (gltf.textures || []).entries()) {
    const core = gltf.images?.[texture.source];
    if (core && !["image/png", "image/jpeg"].includes(core.mimeType))
      errors.push(
        `Texture ${i} core source must be PNG/JPEG; extension-only images need their extension source`,
      );
  }
  const unsupported = (gltf.extensionsRequired || []).filter(
    (k) =>
      ![
        "KHR_materials_unlit",
        "KHR_texture_transform",
        "KHR_materials_emissive_strength",
        "EXT_texture_webp",
      ].includes(k),
  );
  if (unsupported.length)
    errors.push(
      "Required extensions need explicit renderer/decoder support: " +
        unsupported.join(", "),
    );
  let triangles = 0,
    skinnedPrimitives = 0;
  for (const [i, n] of nodes.entries()) {
    for (const key of ["matrix", "translation", "rotation", "scale"])
      if (n[key] && !n[key].every(Number.isFinite))
        errors.push(`Node ${i} has non-finite ${key}`);
    for (const child of n.children || [])
      if (!nodes[child] || child === i)
        errors.push(`Invalid child on node ${i}`);
    if (n.mesh === undefined) continue;
    if (!meshes[n.mesh]) {
      errors.push(`Node ${i} refers to missing mesh`);
      continue;
    }
    for (const prim of meshes[n.mesh].primitives || []) {
      const count =
        accessors[prim.indices ?? prim.attributes?.POSITION]?.count || 0;
      if ((prim.mode ?? 4) !== 4)
        errors.push("Character primitives must use triangles");
      else triangles += count / 3;
      if (n.skin !== undefined) {
        if (!skins[n.skin]) errors.push(`Node ${i} refers to missing skin`);
        if (
          prim.attributes?.JOINTS_0 === undefined ||
          prim.attributes?.WEIGHTS_0 === undefined
        )
          errors.push(`Skinned mesh ${n.mesh} lacks joint indices/weights`);
        else skinnedPrimitives++;
      }
    }
  }
  if (!skins.length || !skinnedPrimitives)
    errors.push("No deforming skinned mesh found");
  for (const [i, skin] of skins.entries()) {
    if (!skin.joints?.length || skin.joints.some((j) => !nodes[j]))
      errors.push(`Skin ${i} has missing joints`);
    if (skin.inverseBindMatrices !== undefined) {
      const a = accessors[skin.inverseBindMatrices];
      if (
        a?.type !== "MAT4" ||
        a.componentType !== 5126 ||
        a.count !== skin.joints?.length
      )
        errors.push(`Skin ${i} has invalid inverse bind matrices`);
    }
  }
  if (triangles > spec.targetTriangles[1])
    errors.push(`Triangle budget exceeded: ${triangles}`);
  if (triangles < spec.targetTriangles[0])
    warnings.push(
      `Below the requested target band: ${triangles} triangles; review the silhouette before accepting`,
    );
  const images = (gltf.images || []).map((img, i) => {
    if (img.uri) {
      errors.push(`Image ${i} is not embedded as a bufferView`);
      return { index: i, embedded: false };
    }
    const data = embedded(img.bufferView),
      size = data && imageSize(data, img.mimeType);
    if (!size) errors.push(`Cannot verify image ${i} dimensions/format`);
    else if (
      size.some(
        (n) => n < contract.textures.minimum || n > contract.textures.maximum,
      ) &&
      !img.extras?.dcsmUtilityTexture
    )
      errors.push(`Image ${i} is outside the 1K–2K budget: ${size.join("x")}`);
    return { index: i, mimeType: img.mimeType, size, embedded: !!data };
  });
  if (
    !images.length ||
    !gltf.textures?.length ||
    !gltf.materials?.some((m) => m.pbrMetallicRoughness?.baseColorTexture)
  )
    errors.push("Missing embedded base-color textures");
  const animations = gltf.animations || [],
    names = animations.map((a) => a.name),
    required = [...contract.commonClips, ...spec.additionalClips];
  for (const name of required)
    if (!names.includes(name)) errors.push("Missing animation: " + name);
  for (const [i, a] of animations.entries()) {
    if (!a.name || names.indexOf(a.name) !== i)
      errors.push(`Animation ${i} has missing/duplicate name`);
    if (!a.channels?.length)
      errors.push(`Animation ${a.name || i} has no keyed channels`);
    for (const ch of a.channels || []) {
      const sampler = a.samplers?.[ch.sampler],
        input = accessors[sampler?.input],
        output = accessors[sampler?.output];
      if (
        !nodes[ch.target?.node] ||
        !["translation", "rotation", "scale", "weights"].includes(
          ch.target?.path,
        )
      )
        errors.push(`Animation ${a.name} targets an invalid node/path`);
      if (
        !input ||
        input.count < 2 ||
        input.type !== "SCALAR" ||
        input.componentType !== 5126 ||
        !output
      )
        errors.push(`Animation ${a.name} has invalid keyframes`);
    }
  }
  const nodeNames = new Set(nodes.map((n) => n.name));
  for (const name of spec.attachments)
    if (!nodeNames.has(name)) errors.push("Missing effect attachment: " + name);
  return {
    profile,
    valid: errors.length === 0,
    bytes: buffer.length,
    triangles,
    skins: skins.length,
    skinnedPrimitives,
    images,
    animationNames: names,
    errors,
    warnings,
    requiresVisualAndRuntimeReview: true,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const [profile, file] = process.argv.slice(2);
    if (!file)
      throw Error(
        "Usage: node scripts/audit-titan-glb.mjs sonic|giganto path/to/model.glb",
      );
    const report = auditTitanGlb(await readFile(file), profile);
    console.log(JSON.stringify(report, null, 2));
    if (!report.valid) process.exitCode = 1;
  } catch (e) {
    console.error(e.message);
    process.exitCode = 2;
  }
}
