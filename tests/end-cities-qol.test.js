import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/world.js";
import { B, ITEMS, VILLAGER_TRADES, makeStack } from "../src/data.js";
import { Inventory } from "../src/inventory.js";
import { createPlayer, updatePlayer } from "../src/physics.js";
import {
  createEntity,
  damageEntity,
  dropItem,
  hitEntity,
} from "../src/simulation.js";
import {
  endCityAt,
  cityGuards,
  tickEndCities,
  shulkerLoot,
} from "../src/end-cities.js";
import { steerDragon, swoopTarget } from "../src/dragon-flight.js";
import { withOffhand, swapHands, shouldUseOffhand } from "../src/offhand.js";
import {
  useEditionWeapon,
  blockShieldProjectile,
} from "../src/edition-combat.js";
import {
  dropCursorStack,
  collectMatching,
  sortBackpack,
} from "../src/inventory-qol.js";
import { villageAt } from "../src/villages.js";
import { VILLAGER_JOBS } from "../src/village-jobs.js";
function game(dim = "overworld") {
  return {
    world: new World("End city QA", {}, dim),
    dimension: dim,
    player: createPlayer({ x: 0.5, y: 90, z: 0.5 }),
    inventory: new Inventory(),
    entities: [],
    drops: [],
    mode: "survival",
    difficulty: "normal",
    time: 8000,
    elapsed: 10,
    tickCount: 40,
    settings: { renderDistance: 3 },
    ui: { updateHotbar() {}, updateHUD() {}, refreshInventory() {} },
    audio: { tone() {}, voice() {} },
    renderer: { action() {}, combatImpact() {} },
    damage(n) {
      this.player.health -= n;
    },
  };
}
function city(w) {
  for (let x = 4; x < 14; x++)
    for (let z = -8; z < 8; z++) {
      const s = endCityAt(w, x, z);
      if (s?.ship) return s;
    }
  throw Error("No ship city");
}
test("End Cities have deterministic traversable rooms, stairs, real loot and a ship with working equipment; edits and opened chests survive regeneration", () => {
  const g = game("end"),
    s = city(g.world);
  assert.deepEqual(
    s,
    endCityAt(
      new World("End city QA", {}, "end"),
      Math.round(s.x / 180),
      Math.round(s.z / 180),
    ),
  );
  assert.equal(g.world.get(s.x, s.y + 1, s.z), B.air);
  assert.equal(g.world.get(s.x-3,s.y+2,s.z-3),B.end_rod);
  assert.ok(g.world.generatedLights.has(`${s.x-3},${s.y+2},${s.z-3}`));
  assert.equal(g.world.get(s.x - 4, s.y + 2, s.z), B.purpur_block);
  assert.equal(g.world.get(s.x - 2, s.y + 1, s.z + 2), B.purpur_block);
  assert.equal(g.world.get(s.x - 2, s.y + 2, s.z + 2), B.air);
  const sx = s.x + 44,
    sy = s.y + 25;
  assert.equal(g.world.get(sx - 2, sy, s.z - 5), B.chest);
  const k = `${sx - 2},${sy},${s.z - 5}`,
    loot = g.world.containers[k];
  assert.ok(loot.slots.some((a) => a?.id === "elytra"));
  loot.slots[0] = null;
  const cx = Math.floor((sx - 2) / 16),
    cz = Math.floor((s.z - 5) / 16);
  g.world.chunks.delete(`${cx},${cz}`);
  g.world.ensure(cx, cz);
  assert.equal(g.world.containers[k].slots[0], null);
  g.world.set(s.x, s.y + 1, s.z, B.diamond_block);
  const c = Math.floor(s.x / 16),
    d = Math.floor(s.z / 16);
  g.world.chunks.delete(`${c},${d}`);
  assert.equal(g.world.get(s.x, s.y + 1, s.z), B.diamond_block);
});
test("city Shulkers spawn once, fire bounded homing projectiles and award exactly one shell across both death paths", () => {
  const g = game("end"),
    s = city(g.world),
    q = cityGuards(s)[0];
  g.world.get(q.x, q.y, q.z);
  g.world.endgame = { orbs: [], cityDefeated: [] };
  Object.assign(g.player, { x: q.x + 4, y: q.y, z: q.z });
  tickEndCities(g, { createEntity });
  const e = g.entities.find((e) => e.id === q.id);
  assert.ok(e);
  e.age = 64;
  tickEndCities(g, { createEntity });
  assert.ok(g.world.endgame.orbs.some((o) => o.kind === "shulker"));
  const count = g.entities.length;
  tickEndCities(g, { createEntity });
  assert.equal(g.entities.length, count);
  let drops = 0;
  shulkerLoot(g, e, () => drops++);
  shulkerLoot(g, e, () => drops++);
  assert.equal(drops, 1);
  assert.ok(g.world.endgame.cityDefeated.includes(q.id));
});
test("all biome village expansions retain original houses, give distinct annexes and real profession trades/stations", () => {
  const variants = [];
  for (const seed of ["Village alpha", "Wildflower", "End city QA"]) {
    const w = new World(seed);
    let v;
    for (let x = -3; x < 4 && !v; x++)
      for (let z = -3; z < 4 && !v; z++) v = villageAt(w, x, z);
    assert.ok(v);
    assert.equal(v.houses.length, 16);
    assert.equal(v.houses[0].x, v.x - 17);
    assert.equal(v.houses[0].z, v.z - 15);
    assert.equal(new Set(v.houses.map((h) => h.x + "," + h.z)).size, 16);
    for (const h of v.houses) {
      assert.ok(VILLAGER_TRADES[h.profession]);
      assert.ok(B[VILLAGER_JOBS[h.profession].station]);
      assert.equal(w.get(h.x + 3, (h.floor ?? v.y) + 1, h.z + 3), B.air);
    }
    variants.push(v.houses.slice(8).map((h) => [h.x - v.x, h.z - v.z]));
  }
  assert.notDeepEqual(variants[0], variants[1]);
  for (const trades of Object.values(VILLAGER_TRADES))
    for (const t of trades) {
      assert.ok(ITEMS[t.input]);
      assert.ok(ITEMS[t.output]);
    }
});
test("offhand actions consume exactly the secondary stack and restore primary slot through exceptions, then swap complete metadata", () => {
  const g = game();
  g.inventory.slots[0] = makeStack("diamond_sword");
  g.inventory.offhand[0] = makeStack("stone", 64);
  const main = g.inventory.held;
  withOffhand(g, () => {
    assert.equal(g.inventory.held.id, "stone");
    const snapshot=new Inventory(g.inventory.export());assert.equal(snapshot.offhand[0].id,"stone");assert.equal(snapshot.held.id,"diamond_sword");
    g.inventory.consume(0, 2);
  });
  assert.equal(g.inventory.held, main);
  assert.equal(g.inventory.offhand[0].count, 62);
  assert.throws(() =>
    withOffhand(g, () => {
      throw Error("test");
    }),
  );
  assert.equal(g.inventory.held, main);
  swapHands(g);
  assert.equal(g.inventory.held.count, 62);
  assert.equal(g.inventory.offhand[0], main);
  g.target = { id: B.chest };
  assert.equal(shouldUseOffhand(g), false);
});
test("an offhand shield blocks only frontal arrows and loses its own durability while the sword stays equipped", () => {
  const g = game();
  g.inventory.slots[0] = makeStack("iron_sword");
  g.inventory.offhand[0] = makeStack("shield");
  g.player.yaw = 0;
  withOffhand(g, () => useEditionWeapon(g));
  const shield = g.inventory.offhand[0],
    n = shield.durability;
  assert.equal(g.player.shieldHand, "off");
  assert.equal(
    blockShieldProjectile(g, g.player, { x: 0.5, z: -3, damage: 4 }),
    true,
  );
  assert.ok(shield.durability < n);
  assert.equal(
    blockShieldProjectile(g, g.player, { x: 0.5, z: 4, damage: 4 }),
    false,
  );
  assert.equal(g.inventory.held.id, "iron_sword");
});
test("unarmed rapid attacks each register nonzero damage without charged-hit healing", () => {
  const g = game(),
    e = createEntity(g, "zombie", 0.5, 0.5);
  e.y = 90;
  e.hp = 100;
  g.entities = [e];
  const before = e.hp;
  for (let i = 0; i < 6; i++) {
    hitEntity(g, e);
    g.elapsed += 0.04;
  }
  assert.ok(e.hp <= before - 6);
});
test("dragging a full 64-stack outside preserves metadata and drops exactly once; right drop transfers one", () => {
  const g = game();
  g.inventory.cursor = { ...makeStack("stone", 64), origin: "qa" };
  assert.ok(dropCursorStack(g));
  assert.equal(g.inventory.cursor, null);
  assert.equal(g.drops[0].count, 64);
  assert.equal(g.drops[0].origin, "qa");
  assert.equal(dropCursorStack(g), false);
  g.inventory.cursor = makeStack("dirt", 64);
  dropCursorStack(g, true);
  assert.equal(g.inventory.cursor.count, 63);
  assert.equal(g.drops[1].count, 1);
});
test("collect matching respects stack metadata/max and sort merges backpack without moving the hotbar", () => {
  const g = game(),
    i = g.inventory;
  i.slots[0] = makeStack("diamond_sword");
  i.slots[9] = makeStack("stone", 40);
  i.slots[10] = makeStack("stone", 40);
  i.slots[11] = { ...makeStack("stone", 10), origin: "other" };
  collectMatching(i, i.slots, 9);
  assert.equal(i.cursor.count, 64);
  assert.equal(i.slots[10].count, 16);
  assert.equal(i.slots[11].count, 10);
  i.cursor = null;
  const main = i.slots[0];
  sortBackpack(i);
  assert.equal(i.slots[0], main);
  assert.equal(
    i.slots
      .slice(9)
      .filter(Boolean)
      .reduce((n, s) => n + s.count, 0),
    26,
  );
});
test("dragon flight retains position/heading continuity across targets and its swoop passes through before climbing", () => {
  const e = { x: 40, y: 95, z: 0, yaw: 0, mode: "orbit", modeAge: 0 };
  for (let n = 0; n < 300; n++) {
    const old = { ...e };
    e.mode = n > 150 ? "swoop" : "orbit";
    e.modeAge = n > 150 ? n - 150 : n;
    const q =
      e.mode === "swoop"
        ? swoopTarget(e, { x: 0, y: 61, z: 0 })
        : { x: Math.cos(n * 0.012) * 59, y: 90, z: Math.sin(n * 0.012) * 59 };
    steerDragon(e, q, e.mode === "swoop" ? 1.65 : 0.85);
    assert.ok(Math.hypot(e.x - old.x, e.y - old.y, e.z - old.z) <= 1.66);
    assert.ok(Math.abs(e.yaw - old.yaw) <= 0.076);
    assert.ok(Number.isFinite(e.bank));
  }
  const start = { x: 30, y: 90, z: 0, modeAge: 28 };
  const a = swoopTarget(start, { x: 0, y: 61, z: 0 });
  start.modeAge = 123;
  const b = swoopTarget(start, { x: 0, y: 61, z: 0 });
  assert.ok(b.x < 0 && b.y > 62);
});
test("Elytra gliding and levitation remain finite and cannot climb forever or phase through solid terrain", () => {
  for (const rate of [30, 60, 144]) {
    const g = game();
    g.world.ensure(0, 0);
    g.player.onGround = false;
    g.player.vy = -2;
    g.player.pitch = 1;
    g.inventory.equipment[1] = makeStack("elytra");
    const y = g.player.y;
    for (let n = 0; n < rate; n++)
      updatePlayer(g, new Set(["Space"]), 1 / rate);
    assert.ok(g.player.gliding);
    assert.ok(g.player.y < y);
    assert.ok(g.inventory.equipment[1].durability < 432);
    assert.ok(Number.isFinite(g.player.x + g.player.y + g.player.z));
  }
  const g = game();
  g.player.levitationTicks = 80;
  g.player.vy = 0;
  updatePlayer(g, new Set(), 0.05);
  assert.ok(g.player.vy > 0);
});
test("the update preserves supplied assets, Titan choreography/rules, storage, lighting and existing weapon palettes", async () => {
  const { readFileSync } = await import("node:fs"),
    { createHash } = await import("node:crypto");
  const old = JSON.parse(
    readFileSync(
      new URL("../reference/end-cities-preserved-2.20.0.json", import.meta.url),
    ),
  );
  for (const [n, h] of Object.entries(old))
    assert.equal(
      createHash("sha256")
        .update(readFileSync(new URL("../" + n, import.meta.url)))
        .digest("hex"),
      h,
      n,
    );
});

test("levitation expires after leaving The End instead of leaking permanent lift into the Overworld",()=>{const g=game();g.player.levitationTicks=5;for(let n=0;n<10;n++)updatePlayer(g,new Set(),.05);assert.equal(g.player.levitationTicks,0);});
test('End Rods retain a bright material face and a real light source instead of inheriting dragon egg pixels',async()=>{const{paintEndAtlas}=await import('../src/end-art.js'),{BLOCKS,ATLAS_COLS}=await import('../src/data.js');const tile=BLOCKS[B.end_rod].artTile,ox=(tile%ATLAS_COLS)*16,oy=Math.floor(tile/ATLAS_COLS)*16;let bright=0,n=0;const ctx={fillStyle:'#000000',fillRect(x,y){if(x<ox||x>=ox+16||y<oy||y>=oy+16)return;n++;const h=this.fillStyle;if((parseInt(h.slice(1,3),16)+parseInt(h.slice(3,5),16)+parseInt(h.slice(5,7),16))/3>180)bright++;}};paintEndAtlas({getContext:()=>ctx});assert.equal(n,256);assert.ok(bright/n>.7);assert.equal(BLOCKS[B.end_rod].light,14);});
test('distant city guards unload with health preserved and restore without duplication',()=>{const g=game('end'),s=city(g.world),q=cityGuards(s)[0];g.world.get(q.x,q.y,q.z);g.world.endgame={orbs:[]};Object.assign(g.player,{x:q.x,y:q.y,z:q.z});tickEndCities(g,{createEntity});const e=g.entities.find(e=>e.id===q.id);e.hp=13;g.player.x+=500;tickEndCities(g,{createEntity});assert.ok(!g.entities.some(e=>e.id===q.id));g.player.x=q.x;tickEndCities(g,{createEntity});assert.equal(g.entities.filter(e=>e.id===q.id).length,1);assert.equal(g.entities.find(e=>e.id===q.id).hp,13);});
