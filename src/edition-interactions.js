import { emittedLight, dirtyLightRegion } from "./block-light.js";
import { useEditionWeapon } from "./edition-combat.js";
import { B, BLOCKS, ITEMS, makeStack, MIN_Y, MAX_Y } from "./data.js";
import { blockParts, editionStateId } from "./block-shapes.js";
import { overlapsPanel, placeDoor } from "./doors.js";
import { playerHeight, playerEye } from "./player-body.js";
const keyOf = (t) => `${t.x},${t.y},${t.z}`;
function feedback(g, kind = "use", sound = "place") {
  g.renderer?.action(kind);
  g.audio?.tone(sound);
  g.ui?.updateHotbar();
}
function consume(g) {
  if (g.mode !== "creative") g.inventory.consume();
}
function wear(g) {
  if (g.mode !== "creative") g.inventory.damageTool();
}
export function useEdition(game) {
  const g = game,
    t = g.target,
    p = g.player,
    held = g.inventory.held,
    item = ITEMS[held?.id],
    world = g.world,
    b = BLOCKS[t?.id];
  if (
    t &&
    !p.crouching &&
    b?.edition &&
    ["gate", "trapdoor"].includes(b.shape)
  ) {
    const id = editionStateId(t.id, { open: !b.state.open });
    const people = [p, ...g.entities, ...(g.multiplayer?.occupants() || [])];
    if (
      BLOCKS[id].solid &&
      people.some((body) =>
        blockParts(id, world, t.x, t.y, t.z, true).some((part) =>
          overlapsPanel(
            body,
            t.x,
            t.y,
            t.z,
            part,
            body.height || playerHeight(body),
            body.width || 0.6,
          ),
        ),
      )
    )
      return true;
    world.set(t.x, t.y, t.z, id);
    feedback(g, "use", b.state.open ? "door-close" : "door-open");
    return true;
  }
  if (t && !p.crouching && b?.station) {
    if (["stonecutter", "smithing_table"].includes(b.station)) {
      g.audio?.tone("open");
      g.openInventory(b.station, null, t);
      return true;
    }
    const key = keyOf(t),
      type = b.station === "barrel" ? "chest" : "furnace";
    const c = (world.containers[key] ||= {
      type,
      station: b.station,
      slots: Array(type === "chest" ? 27 : 3).fill(null),
      burn: 0,
      progress: 0,
      fuelMax: 0,
      xp: 0,
    });
    g.audio?.tone("open");
    g.openInventory(type, c, t);
    return true;
  }
  if (held?.id === "compass") {
    const s = g.spawn || world.findSpawn();
    g.ui.toast(
      `World spawn · X ${Math.floor(s.x)} · Y ${Math.floor(s.y)} · Z ${Math.floor(s.z)}`,
    );
    feedback(g);
    return true;
  }
  if (held?.id === "clock") {
    g.ui.toast(
      `${world.dimension === "overworld" ? "Overworld" : "Cinderworld"} · Day ${Math.floor(g.time / 24000) + 1} · ${Math.floor((g.time % 24000) / 1000 + 6) % 24}:00`,
    );
    return true;
  }
  if (held?.id === "spyglass") {
    p.spyglassUntil = (p.spyglassUntil || 0) > g.elapsed ? 0 : g.elapsed + 8;
    feedback(g);
    return true;
  }
  if (held?.id === "shears") {
    const e = g.targetEntity?.();
    if (e?.type === "woolling" && !e.baby && !e.sheared) {
      e.sheared = true;
      if (g.mode !== "creative") {
        const s = makeStack("wool", 2 + Math.floor(Math.random() * 2));
        g.drops.push({
          ...s,
          x: e.x,
          y: e.y + 0.5,
          z: e.z,
          vx: 0,
          vy: 1,
          vz: 0,
          age: 0,
          delay: 8,
          uid: crypto.randomUUID(),
        });
        wear(g);
      }
      feedback(g);
      return true;
    }
  }
  if (t && item?.tool === "axe" && !p.crouching) {
    const wood =
      b.key === "log" ? "oak_log" : b.key === "pine_log" ? "spruce_log" : b.key;
    const stripped = B["stripped_" + wood];
    if (stripped !== undefined) {
      world.set(t.x, t.y, t.z, stripped);
      wear(g);
      feedback(g);
      return true;
    }
  }
  if (t && held?.id === "bone_meal" && (b?.crop || b?.sapling)) {
    if (b.crop && b.crop.age < 3) {
      world.set(t.x, t.y, t.z, t.id + 1);
      consume(g);
      feedback(g);
    } else if (b.sapling && growSapling(world, t.x, t.y, t.z)) {
      consume(g);
      feedback(g);
    }
    return true;
  }
  if (useEditionWeapon(g)) return true;
  const crop = BLOCKS.findIndex(
    (b) => b.crop && b.crop.item === held?.id && b.crop.age === 0,
  );
  if (
    crop >= 0 &&
    t &&
    (t.id === B.farmland ||
      (held.id === "sweet_berries" &&
        [B.grass, B.dirt, B.moss].includes(t.id))) &&
    world.get(t.x, t.y + 1, t.z) === B.air
  ) {
    world.set(t.x, t.y + 1, t.z, crop);
    consume(g);
    feedback(g, "place");
    return true;
  }
  return false;
}
export function placeEdition(game) {
  const g = game,
    item = ITEMS[g.inventory.held?.id],
    b = BLOCKS[item?.block],
    t = g.target,
    p = g.player,
    w = g.world;
  if (!b?.edition || !t) return false;
  let id = item.block,
    replace = BLOCKS[t.id]?.snowLayers && BLOCKS[t.id].snowLayers < 8;
  let x = t.x + (replace ? 0 : t.normal.x),
    y = t.y + (replace ? 0 : t.normal.y),
    z = t.z + (replace ? 0 : t.normal.z),
    existing = w.get(x, y, z);
  // Merge against the clicked half first, then against the adjacent cell.
  if (b.shape === "slab") {
    const old = BLOCKS[t.id];
    if (
      old?.editionBase === b.editionBase &&
      old.state.half !== "double" &&
      ((old.state.half === "bottom" && t.normal.y === 1) ||
        (old.state.half === "top" && t.normal.y === -1))
    ) {
      x = t.x;
      y = t.y;
      z = t.z;
      existing = t.id;
      id = editionStateId(t.id, { half: "double" });
    } else if (
      BLOCKS[existing]?.editionBase === b.editionBase &&
      BLOCKS[existing].state.half !== "double"
    )
      id = editionStateId(existing, { half: "double" });
  }
  const combining = BLOCKS[id].state?.half === "double";
  if (
    !combining &&
    existing !== B.air &&
    existing !== B.fire &&
    !BLOCKS[existing]?.snowLayers &&
    !["water", "lava"].includes(BLOCKS[existing]?.key)
  )
    return true;
  if (y <= MIN_Y || y > MAX_Y) return true;
  const facing = ((Math.round(-p.yaw / (Math.PI / 2)) % 4) + 4) % 4;
  const hitY = p.y + playerEye(p) + Math.sin(p.pitch) * t.distance - t.y;
  if (b.door) {
    if (
      placeDoor(
        w,
        x,
        y,
        z,
        p.yaw,
        [p, ...g.entities, ...(g.multiplayer?.occupants() || [])],
        b.editionBase,
      )
    ) {
      consume(g);
      feedback(g, "place");
    }
    return true;
  }
  if (b.shape === "slab" && !combining)
    id = editionStateId(id, {
      half: t.normal.y === -1 || (!t.normal.y && hitY > 0.5) ? "top" : "bottom",
    });
  if (b.shape === "stairs")
    id = editionStateId(id, {
      facing,
      half: t.normal.y === -1 || (!t.normal.y && hitY > 0.5) ? "top" : "bottom",
    });
  if (b.shape === "gate") id = editionStateId(id, { facing });
  if (b.shape === "trapdoor")
    id = editionStateId(id, {
      facing,
      half: t.normal.y === -1 || (!t.normal.y && hitY > 0.5) ? "top" : "bottom",
    });
  if (b.shape === "ladder") {
    if (t.normal.y || !w.solid(t.x, t.y, t.z)) return true;
    const f =
      t.normal.z === 1 ? 0 : t.normal.x === -1 ? 1 : t.normal.z === -1 ? 2 : 3;
    id = editionStateId(id, { facing: f });
  }
  if (b.state?.axis)
    id = editionStateId(id, {
      axis: t.normal.x ? "x" : t.normal.z ? "z" : "y",
    });
  if (b.plant && !w.solid(x, y - 1, z)) return true;
  const parts = blockParts(id, w, x, y, z, true);
  if (
    BLOCKS[id].solid &&
    [p, ...(g.multiplayer?.occupants() || [])].some((body) =>
      parts.some((part) =>
        overlapsPanel(body, x, y, z, part, playerHeight(body), 0.6),
      ),
    )
  )
    return true;
  if (w.set(x, y, z, id)) {
    consume(g);
    feedback(g, "place");
  }
  return true;
}
function loaded(w, x, z) {
  return w.chunks.has(`${Math.floor(x / 16)},${Math.floor(z / 16)}`);
}
export function growSapling(w, x, y, z) {
  const b = BLOCKS[w.get(x, y, z)];
  if (!b?.sapling) return false;
  const wood = b.sapling === "spruce" ? "pine" : b.sapling;
  const log = B[wood + "_log"] ?? (wood === "oak" ? B.log : undefined),
    leaves = B[wood + "_leaves"] ?? (wood === "oak" ? B.leaves : undefined);
  if (log === undefined || leaves === undefined) return false;
  // Whole crown must fit in loaded, empty cells before modifying the sapling.
  const cells = [];
  for (let dy = 0; dy < 5; dy++) cells.push([x, y + dy, z, log]);
  for (let dy = 3; dy <= 5; dy++)
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++)
        if (
          Math.abs(dx) + Math.abs(dz) < 4 &&
          !(dx === 0 && dz === 0 && dy < 5)
        )
          cells.push([x + dx, y + dy, z + dz, leaves]);
  if (
    cells.some(
      ([cx, cy, cz]) =>
        !loaded(w, cx, cz) ||
        cy > MAX_Y ||
        ((cx !== x || cy !== y || cz !== z) && w.get(cx, cy, cz) !== B.air),
    )
  )
    return false;
  for (const [cx, cy, cz, id] of cells) w.set(cx, cy, cz, id);
  return true;
}
export function registerEditionChunk(w, c) {
  c.lightSources = [];
  for (let i = 0; i < c.data.length; i++) {
    const b = BLOCKS[c.data[i]];
    if (emittedLight(c.data[i]))
      c.lightSources.push([
        c.cx * 16 + (i % 16),
        MIN_Y + Math.floor(i / 256),
        c.cz * 16 + Math.floor((i % 256) / 16),
        emittedLight(c.data[i]),
      ]);
    if (b?.crop || b?.sapling) {
      const y = Math.floor(i / 256) + MIN_Y,
        z = Math.floor((i % 256) / 16) + c.cz * 16,
        x = (i % 16) + c.cx * 16;
      (w.editionPlants ||= new Set()).add(`${x},${y},${z}`);
    }
  }
  if (c.lightSources.length) dirtyLightRegion(w, c.cx * 16, c.cz * 16);
}
export function tickEditionWorld(w, center, radius) {
  if (!center || w.tick % 200 !== 0 || !w.editionPlants?.size) return;
  // Bound growth to loaded cells near the host. Never load terrain for plants.
  let budget = 64;
  for (const key of [...w.editionPlants]) {
    if (budget-- <= 0) break;
    w.editionPlants.delete(key);
    w.editionPlants.add(key);
    const [x, y, z] = key.split(",").map(Number);
    if (!loaded(w, x, z)) {
      w.editionPlants.delete(key);
      continue;
    }
    if (Math.hypot(x - center.x, z - center.z) > radius) continue;
    const id = w.get(x, y, z),
      b = BLOCKS[id];
    if (!b?.crop && !b?.sapling) {
      w.editionPlants.delete(key);
      continue;
    }
    if (b.sapling) {
      growSapling(w, x, y, z);
      continue;
    }
    if (b.crop.age >= 3) continue;
    let watered = b.crop.item === "sweet_berries";
    for (let dz = -4; dz <= 4 && !watered; dz++)
      for (let dx = -4; dx <= 4; dx++)
        if (
          (loaded(w, x + dx, z + dz) &&
            BLOCKS[w.get(x + dx, y - 1, z + dz)]?.fluid?.type === "water") ||
          (loaded(w, x + dx, z + dz) &&
            w.get(x + dx, y - 1, z + dz) === B.water)
        ) {
          watered = true;
          break;
        }
    if (watered && w.skyHeight(x, z) <= y) w.set(x, y, z, id + 1);
  }
}
