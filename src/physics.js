import { touchMovement } from "./touch-data.js";
import { blockParts } from "./block-shapes.js";
import { updateRidingHorse } from "./aquatic-mount.js";
import { playerHeight, playerEye } from "./player-body.js";
import {
  isWater,
  isLava,
  fluidSurfaceHeight,
  fluidCurrent,
} from "./block-dynamics.js";
import { B, BLOCKS, MIN_Y } from "./data.js";
import { blockBounds, overlapsPanel } from "./doors.js";
import { updateRidingBoat } from "./boats.js";
const CONTACT_EPSILON = 0.00001;
export function intersectsBlock(
  p,
  x,
  y,
  z,
  height = playerHeight(p),
  width = p.standData?.transformed ? 0.9 : 0.6,
) {
  return (
    p.x + width / 2 > x + CONTACT_EPSILON &&
    p.x - width / 2 < x + 1 - CONTACT_EPSILON &&
    p.y + height > y + CONTACT_EPSILON &&
    p.y < y + 1 - CONTACT_EPSILON &&
    p.z + width / 2 > z + CONTACT_EPSILON &&
    p.z - width / 2 < z + 1 - CONTACT_EPSILON
  );
}
export function collides(world, p, height = 1.8, width = 0.6) {
  const eps = CONTACT_EPSILON;
  for (
    let y = Math.floor(p.y + eps) - 1;
    y <= Math.floor(p.y + height - eps);
    y++
  )
    for (
      let z = Math.floor(p.z - width / 2 + eps);
      z <= Math.floor(p.z + width / 2 - eps);
      z++
    )
      for (
        let x = Math.floor(p.x - width / 2 + eps);
        x <= Math.floor(p.x + width / 2 - eps);
        x++
      )
        if (world.solid(x, y, z)) {
          const id = world.get(x, y, z);
          if (
            (!BLOCKS[id]?.edition &&
              !BLOCKS[id]?.bounds &&
              !BLOCKS[id]?.door &&
              !BLOCKS[id]?.relic &&
              id !== B.cactus &&
              id !== B.chest &&
              intersectsBlock(p, x, y, z, height, width)) ||
            blockParts(id, world, x, y, z, true).some((bounds) =>
              overlapsPanel(p, x, y, z, bounds, height, width),
            )
          )
            return true;
        }
  return false;
}
// Choose the actual supporting surface, rather than lifting by a fixed amount.
// Both the upward path and the destination need enough room for the whole body.
function stepOntoSurface(world, p, axis, before, height, width, maxStep) {
  const eps = CONTACT_EPSILON;
  let top = p.y;
  for (let y = Math.floor(p.y + eps); y <= Math.floor(p.y + maxStep + eps); y++)
    for (
      let z = Math.floor(p.z - width / 2 + eps);
      z <= Math.floor(p.z + width / 2 - eps);
      z++
    )
      for (
        let x = Math.floor(p.x - width / 2 + eps);
        x <= Math.floor(p.x + width / 2 - eps);
        x++
      ) {
        if (!world.solid(x, y, z)) continue;
        for (const b of blockParts(world.get(x, y, z), world, x, y, z, true)) {
          if (
            p.x + width / 2 <= x + b[0] + eps ||
            p.x - width / 2 >= x + b[3] - eps ||
            p.z + width / 2 <= z + b[2] + eps ||
            p.z - width / 2 >= z + b[5] - eps
          )
            continue;
          const surface = y + b[4];
          if (surface > p.y + eps && surface <= p.y + maxStep + eps)
            top = Math.max(top, surface);
        }
      }
  if (
    top === p.y ||
    collides(world, { ...p, [axis]: before, y: top }, height, width) ||
    collides(world, { ...p, y: top }, height, width)
  )
    return false;
  p.y = top;
  return true;
}
export function moveBody(
  world,
  p,
  dx,
  dy,
  dz,
  height = 1.8,
  width = 0.6,
  stepHeight = 0.6,
) {
  const oldGround = p.onGround,
    startY = p.y;
  let landed = false;
  for (const [axis, amount] of [
    ["x", dx],
    ["z", dz],
    ["y", dy],
  ]) {
    if (!amount) continue;
    const before = p[axis];
    p[axis] += amount;
    if (collides(world, p, height, width)) {
      if (
        axis !== "y" &&
        oldGround &&
        stepHeight > 0 &&
        Math.abs(amount) > 0.001 &&
        stepOntoSurface(
          world,
          p,
          axis,
          before,
          height,
          width,
          Math.max(0, stepHeight - (p.y - startY)),
        )
      )
        continue;
      p[axis] = before;
      let low = 0,
        high = 1;
      for (let i = 0; i < 10; i++) {
        const mid = (low + high) / 2;
        p[axis] = before + amount * mid;
        if (collides(world, p, height, width)) high = mid;
        else low = mid;
      }
      p[axis] = before + amount * low;
      if (axis === "y") {
        if (amount < 0) landed = true;
        p.vy = 0;
      } else p[axis === "x" ? "vx" : "vz"] = 0;
    }
  }
  p.onGround = landed || (dy === 0 && oldGround);
  return landed;
}
export function createPlayer(spawn, saved = {}) {
  return {
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    yaw: 0,
    pitch: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: false,
    crouching: false,
    sprinting: false,
    flying: false,
    health: 20,
    food: 20,
    saturation: 5,
    exhaustion: 0,
    oxygen: 300,
    xp: 0,
    fallStart: spawn.y,
    hurt: 0,
    ...saved,
  };
}
export function updatePlayer(game, keys, dt) {
  const p = game.player,
    w = game.world,
    creative = game.mode === "creative";
  if (p.health <= 0) return;
  if(p.levitationTicks>0)p.levitationTicks=Math.max(0,p.levitationTicks-dt*20);
  if (p.horseId) {
    const moving = updateRidingHorse(game, keys, dt);
    if (p.horseId) return moving;
  }
  if (p.boatId) {
    const moving = updateRidingBoat(game, keys, dt);
    if (p.boatId) return moving;
  }
  if (
    p.riftGrip ||
    (p.standData?.awakeningUntil || 0) > (game.tickCount || 0)
  ) {
    keys = new Set();
    p.vx = 0;
    p.vz = 0;
  }
  const feet = w.get(p.x, p.y + 0.01, p.z),
    head = w.get(p.x, p.y + playerEye(p), p.z);
  const wasInWater = !!p.inWater;
  p.inWater =
    isWater(feet) &&
    p.y + 0.01 <
      Math.floor(p.y + 0.01) +
        fluidSurfaceHeight(w, p.x, p.y + 0.01, p.z, feet);
  p.inLava =
    isLava(feet) &&
    p.y + 0.01 <
      Math.floor(p.y + 0.01) +
        fluidSurfaceHeight(w, p.x, p.y + 0.01, p.z, feet);
  if (p.inWater !== wasInWater) game.audio?.tone("swim");
  p.underwater =
    isWater(head) &&
    p.y + playerEye(p) <
      Math.floor(p.y + playerEye(p)) +
        fluidSurfaceHeight(w, p.x, p.y + playerEye(p), p.z, head);
  const wantsCrouch = keys.has("ShiftLeft") || keys.has("ShiftRight");
  p.crouching = !p.flying && wantsCrouch;
  if (
    !p.crouching &&
    !p.swimming &&
    collides(
      w,
      p,
      p.standData?.transformed ? 1.25 : 1.8,
      p.standData?.transformed ? 0.9 : 0.6,
    )
  )
    p.crouching = true;
  const pad =
      game.controller?.lastDevice === "controller" && !game.multiplayer?.isGuest
        ? game.controller.move
        : game.touch?.active && !game.multiplayer?.isGuest
          ? touchMovement(game)
          : null,
    directions = pad ? game.keys || keys : keys;
  let f =
      (directions.has("KeyW") ? 1 : 0) -
      (directions.has("KeyS") ? 1 : 0) -
      (pad?.y || 0),
    s =
      (directions.has("KeyD") ? 1 : 0) -
      (directions.has("KeyA") ? 1 : 0) +
      (pad?.x || 0),
    length = Math.hypot(f, s);
  const canSprint = !p.crouching && (creative || p.food > 6);
  if (!canSprint) game.sprintInput?.reset();
  else if (!length) game.sprintInput?.stop();
  p.sprinting = !!(
    canSprint &&
    length &&
    (game.sprintInput?.latched ||
      ((keys.has("ControlLeft") || keys.has("ControlRight")) && f > 0))
  );
  p.swimming = !!(
    (p.inWater && p.sprinting && !p.flying && !p.crouching) ||
    (p.swimming && !p.flying && collides(w, p, 1.8, 0.6))
  );
  if (length && (!pad || length > 1)) {
    f /= length;
    s /= length;
  }
  let speed = p.flying
    ? p.sprinting
      ? 21.78
      : 10.89
    : p.inLava
      ? 1.2
      : p.inWater
        ? p.swimming
          ? p.effects?.dolphins_grace
            ? 9.8
            : 5.6
          : 2.2
        : p.crouching
          ? 1.295
          : p.sprinting
            ? 5.612
            : 4.317;
  if (p.effects?.slowness)
    speed *= Math.max(0.1, 1 - p.effects.slowness.level * 0.15);
  if (w.get(p.x, p.y - 0.1, p.z) === B.soul_sand) speed *= 0.4;
  if (p.standData?.transformed) speed *= 1.35;
  if (feet === B.cobweb || head === B.cobweb) {
    speed *= 0.24;
    p.vy = Math.max(p.vy, -0.8);
  }
  if (p.runicSlow > 0) {
    speed *= 0.5;
    p.runicSlow = Math.max(0, p.runicSlow - dt * 20);
  }
  p.gliding=!!(!p.flying&&!p.onGround&&!p.inWater&&!p.inLava&&game.inventory?.equipment?.[1]?.id==="elytra"&&(game.inventory.equipment[1].durability??432)>1&&keys.has("Space")&&p.vy<1);
  if(p.gliding){speed=14+Math.max(0,-Math.sin(p.pitch))*12;p.glideWear=(p.glideWear||0)+dt;if(p.glideWear>=1-1e-8&&!creative){const wings=game.inventory.equipment[1];wings.durability=Math.max(1,(wings.durability??432)-1);p.glideWear-=1;}}
  if(p.gliding){f=1;s*=.3;}
  const tx = (-Math.sin(p.yaw) * f + Math.cos(p.yaw) * s) * speed,
    tz = (-Math.cos(p.yaw) * f - Math.sin(p.yaw) * s) * speed;
  const accel =
    1 -
    Math.exp(
      -(p.onGround
        ? [B.ice, B.packed_ice, B.blue_ice].includes(w.get(p.x, p.y - 0.1, p.z))
          ? 1.1
          : 18
        : p.inWater
          ? 5
          : 8) * dt,
    );
  p.vx += (tx - p.vx) * accel;
  p.vz += (tz - p.vz) * accel;
  if (p.inWater && !p.flying) {
    const [cx, cz] = fluidCurrent(w, p.x, p.y + 0.4, p.z);
    p.vx += cx * 4 * dt;
    p.vz += cz * 4 * dt;
  }
  if (p.flying) {
    p.vy = ((keys.has("Space") ? 1 : 0) - (wantsCrouch ? 1 : 0)) * 7;
  } else if (p.inWater || p.inLava) {
    p.vy = Math.max(-3, p.vy - 7 * dt);
    if (p.swimming)
      p.vy += (Math.sin(p.pitch) * speed - p.vy) * (1 - Math.exp(-5 * dt));
    if (keys.has("Space")) p.vy = 3;
  } else {
    if (keys.has("Space") && p.onGround) {
      p.vy = 8.8;
      p.onGround = false;
      p.fallStart = p.y;
      p.exhaustion += p.sprinting ? 0.2 : 0.05;
      game.audio?.tone("step", BLOCKS[w.get(p.x, p.y - 0.1, p.z)]?.key);
    }
    if(p.levitationTicks>0){p.vy+=(1.8-p.vy)*(1-Math.exp(-5*dt));p.fallStart=p.y;}
    else if(p.gliding){p.vy+=(Math.min(-.65,Math.sin(p.pitch)*8-2)-p.vy)*(1-Math.exp(-3*dt));p.fallStart=p.y;}
    else p.vy = Math.max(-78, p.vy - 32 * dt);
  }
  if (
    (BLOCKS[feet]?.shape === "ladder" || BLOCKS[head]?.shape === "ladder") &&
    !p.flying
  ) {
    p.vy =
      keys.has("Space") || f > 0 ? 2.4 : p.crouching ? 0 : Math.max(-3, p.vy);
    p.fallStart = p.y;
  }
  if (p.riptide?.ticks > 0) {
    const r = p.riptide;
    p.vx = r.x;
    p.vy = r.y;
    p.vz = r.z;
    r.ticks -= dt * 20;
    if (r.ticks <= 0) delete p.riptide;
  }
  let dx = p.vx * dt,
    dz = p.vz * dt;
  if (p.crouching && p.onGround && !p.inWater) {
    const supported = (x, z) => collides(w, { ...p, x, y: p.y - 0.1, z }, 0.1);
    if (!supported(p.x + dx, p.z)) dx = 0;
    if (!supported(p.x, p.z + dz)) dz = 0;
    if (!supported(p.x + dx, p.z + dz)) {
      dx = 0;
      dz = 0;
    }
  }
  const prevX = p.x,
    prevZ = p.z,
    prevY = p.y,
    landed = movePlayerSwept(
      w,
      p,
      dx,
      p.vy * dt,
      dz,
      playerHeight(p),
      p.standData?.transformed ? 0.9 : 0.6,
      p.flying || p.swimming || p.riptide ? 0 : 1,
    );
  if (p.sprinting && Math.hypot(p.x - prevX, p.z - prevZ) < 0.00001) {
    game.sprintInput?.stop();
    p.sprinting = false;
  }
  if (p.y > p.fallStart) p.fallStart = p.y;
  if (p.flying || p.inWater || p.inLava) p.fallStart = p.y;
  if (landed) {
    // Collision bisection can leave the feet a few microunits below a face.
    // Ignore that numerical error before rounding to whole damage points.
    const fallDistance = p.fallStart - p.y;
    if (fallDistance > 0.4 && !p.inWater)
      game.audio?.tone("land", BLOCKS[w.get(p.x, p.y - 0.1, p.z)]?.key);
    if (!creative && fallDistance > 3.001)
      game.damage(Math.ceil(fallDistance - 3 - 0.001), "a fall");
    p.fallStart = p.y;
  } else if (prevY < p.y) p.fallStart = p.y;
  if (length && p.onGround && !creative)
    p.exhaustion += Math.hypot(dx, dz) * (p.sprinting ? 0.1 : 0);
  p.hurt = Math.max(0, p.hurt - dt);
  if (p.y < MIN_Y - 20) game.damage(20, "the void");
  return length > 0;
}

function movePlayerSwept(w, p, dx, dy, dz, h, width, step) {
  const n = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.3),
  );
  let landed = false;
  for (let i = 0; i < n; i++)
    landed = moveBody(w, p, dx / n, dy / n, dz / n, h, width, step) || landed;
  return landed;
}
