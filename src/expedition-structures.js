import { B, makeStack } from "./data.js";
import { hash } from "./random.js";
import { infernalLoot } from "./infernal-world.js";

export function siteOffset(s, x, z, inverse = false) {
  const turns = ((inverse ? -(s.rotation || 0) : s.rotation || 0) + 4) % 4;
  return turns === 1
    ? [-z, x]
    : turns === 2
      ? [-x, -z]
      : turns === 3
        ? [z, -x]
        : [x, z];
}
export function generateExpeditionStructure(world, chunk, put, s) {
  const set = (x, y, z, id) => {
    const [dx, dz] = siteOffset(s, x, z);
    put(s.x + dx - chunk.cx * 16, s.y + y, s.z + dz - chunk.cz * 16, id);
  };
  const stone = s.palette ? B.basalt : B.cinder_bricks;
  const trim = s.palette ? B.cinder_bricks : B.basalt;
  for (let lz = 0; lz < 16; lz++)
    for (let lx = 0; lx < 16; lx++) {
      const [x, z] = siteOffset(
        s,
        chunk.cx * 16 + lx - s.x,
        chunk.cz * 16 + lz - s.z,
        true,
      );
      const edge = Math.max(Math.abs(x), Math.abs(z));
      if (edge > s.radius) continue;
      for (let y = -3; y <= s.height + 2; y++)
        set(x, y, z, y <= 0 ? stone : B.air);
      set(x, 0, z, x % 7 === 0 || z % 7 === 0 ? trim : stone);
      // Shared open approach and guarded vault: no randomized wall can trap a guard.
      if (edge === s.radius && !(z === s.radius && Math.abs(x) <= 4)) {
        const wall = s.kind === "foundry" ? 5 : s.kind === "cathedral" ? 8 : 13;
        const ruin = hash(x, z, s.variant, world.seedInt) < 0.07;
        for (let y = 1; y <= (ruin ? wall - 3 : wall); y++)
          set(x, y, z, y % 5 ? stone : trim);
      }
      if (s.kind === "citadel") {
        const towerGap = s.radius - 4;
        for (const tx of [-towerGap, towerGap])
          for (const tz of [-towerGap, towerGap]) {
            const d = Math.max(Math.abs(x - tx), Math.abs(z - tz));
            if (d > 3) continue;
            const height =
              s.height -
              Math.floor(hash(tx, tz, s.variant, world.seedInt) * 10);
            if (d === 3)
              for (let y = 1; y < height; y++)
                if (y > 4 || Math.abs(x - tx) > 1)
                  set(x, y, z, y % 8 ? stone : trim);
            set(x, height, z, d === 0 ? B.glow_crystal : trim);
          }
        if (Math.abs(x) === 20 && Math.abs(z) < 20)
          for (let y = 1; y <= 18; y++) set(x, y, z, stone);
        if (
          Math.abs(x) <= 20 &&
          Math.abs(z) <= 21 &&
          (Math.abs(z) === 21 || z % 9 === 0)
        )
          set(x, 22 + Math.floor((20 - Math.abs(x)) * 0.45), z, trim);
      } else if (s.kind === "cathedral") {
        if (Math.abs(x) === 20 && Math.abs(z) <= 23)
          for (let y = 1; y <= 26; y++) {
            const window = Math.abs(z % 9) <= 2 && y > 8 && y < 22;
            set(x, y, z, window ? B.emberglass : stone);
          }
        if (Math.abs(x) <= 21 && Math.abs(z) <= 23) {
          const roof = 44 - Math.floor(Math.abs(x) * 0.8) + (s.variant % 3);
          set(x, roof, z, z % 7 === 0 ? trim : stone);
        }
        if (Math.abs(Math.abs(x) - 20) <= 2 && Math.abs(z - 22) <= 2)
          for (let y = 1; y <= s.height - Math.abs(Math.abs(x) - 20); y++)
            set(x, y, z, y === s.height ? B.glow_crystal : trim);
      } else {
        // Open industrial crucible, three independently tall chimneys and safe catwalks.
        if (Math.abs(x) >= 6 && Math.abs(x) <= 14 && z > -6 && z < 15) {
          set(x, -1, z, B.basalt);
          set(x, 0, z, B.lava);
          if (z % 8 === 0) set(x, 1, z, trim);
        }
        for (const tx of [-20, 0, 20]) {
          const d = Math.max(Math.abs(x - tx), Math.abs(z - 21));
          const height =
            20 + Math.floor(hash(tx, s.variant, 22, world.seedInt) * 25);
          if (d === 2)
            for (let y = 1; y <= height; y++)
              set(x, y, z, y % 6 ? trim : stone);
          if (d < 2) set(x, 1, z, B.lava);
        }
        if (Math.abs(x) >= 18 && Math.abs(x) <= 20 && z > -5 && z < 13)
          set(x, 1, z, B.furnace);
      }
      if (Math.abs(x) === 18 && z % 8 === 4) {
        set(x, 1, z, trim);
        set(x, 2, z, B.glow_crystal);
      }
      if (Math.abs(x) <= 7 && z >= -21 && z <= -8) {
        if (Math.abs(x) === 7 || z === -21 || z === -8)
          for (let y = 1; y <= 8; y++) set(x, y, z, trim);
        set(x, 9, z, stone);
        if (z === -8 && Math.abs(x) <= 1)
          for (let y = 1; y <= 4; y++) set(x, y, z, B.infernal_seal);
      }
    }
  const [dx, dz] = siteOffset(s, 0, -15),
    x = s.x + dx,
    z = s.z + dz,
    y = s.y + 1,
    key = `${x},${y},${z}`;
  set(0, 1, -15, B.chest);
  if (
    Math.floor(x / 16) === chunk.cx &&
    Math.floor(z / 16) === chunk.cz &&
    !world.containers[key] &&
    !world.edits.has(key)
  ) {
    const slots = Array(27).fill(null);
    infernalLoot(s).forEach((stack, i) => (slots[i] = stack));
    slots[8] = makeStack(
      s.variant % 2 ? "hellfire_ingot" : "raw_hellfire",
      2 + (s.variant % 5),
    );
    world.containers[key] = {
      type: "chest",
      slots,
      encounter: s.id,
      guarded: 6,
    };
  }
}
