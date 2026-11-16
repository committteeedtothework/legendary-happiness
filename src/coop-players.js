// Simulation identities, never names or client-supplied damage values.
export function survivalPlayers(game) {
  if (game.mode === "creative") return [];
  const peers =
    game.multiplayer?.connected && !game.multiplayer.isGuest
      ? [...game.multiplayer.peers.values()].filter(p=>(p.context?.dimension||"overworld")===(game.dimension||"overworld")).map((p) => p.player)
      : [];
  return [...new Set([game.player, ...peers])].filter((p) => p?.health > 0 && !p.multiplayerAway);
}
export function isPlayer(game, target) {
  return target === game.player || !!game.multiplayer?.peerForPlayer?.(target);
}
export function damagePlayer(game, target, amount, cause, source = null) {
  if (target === game.player) game.damage(amount, cause,false,source);
  else game.multiplayer?.damagePlayer?.(target, amount, cause,source);
}
