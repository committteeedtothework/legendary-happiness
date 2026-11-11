import { paintSkinPixel, GLOVE_STYLES } from "./skin-pixels.js";
export const SKINS = {
  devin: {
    name: "Devin The Hero",
    story: "A fine emerald tunic, gilded belt, and a knowing smirk.",
    skin: "#c79b77",
    shirt: "#2e735a",
    trousers: "#4b3b31",
    hair: "#4a3026",
    accent: "#e4bd62",
    style: "devin",
  },
  stargazer: {
    name: "Moonwalker",
    story: "A pale flight suit and a midnight-blue visor.",
    skin: "#a9cde0",
    shirt: "#d4d8d5",
    trousers: "#586779",
    hair: "#25394e",
    accent: "#6ed5d9",
    style: "astronaut",
  },
  ranger: {
    name: "Moss Ranger",
    story: "A hood, a satchel, and boots for the long way home.",
    skin: "#a57455",
    shirt: "#526444",
    trousers: "#3d4737",
    hair: "#31352a",
    accent: "#cf9a5e",
    style: "ranger",
  },
  smith: {
    name: "Cinder Smith",
    story: "A leather apron, copper goggles, and warm forge light.",
    skin: "#79513d",
    shirt: "#6b4242",
    trousers: "#343943",
    hair: "#24232a",
    accent: "#dba467",
    style: "smith",
  },
  tidekeeper: {
    name: "Tidekeeper",
    story: "A striped ocean coat with a bright coral sash.",
    skin: "#d6ab88",
    shirt: "#3a7d94",
    trousers: "#324553",
    hair: "#203b4c",
    accent: "#ec9476",
    style: "sailor",
  },
  explorer: {
    name: "Explorer",
    story: "Boots dusty. Pockets full of possibility.",
    skin: "#bd906c",
    shirt: "#376c71",
    trousers: "#424e54",
    hair: "#493725",
    accent: "#ddb65d",
    style: "scarf",
  },
  clown: {
    name: "Carnival Clown",
    story: "A bright patchwork suit and a very red nose.",
    skin: "#f1dfc4",
    shirt: "#ad4155",
    trousers: "#426a96",
    hair: "#db7940",
    accent: "#e8c65b",
    style: "clown",
  },
  hero: {
    name: "Trail Hero",
    story: "A mountain crest for a wandering defender.",
    skin: "#a97753",
    shirt: "#31588a",
    trousers: "#303d55",
    hair: "#302b29",
    accent: "#e4bc54",
    style: "hero",
  },
  criminal: {
    name: "Bandit",
    story: "Striped coat, black gloves, midnight adventures.",
    skin: "#c49370",
    shirt: "#d1c9b7",
    trousers: "#46434c",
    hair: "#292932",
    accent: "#635968",
    style: "bandit",
  },
  dante: {
    name: "Dante",
    story:
      "DMC3-inspired: silver hair, an open crimson coat, and a devilish grin.",
    skin: "#dfbba2",
    shirt: "#9d2636",
    trousers: "#262630",
    hair: "#e4e5e8",
    accent: "#c9cbd1",
    style: "dante",
  },
  vergil: {
    name: "Vergil",
    story:
      "DMC3-inspired: swept silver hair, a blue long coat with silver embroidery, black gloves and a sheathed katana.",
    skin: "#dfbba2",
    shirt: "#254b83",
    trousers: "#252b38",
    hair: "#e3e7ee",
    accent: "#c6d8e6",
    style: "vergil",
  },
};
export const skinFor = (id) => SKINS[id] || SKINS.explorer;
// The same costume palette and hand proportions serve F5 and first person.
// Glove distances are measured from the fingertips along the 0.6-unit F5 arm.
const ARM_APPEARANCES = Object.fromEntries(
  Object.entries(SKINS).map(([id, s]) => [
    id,
    Object.freeze({
      id,
      skin: s.skin,
      sleeve: s.shirt,
      handLength: 0.18,
      glove: GLOVE_STYLES[s.style] || null,
    }),
  ]),
);
export const armAppearanceFor = (id) =>
  ARM_APPEARANCES[id] || ARM_APPEARANCES.explorer;
// The small wardrobe portraits use the exact front texels of the 3D outfit.
export function skinPreview(id) {
  const s = skinFor(id),
    rects = [];
  const part = (name, x, y, w, h, side = 1) => {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++)
        rects.push(
          `<rect x="${x + i}" y="${y + j}" width="1" height="1" fill="${paintSkinPixel(s, name, 5, i, j, w, h, side)}"/>`,
        );
  };
  if (["dante", "vergil"].includes(s.style))
    for (const x of [3, 12])
      rects.push(
        `<rect x="${x}" y="20" width="1" height="11" fill="${s.shirt}"/>`,
      );
  part("head", 4, 0, 8, 8);
  part("body", 4, 8, 8, 12);
  part("arm", 0, 8, 4, 12, 1);
  part("arm", 12, 8, 4, 12, -1);
  part("leg", 4, 20, 4, 12, 1);
  part("leg", 8, 20, 4, 12, -1);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="144" viewBox="0 0 16 32" shape-rendering="crispEdges" aria-label="${s.name}">${rects.join("")}</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
