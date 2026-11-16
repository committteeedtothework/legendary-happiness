import { realmState, exportRealm } from "./realms.js";
import { peerContext } from "./coop-survival.js";
// The owner's private expedition and the shared realm have separate simulation
// contexts. Guests keep their world, positions and inventories while watching.
export class SharedRealm {
  constructor(multiplayer) {
    this.m = multiplayer;
    this.g = multiplayer.game;
  }
  before(dimension) {
    if (!this.m.connected || this.m.isGuest || dimension === this.g.dimension)
      return;
    if (this.base) {
      this.returning = dimension === this.base.dimension;
      return;
    }
    const g = this.g,
      b = (this.base = Object.create(g));
    const quiet = {
      action() {},
      breakParticles() {},
      pulseEffect() {},
      combatImpact() {},
      explosionEffect() {},
      guardianWave() {},
      arcane: { emit() {}, burst() {} },
    };
    Object.assign(b, {
      isBackgroundWorld: true,
      world: g.world,
      dimension: g.dimension,
      entities: g.entities,
      drops: g.drops,
      time: g.time,
      tickCount: g.tickCount,
      player: { ...structuredClone(g.player), multiplayerAway: true },
      spawn: { ...g.spawn },
      inventory: g.inventory,
      hostileProjectiles: g.hostileProjectiles,
      standProjectiles: g.standProjectiles,
      seekers: g.seekers,
      pistolTraces: g.pistolTraces,
      renderer: quiet,
      audio: { tone() {}, world() {}, voice() {}, standSound() {} },
      damage() {},
      save: () => {
        this.sync();
        return g.save();
      },
    });
    this.m.clearModels();
    for (const p of this.m.peers.values()) p.context = peerContext(this.m, p);
  }
  after() {
    if (!this.base || !this.returning) return;
    const b = this.base;
    this.g.time = b.time;
    this.g.tickCount = b.tickCount;
    this.base = null;
    this.returning = false;
    for (const p of this.m.peers.values()) p.context = peerContext(this.m, p);
  }
  sync() {
    if (!this.base) return;
    this.base.rules = this.g.rules;
    this.base.difficulty = this.g.difficulty;
    this.g.realms[this.base.dimension] = realmState(this.base);
  }
  anchor() {
    if (!this.base) return;
    const p = [...this.m.peers.values()].find(
      (p) => p.player.health > 0 && !p.player.multiplayerAway,
    )?.player;
    if (p) for (const k of ["x", "y", "z"]) this.base.player[k] = p[k];
  }
  snapshot() {
    this.sync();
    const data = this.g.snapshot();
    if (!this.base) return data;
    return {
      ...data,
      ...exportRealm(realmState(this.base)),
      dimension: this.base.dimension,
      time: this.base.time,
      tickCount: this.base.tickCount,
      spawn: this.base.spawn,
    };
  }
  clear() {
    this.sync();
    if (this.base) {
      this.g.time = Math.max(this.g.time, this.base.time);
      this.g.tickCount = Math.max(this.g.tickCount, this.base.tickCount);
    }
    this.base = null;
    this.returning = false;
  }
}
