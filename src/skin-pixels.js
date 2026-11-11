import { pixelShade } from "./pixel-surfaces.js";
export const GLOVE_STYLES = Object.freeze({
  dante: Object.freeze({ color: "#272630", start: 0.0525, end: 0.1675 }),
  vergil: Object.freeze({ color: "#222938", start: 0.035, end: 0.185 }),
  bandit: Object.freeze({ color: "#37343b", start: 0, end: 0.1 }),
});
export function paintSkinPixel(s, part, face, x, y, w, h, side = 1) {
  const front = face === 5,
    back = face === 4;
  if (part === "arm") {
    if (face === 2) return s.shirt;
    if (face === 3)
      return GLOVE_STYLES[s.style]?.start === 0
        ? GLOVE_STYLES[s.style].color
        : s.skin;
    const skin = y >= 9;
    let c = skin ? s.skin : s.shirt;
    if (!skin) {
      if (["sailor", "bandit"].includes(s.style) && y % 3 === 1)
        c = s.style === "sailor" ? "#d5ddd2" : "#494652";
      if (s.style === "vergil" && (x === 0 || x === 3) && y < 8) c = s.accent;
      if (s.style === "dante" && y === 7) c = "#6c2434";
      if (s.style === "clown" && side < 0 && y > 3 && y < 7) c = "#426a96";
      if (s.style === "hero" && y === 2) c = s.accent;
      if (s.style === "astronaut" && y === 7) c = s.accent;
      if (s.style === "smith" && y === 6) c = "#543334";
    }
    const g = GLOVE_STYLES[s.style];
    const distance = (12 - y - 0.5) * (0.675 / 12);
    if (g && distance >= g.start && distance <= g.end) c = g.color;
    return c;
  }
  let c = part === "head" ? s.skin : part === "body" ? s.shirt : s.trousers;
  if (part === "head") {
    const sideFace = face === 0 || face === 1;
    const fromFront = face === 0 ? w - 1 - x : x;
    if (
      face === 2 ||
      (face !== 3 && (y < 2 || back || (sideFace && fromFront > 1 && y < 6)))
    )
      c = s.hair;
    if (sideFace && y === 4 && fromFront === 1) c = pixelShade(s.skin, 0.9);
    if (front) {
      if (y === 2 && (x === 0 || (s.style === "dante" && x === 5))) c = s.hair;
      if (y === 4 && [1, 2, 5, 6].includes(x))
        c = [2, 5].includes(x)
          ? {
              devin: "#426b51",
              hero: "#8a6a37",
              ranger: "#4d6942",
              smith: "#4d7384",
              sailor: "#385f83",
              scarf: "#596f74",
              clown: "#3e5475",
              bandit: "#65585b",
              dante: "#738fbd",
              vergil: "#648b9d",
            }[s.style] || "#616688"
          : "#ece9dd";
      if (y === 5 && [3, 4].includes(x)) c = pixelShade(s.skin, 0.88);
      if (y === 6 && [3, 4].includes(x)) c = pixelShade(s.skin, 0.63);
      if (["devin", "dante"].includes(s.style) && x === 5 && y === 5)
        c = pixelShade(s.skin, 0.63);
      if (s.style === "bandit" && y === 3) c = "#494652";
      if (s.style === "clown") {
        if (y === 5 && [3, 4].includes(x)) c = "#d94341";
        if (y === 6 && [2, 5].includes(x)) c = "#a1374b";
        if (y === 4 && [0, 7].includes(x)) c = "#da8174";
      }
      if (s.style === "smith" && y >= 3 && y <= 4 && x > 0 && x < 7)
        c = [2, 5].includes(x) ? "#4d7384" : s.accent;
    }
    if (s.style === "astronaut") {
      c = s.shirt;
      if (front && y >= 2 && y <= 5 && x > 0 && x < 7)
        c = y === 2 && x < 4 ? s.accent : "#25394e";
    }
    if (s.style === "ranger" && (face !== 5 || x === 0 || x === 7 || y < 2))
      c = s.shirt;
    if (s.style === "vergil" && front && y < 3) c = s.hair;
    return c;
  }
  if (part === "leg") {
    if (s.style === "clown" && side < 0 && y < 10) c = s.shirt;
    if (y > 9 || face === 3)
      c = ["dante", "vergil"].includes(s.style)
        ? "#252630"
        : s.style === "astronaut"
          ? "#43536a"
          : "#302e32";
    if (y === 0) c = "#393139";
    if ((front || back) && y === 4 && x === 0) c = "#4d4950";
    if (["dante", "vergil"].includes(s.style) && y > 7) c = "#252630";
    if (s.style === "dante" && y === 8) c = s.accent;
    if (s.style === "clown" && front && x < 2 && y > 3 && y < 6) c = s.shirt;
    if (s.style === "astronaut" && y === 8) c = s.accent;
    return c;
  }
  if (face === 2) return s.shirt;
  if (back) {
    if (
      ["devin", "vergil"].includes(s.style) &&
      y > 1 &&
      y < 8 &&
      [3, 4].includes(x)
    )
      c = s.accent;
    if (s.style === "dante" && x === 3 && y > 2 && y < 10) c = "#742735";
    if (s.style === "smith" && y === 4) c = "#a46b42";
    if (s.style === "scarf" && y < 3 && x > 2 && x < 6) c = s.accent;
  }
  if (front && y === 0 && x >= 3 && x <= 4) c = s.skin;
  switch (s.style) {
    case "devin":
      if (front && y < 3 && x > 1 && x < 6 && Math.abs(x - 3.5) < (3 - y) / 2)
        c = "#dfd2ac";
      if (front && (x === 0 || x === 7) && y < 9) c = s.accent;
      if (y === 9) c = "#604532";
      if (front && y === 9 && x >= 3 && x <= 4) c = s.accent;
      break;
    case "dante":
      if (front && x >= 2 && x <= 5 && y < 9) c = s.skin;
      if (
        front &&
        y > 1 &&
        y < 7 &&
        (x === Math.floor(y / 2) + 1 || x === 6 - Math.floor(y / 2))
      )
        c = "#39323a";
      if (front && y < 4 && (x === 1 || x === 6)) c = "#c0444b";
      if (y === 10) c = "#292833";
      if (front && y === 10 && x === 3) c = s.accent;
      break;
    case "vergil":
      if (front && x >= 3 && x <= 4) c = "#222938";
      if (
        front &&
        (x === 2 || x === 5 || (y % 3 === 1 && (x === 1 || x === 6)))
      )
        c = s.accent;
      break;
    case "astronaut":
      if (front && x > 1 && x < 6 && y > 2 && y < 7) c = "#43536a";
      if (front && y === 4 && [2, 4].includes(x)) c = s.accent;
      if (y === 9) c = "#586779";
      break;
    case "ranger":
      if (front && Math.abs(x - y * 0.6) < 1) c = s.accent;
      if (front && x > 4 && y > 7) c = "#79553e";
      if (back) c = "#394d38";
      break;
    case "smith":
      if (front && y > 2 && x > 0 && x < 7) c = "#a46b42";
      if (front && y === 7 && x > 1 && x < 6) c = "#764a37";
      if (front && y < 3 && [1, 6].includes(x)) c = s.accent;
      break;
    case "sailor":
      if (y % 3 === 1) c = "#d5ddd2";
      if (y === 9) c = s.accent;
      break;
    case "clown":
      if (front && y > 1 && [3, 4].includes(x) && y % 3 === 0) c = s.accent;
      if (front && y === 1 && x > 0 && x < 7) c = s.accent;
      if (front && y > 7 && x < 2) c = "#426a96";
      break;
    case "bandit":
      if (y % 3 === 1) c = "#494652";
      break;
    case "hero":
      if (front && y > 1 && y < 6 && Math.abs(x - 3.5) < (6 - y) * 0.65)
        c = s.accent;
      if (back && y > 0) c = "#913c47";
      if (y === 10) c = "#283344";
      break;
    default:
      if (front && y < 3 && x > 1 && x < 6) c = s.accent;
      if (front && x === 3 && y >= 3 && y < 7) c = s.accent;
      if (front && y > 7 && [1, 6].includes(x)) c = "#294b50";
  }
  return c;
}
