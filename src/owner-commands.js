import { WORLD_RULES, parseRule, ruleEnabled } from "./world-rules.js";
import {
  B,
  BLOCKS,
  ITEMS,
  MOB_INFO,
  SPAWN_EGG_TYPES,
  MIN_Y,
  MAX_Y,
} from "./data.js";
import { createEntity } from "./simulation.js";
import {
  ENCHANTMENTS,
  enchantItem,
  enchantLevel,
  enchantConflict,
} from "./equipment.js";
import { collides } from "./physics.js";
export const EXTRA_COMMAND_HELP =
  "/gamerule [rule] [true|false] · /gamemode survival|creative · /spawnpoint [player] [x y z] · /setworldspawn [x y z] · /setblock x y z block · /fill x1 y1 z1 x2 y2 z2 block · /summon mob [x y z] · /clear [player] [item] · /effect give player effect [seconds] [amplifier] · /effect clear [player] · /enchant player enchantment [level] · /kill [player] · /say message";
const effects = new Set([
  "resistance",
  "night_vision",
  "water_breathing",
  "conduit_power",
  "dolphins_grace",
  "slowness",
  "levitation",
]);
function number(v, origin = 0) {
  const n = String(v).startsWith("~")
    ? origin + Number(String(v).slice(1) || 0)
    : Number(v);
  if (!Number.isFinite(n)) throw Error("Invalid coordinate.");
  return n;
}
function point(args, p) {
  if (args.length !== 3) throw Error("Enter x y z coordinates.");
  const q = {
    x: number(args[0], p.x),
    y: number(args[1], p.y),
    z: number(args[2], p.z),
  };
  if (
    Math.abs(q.x) > 100000 ||
    Math.abs(q.z) > 100000 ||
    q.y < MIN_Y ||
    q.y >= MAX_Y
  )
    throw Error("Coordinates are outside the world.");
  return q;
}
function block(id) {
  if (!Object.hasOwn(B, id)) throw Error("Unknown block ID.");
  return B[id];
}
export function extraOwnerCommand(g, cmd, args, api) {
  const people = (selector = "@s") =>
    selector === "@a"
      ? api.participants(g)
      : [api.findParticipant(g, selector)];
  if (cmd === "/gamerule") {
    if (args.length > 2) throw Error("Use /gamerule [rule] [true|false].");
    if (!args.length)
      return Object.keys(WORLD_RULES)
        .map((k) => `${k}: ${ruleEnabled(g, k)}`)
        .join(" · ");
    const rule = parseRule(args[0], args[1]);
    if (rule.value !== undefined) (g.rules ||= {})[rule.name] = rule.value;
    return `${rule.name}: ${ruleEnabled(g, rule.name)}`;
  }
  if (cmd === "/gamemode") {
    if (args.length !== 1 || !["survival", "creative"].includes(args[0]))
      throw Error("Use /gamemode survival|creative.");
    if (
      g.giganto?.active ||
      
      [...(g.multiplayer?.peers?.values() || [])].some((p) => p.arena)
    )
      throw Error("Return from the encounter first.");
    g.mode = args[0];
    for (const t of api.participants(g)) {
      t.player.flying = g.mode === "creative";
      if (t.peer) t.peer.teleport = true;
    }
    g.multiplayer?.broadcastMode?.();
    g.ui.updateHUD();
    return `Game mode: ${g.mode === "creative" ? "Creative" : "Survival"}.`;
  }
  if (cmd === "/spawnpoint" || cmd === "/setworldspawn") {
    let targets = [{ player: g.player }];
    if (cmd === "/spawnpoint") targets = people(args.shift() || "@s");
    const q = args.length
      ? point(args, g.player)
      : { x: g.player.x, y: g.player.y, z: g.player.z };
    if (collides(g.world, q, 1.8, 0.6))
      throw Error("Spawn is inside a solid block.");
    if (cmd === "/setworldspawn") g.spawn = { ...q };
    else
      for (const t of targets) {
        if (t.peer) {
          t.peer.spawn = { ...q };
          t.peer.spawnDimension=g.dimension;t.peer.context.spawnDimension=g.dimension;
          t.peer.context.spawn = t.peer.spawn;
        } else g.spawn = { ...q };
      }
    return cmd === "/setworldspawn" ? "World spawn set." : "Spawn point set.";
  }
  if (cmd === "/setblock" || cmd === "/fill") {
    const n = cmd === "/fill" ? 6 : 3;
    if (args.length !== n + 1)
      throw Error(
        cmd === "/fill"
          ? "Use /fill x1 y1 z1 x2 y2 z2 block."
          : "Use /setblock x y z block.",
      );
    const a = point(args.slice(0, 3), g.player),
      b = cmd === "/fill" ? point(args.slice(3, 6), g.player) : a,
      id = block(args[n]);
    const low = {
        x: Math.floor(Math.min(a.x, b.x)),
        y: Math.floor(Math.min(a.y, b.y)),
        z: Math.floor(Math.min(a.z, b.z)),
      },
      hi = {
        x: Math.floor(Math.max(a.x, b.x)),
        y: Math.floor(Math.max(a.y, b.y)),
        z: Math.floor(Math.max(a.z, b.z)),
      };
    const volume = (hi.x - low.x + 1) * (hi.y - low.y + 1) * (hi.z - low.z + 1);
    if (volume > 4096) throw Error("Limit: 4096 blocks per command.");
    let count = 0;
    for (let x = low.x; x <= hi.x; x++)
      for (let y = low.y; y <= hi.y; y++)
        for (let z = low.z; z <= hi.z; z++)
          if (g.world.set(x, y, z, id)) count++;
    return `${count} blocks changed.`;
  }
  if (cmd === "/summon") {
    if (!SPAWN_EGG_TYPES.includes(args[0]) || ![1, 4].includes(args.length))
      throw Error("Use /summon <spawn-egg mob ID> [x y z].");
    if (g.entities.length >= 256) throw Error("Entity limit reached.");
    const q =
      args.length === 4
        ? point(args.slice(1), g.player)
        : {
            x: g.player.x - Math.sin(g.player.yaw) * 2,
            y: g.player.y,
            z: g.player.z - Math.cos(g.player.yaw) * 2,
          };
    const def = MOB_INFO[args[0]];
    if (collides(g.world, q, def.height || 1.8, def.width || 0.6))
      throw Error("Not enough room.");
    const e = createEntity(g, args[0], q.x, q.z);
    Object.assign(e, q);
    g.entities.push(e);
    return `${def.name} summoned.`;
  }
  if (cmd === "/clear") {
    if (args.length > 2 || (args[1] && !ITEMS[args[1]]))
      throw Error("Use /clear [player] [item ID].");
    let count = 0;
    for (const t of people(args[0])) {
      for (const list of [
        t.inventory.slots,
        t.inventory.equipment,
        t.inventory.offhand,
        t.inventory.craft,
      ])
        for (let i = 0; i < list.length; i++)
          if (list[i] && (!args[1] || list[i].id === args[1])) {
            count += list[i].count;
            list[i] = null;
          }
      if (
        t.inventory.cursor &&
        (!args[1] || t.inventory.cursor.id === args[1])
      ) {
        count += t.inventory.cursor.count;
        t.inventory.cursor = null;
      }
    }
    g.ui.updateHotbar();
    return `${count} items cleared.`;
  }
  if (cmd === "/effect") {
    if (args[0] === "clear") {
      if (args.length > 2) throw Error("Use /effect clear [player].");
      for (const t of people(args[1])) {
        t.player.effects = {};
        t.player.levitationTicks = 0;
      }
      return "Effects cleared.";
    }
    const [, selector, id, seconds = "30", amplifier = "0"] = args,
      sec = Number(seconds),
      amp = Number(amplifier);
    if (
      args[0] !== "give" ||
      args.length < 3 ||
      args.length > 5 ||
      !effects.has(id) ||
      !Number.isInteger(sec) ||
      sec < 1 ||
      sec > 3600 ||
      !Number.isInteger(amp) ||
      amp < 0 ||
      amp > 4
    )
      throw Error(
        "Use /effect give player effect [1–3600 seconds] [0–4 amplifier].",
      );
    for (const t of people(selector)) {
      if (id === "levitation") t.player.levitationTicks = sec * 20;
      else (t.player.effects ||= {})[id] = { ticks: sec * 20, level: amp + 1 };
    }
    return "Effect applied.";
  }
  if (cmd === "/enchant") {
    const [selector, id, levelText = "1"] = args,
      level = Number(levelText),
      def = ENCHANTMENTS[id],
      targets = people(selector);
    if (
      args.length < 2 ||
      args.length > 3 ||
      !def ||
      !Number.isInteger(level) ||
      level < 1 ||
      level > def.max
    )
      throw Error("Use /enchant player enchantment [valid level].");
    for (const t of targets) {
      const s = t.inventory.held;
      if (!s || !def.fits(ITEMS[s.id]))
        throw Error("That enchantment does not fit the held item.");
      if (
        enchantConflict(s, id) ||
        (id === "riptide" &&
          (enchantLevel(s, "loyalty") || enchantLevel(s, "channeling"))) ||
        (["loyalty", "channeling"].includes(id) && enchantLevel(s, "riptide"))
      )
        throw Error("Incompatible enchantment.");
    }
    for (const t of targets) {
      const ctx = t.peer?.context || g;
      while (enchantLevel(t.inventory.held, id) < level) {
        const cheats = Object.create(ctx);
        Object.assign(cheats, {
          mode: "creative",
          ui: { updateHotbar() {}, updateHUD() {} },
        });
        const result = enchantItem(cheats, t.inventory.selected, id);
        if (!result.ok) throw Error(result.message);
      }
    }
    g.ui.updateHotbar();
    return "Item enchanted.";
  }
  if (cmd === "/kill") {
    if (args.length > 1) throw Error("Use /kill [player].");
    for (const t of people(args[0])) {
      if (t.player.multiplayerAway)
        throw Error("That player is in an encounter.");
      t.player.hurt = 0;
      (t.peer?.context || g).damage(1000000, "command", true);
    }
    return "Player defeated.";
  }
  if (cmd === "/say") {
    if (!args.length) throw Error("Use /say message.");
    g.chat.announce(args.join(" "));
    return "";
  }
  return null;
}
