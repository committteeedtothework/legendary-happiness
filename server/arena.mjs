export function routeArena(room, ws, m, send) {
  const host = ws === room.host;
  if (["arena-request", "arena-input"].includes(m.type)) {
    if (host) throw Error("Arena actions are guest requests.");
    if (JSON.stringify(m).length > 16384)
      throw Error("Arena input is too large.");
    if (
      m.type === "arena-input" &&
      (!Array.isArray(m.frames) ||
        m.frames.length > 12 ||
        typeof m.token !== "string" ||
        m.token.length > 80)
    )
      throw Error("Invalid arena input.");
    if (
      m.type === "arena-request" &&
      (!Number.isSafeInteger(m.request) ||
        !["begin", "finish"].includes(m.action))
    )
      throw Error("Invalid arena request.");
    send(room.host, { ...m, id: ws.id });
    return true;
  }
  if (["arena-response", "arena-error"].includes(m.type)) {
    if (!host) throw Error("Only the host can confirm an arena.");
    send(room.guests.get(m.to), {
      type: m.type,
      request: m.request,
      ok: m.ok === true,
      data: m.data,
      message: typeof m.message === "string" ? m.message.slice(0, 160) : "",
    });
    return true;
  }
  return false;
}
