import { relicSite } from "./relic.js";
export const wrapDegrees = (value) => ((value % 360) + 360) % 360;
const names = [
  "North",
  "North-east",
  "East",
  "South-east",
  "South",
  "South-west",
  "West",
  "North-west",
];
export function compass(yaw) {
  const degrees = wrapDegrees((-yaw * 180) / Math.PI);
  return { degrees, name: names[Math.floor((degrees + 22.5) / 45) % 8] };
}
export function relicNavigation(world, player) {
  if (world.dimension !== "overworld")
    return { message: "Return to the Overworld to track The Devin Sword." };
  if (world.relicClaimed)
    return { message: "The Devin Sword has been claimed in this world." };
  const site = relicSite(world);
  if (!site) return { message: "No planted sword on this world generator." };
  const dx = site.x + 0.5 - player.x,
    dz = site.z + 0.5 - player.z;
  const distance = Math.hypot(dx, dz),
    bearing = wrapDegrees((Math.atan2(dx, -dz) * 180) / Math.PI);
  const turn = ((bearing - compass(player.yaw).degrees + 540) % 360) - 180;
  return {
    site,
    dx,
    dz,
    dy: site.y - player.y,
    distance,
    bearing,
    turn,
    message:
      distance < 2
        ? site.temple
          ? `Temple: ${Math.min(3, world.settlements?.["devin-temple"]?.defeated?.length || 0)}/3 Guardians defeated. See J for the seal and extraction.`
          : "At the sword site. Check the ground; hold left click for 30 seconds."
        : `${Math.abs(turn) < 8 ? "Straight ahead" : `Turn ${turn < 0 ? "left" : "right"} ${Math.round(Math.abs(turn))}°`} · ${distance.toFixed(1)} blocks horizontally`,
  };
}
export function debugNavigation(world, p) {
  const facing = compass(p.yaw),
    relic = relicNavigation(world, p);
  const signed = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;
  return `XYZ (feet)  X ${p.x.toFixed(2)}  Y ${p.y.toFixed(2)}  Z ${p.z.toFixed(2)}\nBlock  ${Math.floor(p.x)} / ${Math.floor(p.y)} / ${Math.floor(p.z)} · Chunk ${Math.floor(p.x / 16)}, ${Math.floor(p.z / 16)}\nFacing ${facing.name} · ${facing.degrees.toFixed(1)}° clockwise from North\nNorth −Z · South +Z · East +X · West −X · Up +Y\nLook ${Math.abs((p.pitch * 180) / Math.PI).toFixed(1)}° ${p.pitch >= 0 ? "up" : "down"}\n\nTHE DEVIN SWORD\n${relic.site ? `Site X ${relic.site.x}  Y ${relic.site.y}  Z ${relic.site.z} (base block)\nTravel ΔX ${signed(relic.dx)}  ΔY ${signed(relic.dy)}  ΔZ ${signed(relic.dz)}\nBearing ${relic.bearing.toFixed(1)}° · ` : ""}${relic.message}`;
}
