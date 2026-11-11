import * as THREE from "three";
export function createBoatModel(scale = 1) {
  const root = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: "#b18a55" }),
    edge = new THREE.MeshLambertMaterial({ color: "#765231" });
  const box = (w, h, d, x, y, z, mat = wood, parent = root) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  box(1.2, 0.12, 1.55, 0, 0.02, 0, edge);
  box(0.12, 0.4, 1.6, -0.6, 0.22, 0);
  box(0.12, 0.4, 1.6, 0.6, 0.22, 0);
  box(1.2, 0.4, 0.12, 0, 0.22, -0.77);
  box(1.2, 0.4, 0.12, 0, 0.22, 0.77);
  box(1.1, 0.08, 0.24, 0, 0.25, 0);
  root.userData.oars = [];
  root.userData.legs = [];
  // Render a depth-only patch after opaque boat parts and before transparent
  // water. The hull interior stays dry without editing the water underneath it.
  const waterMask = new THREE.Mesh(
    new THREE.PlaneGeometry(1.08, 1.4),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      side: THREE.DoubleSide,
    }),
  );
  waterMask.rotation.x = -Math.PI / 2;
  waterMask.position.y = 0.3;
  waterMask.renderOrder = 1;
  root.add(waterMask);
  root.userData.waterMask = waterMask;
  for (const side of [-1, 1]) {
    const oar = new THREE.Group();
    oar.position.set(side * 0.65, 0.27, 0.05);
    oar.rotation.z = side * -0.5;
    root.add(oar);
    box(0.055, 0.7, 0.055, 0, -0.23, 0, edge, oar);
    box(0.18, 0.32, 0.045, 0, -0.58, 0, wood, oar);
    root.userData.oars.push(oar);
  }
  root.scale.setScalar(scale);
  return root;
}
export function buildFlierModel(entity, { g, head, box, material }) {
  if (!["ember_ray", "cinder_roc"].includes(entity.type)) return false;
  const roc = entity.type === "cinder_roc",
    body = material(roc ? "#4b3c48" : "#77394b"),
    trim = material("#c88149"),
    fire = material("#ffd883");
  box(g, roc ? 1.1 : 1.4, 0.65, 1.1, 0, 0.8, 0, body);
  head.position.set(0, 1.03, -0.64);
  box(head, 0.7, 0.5, 0.7, 0, 0, 0, body);
  for (const x of [-0.21, 0.21]) {
    box(head, 0.13, 0.09, 0.04, x, 0.08, -0.37, fire);
    box(head, 0.12, 0.45, 0.15, x * 1.5, 0.32, 0.1, trim);
  }
  box(head, 0.24, 0.19, 0.25, 0, -0.14, -0.46, trim);
  g.userData.wings = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(side * 0.5, 0.95, 0);
    g.add(wing);
    for (let i = 0; i < 4; i++)
      box(
        wing,
        0.4,
        0.12,
        roc ? 0.85 - i * 0.12 : 1.3 - i * 0.16,
        side * (0.15 + i * 0.31),
        -i * 0.04,
        i * 0.13,
        i % 2 ? trim : body,
      );
    g.userData.wings.push(wing);
  }
  for (let i = 0; i < 4; i++)
    box(
      g,
      0.2 - i * 0.03,
      0.15,
      0.35,
      0,
      0.75 - i * 0.07,
      0.65 + i * 0.28,
      i % 2 ? trim : body,
    );
  g.userData.flying = true;
  return true;
}
