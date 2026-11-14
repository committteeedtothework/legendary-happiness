import {raisedShield} from "./offhand.js";
import { ITEMS, makeStack } from "./data.js";
import { playerEye } from "./player-body.js";
import { wear } from "./equipment.js";
export function useEditionWeapon(g) {
  const p = g.player,
    held = g.inventory.held,
    id = held?.id;
  if (!["bow", "crossbow", "shield"].includes(id)) return false;
  if (id === "shield") {
    p.shieldRaised = true;
    p.shieldHand=g.usingOffhand?"off":"main";
    g.renderer?.action("use");
    return true;
  }
  if (id === "crossbow" && held.charged) {
    shoot(g, held, 1, true);
    held.charged = false;
    g.ui?.updateHotbar();
    return true;
  }
  if (
    g.mode !== "creative" &&
    !g.inventory.slots.some((s) => s?.id === "arrow")&&g.inventory.offhand?.[0]?.id!=="arrow"
  ) {
    g.ui?.toast?.("You need arrows.");
    return true;
  }
  p.editionDraw = { id, slot: g.inventory.selected, start: g.elapsed };
  g.renderer?.action("use");
  return true;
}
export function releaseEditionWeapon(g) {
  const p = g.player,
    draw = p.editionDraw;
  delete p.editionDraw;
  const blocked = !!p.shieldRaised;
  p.shieldRaised = false;
  if (!draw) return blocked;
  const held = g.inventory.held;
  if (
    !held ||
    held.id !== draw.id ||
    g.inventory.selected !== draw.slot ||
    p.health <= 0
  )
    return false;
  const time = Math.max(0, g.elapsed - draw.start),
    charge = Math.min(1, (time * time + time * 2) / 3);
  if (draw.id === "crossbow") {
    if (time < 1.25 || !consumeArrow(g)) return false;
    held.charged = true;
    g.audio?.tone("equip");
    g.ui?.updateHotbar();
    return true;
  }
  if (charge < 0.1 || !consumeArrow(g)) return false;
  shoot(g, held, charge, false);
  return true;
}
function consumeArrow(g) {
  if (g.mode === "creative") return true;
  if(g.inventory.offhand?.[0]?.id==="arrow"){if(--g.inventory.offhand[0].count===0)g.inventory.offhand[0]=null;return true;}
  const slot = g.inventory.slots.findIndex((s) => s?.id === "arrow");
  return slot >= 0 && g.inventory.consume(slot);
}
function shoot(g, held, charge, crossbow) {
  const p = g.player,
    a = p.pitch,
    yaw = p.yaw,
    speed = crossbow ? 3.15 : 3 * charge;
  p.aquaticId ||= crypto.randomUUID();
  (g.hostileProjectiles ||= []).push({
    id: "arrow:" + crypto.randomUUID(),
    x: p.x,
    y: p.y + playerEye(p) - 0.08,
    z: p.z,
    vx: -Math.sin(yaw) * Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    vz: -Math.cos(yaw) * Math.cos(a) * speed,
    age: 0,
    playerArrow: true,
    owner: p.aquaticId,
    source: p.aquaticId,
    sourceType: "player",
    damage: crossbow ? 6 : Math.max(1, Math.ceil(charge * 6)),
    recoverable: g.mode !== "creative",
  });
  if (g.mode !== "creative" && wear(held))
    g.inventory.slots[g.inventory.selected] = null;
  g.audio?.tone("arrow");
  g.renderer?.action("use");
  g.ui?.updateHotbar();
}
export function blockShieldProjectile(g, target, q) {
  const peer = [...(g.multiplayer?.peers?.values?.() || [])].find(
      (peer) => peer.player === target,
    ),
    inv = peer?.inventory || g.inventory;
  const shield=raisedShield(inv,target);
  if(!shield)return false;
  const dx = q.x - target.x,
    dz = q.z - target.z,
    d = Math.hypot(dx, dz);
  if (d && (-Math.sin(target.yaw) * dx - Math.cos(target.yaw) * dz) / d < 0.2)
    return false;
  if (
    g.mode !== "creative" &&
    wear(shield, Math.max(1, Math.floor(q.damage) + 1))
  )
    if(target.shieldHand==="off")inv.offhand[0]=null;else inv.slots[inv.selected] = null;
  g.audio?.tone("guardian-impact");
  return true;
}
