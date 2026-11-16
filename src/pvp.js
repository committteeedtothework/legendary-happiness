import { ruleEnabled } from "./world-rules.js";
export const PVP_TUNING = Object.freeze({
  maxHit: 12,
  scale: 0.8,
  reach: {
    melee: 5.25,
    bullet: 40,
    arrow: 96,
    trident: 96,
    stand: 48,
    riptide: 5,
    lightning: 12,
    pulse: 7.5,
    seeker: 48,
  },
});
export const multiplayerGame = g=>g.multiplayer?.sharedRealm?.contextFor(g.dimension)||g.multiplayer?.game||g;
export function playerActors(game,{all=false}={}){
 const root=multiplayerGame(game),m=root.multiplayer,owner=m?.game||root;
 if(!m?.connected)return[];
 if(m.isGuest)return(m.remotePoses||[]).filter(p=>all||!p.dimension||p.dimension===game.dimension).map(p=>({id:p.id,name:p.name,player:p,dimension:p.dimension}));
 const list=[{id:m.id||'host',name:m.players?.find(p=>p.id===m.id)?.name||'Host',player:owner.player,context:owner,dimension:owner.dimension,inventory:owner.inventory},...[...m.peers.values()].map(p=>({...p,dimension:p.dimension||p.context.dimension}))];
 return all?list:list.filter(p=>p.dimension===game.dimension);
}
export function projectileOwner(game, id) {
  return playerActors(game).find(
    (a) =>
      a.player.aquaticId === id ||
      a.player.standData?.soul === id ||
      a.id === id,
  );
}
export function pvpActors(game, attacker = game.player) {
  const root = multiplayerGame(game);
  if (
    root.mode === "creative" ||
    !ruleEnabled(root, "pvp") ||
    !root.multiplayer?.connected ||
    !attacker ||
    attacker.multiplayerAway ||
    attacker.standData?.trial?.phase === "trial"
  )
    return [];
  const selfId =
    root.multiplayer?.isGuest && attacker === game.player
      ? root.multiplayer.id
      : attacker.pvpId;
  return playerActors(game)
    .filter(
      (a) =>
        a.player !== attacker &&
        a.id !== selfId &&
        (a.player.health ?? 20) > 0 &&
        !a.player.multiplayerAway &&
        a.player.standData?.trial?.phase !== "trial",
    )
    .map((a) => ({
      id: "player:" + a.id,
      pvpId: a.id,
      type: "player",
      name: a.name,
      x: a.player.x,
      y: a.player.y,
      z: a.player.z,
      hp: a.player.health ?? 20,
    }));
}
export const combatTargets = (g, attacker = g.player) => [
  ...(g.entities || []),
  ...pvpActors(g, attacker),
];
export const offensiveTarget = (e, hostileTypes) =>
  !!e.pvpId || hostileTypes.has(e.type);
export function damagePvP(
  game,
  e,
  amount,
  {
    kind = "melee",
    knockback = 0.35,
    source,
    attacker = game.player,
    critical = false,
  } = {},
) {
  const root = multiplayerGame(game),
    m = root.multiplayer;
  if (
    !m?.connected ||
    m.isGuest ||
    !ruleEnabled(root, "pvp") ||
    !Number.isFinite(amount) ||
    amount <= 0
  )
    return 0;
  const actors = playerActors(root),
    from = actors.find((a) => a.player === attacker),
    to = actors.find((a) => a.id === e.pvpId);
  if (
    !from ||
    !to ||
    from.id === to.id ||
    from.player.multiplayerAway ||
    to.player.multiplayerAway ||
    from.player.health <= 0 ||
    to.player.health <= 0 ||
    from.player.standData?.trial?.phase === "trial" ||
    to.player.standData?.trial?.phase === "trial" ||
    root.mode === "creative"
  )
    return 0;
  const max = PVP_TUNING.reach[kind] || 48;
  const d = Math.hypot(
    to.player.x - from.player.x,
    to.player.y - from.player.y,
    to.player.z - from.player.z,
  );
  if (d > max) return 0;
  const before = to.player.health,
    damage = Math.min(PVP_TUNING.maxHit, amount * PVP_TUNING.scale);
  const label =
    {
      arrow: "an arrow",
      bullet: "a bullet",
      stand: "a Stand attack",
      trident: "a trident",
      pulse: "Devin’s Pulse",
      seeker: "Devin’s Seeker",
    }[kind] || "an attack";
  to.context.damage(damage, label + " from " + from.name, false, {
    ...(source || from.player),
    pvpAttacker: from.id,
  });
  const dealt = before - to.player.health;
  if (dealt <= 0) return 0;
  from.player.pvpLastCombat = root.tickCount || 0;
  to.player.pvpLastCombat = root.tickCount || 0;
  const dx = to.player.x - from.player.x,
    dz = to.player.z - from.player.z,
    length = Math.hypot(dx, dz) || 1;
  const push = Math.min(5, Math.max(0, knockback * 3));
  to.player.vx = (to.player.vx || 0) + (dx / length) * push;
  to.player.vz = (to.player.vz || 0) + (dz / length) * push;
  if (from.player === root.player)
    root.hitFeedback = { critical, until: root.elapsed + 0.2 };
  const event = {
    id: (m.combatSequence || 0) + 1,
    attacker: from.id,
    target: to.id,
    x: to.player.x,
    y: to.player.y,
    z: to.player.z,
    critical: !!critical,
    dimension:game.dimension,
  };
  m.combatSequence = event.id;
  m.combatEvent?.(event);
  m.send?.({ type: "combat-event", event });
  if (to.player.health === 0) {
    const stats = (p) => (p.multiplayerStats ||= { kills: 0, deaths: 0 });
    stats(from.player).kills++;
    stats(to.player).deaths++;
    if (ruleEnabled(root, "showDeathMessages"))
      root.chat?.announce(`${to.name} was slain by ${from.name}.`);
  }
  return dealt;
}
