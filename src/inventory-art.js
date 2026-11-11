// Original pixel art shared by hotbar, catalog, held sprites and dropped items.
// These silhouettes never rely on a missing external texture or a CSS tint.
const EGGS = {
  zombie: ["#71945a", "#354d79"],
  creeper: ["#78b34d", "#253a2c"],
  skeleton: ["#d8d1bd", "#77776f"],
  spider: ["#473a3d", "#bc4846"],
  cow: ["#e3d6be", "#584439"],
  grazer: ["#e8a2a2", "#b86672"],
  woolling: ["#eee5d1", "#9f8a77"],
  chicken: ["#eee6ce", "#b64d43"],
  rabbit: ["#c59e70", "#75543e"],
  villager: ["#b99572", "#625237"],
  iron_golem: ["#c6cbbb", "#687c51"],
  panda: ["#e7e4da", "#30373a"],
  koala: ["#a9aaa6", "#5a6063"],
  tiger: ["#dd9a45", "#3d3433"],
  polar_bear: ["#e9e5d4", "#a1a6a4"],
  snow_leopard: ["#cdc9b9", "#626572"],
  cod: ["#b2a17e", "#6b6249"],
  salmon: ["#b65c58", "#789b89"],
  tropical_fish: ["#e6a64d", "#6ca8bb"],
  pufferfish: ["#e6cb62", "#9b7845"],
  squid: ["#4b7182", "#a0c1bd"],
  dolphin: ["#8daeb6", "#d6e2dc"],
  turtle: ["#7ca34d", "#41694b"],
  drowned: ["#699b8b", "#a3b8a7"],
  husk: ["#a69866", "#665c4a"],
  stray: ["#a2b8c1", "#647c8d"],
  skeleton_horse: ["#d7d2ba", "#817966"],
  watcher: ["#e2ded3", "#242532"],
};
const tint = (hex, factor) =>
  "#" +
  [1, 3, 5]
    .map((n) =>
      Math.max(
        0,
        Math.min(255, Math.round(parseInt(hex.slice(n, n + 2), 16) * factor)),
      )
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
export function spawnEggPalette(type, fallback = "#a6a2bf") {
  if (EGGS[type]) return EGGS[type];
  return [
    fallback,
    /cinder|ember|magma|dread|titan/.test(type) ? "#df8549" : "#6b527f",
  ];
}
export function paintInventoryArt(ctx, id, item) {
  const px = (color, x, y, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * 2, y * 2, w * 2, h * 2);
  };
  if (item.spawnType || id === "egg") {
    const [base, spots] = item.spawnType
      ? spawnEggPalette(item.spawnType, item.color)
      : ["#e7dbc2", "#b6a78c"];
    let seed = 0;
    for (const ch of item.spawnType || id)
      seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rows = [
      "      xxxx      ",
      "     xxxxxx     ",
      "    xxxxxxxx    ",
      "    xxxxxxxx    ",
      "   xxxxxxxxxx   ",
      "   xxxxxxxxxx   ",
      "  xxxxxxxxxxxx  ",
      "  xxxxxxxxxxxx  ",
      "  xxxxxxxxxxxx  ",
      "  xxxxxxxxxxxx  ",
      "   xxxxxxxxxx   ",
      "    xxxxxxxx    ",
      "     xxxxxx     ",
    ];
    rows.forEach((row, y) =>
      [...row].forEach((on, x) => {
        if (on !== "x") return;
        const edge =
          row[x - 1] !== "x" || row[x + 1] !== "x" || y === rows.length - 1;
        const spot =
          ((Math.imul(Math.floor(x / 2) + seed, 374761393) ^
            Math.imul(Math.floor(y / 2) + seed, 668265263)) >>>
            0) %
            13 <
          (item.spawnType ? 4 : 1);
        px(
          edge
            ? tint(base, 0.65)
            : spot
              ? spots
              : x < 6 && y < 7
                ? tint(base, 1.12)
                : base,
          x,
          y + 1,
        );
      }),
    );
    px("#fff2dd", 5, 4, 1, 2);
    return true;
  }
  if (item.block !== undefined || item.armorSlot !== undefined || item.tool)
    return false;
  if (["compass", "clock"].includes(id)) {
    const gold = id === "clock";
    px(gold ? "#9d762f" : "#4a555d", 4, 1, 8, 14);
    px(gold ? "#cba74c" : "#8b9da7", 2, 3, 12, 10);
    px(gold ? "#ecd579" : "#ced8d6", 3, 2, 10, 12);
    px("#354959", 4, 4, 8, 8);
    if (gold) {
      px("#91c6d1", 4, 4, 8, 4);
      px("#e6c455", 6, 5, 3, 3);
      px("#dcd8c6", 10, 10, 1, 1);
    } else {
      px("#c64d50", 7, 4, 2, 4);
      px("#e4e5da", 7, 8, 2, 4);
      px("#f0bdb0", 7, 4, 1, 2);
    }
    return true;
  }
  if (id === "milk_bucket") {
    px("#46565e", 3, 3, 10, 3);
    px("#bdcbd0", 3, 5, 10, 7);
    px("#82969e", 4, 11, 8, 2);
    px("#d9e1df", 5, 13, 6, 1);
    px("#f4efdd", 4, 5, 8, 3);
    px("#f7fbf3", 4, 8, 1, 3);
    return true;
  }
  if (
    /^(redstone|glowstone_dust|sugar|blaze_powder|dye)$/.test(id) ||
    id.endsWith("_dye")
  ) {
    const c =
      id === "redstone" ? "#a52632" : /sugar/.test(id) ? "#e3e4cf" : item.color;
    for (let i = 0; i < 16; i++) {
      const x = 2 + ((i * 7) % 11),
        y = 5 + ((i * 5) % 8);
      px(i % 3 ? c : tint(c, 1.3), x, y, 2, 2);
    }
    return true;
  }
  if (/nugget|slime_ball|magma_cream|clay_ball|snowball/.test(id)) {
    const c =
      id === "snowball"
        ? "#d9eaf0"
        : id === "slime_ball"
          ? "#7dac59"
          : item.color;
    px(tint(c, 0.65), 5, 3, 6, 11);
    px(c, 3, 5, 10, 7);
    px(c, 5, 3, 6, 11);
    px(tint(c, 1.22), 5, 5, 3, 2);
    return true;
  }
  if (
    /diamond|emerald|amethyst_shard|quartz|prismarine_shard|echo_shard/.test(id)
  ) {
    const c = item.color;
    for (let y = 2; y < 14; y++) {
      const half = y < 6 ? y - 1 : Math.max(1, Math.ceil((14 - y) / 2));
      for (let x = 8 - half; x <= 7 + half; x++)
        px(x < 7 ? tint(c, 1.2) : x > 9 ? tint(c, 0.7) : c, x, y);
    }
    px(tint(c, 1.5), 6, 4, 2, 2);
    return true;
  }
  return false;
}
