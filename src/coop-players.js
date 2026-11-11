// Simulation identities, never names or client-supplied damage values.
export function survivalPlayers(game) {
  if (game.mode === "creative") return [];
  const peers =
    game.multiplayer?.connected && !game.multiplayer.isGuest
      ? [...game.multiplayer.peers.values()].map((p) => p.player)
      : [];
  return [...new Set([game.player, ...peers])].filter((p) => p?.health > 0);
}
export function isPlayer(game, target) {
  return target === game.player || !!game.multiplayer?.peerForPlayer?.(target);
}
export function damagePlayer(game, target, amount, cause) {
  if (target === game.player) game.damage(amount, cause);
  else game.multiplayer?.damagePlayer?.(target, amount, cause);
}
