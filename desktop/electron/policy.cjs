const path = require("node:path");
const APP_ORIGIN = "dcsmcraft://game";
function localAssetPath(url, root) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "dcsmcraft:" || parsed.hostname !== "game")
    return null;
  let relative;
  try {
    relative = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }
  if (
    relative.includes("\\") ||
    relative.includes("\0") ||
    relative.split("/").includes("..")
  )
    return null;
  const target = path.resolve(
    root,
    "." + (relative === "/" ? "/index.html" : relative),
  );
  const inside = path.relative(path.resolve(root), target);
  return !inside.startsWith("..") && !path.isAbsolute(inside) ? target : null;
}
const allowedPermissions = new Set([
  "fullscreen",
  "pointerLock",
  "keyboardLock",
  "clipboard-sanitized-write",
]);
module.exports = { APP_ORIGIN, localAssetPath, allowedPermissions };
