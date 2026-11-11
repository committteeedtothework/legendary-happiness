export const COLD_STYLES = {
  snow_leopard: "Frost rosette cat",
  polar_bear: "Ivory ice bear",
};
export function buildColdWildlife(entity, { g, head, box, limb, material }) {
  if (!COLD_STYLES[entity.type]) return false;
  const bear = entity.type === "polar_bear";
  const fur = material(bear ? "#e4e7da" : "#d0d9da", "storybook");
  const light = material("#f5f1df", "storybook"),
    dark = material(bear ? "#333b42" : "#637482", "storybook");
  const ink = material("#25313b", "storybook");
  const w = bear ? 0.96 : 0.63,
    len = bear ? 1.46 : 1.27,
    legH = bear ? 0.47 : 0.39;
  box(g, w, bear ? 0.68 : 0.43, len, 0, legH + (bear ? 0.35 : 0.22), 0, fur);
  box(
    g,
    w * 0.87,
    0.15,
    len * 0.8,
    0,
    legH + (bear ? 0.73 : 0.49),
    -0.08,
    light,
  );
  box(g, w * 0.8, 0.12, len * 0.74, 0, legH + 0.04, 0, light);
  head.position.set(0, legH + (bear ? 0.57 : 0.3), -len / 2 - 0.2);
  box(head, bear ? 0.55 : 0.43, bear ? 0.48 : 0.35, 0.43, 0, 0, 0, fur);
  box(head, bear ? 0.38 : 0.3, 0.16, 0.18, 0, -0.13, -0.27, light);
  box(head, bear ? 0.16 : 0.1, 0.08, 0.035, 0, -0.08, -0.37, ink);
  for (const side of [-1, 1]) {
    box(
      head,
      0.12,
      0.15,
      0.12,
      side * (bear ? 0.22 : 0.17),
      bear ? 0.27 : 0.2,
      0.02,
      fur,
    );
    box(
      head,
      0.07,
      0.06,
      0.018,
      side * (bear ? 0.22 : 0.17),
      bear ? 0.28 : 0.21,
      -0.05,
      dark,
    );
    box(
      head,
      0.052,
      0.055,
      0.022,
      side * (bear ? 0.17 : 0.14),
      0.035,
      -0.226,
      ink,
    );
    box(
      head,
      0.025,
      0.018,
      0.026,
      side * (bear ? 0.17 : 0.14) - 0.008,
      0.05,
      -0.24,
      light,
    );
    for (const z of [-len * 0.32, len * 0.32]) {
      const leg = limb(
        bear ? 0.27 : 0.17,
        legH,
        bear ? 0.3 : 0.23,
        side * w * 0.33,
        legH,
        z,
        fur,
      );
      box(
        leg,
        bear ? 0.3 : 0.2,
        0.12,
        bear ? 0.36 : 0.28,
        0,
        -legH + 0.06,
        -0.035,
        light,
      );
      g.userData.legs.push(leg);
    }
  }
  const tail = new g.constructor();
  tail.position.set(0, legH + 0.28, len / 2);
  g.add(tail);
  g.userData.tail = tail;
  if (bear) box(tail, 0.18, 0.17, 0.2, 0, 0.03, 0.06, fur);
  else {
    g.userData.tailSegments = [];
    let parent = tail;
    for (let i = 0; i < 3; i++) {
      const joint = new g.constructor();
      joint.position.set(0, i ? -0.04 : 0, i ? 0.27 : 0);
      box(
        joint,
        0.13 - i * 0.012,
        0.13 - i * 0.012,
        0.3,
        0,
        0,
        0.13,
        i === 2 ? dark : fur,
      );
      parent.add(joint);
      g.userData.tailSegments.push(joint);
      parent = joint;
    }
    // Sparse squared rosettes are original geometry, not a borrowed skin.
    for (const side of [-1, 1])
      for (let i = 0; i < 6; i++) {
        const z = -0.45 + (i % 3) * 0.34,
          y = legH + 0.12 + Math.floor(i / 3) * 0.2;
        box(g, 0.012, 0.09, 0.12, side * (w / 2 + 0.008), y, z, dark);
        box(g, 0.016, 0.035, 0.055, side * (w / 2 + 0.016), y, z, fur);
      }
    for (const side of [-1, 1])
      box(head, 0.07, 0.07, 0.015, side * 0.15, -0.07, -0.23, dark);
  }
  g.userData.overworldStyle = COLD_STYLES[entity.type];
  return true;
}
