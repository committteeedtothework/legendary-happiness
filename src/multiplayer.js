import {swapHands,useOffhand,withOffhand} from "./offhand.js";
import { syncAchievements } from "./achievements.js";
import { restoreEmbeddedArrows } from "./embedded-arrows.js";
import { PROTOCOL } from "../server/protocol.mjs";
import { releaseEditionWeapon } from "./edition-combat.js";
import { releaseTrident } from "./aquatic-gear.js";
import { worldInteractionSnapshot } from "./world-interactions.js";
import {
  activateStand,
  standLocked,
  grantCreativeStand,
} from "./stand-abilities.js";
import { STANDS } from "./stands-data.js";
import { installPalm } from "./palm-terrain.js";
import { inheritPlayerMotion } from "./player-motion.js";
import { animateMagic } from "./arcane-effects.js";
import { useSpawnEgg } from "./spawn-eggs.js";
import {
  cleanInput,
  resumeToken,
  peerContext,
  stepPeer,
  tickPeer,
  respawnPeer,
  inventoryOperation,
  peerSave,
  peerTarget,
  closePeerCraft,
} from "./coop-survival.js";
import { firePistols, pistolUsesStyle } from "./matthew.js";
import { INVASION_ANNOUNCEMENT, invasionState } from "./invasion.js";
import * as THREE from "three";
import { World } from "./world.js";
import { createPlayer, collides, intersectsBlock } from "./physics.js";
import { Inventory } from "./inventory.js";
import {
  B,
  BLOCKS,
  ITEMS,
  MOB_INFO,
  MIN_Y,
  MAX_Y,
  GENERATION_VERSION,
  makeStack,
} from "./data.js";
import { SKINS } from "./skins.js";
import { createPlayerModel, animatePlayerModel } from "./player-model.js";
import { doorAt, setDoorOpen } from "./doors.js";
import { restoreWeather } from "./weather.js";
import { restoreRealm } from "./realms.js";
import { launchSeeker } from "./seeker.js";
import { devinPulse, damageEntity } from "./simulation.js";

export function relayURL(value) {
  const url = new URL(value);
  if (
    !["http:", "https:", "ws:", "wss:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw Error("Enter an HTTP(S) or WS(S) server address without a password.");
  url.protocol = ["https:", "wss:"].includes(url.protocol) ? "wss:" : "ws:";
  url.pathname = "/relay";
  url.search = "";
  url.hash = "";
  return url;
}
export function invitationURL(server, room, key) {
  const url = relayURL(server);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = "/";
  url.hash = new URLSearchParams({ join: room, key }).toString();
  return url.href;
}
export function readInvitation(value) {
  const url = new URL(value),
    data = new URLSearchParams(url.hash.slice(1));
  if (
    !/^[\w-]{8}$/.test(data.get("join") || "") ||
    !/^[\w-]{32}$/.test(data.get("key") || "")
  )
    throw Error(
      "Paste the complete invitation link, including the part after #.",
    );
  return {
    server: relayURL(url.href).href,
    room: data.get("join"),
    key: data.get("key"),
  };
}
export function cleanStandVisual(s) {
  if (!s || typeof s !== "object") return null;
  const effect =
    s.effect &&
    typeof s.effect.kind === "string" &&
    Number.isSafeInteger(s.effect.tick) &&
    [s.effect.x, s.effect.y, s.effect.z].every(Number.isFinite)
      ? {
          kind: s.effect.kind.slice(0, 20),
          tick: s.effect.tick,
          x: s.effect.x,
          y: s.effect.y,
          z: s.effect.z,
        }
      : null;
  return {
    id: STANDS[s.id] ? s.id : null,
    summoned: !!s.summoned,
    transformed: !!s.transformed,
    awakeningUntil: Number.isSafeInteger(s.awakeningUntil)
      ? s.awakeningUntil
      : 0,
    effect,
    rift:
      s.rift &&
      [s.rift.x, s.rift.y, s.rift.z, s.rift.until].every(Number.isFinite)
        ? { x: s.rift.x, y: s.rift.y, z: s.rift.z, until: s.rift.until }
        : null,
  };
}
export function cleanPose(p) {
  if (
    !p ||
    ![p.x, p.y, p.z, p.yaw, p.pitch].every(Number.isFinite) ||
    Math.abs(p.x) > 100000 ||
    Math.abs(p.z) > 100000 ||
    p.y < MIN_Y - 8 ||
    p.y > MAX_Y + 128 ||
    Math.abs(p.pitch) > Math.PI / 2 + 0.01 ||
    Math.abs(p.yaw) > 100000
  )
    return null;
  return {
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: p.yaw,
    pitch: p.pitch,
    crouching: !!p.crouching,
    sprinting: !!p.sprinting,
    flying: !!p.flying,
    inWater: !!p.inWater,
    underwater: !!p.underwater,
    onGround: p.onGround === undefined ? true : !!p.onGround,
    vy: Number.isFinite(p.vy) ? Math.max(-100, Math.min(100, p.vy)) : 0,
    stand: cleanStandVisual(p.standData || p.stand),
    skin: SKINS[p.skin] ? p.skin : "explorer",
    held: ITEMS[p.held] ? p.held : null,
    equipment: Array.from({ length: 4 }, (_, i) =>
      ITEMS[p.equipment?.[i]]?.armorSlot === i ? p.equipment[i] : null,
    ),
  };
}
function poseFor(game) {
  return {
    ...game.player,
    skin: game.settings.skin,
    held: game.inventory.held?.id,
    equipment: game.inventory.equipment.map((s) => s?.id),
  };
}
export class Multiplayer {
  constructor(game) {
    this.game = game;
    this.connected = false;
    this.isGuest = false;
    this.players = [];
    this.peers = new Map();
    this.models = new Map();
    this.chat = [];
    this.sequence = 0;
    this.savedPlayers = {};
    this.pending = new Map();
  }
  async connect({ server, name, invite }) {
    if (this.game.giganto?.active)
      throw new Error(
        "Return from the singleplayer Titan encounter before opening co-op.",
      );
    if (!invite && this.isGuest)
      throw Error(
        "Leave the guest session and open your own saved world before hosting.",
      );
    if (this.socket) this.disconnect();
    if (!invite && !this.game.active)
      throw Error("Open a Survival or Creative world before hosting.");
    if (
      !invite &&
      this.game.mode === "survival" &&
      this.game.dimension !== "overworld"
    )
      throw Error(
        "Survival sharing currently starts in the Overworld. Close co-op before dimension travel.",
      );
    const parsed = invite
      ? readInvitation(invite)
      : { server: relayURL(server).href };
    this.server = parsed.server;
    this.isGuest = !!invite;
    this.closed = false;
    this.endReason = "";
    this.chat = [];
    this.sessionReady = false;
    this.lastEdits = new Map();
    this.sharedWorld = null;
    let ws;
    try {
      ws = new WebSocket(this.server);
    } catch {
      throw Error("The server address could not be opened.");
    }
    this.socket = ws;
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (message) => {
        if (!settled) {
          settled = true;
          clearTimeout(deadline);
          reject(Error(message));
        }
      };
      const deadline = setTimeout(() => {
        fail(
          "The server did not answer. Start the relay and check its address and firewall.",
        );
        ws.close();
      }, 12000);
      ws.onopen = () =>
        this.send({
          type: invite ? "join" : "create",
          protocol: PROTOCOL,
          resume: this.isGuest ? this.readResume() : undefined,
          name: (name || "Player").slice(0, 20),
          room: parsed.room,
          key: parsed.key,
        });
      ws.onmessage = (event) => {
        if (this.socket !== ws) return;
        try {
          const m = JSON.parse(event.data);
          if (m.type === "error") {
            fail(m.message);
            this.game.ui.toast(m.message, 6000);
            return;
          }
          if (m.type === "created" || m.type === "joined") {
            this.connected = true;
            this.id = m.id;
            this.room = m.room;
            this.players = m.players;
            this.invite = m.key
              ? invitationURL(m.publicURL || this.server, m.room, m.key)
              : invite;
            if (m.type === "created") {
              this.sessionReady = true;
              this.sharedWorld = this.game.world;
              this.lastEdits = new Map(this.game.world.edits);
            }
          }
          if (
            m.type === "public-address" &&
            !this.isGuest &&
            this.invite &&
            m.publicURL
          ) {
            const current = readInvitation(this.invite);
            this.invite = invitationURL(m.publicURL, this.room, current.key);
            const input =
              this.game.ui.overlay?.querySelector("#session-invite");
            if (input) input.value = this.invite;
            if (this.game.ui.screen === "multiplayer")
              this.game.ui.multiplayerMenu();
            this.game.ui.toast(
              "Public relay address updated. Copy a fresh invitation.",
            );
          }
          if (m.type === "welcome") {
            this.adopt(m.world);
            this.sessionReady = true;
          }
          if (!settled && this.sessionReady) {
            settled = true;
            clearTimeout(deadline);
            resolve(this);
          }
          if (m.type === "peer-join" && !this.isGuest) this.addPeer(m);
          if (m.type === "peer-left") {
            const leaving = this.peers.get(m.id);
            if (leaving?.player.standData?.trial?.phase === "trial")
              leaving.player.standData.trial = null;
            this.stashPeer(m.id);
            this.peers.delete(m.id);
            this.game.save()?.catch(() => {});
          }
          if (m.type === "roster") {
            this.players = m.players;
            if (this.game.ui.screen === "multiplayer")
              this.game.ui.updateSession();
          }
          if (m.type === "pose" && !this.isGuest) this.receivePose(m);
          if (m.type === "input" && !this.isGuest) this.receiveInput(m);
          if (m.type === "private-state" && this.isGuest)
            this.applyPrivate(m.state);
          if (m.type === "command" && !this.isGuest) this.execute(m);
          if (m.type === "state" && this.isGuest) this.applyState(m.state);
          if (m.type === "poses" && this.isGuest) this.remotePoses = m.players;
          if (m.type === "ack") {
            this.pending.delete(m.seq);
            if (m.message) this.game.ui.toast(m.message);
            for (const key of [
              "devinReadyTick",
              "devinSeekerTick",
              "matthewShotTick",
              "matthewHand",
            ])
              if (Number.isSafeInteger(m.cooldowns?.[key]))
                this.game.player[key] = m.cooldowns[key];
          }
          if (m.type === "pong") this.ping = Math.max(0, Date.now() - m.at);
          if (m.type === "chat") {
            this.chat.push({ name: m.name, message: m.message });
            this.chat = this.chat.slice(-40);
            this.game.chat?.receive(m.name, m.message);
            if (this.game.ui.screen === "multiplayer")
              this.game.ui.updateSession();
          }
          if (m.type === "ended") {
            this.endReason = m.reason;
            ws.close();
          }
        } catch (e) {
          fail("The shared world could not be loaded: " + e.message);
          this.endReason = e.message;
          ws.close();
        }
      };
      ws.onerror = () =>
        fail(
          "Could not connect. Check the relay address; HTTPS pages require a secure WSS server.",
        );
      ws.onclose = () => {
        fail(
          this.endReason ||
            "The server disconnected before the world was ready.",
        );
        if (this.socket !== ws) return;
        if (!this.isGuest)
          for (const id of this.peers.keys()) this.stashPeer(id);
        this.peers.clear();
        this.connected = false;
        this.sessionReady = false;
        this.clearModels();
        this.pending.clear();
        if (this.socket === ws) this.socket = null;
        if (!this.closed && this.game.active) {
          this.game.pause();
          this.game.ui.pause(
            this.isGuest
              ? this.endReason ||
                  "Connection lost. Rejoin with a fresh invitation; the host keeps the world."
              : "Relay disconnected. Your world is still available offline.",
          );
        }
      };
    });
  }
  send(data) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    if (this.socket.bufferedAmount >= 4 * 1024 * 1024) {
      // Never silently lose a world edit delta on a congested connection.
      this.endReason =
        "Connection too slow. Reopen co-op and share a new invitation.";
      this.socket.close(4001, "Connection too slow");
      return false;
    }
    this.socket.send(JSON.stringify(data));
    return true;
  }
  addPeer({ id, name, resume }) {
    const g = this.game,
      survival = g.mode === "survival";
    const known =
      typeof resume === "string" &&
      /^[a-f0-9]{48}$/.test(resume) &&
      this.savedPlayers[resume];
    if (known && [...this.peers.values()].some((p) => p.resume === resume)) {
      this.send({ type: "kick", id });
      return;
    }
    if (!known && Object.keys(this.savedPlayers).length >= 64) {
      this.send({ type: "kick", id });
      return;
    }
    const saved = known || {},
      player = survival
        ? createPlayer(saved.player || g.spawn)
        : createPlayer(g.player);
    // createPlayer initializes health: explicitly restore saved survival state.
    if (survival && saved.player) Object.assign(player, saved.player);
    if (!survival && saved.player?.standData)
      player.standData = saved.player.standData;
    player.flying = !survival;
    const peer = {
      id,
      name,
      player,
      skin: "explorer",
      inventory: new Inventory(survival ? saved.inventory : undefined),
      spawn: saved.spawn || { ...g.spawn },
      resume: known ? resume : resumeToken(),
      lastPose: performance.now(),
      lastSeq: -1,
      lastAction: -10,
      lastAttack: -10,
      keys: new Set(),
      mine: false,
      menu: null,
      lastDeath: saved.lastDeath,
    };
    if (!known)
      for (const [dx, dz] of [
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
        [0, 0],
      ]) {
        const p = { ...player, x: player.x + dx, z: player.z + dz };
        if (!collides(g.world, p, 1.8, 0.6)) {
          Object.assign(player, p);
          break;
        }
      }
    peer.context = peerContext(this, peer);
    this.peers.set(id, peer);
    this.sendWelcome(peer);
    g.chat?.announce(`${name} joined the world.`);
  }
  sendWelcome(peer) {
    const world = this.game.snapshot();
    delete world.coopPlayers;
    world.player = { ...peer.player };
    world.inventory = peer.inventory.export();
    world.playerSpawn = peer.spawn;
    world.resumeToken = peer.resume;
    world.lastDeath = peer.lastDeath;
    this.send({ type: "welcome", to: peer.id, world });
  }
  receivePose({ id, pose }) {
    if (this.game.mode === "survival") return;
    const peer = this.peers.get(id),
      p = cleanPose(pose);
    if (!peer || !p) return;
    const now = performance.now(),
      dt = Math.min(2, (now - peer.lastPose) / 1000);
    if (
      Math.hypot(
        p.x - peer.player.x,
        p.y - peer.player.y,
        p.z - peer.player.z,
      ) > Math.max(8, dt * 65)
    ) {
      // Host never accepts a teleport as a building reach extension.
      this.send({
        type: "ack",
        to: id,
        seq: 0,
        ok: false,
        message: "Movement was too fast; rejoin to return to the host.",
      });
      return;
    }
    if (now - (peer.lastStandTeleport || -1000) < 500)
      for (const key of ["x", "y", "z"]) p[key] = peer.player[key];
    delete p.stand; // Creative clients cannot assign ownership or transformations.
    Object.assign(peer.player, p);
    peer.skin = p.skin;
    peer.held = p.held;
    peer.equipment = p.equipment;
    peer.lastPose = now;
  }
  execute(m) {
    if (m.kind === "stand") return this.executeStand(m);
    if (this.game.mode === "survival") return this.executeSurvival(m);
    const peer = this.peers.get(m.id),
      g = this.game;
    if (!peer || !Number.isSafeInteger(m.seq) || m.seq <= peer.lastSeq) return;
    peer.lastSeq = m.seq;
    const reject = (message) =>
      this.send({ type: "ack", to: m.id, seq: m.seq, ok: false, message });
    if (g.mode !== "creative" || performance.now() - peer.lastPose > 5000)
      return reject("Wait for your connection to catch up.");
    if (g.elapsed - peer.lastAction < 0.16) return reject("");
    peer.lastAction = g.elapsed;
    const p = peer.player,
      held = ITEMS[m.held] ? m.held : null;
    const dir = {
      x: -Math.sin(p.yaw) * Math.cos(p.pitch),
      y: Math.sin(p.pitch),
      z: -Math.cos(p.yaw) * Math.cos(p.pitch),
    };
    const target = g.world.raycast(
      { x: p.x, y: p.y + 1.62 - (p.crouching ? 0.27 : 0), z: p.z },
      dir,
      5,
    );
    if (
      m.kind === "break" &&
      (!target || BLOCKS[target.id]?.relic || target.id === B.bedrock)
    )
      return reject("That block cannot be broken in co-op.");
    const previous = {};
    for (const key of [
      "player",
      "inventory",
      "target",
      "lastPlace",
      "lastAttack",
      "ui",
      "renderer",
      "audio",
    ])
      previous[key] = g[key];
    peer.inventory.slots[0] = held ? makeStack(held, ITEMS[held].stack) : null;
    peer.inventory.selected = 0;
    let feedback = "";
    const quietUI = {
      toast: (message) => {
        feedback = String(message);
      },
      updateHotbar() {},
      updateHUD() {},
    };
    const originalCrouching = p.crouching;
    let ok = false;
    try {
      g.player = p;
      g.inventory = peer.inventory;
      g.target = target;
      g.lastPlace = -10;
      g.lastAttack = peer.lastAttack;
      g.ui = quietUI;
      g.renderer = {
        action() {},
        breakParticles: (...a) => previous.renderer.breakParticles(...a),
        pulseEffect: (p) => previous.renderer.pulseEffect(p),
        arcane: previous.renderer.arcane,
      };
      g.audio = { tone() {} };
      if (m.kind === "break") {
        g.breakBlock(target);
        ok = true;
      }
      if (m.kind === "use") {
        const door = target && doorAt(g.world, target.x, target.y, target.z);
        if (door && !p.crouching)
          ok = setDoorOpen(g.world, door.x, door.y, door.z, !door.open, [
            previous.player,
            ...this.occupants(),
            ...g.entities,
          ]);
        else if (ITEMS[held]?.spawnType) ok = useSpawnEgg(g);
        else if (ITEMS[held]?.block !== undefined && target) {
          const x = target.x + target.normal.x,
            y = target.y + target.normal.y,
            z = target.z + target.normal.z;
          if (
            BLOCKS[ITEMS[held].block].solid &&
            [previous.player, ...this.occupants()].some((body) =>
              intersectsBlock(body, x, y, z),
            )
          )
            return reject("A player is standing there.");
          // Shared containers, portal travel, and workstations stay host-controlled.
          p.crouching = true;
          g.use();
          ok = true;
        }
      }
      if(m.kind==="swap-hands")ok=swapHands(g);
      if(m.kind==="offhand-use")ok=useOffhand(g);
      if (m.kind === "attack") {
        g.tryAttack();
        ok = true;
      }
      if (m.kind === "pulse") ok = devinPulse(g);
      if (m.kind === "seeker") ok = launchSeeker(g);
      if (m.kind === "pistol") ok = firePistols(g, damageEntity);
    } catch {
      return reject("The action could not be applied.");
    } finally {
      peer.lastAttack = g.lastAttack;
      p.crouching = originalCrouching;
      Object.assign(g, previous);
    }
    this.send({
      type: "ack",
      to: m.id,
      seq: m.seq,
      ok,
      message:
        feedback ||
        (ok
          ? ""
          : "This action is host-controlled or unavailable in Creative co-op."),
      cooldowns: {
        devinReadyTick: p.devinReadyTick || 0,
        devinSeekerTick: p.devinSeekerTick || 0,
        matthewShotTick: p.matthewShotTick || 0,
        matthewHand: p.matthewHand || 0,
      },
    });
  }
  readResume() {
    try {
      return localStorage.getItem("dcsmcraft-resume:" + this.server) || "";
    } catch {
      return "";
    }
  }
  writeResume(token) {
    if (!/^[a-f0-9]{48}$/.test(token || "")) return;
    try {
      localStorage.setItem("dcsmcraft-resume:" + this.server, token);
    } catch {}
  }
  stashPeer(id) {
    const p = this.peers.get(id);
    if (p?.resume) this.savedPlayers[p.resume] = peerSave(p);
  }
  exportPlayers() {
    if (!this.isGuest) for (const id of this.peers.keys()) this.stashPeer(id);
    return this.savedPlayers;
  }
  restorePlayers(records = {}) {
    this.savedPlayers = {};
    if (!records || typeof records !== "object" || Array.isArray(records))
      return;
    for (const [token, state] of Object.entries(records).slice(0, 64))
      if (/^[a-f0-9]{48}$/.test(token) && state?.player && state?.inventory)
        this.savedPlayers[token] = state;
  }
  peerForPlayer(player) {
    return [...this.peers.values()].find((p) => p.player === player);
  }
  damagePlayer(player, amount, cause, source = null) {
    this.peerForPlayer(player)?.context.damage(amount, cause,false,source);
  }
  physics(dt) {
    if (this.connected && !this.isGuest)
      for (const peer of this.peers.values()) stepPeer(this, peer, dt);
  }
  tickSurvival() {
    if (this.connected && !this.isGuest)
      for (const peer of this.peers.values()) tickPeer(this, peer);
  }
  receiveInput({ id, input }) {
    if (this.game.mode !== "survival") return;
    const peer = this.peers.get(id),
      clean = cleanInput(input);
    if (!peer || !clean) return;
    peer.keys = new Set(clean.keys);
    peer.mine = clean.mine;
    peer.lastPose = performance.now();
    peer.player.yaw = clean.yaw;
    peer.player.pitch = clean.pitch;
    peer.player.flying = false;
    peer.inventory.selected = clean.selected;
    peer.context.sprintInput.latched = clean.sprinting;
    peer.skin = SKINS[input.skin] ? input.skin : "explorer";
    peer.held = peer.inventory.held?.id;
    peer.equipment = peer.inventory.equipment.map((s) => s?.id);
  }
  sendInput() {
    const g = this.game;
    this.send({
      type: "input",
      input: {
        yaw: g.player.yaw,
        pitch: g.player.pitch,
        keys: g.running ? [...(g.inputKeys?.() || g.keys)] : [],
        sprinting: g.running && g.player.sprinting,
        mine: g.running && g.mouseDown,
        selected: g.inventory.selected,
        skin: g.settings.skin,
      },
    });
  }
  sendPrivate(peer) {
    this.send({
      type: "private-state",
      to: peer.id,
      state: {
        standAnnouncement: peer.standAnnouncement,
        player: peer.player,
        inventory: peer.inventory.export(),
        spawn: peer.spawn,
        lastDeath: peer.lastDeath,
        teleport: !!peer.teleport,
        menu: peer.menu
          ? {
              type: peer.menu.type,
              container: peer.menu.container,
              target: peer.menu.target,
            }
          : null,
        openMenu: !!peer.openMenu,
        closeMenu: !!peer.closeMenu,
      },
    });
    peer.standAnnouncement = null;
    peer.teleport = false;
    peer.openMenu = false;
    peer.closeMenu = false;
  }
  applyPrivate(s) {
    const g = this.game;
    if (!s?.player) return;
    syncAchievements(g,s.player.achievements);
    g.player.standData = s.player.standData || null;
    if (s.standAnnouncement) {
      g.ui.announce(s.standAnnouncement.title, s.standAnnouncement.text);
      g.audio?.standSound?.("presence");
    }
    if (g.mode !== "survival") {
      if (s.teleport)
        for (const key of ["x", "y", "z", "vx", "vy", "vz", "fallStart"])
          g.player[key] = s.player[key];
      return;
    }
    const wasDead = g.player.health <= 0,
      health = g.player.health,
      selected = g.inventory.selected;
    for (const key of [
      "health",
      "food",
      "saturation",
      "oxygen",
      "exhaustion",
      "xp",
      "burning",
      "hurt",
      "runicSlow",
      "matthewShotTick",
      "matthewHand",
      "devinReadyTick",
      "devinSeekerTick",
    ])
      if (Number.isFinite(s.player[key])) g.player[key] = s.player[key];
    g.player.flying = false;
    g.player.boatId = s.player.boatId || null;
    g.player.horseId = s.player.horseId || null;
    g.player.aquaticId = s.player.aquaticId || null;
    g.player.effects = s.player.effects || {};
    g.player.fishing = s.player.fishing || null;
    g.player.riptide = s.player.riptide || null;
    g.player.swimming = !!s.player.swimming;
    const distance = Math.hypot(
      g.player.x - s.player.x,
      g.player.y - s.player.y,
      g.player.z - s.player.z,
    );
    const idle =
      !g.running ||
      !["KeyW", "KeyA", "KeyS", "KeyD", "Space"].some((key) =>
        (g.inputKeys?.() || g.keys).has(key),
      );
    if (s.teleport || distance > 1.25 || (idle && distance > 0.025))
      for (const key of [
        "x",
        "y",
        "z",
        "vx",
        "vy",
        "vz",
        "fallStart",
        "onGround",
      ])
        g.player[key] = s.player[key];
    g.inventory = new Inventory(s.inventory);
    g.inventory.selected = selected;
    g.spawn = s.spawn;
    g.lastDeath = s.lastDeath;
    if (g.player.health < health) {
      g.renderer.action("hurt");
      g.audio.tone("hit");
    }
    if (g.player.health <= 0 && g.ui.screen !== "death") {
      g.pause();
      g.ui.death();
    } else if (wasDead && g.player.health > 0) {
      g.resume();
      g.ui.toast("Respawned. Your dropped items remain in the world.");
    } else if (s.openMenu && s.menu) {
      g.running = false;
      g.resetControls();
      document.exitPointerLock?.();
      g.ui.openInventory(s.menu.type, s.menu.container, s.menu.target);
    } else if (s.closeMenu && g.ui.screen === "inventory") {
      g.ui.toast("That workstation is no longer in reach.");
      g.resume();
    }
    if (g.ui.screen === "inventory") {
      if (s.menu?.container) g.ui.container = s.menu.container;
      g.ui.refreshInventory();
    }
    g.ui.updateHotbar();
    g.ui.updateHUD();
  }
  executeStand(m) {
    const peer = this.peers.get(m.id);
    if (!peer || !Number.isSafeInteger(m.seq) || m.seq <= peer.lastSeq) return;
    peer.lastSeq = m.seq;
    if (
      performance.now() - peer.lastPose > 5000 ||
      !["summon", "primary", "secondary", "creative"].includes(m.payload?.slot)
    )
      return;
    peer.feedback = "";
    const before = { x: peer.player.x, y: peer.player.y, z: peer.player.z };
    const ok =
      m.payload.slot === "creative"
        ? grantCreativeStand(peer.context, m.payload.id)
        : activateStand(peer.context, m.payload.slot, damageEntity);
    if (
      Math.hypot(
        peer.player.x - before.x,
        peer.player.y - before.y,
        peer.player.z - before.z,
      ) > 0.1
    )
      peer.teleport = true;
    if (peer.teleport) peer.lastStandTeleport = performance.now();
    this.send({
      type: "ack",
      to: peer.id,
      seq: m.seq,
      ok,
      message: peer.feedback,
    });
    this.sendPrivate(peer);
  }
  executeSurvival(m) {
    const peer = this.peers.get(m.id),
      g = this.game;
    if (!peer || !Number.isSafeInteger(m.seq) || m.seq <= peer.lastSeq) return;
    peer.lastSeq = m.seq;
    peer.feedback = "";
    const ctx = peer.context;
    const finish = (ok, message = "") => {
      this.send({
        type: "ack",
        to: m.id,
        seq: m.seq,
        ok,
        message: message || peer.feedback,
      });
      this.sendPrivate(peer);
    };
    if (Number.isInteger(m.selected) && m.selected >= 0 && m.selected < 9)
      peer.inventory.selected = m.selected;
    if (m.kind === "respawn") {
      finish(respawnPeer(this, peer));
      return;
    }
    if (peer.player.health <= 0) {
      finish(false, "Respawn before acting.");
      return;
    }
    if (performance.now() - peer.lastPose > 5000) {
      finish(false, "Wait for your connection to catch up.");
      return;
    }
    ctx.target = peerTarget(g, peer);
    ctx.ui.container = peer.menu?.container;
    try {
      if (m.kind === "close") {
        closePeerCraft(ctx);
        peer.menu = null;
        finish(true);
        return;
      }
      if (m.kind === "menu") {
        const type = m.payload?.type;
        if (
          type !== "personal" &&
          !(type === "table" && ctx.target?.id === B.crafting_table)
        ) {
          finish(false, "Crafting table is out of reach.");
          return;
        }
        peer.menu = {
          type,
          container: null,
          target: type === "table" ? ctx.target : null,
        };
        finish(true);
        return;
      }
      if (m.kind === "inventory") {
        finish(inventoryOperation(this, peer, m.payload));
        return;
      }
      if (g.elapsed - peer.lastAction < 0.16) {
        finish(false);
        return;
      }
      peer.lastAction = g.elapsed;
      if (m.kind === "break") {
        finish(true);
        return;
      } // Actual mining advances on host physics ticks.
      if (m.kind === "drop") {
        const stack = peer.inventory.held;
        if (stack) {
          const count = m.payload?.all ? stack.count : 1;
          dropItem(
            ctx,
            { ...stack, count },
            peer.player.x - Math.sin(peer.player.yaw),
            peer.player.y + 1,
            peer.player.z - Math.cos(peer.player.yaw),
            30,
          );
          peer.inventory.consume(peer.inventory.selected, count);
        }
        finish(!!stack);
        return;
      }
      if (m.kind === "use") {
        const t = ctx.target;
        if (t?.id === B.bed && !peer.player.crouching) {
          peer.spawn = { x: peer.player.x, y: peer.player.y, z: peer.player.z };
          ctx.spawn = peer.spawn;
          finish(
            true,
            "Spawn point set. The host controls skipping the night.",
          );
          return;
        }
        if (t && ITEMS[peer.inventory.held?.id]?.block !== undefined) {
          const x = t.x + t.normal.x,
            y = t.y + t.normal.y,
            z = t.z + t.normal.z;
          if (
            BLOCKS[ITEMS[peer.inventory.held.id].block].solid &&
            [
              g.player,
              ...this.occupants().filter((p) => p !== peer.player),
            ].some((p) => intersectsBlock(p, x, y, z))
          ) {
            finish(false, "A player is standing there.");
            return;
          }
        }
        if (pistolUsesStyle(ctx)) {
          finish(false, "Style movement is host-only in the Survival beta.");
          return;
        }
        ctx.use();
        finish(true);
        return;
      }
      if(m.kind==="swap-hands"){finish(swapHands(ctx));return;}
      if(m.kind==="offhand-use"){finish(useOffhand(ctx));return;}
      if (m.kind === "attack") {
        finish(ctx.tryAttack());
        return;
      }
      if (m.kind === "release-use") {
        finish(releaseTrident(ctx) || (ctx.player.editionDraw?.hand==="off"?withOffhand(ctx,()=>releaseEditionWeapon(ctx)):releaseEditionWeapon(ctx)));
        return;
      }
      if (m.kind === "pistol") {
        finish(firePistols(ctx, damageEntity));
        return;
      }
      if (m.kind === "pulse") {
        finish(devinPulse(ctx));
        return;
      }
      if (m.kind === "seeker") {
        finish(launchSeeker(ctx));
        return;
      }
      finish(false, "Unsupported Survival action.");
    } catch {
      finish(false, "The action could not be applied.");
    }
  }
  occupants() {
    return this.isGuest
      ? (this.remotePoses || []).filter((p) => p.id !== this.id)
      : Array.from(this.peers.values(), (p) => p.player);
  }
  command(kind, payload = {}) {
    if (!this.connected || !this.sessionReady) return false;
    const now = performance.now();
    if (
      !["inventory", "menu", "close", "respawn"].includes(kind) &&
      now - (this.lastCommand || 0) < (["attack","offhand-use","release-use","swap-hands"].includes(kind)?35:170)
    )
      return false;
    if (!["inventory", "menu", "close", "respawn"].includes(kind))
      this.lastCommand = now;
    if (this.game.mode === "survival") this.sendInput();
    else this.send({ type: "pose", pose: cleanPose(poseFor(this.game)) });
    const seq = ++this.sequence;
    this.pending.set(seq, now);
    this.send({
      type: "command",
      seq,
      kind,
      held: this.game.inventory.held?.id,
      selected: this.game.inventory.selected,
      payload,
    });
    if (kind === "pistol") {
      this.game.player.matthewHand = 1 - (this.game.player.matthewHand || 0);
      this.game.audio?.tone?.(
        "pistol",
        this.game.player.matthewHand ? "silver" : "black",
      );
    }
    this.game.renderer.action(
      kind === "pistol"
        ? "fire"
        : kind === "break"
          ? "mine"
          : kind === "attack"
            ? "attack"
            : "use",
    );
    return true;
  }
  adopt(data) {
    if (
      !data ||
      !["creative", "survival"].includes(data.mode) ||
      !["overworld", "cinderwild"].includes(data.dimension) ||
      typeof data.seed !== "string" ||
      !Number.isInteger(data.generationVersion) ||
      data.generationVersion < 2 ||
      data.generationVersion > GENERATION_VERSION
    )
      throw Error("Unsupported shared world");
    const g = this.game;
    g.running = false;
    g.resetControls();
    g.id = null;
    g.name = data.name;
    g.dimension = data.dimension;
    g.mode = data.mode;
    g.difficulty = data.difficulty;
    g.world = new World(
      data.seed,
      data.edits,
      data.dimension,
      data.generationVersion,
    );
    g.world.palm = data.palm || null;
    g.world.protectedAreas = data.protectedAreas || [];
    g.rules = { keepInventory: false, ...data.rules };
    g.standProjectiles = [];
    g.world.weather = restoreWeather(data.weather, g.world.seedInt);
    g.world.relicClaimed = !!data.relicClaimed;
    g.world.settlements = data.settlements || {};
    g.world.containers = data.containers || {};
    g.world.cropTicks = data.crops || {};
    g.world.portals = data.portals || {};
    g.spawn = data.playerSpawn || data.spawn;
    g.time = data.time;
    g.tickCount = data.tickCount;
    g.world.tick = data.worldTick || 0;
    g.seekers = [];
    g.pistolTraces = [];
    g.realms = Object.fromEntries(
      Object.entries(data.realms || {}).map(([dim, state]) => [
        dim,
        restoreRealm(data.seed, dim, state),
      ]),
    );
    g.player = createPlayer(data.player);
    syncAchievements(g,data.player?.achievements,true);
    if (g.mode === "survival") Object.assign(g.player, data.player);
    else g.player.standData = data.player.standData || null;
    g.player.flying = g.mode === "creative";
    g.lastDeath = data.lastDeath;
    this.writeResume(data.resumeToken);
    if (g.mode === "creative")
      for (const [dx, dz] of [
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
        [0, 0],
      ]) {
        const p = { ...g.player, x: g.player.x + dx, z: g.player.z + dz };
        if (!collides(g.world, p, 1.8, 0.6)) {
          g.player.x = p.x;
          g.player.z = p.z;
          break;
        }
      }
    if (g.mode === "survival") g.inventory = new Inventory(data.inventory);
    else if (!g.inventory || !this.sessionReady) {
      g.inventory = new Inventory();
      [
        "grass",
        "stone",
        "log",
        "planks",
        "glass",
        "torch",
        "crafting_table",
        "oak_door",
        "devin_sword",
      ].forEach(
        (id, i) => (g.inventory.slots[i] = makeStack(id, ITEMS[id].stack)),
      );
    }
    g.entities = data.entities || [];
    g.drops = data.drops || [];
    g.portalCharge = 0;
    g.portalCooldown = 100;
    g.cameraMode = 0;
    g.active = true;
    g.renderer.setWorld(g.world);
    g.renderer.loadAround(g.player.x, g.player.z, 2, 9);
    g.ui.play();
    g.resume();
    g.ui.toast(
      g.mode === "survival"
        ? "Survival co-op beta · the host simulates and saves your inventory. T opens chat."
        : "Creative co-op · the host saves the world. T opens chat.",
      7000,
    );
  }
  applyState(s) {
    if (!s || s.dimension !== this.game.dimension) return;
    const g = this.game;
    for (const [key, id] of s.edits || []) {
      const xyz = key.split(",").map(Number);
      if (xyz.length === 3 && xyz.every(Number.isInteger) && BLOCKS[id])
        g.world.set(...xyz, id);
    }
    // The host applies gravity/block updates. Guests must not retain a second,
    // unconsumed simulation queue for every received edit.
    g.world.pending.length = 0;
    g.world.fluidQueue.clear();
    g.world.fluidBuckets.forEach((b) => (b.length = 0));
    if (s.palm !== undefined) installPalm(g.world, s.palm);
    g.world.protectedAreas = s.protectedAreas || [];
    g.rules = s.rules || { keepInventory: false };
    g.sharedStandProjectiles = s.standProjectiles || [];
    g.world.blockTimers = s.blockTimers || {};
    g.world.aquatic = s.aquatic || {
      growth: {},
      projectiles: [],
      achievements: {},
    };
    g.time = s.time;
    if (s.difficulty) g.difficulty = s.difficulty;
    g.tickCount = s.tickCount;
    g.world.tick = s.worldTick;
    g.world.weather = restoreWeather(s.weather, g.world.seedInt);
    g.world.relicClaimed = !!s.relicClaimed;
    const oldLaughs = new Map(
      (g.entities || [])
        .filter((e) => e.type === "watcher")
        .map((e) => [e.id, e.laughSerial || 0]),
    );
    g.entities = s.entities || [];
    for (const e of g.entities)
      if (
        e.type === "watcher" &&
        oldLaughs.has(e.id) &&
        (e.laughSerial || 0) > oldLaughs.get(e.id)
      )
        g.audio?.voice?.(g, e, "laugh");
    g.sharedBlockVisuals = s.blockVisuals || { openChests: [], blocks: [] };
    g.drops = s.drops || [];
    g.sharedSeekers = s.seekers || [];
    const oldIncursion = invasionState(g.world);
    g.world.settlements = s.settlements || g.world.settlements;
    if (
      invasionState(g.world)?.phase === "emerging" &&
      oldIncursion?.phase !== "emerging"
    )
      g.ui.announce("CINDERWORLD INCURSION", INVASION_ANNOUNCEMENT);
    g.pistolTraces = s.pistolTraces || [];
    g.hostileProjectiles = s.hostileProjectiles || [];
    g.world.embeddedArrows = restoreEmbeddedArrows(s.embeddedArrows);
  }
  frame(now, dt) {
    if (!this.connected || !this.sessionReady) return;
    const g = this.game;
    if (g.ui.screen === "multiplayer" && now >= (this.nextSessionUI || 0)) {
      this.nextSessionUI = now + 1000;
      g.ui.updateSession();
    }
    if (now >= (this.nextPing || 0)) {
      this.nextPing = now + 5000;
      this.send({ type: "ping", at: Date.now() });
    }
    if (this.isGuest) {
      if (now >= (this.nextPose || 0)) {
        this.nextPose = now + (g.mode === "survival" ? 50 : 100);
        if (g.mode === "survival") this.sendInput();
        else this.send({ type: "pose", pose: cleanPose(poseFor(g)) });
      }
      for (const [seq, at] of this.pending)
        if (now - at > 10000) {
          this.pending.delete(seq);
          g.ui.toast("The host is not responding. Check your connection.");
        }
      if (g.settings.particles !== "minimal")
        for (const q of g.sharedSeekers || [])
          g.renderer.arcane?.emit(q.x, q.y, q.z, 0, 0, 0, 0.25);
    } else {
      if (now >= (this.nextPrivate || 0)) {
        this.nextPrivate = now + 100;
        for (const peer of this.peers.values()) this.sendPrivate(peer);
      }
      if (this.sharedWorld !== g.world) {
        this.sharedWorld = g.world;
        this.lastEdits = new Map(g.world.edits);
        for (const peer of this.peers.values()) {
          Object.assign(peer.player, createPlayer(g.player), {
            flying: g.mode === "creative",
          });
          peer.context.player = peer.player;
          this.sendWelcome(peer);
        }
      }
      if (now >= (this.nextState || 0)) {
        this.nextState = now + 250;
        const edits = [];
        for (const [key, id] of g.world.edits)
          if (this.lastEdits.get(key) !== id) {
            edits.push([key, id]);
            this.lastEdits.set(key, id);
          }
        const palmChanged =
          this.lastPalmWorld !== g.world ||
          this.lastPalmRevision !== (g.world.palm?.revision || 0);
        this.lastPalmWorld = g.world;
        this.lastPalmRevision = g.world.palm?.revision || 0;
        this.send({
          type: "state",
          state: {
            dimension: g.dimension,
            difficulty: g.difficulty,
            edits,
            time: g.time,
            tickCount: g.tickCount,
            worldTick: g.world.tick,
            blockTimers: g.world.blockTimers,
            aquatic: g.world.aquatic,
            palm: palmChanged ? g.world.palm || null : undefined,
            protectedAreas: g.world.protectedAreas || [],
            rules: g.rules,
            standProjectiles: g.standProjectiles || [],
            weather: g.world.weather,
            relicClaimed: g.world.relicClaimed,
            blockVisuals: worldInteractionSnapshot(g),
            entities: g.entities,
            drops: g.drops,
            hostileProjectiles: g.hostileProjectiles || [],
            embeddedArrows: g.world.embeddedArrows || [],
            settlements: g.world.settlements,
            pistolTraces: g.pistolTraces || [],
            seekers: (g.seekers || []).map((q) => ({ x: q.x, y: q.y, z: q.z })),
          },
        });
      }
      if (now >= (this.nextPoses || 0)) {
        this.nextPoses = now + 100;
        const players = [
          {
            id: this.id,
            name: this.players.find((p) => p.id === this.id)?.name || "Host",
            ...cleanPose(poseFor(g)),
          },
          ...Array.from(this.peers.values(), (peer) => ({
            id: peer.id,
            name: peer.name,
            ...cleanPose({
              ...peer.player,
              skin: peer.skin,
              held: peer.held,
              equipment: peer.equipment,
            }),
          })),
        ];
        this.send({ type: "poses", players });
        this.remotePoses = players;
      }
    }
    this.renderPlayers(dt);
  }
  renderPlayers(dt) {
    const g = this.game,
      seen = new Set();
    for (const p of this.remotePoses || []) {
      if (p.id === this.id) continue;
      const clean = cleanPose(p);
      if (!clean) continue;
      seen.add(p.id);
      const signature = JSON.stringify([
        clean.skin,
        clean.held,
        clean.equipment,
        g.renderer.appliedPack,
      ]);
      let entry = this.models.get(p.id);
      if (!entry || entry.signature !== signature) {
        if (entry) g.renderer.disposeObject(entry.model);
        const model = createPlayerModel(
          clean.skin,
          clean.equipment.map((id) => (id ? makeStack(id) : null)),
          clean.held,
          g.renderer.atlas,
        );
        inheritPlayerMotion(entry?.model, model);
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 48;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#0008";
        ctx.fillRect(0, 0, 256, 48);
        ctx.font = "22px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "white";
        ctx.fillText(String(p.name || "Player").slice(0, 20), 128, 32);
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        const label = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: true,
          }),
        );
        label.scale.set(2.4, 0.45, 1);
        label.position.y = 2.2;
        model.add(label);
        model.position.set(clean.x, clean.y, clean.z);
        g.renderer.scene.add(model);
        entry = { model, signature };
        this.models.set(p.id, entry);
      }
      const m = entry.model,
        d = Math.hypot(m.position.x - clean.x, m.position.z - clean.z);
      m.position.lerp(
        new THREE.Vector3(clean.x, clean.y, clean.z),
        1 - Math.exp(-14 * dt),
      );
      const da = Math.atan2(
        Math.sin(clean.yaw - m.rotation.y),
        Math.cos(clean.yaw - m.rotation.y),
      );
      m.rotation.y += da * (1 - Math.exp(-14 * dt));
      m.visible = true;
      if (m.children[0]) m.children[0].visible = !clean.stand?.transformed;
      animatePlayerModel(m, clean, dt, d > 0.025, 0);
      animateMagic(
        m,
        g.visualTime ?? g.elapsed,
        g.settings.particles !== "minimal",
      );
    }
    for (const [id, entry] of this.models)
      if (!seen.has(id)) {
        g.renderer.disposeObject(entry.model);
        this.models.delete(id);
      }
  }
  clearModels() {
    for (const e of this.models.values())
      this.game.renderer.disposeObject(e.model);
    this.models.clear();
    this.remotePoses = [];
  }
  disconnect() {
    this.closed = true;
    this.connected = false;
    this.sessionReady = false;
    this.socket?.close();
    this.socket = null;
    this.clearModels();
    if (!this.isGuest) for (const id of this.peers.keys()) this.stashPeer(id);
    this.peers.clear();
    this.pending.clear();
    this.players = [];
  }
}
