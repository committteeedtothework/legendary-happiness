// Persisted with each world. Missing fields in older saves keep their old behavior.
export const WORLD_RULES = Object.freeze({
  allowSpectating: { label: "Allow Spectating", initial: true, legacy: true },
  pvp: { label: "PvP", initial: true, legacy: false },
  fallDamage: { label: "Fall Damage", initial: true, legacy: true },
  keepInventory: { label: "Keep Inventory", initial: false, legacy: false },
  doDaylightCycle: { label: "Daylight Cycle", initial: true, legacy: true },
  doWeatherCycle: { label: "Weather Cycle", initial: true, legacy: true },
  naturalRegeneration: {
    label: "Natural Regeneration",
    initial: true,
    legacy: true,
  },
  doMobSpawning: { label: "Mob Spawning", initial: true, legacy: true },
  showDeathMessages: { label: "Death Messages", initial: true, legacy: true },
});
const boolean = (v, fallback) =>
  v === undefined ? fallback : v === true || v === "true" || v === "on";
export function normalizeWorldRules(
  raw = {},
  { legacy = true, mode = "survival" } = {},
) {
  const result = { cheats: boolean(raw.cheats, legacy || mode === "creative") };
  for (const [key, def] of Object.entries(WORLD_RULES))
    result[key] = boolean(raw[key], legacy ? def.legacy : def.initial);
  return result;
}
export const ruleEnabled = (g, key) =>
  g.rules?.[key] ?? WORLD_RULES[key]?.legacy ?? false;
export const cheatsEnabled = (g) => g.rules?.cheats !== false;
export function parseRule(key, value) {
  const name = Object.keys(WORLD_RULES).find(
    (k) => k.toLowerCase() === String(key).toLowerCase(),
  );
  if (!name) throw Error("Unknown game rule. Use /gamerule for the list.");
  if (value !== undefined && !["true", "false"].includes(value))
    throw Error("Use true or false.");
  return { name, value: value === undefined ? undefined : value === "true" };
}
