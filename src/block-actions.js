import { playWorldSound } from "./spatial-audio.js";
import { B, makeStack } from "./data.js";
import { fluid, igniteBlock, primeTnt } from "./block-dynamics.js";
import { ignitePortal } from "./portals.js";
// Returns true for a handled tool, even when no valid operation is available.
export function useBucket(game) {
  const held = game.inventory.held;
  if (!/^(water_|lava_)?bucket$/.test(held?.id || "")) return false;
  const p = game.player,
    w = game.world;
  const t = w.raycast(
    { x: p.x, y: p.y + 1.62 - (p.crouching ? 0.27 : 0), z: p.z },
    game.direction(),
    game.mode === "creative" ? 5 : 4.5,
    false,
    held.id === "bucket",
  );
  if (!t) return true;
  let next;
  if (held.id === "bucket") {
    const f = fluid(w.get(t.x, t.y, t.z));
    if (!f?.source) return true;
    if (!w.set(t.x, t.y, t.z, B.air)) return true;
    next = `${f.type}_bucket`;
  } else {
    const x = t.x + t.normal.x,
      y = t.y + t.normal.y,
      z = t.z + t.normal.z;
    const id = w.get(x, y, z),
      f = fluid(id),
      type = held.id === "water_bucket" ? "water" : "lava";
    if (id !== B.air && id !== B.fire && !f) return true;
    if (f?.source && f.type === type) return true;
    if (f && f.type !== type) {
      // Pouring water onto lava creates rock without destroying the water source
      // in a neighboring cell; pouring lava into water produces stone.
      w.set(
        x,
        y,
        z,
        type === "water" ? (f.source ? B.obsidian : B.cobble) : B.stone,
      );
    } else if (type === "water" && w.dimension === "cinderwild")
      playWorldSound(game, "fizz", t);
    else if (!w.set(x, y, z, B[type])) return true;
    next = "bucket";
  }
  // Buckets have stack size one: replacing the selected slot is atomic and cannot
  // spill a filled bucket into a full inventory or duplicate the original source.
  if (game.mode !== "creative" || held.id === "bucket")
    game.inventory.slots[game.inventory.selected] = makeStack(next);
  playWorldSound(game, "bucket", t);
  game.renderer?.action("use");
  game.ui?.updateHotbar();
  return true;
}
export function useFlintAndSteel(game, target = game.target) {
  if (game.inventory.held?.id !== "flint_and_steel") return false;
  if (!target) return true;
  const w = game.world,
    t = target;
  const portal = t.id === B.obsidian ? ignitePortal(w, t) : null;
  const success =
    portal ||
    (t.id === B.tnt
      ? primeTnt(w, t.x, t.y, t.z)
      : igniteBlock(w, t.x + t.normal.x, t.y + t.normal.y, t.z + t.normal.z));
  if (success) {
    if (game.mode !== "creative") game.inventory.damageTool();
    game.renderer?.action("use");
    playWorldSound(game, t.id === B.tnt ? "fuse" : "ignite", t);
    game.ui?.updateHotbar();
    if (portal)
      game.ui?.toast(
        "Portal lit. Step into the violet field and stay inside to travel.",
        5000,
      );
  }
  return true;
}
