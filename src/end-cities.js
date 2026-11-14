import { B, makeStack, ITEMS } from "./data.js";
import { hash, hashSeed } from "./random.js";
import { endTerrain } from "./end-terrain.js";
const key = (x, y, z) => `${x},${y},${z}`;
export function endCityAt(w, gx, gz) {
  if (w.dimension !== "end" || Math.hypot(gx, gz) < 4) return null;
  w.endCityPlans ||= new Map();
  const id = `end-city:${gx},${gz}`;
  if (w.endCityPlans.has(id)) return w.endCityPlans.get(id);
  const seed = hashSeed(w.seed),
    x = Math.round(gx * 180 + (hash(gx, 5, gz, seed) - 0.5) * 60),
    z = Math.round(gz * 180 + (hash(gx, 6, gz, seed) - 0.5) * 60),
    t = endTerrain(w, x, z);
  const site =
    t.void || hash(gx, 19, gz, seed) > 0.52
      ? null
      : {
          id,
          x,
          z,
          y: t.h + 1,
          ship: hash(gx, 20, gz, seed) > 0.42,
          rooms: [
            {
              dx: 0,
              dz: 0,
              base: 0,
              levels: 3 + Math.floor(hash(gx, 22, gz, seed) * 2),
            },
            {
              dx: 23,
              dz: 0,
              base: 10,
              levels: 2 + Math.floor(hash(gx, 23, gz, seed) * 2),
            },
            { dx: 0, dz: 23, base: 20, levels: 2 },
          ],
          seed,
        };
  w.endCityPlans.set(id, site);
  if (w.endCityPlans.size > 256) w.endCityPlans.clear();
  return site;
}
export function nearbyEndCities(w, x, z, r = 64) {
  const a = [];
  if (w.dimension !== "end") return a;
  for (
    let gz = Math.floor((z - r - 65) / 180);
    gz <= Math.ceil((z + r + 65) / 180);
    gz++
  )
    for (
      let gx = Math.floor((x - r - 65) / 180);
      gx <= Math.ceil((x + r + 65) / 180);
      gx++
    ) {
      const c = endCityAt(w, gx, gz);
      if (c && Math.hypot(c.x - x, c.z - z) < r + 65) a.push(c);
    }
  return a;
}
export function cityGuards(c) {
  return c.rooms.flatMap((r, i) =>
    [0, 1].map((j) => ({
      id: `${c.id}:guard:${i}:${j}`,
      x: c.x + r.dx + (j ? 3 : -3),
      y: c.y + r.base + 1,
      z: c.z + r.dz - 3,
    })),
  );
}
export function generateEndCities(w, c, put) {
  const ox = c.cx * 16,
    oz = c.cz * 16,
    set = (x, y, z, id) => put(x - ox, y, z - oz, id);
  const box = (x, y, z, sx, sy, sz, id) => {
    for (let a = Math.max(x, ox); a < Math.min(x + sx, ox + 16); a++)
      for (let b = Math.max(z, oz); b < Math.min(z + sz, oz + 16); b++)
        for (let h = y; h < y + sy; h++) set(a, h, b, id);
  };
  const chest = (x, y, z, ship = false) => {
    set(x, y, z, B.chest);
    if (Math.floor(x / 16) !== c.cx || Math.floor(z / 16) !== c.cz) return;
    const k = key(x, y, z);
    if (w.containers[k] || w.edits.has(k)) return;
    const loot = [
      makeStack("diamond", 2),
      makeStack("gold_ingot", 5),
      makeStack("ender_pearl", 4),
      makeStack("diamond_pickaxe"),
      makeStack("purpur_block", 24),
    ];
    if (ship) loot.push(makeStack("elytra"));
    w.containers[k] = {
      type: "chest",
      facing: 2,
      slots: [...loot, ...Array(27 - loot.length).fill(null)],
    };
  };
  for (const s of nearbyEndCities(w, ox + 8, oz + 8, 16)) {
    for (const r of s.rooms) {
      const x = s.x + r.dx,
        z = s.z + r.dz,
        y = s.y + r.base;
      // Solid foundations and a real interior staircase connect every floor.
      box(
        x - 4,
        Math.min(s.y - 5, y),
        z - 4,
        9,
        y - Math.min(s.y - 5, y) + 1,
        9,
        B.end_stone_bricks,
      );
      for (let level = 0; level < r.levels; level++) {
        const h = y + level * 10;
        box(x - 4, h, z - 4, 9, 10, 9, B.purpur_block);
        box(x - 3, h + 1, z - 3, 7, 8, 7, B.air);
        box(x - 4, h + 3, z - 4, 9, 2, 1, B.glass);
        box(x - 4, h + 3, z + 4, 9, 2, 1, B.glass);
        box(x - 3, h + 1, z - 4, 2, 3, 1, B.air);
        box(x - 3, h + 1, z + 4, 2, 3, 1, B.air);
        // Ten steps around the inside wall; overhead clearance is at least 2 blocks.
        const path = [
          [-2, 2],
          [-1, 2],
          [0, 2],
          [1, 2],
          [2, 2],
          [2, 1],
          [2, 0],
          [2, -1],
          [2, -2],
          [1, -2],
        ];
        path.forEach(([dx, dz], n) => {
          set(x + dx, h + n + 1, z + dz, B.purpur_block);
          for (let dy = 1; dy <= 3; dy++)
            set(x + dx, h + n + 1 + dy, z + dz, B.air);
        });
        for(const dx of[-3,3])set(x+dx,h+2,z-3,B.end_rod);
        if (level === r.levels - 1) chest(x - 2, h + 1, z - 2);
      }
      for (let tier = 0; tier < 3; tier++)
        box(
          x - 5 + tier,
          y + r.levels * 10 + tier,
          z - 5 + tier,
          11 - tier * 2,
          1,
          11 - tier * 2,
          B.purpur_block,
        );
    }
    // Enclosed bridges have open entrances in the tower walls, with stair access.
    for (const [axis, base] of [
      ["x", 10],
      ["z", 20],
    ])
      for (let d = 3; d <= 23; d++) {
        const x = s.x + (axis === "x" ? d : 0),
          z = s.z + (axis === "z" ? d : 0),
          y = s.y + base;
        box(x - 1, y, z - 1, 3, 1, 3, B.purpur_block);
        box(x - 1, y + 1, z - 1, 3, 3, 3, B.air);
        if (axis === "x") {
          set(x, y + 1, z - 1, B.purpur_block);
          set(x, y + 1, z + 1, B.purpur_block);
        } else {
          set(x - 1, y + 1, z, B.purpur_block);
          set(x + 1, y + 1, z, B.purpur_block);
        }
      }
    if (s.ship) {
      const x = s.x + 44,
        z = s.z,
        y = s.y + 23;
      box(x - 4, y, z - 9, 9, 2, 19, B.purpur_block);
      box(x - 3, y + 2, z - 8, 7, 4, 17, B.air);
      for (let d = -8; d <= 8; d++) {
        set(x - 4, y + 2, z + d, B.purpur_block);
        set(x + 4, y + 2, z + d, B.purpur_block);
      }
      box(x, y + 2, z, 1, 11, 1, B.purpur_block);
      box(x - 4, y + 8, z, 9, 1, 1, B.purpur_block);
      chest(x - 2, y + 2, z - 5, true);
      box(x - 3, y + 2, z + 4, 7, 3, 4, B.end_stone_bricks);
      box(x - 2, y + 2, z + 4, 5, 2, 3, B.air);
    }
  }
}
export function tickEndCities(g, api) {
  if (g.dimension !== "end") return;
  const w = g.world,
    s = w.endgame;
  s.cityDefeated = Array.isArray(s.cityDefeated) ? s.cityDefeated : [];
  if (
    !s.cityHealth ||
    typeof s.cityHealth !== "object" ||
    Array.isArray(s.cityHealth)
  )
    s.cityHealth = {};
  g.entities = g.entities.filter((e) => {
    if (
      e.type !== "shulker" ||
      e.hp <= 0 ||
      Math.hypot(e.x - g.player.x, e.z - g.player.z) <= 128
    )
      return true;
    s.cityHealth[e.id] = { hp: e.hp, age: e.age };
    return false;
  });
  for (const site of nearbyEndCities(w, g.player.x, g.player.z, 72))
    for (const q of cityGuards(site)) {
      if (
        s.cityDefeated.includes(q.id) ||
        g.entities.some((e) => e.id === q.id) ||
        !w.chunks.has(`${Math.floor(q.x / 16)},${Math.floor(q.z / 16)}`)
      )
        continue;
      const e = api.createEntity(g, "shulker", q.x, q.z, q.id);
      Object.assign(e, q, {
        x: q.x + 0.5,
        z: q.z + 0.5,
        persistent: true,
        ...(s.cityHealth[q.id] || {}),
        city: site.id,
      });
      g.entities.push(e);
    }
  for (const e of g.entities)
    if (e.type === "shulker" && e.hp > 0) {
      e.age = (e.age || 0) + 1;
      const p = g.player,
        d = Math.hypot(e.x - p.x, e.z - p.z);
      e.open =
        g.difficulty !== "peaceful" && g.mode !== "creative" && d < 28 ? 1 : 0;
      e.yaw = Math.atan2(e.x - p.x, e.z - p.z);
      if (e.open && e.age % 65 === 0 && (s.orbs || []).length < 32)
        s.orbs.push({
          kind: "shulker",
          id: "shell:" + e.id + ":" + e.age,
          x: e.x,
          y: e.y + 0.8,
          z: e.z,
          age: 0,
          vx: 0,
          vy: 0.1,
          vz: 0,
        });
    }

}
export function shulkerLoot(g, e, drop) {
  if (e.type !== "shulker" || e.cityLooted) return;
  e.cityLooted = true;
  const s = (g.world.endgame ||= {});
  s.cityDefeated = Array.isArray(s.cityDefeated) ? s.cityDefeated : [];
  if (s.cityHealth) delete s.cityHealth[e.id];
  if (!s.cityDefeated.includes(e.id)) s.cityDefeated.push(e.id);
  drop(g, makeStack("shulker_shell"), e.x, e.y + 0.5, e.z, 20);
}
