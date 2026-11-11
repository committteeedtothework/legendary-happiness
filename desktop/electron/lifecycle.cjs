// Serialized into the isolated game page; keep this function self-contained.
async function saveBeforeClose(game) {
  if (!game?.active || !game.world || game.multiplayer?.isGuest) return;
  game.pause?.();
  const outcome = await game.save();
  if (!outcome || outcome.status !== "durable") {
    throw new Error(
      outcome?.error ||
        "Your latest changes are only saved for this session. Cancel and export a world backup before quitting.",
    );
  }
}
module.exports = { saveBeforeClose };
