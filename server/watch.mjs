// Authenticated room-local spectator routing. Never forwards viewer controls.
export function createWatchRouter(room, send) {
  const watches = new Map();
  const member = (id) =>
    id === room.host.id ? room.host : room.guests.get(id);
  function viewers(id) {
    return [...watches]
      .filter(([, w]) => w.target === id)
      .map(([id, w]) => ({ id, frames: w.frames }));
  }
  function notify(target) {
    const ws = member(target);
    if (ws) send(ws, { type: "watchers", viewers: viewers(target) });
  }
  function stop(viewer) {
    const old = watches.get(viewer);
    if (!old) return;
    watches.delete(viewer);
    send(member(viewer), { type: "watch-state", target: null });
    notify(old.target);
  }
  function leave(id) {
    stop(id);
    for (const [viewer, w] of watches) if (w.target === id) stop(viewer);
  }
  function route(ws, m) {
    if (m.type === "watch-request") {
      if (
        m.target !== null &&
        (typeof m.target !== "string" ||
          !member(m.target) ||
          m.target === ws.id)
      )
        throw Error("Player is unavailable.");
      send(room.host, {
        type: "watch-request",
        viewer: ws.id,
        target: m.target,
      });
      return true;
    }
    if (m.type === "watch-approved") {
      if (ws !== room.host)
        throw Error("Only the host can approve spectators.");
      if (!member(m.to)) return true;
      stop(m.to);
      if (m.target !== null) {
        if (!member(m.target) || m.target === m.to)
          throw Error("Invalid spectator target.");
        watches.set(m.to, { target: m.target, frames: true });
        send(member(m.to), {
          type: "watch-state",
          target: m.target,
          name: member(m.target).name,
        });
        notify(m.target);
      }
      return true;
    }
    if (m.type === "watch-denied") {
      if (ws !== room.host)
        throw Error("Only the host can approve spectators.");
      send(member(m.to), {
        type: "watch-denied",
        message:
          typeof m.message === "string"
            ? m.message.slice(0, 100)
            : "Cannot spectate now.",
      });
      return true;
    }
    if (m.type === "watch-mode") {
      const w = watches.get(ws.id);
      if (w) {
        w.frames = m.frames !== false;
        notify(w.target);
      }
      return true;
    }
    if (m.type === "watch-meta") {
      const meta = m.meta || {};
      const clean = {
        title: String(meta.title || "").slice(0, 40),
        arena: !!meta.arena,
        phase: Math.max(0, Math.min(3, Number(meta.phase) || 0)),
        health: Math.max(0, Math.min(1, Number(meta.health) || 0)),
        rings: Math.max(0, Math.min(10000, Number(meta.rings) || 0)),
      };
      for (const v of viewers(ws.id))
        send(member(v.id), { type: "watch-meta", from: ws.id, meta: clean });
      return true;
    }
    if (m.type === "watch-signal") {
      if (
        !member(m.to) ||
        !(
          watches.get(ws.id)?.target === m.to ||
          watches.get(m.to)?.target === ws.id
        )
      )
        throw Error("Spectator channel is not active.");
      const signal = m.signal;
      if (
        !signal ||
        typeof signal !== "object" ||
        Array.isArray(signal) ||
        JSON.stringify(signal).length > 40000
      )
        throw Error("Invalid spectator signal.");
      if (
        signal.description &&
        !["offer", "answer"].includes(signal.description.type)
      )
        throw Error("Invalid spectator description.");
      send(member(m.to), { type: "watch-signal", from: ws.id, signal });
      return true;
    }
    if (m.type === "watch-frame") {
      const targets = viewers(ws.id).filter((v) => v.frames);
      if (!targets.length) return true;
      if (
        !Number.isSafeInteger(m.seq) ||
        m.seq < 0 ||
        typeof m.image !== "string" ||
        m.image.length > 160000 ||
        !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(m.image)
      )
        throw Error("Invalid spectator frame.");
      if ((ws.watchAt || 0) > Date.now() - 120) return true;
      ws.watchAt = Date.now();
      const meta =
        m.meta && typeof m.meta === "object"
          ? {
              title: String(m.meta.title || "").slice(0, 40),
              phase: Math.max(0, Math.min(3, Number(m.meta.phase) || 0)),
              health: Math.max(0, Math.min(1, Number(m.meta.health) || 0)),
              rings: Math.max(0, Math.min(10000, Number(m.meta.rings) || 0)),
              arena: !!m.meta.arena,
            }
          : {};
      for (const v of targets) {
        const target = member(v.id);
        if (target && target.bufferedAmount < 512 * 1024)
          send(target, {
            type: "watch-frame",
            from: ws.id,
            seq: m.seq,
            image: m.image,
            meta,
          });
      }
      return true;
    }
    return false;
  }
  return { route, leave, watches };
}
