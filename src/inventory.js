import {
  ingredientMatches,
  allocateIngredients,
  recipeNeeds,
} from "./recipe-ingredients.js";
import { EDITION_REMAINDERS } from "./edition-data.js";
import { wear, enchantLevel } from "./equipment.js";
import { cloneState } from "./compat.js";
import { ITEMS, RECIPES, makeStack } from "./data.js";
export const compatible = (a, b) =>
  a &&
  b &&
  a.id === b.id &&
  a.durability === b.durability &&
  a.origin === b.origin &&
  JSON.stringify(a.mapTarget || null) === JSON.stringify(b.mapTarget || null) &&
  JSON.stringify(a.fishData || null) === JSON.stringify(b.fishData || null) &&
  JSON.stringify(Object.entries(a.enchantments || {}).sort()) ===
    JSON.stringify(Object.entries(b.enchantments || {}).sort());
export class Inventory {
  constructor(saved) {
    this.slots = Array.from({ length: 36 }, (_, i) =>
      saved?.slots?.[i] ? cloneState(saved.slots[i]) : null,
    );
    this.craft = Array.from({ length: 9 }, (_, i) =>
      saved?.craft?.[i] ? cloneState(saved.craft[i]) : null,
    );
    this.cursor = saved?.cursor ? cloneState(saved.cursor) : null;
    this.offhand = [saved?.offhand?.[0] ? cloneState(saved.offhand[0]) : null];
    this.selected = saved?.selected || 0;
    this.stationRecipe =
      typeof saved?.stationRecipe === "string" ? saved.stationRecipe : null;
    this.equipment = Array.from({ length: 4 }, (_, i) =>
      saved?.equipment?.[i] ? cloneState(saved.equipment[i]) : null,
    );
  }
  get held() {
    return this.slots[this.selected];
  }
  add(stack) {
    if (!ITEMS[stack.id]) return stack.count;
    let left = stack.count,
      max = ITEMS[stack.id].stack;
    for (let i = 0; i < 36 && left; i++)
      if (compatible(this.slots[i], stack)) {
        const n = Math.min(left, max - this.slots[i].count);
        this.slots[i].count += n;
        left -= n;
      }
    for (let i = 0; i < 36 && left; i++)
      if (!this.slots[i]) {
        const n = Math.min(left, max);
        this.slots[i] = { ...stack, count: n };
        left -= n;
      }
    return left;
  }
  consume(slot = this.selected, count = 1) {
    const s = this.slots[slot];
    if (!s || s.count < count) return false;
    s.count -= count;
    if (!s.count) this.slots[slot] = null;
    return true;
  }
  damageTool() {
    if (wear(this.held)) this.slots[this.selected] = null;
  }
  click(array, index, right = false) {
    const slot = array[index];
    if (!this.cursor) {
      if (!slot) return;
      const n = right ? Math.ceil(slot.count / 2) : slot.count;
      this.cursor = { ...slot, count: n };
      slot.count -= n;
      if (!slot.count) array[index] = null;
      return;
    }
    if (!slot) {
      const n = right ? 1 : this.cursor.count;
      array[index] = { ...this.cursor, count: n };
      this.cursor.count -= n;
    } else if (compatible(slot, this.cursor)) {
      const n = Math.min(
        right ? 1 : this.cursor.count,
        ITEMS[slot.id].stack - slot.count,
      );
      slot.count += n;
      this.cursor.count -= n;
    } else if (!right) {
      array[index] = this.cursor;
      this.cursor = slot;
    }
    if (this.cursor?.count === 0) this.cursor = null;
  }
  transfer(source, index, target) {
    const s = source[index];
    if (!s) return;
    let left = s.count;
    const max = ITEMS[s.id].stack;
    for (let i = 0; i < target.length && left; i++) {
      if (source === target && index === i) continue;
      if (compatible(target[i], s)) {
        const n = Math.min(left, max - target[i].count);
        target[i].count += n;
        left -= n;
      }
    }
    for (let i = 0; i < target.length && left; i++) {
      if (source === target && index === i) continue;
      if (!target[i]) {
        const n = Math.min(left, max);
        target[i] = { ...s, count: n };
        left -= n;
      }
    }
    if (left) source[index] = { ...s, count: left };
    else source[index] = null;
  }
  recipe(size = 2, station = "personal") {
    return matchRecipe(this.craft, size, station, this.stationRecipe);
  }
  craftOne(size = 2, station = "personal") {
    const r = this.recipe(size, station);
    if (!r) return false;
    let output = makeStack(r.result, r.count);
    if (r.station === "smithing_table") {
      const base = this.craft.find((s) => s?.id.startsWith("diamond_"));
      if (!base) return false;
      output = {
        ...cloneState(base),
        id: r.result,
        count: 1,
        durability:
          ITEMS[r.result].durability -
          Math.max(0, ITEMS[base.id].durability - base.durability),
      };
    }
    if (
      this.cursor &&
      (!compatible(this.cursor, output) ||
        this.cursor.count + r.count > ITEMS[r.result].stack)
    )
      return false;
    // Check all remainders before committing output or consuming any input.
    const trial = new Inventory(this.export());
    if (trial.cursor) trial.cursor.count += r.count;
    else trial.cursor = output;
    for (let i = 0; i < size * size; i++)
      if (trial.craft[i]) {
        const remainder = EDITION_REMAINDERS[trial.craft[i].id];
        trial.craft[i].count--;
        if (!trial.craft[i].count) trial.craft[i] = null;
        if (remainder) {
          const stack = makeStack(remainder);
          if (!trial.craft[i]) trial.craft[i] = stack;
          else if (trial.add(stack)) return false;
        }
      }
    this.cursor = trial.cursor;
    this.craft = trial.craft;
    this.slots = trial.slots;
    return true;
  }
  autofill(recipe, size = 2) {
    if (
      !recipe ||
      ![2, 3].includes(size) ||
      (recipe.pattern &&
        (recipe.pattern.length > size ||
          recipe.pattern.some((row) => row.length > size))) ||
      (recipe.ingredients && recipe.ingredients.length > size * size)
    )
      return "This recipe needs a crafting table.";
    // A matching grid is already ready; leave large stacks and their metadata
    // in place instead of trying to squeeze them back into a full inventory.
    if (
      recipe.id &&
      this.recipe(size, recipe.station || (size === 3 ? "table" : "personal"))
        ?.id === recipe.id
    )
      return null;
    const trial = new Inventory(this.export());
    // Reserve ingredients from the grid first, then carried slots. Returning
    // leftovers AFTER reservation lets consumed stacks free the required room.
    const sources = [...trial.craft, ...trial.slots];
    const selected = allocateIngredients(recipeNeeds(recipe), sources);
    if (!selected)
      return "You do not have all the ingredients for this recipe.";
    const taken = selected.map((id) => {
      const i = sources.findIndex((s) => s?.id === id && s.count > 0);
      const stack = cloneState({ ...sources[i], count: 1 });
      if (!--sources[i].count) sources[i] = null;
      return stack;
    });
    trial.slots = sources.slice(9);
    trial.craft = Array(9).fill(null);
    for (const stack of sources.slice(0, 9))
      if (stack && trial.add(stack))
        return "Make room in your inventory first.";
    let next = 0;
    if (recipe.ingredients)
      recipe.ingredients.forEach((_, i) => (trial.craft[i] = taken[next++]));
    else
      recipe.pattern.forEach((row, y) =>
        [...row].forEach((c, x) => {
          if (recipe.key[c]) trial.craft[y * size + x] = taken[next++];
        }),
      );
    trial.stationRecipe = recipe.station ? recipe.id : null;
    Object.assign(this, trial);
    return null;
  }
  canAutofill(recipe, size = 2) {
    return new Inventory(this.export()).autofill(recipe, size) === null;
  }
  export() {
    return {
      slots: this.slots,
      craft: this.craft,
      cursor: this.cursor,
      selected: this.selected,
      stationRecipe: this.stationRecipe,
      equipment: this.equipment,
      offhand: this.offhand,
    };
  }
}
export function matchRecipe(
  grid,
  size,
  station = "personal",
  selection = null,
) {
  const occupied = [];
  let minX = size,
    minY = size,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (grid[y * size + x]) {
        occupied.push(grid[y * size + x].id);
        minX = Math.min(x, minX);
        maxX = Math.max(x, maxX);
        minY = Math.min(y, minY);
        maxY = Math.max(y, maxY);
      }
  if (!occupied.length) return null;
  for (const r of RECIPES) {
    if (r.station === "stonecutter" && r.id !== selection) continue;
    if (
      r.station
        ? r.station !== station
        : !["personal", "table"].includes(station)
    )
      continue;
    if (r.ingredients) {
      if (
        occupied.length === r.ingredients.length &&
        allocateIngredients(
          r.ingredients,
          occupied.map((id) => ({ id, count: 1 })),
        )
      )
        return r;
      continue;
    }
    const w = r.pattern[0].length,
      h = r.pattern.length;
    if (w !== maxX - minX + 1 || h !== maxY - minY + 1) continue;
    for (const flip of [false, true]) {
      let valid = true;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const c = r.pattern[y][flip ? w - 1 - x : x],
            need = r.key[c] || null,
            actual = grid[(minY + y) * size + minX + x]?.id || null;
          if (
            need === null ? actual !== null : !ingredientMatches(need, actual)
          )
            valid = false;
        }
      if (valid) return r;
    }
  }
  return null;
}
export function miningTicks(
  block,
  held,
  inWater = false,
  airborne = false,
  helmet = null,
) {
  if (block.hardness === Infinity) return Infinity;
  if (block.hardness === 0) return 1;
  const item = ITEMS[held?.id],
    correct = !!block.tool && item?.tool === block.tool,
    canHarvest = !block.tier || (correct && item.tier >= block.tier);
  let speed = correct ? item.speed : 1;
  if (correct && speed > 1) {
    const level = enchantLevel(held, "efficiency");
    if (level) speed += level * level + 1;
  }
  if (inWater && !enchantLevel(helmet, "aqua_affinity")) speed /= 5;
  if (airborne) speed /= 5;
  return Math.ceil((block.hardness * (canHarvest ? 30 : 100)) / speed);
}
export function canHarvest(block, held) {
  return (
    !block.tier ||
    (ITEMS[held?.id]?.tool === block.tool &&
      ITEMS[held?.id]?.tier >= block.tier)
  );
}
