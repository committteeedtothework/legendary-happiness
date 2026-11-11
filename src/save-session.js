// Snapshot every request immediately. Each caller waits for its own write,
// including callers that arrive while a previous save is still committing.
export function saveGame(game) {
  if (!game.active || game.multiplayer?.isGuest) return Promise.resolve(null);
  let data, captureError;
  try {
    data = game.snapshot();
  } catch (error) {
    captureError = error;
  }
  const pending = (game.saving || Promise.resolve())
    .catch(() => {})
    .then(async () => {
      let outcome;
      try {
        if (captureError) throw captureError;
        outcome = await game.store.save(data);
        if (!outcome)
          throw new Error("Storage did not confirm save durability");
      } catch (error) {
        outcome = game.store.report(
          { id: data?.id || game.id, name: data?.name || game.name },
          "failed",
          "none",
          error,
        );
      }
      game.saveOutcome = outcome;
      if (outcome.status === "durable") game.lastSaved = Date.now();
      game.ui?.saved(outcome);
      if (outcome.status === "failed") {
        const error = new Error(outcome.error || "Save failed");
        error.outcome = outcome;
        throw error;
      }
      return outcome;
    });
  game.saving = pending;
  const clear = () => {
    if (game.saving === pending) game.saving = null;
  };
  pending.then(clear, clear);
  return pending;
}

export async function exportWorldState(game, id) {
  // Export the live session at click time, including changes newer than an
  // in-flight autosave. Exporting never overwrites/rotates a durable save.
  if (game.active && !game.multiplayer?.isGuest && game.id === id)
    return game.snapshot();
  return (await game.store.load(id)).data;
}
