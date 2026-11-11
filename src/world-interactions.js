import { B, BLOCKS } from "./data.js";
export const interactionKey = (t) => `${t.x},${t.y},${t.z}`;
export function canOpenChest(world, t) {
  return (
    !!t &&
    world.get(t.x, t.y, t.z) === B.chest &&
    !BLOCKS[world.get(t.x, t.y + 1, t.z)]?.solid
  );
}
export function menuStillValid(game, menu, player = game.player) {
  const t = menu?.target;
  if (!t) return true;
  return (
    game.world.get(t.x, t.y, t.z) === t.id &&
    (!menu.container ||
      game.world.containers[interactionKey(t)] === menu.container) &&
    Math.hypot(
      t.x + 0.5 - player.x,
      t.y + 0.5 - player.y,
      t.z + 0.5 - player.z,
    ) <= 6 &&
    (t.id !== B.chest || canOpenChest(game.world, t))
  );
}
export function validateLocalContainerMenu(game) {
  const ui = game.ui;
  if (
    game.multiplayer?.isGuest ||
    ui?.screen !== "inventory" ||
    !ui.containerTarget
  )
    return true;
  if (
    menuStillValid(game, {
      target: ui.containerTarget,
      container: ui.container,
    })
  )
    return true;
  game.closeInventory();
  ui.toast?.("That container is no longer accessible.");
  return false;
}
export function openChestKeys(game) {
  const keys = new Set(
    game.multiplayer?.isGuest ? game.sharedBlockVisuals?.openChests || [] : [],
  );
  if (
    game.ui?.screen === "inventory" &&
    game.ui.invType === "chest" &&
    game.ui.containerTarget
  )
    keys.add(interactionKey(game.ui.containerTarget));
  if (!game.multiplayer?.isGuest)
    for (const peer of game.multiplayer?.peers?.values?.() || [])
      if (
        peer.menu?.type === "chest" &&
        peer.menu.target &&
        peer.player.health > 0
      )
        keys.add(interactionKey(peer.menu.target));
  return keys;
}
export function worldInteractionSnapshot(game) {
  const blocks = [];
  for (const [key, c] of Object.entries(game.world.containers || {})) {
    const [x, y, z] = key.split(",").map(Number);
    if (
      Math.hypot(x - game.player.x, z - game.player.z) > 96 ||
      !["furnace", "jukebox"].includes(c.type)
    )
      continue;
    blocks.push({
      key,
      burn: c.type === "furnace" ? c.burn || 0 : 0,
      disc: c.type === "jukebox" ? c.slots?.[0]?.id || null : null,
    });
    if (blocks.length >= 64) break;
  }
  return { openChests: [...openChestKeys(game)].slice(0, 32), blocks };
}

// Doors use their original, immediately switched thin block meshes.
export const worldVisualKind = (id) =>
  id === B.chest
    ? "chest"
    : id === B.furnace
      ? "furnace"
      : id === B.enchanting_table
        ? "enchanting_table"
        : id === B.jukebox
          ? "jukebox"
          : null;
