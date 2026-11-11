import { palmDev, ensurePalm } from "./devils-palm.js";
import { ITEMS, MIN_Y, MAX_Y, makeStack } from "./data.js";
import { collides } from "./physics.js";
import { setWeather } from "./weather.js";

export const COMMAND_HELP =
  "/palmprotect <4–128> · /help · /list · /seed · /time set day|night|0–23999 · /weather clear|rain|thunder|hail|tornado · /difficulty peaceful|easy|normal|hard · /give <player|@s> <item_id> [1–64] · /tp <player|@s> <x> <y> <z> · /tp <player> <player> · /heal [player] · /spawn [player] · /kick <player> · /save";
export function tokenizeCommand(line) {
  if (typeof line !== "string" || line.length > 256)
    throw Error("Commands must be 256 characters or fewer.");
  const tokens = line.trim().match(/"[^"\r\n]*"|[^\s"]+/g) || [];
  return tokens.map((t) => (t.startsWith('"') ? t.slice(1, -1) : t));
}
function participants(g) {
  const m = g.multiplayer;
  return [
    {
      id: m?.id || "self",
      name: m?.players.find((p) => p.id === m.id)?.name || "Host",
      player: g.player,
      inventory: g.inventory,
      spawn: g.spawn,
    },
    ...[...(m?.peers.values() || [])].map((peer) => ({ ...peer, peer })),
  ];
}
export function findParticipant(g, name = "@s") {
  const people = participants(g);
  if (name === "@s" || name === "self") return people[0];
  const found = people.filter(
    (p) => p.id === name || p.name.toLowerCase() === name.toLowerCase(),
  );
  if (found.length !== 1)
    throw Error(
      found.length
        ? "That name is ambiguous; use the player ID from /list."
        : "Player not found. Quote names containing spaces.",
    );
  return found[0];
}
function teleport(g, target, point) {
  if (
    ![point.x, point.y, point.z].every(Number.isFinite) ||
    Math.abs(point.x) > 100000 ||
    Math.abs(point.z) > 100000 ||
    point.y < MIN_Y ||
    point.y > MAX_Y + 64
  )
    throw Error("Coordinates are outside the supported world.");
  if (collides(g.world, { ...target.player, ...point }, 1.8, 0.6))
    throw Error("Destination is inside a solid block.");
  Object.assign(target.player, {
    x: point.x,
    y: point.y,
    z: point.z,
    vx: 0,
    vy: 0,
    vz: 0,
    fallStart: point.y,
  });
  if (target.peer) {
    target.peer.teleport = true;
    target.peer.keys = new Set();
  }
}
export async function runOwnerCommand(g, line) {
  if (!g.active) throw Error("Open a world first.");
  if (g.multiplayer?.isGuest)
    throw Error("Only the person hosting this world can use commands.");
  const [raw, ...args] = tokenizeCommand(line),
    cmd = raw?.toLowerCase();
  if (cmd === "/palmdev") {
    const result = palmDev(g, args);
    await g.save();
    return result?.x !== undefined
      ? `Development Palm: X ${result.x}, Y ${result.y}, Z ${result.z}.`
      : "Development Palm action applied.";
  }
  if (cmd === "/palmprotect") {
    const radius = Number(args[0]);
    if (!Number.isFinite(radius) || radius < 4 || radius > 128)
      throw Error("Use /palmprotect <4–128 block radius>.");
    (g.world.protectedAreas ||= []).push({
      x: g.player.x,
      z: g.player.z,
      radius,
    });
    await g.save();
    return "Protected from Palm generation and Stand travel.";
  }
  if (cmd === "/help") return COMMAND_HELP;
  if (cmd === "/list")
    return participants(g)
      .map((p) => `${p.name} (${p.id})`)
      .join(", ");
  if (cmd === "/seed") return `Seed: ${g.world.seed}`;
  if (cmd === "/time") {
    if (args[0] === "set") args.shift();
    const aliases = { day: 1000, noon: 6000, night: 14000, midnight: 18000 },
      value = Object.hasOwn(aliases, args[0])
        ? aliases[args[0]]
        : Number(args[0]);
    if (
      args.length !== 1 ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > 23999
    )
      throw Error("Use /time set day|night|noon|midnight|0–23999.");
    g.time = Math.floor(g.time / 24000) * 24000 + value;
    return `World time set to ${value}.`;
  }
  if (cmd === "/weather") {
    if (
      args.length !== 1 ||
      !["clear", "rain", "thunder", "hail", "tornado"].includes(args[0])
    )
      throw Error(
        "Use /weather clear|rain|thunder|hail|tornado. Rain becomes snow in cold biomes.",
      );
    setWeather(g.world, args[0]);
    return `Weather set to ${args[0]}.`;
  }
  if (cmd === "/difficulty") {
    if (
      args.length !== 1 ||
      !["peaceful", "easy", "normal", "hard"].includes(args[0])
    )
      throw Error("Use /difficulty peaceful|easy|normal|hard.");
    g.difficulty = args[0];
    return `Difficulty set to ${args[0]}.`;
  }
  if (cmd === "/give") {
    const [name, id, countText = "1"] = args,
      count = Number(countText),
      target = findParticipant(g, name);
    if (
      args.length < 2 ||
      args.length > 3 ||
      !ITEMS[id] ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 64
    )
      throw Error("Use /give <player|@s> <item_id> [1–64].");
    if (target.player.health <= 0)
      throw Error("That player must respawn first.");
    // Roll back a partial add so a failed command cannot hide or duplicate items.
    const before = target.inventory.export(),
      slots = structuredClone(before.slots);
    if (target.inventory.add(makeStack(id, count))) {
      target.inventory.slots = slots;
      throw Error("Not enough inventory space.");
    }
    g.ui.updateHotbar();
    return `Gave ${count} ${ITEMS[id].name} to ${target.name}.`;
  }
  if (cmd === "/tp") {
    const target = findParticipant(g, args[0]);
    if (args.length === 2) {
      const destination = findParticipant(g, args[1]);
      teleport(g, target, destination.player);
    } else if (args.length === 4)
      teleport(g, target, {
        x: Number(args[1]),
        y: Number(args[2]),
        z: Number(args[3]),
      });
    else
      throw Error("Use /tp <player|@s> <x> <y> <z> or /tp <player> <player>.");
    return `Teleported ${target.name}.`;
  }
  if (cmd === "/spawn") {
    if (args.length > 1) throw Error("Use /spawn [player].");
    const target = findParticipant(g, args[0]);
    teleport(g, target, target.spawn);
    return `Returned ${target.name} to spawn.`;
  }
  if (cmd === "/heal") {
    if (args.length > 1) throw Error("Use /heal [player].");
    const target = findParticipant(g, args[0]);
    if (target.player.health <= 0)
      throw Error("That player must respawn first.");
    Object.assign(target.player, {
      health: 20,
      food: 20,
      saturation: 5,
      oxygen: 300,
      burning: 0,
    });
    return `Restored ${target.name}'s health and hunger.`;
  }
  if (cmd === "/kick") {
    if (args.length !== 1) throw Error("Use /kick <player>.");
    const target = findParticipant(g, args[0]);
    if (!target.peer) throw Error("The owner cannot remove themselves.");
    g.multiplayer.send({ type: "kick", id: target.id });
    return `Removed ${target.name}.`;
  }
  if (cmd === "/save") {
    if (args.length) throw Error("Use /save.");
    await g.save();
    return "World and guest inventories saved on the host device.";
  }
  throw Error("Unknown command. Use /help for the command list.");
}
export class ChatSystem {
  constructor(game) {
    this.game = game;
    this.lines = [];
    this.history = [];
    this.historyIndex = 0;
  }
  receive(name, message) {
    this.lines.push({
      name: String(name).slice(0, 20),
      message: String(message).slice(0, 1000),
      at: performance.now(),
    });
    this.lines = this.lines.slice(-80);
    this.render();
  }
  announce(message) {
    const m = this.game.multiplayer;
    if (m.connected && !m.isGuest)
      m.send({ type: "announcement", message: String(message).slice(0, 160) });
    else this.receive("World", message);
  }
  async send(text) {
    const line = String(text).trim();
    if (!line) return;
    this.history.push(line);
    this.history = this.history.slice(-40);
    this.historyIndex = this.history.length;
    if (line.startsWith("/")) {
      try {
        this.receive("Command", await runOwnerCommand(this.game, line));
      } catch (e) {
        this.receive("Command", e.message);
      }
      return;
    }
    if (line.length > 160) {
      this.receive("Chat", "Messages must be 160 characters or fewer.");
      return;
    }
    if (this.game.multiplayer.connected)
      this.game.multiplayer.send({ type: "chat", message: line });
    else this.receive("You", line);
  }
  open(prefix = "") {
    const g = this.game;
    if (!g.active || g.player.health <= 0) return;
    if (g.ui.screen === "inventory") g.closeCraft();
    g.pause();
    g.ui.setScreen(
      "chat",
      '<section class="chat-window" aria-label="World chat"><div id="world-chat-log" role="log" aria-live="polite"></div><form id="world-chat-form"><label for="world-chat-input">Chat · /help for commands</label><div><input id="world-chat-input" maxlength="256" autocomplete="off" placeholder="Message…"><button type="submit">Send</button><button type="button" data-action="resume">Done</button></div></form></section>',
    );
    const input = g.ui.overlay.querySelector("#world-chat-input");
    input.value = prefix;
    g.ui.overlay
      .querySelector("#world-chat-form")
      .addEventListener("submit", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.send(input.value);
        input.value = "";
        input.focus();
      });
    input.addEventListener("keydown", (e) => {
      if (["ArrowUp", "ArrowDown"].includes(e.code)) {
        e.preventDefault();
        this.historyIndex = Math.max(
          0,
          Math.min(
            this.history.length,
            this.historyIndex + (e.code === "ArrowUp" ? -1 : 1),
          ),
        );
        input.value = this.history[this.historyIndex] || "";
      }
    });
    this.render();
    requestAnimationFrame(() => input.focus());
  }
  render() {
    const root = this.game.ui.root,
      log = root.querySelector("#world-chat-log");
    if (log) {
      log.replaceChildren(...this.lines.map((line) => this.lineElement(line)));
      log.scrollTop = log.scrollHeight;
    }
    this.frame();
  }
  lineElement(line) {
    const p = document.createElement("p"),
      b = document.createElement("b");
    b.textContent = `${line.name}: `;
    p.append(b, document.createTextNode(line.message));
    return p;
  }
  frame() {
    const g = this.game;
    if (!this.hud) {
      this.hud = document.createElement("aside");
      this.hud.id = "world-chat-hud";
      this.hud.setAttribute("aria-label", "Recent chat");
      g.ui.root.append(this.hud);
    }
    this.hud.hidden = !g.active || g.ui.screen !== "play";
    const recent = this.lines
        .filter((l) => performance.now() - l.at < 12000)
        .slice(-5),
      signature = recent.map((l) => l.at + ":" + l.message).join("|");
    if (signature !== this.signature) {
      this.signature = signature;
      this.hud.replaceChildren(...recent.map((l) => this.lineElement(l)));
    }
  }
}
