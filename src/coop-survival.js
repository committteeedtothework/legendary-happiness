import { achievementState, recordAchievement, scanAchievements } from "./achievements.js";
import { playerEye } from "./player-body.js";
import { menuStillValid } from "./world-interactions.js";
import { B, BLOCKS, ITEMS, RECIPES, makeStack } from "./data.js";
import { Inventory } from "./inventory.js";
import { createPlayer, updatePlayer, collides } from "./physics.js";
import { miningTicks } from "./inventory.js";
import { reduceDamage } from "./equipment.js";
import { tickPlayerSurvival, dropItem } from "./simulation.js";
import { tickWeatherDamage } from "./weather.js";
import { cloneState } from "./compat.js";

const KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
]);
export function cleanInput(input) {
  if (
    !input ||
    !Number.isFinite(input.yaw) ||
    !Number.isFinite(input.pitch) ||
    Math.abs(input.yaw) > 100000 ||
    Math.abs(input.pitch) > 1.58
  )
    return null;
  return {
    yaw: input.yaw,
    pitch: Math.max(-1.553, Math.min(1.553, input.pitch)),
    keys: Array.isArray(input.keys)
      ? [...new Set(input.keys.filter((k) => KEYS.has(k)))]
      : [],
    sprinting: !!input.sprinting,
    mine: !!input.mine,
    selected:
      Number.isInteger(input.selected) &&
      input.selected >= 0 &&
      input.selected < 9
        ? input.selected
        : 0,
  };
}
export function resumeToken() {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((n) => n.toString(16).padStart(2, "0")).join("");
}
export function closePeerCraft(ctx) {
  for (let i = 0; i < 9; i++) {
    const stack = ctx.inventory.craft[i];
    if (stack) {
      const count = ctx.inventory.add(stack);
      if (count)
        dropItem(
          ctx,
          { ...stack, count },
          ctx.player.x,
          ctx.player.y + 0.5,
          ctx.player.z,
          30,
        );
      ctx.inventory.craft[i] = null;
    }
  }
  const stack = ctx.inventory.cursor;
  if (stack) {
    const count = ctx.inventory.add(stack);
    if (count)
      dropItem(
        ctx,
        { ...stack, count },
        ctx.player.x,
        ctx.player.y + 0.5,
        ctx.player.z,
        30,
      );
    ctx.inventory.cursor = null;
  }
}
export function damagePeer(session, peer, amount, cause, force = false) {
  const ctx = peer.context,
    p = peer.player;
  if (
    (session.game.mode === "creative" && !force) ||
    p.health <= 0 ||
    p.hurt > 0
  )
    return;
  p.health = Math.max(
    0,
    p.health -
      reduceDamage(peer.inventory, amount, cause) *
        (p.effects?.resistance && !/void|starvation/.test(cause)
          ? 1 - Math.min(0.8, p.effects.resistance.level * 0.2)
          : 1),
  );
  p.hurt = 0.5;
  if (!p.health) {
    closePeerCraft(ctx);
    if (!session.game.rules?.keepInventory)
      for (const array of [
        peer.inventory.slots,
        peer.inventory.equipment,
        peer.inventory.offhand,
      ])
        for (let i = 0; i < array.length; i++) {
          if (array[i]) dropItem(ctx, array[i], p.x, p.y + 0.5, p.z, 30);
          array[i] = null;
        }
    if (!session.game.rules?.keepInventory) p.xp = 0;
    peer.keys = new Set();
    peer.mine = false;
    peer.menu = null;
    peer.lastDeath = { x: p.x, y: p.y, z: p.z, cause };
    session.game.chat?.announce(`${peer.name} was lost to ${cause}.`);
  }
}
export function peerContext(session, peer) {
  const g = session.game,
    ctx = Object.create(g);
  Object.assign(ctx, {
    player: peer.player,
    standIdentity: peer.resume,
    standTeleported: () => {
      peer.teleport = true;
    },
    multiplayer: Object.assign(Object.create(session), {
      occupants: () => [g.player, ...session.occupants()],
    }),
    inventory: peer.inventory,
    spawn: peer.spawn,
    audio: { tone() {}, voice() {}, standSound() {} },
    renderer: {
      action() {},
      animator: { reset() {} },
      breakParticles: (...a) => g.renderer.breakParticles(...a),
      pulseEffect: (p) => g.renderer.pulseEffect(p),
      arcane: g.renderer.arcane,
    },
    jukebox: { interact: () => false },
    sprintInput: {
      latched: false,
      reset() {
        this.latched = false;
      },
      stop() {
        this.latched = false;
      },
    },
    damage: (amount, cause, force) =>
      damagePeer(session, peer, amount, cause, force),
    save: () => g.save(),
    closeCraft: () => closePeerCraft(ctx),
    openInventory: (type, container = null, target = null) => {
      if (type === "personal") recordAchievement(ctx,"inventory-open");
      peer.menu = { type, container, target };
      peer.openMenu = true;
    },
    closeInventory: () => {
      closePeerCraft(ctx);
      peer.menu = null;
    },
    openTrade: () => {
      peer.feedback = "Trading is host-only in this Survival beta.";
    },
    openEnchanting: () => {
      peer.feedback = "Enchanting is host-only in this Survival beta.";
    },
    travelDimension: () => {
      peer.feedback = "Close co-op before dimension travel.";
    },
  });
  ctx.ui = {
    game: ctx,
    announce: (title, text) => {
      peer.standAnnouncement = { title, text };
    },
    toast: (message) => {
      peer.feedback = String(message);
    },
    updateHotbar() {},
    updateHUD() {},
    refreshInventory() {},
    transferRange: (...a) => g.ui.transferRange.apply(ctx.ui, a),
  };
  return ctx;
}
export function peerTarget(game, peer, reach = 4.5) {
  const p = peer.player,
    c = Math.cos(p.pitch);
  return game.world.raycast(
    {
      x: p.x,
      y: p.y + playerEye(p),
      z: p.z,
    },
    { x: -Math.sin(p.yaw) * c, y: Math.sin(p.pitch), z: -Math.cos(p.yaw) * c },
    reach,
  );
}
export function stepPeer(session, peer, dt) {
  const g = session.game,
    ctx = peer.context,
    p = peer.player;
  if (g.mode === "creative") return;
  p.flying = false;
  updatePlayer(
    ctx,
    performance.now() - peer.lastPose < 700 ? peer.keys : new Set(),
    dt,
  );
  ctx.target = peerTarget(g, peer);
  const t = ctx.target,
    key = t ? `${t.x},${t.y},${t.z}` : null;
  if (
    !peer.mine ||
    (p.standData?.awakeningUntil || 0) > g.tickCount ||
    p.health <= 0 ||
    performance.now() - peer.lastPose > 700 ||
    !t ||
    BLOCKS[t.id]?.relic ||
    t.id === B.matthew_altar ||
    peer.inventory.held?.id === "matthew_dual_pistols"
  ) {
    peer.mining = 0;
    peer.miningKey = null;
    return;
  }
  if (key !== peer.miningKey) {
    peer.mining = 0;
    peer.miningKey = key;
  }
  if (g.elapsed - (peer.lastBreak ?? -1) < 0.25) return;
  const ticks = miningTicks(
    BLOCKS[t.id],
    peer.inventory.held,
    p.underwater && !p.effects?.conduit_power,
    !p.onGround,
    peer.inventory.equipment?.[0],
  );
  peer.mining = (peer.mining || 0) + (dt * 20) / ticks;
  if (peer.mining >= 1) {
    ctx.breakBlock(t);
    peer.mining = 0;
    peer.lastBreak = g.elapsed;
  }
}
export function tickPeer(session, peer) {
  const g = session.game,
    ctx = peer.context,
    p = peer.player;
  if (g.mode === "creative") return;
  tickPlayerSurvival(ctx);
  tickWeatherDamage(ctx);
  if (p.health > 0)
    for (const d of g.drops) {
      if (
        d.count > 0 &&
        d.delay <= 0 &&
        Math.hypot(d.x - p.x, d.y - p.y - 0.5, d.z - p.z) < 1.7
      )
        d.count = peer.inventory.add(d);
    }
  g.drops = g.drops.filter((d) => d.count > 0);
  if (g.tickCount % 10 === 0) {
    scanAchievements(ctx);
    if ((g.dimension || "overworld") === "overworld")
      recordAchievement(ctx,"biome",{key:g.world.terrain(p.x,p.z).biome});
  }
  if (peer.menu?.target) {
    const t = peer.menu.target;
    if (!menuStillValid(g, peer.menu, p)) {
      closePeerCraft(ctx);
      peer.menu = null;
      peer.closeMenu = true;
    }
  }
}
export function respawnPeer(session, peer) {
  if (peer.player.health > 0) return false;
  const g = session.game,
    point = { ...peer.spawn };
  let clear = false;
  for (let y = point.y; y < point.y + 32; y++)
    if (!collides(g.world, { ...point, y }, 1.8, 0.6)) {
      point.y = y;
      clear = true;
      break;
    }
  const standData = peer.player.standData,
    achievements = achievementState(peer.player),
    aquaticId = peer.player.aquaticId;
  peer.player = createPlayer(clear ? point : g.world.findSpawn(), {
    achievements,
    aquaticId,
  });
  if (standData) {
    peer.player.standData = standData;
    standData.trial = null;
    standData.summoned = false;
    standData.transformed = false;
  }
  peer.context.player = peer.player;
  peer.keys = new Set();
  peer.mine = false;
  peer.teleport = true;
  peer.lastDeath = null;
  return true;
}
export function inventoryOperation(session, peer, op) {
  const g = session.game,
    ctx = peer.context,
    ui = ctx.ui,
    menu = peer.menu;
  if (!op || typeof op !== "object" || !menu || peer.player.health <= 0)
    return false;
  if (!menuStillValid(g, menu, peer.player)) return false;
  if (menu.target) {
    const t = peerTarget(g, peer);
    if (
      !t ||
      t.x !== menu.target.x ||
      t.y !== menu.target.y ||
      t.z !== menu.target.z ||
      t.id !== menu.target.id ||
      (menu.container &&
        g.world.containers[`${t.x},${t.y},${t.z}`] !== menu.container)
    )
      return false;
  }
  Object.assign(ui, {
    invType: menu.type,
    container: menu.container,
    craftSize: ["table", "stonecutter", "smithing_table"].includes(menu.type)
      ? 3
      : 2,
  });
  if (op.action === "slot") {
    const counts = {
      inventory: 36,
      armor: 4,
      offhand: menu.type === "personal" ? 1 : 0,
      craft: ui.craftSize ** 2,
      container: menu.container?.slots.length || 0,
    };
    if (
      !Object.hasOwn(counts, op.ref) ||
      !Number.isInteger(op.index) ||
      op.index < 0 ||
      op.index >= counts[op.ref] ||
      (!["personal", "table", "stonecutter", "smithing_table"].includes(
        menu.type,
      ) &&
        op.ref === "craft")
    )
      return false;
    g.ui.slotClick.call(
      ui,
      { dataset: { ref: op.ref, index: String(op.index) } },
      { button: op.right ? 2 : 0, shiftKey: !!op.shift },
    );
  } else if (op.action === "recipe") {
    if (
      !["personal", "table", "stonecutter", "smithing_table"].includes(
        menu.type,
      ) ||
      !Number.isInteger(op.recipe) ||
      !RECIPES[op.recipe]
    )
      return false;
    ctx.autofill(RECIPES[op.recipe], ui.craftSize);
  } else if (op.action === "craft") {
    if (
      !["personal", "table", "stonecutter", "smithing_table"].includes(
        menu.type,
      )
    )
      return false;
    g.ui.craft.call(ui, !!op.all);
  } else return false;
  return true;
}
export function peerSave(peer) {
  return cloneState({
    name: peer.name,
    player: peer.player,
    inventory: peer.inventory.export(),
    spawn: peer.spawn,
    lastDeath: peer.lastDeath,
  });
}
export function restorePeerInventory(data) {
  return new Inventory(data?.inventory);
}
