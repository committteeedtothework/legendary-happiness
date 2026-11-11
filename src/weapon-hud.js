import { styleCharges } from "./matthew.js";
// A shared hotbar guide keeps move instructions separate from world targeting.
export function weaponMoveText(g) {
  const id = g.inventory.held?.id,
    p = g.player;
  const ready = (t) =>
    t > g.tickCount ? `${Math.ceil((t - g.tickCount) / 20)}s` : "READY";
  if (id === "matthew_dual_pistols")
    return `LMB Fire · RMB Dash / Sky Star\nSpace + RMB Wall Hike · R Air Trick\nStyle ${styleCharges(p, g.tickCount)}/2 · Air Trick ${ready(p.tricksterBlinkTick || 0)}`;
  if (id === "devin_sword")
    return `R Seeker ${ready(p.devinSeekerTick || 0)}\nRMB Pulse ${ready(p.devinReadyTick || 0)}`;
  return "";
}
