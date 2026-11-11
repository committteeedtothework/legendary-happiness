import { MOB_INFO } from "./data.js";
export function buildAquaticModel(e, { g, head, box, limb, material }) {
  if (
    !MOB_INFO[e.type]?.aquatic &&
    !["drowned", "husk", "stray", "skeleton_horse"].includes(e.type)
  )
    return false;
  const c = material;
  const fish = ["cod", "salmon", "tropical_fish", "pufferfish"].includes(
    e.type,
  );
  if (fish) {
    const colors = {
      cod: ["#a79973", "#e0d2a8"],
      salmon: ["#af665f", "#c9c3a0"],
      tropical_fish: ["#e8a557", "#f6e9c3"],
      pufferfish: ["#d1be62", "#e5d8a0"],
    }[e.type];
    head.position.set(0, 0.18, -0.15);
    box(g, 0.24, 0.27, 0.51, 0, 0.18, 0, c(colors[0]));
    box(g, 0.21, 0.09, 0.46, 0, 0.08, -0.01, c(colors[1]));
    for (const side of [-1, 1]) {
      box(head, 0.014, 0.052, 0.052, side * 0.128, 0.03, -0.1, c("#202b37"));
      box(g, 0.18, 0.025, 0.18, side * 0.16, 0.16, 0.03, c(colors[1]));
    }
    box(g, 0.03, 0.14, 0.24, 0, 0.36, 0.05, c(colors[0]));
    const tail = new g.constructor();
    tail.position.set(0, 0.19, 0.29);
    g.add(tail);
    box(tail, 0.04, 0.25, 0.2, 0, 0, 0.05, c(colors[1]));
    g.userData.tail = tail;
    if (e.type === "tropical_fish")
      for (let z = -0.18; z < 0.2; z += 0.14)
        box(g, 0.247, 0.28, 0.045, 0, 0.18, z, c("#db7b43"));
    if (e.type === "pufferfish")
      for (let i = 0; i < 8; i++)
        box(
          g,
          0.035,
          0.035,
          0.035,
          Math.sin(i) * 0.16,
          0.18 + Math.cos(i) * 0.16,
          0,
          c("#91874c"),
        );
  } else if (e.type === "turtle") {
    const shell = c("#5b8d66"),
      edge = c("#95ae72"),
      skin = c("#9bba78");
    box(g, 1.02, 0.29, 1.1, 0, 0.24, 0.04, shell);
    box(g, 1.13, 0.11, 1.2, 0, 0.1, 0.04, edge);
    for (let x = -0.3; x <= 0.3; x += 0.3)
      for (let z = -0.3; z <= 0.3; z += 0.3)
        box(g, 0.26, 0.035, 0.26, x, 0.4, z, c("#72985e"));
    head.position.set(0, 0.22, -0.7);
    box(head, 0.35, 0.25, 0.36, 0, 0, 0, skin);
    for (const s of [-1, 1])
      box(head, 0.018, 0.055, 0.055, s * 0.18, 0.04, -0.1, c("#223d33"));
    for (const s of [-1, 1])
      for (const z of [-0.37, 0.42]) {
        const f = limb(0.35, 0.08, 0.24, s * 0.59, 0.12, z, skin);
        g.userData.legs.push(f);
      }
    if (e.baby) g.scale.setScalar(0.35);
  } else if (e.type === "dolphin") {
    const gray = c("#829da9"),
      light = c("#bed1ce");
    head.position.set(0, 0.29, -0.62);
    box(g, 0.47, 0.39, 1.08, 0, 0.28, 0, gray);
    box(g, 0.42, 0.1, 0.9, 0, 0.1, -0.02, light);
    box(head, 0.35, 0.3, 0.45, 0, 0, 0, gray);
    box(head, 0.22, 0.14, 0.33, 0, -0.08, -0.32, light);
    for (const s of [-1, 1]) {
      box(head, 0.02, 0.045, 0.06, s * 0.18, 0.04, -0.12, c("#273947"));
      const f = box(g, 0.36, 0.045, 0.28, s * 0.32, 0.2, -0.12, gray);
      f.rotation.z = s * 0.4;
    }
    box(g, 0.06, 0.25, 0.3, 0, 0.52, 0.05, gray);
    const tail = new g.constructor();
    tail.position.set(0, 0.25, 0.65);
    g.add(tail);
    box(tail, 0.68, 0.045, 0.27, 0, 0, 0.03, gray);
    g.userData.tail = tail;
  } else if (e.type === "squid") {
    head.position.set(0, 0.5, 0);
    box(head, 0.63, 0.63, 0.63, 0, 0, 0, c("#415c70"));
    for (const s of [-1, 1]) {
      box(head, 0.15, 0.15, 0.02, s * 0.18, -0.1, -0.326, c("#e8e1cd"));
      box(head, 0.07, 0.09, 0.024, s * 0.18, -0.1, -0.34, c("#26333e"));
    }
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const leg = limb(
        0.11,
        0.65,
        0.11,
        Math.sin(a) * 0.28,
        0.2,
        Math.cos(a) * 0.28,
        c("#55758a"),
      );
      leg.rotation.z = Math.sin(a) * 0.3;
      g.userData.legs.push(leg);
    }
  } else if (e.type === "skeleton_horse") {
    const bone = c("#d3d2b9");
    box(g, 0.62, 0.66, 1.5, 0, 1, 0, bone);
    head.position.set(0, 1.48, -0.7);
    box(head, 0.38, 0.54, 0.5, 0, 0, 0, bone);
    box(head, 0.32, 0.25, 0.35, 0, -0.14, -0.3, bone);
    for (const s of [-1, 1]) {
      box(head, 0.045, 0.13, 0.02, s * 0.13, 0.08, -0.26, c("#26343b"));
      for (const z of [-0.53, 0.53])
        g.userData.legs.push(limb(0.14, 0.7, 0.16, s * 0.28, 0.75, z, bone));
    }
  } else {
    const drowned = e.type === "drowned",
      stray = e.type === "stray",
      skin = c(drowned ? "#6b9d8c" : stray ? "#b6c9c7" : "#aa9771"),
      cloth = c(drowned ? "#486a68" : stray ? "#657e88" : "#9a8769");
    box(g, 0.5, 0.7, 0.28, 0, 1.05, 0, cloth);
    head.position.set(0, 1.65, 0);
    box(head, 0.5, 0.5, 0.48, 0, 0, 0, skin);
    for (const s of [-1, 1]) {
      box(
        head,
        0.1,
        0.07,
        0.025,
        s * 0.12,
        0.02,
        -0.25,
        c(drowned ? "#b4e9d6" : "#2f3a3b"),
      );
      g.userData.legs.push(limb(0.2, 0.7, 0.23, s * 0.15, 0.7, 0, cloth));
    }
    g.userData.arms = [
      limb(0.19, 0.7, 0.22, -0.36, 1.4, 0, skin),
      limb(0.19, 0.7, 0.22, 0.36, 1.4, 0, skin),
    ];
    if (drowned)
      for (const s of [-1, 1])
        box(g, 0.06, 0.3, 0.03, s * 0.19, 1, -0.16, c("#6e8b59"));
  }
  g.userData.aquaticStyle = e.type;
  return true;
}
