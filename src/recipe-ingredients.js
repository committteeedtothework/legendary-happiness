export const ingredientMatches = (need, id) =>
  Array.isArray(need) ? need.includes(id) : need === id;
// Assign the narrowest alternatives first, with backtracking. This prevents a
// broad tag from consuming the only ingredient needed by a more specific slot.
export function allocateIngredients(needs, slots) {
  const counts = new Map();
  for (const s of slots)
    if (s) counts.set(s.id, (counts.get(s.id) || 0) + s.count);
  const order = needs
    .map((need, index) => ({
      need,
      index,
      options: [...counts.keys()].filter((id) => ingredientMatches(need, id)),
    }))
    .sort((a, b) => a.options.length - b.options.length);
  const result = Array(needs.length);
  function solve(i) {
    if (i === order.length) return true;
    const x = order[i];
    for (const id of x.options)
      if (counts.get(id) > 0) {
        counts.set(id, counts.get(id) - 1);
        result[x.index] = id;
        if (solve(i + 1)) return true;
        counts.set(id, counts.get(id) + 1);
      }
    return false;
  }
  return solve(0) ? result : null;
}
export const recipeNeeds = (r) =>
  r.ingredients ||
  r.pattern.flatMap((row) =>
    [...row].filter((c) => c !== " ").map((c) => r.key[c]),
  );
