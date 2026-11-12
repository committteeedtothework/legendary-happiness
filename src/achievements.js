import { ACHIEVEMENTS } from "./achievement-data.js";
// Progress lives on the player, so normal saves, realm travel, co-op resume,
// backups and imports use the same existing atomic save envelope.
const normalized = new WeakSet(),
  delivery = new WeakMap(),
  clocks = new WeakMap();
const byEvent = new Map();
for (const entry of ACHIEVEMENTS)
  for (const rule of entry.rules) {
    if (!byEvent.has(rule.event)) byEvent.set(rule.event, []);
    byEvent.get(rule.event).push([entry, rule]);
  }
const object = (x) => x && typeof x === "object" && !Array.isArray(x);
export function restoreAchievements(raw) {
  const state = { version: 1, unlocked: {}, progress: {}, seen: {} };
  if (object(raw))
    for (const entry of ACHIEVEMENTS) {
      const time = raw.unlocked?.[entry.id],
        value = raw.progress?.[entry.id];
      if (Number.isFinite(time) && time > 0)
        state.unlocked[entry.id] = Math.min(Number.MAX_SAFE_INTEGER, time);
      if (Number.isFinite(value) && value > 0)
        state.progress[entry.id] = Math.min(entry.target, value);
      if (state.unlocked[entry.id]) state.progress[entry.id] = entry.target;
      if (Array.isArray(raw.seen?.[entry.id]))
        state.seen[entry.id] = [
          ...new Set(
            raw.seen[entry.id].filter(
              (x) => typeof x === "string" && /^[a-z0-9_-]{1,64}$/.test(x),
            ),
          ),
        ].slice(0, entry.target);
    }
  normalized.add(state);
  return state;
}
export function achievementState(player) {
  if (!player) return restoreAchievements();
  if (!object(player.achievements) || !normalized.has(player.achievements))
    player.achievements = restoreAchievements(player.achievements);
  return player.achievements;
}
export function recordAchievement(game, event, data = {}) {
  if (
    !game?.active ||
    !game.player ||
    game.player.health <= 0 ||
    game.multiplayer?.isGuest
  )
    return [];
  const candidates = byEvent.get(event);
  if (!candidates) return [];
  const state = achievementState(game.player),
    unlocked = [];
  for (const [entry, rule] of candidates) {
    if (
      state.unlocked[entry.id] ||
      ((entry.survival || rule.survival) && game.mode !== "survival")
    )
      continue;
    if (rule.items && event !== "inventory" && !rule.items.includes(data.item))
      continue;
    if (rule.keys && !rule.keys.includes(data.key)) continue;
    if (rule.minimum && !(data.value >= rule.minimum)) continue;
    let value = 1;
    if (event === "inventory") {
      const owned = rule.items.filter((id) => data.items?.has(id)).length;
      if (rule.all ? owned !== rule.items.length : !owned) continue;
    } else if (rule.unique) {
      const key = data[rule.unique];
      if (typeof key !== "string" || !/^[a-z0-9_-]{1,64}$/.test(key)) continue;
      const seen = (state.seen[entry.id] ||= []);
      if (seen.includes(key)) continue;
      if (seen.length < entry.target) seen.push(key);
      value = seen.length;
    } else {
      const count = Number.isFinite(data.count)
        ? Math.max(0, Math.min(1000, data.count))
        : 1;
      if (count <= 0) continue;
      value = (state.progress[entry.id] || 0) + count;
    }
    state.progress[entry.id] = Math.min(entry.target, value);
    if (value < entry.target) continue;
    state.unlocked[entry.id] = Math.max(1, Date.now());
    unlocked.push(entry);
    game.ui?.achievementUnlocked?.(entry);
  }
  return unlocked;
}
export function scanAchievements(game) {
  if (!game?.active || game.multiplayer?.isGuest || !game.player) return;
  const inv = game.inventory;
  const items = new Set(
    [
      ...(inv?.slots || []),
      ...(inv?.equipment || []),
      ...(inv?.offhand || []),
      ...(inv?.craft || []),
      inv?.cursor,
    ]
      .filter((s) => s?.count > 0)
      .map((s) => s.id),
  );
  recordAchievement(game, "inventory", { items });
  const stand = game.player.standData;
  if (stand?.id) recordAchievement(game, "stand-awaken");
  if (stand?.id) recordAchievement(game, "stand-level", { value: stand.level });
}
export function pollAchievements(game, dt) {
  if (
    !game?.active ||
    game.multiplayer?.isGuest ||
    !game.running ||
    game.giganto?.active
  )
    return;
  const elapsed =
    (clocks.get(game.player) || 0) + Math.min(0.1, Math.max(0, dt));
  if (elapsed < 0.5) {
    clocks.set(game.player, elapsed);
    return;
  }
  clocks.set(game.player, 0);
  scanAchievements(game);
  if ((game.dimension || "overworld") === "overworld" && game.world?.terrain) {
    const key = game.world.terrain(game.player.x, game.player.z).biome;
    recordAchievement(game, "biome", { key });
  }
}
export function syncAchievements(game, raw, silent = false) {
  const old = achievementState(game.player),
    next = restoreAchievements(raw);
  game.player.achievements = next;
  if (!silent)
    for (const entry of ACHIEVEMENTS)
      if (next.unlocked[entry.id] && !old.unlocked[entry.id])
        game.ui?.achievementUnlocked?.(entry);
}
export function recordTitanAchievement(game, session, event) {
  if (
    !game?.active ||
    !session ||
    !event ||
    !["stage", "emerald", "parry", "hit", "ring"].includes(event.type)
  )
    return;
  // Presentation delivery can replay after a catch-up frame. A stable event ID
  // must count once, including ring totals. Never count an attack windup as a hit.
  if (event.eventId) {
    let seen = delivery.get(game.player);
    if (!seen) delivery.set(game.player, (seen = new Set()));
    if (seen.has(event.eventId)) return;
    seen.add(event.eventId);
    if (seen.size > 256) seen.delete(seen.values().next().value);
  }
  if (event.type === "stage") {
    recordAchievement(game, "titan-stage", { key: event.stage });
    if (event.stage === "combat") recordAchievement(game, "titan-transform");
    if (event.stage === "victory" && session.won)
      recordAchievement(game, "titan-victory", {
        key: session.titan || "giganto",
      });
  }
  if (event.type === "emerald") recordAchievement(game, "titan-emerald");
  if (event.type === "parry") {
    recordAchievement(game, "titan-parry");
    if (event.perfect) recordAchievement(game, "titan-perfect");
  }
  if (event.type === "hit" && event.amount > 0)
    recordAchievement(game, "titan-hit", { key: event.kind });
  if (event.type === "ring")
    recordAchievement(game, "titan-ring", { count: event.count });
}
export function achievementSummary(player) {
  const state = achievementState(player);
  return {
    completed: Object.keys(state.unlocked).length,
    total: ACHIEVEMENTS.length,
  };
}

// Arena restoration and respawn replace the player object, but must retain the
// current ledger rather than the stale entry snapshot. No gameplay fields merge.
export function preserveAchievements(current, next) {
  if (current?.achievements || next?.achievements)
    next.achievements = restoreAchievements(
      current?.achievements || next.achievements,
    );
  return next;
}
export function restoreTitanAchievements(game, data) {
  if (!data || game.multiplayer?.isGuest) return;
  if (game.giganto?.active) recordAchievement(game, "titan-stage", { key: "intro" });
  for (const [key, record] of [
    ["giganto", data],
    ["wyvern", data.wyvern],
  ])
    if (
      record?.ledger?.length ||
      (record?.session?.won && record.session.stage === "victory")
    )
      recordAchievement(game, "titan-victory", { key });
}
