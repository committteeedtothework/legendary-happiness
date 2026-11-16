import { realmState, exportRealm, restoreRealm, travel } from "./realms.js";
import { peerContext, closePeerCraft } from "./coop-survival.js";
import { tickSurvival, damageEntity } from "./simulation.js";
import { tickPalm } from "./devils-palm.js";
import { tickPortals } from "./portals.js";
import { tickEndTravel } from "./end-runtime.js";
const dimensions = new Set(["overworld", "cinderwild", "end"]);
const transient = [
  "hostileProjectiles",
  "standProjectiles",
  "seekers",
  "pistolTraces",
];
const quiet = {
  action() {},
  setWorld() {},
  loadAround() {},
  breakParticles() {},
  pulseEffect() {},
  combatImpact() {},
  explosionEffect() {},
  guardianWave() {},
  arcane: { emit() {}, burst() {} },
};
// One authoritative world per dimension, shared by all players in that dimension.
export class SharedRealm {
  constructor(multiplayer) {
    this.m = multiplayer;
    this.g = multiplayer.game;
    this.contexts = new Map();
    this.origin = this.g.dimension || "overworld";
    this.g.portalLinks ||= {};
  }
  get base() {
    return this.g.dimension !== this.origin
      ? this.contexts.get(this.origin) || null
      : null;
  }
  contextFor(dimension) {
    if (!dimensions.has(dimension)) throw Error("Unknown dimension.");
    if (dimension === this.g.dimension) return this.g;
    if (this.contexts.has(dimension)) return this.contexts.get(dimension);
    const g = this.g;
    g.realms ||= {};
    const state = (g.realms[dimension] ||= restoreRealm(
      g.world.seed,
      dimension,
    ));
    const ctx = Object.create(g);
    Object.assign(ctx, {
      ...state,
      dimension,
      isBackgroundWorld: true,
      player: { ...structuredClone(g.player), multiplayerAway: true },
      spawn: { ...g.spawn },
      time: g.time,
      tickCount: g.tickCount,
      portalCooldown: 0,
      portalCharge: 0,
      renderer: quiet,
      audio: { tone() {}, world() {}, voice() {}, standSound() {} },
      damage() {},
      travelDimension() {},
      save: () => {
        this.sync();
        return g.save();
      },
    });
    for (const k of transient) ctx[k] = [];
    this.contexts.set(dimension, ctx);
    return ctx;
  }
  before(dimension) {
    if (!this.m.connected || this.m.isGuest || dimension === this.g.dimension)
      return;
    this.sync();
    const g = this.g,
      old = g.dimension;
    g.realms ||= {};
    g.realms[old] = realmState(g);
    // Detach the outgoing world before selectRealm changes the visible game.
    const ctx = Object.create(g);
    Object.assign(ctx, {
      ...realmState(g),
      dimension: old,
      isBackgroundWorld: true,
      player: { ...structuredClone(g.player), multiplayerAway: true },
      spawn: { ...g.spawn },
      time: g.time,
      tickCount: g.tickCount,
      portalCooldown: 0,
      portalCharge: 0,
      renderer: quiet,
      audio: { tone() {}, world() {}, voice() {}, standSound() {} },
      damage() {},
      travelDimension() {},
      save: () => {
        this.sync();
        return g.save();
      },
    });
    for (const k of transient) ctx[k] = g[k] || [];
    ctx.simulatedAt = g.tickCount;
    this.contexts.set(old, ctx);
    this.m.clearModels();
  }
  after() {
    const old = this.contexts.get(this.g.dimension);
    if (old) for (const k of transient) this.g[k] = old[k] || [];
    this.contexts.delete(this.g.dimension);
    for (const p of this.m.peers.values()) p.context = peerContext(this.m, p);
    this.sync();
  }
  gameFor(peer) {
    return this.contextFor(
      peer?.dimension || peer?.context?.dimension || this.g.dimension,
    );
  }
  switchPeer(peer, dimension) {
    if (!dimensions.has(dimension)) throw Error("Unknown dimension.");
    closePeerCraft(peer.context);
    peer.menu = null;
    peer.keys = new Set();
    peer.mine = false;
    const target = this.contextFor(dimension),
      ctx = peer.context;
    peer.dimension = dimension;
    Object.setPrototypeOf(ctx, target);
    for (const k of ["world", "entities", "drops", ...transient]) delete ctx[k];
    delete ctx.dimension;
    ctx.portalCooldown = 100;
    ctx.portalCharge = 0;
    ctx.target = null;
    ctx.multiplayer.occupants = () => [
      ...(target === this.g && !this.g.player.multiplayerAway
        ? [this.g.player]
        : []),
      ...this.m.occupants(dimension),
    ];
    peer.teleport = true;
    this.m.clearModels();
    return ctx;
  }
  travelPeer(peer, portal) {
    if (peer.player.health <= 0 || peer.player.multiplayerAway) return false;
    const ctx = peer.context;
    if (
      !Object.values(ctx.world.portals || {}).some(
        (p) => p === portal || JSON.stringify(p) === JSON.stringify(portal),
      )
    )
      return false;
    this.travelling = peer;
    try {
      travel(ctx, portal);
      this.finishTravel(peer);
      return true;
    } finally {
      this.travelling = null;
    }
  }
  finishTravel(peer) {
    peer.context.player = peer.player;
    peer.teleport = true;
    this.m.sendWelcome(peer);
    this.m.stashPeer(peer.id);
    this.g.save()?.catch(() => {});
  }
  tickPeerTravel(peer) {
    const ctx = peer.context;
    if (peer.player.health <= 0 || peer.player.multiplayerAway) return;
    const before = peer.dimension,
      epoch = peer.realmEpoch;
    this.travelling = peer;
    try {
      if (!tickEndTravel(ctx)) tickPortals(ctx);
      if (before !== peer.dimension && epoch === peer.realmEpoch)
        this.finishTravel(peer);
    } finally {
      this.travelling = null;
    }
  }
  sync() {
    this.g.realms ||= {};
    for (const [dim, ctx] of this.contexts) {
      ctx.rules = this.g.rules;
      ctx.mode = this.g.mode;
      ctx.difficulty = this.g.difficulty;
      this.g.realms[dim] = realmState(ctx);
    }
  }
  anchor(ctx) {
    const p = [...this.m.peers.values()].find(
      (p) =>
        p.dimension === ctx.dimension &&
        p.player.health > 0 &&
        !p.player.multiplayerAway,
    )?.player;
    if (p) for (const k of ["x", "y", "z"]) ctx.player[k] = p[k];
  }
  tickBackground() {
    this.sync();
    const active = new Set(
      [...this.m.peers.values()]
        .filter((p) => !p.player.multiplayerAway)
        .map((p) => p.dimension),
    );
    for (const dim of active) {
      if (dim === this.g.dimension) continue;
      const ctx = this.contextFor(dim);
      if (ctx.simulatedAt === this.g.tickCount) continue;
      this.anchor(ctx);
      ctx.tickCount = this.g.tickCount - 1;
      ctx.time =
        this.g.time - (this.g.rules?.doDaylightCycle === false ? 0 : 1);
      tickSurvival(ctx);
      tickPalm(ctx, damageEntity);
      ctx.simulatedAt = this.g.tickCount;
    }
  }
  snapshot(dimension = this.g.dimension) {
    this.sync();
    const data = this.g.snapshot(),
      ctx = this.contextFor(dimension);
    return {
      ...data,
      ...exportRealm(realmState(ctx)),
      dimension,
      time: this.g.time,
      tickCount: this.g.tickCount,
      spawn: this.g.spawn,
      realms: {},
    };
  }
  clear() {
    this.sync();
    this.contexts.clear();
    this.origin = this.g.dimension || "overworld";
  }
}
