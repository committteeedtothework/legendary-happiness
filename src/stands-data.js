export const PALM_DEFAULTS = Object.freeze({
  rarity: 0.12,
  relocationDays: 5,
  trialSeconds: 60,
  awakening: 35,
  death: 50,
  neutral: 15,
  pity: true,
  pityRate: 2,
  activeCount: 1,
  corpseChance: 2,
  allowReplacement: false,
  creativeDeath: false,
});
export const STAND_KEYS = Object.freeze({
  summon: "KeyH",
  primary: "KeyF",
  secondary: "KeyG",
  info: "KeyV",
});
export const STAND_KEY_CHOICES = [
  "KeyH",
  "KeyF",
  "KeyG",
  "KeyV",
  "KeyB",
  "KeyN",
  "KeyM",
  "KeyK",
  "KeyL",
  "KeyU",
  "KeyI",
  "KeyO",
  "KeyP",
];
export const STANDS = Object.freeze({
  tusk: {
    name: "Tusk",
    color: "#efadc3",
    accent: "#fbecd3",
    form: "imp",
    description:
      "Spinning nails strike visible foes. A compact, armored spirit follows your shoulder.",
    primary: {
      name: "Spin Nail",
      cost: 12,
      cooldown: 12,
      damage: 6,
      range: 24,
      description: "Fire one spinning nail; solid blocks stop it.",
    },
    secondary: {
      name: "Golden Volley",
      cost: 32,
      cooldown: 100,
      damage: 4,
      range: 20,
      description: "Fire a fan of three nails.",
    },
  },
  lonesome: {
    name: "Oh! Lonesome Me",
    color: "#ce9b58",
    accent: "#e6e1ca",
    form: "rope",
    description:
      "Rope-linked hands retrieve loose items and reach distant doors, or pull you toward a solid ledge.",
    primary: {
      name: "Rope Hand",
      cost: 14,
      cooldown: 40,
      damage: 0,
      range: 12,
      description: "Retrieve visible drops or toggle a distant door.",
    },
    secondary: {
      name: "Lasso Traverse",
      cost: 24,
      cooldown: 120,
      damage: 0,
      range: 12,
      description:
        "Pull toward a targeted solid surface. Walls and wards block the whole path.",
    },
  },
  monsters: {
    name: "Scary Monsters",
    color: "#4f8f9a",
    accent: "#dbca79",
    form: "dinosaur",
    description:
      "A temporary, low-slung dinosaur form with a wider collision body, faster movement and stronger melee.",
    primary: {
      name: "Saurian Form",
      cost: 35,
      cooldown: 400,
      damage: 0,
      range: 0,
      description:
        "Transform for 15 seconds: ×1.35 speed and ×1.5 melee. Requires room for the wider body.",
    },
    secondary: {
      name: "Predator Roar",
      cost: 24,
      cooldown: 140,
      damage: 5,
      range: 4,
      description:
        "A close-range shockwave knocks back visible hostile creatures.",
    },
  },
  cream: {
    name: "Cream Starter",
    color: "#d889a1",
    accent: "#f7e4bf",
    form: "spray",
    description:
      "A repair mist restores living tissue. Healing cannot exceed maximum health or revive the dead.",
    primary: {
      name: "Repair Mist",
      cost: 30,
      cooldown: 180,
      damage: 0,
      range: 0,
      description: "Restore four health points to yourself.",
    },
    secondary: {
      name: "Helping Hand",
      cost: 35,
      cooldown: 200,
      damage: 0,
      range: 4,
      description:
        "Heal a visible teammate or passive animal by four health points.",
    },
  },
  d4c: {
    name: "D4C",
    color: "#d7e5ef",
    accent: "#b77fc7",
    form: "rabbit",
    description:
      "Fold nearby space between paired rifts. Existing walls, sealed arenas and protected areas remain barriers.",
    primary: {
      name: "Fold Step",
      cost: 30,
      cooldown: 120,
      damage: 0,
      range: 9,
      description:
        "Move through clear space, up to nine blocks. Leave a return rift for five seconds.",
    },
    secondary: {
      name: "Return Fold",
      cost: 18,
      cooldown: 80,
      damage: 0,
      range: 12,
      description:
        "Return to your recent rift if its entire path is still safe.",
    },
  },
});
const limits = {
  rarity: [0, 1],
  relocationDays: [1, 30],
  trialSeconds: [5, 600],
  awakening: [0, 100],
  death: [0, 100],
  neutral: [0, 100],
  pityRate: [0, 20],
  activeCount: [1, 3],
  corpseChance: [0, 100],
};
export function palmConfig(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) input = {};
  const out = { ...PALM_DEFAULTS };
  for (const [key, [min, max]] of Object.entries(limits))
    if (Number.isFinite(Number(input[key])))
      out[key] = Math.min(max, Math.max(min, Number(input[key])));
  for (const key of ["pity", "allowReplacement", "creativeDeath"])
    if (typeof input[key] === "boolean") out[key] = input[key];
  out.activeCount = Math.round(out.activeCount);
  const sum = out.awakening + out.death + out.neutral;
  if (sum <= 0) Object.assign(out, { awakening: 35, death: 50, neutral: 15 });
  else {
    out.awakening = (out.awakening / sum) * 100;
    out.death = (out.death / sum) * 100;
    out.neutral = 100 - out.awakening - out.death;
  }
  return out;
}
export function fateWeights(config, failures = 0) {
  const c = palmConfig(config),
    bonus = c.pity ? Math.min(20, Math.max(0, failures) * c.pityRate) : 0;
  const awakening = Math.min(100, c.awakening + bonus),
    rest = c.death + c.neutral;
  const death = rest ? ((100 - awakening) * c.death) / rest : 0;
  return { awakening, death, neutral: 100 - awakening - death };
}
export function selectFate(value, weights) {
  return value * 100 < weights.awakening
    ? "stand"
    : value * 100 < weights.awakening + weights.death
      ? "death"
      : "neutral";
}
export function standBindings(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) input = {};
  const out = {},
    used = new Set();
  for (const [key, defaultKey] of Object.entries(STAND_KEYS)) {
    const candidate =
      STAND_KEY_CHOICES.includes(input[key]) && !used.has(input[key])
        ? input[key]
        : !used.has(defaultKey)
          ? defaultKey
          : STAND_KEY_CHOICES.find((k) => !used.has(k));
    out[key] = candidate;
    used.add(candidate);
  }
  return out;
}
export const STAND_ARTIFACTS = {
  saint_corpse_part: {
    name: "Saint's Corpse Part",
    energyBonus: 10,
    description:
      "A sun-bleached relic in a golden reliquary. Carry one for +10 maximum Stand energy; extra parts do not stack.",
  },
};
