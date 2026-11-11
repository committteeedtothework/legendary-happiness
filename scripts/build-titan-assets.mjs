// Local, reproducible glTF authoring. No Tripo calls, paid services or downloads.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import * as T from "three";
const args = process.argv.slice(2),
  source = args[0],
  gigantoSource = args[1];
if (!source || !gigantoSource)
  throw Error(
    "Usage: node scripts/build-titan-assets.mjs <sonic GLB directory> <giganto GLB>",
  );
const out = "public/models/titan",
  tmp = "/tmp/dcsmcraft-titan-assets";
fs.mkdirSync(tmp, { recursive: true });
fs.mkdirSync(out, { recursive: true });
function load(file) {
  const b = fs.readFileSync(file),
    n = b.readUInt32LE(12),
    g = JSON.parse(b.subarray(20, 20 + n));
  return { g, bin: b.subarray(28 + n), file };
}
const sizes = { 5126: 4, 5125: 4, 5123: 2, 5121: 1, 5122: 2 },
  components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function read(a, id) {
  const ac = a.g.accessors[id],
    v = a.g.bufferViews[ac.bufferView],
    n = components[ac.type],
    size = sizes[ac.componentType],
    stride = v.byteStride || n * size,
    buf = a.bin;
  let vals = [];
  for (let i = 0; i < ac.count; i++)
    for (let k = 0; k < n; k++) {
      const o =
        (v.byteOffset || 0) + (ac.byteOffset || 0) + i * stride + k * size;
      vals.push(
        ac.componentType === 5126
          ? buf.readFloatLE(o)
          : ac.componentType === 5123
            ? buf.readUInt16LE(o)
            : ac.componentType === 5125
              ? buf.readUInt32LE(o)
              : buf.readUInt8(o),
      );
    }
  return vals;
}
class Author {
  constructor(file, role) {
    Object.assign(this, load(file));
    this.role = role;
    this.parts = this.g.bufferViews.map((v) =>
      this.bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength),
    );
    this.g.animations = [];
    this.g.extras ||= {};
    this.g.extras.dcsmRig = {
      role,
      clips: {},
      attachments: {},
      source: "Sketchfab user upload; TITAN-ASSETS.md",
    };
    this.rebuild();
  }
  rebuild() {
    const g = this.g;
    this.objects = g.nodes.map((n) => {
      const o = new T.Object3D();
      o.name = n.name || "";
      if (n.matrix) o.applyMatrix4(new T.Matrix4().fromArray(n.matrix));
      else {
        if (n.translation) o.position.fromArray(n.translation);
        if (n.rotation) o.quaternion.fromArray(n.rotation);
        if (n.scale) o.scale.fromArray(n.scale);
      }
      return o;
    });
    g.nodes.forEach((n, i) =>
      (n.children || []).forEach((j) => this.objects[i].add(this.objects[j])),
    );
    g.scenes[g.scene || 0].nodes.forEach((i) =>
      this.objects[i].updateMatrixWorld(true),
    );
    this.byName = new Map(g.nodes.map((n, i) => [n.name, i]));
  }
  view(data, target) {
    const id = this.parts.length;
    this.parts.push(Buffer.from(data));
    this.g.bufferViews.push({
      buffer: 0,
      byteLength: data.byteLength,
      ...(target ? { target } : {}),
    });
    return id;
  }
  accessor(values, type, componentType = 5126) {
    const array =
        componentType === 5123
          ? new Uint16Array(values)
          : new Float32Array(values),
      id = this.g.accessors.length,
      n = components[type],
      ac = {
        bufferView: this.view(Buffer.from(array.buffer)),
        componentType,
        count: values.length / n,
        type,
      };
    if (type === "SCALAR") {
      ac.min = [Math.min(...values)];
      ac.max = [Math.max(...values)];
    }
    if (type === "VEC3") {
      ac.min = [0, 1, 2].map((k) => {
        let v = Infinity;
        for (let j = k; j < values.length; j += 3) v = Math.min(v, values[j]);
        return v;
      });
      ac.max = [0, 1, 2].map((k) => {
        let v = -Infinity;
        for (let j = k; j < values.length; j += 3) v = Math.max(v, values[j]);
        return v;
      });
    }
    this.g.accessors.push(ac);
    return id;
  }
  node(
    name,
    parent,
    position = [0, 0, 0],
    rotation = [0, 0, 0, 1],
    scale = [1, 1, 1],
  ) {
    const id = this.g.nodes.length;
    this.g.nodes.push({ name, translation: position, rotation, scale });
    (this.g.nodes[parent].children ||= []).push(id);
    return id;
  }
  normalize(height) {
    let lo = new T.Vector3(Infinity, Infinity, Infinity),
      hi = new T.Vector3(-Infinity, -Infinity, -Infinity);
    for (const [i, n] of this.g.nodes.entries())
      if (n.mesh !== undefined) {
        const skin = n.skin !== undefined ? this.g.skins[n.skin] : null;
        const inv = skin ? read(this, skin.inverseBindMatrices) : null;
        const matrices = skin
          ? skin.joints.map((id, j) =>
              this.objects[id].matrixWorld
                .clone()
                .multiply(new T.Matrix4().fromArray(inv, j * 16)),
            )
          : null;
        for (const pr of this.g.meshes[n.mesh].primitives) {
          const pos = read(this, pr.attributes.POSITION),
            joints = skin ? read(this, pr.attributes.JOINTS_0) : null,
            weights = skin ? read(this, pr.attributes.WEIGHTS_0) : null;
          for (let j = 0; j < pos.length / 3; j++) {
            const v = new T.Vector3();
            if (skin) {
              for (let k = 0; k < 4; k++) {
                const w = weights[j * 4 + k];
                if (w)
                  v.addScaledVector(
                    new T.Vector3()
                      .fromArray(pos, j * 3)
                      .applyMatrix4(matrices[joints[j * 4 + k]]),
                    w,
                  );
              }
            } else
              v.fromArray(pos, j * 3).applyMatrix4(this.objects[i].matrixWorld);
            lo.min(v);
            hi.max(v);
          }
        }
      }
    const scale = height / (hi.y - lo.y),
      center = lo.clone().add(hi).multiplyScalar(0.5),
      roots = this.g.scenes[this.g.scene || 0].nodes,
      id = this.g.nodes.length;
    this.g.nodes.push({
      name: "dcsm_asset_root",
      children: roots,
      translation: [-center.x * scale, -lo.y * scale, -center.z * scale],
      scale: [scale, scale, scale],
    });
    this.g.scenes[this.g.scene || 0].nodes = [id];
    this.root = id;
    this.g.extras.dcsmRig.height = height;
    this.g.extras.dcsmRig.originalBounds = {
      min: lo.toArray(),
      max: hi.toArray(),
    };
    this.rebuild();
  }
  socket(name, parent, world) {
    const p = world
      ? new T.Vector3(...world)
          .applyMatrix4(this.objects[parent].matrixWorld.clone().invert())
          .toArray()
      : [0, 0, 0];
    const i = this.node(name, parent, p);
    this.g.extras.dcsmRig.attachments[name] = name;
    this.rebuild();
    return i;
  }
  poseRotation(id, angles) {
    const o = this.objects[id],
      pq =
        o.parent?.getWorldQuaternion(new T.Quaternion()) || new T.Quaternion(),
      delta = new T.Quaternion().setFromEuler(new T.Euler(...angles));
    return pq
      .clone()
      .invert()
      .multiply(delta)
      .multiply(pq)
      .multiply(o.quaternion)
      .normalize();
  }
  clip(name, duration, ids, pose, loop = false) {
    const time = Array.from({ length: Math.ceil(duration * 30) + 1 }, (_, i) =>
      Math.min(duration, i / 30),
    );
    if (time.at(-1) < duration) time.push(duration);
    const input = this.accessor(time, "SCALAR"),
      samplers = [],
      channels = [];
    for (const id of ids) {
      const values = [];
      let prev;
      for (const t of time) {
        const q = this.poseRotation(
          id,
          pose(t, duration)[this.g.nodes[id].name] || [0, 0, 0],
        );
        if (prev && q.dot(prev) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
        values.push(...q.toArray());
        prev = q;
      }
      const si = samplers.length;
      samplers.push({
        input,
        output: this.accessor(values, "VEC4"),
        interpolation: "LINEAR",
      });
      channels.push({ sampler: si, target: { node: id, path: "rotation" } });
    }
    this.g.animations.push({
      name,
      samplers,
      channels,
      extras: { dcsmAuthored: true, loop },
    });
    this.g.extras.dcsmRig.clips[name] = {
      duration,
      loop,
      origin: "DCSMCRAFT authored keyframes",
    };
  }
  importClip(file, name) {
    const a = load(file),
      anim = a.g.animations[0],
      access = new Map(),
      copy = (id) => {
        if (access.has(id)) return access.get(id);
        const v = read(a, id),
          ac = a.g.accessors[id],
          newId = this.accessor(v, ac.type, ac.componentType);
        access.set(id, newId);
        return newId;
      },
      samplers = anim.samplers.map((s) => ({
        ...s,
        input: copy(s.input),
        output: copy(s.output),
      })),
      channels = anim.channels.map((c) => ({
        sampler: c.sampler,
        target: {
          ...c.target,
          node: this.byName.get(a.g.nodes[c.target.node].name),
        },
      }));
    // Remove horizontal root translation without discarding the vertical stride.
    for (const ch of channels)
      if (
        ch.target.node === this.byName.get("Hips") &&
        ch.target.path === "translation"
      ) {
        const si = samplers[ch.sampler],
          vals = read(a, anim.samplers[ch.sampler].output);
        for (let j = 3; j < vals.length; j += 3) {
          vals[j] = vals[0];
          vals[j + 2] = vals[2];
        }
        si.output = this.accessor(vals, "VEC3");
      }
    const duration = Math.max(
      ...anim.samplers.flatMap((s) => read(a, s.input)),
    );
    this.g.animations.push({
      name,
      samplers,
      channels,
      extras: {
        loop: true,
        source: "User-supplied clip; horizontal root motion removed",
      },
    });
    this.g.extras.dcsmRig.clips[name] = {
      duration,
      loop: true,
      origin: "User-supplied animation",
    };
  }
  save(file) {
    let parts = [],
      offset = 0;
    this.g.bufferViews.forEach((v, i) => {
      const pad = -offset & 3;
      if (pad) {
        parts.push(Buffer.alloc(pad));
        offset += pad;
      }
      v.buffer = 0;
      v.byteOffset = offset;
      v.byteLength = this.parts[i].length;
      parts.push(this.parts[i]);
      offset += v.byteLength;
    });
    this.g.buffers = [{ byteLength: offset }];
    if (offset % 4) parts.push(Buffer.alloc(4 - (offset % 4)));
    const bin = Buffer.concat(parts),
      j = Buffer.from(JSON.stringify(this.g)),
      json = Buffer.concat([j, Buffer.alloc(-j.length & 3, 32)]),
      header = Buffer.alloc(20);
    header.write("glTF");
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(28 + json.length + bin.length, 8);
    header.writeUInt32LE(json.length, 12);
    header.writeUInt32LE(0x4e4f534a, 16);
    const bh = Buffer.alloc(8);
    bh.writeUInt32LE(bin.length);
    bh.writeUInt32LE(0x004e4942, 4);
    fs.writeFileSync(file, Buffer.concat([header, json, bh, bin]));
  }
}
function textures(file, name) {
  const dest = path.join(tmp, name + ".glb");
  const p = spawnSync(
    "python",
    ["scripts/prepare-titan-textures.py", file, dest, name],
    { stdio: "inherit" },
  );
  if (p.status) throw Error("Texture prep failed");
  return dest;
}
const sonic = new Author(
  textures(path.join(source, "T_pose sonic.glb"), "sonic"),
  "sonic",
);
sonic.normalize(3.7);
const sn = {
  hip: "Hips",
  spine: "Spine",
  head: "Head",
  armL: "LeftArm",
  armR: "RightArm",
  elbowL: "LeftForeArm",
  elbowR: "RightForeArm",
  legL: "LeftUpLeg",
  legR: "RightUpLeg",
  kneeL: "LeftLeg",
  kneeR: "RightLeg",
  handL: "LeftHand",
  handR: "RightHand",
};
sonic.g.extras.dcsmRig.bones = sn;
for (const [name, bone] of [
  ["socket_aura", "Spine"],
  ["socket_hand_left", "LeftHand"],
  ["socket_hand_right", "RightHand"],
  ["socket_foot_left", "LeftFoot"],
  ["socket_foot_right", "RightFoot"],
])
  sonic.socket(name, sonic.byName.get(bone));
// Retain both real user-supplied locomotion cycles, not renamed static poses.
sonic.importClip(path.join(source, "walking sonic.glb"), "move");
sonic.importClip(path.join(source, "running sonic.glb"), "run");
const sids = Object.values(sn).map((n) => sonic.byName.get(n));
function sonicPose(kind, t, d) {
  let w = Math.sin(t * Math.PI * 2),
    u = Math.min(1, t / d),
    strike = Math.sin(Math.PI * u),
    r = {};
  r[sn.armL] = [-0.15, 0, -1.35];
  r[sn.armR] = [-0.15, 0, 1.35];
  r[sn.elbowL] = [-0.25, 0, 0];
  r[sn.elbowR] = [-0.25, 0, 0];
  r[sn.head] = [Math.sin(t * 1.8) * 0.018, Math.sin(t * 1.6) * 0.035, 0];
  r[sn.spine] = [Math.sin(t * 2) * 0.012, 0, Math.sin(t * 0.9) * 0.018];
  if (kind === "fly") {
    r[sn.hip] = [0.08 + Math.sin(t * 2) * 0.02, 0, Math.sin(t) * 0.025];
    r[sn.armL] = [-0.3, 0, -1.25];
    r[sn.armR] = [-0.28, 0, 1.25];
    r[sn.elbowL] = [-0.6, 0, 0];
    r[sn.elbowR] = [-0.58, 0, 0];
    r[sn.legL] = [-0.15, 0, 0.09];
    r[sn.legR] = [0.22, 0, -0.09];
    r[sn.kneeL] = [0.35 + Math.sin(t * 2) * 0.05, 0, 0];
    r[sn.kneeR] = [0.6, 0, 0];
  }
  if (
    [
      "fly",
      "parry",
      "transform",
      "damage",
      "defeat",
      "attack",
      "attack_left",
      "attack_right",
      "counter",
      "sonic_boom",
      "wild_rush",
      "quick_cyloop",
      "boost",
      "jump",
      "fall",
      "dodge",
    ].includes(kind)
  ) {
    r[sn.armL] = [-0.25, 0, -1.16];
    r[sn.armR] = [-0.25, 0, 1.16];
    r[sn.legL] = [0.15, 0, 0.08];
    r[sn.legR] = [-0.15, 0, -0.08];
    r[sn.kneeR] = [0.28, 0, 0];
  }
  if (kind === "boost") {
    const wave = Math.sin(t * 22);
    r[sn.hip] = [0.5, 0, Math.sin(t * 22) * 0.025];
    r[sn.armL] = [0.8, 0, -1.3];
    r[sn.armR] = [0.8, 0, 1.3];
    r[sn.legL] = [wave, 0, 0];
    r[sn.legR] = [-wave, 0, 0];
    r[sn.kneeL] = [Math.max(0, -wave) * 1.3, 0, 0];
    r[sn.kneeR] = [Math.max(0, wave) * 1.3, 0, 0];
  }
  if (kind === "jump" || kind === "fall") {
    r[sn.armL] = [-0.8, 0, -0.85];
    r[sn.armR] = [-0.8, 0, 0.85];
    r[sn.legL] = [-0.65, 0, 0];
    r[sn.kneeL] = [1.1, 0, 0];
    r[sn.legR] = [0.15, 0, 0];
  }
  if (["attack", "attack_left", "attack_right", "counter"].includes(kind)) {
    const left = kind !== "attack_right";
    r[sn.hip] = [0, (left ? -1 : 1) * strike * 0.25, 0];
    r[sn[left ? "armL" : "armR"]] = [-1.4 * strike, 0, left ? -0.55 : 0.55];
    r[sn[left ? "elbowL" : "elbowR"]] = [-0.65 * (1 - strike), 0, 0];
    r[sn.legL] = [-0.35, 0, 0];
    r[sn.kneeL] = [0.6, 0, 0];
  }
  if (kind === "attack_windup") {
    r[sn.armL] = [-0.45, 0, -1];
    r[sn.armR] = [0.4, 0, 0.95];
    r[sn.elbowL] = [-1, 0, 0];
    r[sn.elbowR] = [-1, 0, 0];
    r[sn.spine] = [0, -0.2, 0];
  }
  if (kind === "parry") {
    r[sn.armL] = [-1.1, 0, -0.6];
    r[sn.armR] = [-1.1, 0, 0.6];
    r[sn.elbowL] = [-1, 0, 0];
    r[sn.elbowR] = [-1, 0, 0];
  }
  if (kind === "sonic_boom") {
    r[sn.legR] = [-1.3 * strike, 0, 0];
    r[sn.kneeR] = [0.2, 0, 0];
    r[sn.armL] = [0.5, 0, -1.1];
  }
  if (kind === "wild_rush" || kind === "quick_cyloop") {
    r[sn.hip] = [0.65, Math.sin(t * 6) * 0.25, 0];
    r[sn.armL] = [0.8, 0, -1.2];
    r[sn.armR] = [0.8, 0, 1.2];
    r[sn.legL] = [-0.8, 0, 0];
    r[sn.kneeL] = [1.2, 0, 0];
  }
  if (kind === "transform") {
    const spread = Math.sin(Math.PI * u);
    r[sn.armL] = [-0.3 - spread * 0.6, 0, -1.35 + spread * 0.65];
    r[sn.armR] = [-0.3 - spread * 0.6, 0, 1.35 - spread * 0.65];
    r[sn.head] = [-0.14 * spread, 0, 0];
  }
  if (kind === "damage") {
    r[sn.hip] = [-strike * 0.3, 0, strike * 0.2];
    r[sn.head] = [-strike * 0.2, 0, 0];
    r[sn.armL] = [-0.5, 0, -0.6];
    r[sn.armR] = [-0.5, 0, 0.6];
  }
  if (kind === "defeat") {
    r[sn.hip] = [u * 0.6, 0, u * 0.65];
    r[sn.head] = [u * 0.5, 0, 0];
    r[sn.armL] = [0, 0, -0.8];
    r[sn.armR] = [0, 0, 0.8];
  }
  if (kind === "dodge") {
    r[sn.spine] = [0, 0, Math.sin(u * Math.PI) * 0.6];
    r[sn.armL] = [0.3, 0, -1.2];
    r[sn.armR] = [-0.5, 0, 1.2];
  }
  if (kind === "fly") {
    r[sn.hip] = [0.08 + Math.sin(t * 2) * 0.02, 0, Math.sin(t) * 0.025];
    r[sn.elbowL] = [-0.6, 0, 0];
    r[sn.elbowR] = [-0.58, 0, 0];
    r[sn.kneeL] = [0.35 + Math.sin(t * 2) * 0.05, 0, 0];
    r[sn.kneeR] = [0.6, 0, 0];
  }
  if (["attack", "attack_left", "attack_right", "counter"].includes(kind)) {
    const left = kind !== "attack_right",
      phase =
        u < 0.22
          ? (-u / 0.22) * 0.38
          : u < 0.6
            ? Math.sin(((u - 0.22) / 0.38) * Math.PI * 0.5)
            : Math.cos(((u - 0.6) / 0.4) * Math.PI * 0.5);
    r[sn.hip] = [
      0.12 * strike,
      (left ? -1 : 1) * phase * 0.32,
      (left ? 1 : -1) * strike * 0.06,
    ];
    r[sn.spine] = [strike * 0.08, (left ? -1 : 1) * phase * 0.18, 0];
    r[sn[left ? "armL" : "armR"]] = [-1.55 * phase, 0, left ? -0.58 : 0.58];
    r[sn[left ? "elbowL" : "elbowR"]] = [
      -0.95 * (1 - Math.max(0, phase)),
      0,
      0,
    ];
  }
  if (kind === "parry") {
    r[sn.spine] = [-0.08, 0, 0];
    r[sn.kneeL] = [0.55, 0, 0];
    r[sn.kneeR] = [0.75, 0, 0];
  }
  if (kind === "transform") {
    r[sn.hip] = [-Math.sin(u * Math.PI) * 0.12, 0, 0];
    r[sn.spine] = [-Math.sin(u * Math.PI) * 0.14, 0, 0];
  }
  return r;
}
for (const [name, d, loop] of [
  ["idle", 3, true],
  ["boost", 0.7, true],
  ["jump", 0.7, false],
  ["fall", 1, true],
  ["fly", 2, true],
  ["parry", 1.2, true],
  ["transform", 6, false],
  ["attack_windup", 0.4, false],
  ["attack", 0.28, false],
  ["attack_left", 0.28, false],
  ["attack_right", 0.28, false],
  ["recovery", 0.4, false],
  ["damage", 0.75, false],
  ["defeat", 2, false],
  ["counter", 1.2, false],
  ["sonic_boom", 0.65, false],
  ["wild_rush", 0.8, false],
  ["quick_cyloop", 1.6, false],
  ["dodge", 0.5, false],
])
  sonic.clip(name, d, sids, (t, d) => sonicPose(name, t, d), loop);
// A visible raised-quill pose uses six extra skinned joints, retaining the mesh.
function addQuills(a) {
  const g = a.g,
    skin = g.skins[0],
    head = a.byName.get("Head"),
    oldInverse = read(a, skin.inverseBindMatrices),
    joints = skin.joints.length,
    headJoint = skin.joints.indexOf(head),
    baseWorld = a.objects[head].matrixWorld.clone(),
    rootWorld = a.objects[a.root].matrixWorld.clone(),
    unscale = rootWorld.clone().invert(),
    newIds = [];
  for (let n = 0; n < 6; n++) {
    const side = n % 2 ? 1 : -1,
      row = Math.floor(n / 2),
      pivot = new T.Vector3(side * 0.12, 1.34 - row * 0.08, -0.1).applyMatrix4(
        rootWorld,
      ),
      local = pivot.clone().applyMatrix4(baseWorld.clone().invert()),
      id = a.node("quill_" + n, head, local.toArray());
    newIds.push(id);
    skin.joints.push(id);
    const inv = new T.Matrix4().makeTranslation(
      -side * 0.12,
      -(1.34 - row * 0.08),
      0.1,
    );
  }
  a.rebuild();
  for (const id of newIds) {
    const original = unscale
      .clone()
      .multiply(a.objects[id].matrixWorld)
      .invert();
    oldInverse.push(...original.elements);
  }
  skin.inverseBindMatrices = a.accessor(oldInverse, "MAT4");
  for (const mesh of g.meshes)
    for (const pr of mesh.primitives) {
      const positions = read(a, pr.attributes.POSITION),
        js = read(a, pr.attributes.JOINTS_0),
        weights = read(a, pr.attributes.WEIGHTS_0);
      let count = 0;
      for (let i = 0; i < positions.length / 3; i++) {
        const [x, y, z] = positions.slice(i * 3, i * 3 + 3);
        if (y < 1.16 || z > -0.12) continue;
        const row = y > 1.48 ? 0 : y > 1.32 ? 1 : 2,
          n = row * 2 + (x > 0 ? 1 : 0),
          blend =
            Math.min(1, (-z - 0.12) / 0.12) * Math.min(1, (y - 1.16) / 0.12);
        if (blend < 0.02) continue;
        js.splice(i * 4, 4, joints + n, headJoint, 0, 0);
        weights.splice(i * 4, 4, blend, 1 - blend, 0, 0);
        count++;
      }
      pr.attributes.JOINTS_0 = a.accessor(js, "VEC4", 5123);
      pr.attributes.WEIGHTS_0 = a.accessor(weights, "VEC4");
      a.g.extras.dcsmRig.quillVertexCount = count;
    }
  a.g.extras.dcsmRig.quills = newIds.map((i) => g.nodes[i].name);
  // Separate additive pose is blended with the locomotion/combat body clips.
  a.clip(
    "super_quills",
    1,
    newIds,
    () =>
      Object.fromEntries(
        newIds.map((id, n) => [
          g.nodes[id].name,
          [1.15, 0, (n % 2 ? 1 : -1) * 0.12],
        ]),
      ),
    true,
  );
}
addQuills(sonic);
sonic.save(path.join(out, "sonic.glb"));
const boss = new Author(textures(gigantoSource, "giganto"), "giganto");
boss.normalize(90);
const bn = {
  hip: "Hips_03",
  chest: "Spine3_06",
  head: "Head_038",
  jaw: "Jaw_048",
  armL: "UpperArm_L_09",
  armR: "UpperArm_R_060",
  elbowL: "ForeArm_L_013",
  elbowR: "ForeArm_R_064",
  handL: "Hand_L_017",
  handR: "Hand_R_068",
  legL: "Thigh_L_086",
  legR: "Thigh_R_00",
  kneeL: "Calf1_L_088",
  kneeR: "Calf1_R_094",
};
boss.g.extras.dcsmRig.bones = bn;
for (const [name, bone] of [
  ["socket_hand_left", bn.handL],
  ["socket_hand_right", bn.handR],
])
  boss.socket(name, boss.byName.get(bone));
boss.socket("socket_mouth", boss.byName.get(bn.jaw), [0, 85, 17]);
function addGeometry(a, geo) {
  const p = geo.attributes.position,
    n = geo.attributes.normal,
    uv = geo.attributes.uv;
  return {
    attributes: {
      POSITION: a.accessor([...p.array], "VEC3"),
      NORMAL: a.accessor([...n.array], "VEC3"),
      TEXCOORD_0: a.accessor([...uv.array], "VEC2"),
    },
    indices: a.accessor([...geo.index.array], "SCALAR", 5123),
    mode: 4,
  };
}
const darkMat = boss.g.materials.length;
boss.g.materials.push({
  name: "DCSM original dorsal armor",
  pbrMetallicRoughness: {
    baseColorFactor: [0.018, 0.028, 0.04, 1],
    metallicFactor: 0.5,
    roughnessFactor: 0.6,
  },
});
const redMat = boss.g.materials.length;
boss.g.materials.push({
  name: "DCSM original dorsal core",
  pbrMetallicRoughness: {
    baseColorFactor: [0.7, 0.02, 0.07, 1],
    metallicFactor: 0.15,
    roughnessFactor: 0.4,
  },
  emissiveFactor: [1, 0.02, 0.06],
});
const shaft = new T.CylinderGeometry(0.75, 1.25, 14, 8).translate(0, 7, 0),
  tip = new T.CylinderGeometry(0.8, 0.8, 1.8, 8).translate(0, 14.9, 0),
  mi = boss.g.meshes.length;
boss.g.meshes.push({
  name: "DCSM dorsal emitter",
  primitives: [
    { ...addGeometry(boss, shaft), material: darkMat },
    { ...addGeometry(boss, tip), material: redMat },
  ],
});
shaft.dispose();
tip.dispose();
const rods = [];
for (let i = 0; i < 10; i++) {
  const side = i < 5 ? -1 : 1,
    k = i % 5,
    parent = boss.byName.get(bn.chest),
    world = new T.Matrix4().compose(
      new T.Vector3(side * (4 + k * 3.4), 76 - k * 0.8, -10),
      new T.Quaternion().setFromEuler(
        new T.Euler(-0.25, 0, -side * (0.12 + k * 0.1)),
      ),
      new T.Vector3(1, 1, 1),
    ),
    local = boss.objects[parent].matrixWorld.clone().invert().multiply(world),
    p = new T.Vector3(),
    q = new T.Quaternion(),
    s = new T.Vector3();
  local.decompose(p, q, s);
  const id = boss.node(
    "dorsal_" + i,
    parent,
    p.toArray(),
    q.toArray(),
    s.toArray(),
  );
  const meshNode = boss.node("dorsal_mesh_" + i, id);
  boss.g.nodes[meshNode].mesh = mi;
  rods.push(id);
  boss.rebuild();
  boss.socket("socket_dorsal_" + String(i + 1).padStart(2, "0"), id);
  const socket = boss.g.nodes.at(-1);
  socket.translation = [0, 15.8, 0];
  boss.rebuild();
}
boss.g.extras.dcsmRig.rods = rods.map((i) => boss.g.nodes[i].name);
const fingers = boss.g.nodes
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => /^(Thumb[123]|Index[123]|Pinky[123])_[LR]_/.test(n.name))
    .map((x) => x.i),
  bids = [...Object.values(bn).map((n) => boss.byName.get(n)), ...fingers];
function bossPose(kind, t, d) {
  const u = Math.min(1, t / d),
    smooth = u * u * (3 - 2 * u),
    r = {};
  r[bn.armL] = [0.025, 0, 0.08];
  r[bn.armR] = [0.025, 0, -0.08];
  r[bn.chest] = [Math.sin(t * 0.65) * 0.012, Math.sin(t * 0.8) * 0.018, 0];
  r[bn.head] = [
    0.16 + Math.sin(t * 0.8) * 0.018,
    Math.sin(t * 0.35) * 0.028,
    0,
  ];
  r[bn.hip] = [0, Math.sin(t * 0.42) * 0.012, Math.sin(t * 0.62) * 0.01];
  const wind = kind.includes("windup"),
    recover = kind.includes("recovery"),
    swing = kind.includes("swing"),
    slap = kind.includes("slap"),
    grab = kind.includes("grab"),
    amount = wind ? smooth : recover ? 1 - smooth : Math.sin(Math.PI * u);
  if (swing || kind === "attack") {
    r[bn.armL] = [
      -0.4 - (wind ? 0 : amount),
      0,
      wind ? amount * 1.05 : recover ? -0.8 * amount : 1.05 - 1.9 * smooth,
    ];
    r[bn.elbowL] = [-0.5 * amount, 0, 0];
    r[bn.chest] = [0, wind ? 0.22 * amount : -0.3 * amount, 0];
  }
  if (slap) {
    r[bn.armR] = [
      -0.6 - (wind ? 0 : amount * 0.6),
      0,
      wind ? -amount : recover ? 0.8 * amount : -1 + 1.9 * smooth,
    ];
    r[bn.elbowR] = [-0.45 * amount, 0, 0];
  }
  if (grab) {
    const a = wind ? smooth : recover ? 1 - smooth : 1;
    r[bn.armL] = [-a * 1.05, 0, -a * 0.55];
    r[bn.armR] = [-a * 1.05, 0, a * 0.55];
    r[bn.elbowL] = [-a * 0.7, 0, 0];
    r[bn.elbowR] = [-a * 0.7, 0, 0];
    r[bn.jaw] = [a * 0.45, 0, 0];
    for (const i of fingers) r[boss.g.nodes[i].name] = [0, 0, a * 0.55];
  }
  if (["jaw_open", "jaw_close", "beam_charge", "beam_fire"].includes(kind))
    r[bn.jaw] = [
      (kind === "jaw_close" ? 1 - smooth : kind === "beam_fire" ? 1 : smooth) *
        0.6,
      0,
      0,
    ];
  if (kind === "damage" || kind === "stagger") {
    r[bn.chest] = [-0.1, 0, Math.sin(t * 12) * 0.025];
    r[bn.head] = [0.12, 0, 0];
    r[bn.armL] = [0.15, 0, 0.18];
    r[bn.armR] = [0.15, 0, -0.18];
  }
  if (kind === "defeat") {
    r[bn.hip] = [smooth * 0.1, 0, smooth * 0.06];
    r[bn.chest] = [smooth * 0.28, 0, smooth * 0.08];
    r[bn.head] = [smooth * 0.3, 0, 0];
    r[bn.armL] = [smooth * 0.12, 0, 0.12];
    r[bn.armR] = [smooth * 0.12, 0, -0.12];
    r[bn.kneeL] = [smooth * 0.17, 0, 0];
    r[bn.kneeR] = [smooth * 0.17, 0, 0];
  }
  if (kind === "move") {
    r[bn.legL] = [Math.sin(t * 3) * 0.12, 0, 0];
    r[bn.legR] = [-Math.sin(t * 3) * 0.12, 0, 0];
    r[bn.kneeL] = [Math.max(0, -Math.sin(t * 3)) * 0.15, 0, 0];
    r[bn.kneeR] = [Math.max(0, Math.sin(t * 3)) * 0.15, 0, 0];
  }
  if (kind === "phase_transition") {
    r[bn.chest] = [-Math.sin(u * Math.PI) * 0.1, 0, 0];
    r[bn.armL] = [-0.25, 0, 0.25];
    r[bn.armR] = [-0.25, 0, -0.25];
    r[bn.jaw] = [Math.sin(u * Math.PI) * 0.4, 0, 0];
  }
  return r;
}
for (const [name, d, loop] of [
  ["idle", 4, true],
  ["move", 2.1, true],
  ["attack_windup", 1.5, false],
  ["attack", 0.42, false],
  ["recovery", 3.1, false],
  ["damage", 0.5, false],
  ["defeat", 7, false],
  ["arm_swing_windup", 1.5, false],
  ["arm_swing", 0.42, false],
  ["arm_swing_recovery", 3.1, false],
  ["arm_slap_windup", 1.2, false],
  ["arm_slap", 0.32, false],
  ["arm_slap_recovery", 2.9, false],
  ["grab_windup", 1.75, false],
  ["grab", 4.2, false],
  ["grab_recovery", 3.6, false],
  ["jaw_open", 1, false],
  ["jaw_close", 1, false],
  ["beam_charge", 1.8, false],
  ["beam_fire", 4.5, true],
  ["phase_transition", 4, false],
  ["stagger", 2, true],
])
  boss.clip(name, d, bids, (t, d) => bossPose(name, t, d), loop);
for (const name of ["dorsal_extend", "dorsal_pulse"]) {
  const duration = name === "dorsal_extend" ? 4 : 2;
  boss.clip(name, duration, rods, () => ({}), name === "dorsal_pulse");
  const a = boss.g.animations.at(-1);
  for (const id of rods) {
    const times = Array.from({ length: 61 }, (_, n) => (n / 60) * duration),
      base = boss.g.nodes[id].scale,
      values = times.flatMap((t) => [
        base[0],
        base[1] *
          (name === "dorsal_extend"
            ? 1 + 0.6 * (t / duration)
            : 1.6 + Math.sin(t * 7) * 0.025),
        base[2],
      ]);
    a.channels.push({
      sampler: a.samplers.length,
      target: { node: id, path: "scale" },
    });
    a.samplers.push({
      input: boss.accessor(times, "SCALAR"),
      output: boss.accessor(values, "VEC3"),
      interpolation: "LINEAR",
    });
  }
}
boss.save(path.join(out, "giganto.glb"));
const manifest = {
  schema: 1,
  sonic: {
    file: "sonic.glb",
    bytes: fs.statSync(path.join(out, "sonic.glb")).size,
    clips: sonic.g.extras.dcsmRig.clips,
  },
  giganto: {
    file: "giganto.glb",
    bytes: fs.statSync(path.join(out, "giganto.glb")).size,
    clips: boss.g.extras.dcsmRig.clips,
  },
  cost: {
    paidGenerationCredits: 0,
    workflow: "User-supplied Sketchfab files; entirely local processing",
  },
  limits: [
    "Original Sonic skeleton has no finger/facial bones; glove/facial animation remains approximate",
    "Combat/cinematic keyframes are original approximations, not official Frontiers clips",
    "Existing game hit volumes and stationary boss behavior are unchanged",
  ],
};
fs.writeFileSync(
  path.join(out, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    sonic: manifest.sonic.bytes,
    giganto: manifest.giganto.bytes,
    clips: [sonic.g.animations.length, boss.g.animations.length],
  }),
);
