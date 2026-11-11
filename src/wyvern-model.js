import {wyvernClipState} from "./wyvern-wing-pose.js";
import {wyvernRestLift} from "./wyvern-space.js";
import { clamp, ease, WYVERN_SCALE } from "./wyvern-space.js";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { WYVERN_GLB } from "./wyvern-model-data.js";
import { assetArrayBuffer } from "./asset-source.js";
import { prepareTitanModel } from "./titan-imports.js";
import { WYVERN_CINEMA } from "./wyvern-choreography.js";
import { wyvernTailAngles, wyvernThrowPose } from "./wyvern-posture.js";
let pending;
export function prepareWyvernModels() {
  return (pending ||= (async () => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const [sonic, gltf] = await Promise.all([
      prepareTitanModel("sonic"),
      assetArrayBuffer(WYVERN_GLB).then((b) => loader.parseAsync(b, "")),
    ]);
    for (const name of ["flight", "claw_left", "claw_right", "bite", "defeat"])
      if (!gltf.animations.some((c) => c.name === name))
        throw Error("Wyvern animation unavailable: " + name);
    if (!gltf.scene.getObjectByName("Head_07"))
      throw Error("Wyvern skeleton is missing its head");
    return { sonic, gltf };
  })().catch((e) => {
    pending = null;
    throw e;
  }));
}
export function makeWyvernRig(gltf) {
  const root = new T.Group(),
    model = cloneSkeleton(gltf.scene);
  root.name = "Wyvern";
  root.add(model);
  model.updateMatrixWorld(true);
  const box = new T.Box3(),
    faceBox = new T.Box3();
  model.traverse((o) => {
    if (!o.isMesh) return;
    const name = Array.isArray(o.material)
      ? o.material[0].name
      : o.material.name;
    o.visible = !/road01|muzzle01|_vda/.test(name);
    if (o.visible) box.union(new T.Box3().setFromObject(o));
    if (/white1/.test(name)) faceBox.union(new T.Box3().setFromObject(o));
  });
  const size = box.getSize(new T.Vector3()),
    head = faceBox.isEmpty()
      ? model.getObjectByName("Head_07").getWorldPosition(new T.Vector3())
      : faceBox.getCenter(new T.Vector3()),
    scale = (280*WYVERN_SCALE) / Math.max(size.x, size.y, size.z);
  const wrapper = new T.Group();
  root.remove(model);
  wrapper.add(model);
  root.add(wrapper);
  wrapper.scale.setScalar(scale);
  model.position.sub(head);
  const materials = new Set();
  model.traverse((o) => {
    if (o.isMesh) {
      o.geometry.userData.wyvernShared = true;
      o.material = Array.isArray(o.material)
        ? o.material.map((m) => m.clone())
        : o.material.clone();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        materials.add(m);
        if (m.isMeshStandardMaterial) {
          m.roughness = Math.min(0.67, Math.max(0.38, m.roughness));
          m.metalness = Math.max(0.32, m.metalness);
          m.color.multiplyScalar(0.78);
          m.envMapIntensity = 1.1;
        }
      }
      o.castShadow = o.receiveShadow = true;
      o.frustumCulled = false;
    }
  });
  const mixer = new T.AnimationMixer(model),
    actions = new Map(
      gltf.animations.map((c) => {
        const a = mixer.clipAction(c);
        a.setLoop(
          ["flight", "idle"].includes(c.name) ? T.LoopRepeat : T.LoopOnce,
          Infinity,
        );
        a.clampWhenFinished = true;
        return [c.name, a];
      }),
    );
  actions.get("flight").play();
  const needles = [];
  const tail = [];
  model.traverse((n) => {
    if (n.isBone && /^Needle[A-Z]1_/.test(n.name))
      needles.push({ node: n, rest: n.quaternion.clone() });
    if (n.isBone && /^Tail\d+_/.test(n.name)) tail.push(n);
  });
  root.userData = {
    needles,
    tail,
    tailRest: new Map(tail.map(n => [n,n.quaternion.clone()])),
    tailRotation: new T.Quaternion(),
    model,
    wrapper,
    mixer,
    actions,
    materials: [...materials],
    clip: "flight",
    head,
    scale,
    bindBounds: size,
  };
  return root;
}
export function animateWyvern(root, s, dt) {
  const w = s.wyvern,
    u = root.userData;
  const sampled=wyvernClipState(s),clip=sampled.name;
  if (clip !== u.clip) {
    const next = u.actions.get(clip);
    next.reset().fadeIn(0.22).play();
    u.actions.get(u.clip)?.fadeOut(0.22);
    u.clip = clip;
  }
  u.mixer.update(dt);
  u.actions.get(clip).time=sampled.time;
  u.mixer.update(0);
  const deploy =
    s.phase === 2 ? (s.stage === "phase" ? ease(s.stageTime / 12) : 1) : 0;
  for (const needle of u.needles)
    needle.node.quaternion
      .copy(needle.rest)
      .multiply(
        new T.Quaternion().setFromAxisAngle(
          new T.Vector3(0, 0, 1),
          -Math.PI / 2 - (Math.PI / 2) * deploy,
        ),
      );
  root.position.set(0, 66+wyvernRestLift(s) + Math.sin(s.time * 0.9) * 0.35, 0);
  root.rotation.set(0, w.yaw, 0);
  for (let i = 0; i < u.tail.length; i++) {
    const pose = wyvernTailAngles(i,u.tail.length,s.time,s.stage,s.stageTime);
    u.tailRotation.setFromEuler(new T.Euler(0,pose.yaw,pose.roll));
    u.tail[i].quaternion.copy(u.tailRest.get(u.tail[i])).multiply(u.tailRotation).normalize();
  }
  if (
    ["wyvern-slam", "wyvern-counter", "wyvern-hold", "wyvern-launch"].includes(
      s.stage,
    )
  ) {
    const pose = wyvernThrowPose(s.stageTime);
    root.rotation.z += pose.roll;
    root.rotation.y += pose.yaw;
    root.position.y -= pose.drop;
  }
  const fade =
    s.stage === "victory"
      ? 0
      : s.stage === "finale"
        ? Math.max(0, 1 - (s.stageTime - WYVERN_CINEMA.detonate) / 1.4)
        : 1;
  root.visible = fade > 0;
  for (const m of u.materials) {
    m.transparent = fade < 1;
    m.opacity = fade;
  }
}
