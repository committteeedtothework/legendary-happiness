// Original 16px cutouts. Empty pixels are actual alpha, including handle loops,
// helmet visors and the gap between boots. No extrusion/shadow halo is baked in.
const ART = {
  palm_tablet: [
    "    ddddddd",
    "   dllmmmmmd",
    "   dlmsmsmmd",
    "   dlmsssmd",
    "   dlmsmsmd",
    "   dlmssmmd",
    "   dmmssssd",
    "    dddddd",
  ],
  saint_corpse_part: [
    "     ww ww",
    "     wlwlw",
    "      wlw",
    "      wlw",
    "     hhhhh",
    "     hhghh",
    "      wlw",
    "     wlwlw",
    "     ww ww",
  ],
  coal: [
    "       ddd",
    "     ddsssd",
    "    dssmmssd",
    "   dsmmmlmssd",
    "  dssmlmmsssd",
    "  dssmmssmssd",
    "   dssmssssd",
    "    dsssssd",
    "     ddddd",
  ],
  raw: [
    "      ddd",
    "    ddmmmd",
    "   dmllmmsdd",
    "  dmlmmssmmmd",
    "  dmmssmmlmmd",
    "   dssmmmsmd",
    "    dmmsssd",
    "     ddddd",
  ],
  gem: [
    "      dddd",
    "    ddlllldd",
    "   dlmmmmmmld",
    "  dlmmmlmmmmsd",
    "  dmmmlmmmmsmd",
    "   dmmlmmsmsd",
    "    dmlmsssd",
    "     dmsssd",
    "      dssd",
    "       dd",
  ],
  emerald: [
    "      dddd",
    "     dllmmd",
    "    dlmmmmsd",
    "    dmlmmmsd",
    "    dmlmmmsd",
    "    dmmmsmsd",
    "    dmmssmsd",
    "     dssssd",
    "      dddd",
  ],
  ingot: [
    "     ddddddddd",
    "    dlllmmmmsd",
    "   dllmmmmmsmsd",
    "  dlllllllmmmsd",
    "  dmmmmmmmssssd",
    "   dsssssssssd",
    "    ddddddddd",
  ],
  clay: [
    "      ddddd",
    "    ddlllmmdd",
    "   dllmmmmmmmd",
    "   dlmmmmmmmsd",
    "   dmmmmmssssd",
    "    ddssssdd",
    "      dddd",
  ],
  brick: [
    "     ddddddddd",
    "    dlllmmmmmsd",
    "   dllmmmmmmsssd",
    "   dmmmmmmmmsssd",
    "   dssssssssssd",
    "    dddddddddd",
  ],
  apple: [
    "       hh  gg",
    "       h ggg",
    "     dddhddd",
    "    drllrrrsd",
    "   drllrrrrrsd",
    "   drlrrrrrrsd",
    "   drrrrrrrrsd",
    "    drrrrrssd",
    "     drrsssd",
    "      dddd",
  ],
  meat: [
    "       ddddd",
    "     ddmmmmsd",
    "    dmllmmmssd",
    "   dmllmmwwmsd",
    "  dmmmmmmwwmsd",
    "  dmmwwmmmmsd",
    "   dmwwmmssd",
    "    dssssdd",
    "     dddd",
  ],
  bread: [
    "      ddddd",
    "    ddllmmmd",
    "   dllmmhmmsd",
    "  dllmhmmmmsd",
    "  dlmmmmmhsmd",
    "  dmmhmmmsssd",
    "   dsssssssd",
    "    ddddddd",
  ],
  leather: [
    "   ddd    ddd",
    "   dmmddddmmd",
    "    dmlmmmmd",
    "   dmllmmmmsd",
    "   dmmmmmmmsd",
    "    dmmssmsd",
    "    dmmsmmsd",
    "   dmmssmmsmd",
    "   dddssssddd",
    "      dddd",
  ],
  feather: [
    "          dd",
    "        ddwld",
    "       dwwwld",
    "      dwwwsld",
    "     dwwwsld",
    "    dwwwsld",
    "    dwwsld",
    "     dsld",
    "     hhd",
    "    hh",
    "   hh",
  ],
  flint: [
    "        dd",
    "       dlmd",
    "      dlmmsd",
    "     dlmmmsd",
    "    dmmmmmmd",
    "   dmmmmmssd",
    "   dmsssssd",
    "    dddddd",
  ],
  paper: [
    "    dddddddd",
    "    dwwwwwld",
    "   dwwwwwwld",
    "   dwwwwwwld",
    "  dwwwwwwld",
    "  dwwwwwwld",
    "   dlllllld",
    "    ddddddd",
  ],
  book: [
    "    dddddddd",
    "   dhhhhhhhmd",
    "  dhhhhhhhmmd",
    "  dwwwwwwwmmd",
    "  dlllllllmmd",
    "  dhhhhhhhmsd",
    "   dsssssssd",
    "    ddddddd",
  ],
  stick: [
    "            hd",
    "           hld",
    "          hld",
    "         hld",
    "        hld",
    "       hld",
    "      hld",
    "     hld",
    "    hld",
    "   hld",
    "   dd",
  ],
  bone: [
    "           ww",
    "          wlw",
    "          wwdw",
    "         wlw w",
    "        wlw",
    "       wlw",
    "      wlw",
    "   ww wlw",
    "   wlwlw",
    "    ww",
    "    ww",
  ],
  string: [
    "     wwwww",
    "    w     w",
    "   w  www  w",
    "   w w   w w",
    "   w w   w w",
    "   w  www  w",
    "    w     w",
    "     wwwww w",
    "           w",
    "         ww",
  ],
  powder: [
    "       mm",
    "     mmllm",
    "    mmlmlmm",
    "    mmmmmsm",
    "   mmmmlmmsm",
    "  mmlmmmmmsmm",
    "  dddddddddd",
  ],
  seeds: [
    "      gg",
    "     glg   gg",
    "      gg  glg",
    "   gg      gg",
    "  glg  gg",
    "   gg glg  gg",
    "       gg glg",
    "           gg",
  ],
  wheat: [
    "    m   m",
    "   mlm mlm",
    "    mh mh  m",
    "   mlhmlm mlm",
    "    mhmh  mh",
    "     hhm mlh",
    "     hhmmlmh",
    "      hh hh",
    "      hhhh",
    "       hh",
    "       hh",
  ],
  bucket: [
    "    dddddddd",
    "   dllmmmmmsd",
    "   dsffffffsd",
    "   dlmmmmmsmd",
    "    dlmmmmmd",
    "    dlmmmmsd",
    "     dmmmsd",
    "      dddd",
  ],
  helmet: [
    "     dddddd",
    "    dllmmmmd",
    "   dlmmmmmmsd",
    "   dlmmmmmmsd",
    "   dmmddddmmd",
    "   dmm    mmd",
    "   dsd    dsd",
    "    dd    dd",
  ],
  chestplate: [
    "   ddd    ddd",
    "  dlmmddddmmsd",
    "  dlmmmmmmmmsd",
    "  dmmmmmmsmmsd",
    "   ddmmmmmsdd",
    "    dmmmmmsd",
    "    dmmmmmsd",
    "    dmssmssd",
    "     dddddd",
  ],
  leggings: [
    "    dddddddd",
    "    dllmmmmd",
    "    dmmmmmsd",
    "    dmmddmsd",
    "    dmmddmsd",
    "    dmmddmsd",
    "    dmsddssd",
    "    dmsddssd",
    "    dddddddd",
  ],
  boots: [
    "    ddd  ddd",
    "    dlmd dlmd",
    "    dmmd dmmd",
    "    dmsd dmsd",
    "   dmmmd dmmmd",
    "   dsssd dsssd",
    "    ddd   ddd",
  ],
  flint_and_steel: [
    "     dddddd",
    "    dllmmmsd",
    "   dlmd  dmsd",
    "   dmd   dsd",
    "   dmd    d dd",
    "   dmd     dmsd",
    "    dmd   dmmsd",
    "     dddddmmsd",
    "         dssd",
    "          dd",
  ],
};

function shade(hex, factor) {
  const value = parseInt(hex.slice(1), 16);
  return (
    "#" +
    [16, 8, 0]
      .map((n) =>
        Math.min(255, Math.round(((value >> n) & 255) * factor))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function toolArt(tool) {
  const grid = Array.from({ length: 16 }, () => Array(16).fill(" "));
  const p = (x, y, c) => {
    if (grid[y]?.[x] !== undefined) grid[y][x] = c;
  };
  // Diagonal, one-pixel wooden haft instead of a thick rotated rectangle.
  for (let n = 2; n <= 10; n++) {
    p(n, 15 - n, "h");
    p(n + 1, 15 - n, "H");
  }
  if (tool === "sword" || tool === "spear") {
    for (let n = 7; n <= 13; n++) {
      p(n, 14 - n, "l");
      p(n, 15 - n, "m");
      p(n + 1, 15 - n, "s");
    }
    if (tool === "sword")
      for (let n = 0; n < 5; n++) p(5 + n, 6 + n, n < 2 ? "l" : "s");
  } else if (tool === "pickaxe" || tool === "hoe") {
    for (let n = 5; n <= 12; n++) {
      p(n, 3, "l");
      p(n, 4, "m");
    }
    for (let n = 0; n < 4; n++) {
      p(12 + Math.min(n, 2), 4 + n, "s");
    }
    if (tool === "pickaxe") {
      p(4, 4, "l");
      p(3, 5, "m");
      p(3, 6, "s");
    }
  } else {
    const rows =
      tool === "axe"
        ? [" llll", "lmmms", "lmmms", " mms", "  s"]
        : [" lll", "lmmms", "lmmms", " mms", "  s"];
    rows.forEach((r, y) =>
      [...r].forEach((c, x) => {
        if (c !== " ") p(x + 7, y + 1, c);
      }),
    );
  }
  return grid.map((row) => row.join(""));
}

export function itemSprite(id, item) {
  if (id === "oak_boat")
    return {
      key: "oak_boat",
      rows: [
        "                ",
        "                ",
        "  d          d  ",
        "  dh        hd  ",
        " ddhddddddddhdd ",
        " dhhbbbbbbbbhhd ",
        " dhbbbbbbbbbbhd ",
        "  dbbbbbbbbbbd  ",
        "   dddddddddd   ",
        "                ",
        "                ",
        "                ",
        "                ",
        "                ",
        "                ",
        "                ",
      ],
      palette: { d: "#68482f", h: "#e1b46a", b: "#ad814c" },
    };
  if (
    !item ||
    item.block !== undefined ||
    item.spawnType ||
    item.legendary ||
    item.tool === "pistols"
  )
    return null;
  if (item.musicDisc)
    return {
      key: "music_disc",
      rows: [
        "      dddd",
        "    dddddddd",
        "   ddssssssdd",
        "  ddssddddssdd",
        "  dssddmmddssd",
        "  dssdm  mdssd",
        "  dssdm  mdssd",
        "  dssddmmddssd",
        "  ddssddddssdd",
        "   ddssssssdd",
        "    dddddddd",
        "      dddd",
      ],
      palette: { d: "#242a36", s: "#465361", m: item.color },
    };
  let key;
  if (item.armorSlot !== undefined)
    key = ["helmet", "chestplate", "leggings", "boots"][item.armorSlot];
  else if (item.tool) key = "tool";
  else if (id.includes("ingot") || id === "hellfire_alloy") key = "ingot";
  else if (id.startsWith("raw_") && id !== "raw_meat") key = "raw";
  else
    key =
      {
        charcoal: "coal",
        diamond: "gem",
        lapis_lazuli: "raw",
        brimstone: "raw",
        clay_ball: "clay",
        brick_item: "brick",
        raw_meat: "meat",
        cooked_meat: "meat",
        rotten_flesh: "meat",
        bone_meal: "powder",
        gunpowder: "powder",
        water_bucket: "bucket",
        lava_bucket: "bucket",
      }[id] || id;
  const rows = key === "tool" ? toolArt(item.tool) : ART[key];
  if (!rows) return null;
  const color = item.color || "#b6b6b6";
  const palette = {
    d: shade(color, 0.38),
    s: shade(color, 0.68),
    m: color,
    l: shade(color, 1.3),
    h: "#705032",
    H: "#b18a50",
    w: "#eee6d1",
    g: "#537d32",
    r: "#b93c36",
  };
  if (key === "bucket")
    Object.assign(palette, {
      d: "#35434d",
      s: "#637b83",
      m: "#afc1c8",
      l: "#e2e8e7",
      f:
        id === "water_bucket"
          ? "#427ccd"
          : id === "lava_bucket"
            ? "#ed842e"
            : "#35434d",
    });
  if (id === "coal" || id === "charcoal")
    Object.assign(palette, {
      d: "#20212a",
      s: "#30313b",
      m: "#444650",
      l: "#62616b",
    });
  if (key === "meat") palette.w = id === "rotten_flesh" ? "#6f7844" : "#e7c5a0";
  if (id === "bread" || id === "wheat") palette.h = "#926736";
  return { rows, palette, key };
}

export function paintItemArt(context, id, item) {
  const sprite = itemSprite(id, item);
  if (!sprite) return false;
  const yOffset = Math.floor((16 - sprite.rows.length) / 2);
  for (const [y, row] of sprite.rows.entries())
    for (const [x, pixel] of [...row].entries()) {
      if (!sprite.palette[pixel]) continue;
      context.fillStyle = sprite.palette[pixel];
      context.fillRect(x * 2, (y + yOffset) * 2, 2, 2);
    }
  return true;
}
