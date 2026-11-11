// Original, crisp pixel symbols; no external font glyphs or images are needed.
export const recipeBookIcon = `<svg viewBox="0 0 20 16" aria-hidden="true" shape-rendering="crispEdges"><path fill="#263c24" d="M2 4h3V2h8v1h3v2h2v8h-3v2H5v-1H2z"/><path fill="#e7e5c9" d="M4 5h9v7H5v-1H4z"/><path fill="#6ab84c" d="M6 3h7v1h2v1h1v6h-3v2H7v-1H6z"/><path fill="#a1d47b" d="M7 4h5v1H8v6H7z"/><path fill="#446f35" d="M9 6h4v1H9zm0 3h4v1H9z"/></svg>`;
const paths = [
  "M4 3h8v2h2v7h-3V9H5v3H2V5h2z",
  "M5 2h2v2h2V2h2l4 3-2 3-2-1v7H5V7L3 8 1 5z",
  "M4 2h8v12H9V7H7v7H4z",
  "M3 3h4v6h2V3h4v11H9v-2H7v2H2v-4h1z",
  "M3 2h10v8l-2 3-3 2-3-2-2-3z",
];
export function equipmentPlaceholder(index) {
  return `<svg class="equipment-placeholder" viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges"><path d="${paths[index]}" fill="#777" stroke="#414141" stroke-width="1"/></svg>`;
}

export const craftArrowIcon = `<svg viewBox="0 0 20 14" aria-hidden="true" shape-rendering="crispEdges"><path fill="#8b8b8b" d="M0 5h11V1h2v2h2v2h2v2h2v1h-2v2h-2v2h-2v2h-2V9H0z"/></svg>`;
