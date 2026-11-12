import { recordAchievement } from "./achievements.js";
import { B, BLOCKS, SEA, makeStack } from "./data.js";
import { Inventory } from "./inventory.js";
import { hash } from "./random.js";
export const EXTRACTION_MS = 30000;
export const TEMPLE_GUARDIANS = 3;
// Count the three distinct temple roles, never raw array length.
export function guardianDefeatCount(world) {
  const defeated = world.settlements?.["devin-temple"]?.defeated || [];
  return Array.from({ length: TEMPLE_GUARDIANS }, (_, i) => i).filter((i) =>
    defeated.includes(i),
  ).length;
}
export function templeGuardiansDefeated(game) {
  return (
    guardianDefeatCount(game.world) === TEMPLE_GUARDIANS &&
    !(game.entities || []).some(
      (e) =>
        e.type === "devin_guardian" &&
        e.encounter === "devin-temple" &&
        e.hp > 0,
    )
  );
}
export function templeUnlocked(game) {
  if (game.world.generationVersion < 7) return true; // Legacy sites have no Guardians.
  return (
    templeGuardiansDefeated(game) &&
    (game.world.generationVersion < 11 ||
      game.world.settlements?.["devin-temple"]?.attuned ||
      game.mode === "creative" ||
      game.difficulty === "peaceful")
  );
}
export function relicSite(world) {
  if (world.dimension !== "overworld" || world.generationVersion < 3)
    return null;
  if (world.relicPlan !== undefined) return world.relicPlan;
  const temple = world.generationVersion >= 7;
  for (
    let radius = temple ? 1024 : 28;
    radius <= (temple ? 1792 : 220);
    radius += temple ? 32 : 8
  )
    for (let a = 0; a < 12; a++) {
      const angle = (a * Math.PI) / 6 + hash(1, 0, 1, world.seedInt) * 0.4;
      const x = 8 + Math.round(Math.cos(angle) * radius),
        z = 8 + Math.round(Math.sin(angle) * radius),
        t = world.terrain(x, z);
      if (
        t.h > SEA + 3 &&
        t.h < 110 &&
        !t.village &&
        Math.abs(world.terrain(x + 2, z).h - t.h) < 3 &&
        Math.abs(world.terrain(x, z + 2).h - t.h) < 3 &&
        (!temple ||
          [
            [-14, -14],
            [14, 14],
            [-14, 14],
            [14, -14],
          ].every(
            ([dx, dz]) => Math.abs(world.terrain(x + dx, z + dz).h - t.h) < 7,
          ))
      )
        return (world.relicPlan = {
          x,
          y: t.h + (temple ? 2 : 1),
          z,
          ...(temple ? { temple: true } : {}),
        });
    }
  return (world.relicPlan = null);
}
export function generateRelic(world, chunk, put) {
  const p = relicSite(world);
  if (
    !p ||
    Math.abs(chunk.cx * 16 + 8 - p.x) >
      (p.temple
        ? world.generationVersion >= 10
          ? 48
          : world.generationVersion >= 9
            ? 40
            : 25
        : 12) ||
    Math.abs(chunk.cz * 16 + 8 - p.z) >
      (p.temple
        ? world.generationVersion >= 10
          ? 48
          : world.generationVersion >= 9
            ? 40
            : 25
        : 12)
  )
    return;
  if (p.temple) {
    if (world.generationVersion >= 10) generateCitadel(world, chunk, put, p);
    else if (world.generationVersion >= 9)
      generateGrandTemple(world, chunk, put, p);
    else generateTemple(world, chunk, put, p);
    if (world.generationVersion >= 11) fortifyTemple(world, chunk, put, p);
  }
  for (let dz = -2; dz <= 2; dz++)
    for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dz * dz > 5) continue;
      put(
        p.x + dx - chunk.cx * 16,
        p.y - 1,
        p.z + dz - chunk.cz * 16,
        dx === 0 && dz === 0 ? B.obsidian : B.cobble,
      );
      for (let dy = 0; dy < 4; dy++)
        put(
          p.x + dx - chunk.cx * 16,
          p.y + dy,
          p.z + dz - chunk.cz * 16,
          B.air,
        );
    }
  if (world.relicClaimed) return;
  put(p.x - chunk.cx * 16, p.y, p.z - chunk.cz * 16, B.devin_relic_base);
  put(p.x - chunk.cx * 16, p.y + 1, p.z - chunk.cz * 16, B.devin_relic_blade);
}
export function resetExtraction(game) {
  game.extraction = null;
}
export function extractRelic(game, target, now = performance.now()) {
  const type = BLOCKS[target?.id]?.relic;
  if (!game.mouseDown || !game.running || !type || game.player.health <= 0) {
    resetExtraction(game);
    return false;
  }
  const { x, z } = target,
    y = target.y - (type === "blade" ? 1 : 0),
    key = `${x},${y},${z}`;
  if (!templeUnlocked(game)) {
    resetExtraction(game);
    if (now >= (game.nextTempleHint || 0)) {
      game.ui?.toast(
        !templeGuardiansDefeated(game)
          ? "The seal holds. Defeat all three Guardians of The Devin Sword first."
          : "Win a Cinder Sigil from a guarded Cinderworld vault, then use it on the temple's front ward.",
      );
      game.nextTempleHint = now + 3000;
    }
    return true;
  }
  if (
    game.dimension !== "overworld" ||
    game.world.relicClaimed ||
    game.world.get(x, y, z) !== B.devin_relic_base ||
    game.world.get(x, y + 1, z) !== B.devin_relic_blade ||
    Math.hypot(
      game.player.x - x - 0.5,
      game.player.y + 1.5 - y - 0.5,
      game.player.z - z - 0.5,
    ) > (game.mode === "creative" ? 5.5 : 4.8)
  ) {
    resetExtraction(game);
    return false;
  }
  if (game.extraction?.key !== key)
    game.extraction = { key, started: now, progress: 0 };
  game.extraction.progress = Math.min(
    1,
    Math.max(0, (now - game.extraction.started) / EXTRACTION_MS),
  );
  if (game.extraction.progress < 1) return true;
  const working = new Inventory(game.inventory.export());
  const sword = {
    ...makeStack("devin_sword"),
    origin: `${game.world.seed}:${key}`,
  };
  if (working.add(sword)) {
    if (!game.extraction.full)
      game.ui?.toast(
        "Make room in your inventory. The sword remains in the stone.",
      );
    game.extraction.full = true;
    return true;
  }
  // The claim and both terrain edits complete synchronously before any save.
  game.world.set(x, y, z, B.air);
  game.world.set(x, y + 1, z, B.air);
  game.world.relicClaimed = true;
  game.inventory.slots = working.slots;
  recordAchievement(game,"claim",{item:"devin_sword"});
  resetExtraction(game);
  game.audio?.devinClaim?.();
  game.renderer?.action("use");
  game.ui?.updateHotbar();
  game.ui?.announce?.(
    "THE DEVIN SWORD",
    "Charged hits restore health. Right-click for Devin's Pulse.",
  );
  game.save?.()?.catch?.(() => {});
  return true;
}
function generateTemple(world, chunk, put, p) {
  const set = (dx, dy, dz, id) =>
    put(p.x + dx - chunk.cx * 16, p.y + dy, p.z + dz - chunk.cz * 16, id);
  for (let dz = -15; dz <= 15; dz++)
    for (let dx = -15; dx <= 15; dx++) {
      const x = p.x + dx,
        z = p.z + dz;
      if (Math.floor(x / 16) !== chunk.cx || Math.floor(z / 16) !== chunk.cz)
        continue;
      for (let y = Math.min(world.terrain(x, z).h, p.y - 3); y < p.y; y++)
        put(x - chunk.cx * 16, y, z - chunk.cz * 16, B.cobble);
      set(dx, -1, dz, (dx + dz) % 4 === 0 ? B.runestone : B.stone);
      for (let dy = 0; dy <= 13; dy++) set(dx, dy, dz, B.air);
      if (
        (Math.abs(dx) === 13 || Math.abs(dz) === 13) &&
        !(dz === 13 && Math.abs(dx) < 3)
      )
        for (let dy = 0; dy < 5; dy++) set(dx, dy, dz, B.runestone);
      if (
        Math.abs(dx) <= 13 &&
        Math.abs(dz) <= 13 &&
        (Math.abs(dx) >= 11 || Math.abs(dz) >= 11)
      )
        set(dx, 9, dz, B.runestone);
    }
  for (const dx of [-11, 11])
    for (const dz of [-11, -3, 5, 11]) {
      for (let dy = 0; dy < 9; dy++)
        for (let a = 0; a <= 1; a++)
          for (let b = 0; b <= 1; b++)
            set(dx + a, dy, dz + b, dy % 3 === 0 ? B.runestone : B.basalt);
      set(dx, 9, dz, B.glow_crystal);
    }
  for (let dx = -5; dx <= 5; dx++)
    for (let dz = -5; dz <= 5; dz++)
      if (Math.abs(dx) + Math.abs(dz) > 5 && Math.abs(dx) + Math.abs(dz) < 8)
        set(dx, -1, dz, world.generationVersion >= 8 ? B.basalt : B.obsidian);
  for (const dx of [-8, 8]) {
    set(dx, 0, -8, B.basalt);
    set(dx, 1, -8, B.torch);
  }
  const key = `${p.x + 8},${p.y},${p.z - 5}`;
  set(8, 0, -5, B.chest);
  if (
    Math.floor((p.x + 8) / 16) === chunk.cx &&
    Math.floor((p.z - 5) / 16) === chunk.cz &&
    !world.containers[key] &&
    !world.edits.has(key)
  ) {
    const slots = Array(27).fill(null);
    [
      ["cooked_meat", 6],
      ["iron_ingot", 4],
      ["lapis_lazuli", 8],
    ].forEach(([id, count], i) => (slots[i] = makeStack(id, count)));
    world.containers[key] = { type: "chest", slots };
  }
}

// Generator 9 preserves the older temple layout for every existing world.
function generateGrandTemple(world, chunk, put, p) {
  const set = (dx, dy, dz, id) =>
    put(p.x + dx - chunk.cx * 16, p.y + dy, p.z + dz - chunk.cz * 16, id);
  for (let dz = -23; dz <= 26; dz++)
    for (let dx = -23; dx <= 23; dx++) {
      const x = p.x + dx,
        z = p.z + dz;
      if (Math.floor(x / 16) !== chunk.cx || Math.floor(z / 16) !== chunk.cz)
        continue;
      const edge = Math.max(Math.abs(dx), Math.abs(dz));
      if (dz > 23 && Math.abs(dx) > 6) continue;
      for (let y = Math.min(world.terrain(x, z).h, p.y - 5); y < p.y; y++)
        put(x - chunk.cx * 16, y, z - chunk.cz * 16, B.cobble);
      for (let dy = 0; dy <= 24; dy++) set(dx, dy, dz, B.air);
      set(
        dx,
        -1,
        dz,
        edge > 21
          ? B.basalt
          : Math.abs(dx) % 6 === 0 || Math.abs(dz) % 6 === 0
            ? B.runestone
            : B.stone,
      );
      if (edge === 22 && !(dz === 22 && Math.abs(dx) <= 5)) {
        for (let dy = 0; dy <= 2; dy++) set(dx, dy, dz, B.runestone);
        if ((dx + dz) % 3 === 0) set(dx, 3, dz, B.basalt);
      }
      // High outer galleries with open archways keep combat sightlines readable.
      if (
        (Math.abs(dx) === 18 || Math.abs(dz) === 18) &&
        !(dz === 18 && Math.abs(dx) < 5)
      ) {
        const along = Math.abs(dx) === 18 ? dz : dx;
        for (let dy = 0; dy <= 11; dy++)
          if (Math.abs(along) % 6 < 2 || dy >= 9)
            set(dx, dy, dz, dy % 3 === 0 ? B.runestone : B.basalt);
        set(dx, 12, dz, B.runestone);
        if (along % 6 === 0) set(dx, 13, dz, B.glow_crystal);
      }
      // A stepped open crown frames the sword instead of hiding it under a roof.
      const r = Math.max(Math.abs(dx), Math.abs(dz));
      if (r >= 5 && r <= 9) {
        const level = 19 - (r - 5);
        if (
          Math.abs(dx) <= 1 ||
          Math.abs(dz) <= 1 ||
          Math.abs(Math.abs(dx) - Math.abs(dz)) <= 1
        )
          set(
            dx,
            level,
            dz,
            (dx + dz) % 3 === 0 ? B.glow_crystal : B.runestone,
          );
      }
      if (Math.abs(dx) <= 5 && dz >= 18 && dz <= 26) {
        const rise = Math.max(0, Math.floor((26 - dz) / 3));
        for (let dy = -4; dy < -3 + rise; dy++) set(dx, dy, dz, B.runestone);
      }
    }
  for (const dx of [-18, 18])
    for (const dz of [-18, 18]) {
      for (let dy = 0; dy < 20; dy++)
        for (let a = -1; a <= 1; a++)
          for (let b = -1; b <= 1; b++)
            if (Math.abs(a) === 1 || Math.abs(b) === 1 || dy === 0)
              set(dx + a, dy, dz + b, dy % 4 === 0 ? B.runestone : B.basalt);
      for (let dy = 0; dy < 5; dy++) {
        const r = 3 - Math.floor(dy / 2);
        for (let a = -r; a <= r; a++)
          for (let b = -r; b <= r; b++)
            set(dx + a, 20 + dy, dz + b, B.runestone);
      }
      set(dx, 25, dz, B.glow_crystal);
    }
  for (const side of [-1, 1])
    for (let dz = -12; dz <= 12; dz += 6) {
      const dx = side * 13;
      for (let dy = 0; dy < 14; dy++)
        set(dx, dy, dz, dy % 3 === 0 ? B.runestone : B.basalt);
      set(dx, 14, dz, B.glow_crystal);
    }
  for (let dx = -4; dx <= 4; dx++)
    for (let dz = -4; dz <= 4; dz++)
      set(
        dx,
        -1,
        dz,
        Math.abs(dx) + Math.abs(dz) === 5 ? B.glow_crystal : B.basalt,
      );
  for (const dx of [-8, 8]) {
    set(dx, 0, -8, B.basalt);
    set(dx, 1, -8, B.torch);
  }
  const key = `${p.x + 12},${p.y},${p.z - 12}`;
  set(12, 0, -12, B.chest);
  if (
    Math.floor((p.x + 12) / 16) === chunk.cx &&
    Math.floor((p.z - 12) / 16) === chunk.cz &&
    !world.containers[key] &&
    !world.edits.has(key)
  ) {
    const slots = Array(27).fill(null);
    [
      ["cooked_meat", 10],
      ["iron_ingot", 6],
      ["lapis_lazuli", 12],
    ].forEach(([id, n], i) => (slots[i] = makeStack(id, n)));
    world.containers[key] = { type: "chest", slots };
  }
}

// Generator 10 expands the old grand court into a 69×73 citadel and a sealed
// inner sanctuary. Generation 2–9 never invokes this layout.
function generateCitadel(world, chunk, put, p) {
  const set = (dx, dy, dz, id) =>
    put(p.x + dx - chunk.cx * 16, p.y + dy, p.z + dz - chunk.cz * 16, id);
  for (let dz = -34; dz <= 38; dz++)
    for (let dx = -34; dx <= 34; dx++) {
      const wx = p.x + dx,
        wz = p.z + dz;
      if (
        Math.floor(wx / 16) !== chunk.cx ||
        Math.floor(wz / 16) !== chunk.cz ||
        (dz > 34 && Math.abs(dx) > 8)
      )
        continue;
      for (let y = Math.min(world.terrain(wx, wz).h, p.y - 7); y < p.y; y++)
        put(wx - chunk.cx * 16, y, wz - chunk.cz * 16, B.stone_bricks);
      for (let dy = 0; dy <= 36; dy++) set(dx, dy, dz, B.air);
      set(
        dx,
        -1,
        dz,
        Math.abs(dx) % 7 === 0 || Math.abs(dz) % 7 === 0
          ? B.runestone
          : B.stone_bricks,
      );
      const edge = Math.max(Math.abs(dx), Math.abs(dz));
      if (edge === 33 && !(dz === 33 && Math.abs(dx) <= 6))
        for (let dy = 0; dy < 6; dy++)
          set(dx, dy, dz, dy === 5 ? B.runestone : B.stone_bricks);
      if (edge === 33 && (dx + dz) % 3 === 0) set(dx, 6, dz, B.basalt);
      if (
        (Math.abs(dx) === 27 || dz === -27) &&
        Math.abs(dx) <= 27 &&
        Math.abs(dz) <= 27
      ) {
        const along = Math.abs(dx) === 27 ? dz : dx;
        for (let dy = 0; dy <= 16; dy++)
          if (Math.abs(along) % 7 <= 1 || dy >= 13)
            set(dx, dy, dz, dy % 4 === 0 ? B.runestone : B.stone_bricks);
      }
    }
  generateGrandTemple(world, chunk, put, p);
  for (const dx of [-30, 30])
    for (const dz of [-30, 30]) {
      for (let dy = 0; dy <= 28; dy++)
        for (let a = -2; a <= 2; a++)
          for (let b = -2; b <= 2; b++)
            if (Math.abs(a) === 2 || Math.abs(b) === 2 || dy === 0)
              set(
                dx + a,
                dy,
                dz + b,
                dy % 5 === 0 ? B.runestone : B.stone_bricks,
              );
      for (let dy = 0; dy < 7; dy++) {
        const r = 4 - Math.floor(dy / 2);
        for (let a = -r; a <= r; a++)
          for (let b = -r; b <= r; b++)
            set(dx + a, 29 + dy, dz + b, B.runestone);
      }
      set(dx, 36, dz, B.glow_crystal);
    }
  // Inner walls surround the sword. A four-block-tall seal opens only on victory.
  for (let dz = -7; dz <= 7; dz++)
    for (let dx = -7; dx <= 7; dx++) {
      const r = Math.max(Math.abs(dx), Math.abs(dz));
      if (r === 7)
        for (let dy = 0; dy <= 8; dy++)
          set(dx, dy, dz, dy % 4 === 0 ? B.runestone : B.stone_bricks);
      if (r === 7 && Math.abs(dx) === 7 && Math.abs(dz) === 7)
        for (let dy = 9; dy <= 22; dy++)
          set(dx, dy, dz, dy % 4 === 0 ? B.glow_crystal : B.runestone);
      if (r <= 7 && r >= 5) set(dx, 23 + (7 - r), dz, B.runestone);
    }
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = 0; dy < 4; dy++) set(dx, dy, 7, B.temple_seal);
  // Monumental approach, without impassable decorative steps.
  for (let z = 27; z <= 38; z++)
    for (let x = -6; x <= 6; x++)
      set(x, -1, z, Math.abs(x) === 6 ? B.glow_crystal : B.runestone);
}
export function openTempleSeal(world) {
  if (world.generationVersion < 10) return;
  const p = relicSite(world);
  if (!p?.temple) return;
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = 0; dy < 4; dy++)
      if (world.get(p.x + dx, p.y + dy, p.z + 7) === B.temple_seal)
        world.set(p.x + dx, p.y + dy, p.z + 7, B.air);
}

// The new outer ward is independent of the three-Guardian inner seal.
function fortifyTemple(world, chunk, put, p) {
  const set = (x, y, z, id) =>
    put(p.x + x - chunk.cx * 16, p.y + y, p.z + z - chunk.cz * 16, id);
  for (let lz = 0; lz < 16; lz++)
    for (let lx = 0; lx < 16; lx++) {
      const x = chunk.cx * 16 + lx - p.x,
        z = chunk.cz * 16 + lz - p.z;
      const edge = Math.max(Math.abs(x), Math.abs(z));
      if (edge >= 25 && edge <= 30 && !(z >= 25 && Math.abs(x) <= 2)) {
        set(x, -5, z, B.basalt);
        set(x, -4, z, B.lava);
        for (let y = -3; y <= 2; y++) set(x, y, z, B.air);
      }
      if (edge === 33 && !(z === 33 && Math.abs(x) <= 2))
        for (let y = 0; y <= 10; y++)
          set(x, y, z, y % 3 === 0 ? B.runestone : B.stone_bricks);
      if (Math.abs(x) === 4 && z === 32)
        for (let y = 0; y <= 13; y++)
          set(x, y, z, y === 13 ? B.glow_crystal : B.runestone);
      if (z === 32 && Math.abs(x) <= 3) {
        for (let y = 0; y <= 6; y++)
          set(x, y, z, Math.abs(x) <= 1 && y < 4 ? B.temple_seal : B.runestone);
      }
    }
}
export function openTempleApproach(world) {
  if (world.generationVersion < 11) return;
  const p = relicSite(world);
  if (!p) return;
  for (let x = -1; x <= 1; x++)
    for (let y = 0; y < 4; y++)
      if (world.get(p.x + x, p.y + y, p.z + 32) === B.temple_seal)
        world.set(p.x + x, p.y + y, p.z + 32, B.air);
}
export function attuneTemple(game, target) {
  if (
    game.world.generationVersion < 11 ||
    !target ||
    ![B.temple_seal, B.runestone].includes(target.id)
  )
    return false;
  if (target.id !== B.temple_seal && game.inventory.held?.id !== "cinder_sigil")
    return false;
  const p = relicSite(game.world);
  if (
    !p ||
    target.z !== p.z + 32 ||
    Math.abs(target.x - p.x) > 3 ||
    target.y < p.y ||
    target.y >= p.y + 7
  )
    return false;
  const record = (game.world.settlements["devin-temple"] ||= {
    created: [],
    defeated: [],
  });
  if (record.attuned) {
    openTempleApproach(game.world);
    return true;
  }
  if (
    game.mode !== "creative" &&
    game.difficulty !== "peaceful" &&
    game.inventory.held?.id !== "cinder_sigil"
  ) {
    game.ui?.toast?.(
      "The outer ward needs a Cinder Sigil. Defeat the six defenders of a Cinderworld vault to find one.",
    );
    return true;
  }
  if (game.mode !== "creative" && game.difficulty !== "peaceful")
    game.inventory.consume(game.inventory.selected, 1);
  record.attuned = true;
  openTempleApproach(game.world);
  game.audio?.tone?.("relic");
  game.ui?.announce?.(
    "THE OUTER WARD FALLS",
    "Three bulletproof Guardians still protect the sword. Bring enchanted blades or spears.",
  );
  game.ui?.updateHotbar?.();
  game.save?.()?.catch?.(() => {});
  return true;
}
