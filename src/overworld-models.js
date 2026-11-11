import { attachNPCWeapon } from "./npc-weapon.js";
import { COLD_STYLES } from "./cold-wildlife-models.js";
import { VILLAGE_STYLES } from "./village-styles.js";
// Original storybook voxel silhouettes. Negative Z is forward for every rig.
export const OVERWORLD_STYLES = {
  ...COLD_STYLES,
  grazer: "Rosy barrel pig",
  woolling: "Cloud-fleece sheep",
  cow: "Patchwork meadow cow",
  chicken: "Fan-tail hen",
  rabbit: "Button-nosed hopper",
  panda: "Bamboo bear",
  koala: "Velvet-eared koala",
  tiger: "Amber stripe cat",
  villager: "Patchwork townsfolk",
  iron_golem: "Garden sentinel",
  zombie: "Mosscoat wanderer",
  creeper: "Carved moss creeper",
  skeleton: "Ivory bow scout",
  spider: "Amethyst garden spider",
  devin_guardian: "Gilded temple sentinel",
  watcher: "Pale paper apparition",
  shade: "Dusk wanderer",
  stalker: "Briar wanderer",
};
export function buildOverworldModel(entity, { g, head, box, limb, material }) {
  const type = entity.type;
  if (!OVERWORLD_STYLES[type]) return false;
  const mat = (color) => material(color, "storybook");
  const ink = mat("#292d35"),
    cream = mat("#eee5cc");
  g.userData.overworldStyle = OVERWORLD_STYLES[type];
  const part = (p, s, at, m) => box(p, ...s, ...at, m);
  const eye = (x, y, z, color = ink, sz = 0.055) =>
    part(head, [sz, sz, 0.02], [x, y, z], color);
  const joint = (parent, at) => {
    const j = new g.constructor();
    j.position.set(...at);
    parent.add(j);
    return j;
  };
  const foot = (x, z, h, skin, toe = skin, w = 0.17, d = 0.2) => {
    const leg = limb(w, h, d, x, h, z, skin);
    part(leg, [w + 0.035, 0.12, d + 0.05], [0, -h + 0.06, -0.015], toe);
    g.userData.legs.push(leg);
    return leg;
  };
  const tail = (at, segments, m) => {
    const j = joint(g, at);
    for (const [size, pos] of segments) part(j, size, pos, m);
    g.userData.tail = j;
    return j;
  };
  if (["grazer", "woolling", "cow", "panda", "koala", "tiger"].includes(type)) {
    const pig = type === "grazer",
      sheep = type === "woolling",
      cow = type === "cow",
      panda = type === "panda",
      koala = type === "koala",
      tiger = type === "tiger";
    const fur = mat(
      pig
        ? "#dc9993"
        : sheep
          ? "#eee7d4"
          : cow
            ? "#e9d9b8"
            : panda
              ? "#e7e3d5"
              : koala
                ? "#8eaaa6"
                : "#d99b49",
    );
    const dark = mat(
      pig
        ? "#b56c6c"
        : sheep
          ? "#928478"
          : cow
            ? "#5b493b"
            : panda
              ? "#363d44"
              : koala
                ? "#5e787b"
                : "#513d34",
    );
    const pale = mat(pig ? "#edb4a5" : koala ? "#c2d4c5" : "#f0dfb9");
    const legH = koala
      ? 0.24
      : pig
        ? 0.29
        : panda
          ? 0.4
          : tiger
            ? 0.43
            : sheep
              ? 0.47
              : 0.56;
    const width = panda ? 0.84 : cow ? 0.76 : koala ? 0.56 : 0.65,
      length = tiger ? 1.27 : cow ? 1.13 : koala ? 0.7 : 1.0,
      bodyY = legH + 0.28;
    part(g, [width, 0.49, length], [0, bodyY, 0], fur);
    part(g, [width * 0.82, 0.15, length * 0.82], [0, bodyY + 0.29, 0.015], fur);
    part(
      g,
      [width * 0.72, 0.12, length * 0.8],
      [0, bodyY - 0.27, 0],
      panda ? dark : pale,
    );
    head.position.set(
      0,
      bodyY + (koala ? 0.16 : panda ? 0.17 : 0.07),
      -length / 2 - 0.16,
    );
    const hw = koala ? 0.46 : panda ? 0.58 : cow ? 0.46 : 0.45,
      hh = panda ? 0.48 : 0.4;
    part(head, [hw, hh, 0.4], [0, 0, 0], sheep ? dark : fur);
    part(
      head,
      [hw * 0.77, 0.1, 0.37],
      [0, -hh / 2 - 0.025, -0.02],
      sheep ? dark : fur,
    );
    for (const side of [-1, 1]) {
      const ear = joint(head, [side * (hw / 2 + 0.045), 0.18, 0.015]);
      if (koala) {
        part(ear, [0.22, 0.23, 0.14], [side * 0.025, 0.02, 0], fur);
        part(ear, [0.15, 0.15, 0.035], [side * 0.03, 0.02, -0.085], pale);
      } else if (panda) {
        part(ear, [0.17, 0.18, 0.15], [0, 0.055, 0.015], dark);
        part(ear, [0.11, 0.06, 0.13], [0, 0.16, 0.015], dark);
        part(
          head,
          [0.16, 0.18, 0.025],
          [side * 0.16, 0.025, -0.212],
          dark,
        ).rotation.z = -side * 0.2;
      } else {
        part(
          ear,
          [cow ? 0.2 : 0.16, 0.1, 0.17],
          [side * 0.03, -0.01, 0],
          sheep ? dark : fur,
        ).rotation.z = side * -0.25;
        part(ear, [0.09, 0.025, 0.1], [side * 0.04, -0.065, -0.02], pale);
      }
      if (panda) eye(side * 0.16, 0.025, -0.233, cream, 0.045);
      else eye(side * (hw * 0.29), 0.035, -0.213);
      if (!panda)
        part(
          head,
          [0.09, 0.025, 0.02],
          [side * (hw * 0.29), 0.11, -0.214],
          dark,
        );
      for (const z of [-length * 0.31, length * 0.31])
        foot(
          side * width * 0.33,
          z,
          legH,
          panda || tiger ? dark : fur,
          pig || cow || sheep ? dark : koala ? pale : dark,
          panda ? 0.22 : 0.16,
          tiger ? 0.27 : 0.2,
        );
    }
    if (pig) {
      part(head, [0.29, 0.18, 0.12], [0, -0.065, -0.25], pale);
      for (const x of [-0.07, 0.07])
        part(head, [0.04, 0.055, 0.015], [x, -0.055, -0.317], dark);
      tail(
        [0, bodyY, 0.54],
        [
          [
            [0.1, 0.09, 0.17],
            [0, 0, 0.05],
          ],
          [
            [0.17, 0.09, 0.07],
            [0.04, 0.07, 0.13],
          ],
          [
            [0.07, 0.08, 0.09],
            [0.1, 0.12, 0.09],
          ],
        ],
        fur,
      );
    }
    if (sheep) {
      part(head, [0.5, 0.16, 0.44], [0, 0.22, 0.01], fur);
      for (const x of [-0.22, 0, 0.22])
        part(head, [0.21, 0.12, 0.3], [x, 0.31, 0.03], fur);
      for (const side of [-1, 1])
        for (const z of [-0.32, 0, 0.32])
          part(g, [0.16, 0.29, 0.29], [side * 0.33, bodyY + 0.02, z], fur);
      part(head, [0.22, 0.12, 0.08], [0, -0.1, -0.24], pale);
      tail(
        [0, bodyY - 0.1, 0.55],
        [
          [
            [0.13, 0.22, 0.13],
            [0, -0.06, 0],
          ],
        ],
        fur,
      );
    }
    if (cow) {
      for (const side of [-1, 1]) {
        part(
          head,
          [0.085, 0.19, 0.09],
          [side * 0.2, 0.3, 0.04],
          cream,
        ).rotation.z = -side * 0.18;
        part(g, [0.022, 0.25, 0.3], [side * 0.387, bodyY + 0.03, -0.26], dark);
        part(g, [0.025, 0.17, 0.25], [side * 0.389, bodyY - 0.1, 0.24], dark);
        part(g, [0.25, 0.018, 0.24], [side * 0.15, bodyY + 0.37, 0.08], dark);
      }
      part(head, [0.35, 0.19, 0.14], [0, -0.11, -0.25], mat("#cba998"));
      for (const x of [-0.09, 0.09])
        part(head, [0.045, 0.045, 0.02], [x, -0.095, -0.325], dark);
      tail(
        [0, bodyY + 0.02, 0.58],
        [
          [
            [0.08, 0.38, 0.08],
            [0, -0.15, 0.04],
          ],
          [
            [0.15, 0.13, 0.14],
            [0, -0.36, 0.06],
          ],
        ],
        dark,
      );
    }
    if (panda) {
      part(g, [width + 0.02, 0.49, 0.23], [0, bodyY, -0.25], dark);
      part(head, [0.24, 0.16, 0.09], [0, -0.09, -0.25], cream);
      part(head, [0.09, 0.06, 0.02], [0, -0.06, -0.305], ink);
      tail(
        [0, bodyY - 0.1, 0.54],
        [
          [
            [0.14, 0.14, 0.14],
            [0, 0, 0],
          ],
        ],
        cream,
      );
    }
    if (koala) {
      part(head, [0.13, 0.19, 0.08], [0, -0.025, -0.24], dark);
      part(g, [0.28, 0.3, 0.035], [0, bodyY - 0.02, -length / 2 - 0.02], pale);
      tail(
        [0, bodyY - 0.18, 0.38],
        [
          [
            [0.18, 0.14, 0.13],
            [0, 0, 0],
          ],
        ],
        fur,
      );
    }
    if (tiger) {
      for (const side of [-1, 1]) {
        part(head, [0.16, 0.16, 0.07], [side * 0.12, -0.1, -0.24], pale);
        part(
          head,
          [0.06, 0.13, 0.022],
          [side * 0.16, 0.13, -0.212],
          dark,
        ).rotation.z = side * 0.25;
        for (let i = 0; i < 5; i++) {
          const z = -0.43 + i * 0.21;
          part(
            g,
            [0.025, 0.26, 0.065],
            [side * 0.333, bodyY + 0.07, z],
            dark,
          ).rotation.x = (i % 2 ? 1 : -1) * 0.22;
          part(
            g,
            [0.027, 0.12, 0.12],
            [side * 0.335, bodyY - 0.1, z + 0.025],
            dark,
          );
        }
      }
      part(head, [0.085, 0.05, 0.035], [0, -0.04, -0.287], ink);
      const t = tail(
        [0, bodyY + 0.1, 0.65],
        [
          [
            [0.13, 0.13, 0.63],
            [0, 0, 0.26],
          ],
          [
            [0.13, 0.19, 0.13],
            [0, 0.035, 0.58],
          ],
        ],
        fur,
      );
      for (let i = 0; i < 4; i++)
        part(t, [0.14, 0.14, 0.055], [0, 0, 0.07 + i * 0.15], dark);
      part(t, [0.14, 0.2, 0.13], [0, 0.04, 0.6], dark);
    }
    return true;
  }
  if (type === "chicken") {
    const feather = mat("#f1e6ce"),
      gold = mat("#d6a14f"),
      red = mat("#c85b4e");
    part(g, [0.39, 0.34, 0.48], [0, 0.38, 0.03], feather);
    part(g, [0.32, 0.15, 0.37], [0, 0.59, 0.01], feather);
    head.position.set(0, 0.66, -0.23);
    part(head, [0.28, 0.28, 0.27], [0, 0, 0], feather);
    part(head, [0.17, 0.075, 0.15], [0, -0.035, -0.19], gold);
    part(head, [0.09, 0.11, 0.06], [0, -0.15, -0.15], red);
    for (let i = 0; i < 3; i++)
      part(
        head,
        [0.07, 0.08 + (i === 1 ? 0.04 : 0), 0.1],
        [-0.08 + i * 0.08, 0.18, 0.015],
        red,
      );
    for (const side of [-1, 1]) {
      eye(side * 0.09, 0.04, -0.146, ink, 0.045);
      const wing = limb(0.08, 0.23, 0.34, side * 0.22, 0.52, 0.04, feather);
      part(wing, [0.09, 0.1, 0.2], [0, -0.22, 0.03], mat("#d3c39e"));
      g.userData.wings.push(wing);
      const leg = foot(side * 0.1, -0.03, 0.22, gold, gold, 0.045, 0.06);
      for (const x of [-0.035, 0.035])
        part(leg, [0.025, 0.03, 0.16], [x, -0.21, -0.05], gold);
    }
    for (let i = 0; i < 3; i++)
      part(
        g,
        [0.09, 0.28, 0.1],
        [-0.1 + i * 0.1, 0.51, 0.29],
        feather,
      ).rotation.x = -0.45;
    return true;
  }
  if (type === "rabbit") {
    const fur = mat("#b39577"),
      light = mat("#e0c8a6"),
      pink = mat("#cf9b92");
    part(g, [0.35, 0.29, 0.49], [0, 0.26, 0.04], fur);
    for (const side of [-1, 1]) {
      part(g, [0.16, 0.25, 0.25], [side * 0.16, 0.23, 0.17], fur);
      foot(side * 0.14, 0.16, 0.13, fur, light, 0.11, 0.25);
      foot(side * 0.12, -0.19, 0.18, fur, light, 0.075, 0.13);
    }
    head.position.set(0, 0.48, -0.23);
    part(head, [0.31, 0.28, 0.29], [0, 0, 0], fur);
    for (const side of [-1, 1]) {
      const ear = joint(head, [side * 0.1, 0.13, 0.015]);
      ear.rotation.z = -side * 0.12;
      part(ear, [0.085, 0.33, 0.095], [0, 0.155, 0], fur);
      part(ear, [0.04, 0.24, 0.018], [0, 0.15, -0.055], pink);
      eye(side * 0.1, 0.035, -0.155, ink, 0.05);
      part(head, [0.105, 0.085, 0.045], [side * 0.07, -0.08, -0.17], light);
    }
    part(head, [0.055, 0.035, 0.025], [0, -0.04, -0.202], pink);
    tail(
      [0, 0.33, 0.32],
      [
        [
          [0.15, 0.15, 0.14],
          [0, 0, 0],
        ],
      ],
      light,
    );
    return true;
  }
  if (type === "villager") {
    const style = VILLAGE_STYLES[entity.style] || VILLAGE_STYLES.meadow || {},
      robe = mat(style.robe || "#747f5e"),
      trim = mat(style.trim || "#d3b780"),
      skin = mat("#c69b75"),
      shade = mat("#775c4a");
    part(g, [0.48, 0.63, 0.32], [0, 1.02, 0], robe);
    part(g, [0.55, 0.22, 0.38], [0, 0.63, 0], robe);
    part(g, [0.5, 0.075, 0.35], [0, 0.84, 0], trim);
    const apron = mat(
      entity.profession === "mason"
        ? "#99aaa4"
        : entity.profession === "farmer"
          ? "#d2b564"
          : "#c5b9d3",
    );
    part(g, [0.31, 0.37, 0.025], [0, 1.04, -0.175], apron);
    part(g, [0.065, 0.045, 0.015], [0.07, 1.05, -0.194], trim);
    head.position.set(0, 1.55, 0);
    part(head, [0.46, 0.42, 0.42], [0, 0.09, 0], skin);
    part(head, [0.36, 0.1, 0.36], [0, -0.15, -0.015], skin);
    part(head, [0.32, 0.045, 0.025], [0, 0.24, -0.226], shade);
    for (const side of [-1, 1]) {
      part(head, [0.095, 0.075, 0.022], [side * 0.115, 0.14, -0.223], cream);
      part(
        head,
        [0.04, 0.055, 0.025],
        [side * 0.112, 0.135, -0.24],
        mat("#456956"),
      );
      part(head, [0.065, 0.11, 0.14], [side * 0.25, 0.08, 0.01], skin);
    }
    part(head, [0.13, 0.17, 0.13], [0, 0.025, -0.275], skin);
    part(head, [0.085, 0.027, 0.014], [0, -0.13, -0.208], shade);
    const hood = ["pine", "snow"].includes(entity.style),
      wrap = ["desert", "badlands"].includes(entity.style);
    if (hood) {
      part(head, [0.54, 0.1, 0.49], [0, 0.33, 0], robe);
      for (const side of [-1, 1])
        part(head, [0.075, 0.35, 0.46], [side * 0.27, 0.15, 0.02], robe);
      part(head, [0.49, 0.36, 0.08], [0, 0.15, 0.24], robe);
    } else if (wrap) {
      part(head, [0.55, 0.12, 0.5], [0, 0.35, 0], trim);
      part(head, [0.45, 0.12, 0.42], [0, 0.46, 0.02], robe);
      part(head, [0.13, 0.24, 0.08], [0.19, 0.12, 0.24], trim);
    } else if (entity.profession === "farmer") {
      part(head, [0.67, 0.065, 0.62], [0, 0.34, 0], trim);
      part(head, [0.43, 0.15, 0.4], [0, 0.44, 0.02], trim);
      part(head, [0.45, 0.035, 0.42], [0, 0.38, 0.02], shade);
    } else {
      part(head, [0.47, 0.095, 0.44], [0, 0.32, 0.01], shade);
      part(head, [0.3, 0.055, 0.36], [0, 0.39, 0.03], shade);
    }
    g.userData.foldedArms = [-1, 1].map((side) => {
      const arm = joint(g, [side * 0.28, 1.33, 0]);
      part(arm, [0.17, 0.3, 0.22], [0, -0.15, 0], robe);
      part(arm, [0.26, 0.15, 0.2], [-side * 0.055, -0.31, -0.19], robe);
      part(arm, [0.11, 0.13, 0.16], [-side * 0.2, -0.31, -0.2], skin);
      part(arm, [0.055, 0.155, 0.205], [-side * 0.145, -0.31, -0.19], trim);
      return arm;
    });
    for (const side of [-1, 1])
      foot(side * 0.13, 0, 0.5, shade, shade, 0.18, 0.22);
    return true;
  }
  if (type === "iron_golem" || type === "devin_guardian") {
    const guardian = type === "devin_guardian",
      metal = mat(guardian ? "#405977" : "#c1ccbb"),
      edge = mat(guardian ? "#b5bfc6" : "#e1ddca"),
      dark = mat(guardian ? "#27384d" : "#7c9180"),
      gold = mat(guardian ? "#d8b866" : "#849e69"),
      glow = mat(guardian ? "#73dbe1" : "#b58d5e");
    if (guardian) glow.emissive.set("#20585d");
    part(g, [guardian ? 0.67 : 0.9, 0.76, 0.45], [0, 1.29, 0], metal);
    part(g, [0.5, 0.26, 0.39], [0, 0.82, 0], dark);
    part(g, [guardian ? 0.72 : 1.02, 0.17, 0.49], [0, 1.65, 0], edge);
    part(g, [0.5, 0.3, 0.07], [0, 1.33, -0.265], edge);
    part(g, [0.25, 0.17, 0.035], [0, 1.34, -0.315], guardian ? gold : dark);
    part(g, [0.52, 0.09, 0.42], [0, 0.91, 0], gold);
    head.position.set(0, 2.01, -0.02);
    part(head, [0.45, 0.44, 0.43], [0, 0, 0], metal);
    part(head, [0.5, 0.075, 0.46], [0, 0.14, 0], edge);
    if (guardian) {
      part(head, [0.33, 0.065, 0.025], [0, 0.005, -0.235], glow);
      part(head, [0.08, 0.32, 0.07], [0, 0.24, -0.08], gold);
      for (const side of [-1, 1])
        part(
          head,
          [0.09, 0.18, 0.12],
          [side * 0.2, 0.29, 0.02],
          gold,
        ).rotation.z = -side * 0.2;
      for (let i = 0; i < 3; i++)
        part(
          g,
          [0.075, 0.075, 0.03],
          [0, 1.55 - i * 0.17, -0.315],
          glow,
        ).rotation.z = Math.PI / 4;
      part(g, [0.54, 0.55, 0.05], [0, 0.65, 0.25], dark);
    } else {
      for (const side of [-1, 1]) eye(side * 0.11, 0.005, -0.225, glow, 0.055);
      part(head, [0.14, 0.15, 0.12], [0, -0.08, -0.27], metal);
      for (let i = 0; i < 3; i++)
        part(
          g,
          [0.065, 0.25, 0.022],
          [-0.24 + i * 0.065, 1.4 - i * 0.13, -0.235],
          gold,
        );
      part(g, [0.07, 0.07, 0.03], [-0.18, 1.6, -0.247], mat("#bd826e"));
    }
    g.userData.arms = [-1, 1].map((side) => {
      const arm = limb(
        guardian ? 0.24 : 0.29,
        guardian ? 0.84 : 1.08,
        0.31,
        side * (guardian ? 0.45 : 0.6),
        1.69,
        0,
        metal,
      );
      part(arm, [guardian ? 0.35 : 0.39, 0.2, 0.42], [0, -0.025, 0], edge);
      part(
        arm,
        [guardian ? 0.28 : 0.34, 0.24, 0.35],
        [0, guardian ? -0.7 : -0.96, -0.025],
        edge,
      );
      return arm;
    });
    if (guardian) {
      attachNPCWeapon(g.userData.arms[0], "shield", [0, -0.72, -0.04], 1.25);
      attachNPCWeapon(
        g.userData.arms[1],
        "golden_sword",
        [0, -0.72, -0.04],
        1.15,
      );
    }
    for (const side of [-1, 1])
      foot(side * 0.23, 0, 0.65, dark, metal, guardian ? 0.24 : 0.3, 0.35);
    return true;
  }
  if (type === "spider") {
    const shell = mat("#554b68"),
      rim = mat("#7b6387"),
      dark = mat("#353643"),
      eyeColor = mat("#e5b878");
    part(g, [0.65, 0.33, 0.73], [0, 0.43, 0.24], shell);
    part(g, [0.47, 0.12, 0.59], [0, 0.66, 0.25], rim);
    part(g, [0.43, 0.26, 0.4], [0, 0.41, -0.27], dark);
    head.position.set(0, 0.43, -0.58);
    part(head, [0.43, 0.27, 0.32], [0, 0, 0], shell);
    for (const x of [-0.13, -0.045, 0.045, 0.13])
      eye(
        x,
        0.035,
        -0.173,
        eyeColor,
        x === -0.045 || x === 0.045 ? 0.055 : 0.04,
      );
    for (const x of [-0.085, 0.085])
      part(head, [0.055, 0.09, 0.06], [x, -0.12, -0.17], dark);
    for (let i = 0; i < 3; i++)
      part(g, [0.1, 0.06, 0.38], [-0.2 + i * 0.2, 0.735, 0.29], rim);
    g.userData.spiderLegs = [];
    for (const side of [-1, 1])
      for (let i = 0; i < 4; i++) {
        const j = limb(
          0.075,
          0.49,
          0.075,
          side * 0.23,
          0.48,
          -0.32 + i * 0.22,
          dark,
        );
        j.rotation.z = side * 1.05;
        j.rotation.y = side * (i - 1.5) * 0.37;
        part(j, [0.1, 0.11, 0.1], [0, -0.37, 0], rim);
        part(
          j,
          [0.065, 0.37, 0.065],
          [side * 0.13, -0.55, 0],
          dark,
        ).rotation.z = -side * 0.7;
        g.userData.spiderLegs.push({
          joint: j,
          side,
          index: i,
          base: j.rotation.y,
        });
      }
    return true;
  }
  if (type === "creeper") {
    const moss = mat("#79945a"),
      shade = mat("#536d48"),
      tip = mat("#a3b876");
    part(g, [0.4, 0.69, 0.33], [0, 0.75, 0], moss);
    part(g, [0.45, 0.18, 0.37], [0, 1.14, 0], shade);
    head.position.set(0, 1.4, 0);
    part(head, [0.57, 0.48, 0.49], [0, 0, 0], moss);
    part(head, [0.45, 0.06, 0.42], [0, 0.27, 0.01], tip);
    for (const side of [-1, 1]) {
      part(head, [0.105, 0.11, 0.025], [side * 0.13, 0.045, -0.258], ink);
      part(head, [0.075, 0.09, 0.025], [side * 0.085, -0.17, -0.258], ink);
    }
    part(head, [0.1, 0.17, 0.025], [0, -0.075, -0.258], ink);
    part(g, [0.11, 0.27, 0.023], [0.08, 0.76, -0.182], shade);
    part(g, [0.17, 0.07, 0.023], [-0.065, 0.97, -0.182], tip);
    for (const side of [-1, 1])
      for (const z of [-0.18, 0.18])
        foot(side * 0.19, z, 0.36, shade, moss, 0.21, 0.24);
    return true;
  }
  if (type === "watcher") {
    const pale = mat("#deded3"),
      fold = mat("#b6c1b9");
    part(g, [0.3, 0.96, 0.23], [0, 1.94, 0], pale);
    part(g, [0.43, 0.17, 0.28], [0, 2.36, 0], fold);
    part(g, [0.25, 0.15, 0.2], [0, 2.53, 0], pale);
    head.position.set(0, 2.92, 0);
    part(head, [0.44, 0.54, 0.36], [0, 0, 0], pale);
    part(head, [0.35, 0.08, 0.32], [0, -0.3, 0], fold);
    for (const side of [-1, 1]) {
      part(head, [0.115, 0.14, 0.025], [side * 0.115, 0.035, -0.195], ink);
      const a = limb(0.12, 1.72, 0.14, side * 0.29, 2.35, 0, pale);
      part(a, [0.13, 0.22, 0.15], [0, -1.8, -0.01], fold);
      (g.userData.arms ||= []).push(a);
      foot(side * 0.13, 0, 1.41, pale, fold, 0.14, 0.19);
    }
    return true;
  }
  // Mosscoat, Ivory Scout and the two retained legacy save variants.
  const skeleton = type === "skeleton",
    legacy = type === "shade" || type === "stalker";
  const skin = mat(
    skeleton
      ? "#dfd6b9"
      : type === "shade"
        ? "#7b7a90"
        : type === "stalker"
          ? "#6d816b"
          : "#86a173",
  );
  const cloth = mat(skeleton ? "#a6a18c" : legacy ? "#4e5d68" : "#538b8b"),
    pants = mat("#59677e");
  if (skeleton) {
    part(g, [0.09, 0.63, 0.13], [0, 1.02, 0.055], skin);
    for (let i = 0; i < 3; i++)
      for (const side of [-1, 1]) {
        part(
          g,
          [0.18, 0.065, 0.08],
          [side * 0.12, 1.3 - i * 0.16, -0.07],
          skin,
        );
        part(g, [0.055, 0.085, 0.2], [side * 0.22, 1.29 - i * 0.16, 0], skin);
      }
    part(g, [0.36, 0.15, 0.23], [0, 0.67, 0], skin);
  } else {
    part(g, [0.48, 0.66, 0.32], [0, 1.01, 0], cloth);
    part(g, [0.51, 0.12, 0.35], [0, 0.71, 0], cloth);
    part(g, [0.16, 0.08, 0.025], [-0.1, 1.24, -0.178], skin);
    part(g, [0.09, 0.15, 0.025], [0.16, 0.86, -0.178], skin);
    part(g, [0.025, 0.3, 0.022], [0.025, 1.04, -0.18], pants);
  }
  head.position.set(0, 1.61, 0);
  part(head, [0.47, 0.44, 0.43], [0, 0.02, 0], skin);
  part(head, [0.35, 0.11, 0.33], [0, -0.24, -0.025], skin);
  for (const side of [-1, 1]) {
    part(
      head,
      [skeleton ? 0.12 : 0.09, skeleton ? 0.105 : 0.065, 0.025],
      [side * 0.125, 0.045, -0.227],
      ink,
    );
    part(
      head,
      [0.14, 0.035, 0.025],
      [side * 0.125, 0.15, -0.229],
      skeleton ? cloth : skin,
    );
  }
  if (skeleton) {
    part(head, [0.045, 0.07, 0.025], [0, -0.06, -0.229], ink);
    for (const x of [-0.1, 0, 0.1])
      part(head, [0.06, 0.045, 0.025], [x, -0.19, -0.201], cloth);
  } else {
    part(head, [0.34, 0.06, 0.38], [0, 0.26, 0.025], mat("#566a50"));
    part(head, [0.105, 0.13, 0.035], [0.15, 0.18, -0.217], mat("#566a50"));
    part(head, [0.17, 0.025, 0.025], [0, -0.15, -0.229], cloth);
  }
  g.userData.arms = [-1, 1].map((side) => {
    const arm = limb(
      skeleton ? 0.09 : 0.17,
      0.64,
      skeleton ? 0.1 : 0.2,
      side * 0.32,
      1.37,
      0,
      skeleton ? skin : cloth,
    );
    part(
      arm,
      [skeleton ? 0.11 : 0.18, 0.15, skeleton ? 0.12 : 0.205],
      [0, -0.59, -0.01],
      skin,
    );
    return arm;
  });
  for (const side of [-1, 1])
    foot(
      side * 0.14,
      0,
      0.63,
      skeleton ? skin : pants,
      skeleton ? cloth : mat("#48505d"),
      skeleton ? 0.12 : 0.19,
      skeleton ? 0.14 : 0.24,
    );
  if (skeleton) {
    g.userData.bow = attachNPCWeapon(
      g.userData.arms[1],
      "bow",
      [0, -0.6, -0.03],
      0.9,
    );
  }
  return true;
}
