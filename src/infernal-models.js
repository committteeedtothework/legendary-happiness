import { attachNPCWeapon } from "./npc-weapon.js";
// Original Cinderworld silhouettes. All rigid details are batched by models.js;
// jaw, cloak, arms and pincers remain articulated instead of loose decorations.
export const INFERNAL_STYLES = [
  "emberling",
  "basalt_crawler",
  "cinderback",
  "cinder_wraith",
  "dread_knight",
  "soul_reaver",
  "magma_maw",
  "mad_titan",
];
export function buildInfernalModel(type, { g, head, box, limb, material }) {
  if (!INFERNAL_STYLES.includes(type)) return false;
  g.userData.infernalStyle = type;
  g.userData.arms = [];
  g.userData.cloak = [];
  const stone = material("#302d39", "basalt"),
    dark = material("#171c29", "basalt"),
    bone = material("#c3ae85", "bone");
  const rust = material("#84503c", "plate"),
    slate = material("#59516a", "plate");
  const flame = material(
    type === "soul_reaver"
      ? "#b6f4ee"
      : type === "cinder_wraith"
        ? "#ffc779"
        : "#ff9f4e",
    "fire",
  );
  flame.emissive.set(type === "soul_reaver" ? "#398d9b" : "#a64916");
  flame.emissiveIntensity = 0.85;
  const eye = material("#111621", "void");
  const arm = (x, y, z, w, h, d, mat = stone) => {
    const a = limb(w, h, d, x, y, z, mat);
    g.userData.arms.push(a);
    return a;
  };
  const horn = (parent, side, x, y, z, size = 0.5, mat = bone) => {
    box(parent, 0.13, size * 0.65, 0.15, side * x, y, z, mat).rotation.z =
      -side * 0.38;
    box(
      parent,
      0.1,
      size * 0.48,
      0.12,
      side * (x + 0.11),
      y + size * 0.43,
      z + 0.06,
      mat,
    ).rotation.z = -side * 0.68;
  };
  const glowingEyes = (width, y, z) => {
    for (const side of [-1, 1]) {
      box(head, 0.15, 0.055, 0.035, side * width, y, z, flame);
      box(
        head,
        0.19,
        0.05,
        0.05,
        side * width,
        y + 0.06,
        z + 0.01,
        dark,
      ).rotation.z = side * 0.17;
    }
  };
  if (type === "emberling") {
    // Coal imp: oversized brow, swept ears, smouldering belly and short legs.
    box(g, 0.45, 0.65, 0.37, 0, 0.96, 0, stone);
    box(g, 0.38, 0.3, 0.04, 0, 0.97, -0.21, flame);
    for (let i = 0; i < 3; i++)
      box(g, 0.045, 0.32, 0.045, -0.13 + i * 0.13, 0.98, -0.24, dark);
    head.position.set(0, 1.58, -0.13);
    box(head, 0.65, 0.52, 0.47, 0, 0, 0, stone);
    box(head, 0.48, 0.12, 0.12, 0, -0.15, -0.28, dark);
    glowingEyes(0.18, 0.06, -0.25);
    for (const side of [-1, 1]) {
      box(head, 0.28, 0.12, 0.17, side * 0.39, 0.08, 0.02, rust).rotation.z =
        side * 0.35;
      horn(head, side, 0.22, 0.34, 0.07, 0.38, slate);
      const a = arm(side * 0.34, 1.18, 0.02, 0.16, 0.57, 0.18, rust);
      box(a, 0.21, 0.16, 0.24, 0, -0.52, -0.04, stone);
      for (let i = 0; i < 2; i++)
        box(a, 0.04, 0.12, 0.06, -0.065 + i * 0.13, -0.62, -0.12, bone);
      g.userData.legs.push(limb(0.18, 0.48, 0.24, side * 0.17, 0.48, 0, stone));
      box(g, 0.15, 0.13, 0.23, side * 0.26, 0.69, 0.02, rust);
    }
    return true;
  }
  if (type === "basalt_crawler" || type === "cinderback") {
    const crawler = type === "basalt_crawler";
    // The crawler is a six-legged split carapace; the neutral cinderback keeps
    // a broad, armoured tortoise silhouette with a blunt face and four feet.
    box(
      g,
      crawler ? 0.61 : 0.86,
      0.29,
      crawler ? 1.06 : 1.14,
      0,
      0.41,
      0,
      stone,
    );
    head.position.set(0, 0.39, -0.65);
    box(head, crawler ? 0.4 : 0.5, 0.25, 0.39, 0, 0, 0, slate);
    for (const side of [-1, 1]) {
      box(head, 0.07, 0.045, 0.025, side * 0.12, 0.035, -0.21, flame);
      for (let i = 0; i < (crawler ? 3 : 2); i++) {
        const leg = limb(
          0.11,
          0.3,
          0.16,
          side * (crawler ? 0.36 : 0.43),
          0.3,
          -0.39 + i * (crawler ? 0.36 : 0.73),
          rust,
        );
        leg.rotation.z = side * 0.34;
        g.userData.legs.push(leg);
      }
      if (crawler) {
        const claw = arm(side * 0.29, 0.42, -0.58, 0.12, 0.25, 0.13, stone);
        box(claw, 0.16, 0.12, 0.34, 0, -0.14, -0.14, rust);
        box(claw, 0.07, 0.1, 0.21, -side * 0.09, -0.14, -0.3, bone);
        box(claw, 0.045, 0.08, 0.14, side * 0.07, -0.14, -0.32, flame);
      }
      for (let i = 0; i < 4; i++) {
        const plate = box(
          g,
          crawler ? 0.3 : 0.43,
          0.18,
          0.25,
          side * (crawler ? 0.18 : 0.23),
          0.63 + (i === 1 || i === 2 ? 0.05 : 0),
          -0.42 + i * 0.27,
          i % 2 ? slate : stone,
        );
        plate.rotation.z = side * 0.14;
      }
    }
    box(g, 0.045, 0.055, 0.95, 0, 0.73, 0, flame);
    if (crawler) {
      box(g, 0.16, 0.14, 0.36, 0, 0.47, 0.68, slate).rotation.x = -0.35;
      box(g, 0.12, 0.18, 0.18, 0, 0.6, 0.87, bone);
    } else {
      box(head, 0.37, 0.08, 0.06, 0, -0.1, -0.22, rust);
      box(g, 0.46, 0.1, 0.38, 0, 0.79, 0, slate);
    }
    return true;
  }
  if (type === "cinder_wraith" || type === "soul_reaver") {
    const reaver = type === "soul_reaver";
    // Distinct suspended silhouettes: ember mask/shrouded lantern vs a tall
    // turquoise soul prism, pointed hood and a three-part trailing mantle.
    const cloth = material(reaver ? "#233c49" : "#59363f", "shroud");
    box(g, reaver ? 0.43 : 0.48, 0.78, 0.32, 0, 1.2, 0, cloth);
    box(g, 0.16, 0.3, 0.08, 0, 1.24, -0.21, flame).rotation.z = Math.PI / 4;
    head.position.set(0, reaver ? 2.01 : 1.78, -0.03);
    box(head, 0.43, 0.47, 0.36, 0, 0, 0, eye);
    box(head, 0.58, 0.15, 0.48, 0, 0.29, 0.015, cloth);
    box(head, 0.32, 0.15, 0.35, 0, 0.42, 0.05, cloth);
    for (const side of [-1, 1]) {
      box(head, 0.12, 0.58, 0.45, side * 0.27, 0.03, 0.03, cloth).rotation.z =
        -side * 0.11;
      box(
        head,
        0.075,
        0.31,
        0.07,
        side * 0.12,
        -0.09,
        -0.21,
        reaver ? bone : flame,
      ).rotation.z = -side * 0.18;
      box(head, 0.075, 0.05, 0.04, side * 0.1, 0.07, -0.22, flame);
      const a = arm(
        side * 0.36,
        1.52,
        0,
        0.14,
        reaver ? 1.07 : 0.86,
        0.19,
        cloth,
      );
      box(a, 0.12, 0.2, 0.15, 0, reaver ? -1.12 : -0.91, -0.03, bone);
      for (let i = 0; i < 3; i++)
        box(
          a,
          0.027,
          0.24,
          0.04,
          -0.07 + i * 0.07,
          reaver ? -1.27 : -1.06,
          -0.055,
          reaver ? bone : flame,
        );
      const tail = new g.constructor();
      tail.position.set(side * 0.23, 0.96, 0.1);
      g.add(tail);
      box(tail, 0.25, 0.8, 0.28, 0, -0.38, 0.05, cloth);
      box(tail, 0.13, 0.2, 0.24, side * 0.055, -0.86, 0.07, cloth);
      g.userData.cloak.push(tail);
      box(g, 0.09, 0.5, 0.08, side * 0.29, 1.02, -0.17, rust);
    }
    const center = new g.constructor();
    center.position.set(0, 0.87, 0.16);
    g.add(center);
    box(center, 0.18, 0.72, 0.25, 0, -0.35, 0.11, cloth);
    g.userData.cloak.push(center);
    if (reaver) {
      for (let i = 0; i < 3; i++)
        for (const side of [-1, 1])
          box(
            g,
            0.22,
            0.045,
            0.05,
            side * 0.15,
            1.53 - i * 0.14,
            -0.19,
            bone,
          ).rotation.z = -side * 0.2;
      const lantern = new g.constructor();
      lantern.position.set(-0.09, -1.2, -0.05);
      g.userData.arms[0].add(lantern);
      box(lantern, 0.21, 0.23, 0.2, 0, -0.16, 0, stone);
      box(lantern, 0.09, 0.16, 0.215, 0, -0.16, 0, flame);
      box(lantern, 0.025, 0.16, 0.025, 0, 0, 0, rust);
    } else {
      box(g, 0.34, 0.15, 0.38, 0, 0.84, 0, rust);
      box(head, 0.15, 0.07, 0.04, 0, -0.17, -0.22, flame);
    }
    return true;
  }
  if (type === "magma_maw") {
    box(g, 0.92, 0.44, 1.25, 0, 0.64, 0.05, stone);
    box(g, 0.7, 0.2, 0.9, 0, 0.82, 0.08, rust);
    head.position.set(0, 0.67, -0.78);
    box(head, 0.83, 0.28, 0.6, 0, 0.15, 0, stone);
    box(head, 0.67, 0.14, 0.54, 0, -0.04, -0.04, dark);
    box(head, 0.53, 0.09, 0.1, 0, -0.05, -0.34, flame);
    glowingEyes(0.26, 0.23, -0.32);
    const jaw = new g.constructor();
    jaw.position.set(0, -0.12, 0.13);
    head.add(jaw);
    box(jaw, 0.78, 0.15, 0.68, 0, -0.02, -0.21, rust);
    g.userData.jaw = jaw;
    for (let i = 0; i < 5; i++) {
      box(head, 0.07, 0.12, 0.075, -0.28 + i * 0.14, -0.02, -0.31, bone);
      box(jaw, 0.07, 0.12, 0.075, -0.28 + i * 0.14, 0.08, -0.48, bone);
    }
    for (const side of [-1, 1]) {
      horn(head, side, 0.36, 0.29, 0.15, 0.39, slate);
      for (const z of [-0.42, 0.4])
        g.userData.legs.push(limb(0.23, 0.4, 0.3, side * 0.48, 0.4, z, rust));
      for (let i = 0; i < 4; i++)
        box(
          g,
          0.2,
          0.29,
          0.22,
          side * 0.24,
          1.0 + (i === 1 || i === 2 ? 0.06 : 0),
          -0.35 + i * 0.29,
          i % 2 ? slate : stone,
        ).rotation.z = -side * 0.28;
    }
    box(g, 0.05, 0.07, 1.0, 0, 1.1, 0.1, flame);
    return true;
  }
  if (type === "dread_knight") {
    // Asymmetrical armour, a furnace visor and a heavy chipped cleaver.
    box(g, 0.64, 0.9, 0.43, 0, 1.27, 0, stone);
    box(g, 0.73, 0.3, 0.13, 0, 1.45, -0.26, slate);
    box(g, 0.1, 0.36, 0.07, 0, 1.36, -0.35, flame);
    box(g, 0.64, 0.14, 0.48, 0, 0.8, 0, rust);
    head.position.set(0, 2.13, 0);
    box(head, 0.5, 0.54, 0.43, 0, 0, 0, stone);
    box(head, 0.56, 0.12, 0.49, 0, 0.12, 0, slate);
    box(head, 0.08, 0.34, 0.05, 0, -0.06, -0.25, rust);
    glowingEyes(0.14, 0.035, -0.25);
    box(head, 0.12, 0.3, 0.38, 0, 0.34, 0.03, rust);
    for (const side of [-1, 1]) {
      const a = arm(side * 0.43, 1.73, 0, 0.24, 1.03, 0.28, stone);
      box(a, side < 0 ? 0.43 : 0.32, 0.29, 0.48, 0, -0.03, 0, slate);
      box(a, 0.28, 0.3, 0.3, 0, -0.73, 0, rust);
      g.userData.legs.push(limb(0.26, 0.72, 0.32, side * 0.2, 0.72, 0, stone));
      box(g, 0.27, 0.38, 0.08, side * 0.2, 0.55, -0.22, slate);
      box(g, 0.14, 0.58, 0.1, side * 0.24, 0.72, 0.24, rust).rotation.z =
        side * 0.1;
    }
    horn(g, -1, 0.56, 2.0, 0.02, 0.33, bone);
    attachNPCWeapon(
      g.userData.arms[1],
      "hellfire_sword",
      [0, -0.85, -0.04],
      1.5,
    );
    box(g.userData.arms[0], 0.42, 0.48, 0.15, 0, -0.57, -0.25, stone);
    box(g.userData.arms[0], 0.07, 0.3, 0.04, 0, -0.57, -0.34, flame);
    return true;
  }
  // Mad Titan: a broken basalt crown, asymmetric shoulder fortifications,
  // exposed molten ribs, enormous gauntlets and a hinged, tusked jaw.
  box(g, 1.35, 1.45, 0.84, 0, 1.72, 0, stone);
  box(g, 1.02, 0.46, 0.63, 0, 0.96, 0.02, rust);
  head.position.set(0, 2.98, -0.18);
  box(head, 0.79, 0.62, 0.63, 0, 0, 0, stone);
  box(head, 0.69, 0.12, 0.72, 0, 0.24, 0.02, slate);
  glowingEyes(0.23, 0.09, -0.34);
  const jaw = new g.constructor();
  jaw.position.set(0, -0.15, 0.09);
  head.add(jaw);
  box(jaw, 0.65, 0.2, 0.55, 0, -0.1, -0.12, rust);
  box(jaw, 0.48, 0.09, 0.08, 0, -0.08, -0.43, flame);
  g.userData.jaw = jaw;
  for (const side of [-1, 1]) {
    horn(head, side, 0.42, 0.43, 0.07, side < 0 ? 0.8 : 0.57, bone);
    const a = arm(side * 0.94, 2.36, 0, 0.48, 1.58, 0.59, stone);
    box(a, 0.68, 0.48, 0.72, 0, -1.22, -0.03, slate);
    for (let i = 0; i < 3; i++)
      box(a, 0.1, 0.29, 0.14, -0.2 + i * 0.2, -1.57, -0.24, bone);
    g.userData.legs.push(limb(0.45, 0.91, 0.58, side * 0.39, 0.91, 0, stone));
    box(g, side < 0 ? 0.79 : 0.6, 0.37, 0.87, side * 0.88, 2.47, 0.03, slate);
    for (let i = 0; i < (side < 0 ? 3 : 2); i++)
      box(
        g,
        0.18,
        0.44,
        0.2,
        side * (0.63 + i * 0.22),
        2.73 - i * 0.07,
        0.05,
        bone,
      ).rotation.z = -side * 0.35;
    for (let i = 0; i < 4; i++) {
      box(
        g,
        0.4,
        0.07,
        0.08,
        side * 0.29,
        1.33 + i * 0.23,
        -0.48,
        rust,
      ).rotation.z = -side * 0.2;
      box(
        g,
        0.21,
        0.045,
        0.035,
        side * 0.24,
        1.37 + i * 0.23,
        -0.53,
        flame,
      ).rotation.z = -side * 0.2;
    }
    box(jaw, 0.12, 0.38, 0.13, side * 0.27, 0.07, -0.36, bone).rotation.z =
      -side * 0.14;
  }
  box(g, 0.13, 1.05, 0.09, 0, 1.72, -0.51, flame);
  for (let i = 0; i < 4; i++)
    box(g, 0.23, 0.27, 0.38, 0, 1.39 + i * 0.37, 0.51, bone);
  return true;
}

export function animateInfernalModel(model, e, time, dt, enabled, attack = 0) {
  const u = model.userData,
    type = u.infernalStyle;
  if (!type || !u.rig) return;
  const t = enabled ? time : 0,
    gait = enabled ? u.gait || 0 : 0,
    phase = u.stride || 0;
  u.rig.position.y = 0;
  u.rig.rotation.x = 0;
  if (type === "soul_reaver" || type === "cinder_wraith") {
    u.rig.position.y = enabled ? 0.06 + Math.sin(t * 1.8) * 0.045 : 0;
    u.cloak.forEach((tail, i) => {
      tail.rotation.x = 0.09 + Math.sin(t * 2.0 + i * 0.7) * 0.06 + gait * 0.22;
      tail.rotation.z = Math.sin(t * 1.5 + i) * 0.05;
    });
    u.arms.forEach((a, i) => {
      a.rotation.x =
        e.castTicks > 0 ? 1.75 : 0.18 + Math.sin(t * 1.7 + i) * 0.05;
      a.rotation.z = (i ? 1 : -1) * (e.castTicks > 0 ? 0.55 : 0.2);
      a.rotation.y = (i ? 1 : -1) * (e.castTicks > 0 ? 0.25 : 0);
    });
  } else if (type === "magma_maw") {
    const charge =
      e.castTicks > 0 || e.mawDashTicks > 0 || e.special === "charge";
    u.jaw.rotation.x =
      -0.04 -
      attack * 0.45 -
      (charge ? 0.16 : 0) -
      (enabled ? Math.sin(t * 1.9) * 0.025 : 0);
    u.rig.rotation.x = charge ? 0.12 : Math.sin(phase * 2) * gait * 0.035;
  } else if (type === "basalt_crawler") {
    u.legs.forEach((a, i) => {
      a.rotation.x =
        Math.sin(phase + (i % 3) * 2.1 + (i < 3 ? 0 : Math.PI)) * gait * 0.6;
      a.rotation.z =
        (i < 3 ? -1 : 1) * (0.34 + Math.cos(phase + i) * gait * 0.12);
    });
    u.arms.forEach((a, i) => {
      a.rotation.x = 0.35 + attack * 0.55;
      a.rotation.z = (i ? 1 : -1) * (0.2 + attack * 0.3);
    });
  } else if (type === "dread_knight") {
    u.arms.forEach((a, i) => {
      a.rotation.x = i === 1 ? 0.12 + attack * 1.8 : 0.38 + gait * 0.14;
      a.rotation.z = (i ? 1 : -1) * (0.07 + attack * 0.12);
    });
    u.rig.rotation.x = Math.sin(phase * 2) * gait * 0.025;
  } else if (type === "mad_titan") {
    const prepare = !!e.special && e.special !== "dash";
    u.jaw.rotation.x = -0.05 - attack * 0.22 - (prepare ? 0.2 : 0);
    u.arms.forEach((a, i) => {
      a.rotation.x = prepare
        ? 1.8
        : 0.1 + Math.sin(phase + i * Math.PI) * gait * 0.36 + attack * 1.25;
      a.rotation.z = (i ? 1 : -1) * (prepare ? 0.35 : 0.13);
    });
  } else if (type === "emberling") {
    u.rig.position.y = Math.abs(Math.sin(phase)) * gait * 0.055;
    u.arms.forEach((a, i) => {
      a.rotation.x =
        0.27 + Math.sin(phase + i * Math.PI) * gait * 0.7 + attack * 1.4;
      a.rotation.z = (i ? 1 : -1) * 0.16;
    });
  }
}
