import * as THREE from "three";
import { MOB_INFO } from "./data.js";
import { farmScale } from "./livestock-data.js";
import { particleCount } from "./graphics.js";

// Original stepped star silhouette, shared by every crit particle. No textures
// or per-hit geometry allocation; each material can fade independently.
let star;
const fadedStar = new THREE.Color("#79553b");
function criticalGeometry() {
  if (!star) {
    const shape = new THREE.Shape();
    const points = [
      [0, 1],
      [0.24, 0.3],
      [0.65, 0.3],
      [0.3, 0],
      [0.65, -0.3],
      [0.24, -0.3],
      [0, -1],
      [-0.24, -0.3],
      [-0.65, -0.3],
      [-0.3, 0],
      [-0.65, 0.3],
      [-0.24, 0.3],
    ];
    shape.moveTo(...points[0]);
    for (const point of points.slice(1)) shape.lineTo(...point);
    shape.closePath();
    star = new THREE.ShapeGeometry(shape);
    star.userData.shared = true;
  }
  return star;
}

export function addCriticalImpact(renderer, entity, source) {
  const count = Math.min(
    particleCount(renderer.settings, 16),
    Math.max(0, 180 - renderer.effects.length),
  );
  if (!count) return;
  const scale = farmScale(entity),
    height = (MOB_INFO[entity.type]?.height || 1.8) * scale;
  const width = (MOB_INFO[entity.type]?.width || 0.6) * scale;
  const dx = (source?.x ?? renderer.camera.position.x) - entity.x;
  const dz = (source?.z ?? renderer.camera.position.z) - entity.z;
  const distance = Math.hypot(dx, dz) || 1;
  const center = new THREE.Vector3(
    entity.x + (dx / distance) * width * 0.48,
    entity.y +
      Math.max(
        height * 0.2,
        Math.min(height * 0.82, (source?.y ?? entity.y) + 1.25 - entity.y),
      ),
    entity.z + (dz / distance) * width * 0.48,
  );
  // Animal bodies may extend beyond their collision radius and rotate. Emit
  // outside the visible bounds, so stars are never buried inside a flank.
  const model = renderer.mobMeshes?.get(entity.id);
  if (model) {
    model.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(model);
    bounds.translate(
      new THREE.Vector3(
        entity.x - model.position.x,
        entity.y - model.position.y,
        entity.z - model.position.z,
      ),
    );
    const origin = new THREE.Vector3(
      source?.x ?? renderer.camera.position.x,
      source ? source.y + 1.25 : renderer.camera.position.y,
      source?.z ?? renderer.camera.position.z,
    );
    const ray = new THREE.Ray(origin, center.clone().sub(origin).normalize());
    if (!bounds.containsPoint(origin)) ray.intersectBox(bounds, center);
  }
  const outward = new THREE.Vector3(dx / distance, 0, dz / distance);
  center.addScaledVector(outward, 0.12);
  const tangent = new THREE.Vector3(outward.z, 0, -outward.x);
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(
      criticalGeometry(),
      new THREE.MeshBasicMaterial({
        color: i % 3 ? "#d9b88c" : "#fff0cb",
        transparent: true,
        opacity: 1,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    const a = (i / count) * Math.PI * 2,
      speed = 0.9 + Math.random() * 1.2;
    m.quaternion.copy(renderer.camera.quaternion);
    m.scale.setScalar(0.045 + Math.random() * 0.035);
    m.position.copy(center).addScaledVector(tangent, Math.cos(a) * 0.1);
    m.position.y += Math.sin(a) * 0.13;
    renderer.scene.add(m);
    renderer.effects.push({
      m,
      v: tangent
        .clone()
        .multiplyScalar(Math.cos(a) * speed)
        .addScaledVector(outward, 0.65 + Math.random() * 0.4)
        .add(new THREE.Vector3(0, 0.5 + Math.sin(a) * speed, 0)),
      life: 0.42,
      duration: 0.42,
      critical: true,
    });
  }
}

export function updateCriticalParticle(effect, camera, dt) {
  const progress = Math.max(0, effect.life / effect.duration);
  effect.m.quaternion.copy(camera.quaternion);
  effect.m.material.opacity = Math.min(1, progress * 2);
  effect.m.material.color.lerp(fadedStar, Math.min(1, dt * 5));
  effect.m.scale.multiplyScalar(Math.exp(-dt * 1.4));
}
