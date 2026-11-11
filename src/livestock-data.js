// Overworld farm animals only. Existing custom realms and their creatures are unchanged.
export const FARM_FOODS = {
  cow: ["wheat"],
  woolling: ["wheat"],
  grazer: ["carrot", "potato", "beetroot"],
  chicken: ["seeds", "beetroot_seeds", "melon_seeds", "pumpkin_seeds"],
  rabbit: ["carrot", "golden_carrot", "dandelion"],
};
export const farmScale = (e) => (e.baby && FARM_FOODS[e.type] ? 0.5 : 1);
export const FARM_GROW_TICKS = 24000;
export const FARM_BREED_COOLDOWN = 6000;
