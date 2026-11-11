// An original non-combat cave apparition: pale, elongated, with empty black eyes.
export function buildWatcherModel(type, { g, head, box, limb, material }) {
  if (type !== "watcher") return false;
  const skin = material("#e3e0d5"),
    shadow = material("#797877"),
    black = material("#08090b");
  box(g, 0.32, 1.15, 0.22, 0, 1.86, 0, skin);
  box(g, 0.5, 0.17, 0.28, 0, 2.35, 0, skin);
  box(g, 0.21, 0.24, 0.18, 0, 2.58, 0, skin);
  head.position.set(0, 2.98, -0.04);
  box(head, 0.5, 0.63, 0.37, 0, 0, 0, skin);
  for (const side of [-1, 1]) {
    box(head, 0.13, 0.16, 0.035, side * 0.12, 0.04, -0.2, black);
    box(head, 0.19, 0.04, 0.035, side * 0.12, -0.07, -0.205, shadow);
    const arm = limb(0.13, 1.93, 0.15, side * 0.32, 2.38, 0, skin);
    arm.rotation.z = side * 0.1;
    g.userData.arms ||= [];
    g.userData.arms.push(arm);
    for (let i = 0; i < 3; i++)
      box(arm, 0.025, 0.32, 0.03, -0.05 + i * 0.05, -2.02, -0.04, skin);
    const leg = limb(0.15, 1.3, 0.16, side * 0.13, 1.3, 0, skin);
    g.userData.legs.push(leg);
  }
  box(head, 0.17, 0.035, 0.025, 0, -0.21, -0.2, black);
  return true;
}
