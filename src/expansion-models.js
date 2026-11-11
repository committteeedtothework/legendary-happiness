// Original articulated voxel creatures. Static parts are batched by models.js.
export function buildExpansionModel(type, { g, head, box, limb, material }) {
  if (type === "devin_guardian" || type === "cinder_wraith") {
    const guardian = type === "devin_guardian",
      armor = material(guardian ? "#394e69" : "#51394c"),
      trim = material(guardian ? "#acb5c5" : "#ab704f"),
      glow = material(guardian ? "#66eafa" : "#ffac54");
    glow.emissive.set(guardian ? "#23758c" : "#843b16");
    box(g, 0.65, 0.9, 0.4, 0, 1.15, 0, armor);
    box(g, 0.45, 0.24, 0.32, 0, 0.65, 0, trim);
    head.position.set(0, 1.94, 0);
    box(head, 0.56, 0.47, 0.51, 0, 0, 0, armor);
    box(head, 0.38, 0.09, 0.03, 0, 0.025, -0.265, glow);
    box(head, 0.08, 0.5, 0.04, 0, 0.015, -0.28, trim);
    for (const side of [-1, 1]) {
      box(g, 0.28, 0.27, 0.46, side * 0.45, 1.57, 0, armor);
      box(head, 0.12, 0.25, 0.15, side * 0.23, 0.31, 0.02, trim).rotation.z =
        side * -0.3;
    }
    for (let i = 0; i < 3; i++)
      box(g, 0.08, 0.08, 0.025, 0, 1.35 - i * 0.18, -0.22, glow).rotation.z =
        Math.PI / 4;
    g.userData.arms = [
      limb(0.22, 0.8, 0.24, -0.43, 1.5, 0, armor),
      limb(0.22, 0.8, 0.24, 0.43, 1.5, 0, armor),
    ];
    g.userData.legs = [
      limb(0.24, 0.55, 0.29, -0.19, 0.55, 0, armor),
      limb(0.24, 0.55, 0.29, 0.19, 0.55, 0, armor),
    ];
    if (guardian) {
      const gold = material("#c2a561"),
        dark = material("#202f46");
      // Layered pauldrons, breastplate ribs and a crested helm give the
      // sentinel a heavy silhouette without adding moving loose fragments.
      box(g, 0.78, 0.5, 0.12, 0, 1.32, -0.25, trim);
      box(g, 0.64, 0.34, 0.08, 0, 1.32, -0.34, armor);
      box(g, 0.16, 0.2, 0.05, 0, 1.35, -0.4, glow).rotation.z = Math.PI / 4;
      box(g, 0.7, 0.2, 0.46, 0, 0.83, 0, gold);
      box(g, 0.56, 0.48, 0.08, 0, 0.58, 0.25, dark);
      for (const side of [-1, 1]) {
        box(g, 0.43, 0.19, 0.58, side * 0.46, 1.72, 0, trim);
        box(g, 0.35, 0.12, 0.5, side * 0.46, 1.84, 0, armor);
        box(g, 0.12, 0.24, 0.12, side * 0.6, 1.94, 0, gold);
        box(head, 0.09, 0.36, 0.13, side * 0.25, 0.38, -0.04, gold);
        box(g, 0.26, 0.22, 0.1, side * 0.19, 0.38, -0.2, trim);
      }
      box(head, 0.14, 0.26, 0.34, 0, 0.3, 0, gold);
      box(head, 0.62, 0.1, 0.55, 0, 0.16, 0, trim);
      box(g.userData.arms[0], 0.48, 0.65, 0.13, 0, -0.44, -0.3, trim);
      box(g.userData.arms[0], 0.37, 0.54, 0.05, 0, -0.44, -0.39, armor);
      box(
        g.userData.arms[0],
        0.16,
        0.2,
        0.06,
        0,
        -0.44,
        -0.43,
        glow,
      ).rotation.z = Math.PI / 4;
      box(g.userData.arms[1], 0.16, 0.9, 0.09, 0, -0.78, -0.25, trim);
      box(g.userData.arms[1], 0.09, 0.7, 0.05, 0, -0.72, -0.25, glow);
      box(g.userData.arms[1], 0.3, 0.07, 0.13, 0, -0.4, -0.25, trim);
      box(g.userData.arms[0], 0.38, 0.5, 0.12, 0, -0.47, -0.22, armor);
      box(g.userData.arms[0], 0.22, 0.07, 0.13, 0, -0.45, -0.23, glow);
    } else box(g, 0.73, 0.52, 0.45, 0, 0.46, 0.03, armor);
    return true;
  }
  if (
    ![
      "panda",
      "koala",
      "tiger",
      "ash_deer",
      "cinderback",
      "basalt_crawler",
    ].includes(type)
  )
    return false;
  const panda = type === "panda",
    koala = type === "koala",
    tiger = type === "tiger",
    deer = type === "ash_deer",
    shell = ["cinderback", "basalt_crawler"].includes(type),
    crawler = type === "basalt_crawler";
  const fur = material(
      panda
        ? "#e1dfcf"
        : koala
          ? "#92958f"
          : tiger
            ? "#d78c3b"
            : deer
              ? "#9296a4"
              : crawler
                ? "#393543"
                : "#6c6263",
    ),
    dark = material(panda ? "#343637" : tiger ? "#3e332b" : "#514953"),
    light = material("#d5cbbc"),
    eye = material("#28282c");
  const legHeight = deer ? 0.85 : koala ? 0.24 : shell ? 0.26 : 0.47,
    bodyY = legHeight + (shell ? 0.15 : 0.27),
    length = tiger ? 1.25 : deer ? 1.15 : 0.95;
  box(
    g,
    panda ? 0.82 : shell ? 0.9 : 0.63,
    shell ? 0.36 : 0.57,
    length,
    0,
    bodyY,
    0,
    fur,
  );
  head.position.set(0, bodyY + (deer ? 0.4 : 0.16), -length / 2 - 0.12);
  box(head, koala ? 0.5 : shell ? 0.38 : 0.49, 0.43, 0.43, 0, 0, 0, fur);
  for (const side of [-1, 1]) {
    if (!shell)
      box(
        head,
        koala ? 0.23 : 0.15,
        koala ? 0.23 : 0.17,
        0.15,
        side * (koala ? 0.28 : 0.21),
        0.24,
        0,
        panda ? dark : fur,
      );
    if (panda)
      box(
        head,
        0.13,
        0.13,
        0.025,
        side * 0.14,
        0.025,
        -0.225,
        dark,
      ).rotation.z = side * 0.25;
    box(
      head,
      0.055,
      0.055,
      0.025,
      side * 0.14,
      0.03,
      -0.245,
      crawler ? material("#ef9c55") : eye,
    );
  }
  box(
    head,
    koala ? 0.15 : 0.23,
    koala ? 0.19 : 0.13,
    0.1,
    0,
    -0.09,
    -0.25,
    koala ? eye : light,
  );
  const count = crawler ? 3 : 2;
  for (const side of [-1, 1])
    for (let i = 0; i < count; i++)
      g.userData.legs.push(
        limb(
          shell ? 0.15 : 0.18,
          legHeight,
          0.2,
          side * (shell ? 0.43 : 0.25),
          legHeight,
          (i / (count - 1) - 0.5) * (length * 0.65),
          panda || tiger ? dark : fur,
        ),
      );
  if (tiger) {
    for (const side of [-1, 1])
      for (let i = 0; i < 6; i++)
        box(
          g,
          0.025,
          0.44,
          0.065,
          side * 0.325,
          bodyY,
          -0.48 + i * 0.19,
          dark,
        ).rotation.x = (i % 2 ? 1 : -1) * 0.15;
    const tail = box(
      g,
      0.12,
      0.12,
      0.65,
      0,
      bodyY + 0.08,
      length / 2 + 0.25,
      fur,
    );
    g.userData.tail = tail;
    for (let i = 0; i < 4; i++)
      box(g, 0.13, 0.13, 0.05, 0, bodyY + 0.08, length / 2 + i * 0.15, dark);
  }
  if (panda) box(g, 0.84, 0.58, 0.2, 0, bodyY, -0.26, dark);
  if (deer)
    for (const side of [-1, 1]) {
      box(head, 0.065, 0.48, 0.065, side * 0.19, 0.42, 0.03, dark).rotation.z =
        side * -0.25;
      box(head, 0.25, 0.06, 0.065, side * 0.22, 0.55, 0.03, light);
      box(head, 0.07, 0.12, 0.07, side * 0.29, 0.67, 0.03, material("#f1ba7a"));
    }
  if (shell) {
    box(g, 1, 0.4, 1.05, 0, bodyY + 0.22, 0, dark);
    for (const x of [-0.24, 0.24])
      for (const z of [-0.3, 0, 0.3])
        box(g, 0.3, 0.15, 0.23, x, bodyY + 0.47, z, fur);
    box(
      g,
      0.07,
      0.045,
      0.8,
      0,
      bodyY + 0.56,
      0,
      material(crawler ? "#e17c46" : "#ce9d68"),
    );
  }
  return true;
}
