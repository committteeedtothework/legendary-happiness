// Arena-only menu navigation. Combat bindings and saved settings stay separate.
export const TITAN_MENU_TABS = [
  "graphics",
  "sound",
  "camera",
  "battle",
  "controls",
];
export function activateTitanTab(root, name, focus = false) {
  if (!TITAN_MENU_TABS.includes(name)) return false;
  const tab = root.querySelector(`[data-titan-tab="${name}"]`);
  if (!tab) return false;
  root.querySelectorAll("[data-titan-tab]").forEach((node) => {
    const selected = node === tab;
    node.setAttribute("aria-selected", String(selected));
    node.tabIndex = selected ? 0 : -1;
  });
  root.querySelectorAll("[data-titan-panel]").forEach((node) => {
    node.hidden = node.dataset.titanPanel !== name;
    if (!node.hidden) node.scrollTop = 0;
  });
  root.querySelector(".titan-settings")?.setAttribute("data-tab", name);
  if (focus) tab.focus({ preventScroll: true });
  return true;
}
export function navigateTitanMenu(event, root) {
  if (!root.querySelector(".titan-menu-surface")) return false;
  const target = event.target;
  if (target.closest?.("input,select,textarea,summary")) return false;
  const tabs = [...root.querySelectorAll("[data-titan-tab]")];
  if (
    target.matches?.("[data-titan-tab]") &&
    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.code)
  ) {
    const i = tabs.indexOf(target),
      n = tabs.length;
    const next =
      event.code === "Home"
        ? 0
        : event.code === "End"
          ? n - 1
          : (i + (event.code === "ArrowRight" ? 1 : -1) + n) % n;
    activateTitanTab(root, tabs[next].dataset.titanTab, true);
    return true;
  }
  if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.code))
    return false;
  const nodes = [
    ...root.querySelectorAll("button,input,select,summary"),
  ].filter(
    (n) =>
      !n.disabled &&
      n.tabIndex !== -1 &&
      n.getClientRects().length &&
      getComputedStyle(n).visibility !== "hidden",
  );
  if (!nodes.length) return false;
  const i = nodes.indexOf(target),
    n = nodes.length;
  const next =
    event.code === "Home"
      ? 0
      : event.code === "End"
        ? n - 1
        : (i + (event.code === "ArrowDown" ? 1 : -1) + n) % n;
  nodes[next].focus();
  return true;
}
const footer =
  '<footer class="titan-menu-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Select</span><span><kbd>Enter</kbd> Confirm</span><span><kbd>Esc</kbd> Back</span></footer>';
export function titanPausePanel(s) {
  return `<main class="dialog titan-result titan-menu-surface titan-pause" role="dialog" aria-modal="true" aria-labelledby="titan-pause-title"><header class="titan-menu-heading"><span>GIGANTO</span><h2 id="titan-pause-title">Pause</h2></header><nav class="titan-pause-list" aria-label="Pause"><button data-titan="resume">Continue</button><button data-titan="menu">Options</button>${s?.won ? "" : '<button data-titan="exit">Leave battle</button>'}<button data-titan="quit">Save and quit</button></nav><aside class="titan-pause-status"><span>${s?.won ? "GIGANTO DEFEATED" : `PHASE ${s?.phase || 1}`}</span><strong>${Math.ceil(s?.rings || 0)}<small> / ${s?.config.rings || 400}</small></strong><span>Rings</span></aside>${footer}</main>`;
}
export function titanDefeatPanel() {
  return `<main class="dialog titan-result titan-menu-surface titan-defeat" role="dialog" aria-modal="true" aria-labelledby="titan-defeat-title"><header class="titan-menu-heading"><span>GIGANTO</span><h2 id="titan-defeat-title">Out of rings</h2></header><nav class="titan-pause-list" aria-label="Battle result"><button data-titan="retry">Retry</button><button data-titan="menu">Options</button><button data-titan="exit">Leave battle</button></nav>${footer}</main>`;
}
export const titanMenuFooter =
  '<footer class="titan-menu-footer"><span><kbd>Tab</kbd> Navigate</span><span><kbd>←</kbd><kbd>→</kbd> Adjust</span><span><kbd>Esc</kbd> Back</span></footer>';
