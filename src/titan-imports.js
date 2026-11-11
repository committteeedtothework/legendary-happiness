import { prepareSonicQuills, updateSonicQuills, disposeSonicQuills } from "./sonic-quills.js";
import { titanPose } from "./titan-space.js";
import { titanDefeatPose, titanPierceMotion } from "./titan-finale.js";
import { TITAN_SWEEP } from "./titan-sweep.js";
import {
  initializeTitanPose,
  titanActionAt as actionAt,
  blendTitanPose as blendRig,
  titanLocomotionTime,
  sampleTitanArmorPose,
} from "./titan-animation.js";
import { armorMode, armorAttached, armorUp } from "./titan-climb.js";
import { titanWorldVector } from "./titan-space.js";
import { TITAN_FINALE, titanCounterContact } from "./titan-cinematics.js";
import { titanBodyHeight, titanWorldPoint } from "./titan-space.js";
import { titanStepProgress } from "./titan-mobility.js";
import { addTitanMotionClips } from "./titan-motion-clips.js";
import { titanActionDuration } from "./titan-combat.js";
import { nearestTitanSurface, titanAttackSide } from "./titan-contact.js";
import { performTitanSonic, performTitanBoss } from "./titan-kinematics.js";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { TITAN_GLB_DATA } from "./titan-model-data.js";
import { assetArrayBuffer } from "./asset-source.js";
import { sonicLength } from "./titan-metrics.js";
import { sonicSuper, titanTransformation } from "./titan-transformation.js";
import { TITAN_MOVES } from "./giganto-simulation.js";
const titanModels = new Map();
export function prepareTitanModel(role) {
  if (!["sonic", "giganto"].includes(role))
    return Promise.reject(new Error("Unknown Titan model"));
  if (!titanModels.has(role))
    titanModels.set(
      role,
      (async () => {
        const loader = new GLTFLoader();
        loader.setCrossOrigin("anonymous");
        // All buffers and WebP images are embedded. No CDN or decoder request.
        const gltf = await loader.parseAsync(
          await assetArrayBuffer(TITAN_GLB_DATA[role]),
          "",
        );
        const metadata = gltf.parser.json.extras?.dcsmRig;
        if (!metadata || metadata.role !== role)
          throw Error("Imported Titan rig metadata is missing: " + role);
        const required =
          role === "sonic"
            ? [
                "idle",
                "move",
                "run",
                "boost",
                "jump",
                "fly",
                "parry",
                "transform",
                "attack",
                "damage",
                "defeat",
              ]
            : [
                "idle",
                "arm_swing",
                "arm_slap",
                "grab",
                "beam_fire",
                "defeat",
                "dorsal_extend",
              ];
        for (const name of required)
          if (!gltf.animations.some((a) => a.name === name))
            throw Error(role + " is missing animation " + name);
        for (const name of Object.values(metadata.bones))
          if (!gltf.scene.getObjectByName(name))
            throw Error(role + " is missing joint " + name);
        let superMaterial;
        if (role === "sonic")
          superMaterial = await gltf.parser.getDependency(
            "material",
            gltf.parser.json.extras.dcsmSuperMaterial,
          );
        gltf.scene.traverse((o) => {
          if (o.geometry) o.geometry.userData.dcsmShared = true;
        });
        return { role, gltf, metadata, superMaterial };
      })().catch((error) => {
        titanModels.delete(role);
        throw error;
      }),
    );
  return titanModels.get(role);
}
export async function prepareTitanModels() {
  return Promise.all(["sonic", "giganto"].map(prepareTitanModel));
}
export function importedRig(asset) {
  const root = new T.Group(),
    model = cloneSkeleton(asset.gltf.scene),
    materials = new Map();
  root.name = "Imported " + asset.role;
  root.add(model);
  model.traverse((o) => {
    if (o.isMesh) {
      o.material = Array.isArray(o.material)
        ? o.material.map(copy)
        : copy(o.material);
      o.castShadow = o.receiveShadow = true;
      o.frustumCulled = false;
    }
  });
  function copy(m) {
    if (!materials.has(m)) materials.set(m, m.clone());
    const copy = materials.get(m);
    if (copy.isMeshStandardMaterial) {
      copy.envMapIntensity = asset.role === "giganto" ? 1.35 : 0.85;
      copy.roughness = T.MathUtils.clamp(
        copy.roughness,
        asset.role === "giganto" ? 0.42 : 0.52,
        0.88,
      );
      if (asset.role === "giganto")
        copy.metalness = T.MathUtils.clamp(copy.metalness, 0.32, 0.65);
    }
    return copy;
  }
  const meta = asset.metadata,
    bones = Object.fromEntries(
      Object.entries(meta.bones).map(([key, name]) => [
        key,
        model.getObjectByName(name),
      ]),
    );
  const mixer = new T.AnimationMixer(model),
    actions = new Map(
      asset.gltf.animations.map((clip) => {
        // Locomotion clips contain redundant bind-pose translation/scale keys.
        // Keep limb lengths and model scale in the character's own bind space.
        let playback = clip;
        if (asset.role === "sonic" && ["move", "run"].includes(clip.name)) {
          playback = clip.clone();
          playback.tracks = playback.tracks.filter(
            (t) =>
              !t.name.endsWith(".scale") &&
              (!t.name.endsWith(".position") || t.name === "Hips.position"),
          );
          const hips = playback.tracks.find((t) => t.name === "Hips.position");
          if (hips) {
            const rest = bones.hip.position,
              values = hips.values;
            let mean = 0;
            for (let i = 1; i < values.length; i += 3) mean += values[i];
            mean /= values.length / 3;
            for (let i = 0; i < values.length; i += 3) {
              values[i] = rest.x;
              values[i + 1] = rest.y + (values[i + 1] - mean) * 0.65;
              values[i + 2] = rest.z;
            }
          }
        }
        const action = mixer.clipAction(playback);
        action.setEffectiveWeight(0);
        action.setLoop(
          meta.clips[clip.name]?.loop ? T.LoopRepeat : T.LoopOnce,
          Infinity,
        );
        action.clampWhenFinished = true;
        return [clip.name, action];
      }),
    );
  const superMat = asset.superMaterial?.clone();
  if (superMat) {
    superMat.roughness = 0.42;
    superMat.metalness = 0.05;
    superMat.envMapIntensity = 1.15;
    superMat.emissiveIntensity = Math.max(
      0.38,
      Math.min(superMat.emissiveIntensity, 0.55),
    );
  }
  root.userData = {
    imported: true,
    role: asset.role,
    model,
    bones,
    materials: [...materials.values(), ...(superMat ? [superMat] : [])],
    mixer,
    actions,
    metadata: meta,
    super: false,
    superMaterial: superMat,
    blueMaterials: [],
    rods: (meta.rods || []).map((name) => model.getObjectByName(name)),
    laserSockets: Array.from({ length: 10 }, (_, i) =>
      model.getObjectByName("socket_dorsal_" + String(i + 1).padStart(2, "0")),
    ),
    jawSocket: model.getObjectByName("socket_mouth"),
    quills: (meta.quills || []).map((name) => model.getObjectByName(name)),
    lastAttack: "idle",
    transitions: new Map(),
    bindScales: new Map(),
    sampledRotations: new Map(),
    hipRest: bones.hip.quaternion.clone(),
  };
  if (asset.role === "sonic")
    model.traverse((o) => {
      if (o.isBone) root.userData.bindScales.set(o, o.scale.clone());
    });
  if (asset.role === "sonic")
    model.traverse((o) => {
      if (o.isMesh) root.userData.blueMaterials.push([o, o.material]);
    });
  model.traverse((o) => {
    if (o.isBone) root.userData.sampledRotations.set(o, o.quaternion.clone());
  });
  if (asset.role === "sonic") prepareSonicQuills(root);
  addTitanMotionClips(root.userData);
  initializeTitanPose(root.userData);
  model.updateMatrixWorld(true);
  if (asset.role === "sonic") {
    root.userData.groundSoles = [];
    model.traverse((mesh) => {
      if (!mesh.isSkinnedMesh) return;
      const si = mesh.geometry.attributes.skinIndex,
        sw = mesh.geometry.attributes.skinWeight,
        ids = [];
      for (let i = 0; i < si.count; i++) {
        let weight = 0;
        for (let k = 0; k < 4; k++)
          if (
            /Foot|Toe/.test(
              mesh.skeleton.bones[si.getComponent(i, k)]?.name || "",
            )
          )
            weight += sw.getComponent(i, k);
        if (weight > 0.25) ids.push(i);
      }
      if (ids.length) root.userData.groundSoles.push({ mesh, ids });
    });
  }
  root.userData.footBindings = new Map(
    ["L", "R"]
      .map((side) => {
        const foot = model.getObjectByName(
          side === "L" ? "Foot_L_092" : "Foot_R_098",
        );
        return [
          side,
          foot
            ? { foot, orientation: foot.getWorldQuaternion(new T.Quaternion()) }
            : null,
        ];
      })
      .filter(([, v]) => v),
  );
  return root;
}
const soleVertex = new T.Vector3();
export function sonicSoleHeight(u) {
  let lowest = Infinity;
  for (const { mesh, ids } of u.groundSoles || [])
    for (const i of ids) {
      soleVertex.fromBufferAttribute(mesh.geometry.attributes.position, i);
      mesh.applyBoneTransform(i, soleVertex).applyMatrix4(mesh.matrixWorld);
      lowest = Math.min(lowest, soleVertex.y);
    }
  return lowest;
}
export function updateImportedSonic(root, s, dt) {
  root.scale.setScalar(sonicLength(s, 1));
  const u = root.userData,
    p = s.avatar,
    speed = Math.hypot(p.vx, p.vz),
    gold = sonicSuper(s);
  root.position.set(p.x, p.y + 0.12, p.z);
  root.rotation.z = 0;
  root.rotation.x = 0;
  let facing = Number.isFinite(p.facingYaw)?p.facingYaw:p.yaw+Math.PI;
  if (!gold && !Number.isFinite(p.facingYaw) && speed>1) facing=Math.atan2(p.vx,p.vz);
  if (gold && s.lock) {
    const c = nearestTitanSurface(s, p).point;
    facing = Math.atan2(c.x - p.x, c.z - p.z);
  }
  if (s.action === "loop" && speed > 1) facing = Math.atan2(p.vx, p.vz);
  const turn = Math.atan2(
    Math.sin(facing - root.rotation.y),
    Math.cos(facing - root.rotation.y),
  );
  root.rotation.y += turn * (1 - Math.exp(-dt * 14));
  let name =
      gold && !p.onGround
        ? s.boosting
          ? "boost_flight"
          : "fly"
        : !p.onGround
          ? p.vy > 0
            ? "jump"
            : "fall"
          : s.boosting && speed > 1
            ? "boost_run"
            : speed > 25
              ? "run"
              : speed > 16
                ? "run"
                : speed > 1
                  ? "move"
                  : "idle",
    time = s.time;
  if (gold && !p.onGround && !s.boosting) {
    const right =
        p.vx * Math.cos(root.rotation.y) - p.vz * Math.sin(root.rotation.y),
      forward =
        p.vx * Math.sin(root.rotation.y) + p.vz * Math.cos(root.rotation.y);
    name =
      speed < 1
        ? p.vy > 2
          ? "flight_rise"
          : p.vy < -2
            ? "flight_fall"
            : "fly"
        : Math.abs(right) > Math.abs(forward) * 1.2
          ? right > 0
            ? "flight_right"
            : "flight_left"
          : "flight_forward";
  }
  if (!gold && s.stage === "traversal" && !armorAttached(s)) {
    if (!p.onGround) {
      name=(s.jumpAge ?? 99)<0.18 ? "jump_takeoff" : p.vy>-2 ? "jump_spin" : "jump_fall";
      time=name==="jump_takeoff" ? s.jumpAge : s.time;
    } else if((s.landingAge ?? 1)<0.2) {name="land";time=s.landingAge;}
  }
  if(!gold&&s.stage==='traversal'&&s.actionTime>0){
    const clips={hit:['attack_left','attack_right','combo_kick'][s.traversalKit?.combo||0],dodge:'dodge',homing:'homing_attack',stomp:'stomp_attack',spin:'jump_spin',slide:'traversal_slide',wall_run:'wall_run',parry:'parry'};
    if(clips[s.action]){name=clips[s.action];const clip=u.actions.get(name)?.getClip();time=['slide','spin','wall_run','parry'].includes(s.action)?s.time:(1-Math.max(0,s.actionTime)/(s.traversalKit?.actionDuration||0.4))*(clip?.duration||0.4);}
  }
  if (!gold && s.grassCyloop?.points.length > 1 && speed > 1)
    name = "cyloop_run";
  if (gold && !p.onGround && p.vy > 5 && p.y < 10) name = "jump";
  if (armorAttached(s)) {
    name = (s.climb.speed || 0) > 0.2 ? "wall_run" : "wall_idle";
    time = s.climb.travel * 0.12;
  } else if (s.qte) {
    name = s.qte.kind === "beam" ? "brace_beam" : "brace_grab";
    time = s.time;
  } else if (s.counterScene) {
    name = s.counterScene.kind === "crunch" ? "counter_grab" : "counter_break";
    time = s.counterScene.elapsed;
    const q = titanCounterContact(s);
    root.rotation.y = Math.atan2(q.point.x - p.x, q.point.z - p.z);
  } else if (s.stage === "finale") {
    name = s.stageTime < 1.9 ? "fly" : "boost_flight";
    time = s.stageTime;
    const v = titanPierceMotion(s);
    root.rotation.y = Math.atan2(v.x, v.z);
  } else if (s.stage === "transform") {
    name = "transform";
    time = s.stageTime;
    const gem = titanWorldPoint(s, { x: 0, y: 95, z: 0 });
    root.rotation.y = Math.atan2(gem.x - p.x, gem.z - p.z);
  } else if (s.stage === "defeat") {
    name = "defeat";
    time = s.stageTime;
  } else if (gold) {
    const map = {
      punch: [
        (s.strike?.hand || (s.comboStep % 2 ? "L" : "R")) === "L"
          ? "attack_left"
          : "attack_right",
        titanActionDuration(s),
      ],
      homing: ["homing_attack", 0.72],
      cross: ["cross_slash", 0.8],
      shot: ["homing_shot", 1.15],
      counter: ["grand_slam", 1.2],
      boom: ["sonic_boom", 1.1],
      rush: ["wild_rush", 0.8],
      loop: ["quick_cyloop", titanActionDuration(s)],
      stomp: ["stomp_attack", 1.05],
      spin: ["spin_slash", 1.05],
      cyclone: ["cyclone_kick", 1.3],
      dodge: ["dodge", 0.42],
      hurt: ["damage", 0.5],
    };
    if (s.parryHeld) {
      name = "parry";
      time = s.time;
    }
    if (map[s.action]) {
      const q = [...map[s.action]];
      if (s.action === "punch" && s.strike?.move === "heavy")
        q[0] = "combo_kick";
      if (s.action === "punch" && s.strike?.move === "combo")
        q[0] = s.strike.hand === "L" ? "combo_left" : "combo_right";
      if (s.action === "punch" && s.strike?.move === "finisher")
        q[0] = "combo_finisher";
      name = q[0];
      const duration = u.actions.get(name).getClip().duration;
      time = ((q[1] - s.actionTime) / q[1]) * duration;
    }
  }
  if(s.strike?.homing){
    const h=s.strike.homing;
    name=h.phase==='windup'&&h.parry&&h.age<0.12?'parry':'homing_attack';
    time=name==='parry'?h.age:h.phase==='recovery'?0.5+Math.min(1,h.recoveryAge/0.22)*0.22:h.phase==='windup'?h.age:0.24+(h.flightAge%0.18);
    if(h.phase==='flight'&&Number.isFinite(p.facingYaw))root.rotation.y=p.facingYaw;
  }
  if (
    [
      "idle",
      "move",
      "run",
      "boost_run",
      "jump",
      "fall",
      "jump_spin",
      "jump_fall",
      "fly",
      "boost_flight",
      "flight_forward",
      "flight_rise",
      "flight_fall",
      "flight_left",
      "flight_right",
      "cyloop_run",
      "wall_idle",
    ].includes(name)
  )
    time = titanLocomotionTime(u, name, s.time);
  else u.motionClock = null;
  const goldMix =
    s.stage === "transform"
      ? titanTransformation(s.stageTime).gold
      : gold
        ? 1
        : 0;
  if (u.super !== goldMix >= 0.999) {
    u.super = goldMix >= 0.999;
    for (const [m, blue] of u.blueMaterials)
      m.material = goldMix >= 0.999 ? u.superMaterial : blue;
  }
  for (const [, blue] of u.blueMaterials)
    for (const material of Array.isArray(blue) ? blue : [blue]) {
      if (!material.userData.titanGold) {
        const uniform = (material.userData.titanGold = { value: 0 }),
          previous = material.onBeforeCompile;
        material.onBeforeCompile = (shader) => {
          previous?.(shader);
          shader.uniforms.titanGold = uniform;
          shader.uniforms.titanGoldMap = { value: u.superMaterial.map };
          shader.fragmentShader =
            "uniform float titanGold;uniform sampler2D titanGoldMap;\n" +
            shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <map_fragment>",
            "#include <map_fragment>\n#ifdef USE_MAP\n diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(titanGoldMap,vMapUv).rgb,titanGold);\n#endif",
          );
        };
        material.needsUpdate = true;
      }
      material.userData.titanGold.value = goldMix;
    }
  actionAt(u, name, time, dt);
  const quills = u.actions.get("super_quills");
  if (gold) {
    if (!u.quillsPlaying) {
      quills.reset().play().setEffectiveTimeScale(0);
      u.quillsPlaying = true;
    }
  } else if (u.quillsPlaying) {
    u.quillsPlaying = false;
  }
  u.quillWeight =
    (u.quillWeight || 0) +
    (goldMix - (u.quillWeight || 0)) * (1 - Math.exp(-Math.max(0, dt) * 7));
  quills.setEffectiveWeight(0);
  updateSonicQuills(root,u.quillWeight);
  if (!gold && u.quillWeight < 0.001) quills.stop();
  blendRig(u, dt);
  for (const [bone, scale] of u.bindScales) bone.scale.copy(scale);
  u.currentClip = name;
  performTitanSonic(root, s, dt);
  if (
    s.stage === "traversal" &&
    p.onGround &&
    !armorAttached(s) &&
    u.groundSoles.length
  ) {
    root.updateMatrixWorld(true);
    const lowest = sonicSoleHeight(u);
    // Preserve natural airborne stride frames, correcting only actual shoe
    // penetration. The physical avatar and horizontal root never move here.
    u.groundOffset = Math.max(0, p.y + 0.02 - lowest);
    root.position.y += u.groundOffset;
  } else if (s.stage === "traversal" && !armorAttached(s)) {
    u.groundOffset = (u.groundOffset || 0) * Math.exp(-Math.max(0, dt) * 20);
    root.position.y += u.groundOffset;
  } else u.groundOffset = 0;
  if (armorAttached(s)) {
    const n = titanWorldVector(s, s.climb.normal),
      up = armorUp(s.climb),
      f = titanWorldVector(s, up),
      normal = new T.Vector3(n.x, n.y, n.z).normalize(),
      forward = new T.Vector3(f.x, f.y, f.z).normalize(),
      right = new T.Vector3().crossVectors(normal, forward).normalize(),
      matrix = new T.Matrix4().makeBasis(right, normal, forward),
      target = new T.Quaternion().setFromRotationMatrix(matrix);
    if (!u.wallOrientation)
      u.wallOrientation = u.viewInitialized
        ? root.quaternion.clone()
        : target.clone();
    u.wallOrientation.slerp(target, 1 - Math.exp(-dt * 18));
    root.quaternion.copy(u.wallOrientation);
    root.position.set(p.x + n.x * 0.12, p.y + n.y * 0.12, p.z + n.z * 0.12);
    u.onWall = true;
    u.wallExit = null;
  } else {
    if (u.onWall) {
      u.wallExit = { from: u.wallOrientation.clone(), age: 0 };
      u.onWall = false;
      u.wallOrientation = null;
    }
    if (u.wallExit) {
      u.wallExit.age += Math.max(0, dt);
      const t = Math.min(1, u.wallExit.age / 0.18),
        target = root.quaternion.clone();
      root.quaternion.copy(u.wallExit.from).slerp(target, t * t * (3 - 2 * t));
      if (t >= 1) u.wallExit = null;
    }
  }
  u.viewInitialized = true;
}
export function updateImportedGiganto(root, s, dt) {
  root.position.x = s.boss?.x || 0;
  root.position.z = s.boss?.z || 0;
  root.rotation.y = titanPose(s).yaw || 0;
  const u = root.userData,
    scale = { easy: 1.25, normal: 1, hard: 0.85 }[s.config.difficulty];
  let name = "idle",
    time = s.time;
  if (u.lastAttack !== "idle" && s.attack === "idle") {
    root.updateMatrixWorld(true);
    u.recovery = {
      attack: u.lastAttack,
      side: u.lastSide,
      start: s.time,
      hands: Object.fromEntries(
        ["L", "R"].map((side) => [
          side,
          u.bones["hand" + side].getWorldPosition(new T.Vector3()),
        ]),
      ),
    };
  }
  if (s.attack !== "idle") u.lastSide = titanAttackSide(s);
  u.lastAttack = s.attack;
  if (armorMode(s) && ["intro", "traversal"].includes(s.stage)) {
    name = "climb_motion";
    time = s.time;
  } else if (s.stage === "phase") {
    name = "awakening";
    time = s.stageTime;
  } else if (["finale", "victory"].includes(s.stage)) {
    name =
      s.stage === "finale" && s.stageTime < TITAN_FINALE.contact
        ? "finale_brace"
        : "finale_collapse";
    time =
      s.stage === "victory"
        ? 7 - TITAN_FINALE.contact
        : s.stageTime < TITAN_FINALE.contact
          ? s.stageTime
          : s.stageTime - TITAN_FINALE.contact;
  } else if (s.counterScene) {
    name = "counter_recoil";
    time = s.counterScene.elapsed;
  } else if (s.stage === "victory") {
    name = "defeat";
    time = 6;
  } else if (s.stagger > 0) {
    name = "stagger";
    time = s.time;
  } else if (s.stage === "combat" && s.boss?.walk) {
    name = "move";
    time = titanStepProgress(s) * u.actions.get(name).getClip().duration;
  } else if (s.stage === "combat" && s.attack !== "idle") {
    const m = TITAN_MOVES[s.attack],
      tell = m.tell * scale,
      t = s.attackTime;
    if (s.attack === "spin") {
      name = "rotating_sweep";
      time = t < tell ? t / scale : 2.1 + t - tell;
    } else if (s.attack === "uppercut") {
      name = "uppercut_" + titanAttackSide(s);
      time = t < tell ? t / scale : 1.8 + t - tell;
    } else if (s.attack === "sweep") {
      name = "double_sweep";
      time = t < tell ? t / scale : TITAN_SWEEP.windup + t - tell;
    } else if (s.attack === "pulse") {
      name = "phase_transition";
      time = Math.min(3.99, (t / tell) * 2.5);
    } else if (s.attack === "beam") {
      name = s.qte ? "beam_fire" : "beam_charge";
      time = s.qte ? 4.5 - s.qte.left : t / scale;
    } else if (s.attack === "stomp") {
      name = "stomp_" + (s.swatSide || "L");
      time = t;
    } else if (s.attack === "crunch") {
      name = t < tell ? "grab_windup" : "grab";
      time = t < tell ? t / scale : s.qte ? 4.2 - s.qte.left : t - tell;
    } else {
      const base = titanAttackSide(s) === "L" ? "arm_swing" : "arm_slap";
      name = t < tell ? base + "_windup" : base;
      time =
        t < tell
          ? t / scale
          : ((t - tell) / m.strike) * u.actions.get(name).getClip().duration;
    }
  } else if (s.stage === "combat" && u.recovery) {
    const q = u.recovery,
      base =
        q.attack === "swing" || (q.attack === "swat" && q.side === "L")
          ? "arm_swing"
          : ["slap", "swat"].includes(q.attack)
            ? "arm_slap"
            : q.attack === "crunch"
              ? "grab"
              : null;
    time = s.time - q.start;
    if (base && time < u.actions.get(base + "_recovery").getClip().duration)
      name = base + "_recovery";
  }
  actionAt(u, name, time, dt);
  const dorsal =
      s.phase === 2 && s.stage !== "phase" ? "dorsal_pulse" : "dorsal_extend",
    dorsalTime =
      s.phase === 2 ? (s.stage === "phase" ? s.stageTime : s.time) : 0;
  actionAt(u, dorsal, dorsalTime, dt, "dorsal");
  if (name === "climb_motion") sampleTitanArmorPose(u, time);
  else blendRig(u, dt);
  if (s.boss?.walk && s.stage !== "finale")
    u.bones.hip.quaternion.copy(u.hipRest);
  u.currentClip = name;
  const defeat = ["finale", "victory"].includes(s.stage)
    ? titanDefeatPose(s.stage === "victory" ? 7 : s.stageTime)
    : null;
  root.position.y =
    titanBodyHeight(titanPose(s)) + (defeat?.lift || 0);
  root.rotation.x = defeat ? defeat.tilt - defeat.recoil : 0;
  // A brief recoil never replaces attack telegraphs or freezes the controller.
  if (
    s.hitFeedback?.until > s.time &&
    s.stage === "combat" &&
    s.attack === "idle" &&
    !s.boss?.walk
  ) {
    const w = Math.sin(((s.hitFeedback.until - s.time) / 0.3) * Math.PI);
    root.rotation.x =
      -0.006 * Math.min(2, (s.hitFeedback.amount || 0) / 450) * w;
  }
  performTitanBoss(root, s);
}
export function disposeImportedRig(root) {
  if (!root?.userData.imported) return;
  const u = root.userData;
  disposeSonicQuills(root);
  u.mixer.stopAllAction();
  u.mixer.uncacheRoot(u.model);
  // Alternate form materials may no longer be attached when a fight ends.
  // Shared maps/geometry stay in the bounded asset cache; skeleton textures
  // and unused per-encounter material instances must still be released.
  const attached = new Set(),
    skeletons = new Set();
  root.traverse((o) => {
    if (o.isMesh)
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        attached.add(m);
    if (o.isSkinnedMesh) skeletons.add(o.skeleton);
  });
  for (const m of u.materials) if (!attached.has(m)) m.dispose();
  for (const skeleton of skeletons) skeleton.dispose();
}
