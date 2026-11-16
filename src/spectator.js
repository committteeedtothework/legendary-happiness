import { playerActors } from "./pvp.js";
export function watchMetadata(game) {
  const s = game.giganto?.active && game.giganto.session;
  if (s)
    return {
      arena: true,
      title: s.titan === "wyvern" ? "WYVERN" : "GIGANTO",
      phase: s.phase || 1,
      health: Math.max(0, Math.min(1, s.hp / s.maxHp)),
      rings: Math.floor(s.rings || 0),
    };
  const trial = game.player.standData?.trial;
  return {
    arena: false,
    title:
      trial?.phase === "trial"
        ? "Trial"
        : game.dimension === "end"
          ? "The End"
          : game.dimension === "cinderwild"
            ? "Cinderworld"
            : "Overworld",
    phase: 0,
    health: Math.max(0, game.player.health / 20),
    rings: 0,
  };
}
export class SpectatorSession {
  constructor(multiplayer) {
    this.m = multiplayer;
    this.g = multiplayer.game;
    this.viewers = [];
    this.peers = new Map();
    this.requests = new Map();
    this.sequence = 0;
    this.generation = 0;
  }
  request(target) {
    if (!this.m.connected) return false;
    if (target && this.g.giganto?.active) {
      this.g.ui.toast("Return from the encounter first.");
      return false;
    }
    this.m.send({ type: "watch-request", target: target || null });
    return true;
  }
  approve(viewer, target) {
    const m = this.m,
      g = this.g;
    if (m.isGuest) return;
    const actor = playerActors(m.simulationGame).find((p) => p.id === viewer),
      subject = playerActors(m.simulationGame).find((p) => p.id === target);
    const deny = (text) =>
      m.send({ type: "watch-denied", to: viewer, message: text });
    if (!actor) return;
    if (target) {
      if (g.rules?.allowSpectating === false)
        return deny("Spectating is disabled.");
      if (!subject || viewer === target || this.requests.has(target))
        return deny("That player is unavailable.");
      if (
        actor.player.health <= 0 ||
        actor.player.multiplayerAway ||
        actor.player.standData?.trial?.phase === "trial" ||
        !actor.player.onGround ||
        Math.abs(actor.player.vy || 0) > 0.2
      )
        return deny("Stand on safe ground first.");
      if (
        actor.player.pvpLastCombat !== undefined &&
        g.tickCount - actor.player.pvpLastCombat < 100
      )
        return deny("Leave combat before spectating.");
      for (const [other, subject] of [...this.requests])
        if (subject === viewer) this.approve(other, null);
      actor.player.multiplayerAway = true;
      actor.player.vx = actor.player.vy = actor.player.vz = 0;
      this.requests.set(viewer, target);
      if (actor.keys) {
        actor.keys = new Set();
        actor.mine = false;
      }
    } else {
      if (this.requests.has(viewer)) delete actor.player.multiplayerAway;
      this.requests.delete(viewer);
    }
    m.send({ type: "watch-approved", to: viewer, target });
  }
  async receive(message) {
    if (message.type === "watch-request") {
      this.approve(message.viewer, message.target);
      return true;
    }
    if (message.type === "watch-state") {
      if (message.target) this.open(message.target, message.name);
      else this.close();
      return true;
    }
    if (message.type === "watch-denied") {
      this.g.ui.toast(message.message);
      return true;
    }
    if (message.type === "watchers") {
      this.setViewers(message.viewers || []);
      return true;
    }
    if (message.type === "watch-signal") {
      await this.signal(message.from, message.signal);
      return true;
    }
    if (message.type === "watch-meta") {
      if (message.from === this.target) this.metadata(message.meta);
      return true;
    }
    if (message.type === "watch-frame") {
      this.imageFrame(message);
      return true;
    }
    return false;
  }
  open(target, name) {
    if (this.target) this.close(false);
    this.target = target;
    this.lastImage = -1;
    this.wasRunning = this.g.running;
    this.g.resetControls();
    this.g.running = false;
    this.g.player.multiplayerAway = true;
    document.exitPointerLock?.();
    this.g.audio.watchMuted = true;
    this.g.audio.updateVolume();
    const panel = document.createElement("section");
    panel.className = "spectator-view";
    panel.setAttribute("aria-label", "Spectator view");
    panel.innerHTML =
      '<video playsinline autoplay></video><img alt="Live game view"><div class="spectator-heading"><strong></strong><span></span><button data-watch-audio hidden>Enable Audio</button><button data-watch-stop>Stop Watching</button></div><div class="spectator-meters"><span></span><progress max="1"></progress></div><p class="spectator-connecting">Connecting…</p>';
    panel.querySelector("strong").textContent = name || "Player";
    panel.querySelector("[data-watch-stop]").onclick = () => this.request(null);
    panel.querySelector("[data-watch-audio]").onclick = () => {
      const video = panel.querySelector("video");
      video.muted = false;
      video
        .play()
        .then(() => (panel.querySelector("[data-watch-audio]").hidden = true))
        .catch(() => {
          video.muted = true;
        });
    };
    document.querySelector("#app").append(panel);
    this.panel = panel;
    this.g.ui.hud.hidden = true;
    this.key = (e) => {
      if (e.code === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.request(null);
      } else if (e.target.tagName !== "BUTTON") {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    addEventListener("keydown", this.key, true);
    addEventListener("keyup", this.key, true);
    this.lastFrameAt = performance.now();
  }
  close(restore = true) {
    if (this.panel) {
      this.panel.querySelector("video").srcObject = null;
      this.panel.remove();
      this.panel = null;
    }
    if (this.key) {
      removeEventListener("keydown", this.key, true);
      removeEventListener("keyup", this.key, true);
      this.key = null;
    }
    const was = this.target;
    this.target = null;
    this.live = false;
    if (was) {
      delete this.g.player.multiplayerAway;
      this.g.audio.watchMuted = false;
      this.g.audio.updateVolume();
      if (restore) {
        if (this.wasRunning) {
          this.g.ui.play();
          this.g.resume();
        } else this.g.ui.pause();
      }
    }
    for (const [id, p] of this.peers)
      if (p.role === "viewer") {
        p.pc.close();
        this.peers.delete(id);
      }
  }
  setViewers(viewers) {
    const old = new Set(this.viewers.map((v) => v.id));
    this.viewers = viewers
      .filter((v) => typeof v.id === "string" && v.id !== this.m.id)
      .slice(0, 7);
    const current = new Set(this.viewers.map((v) => v.id));
    for (const id of old)
      if (!current.has(id)) {
        this.peers.get(id)?.pc.close();
        this.peers.delete(id);
      }
    if (!this.viewers.length) {
      this.stopPublishing();
      return;
    }
    for (const v of this.viewers)
      if (!this.peers.has(v.id))
        this.offer(v.id).catch(() => this.peers.delete(v.id));
  }
  media() {
    const canvas = this.composite();
    if (!this.stream) {
      this.stream = canvas.captureStream(24);
      const audio = this.g.audio;
      if (audio.context?.createMediaStreamDestination && audio.compressor) {
        this.audioBus = audio.context.createMediaStreamDestination();
        audio.compressor.connect(this.audioBus);
        for (const track of this.audioBus.stream.getAudioTracks())
          this.stream.addTrack(track);
      }
    }
    return this.stream;
  }
  connection(id, role) {
    const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      }),
      record = { pc, role, candidates: [] };
    this.peers.set(id, record);
    pc.onicecandidate = (e) => {
      if (e.candidate)
        this.m.send({
          type: "watch-signal",
          to: id,
          signal: { candidate: e.candidate.toJSON() },
        });
    };
    pc.onconnectionstatechange = () => {
      if (
        role === "viewer" &&
        ["failed", "disconnected", "closed"].includes(pc.connectionState) &&
        this.target === id
      ) {
        this.live = false;
        this.panel?.classList.remove("spectator-live");
        this.m.send({ type: "watch-mode", frames: true });
      }
    };
    pc.ontrack = (e) => {
      if (role !== "viewer" || this.target !== id || !this.panel) return;
      const video = this.panel.querySelector("video");
      if (video.srcObject !== e.streams[0]) video.srcObject = e.streams[0];
      video.volume = Math.max(0, Math.min(1, this.g.settings.volume));
      const show = () => {
        if (this.target !== id) return;
        this.live = true;
        this.panel.classList.add("spectator-live");
        this.panel.querySelector(".spectator-connecting").hidden = true;
        this.m.send({ type: "watch-mode", frames: false });
      };
      video.onloadeddata = show;
      video.onplaying = show;
      if (video.readyState >= 2) show();
      if (video.volume === 0) video.muted = true;
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {});
        this.panel
          ?.querySelector("[data-watch-audio]")
          ?.removeAttribute("hidden");
      });
    };
    return record;
  }
  async offer(id) {
    if (
      !globalThis.RTCPeerConnection ||
      !this.g.renderer.gl.domElement.captureStream
    )
      return;
    const record = this.connection(id, "publisher");
    for (const track of this.media().getTracks())
      record.pc.addTrack(track, this.stream);
    const offer = await record.pc.createOffer();
    if (!this.peers.has(id)) return;
    await record.pc.setLocalDescription(offer);
    this.m.send({
      type: "watch-signal",
      to: id,
      signal: { description: record.pc.localDescription.toJSON() },
    });
  }
  async signal(id, signal) {
    if (!globalThis.RTCPeerConnection) return;
    let record = this.peers.get(id);
    if (!record) {
      if (this.target !== id || signal.description?.type !== "offer") return;
      record = this.connection(id, "viewer");
    }
    try {
      if (signal.description) {
        await record.pc.setRemoteDescription(signal.description);
        for (const c of record.candidates.splice(0))
          await record.pc.addIceCandidate(c);
        if (signal.description.type === "offer") {
          const answer = await record.pc.createAnswer();
          await record.pc.setLocalDescription(answer);
          this.m.send({
            type: "watch-signal",
            to: id,
            signal: { description: record.pc.localDescription.toJSON() },
          });
        }
      }
      if (signal.candidate) {
        if (record.pc.remoteDescription)
          await record.pc.addIceCandidate(signal.candidate);
        else if (record.candidates.length < 64)
          record.candidates.push(signal.candidate);
      }
    } catch {
      record.pc.close();
      this.peers.delete(id);
      if (this.target === id) {
        this.live = false;
        this.m.send({ type: "watch-mode", frames: true });
      }
    }
  }
  metadata(meta) {
    if (!this.panel || !meta) return;
    this.panel.querySelector(".spectator-heading span").textContent =
      meta.title || "";
    const meters = this.panel.querySelector(".spectator-meters");
    meters.classList.toggle("arena", !!meta.arena);
    meters.querySelector("span").textContent = meta.arena
      ? `Phase ${meta.phase} · Rings ${meta.rings}`
      : "";
    meters.querySelector("progress").value = meta.health;
  }
  imageFrame(frame) {
    if (
      frame.from !== this.target ||
      !this.panel ||
      !Number.isSafeInteger(frame.seq) ||
      frame.seq <= this.lastImage ||
      typeof frame.image !== "string" ||
      !frame.image.startsWith("data:image/jpeg;base64,")
    )
      return;
    this.lastImage = frame.seq;
    this.lastFrameAt = performance.now();
    this.metadata(frame.meta);
    if (!this.live) this.panel.querySelector("img").src = frame.image;
    this.panel.querySelector(".spectator-connecting").hidden = true;
  }
  composite() {
    if (!this.videoCanvas) {
      this.videoCanvas = document.createElement("canvas");
      this.videoCanvas.width = 960;
      this.videoCanvas.height = 540;
    }
    return this.videoCanvas;
  }
  draw(now) {
    if (now < (this.nextVideoFrame || 0)) return;
    this.nextVideoFrame = now + 40;
    const canvas = this.composite(),
      ctx = canvas.getContext("2d"),
      meta = watchMetadata(this.g),
      w = canvas.width,
      h = canvas.height;
    ctx.drawImage(this.g.renderer.gl.domElement, 0, 0, w, h);
    ctx.textAlign = "left";
    ctx.font = "bold 20px Arial";
    ctx.fillStyle = "#0009";
    ctx.fillRect(16, 16, 180, 42);
    ctx.fillStyle = "white";
    ctx.fillText(
      meta.arena
        ? "Rings " + meta.rings
        : "Health " + Math.ceil(this.g.player.health),
      28,
      44,
    );
    if (meta.arena) {
      ctx.textAlign = "center";
      ctx.font = "bold 16px Arial";
      ctx.fillText(meta.title, w / 2, 27);
      ctx.fillStyle = "#10202bd9";
      ctx.fillRect(w / 2 - 180, 36, 360, 8);
      ctx.fillStyle = "#d9f8ff";
      ctx.fillRect(w / 2 - 180, 36, 360 * meta.health, 8);
      const qte = this.g.giganto.hud?.querySelector("#titan-qte"),
        prompt = qte && !qte.hidden ? qte.textContent.trim().slice(0, 90) : "";
      if (prompt) {
        ctx.fillStyle = "#101820e6";
        ctx.fillRect(110, h - 94, w - 220, 62);
        ctx.fillStyle = "white";
        ctx.font = "bold 24px Arial";
        ctx.fillText(prompt, w / 2, h - 55);
      }
    } else {
      const inv = this.g.inventory;
      ctx.fillStyle = "#111b";
      ctx.fillRect(w / 2 - 194, h - 54, 388, 46);
      const slots = this.g.ui.hud?.querySelectorAll("#hotbar .slot");
      for (let i = 0; i < 9; i++) {
        const x = w / 2 - 188 + i * 42;
        ctx.strokeStyle = i === inv.selected ? "#fff" : "#777";
        ctx.lineWidth = i === inv.selected ? 3 : 1;
        ctx.strokeRect(x, h - 49, 38, 36);
        const img = slots?.[i]?.querySelector("img");
        if (img?.complete && img.naturalWidth)
          ctx.drawImage(img, x + 3, h - 46, 30, 30);
      }
    }
  }
  capture(now) {
    if (!this.viewers.length) return;
    try {
      this.draw(now);
    } catch {
      return;
    }
    if (
      this.encoding ||
      now < (this.nextFrame || 0) ||
      this.m.socket?.bufferedAmount > 256 * 1024
    )
      return;
    // Even direct video viewers receive a tiny metadata refresh once per second.
    const fallback = this.viewers.some((v) => v.frames);
    if (!fallback) {
      if (now >= (this.nextMeta || 0)) {
        this.nextMeta = now + 1000;
        this.m.send({ type: "watch-meta", meta: watchMetadata(this.g) });
      }
      return;
    }
    this.nextFrame = now + 170;
    this.encoding = true;
    const generation = this.generation;
    this.canvas ||= document.createElement("canvas");
    this.canvas.width = 640;
    this.canvas.height = 360;
    this.canvas.getContext("2d").drawImage(this.composite(), 0, 0, 640, 360);
    this.canvas.toBlob(
      (blob) => {
        if (!blob) {
          this.encoding = false;
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          this.encoding = false;
          if (generation === this.generation && this.viewers.length)
            this.m.send({
              type: "watch-frame",
              seq: ++this.sequence,
              image: reader.result,
              meta: watchMetadata(this.g),
            });
        };
        reader.onerror = () => (this.encoding = false);
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      0.55,
    );
  }
  stopPublishing() {
    this.generation++;
    for (const [id, p] of this.peers)
      if (p.role === "publisher") {
        p.pc.close();
        this.peers.delete(id);
      }
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop();
      this.stream = null;
    }
    if (this.audioBus) {
      try {
        this.g.audio.compressor.disconnect(this.audioBus);
      } catch {}
      this.audioBus = null;
    }
  }
  remove(id) {
    this.requests.delete(id);
    for (const [viewer, target] of this.requests)
      if (target === id) this.approve(viewer, null);
    this.setViewers(this.viewers.filter((v) => v.id !== id));
    if (this.target === id) this.close();
  }
  clear() {
    this.close(false);
    this.requests.clear();
    this.viewers = [];
    this.stopPublishing();
    for (const p of this.peers.values()) p.pc.close();
    this.peers.clear();
  }
}
