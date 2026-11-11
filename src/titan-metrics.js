// Simulation, rig contacts and saved coordinates share canonical arena units.
// The arena's render boundary maps them to metres; Sonic keeps his body size.
export function arenaUnitScale(s) {
  return s?.config?.colossalScale === true
    ? Math.max(1, Math.min(3.2, s.config.titanScale ?? 2.8))
    : 1;
}
export const sonicLength = (s, metres) => metres / arenaUnitScale(s);
export function arenaMetres(s, p) {
  const k = arenaUnitScale(s);
  return { x: p.x * k, y: p.y * k, z: p.z * k };
}
export function arenaUnits(s, p) {
  const k = arenaUnitScale(s);
  return { x: p.x / k, y: p.y / k, z: p.z / k };
}
export function sonicContact(s, p = s.avatar) {
  return { x: p.x, y: p.y + sonicLength(s, 1.8), z: p.z };
}
// Apply the same unit conversion to world geometry, effects, collision locations
// and camera only during rendering, and restore canonical rig space afterward.
export function withArenaMetres(scene, camera, light, s, render) {
  const k = arenaUnitScale(s),
    fog = scene.fog?.density,
    near = camera.near,
    far = camera.far;
  const pointLights = [];
  scene.traverse((o) => {
    if (o.isPointLight) {
      pointLights.push([o, o.distance, o.intensity]);
      o.distance *= k;
    }
  });
  const shadow = light.shadow.camera,
    keys = ["left", "right", "top", "bottom", "near", "far"],
    original = keys.map((n) => shadow[n]);
  try {
    scene.scale.setScalar(k);
    camera.position.multiplyScalar(k);
    camera.near = near * k;
    camera.far = far * k;
    for (const n of keys) shadow[n] *= k;
    shadow.updateProjectionMatrix();
    if (scene.fog) scene.fog.density = fog / k;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    scene.updateMatrixWorld(true);
    return render();
  } finally {
    scene.scale.setScalar(1);
    camera.position.multiplyScalar(1 / k);
    camera.near = near;
    camera.far = far;
    keys.forEach((n, i) => (shadow[n] = original[i]));
    shadow.updateProjectionMatrix();
    for (const [o, d, i] of pointLights) {
      o.distance = d;
      o.intensity = i;
    }
    if (scene.fog) scene.fog.density = fog;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    scene.updateMatrixWorld(true);
  }
}

export function titanEmeraldPoint(s, point) {
  return s.config.climbMode === "armor"
    ? { ...point, y: 89 + sonicLength(s, 9.6) }
    : point;
}
