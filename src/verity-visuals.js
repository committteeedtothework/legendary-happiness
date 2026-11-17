import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { assetArrayBuffer } from "./asset-source.js";
import { VERITY_GLB } from "./verity-model-data.js";
import { VERITY, danceLocked } from "./verity-simulation.js";

let prepared;
export function prepareVerityModel() {
  return (prepared ||= assetArrayBuffer(VERITY_GLB).then((b) =>
    new GLTFLoader().parseAsync(b, ""),
  ));
}
export function poseVerityDancer(model, d, dt = 1 / 60) {
  if (!d || !model) return;
  const u = model.userData;
  if (!u.rig || !u.arms || !u.legs) return;
  const t = d.time || 0,
    beat = t / VERITY.beat,
    a =
      d.phase === "dance"
        ? Math.min(1, t * 4)
        : d.phase === "bow"
          ? Math.max(0, 1 - (t - VERITY.beat * VERITY.beats) * 2)
          : 0;
  const sway = Math.sin(beat * Math.PI),
    clap = beat % 8 > 6 ? Math.sin((beat % 1) * Math.PI) : 0;
  u.rig.position.set(0, 0.023 * Math.sin(beat * Math.PI * 2) * a, 0);
  u.rig.rotation.set(
    d.phase === "bow"
      ? 0.22 *
          Math.sin(Math.min(1, (t - VERITY.beat * VERITY.beats) / 2) * Math.PI)
      : 0,
    0,
    sway * 0.075 * a,
  );
  u.body?.rotation.set(0, 0, 0);
  u.head?.rotation.set(-0.035, 0, -sway * 0.06 * a);
  u.arms.forEach((arm, i) => {
    const s = i ? 1 : -1;
    const shoulder = arm.position.clone(),
      hip = new T.Vector3(s * 0.25, 1.0, -0.08),
      front = new T.Vector3(s * (0.15 - 0.105 * clap), 1.25, -0.32);
    const target = hip.lerp(
      front,
      beat % 8 > 6 ? Math.min(1, ((beat % 8) - 6) * 4) : 0,
    );
    const axis = target.clone().sub(shoulder),
      distance = Math.max(0.05, Math.min(0.674, axis.length()));
    axis.normalize();
    const along =
        (0.3 * 0.3 - 0.375 * 0.375 + distance * distance) / (2 * distance),
      outward = new T.Vector3(s, 0, 0);
    outward.addScaledVector(axis, -axis.dot(outward)).normalize();
    const elbow = shoulder
      .clone()
      .addScaledVector(axis, along)
      .addScaledVector(outward, Math.sqrt(Math.max(0, 0.09 - along * along)));
    const down = new T.Vector3(0, -1, 0),
      upper = new T.Quaternion().setFromUnitVectors(
        down,
        elbow.clone().sub(shoulder).normalize(),
      );
    arm.quaternion.identity().slerp(upper, a);
    if (u.forearms?.[i]) {
      const lower = new T.Quaternion().setFromUnitVectors(
        down,
        target.sub(elbow).normalize(),
      );
      u.forearms[i].quaternion
        .identity()
        .slerp(upper.clone().invert().multiply(lower), a);
    }
  });
  u.legs.forEach((leg, i) => {
    const kick = Math.max(0, Math.sin((beat + i) * Math.PI));
    leg.rotation.set(-0.48 * kick * a, 0, (i ? 1 : -1) * 0.04 * a);
  });
  for (const grip of [u.grip, u.leftGrip]) if (grip) grip.visible = false;
  u.verityPose = true;
}
export function clearVerityDancer(model) {
  const u = model?.userData;
  if (!u?.verityPose) return;
  u.rig.rotation.set(0, 0, 0);
  u.rig.position.set(0, 0, 0);
  for (const q of [...u.arms, ...u.legs, ...(u.forearms || [])])
    q.rotation.set(0, 0, 0);
  for (const grip of [u.grip, u.leftGrip]) if (grip) grip.visible = true;
  u.verityPose = false;
}

export class VerityVisuals {
  constructor(renderer) {
    this.r = renderer;
    this.root = new T.Group();
    this.root.name = "Lord Verity encounter";
    renderer.scene.add(this.root);
    this.token = 0;
    this.blend = 0;
  }
  async load() {
    if (this.loading || this.model || this.error) return;
    this.loading = true;
    const token = this.token;
    try {
      const asset = await prepareVerityModel();
      if (token !== this.token) return;
      this.model = clone(asset.scene);
      this.model.name = "Lord Verity";
      this.root.add(this.model);
      this.model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = !!this.r.settings.entityShadows;
          o.receiveShadow = true;
          o.frustumCulled = false;
        }
      });
      this.mixer = new T.AnimationMixer(this.model);
      this.actions = new Map(
        asset.animations.map((c) => [c.name, this.mixer.clipAction(c)]),
      );
      this.light = new T.PointLight(0xffd87a, 0.6, 8);
      this.light.position.y = 2;
      this.root.add(this.light);
      const geom = new T.TorusGeometry(0.9, 0.012, 5, 72),
        mat = new T.MeshBasicMaterial({
          color: 0xffd966,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
        });
      this.ring = new T.Mesh(geom, mat);
      this.ring.rotation.x = -Math.PI / 2;
      this.ring.position.y = 0.04;
      this.root.add(this.ring);
    } catch (e) {
      this.error = e.message;
      this.r.root?.dispatchEvent?.(new CustomEvent("verity-model-error"));
    } finally {
      this.loading = false;
    }
  }
  sync(game, dt) {
    const record =
      game.active && game.dimension === "overworld" && !game.giganto?.active
        ? game.world.settlements?.["lord-verity"]?.active
        : null;
    this.record = record || null;
    this.root.visible = !!record;
    if (record) {
      if (this.lastAge !== record.age) {
        this.lastAge = record.age;
        this.visualAge = record.age;
      } else
        this.visualAge = Math.min(
          record.age + 0.28,
          (this.visualAge || record.age) + (dt || 0),
        );
    }
    if (!record) {
      this.clip = null;
      return;
    }
    this.load();
    this.root.position.set(record.x, record.y, record.z);
    this.root.rotation.y = record.yaw || 0;
    if (!this.model) return;
    const shadows =
      !!this.r.settings.shadows && !!this.r.settings.entityShadows;
    if (this.shadows !== shadows) {
      this.shadows = shadows;
      this.model.traverse((o) => {
        if (o.isMesh) o.castShadow = shadows;
      });
    }
    if (this.light) this.light.visible = (this.r.settings.graphics ?? 1) > 0;
    const clip =
      record.phase === "dance"
        ? "VerityDance"
        : record.phase === "bow"
          ? "Bow"
          : "Idle";
    if (this.clip !== clip) {
      const next = this.actions.get(clip);
      if (next) {
        next.reset().play();
        if (this.action) next.crossFadeFrom(this.action, 0.22, false);
        this.action = next;
        this.clip = clip;
      }
    }
    if (this.action) {
      this.mixer.update(Math.min(0.1, dt || 0));
      const duration = this.action.getClip().duration;
      const t =
        clip === "VerityDance"
          ? Math.max(0, this.visualAge - VERITY.arrival)
          : clip === "Bow"
            ? Math.max(
                0,
                this.visualAge - VERITY.arrival - VERITY.beat * VERITY.beats,
              )
            : this.visualAge;
      this.action.time =
        clip === "Bow"
          ? Math.min(t, Math.max(0, duration - 0.001))
          : t % Math.max(0.01, duration);
      this.mixer.update(0);
    }
    const fade = Math.min(
      1,
      record.age / 0.65,
      Math.max(
        0,
        (VERITY.arrival +
          VERITY.beat * VERITY.beats +
          VERITY.departure -
          record.age) /
          0.75,
      ),
    );
    this.model.scale.setScalar(0.96 + 0.04 * fade);
    if (this.ring) {
      const s = 1 + Math.sin((record.age * Math.PI * 2) / VERITY.beat) * 0.07;
      this.ring.scale.setScalar(s);
      this.ring.material.opacity = 0.12 + 0.13 * fade;
    }
  }
  compose(game, dt) {
    const camera = this.r.camera,
      p = game.player,
      active =
        danceLocked(p) && !!this.record && game.active && !game.giganto?.active;
    const was = this.blend;
    this.blend = T.MathUtils.damp(
      this.blend,
      active ? 1 : 0,
      active ? 5 : 8,
      Math.min(0.1, dt || 0),
    );
    if (active) {
      const q = this.record,
        mid = new T.Vector3((p.x + q.x) / 2, p.y + 1.25, (p.z + q.z) / 2),
        dx = q.x - p.x,
        dz = q.z - p.z,
        len = Math.max(1, Math.hypot(dx, dz));
      const side = new T.Vector3(-dz / len, 0, dx / len),
        desired = mid
          .clone()
          .addScaledVector(side, 5.4)
          .add(new T.Vector3((-dx / len) * 3.3, 1.7, (-dz / len) * 3.3));
      const eye = new T.Vector3(p.x, p.y + 1.5, p.z),
        ray = desired.clone().sub(eye),
        distance = ray.length(),
        hit = game.world.raycast(eye, ray.clone().normalize(), distance);
      if (hit) {
        const h = new T.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
        desired
          .copy(eye)
          .addScaledVector(
            ray.normalize(),
            Math.max(0.9, eye.distanceTo(h) - 0.9),
          );
      }
      const targetRotation = new T.Quaternion();
      const m = new T.Matrix4().lookAt(desired, mid, camera.up);
      targetRotation.setFromRotationMatrix(m);
      camera.position.lerp(desired, this.blend);
      camera.quaternion.slerp(targetRotation, this.blend);
      camera.fov = T.MathUtils.lerp(camera.fov, 53, this.blend);
      camera.updateProjectionMatrix();
      this.lastPosition = camera.position.clone();
      this.lastRotation = camera.quaternion.clone();
      this.lastFov = camera.fov;
    } else if (was > 0.002 && this.lastPosition) {
      camera.position.lerp(this.lastPosition, this.blend);
      camera.quaternion.slerp(this.lastRotation, this.blend);
      camera.fov = T.MathUtils.lerp(camera.fov, this.lastFov, this.blend);
      camera.updateProjectionMatrix();
    }
    if (active)
      poseVerityDancer(
        this.r.playerModel,
        game.verity?.renderDance || p.verityDance,
        dt,
      );
    else clearVerityDancer(this.r.playerModel);
  }
  clear() {
    this.record = null;
    this.root.visible = false;
    this.blend = 0;
    this.mixer?.stopAllAction();
    this.action = null;
    this.clip = null;
    this.lastAge = undefined;
    this.visualAge = 0;
    clearVerityDancer(this.r.playerModel);
  }
}
