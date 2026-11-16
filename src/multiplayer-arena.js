import { titanSession, titanInput, stepTitan } from "./giganto-simulation.js";
import { wyvernSession, wyvernInput, stepWyvern } from "./wyvern-simulation.js";
import { lockTitanCinematics } from "./titan-finale.js";
import { titanReturnReady } from "./titan-return.js";
import { recordTitanAchievement } from "./achievements.js";
import { makeStack } from "./data.js";
import { awardXP } from "./equipment.js";
const clone = (v) => structuredClone(v);
const fields = [
  "forward",
  "back",
  "left",
  "right",
  "boost",
  "up",
  "down",
  "parry",
  "hit",
  "cyloop",
];
function viewInput(raw) {
  if (raw === undefined) return undefined;
  if (
    !raw ||
    !Number.isFinite(raw.yaw) ||
    Math.abs(raw.yaw) > 1e6 ||
    !Number.isFinite(raw.pitch) ||
    Math.abs(raw.pitch) > 1.55
  )
    throw Error("Invalid arena look.");
  return { yaw: raw.yaw, pitch: raw.pitch, lock: raw.lock === true };
}
function applyView(session, view) {
  if (view) {
    session.avatar.yaw = view.yaw;
    session.avatar.pitch = view.pitch;
    session.lock = view.lock;
  }
}
function sessionView(s) {
  return s
    ? { yaw: s.avatar.yaw, pitch: s.avatar.pitch, lock: s.lock }
    : undefined;
}
export function arenaFrame(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw Error("Invalid arena input.");
  const input = {};
  for (const key of fields) input[key] = raw[key] === true;
  for (const key of ["moveX", "moveY"])
    if (raw[key] !== undefined) {
      if (!Number.isFinite(raw[key]) || Math.abs(raw[key]) > 2)
        throw Error("Invalid arena movement.");
      input[key] = Math.max(-1, Math.min(1, raw[key]));
    }
  const actions = raw.actions || [];
  if (
    !Array.isArray(actions) ||
    actions.length > 6 ||
    actions.some(
      (a) => !/^[-a-z]{1,24}$/.test(typeof a === "string" ? a : a?.key || ""),
    )
  )
    throw Error("Invalid arena action.");
  return {
    ...input,
    actions: actions.map((a) =>
      typeof a === "string" ? a : { key: a.key, view: viewInput(a.view) },
    ),
    view: viewInput(raw.view),
    cinematicTime: Number.isFinite(raw.cinematicTime)
      ? Math.max(0, Math.min(120, raw.cinematicTime))
      : undefined,
  };
}
export function emptySession(record) {
  const r = clone(record);
  r.session = null;
  delete r.activeTitan;
  delete r.wyvern;
  return r;
}
export class MultiplayerArena {
  constructor(m) {
    this.m = m;
    this.g = m.game;
    this.pending = new Map();
    this.sequence = 0;
    this.requests = 0;
    this.frames = [];
    this.actions = [];
    this.records = {};
  }
  publicRecords() {
    const r = this.g.giganto?.export?.();
    return r
      ? {
          ...emptySession(r),
          wyvern: r.wyvern ? emptySession(r.wyvern) : undefined,
        }
      : null;
  }
  ready(player) {
    if (
      player.health <= 0 ||
      player.multiplayerAway ||
      !player.onGround ||
      Math.abs(player.vy || 0) > 0.2
    )
      throw Error("Stand on safe ground first.");
    if (
      player.pvpLastCombat !== undefined &&
      this.m.simulationGame.tickCount - player.pvpLastCombat < 100
    )
      throw Error("Leave combat before entering.");
  }
  hostBegin(peer, titan) {
    this.ready(peer.player);
    if (
      !["giganto", "wyvern"].includes(titan) ||
      this.m.gameFor(peer).dimension !== "overworld"
    )
      throw Error("Portal unavailable.");
    const exported = this.publicRecords(),
      global = titan === "wyvern" ? exported?.wyvern : exported;
    peer.titanRecords ||= {};
    let record = peer.titanRecords[titan];
    if (!record) {
      if (!global) throw Error("Portal unavailable.");
      record = peer.titanRecords[titan] = emptySession(global);
      record.ledger = [];
      record.used = [];
    }
    if (
      !record.portal &&
      global?.portal &&
      !record.ledger.includes(global.portal.id)
    )
      record.portal = clone(global.portal);
    const p = record.portal;
    if (
      !p ||
      !record.config.enabled ||
      Math.hypot(
        peer.player.x - p.x - 0.5,
        peer.player.y - p.y,
        peer.player.z - p.z - 0.5,
      ) > 6 ||
      this.m.simulationGame.tickCount < record.cooldownUntil
    )
      throw Error("Move closer to an active portal.");
    const session =
      record.session ||
      (titan === "wyvern" ? wyvernSession : titanSession)(
        { ...record.config, cinematics: true },
        p.id,
      );
    lockTitanCinematics(session);
    session.original = {
      player: clone(peer.player),
      inventory: peer.inventory.export(),
      dimension: this.m.gameFor(peer).dimension,
      cameraMode: 0,
    };
    const token = crypto.randomUUID();
    record.session = session;
    peer.arena = {
      token,
      titan,
      session,
      record,
      seq: 0,
      credits: 90,
      clock: performance.now(),
    };
    peer.player.multiplayerAway = true;
    peer.keys = new Set();
    peer.mine = false;
    peer.menu = null;
    recordTitanAchievement(peer.context, session, {
      type: "stage",
      stage: "intro",
    });
    return {
      token,
      titan,
      session: clone(session),
      record: emptySession(record),
    };
  }
  hostFrames(peer, m) {
    const a = peer?.arena;
    if (
      !a ||
      m.token !== a.token ||
      !Number.isSafeInteger(m.seq) ||
      m.seq !== a.seq + 1 ||
      !Array.isArray(m.frames) ||
      m.frames.length < 1 ||
      m.frames.length > 12
    )
      return false;
    const frames = m.frames.map(arenaFrame),
      now = performance.now();
    a.credits = Math.min(90, a.credits + Math.max(0, now - a.clock) * 0.06);
    a.clock = now;
    if (frames.length > a.credits) return false;
    a.credits -= frames.length;
    a.seq = m.seq;
    const step = a.titan === "wyvern" ? stepWyvern : stepTitan,
      action = a.titan === "wyvern" ? wyvernInput : titanInput;
    for (const f of frames) {
      a.session.events = [];
      for (const entry of f.actions) {
        if (typeof entry === "object") applyView(a.session, entry.view);
        action(a.session, typeof entry === "string" ? entry : entry.key);
      }
      applyView(a.session, f.view);
      for (const event of a.session.events || [])
        recordTitanAchievement(peer.context, a.session, event);
      if (
        ["phase", "finale"].includes(a.session.stage) &&
        f.cinematicTime !== undefined &&
        Math.abs(f.cinematicTime - a.session.stageTime) < 0.35
      )
        a.session.stageTime = f.cinematicTime;
      step(a.session, f, 1 / 60);
      for (const event of a.session.events || [])
        recordTitanAchievement(peer.context, a.session, event);
    }
    return true;
  }
  hostFinish(peer, token, won) {
    const a = peer.arena;
    if (!a || token !== a.token) throw Error("Arena session expired.");
    if (won && (!a.session.won || !titanReturnReady(a.session)))
      throw Error("The host has not confirmed victory.");
    const r = a.record,
      s = a.session;
    if (won && !r.ledger.includes(s.id)) {
      r.ledger.push(s.id);
      for (const [id, count] of [
        ["diamond", 6],
        ["hellfire_ingot", 8],
      ]) {
        const left = peer.inventory.add(makeStack(id, count));
        if (left)
          this.m.gameFor(peer).drops.push({
            uid: `titan:${peer.id}:${s.id}:${id}`,
            id,
            count: left,
            x: peer.player.x,
            y: peer.player.y + 0.4,
            z: peer.player.z,
            vy: 0,
            age: 0,
            delay: 10,
          });
      }
      awardXP(peer.context, 100);
    }
    if (won) {
      if (r.portal) r.used.push(r.portal.cell);
      r.portal = null;
      r.cooldownUntil =
        this.m.simulationGame.tickCount + Math.round(r.config.cooldown * 20);
      r.session = null;
    }
    // Exiting without victory keeps an authoritative checkpoint for a later entry.
    delete peer.player.multiplayerAway;
    peer.arena = null;
    peer.teleport = true;
    return {
      player: clone(peer.player),
      inventory: peer.inventory.export(),
      spawn: peer.spawn,
      lastDeath: peer.lastDeath,
      teleport: true,
      titanRecords: clone(peer.titanRecords),
    };
  }
  receive(m) {
    if (m.type === "arena-response") {
      const p = this.pending.get(m.request);
      if (!p) return true;
      this.pending.delete(m.request);
      clearTimeout(p.timeout);
      m.ok
        ? p.resolve(m.data)
        : p.reject(Error(m.message || "Arena request failed."));
      return true;
    }
    if (m.type === "arena-error") {
      this.error = m.message || "Arena connection lost.";
      this.g.ui.toast(this.error);
      return true;
    }
    if (this.m.isGuest) return false;
    const peer = this.m.peers.get(m.id);
    if (!peer) return true;
    if (m.type === "arena-input") {
      try {
        if (!this.hostFrames(peer, m))
          throw Error("Arena input could not be synchronized.");
      } catch (e) {
        this.m.send({ type: "arena-error", to: peer.id, message: e.message });
      }
      return true;
    }
    if (m.type === "arena-request") {
      let data;
      try {
        if (m.action === "begin") data = this.hostBegin(peer, m.titan);
        else if (m.action === "finish")
          data = this.hostFinish(peer, m.token, m.won === true);
        else throw Error("Unsupported arena request.");
        this.m.send({
          type: "arena-response",
          to: peer.id,
          request: m.request,
          ok: true,
          data,
        });
        this.m.sendPrivate(peer);
        this.g.save()?.catch(() => {});
      } catch (e) {
        this.m.send({
          type: "arena-response",
          to: peer.id,
          request: m.request,
          ok: false,
          message: e.message,
        });
      }
      return true;
    }
    return false;
  }
  rpc(action, data = {}) {
    return new Promise((resolve, reject) => {
      const request = ++this.requests,
        timeout = setTimeout(() => {
          this.pending.delete(request);
          reject(Error("The host did not respond."));
        }, 12000);
      this.pending.set(request, { resolve, reject, timeout });
      if (!this.m.send({ type: "arena-request", request, action, ...data })) {
        clearTimeout(timeout);
        this.pending.delete(request);
        reject(Error("Connection lost."));
      }
    });
  }
  async begin(titan) {
    if (!this.m.connected) return null;
    if (!this.m.isGuest) {
      this.ready(this.g.player);
      this.g.player.multiplayerAway = true;
      return null;
    }
    const data = await this.rpc("begin", { titan });
    this.token = data.token;
    this.sequence = 0;
    this.frames = [];
    this.actions = [];
    this.error = null;
    this.g.player.multiplayerAway = true;
    return data;
  }
  action(key) {
    if (this.token && this.m.isGuest && this.actions.length < 64)
      this.actions.push({ key, view: sessionView(this.g.giganto?.session) });
  }
  step(s, input, dt, kind) {
    if (this.token && this.m.isGuest) {
      this.frames.push(
        arenaFrame({
          ...input,
          view: sessionView(s),
          actions: this.actions.splice(0, 6),
          cinematicTime: ["phase", "finale"].includes(s.stage)
            ? s.stageTime
            : undefined,
        }),
      );
      if (this.frames.length >= 8) this.flush();
    }
    return (kind === "wyvern" ? stepWyvern : stepTitan)(s, input, dt);
  }
  flush() {
    if (!this.token || !this.frames.length) return;
    while (this.frames.length) {
      const frames = this.frames.splice(0, 12);
      this.m.send({
        type: "arena-input",
        token: this.token,
        seq: ++this.sequence,
        frames,
      });
    }
  }
  async finish(won) {
    if (!this.m.connected || !this.m.isGuest) return;
    if (!this.token) throw Error("Reconnect to the host before returning.");
    this.flush();
    if (this.error) throw Error(this.error);
    this.lastPrivate = await this.rpc("finish", { token: this.token, won });
    this.token = null;
  }
  complete() {
    if (this.g.player) delete this.g.player.multiplayerAway;
    if (this.m.isGuest && this.lastPrivate) {
      const state = this.lastPrivate;
      this.lastPrivate = null;
      this.records = state.titanRecords || this.records;
      this.m.applyPrivate(state);
    }
    this.frames = [];
    this.actions = [];
  }
  sync(records) {
    if (!records || !this.g.giganto || this.g.giganto.active) return;
    for (const titan of ["giganto", "wyvern"]) {
      const incoming = titan === "wyvern" ? records.wyvern : records;
      if (!incoming) continue;
      const local = this.records[titan];
      let source = local || incoming;
      if (
        local &&
        !local.portal &&
        incoming.portal &&
        !local.ledger.includes(incoming.portal.id)
      ) {
        local.portal = clone(incoming.portal);
        local.config = clone(incoming.config);
        source = local;
      }
      const r =
        titan === "wyvern"
          ? this.g.giganto.wyvern.record
          : this.g.giganto.record;
      r.portal = source.portal ? clone(source.portal) : null;
      r.cooldownUntil = source.cooldownUntil;
      r.used = clone(source.used || []);
      r.ledger = clone(source.ledger || []);
    }
  }
  disconnected() {
    for (const p of this.pending.values()) {
      clearTimeout(p.timeout);
      p.reject(Error("Connection lost."));
    }
    this.pending.clear();
    this.token = null;
    this.frames = [];
    this.actions = [];
    this.lastPrivate = null;
    this.records = {};
    this.error = null;
    if (this.g.player) delete this.g.player.multiplayerAway;
  }
}
