export function decorateControllerGlyphs(root, family, enabled) {
  for (const node of root.querySelectorAll(
    "kbd,[data-controller-glyph],.titan-control-sheet dt",
  )) {
    node.classList.toggle("pad-glyph", enabled);
    if (!enabled) {
      delete node.dataset.padFamily;
      delete node.dataset.padFace;
      continue;
    }
    node.dataset.padFamily = family;
    const text = node.textContent.trim(),
      face = {
        A: "a",
        B: "b",
        X: "x",
        Y: "y",
        "×": "cross",
        "○": "circle",
        "□": "square",
        "△": "triangle",
      }[text];
    node.dataset.padFace = face || "control";
  }
}
