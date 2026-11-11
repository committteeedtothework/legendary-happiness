import { test, expect } from "@playwright/test";
async function boot(page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem("dcsmcraft-settings"))
      localStorage.setItem(
        "dcsmcraft-settings",
        JSON.stringify({
          graphics: 1,
          renderDistance: 3,
          volume: 0,
          musicEnabled: false,
          ambientSounds: false,
          frameLimit: 30,
        }),
      );
  });
  await page.goto("/");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
}
async function create(page, mode = "survival") {
  await boot(page);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=name]").fill("Test wilderness");
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator(`[name=mode][value=${mode}]`).check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(
    () => dcsmcraft.active && dcsmcraft.ui.screen === "play",
  );
}
async function freeze(page) {
  await page.evaluate(() => {
    dcsmcraft.running = false;
    dcsmcraft.ui.screen = "test";
    document.exitPointerLock();
  });
}
async function recipe(page, id) {
  const book = page.getByRole("button", { name: "Toggle recipe book" });
  if ((await book.getAttribute("aria-expanded")) === "false")
    await book.click();
  const name = await page.evaluate(async (id) => {
    const { RECIPES, ITEMS } = await import("/src/data.js");
    return ITEMS[RECIPES[id].result].name;
  }, id);
  if ((await page.locator("#recipe-search").inputValue()) !== name)
    await page.locator("#recipe-search").fill(name);

  await page.locator(`[data-action=recipe][data-recipe="${id}"]`).click();
  await page.locator(".output-slot").click({ modifiers: ["Shift"] });
}

test("title, world creation, settings, controls and responsive layout", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await boot(page);
  await expect(
    page.getByRole("heading", { name: "DCSMCRAFT", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Options", exact: true }),
  ).toBeVisible();
  await page.locator("[data-setting=FOV]").fill("90");
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  expect(await page.evaluate(() => dcsmcraft.settings.FOV)).toBe(90);
  await page.getByRole("button", { name: "How to play", exact: true }).click();
  await expect(page.getByText("Your first day", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Create a world", exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.querySelector(".title-layout").scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("gather natural logs, craft planks, sticks, table and a wooden pickaxe through UI", async ({
  page,
}) => {
  test.setTimeout(180000);
  await create(page);
  await freeze(page);
  const gathered = await page.evaluate(async () => {
    const { B, BLOCKS, RECIPES, makeStack } = await import("/src/data.js"),
      { tickSurvival } = await import("/src/simulation.js");
    const g = dcsmcraft;
    let count = 0,
      wood = null;
    for (let z = -16; z < 32 && count < 4; z++)
      for (let x = -16; x < 32 && count < 4; x++) {
        const y = g.world.terrain(x, z).h + 1;
        const block = g.world.get(x, y, z),
          key = BLOCKS[block].key;
        if (
          (key === "log" || key.endsWith("_log")) &&
          (!wood || wood === key)
        ) {
          wood = key;
          g.player.x = x + 0.5;
          g.player.y = y;
          g.player.z = z + 0.5;
          g.breakBlock({ x, y, z, id: block });
          tickSurvival(g);
          count++;
        }
      }
    g.player = { ...g.player, ...g.spawn, health: 20, hurt: 0 };
    window.naturalWood = wood;
    g.openInventory("personal");
    return g.inventory.slots
      .filter((s) => s?.id === wood)
      .reduce((n, s) => n + s.count, 0);
  });
  expect(gathered).toBe(4);
  const recipeIds = await page.evaluate(async () => {
    const { RECIPES } = await import("/src/data.js"),
      { ingredientMatches } = await import("/src/recipe-ingredients.js");
    return {
      planks: RECIPES.findIndex(
        (r) =>
          !r.station &&
          r.ingredients?.length === 1 &&
          ingredientMatches(r.ingredients[0], naturalWood) &&
          (r.result === "planks" || r.result.endsWith("_planks")),
      ),
      sticks: RECIPES.findIndex(
        (r) => r.edition && r.result === "stick" && r.count === 4,
      ),
      table: RECIPES.findIndex(
        (r) => r.edition && r.result === "crafting_table",
      ),
      pick: RECIPES.findIndex(
        (r) => r.edition && r.result === "wooden_pickaxe",
      ),
    };
  });
  for (let i = 0; i < 4; i++) await recipe(page, recipeIds.planks);
  await recipe(page, recipeIds.sticks);
  await recipe(page, recipeIds.table);
  expect(
    await page.evaluate(() =>
      dcsmcraft.inventory.slots.some((s) => s?.id === "crafting_table"),
    ),
  ).toBe(true);
  await page.evaluate(() => {
    dcsmcraft.closeCraft();
    dcsmcraft.openInventory("table");
  });
  await page.locator("#recipe-search").fill("wooden pickaxe");
  await page
    .locator(`[data-action=recipe][data-recipe="${recipeIds.pick}"]`)
    .click();
  await page.locator(".output-slot").click({ modifiers: ["Shift"] });
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.inventory.slots.find((s) => s?.id === "wooden_pickaxe")
          ?.durability,
    ),
  ).toBe(59);
  await page.screenshot({ path: "/tmp/dcsmcraft-inventory.png" });
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() => dcsmcraft.ui.screen === "play");
});

test("progressive mining, correct drops, ore tiers, furnace smelting and building", async ({
  page,
}) => {
  await create(page);
  await freeze(page);
  const result = await page.evaluate(async () => {
    const { B, ITEMS, makeStack } = await import("/src/data.js"),
      { tickSurvival, interactContainer } = await import("/src/simulation.js");
    const g = dcsmcraft;
    g.inventory.slots[0] = makeStack("wooden_pickaxe");
    g.player.onGround = true;
    let target;
    for (let z = 0; z < 16 && !target; z++)
      for (let x = 0; x < 16 && !target; x++) {
        const y = g.world.terrain(x, z).h - 5;
        if (g.world.get(x, y, z) === B.stone) target = { x, y, z, id: B.stone };
      }
    g.target = target;
    g.mouseDown = true;
    g.lastBreak = -10;
    g.mine(1);
    const before = g.world.get(target.x, target.y, target.z);
    g.mine(0.2);
    const after = g.world.get(target.x, target.y, target.z);
    g.player.x = target.x + 0.5;
    g.player.y = target.y;
    g.player.z = target.z + 0.5;
    tickSurvival(g);
    const cobble = g.inventory.slots.find((s) => s?.id === "cobble")?.count;
    g.inventory.slots[0] = makeStack("stone_pickaxe");
    let ore;
    // Generator 12 deliberately spreads veins through the full underground.
    // Wildflower has no iron in the historical y=40..54 fixture window.
    for (let y = -64; y < 128 && !ore; y++)
      for (let z = 0; z < 16 && !ore; z++)
        for (let x = 0; x < 16 && !ore; x++)
          if (g.world.get(x, y, z) === B.iron_ore)
            ore = { x, y, z, id: B.iron_ore };
    if (!ore) throw new Error("No natural iron found in the test chunk");
    g.breakBlock(ore);
    g.player.x = ore.x + 0.5;
    g.player.y = ore.y;
    g.player.z = ore.z + 0.5;
    tickSurvival(g);
    const raw = g.inventory.slots.find((s) => s?.id === "raw_iron");
    if (!raw) throw new Error("Iron ore did not produce raw iron");
    const rawSlot = g.inventory.slots.indexOf(raw);
    g.inventory.slots[rawSlot] = null;
    g.world.set(8, 100, 8, B.furnace);
    const f = interactContainer(g.world, { x: 8, y: 100, z: 8, id: B.furnace });
    f.slots = [raw, makeStack("planks"), null];
    g.player = { ...g.player, ...g.spawn, health: 20, hurt: 0 };
    for (let i = 0; i < 200; i++) tickSurvival(g);
    g.inventory.slots[8] = makeStack("planks", 2);
    g.inventory.selected = 8;
    g.player.x = 8.5;
    g.player.y = 101;
    g.player.z = 8.5;
    g.target = {
      x: 8,
      y: 100,
      z: 8,
      id: B.furnace,
      normal: { x: 0, y: 1, z: 0 },
    };
    g.player.crouching = true;
    g.lastPlace = -10;
    g.use();
    const blocked = g.world.get(8, 101, 8) === B.air;
    g.target = {
      x: 9,
      y: 100,
      z: 8,
      id: B.stone,
      normal: { x: 0, y: 1, z: 0 },
    };
    g.lastPlace = -10;
    g.use();
    return {
      before,
      after,
      cobble,
      iron: f.slots[2],
      fuel: f.slots[1],
      blocked,
      placed: g.world.get(9, 101, 8),
      remaining: g.inventory.slots[8]?.count,
      expected: { stone: B.stone, air: B.air, planks: B.planks },
    };
  });
  expect(result.before).toBe(result.expected.stone);
  expect(result.after).toBe(result.expected.air);
  expect(result.cobble).toBe(1);
  expect(result.iron.id).toBe("iron_ingot");
  expect(result.fuel).toBeNull();
  expect(result.blocked).toBe(true);
  expect(result.placed).toBe(result.expected.planks);
  expect(result.remaining).toBe(1);
});

test("furnace continues while inventory is open and pause freezes the simulation", async ({
  page,
}) => {
  await create(page);
  await page.evaluate(async () => {
    const { makeStack } = await import("/src/data.js");
    dcsmcraft.world.containers["8,80,8"] = {
      type: "furnace",
      slots: [makeStack("raw_iron"), makeStack("coal"), null],
      progress: 0,
      burn: 0,
    };
    dcsmcraft.openInventory("furnace", dcsmcraft.world.containers["8,80,8"]);
  });
  await page.waitForTimeout(1600);
  const progress = await page.evaluate(
    () => dcsmcraft.world.containers["8,80,8"].progress,
  );
  expect(progress).toBeGreaterThan(0);
  await page.evaluate(() => dcsmcraft.pause());
  const time = await page.evaluate(() => dcsmcraft.time);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => dcsmcraft.time)).toBe(time);
});

test("shelter survives a simulated night; death drops cursor and craft items exactly once; respawn", async ({
  page,
}) => {
  await create(page);
  await freeze(page);
  const night = await page.evaluate(async () => {
    const { B, makeStack } = await import("/src/data.js"),
      { tickSurvival, createEntity } = await import("/src/simulation.js");
    const g = dcsmcraft;
    const x = 8,
      z = 8,
      y = 140;
    // A deterministic test fixture: complete shelter geometry, then exercise the real night simulation.
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++)
        for (let dy = -1; dy <= 3; dy++)
          g.world.set(
            x + dx,
            y + dy,
            z + dz,
            dy === -1 || dy === 3 || Math.abs(dx) === 2 || Math.abs(dz) === 2
              ? B.planks
              : B.air,
          );
    Object.assign(g.player, {
      x: x + 0.5,
      y,
      z: z + 0.5,
      health: 20,
      hurt: 0,
      onGround: true,
    });
    g.entities = [{ ...createEntity(g, "shade", x + 4, z), y, hp: 20 }];
    g.time = 13001;
    for (let i = 0; i < 11000; i++) {
      tickSurvival(g);
      g.player.hurt = 0;
    }
    const health = g.player.health,
      time = g.time,
      wall = g.world.get(x + 2, y, z);
    g.entities = [];
    g.inventory.slots.fill(null);
    g.inventory.slots[0] = makeStack("log", 3);
    g.inventory.craft[0] = makeStack("coal", 2);
    g.inventory.cursor = makeStack("diamond");
    g.player.health = 1;
    g.player.hurt = 0;
    g.damage(2, "the test night");
    return {
      health,
      time,
      wall,
      planks: B.planks,
      drops: g.drops.map((d) => ({ id: d.id, count: d.count })),
      remaining: g.inventory.slots.filter(Boolean).length,
      craft: g.inventory.craft.filter(Boolean).length,
      cursor: g.inventory.cursor,
      screen: g.ui.screen,
    };
  });
  expect(night.health).toBe(20);
  expect(night.time).toBeGreaterThanOrEqual(24000);
  expect(night.wall).toBe(night.planks);
  expect(night.screen).toBe("death");
  expect(night.remaining).toBe(0);
  expect(night.craft).toBe(0);
  expect(night.cursor).toBeNull();
  expect(
    night.drops
      .filter((s) => s.id === "diamond")
      .reduce((a, s) => a + s.count, 0),
  ).toBe(1);
  expect(night.drops.find((s) => s.id === "log").count).toBe(3);
  expect(night.drops.find((s) => s.id === "coal").count).toBe(2);
  await page.locator("[data-action=respawn]").click();
  expect(await page.evaluate(() => dcsmcraft.player.health)).toBe(20);
});

test("atomic saves persist edits, containers, entities, inventory and player across reload", async ({
  page,
}) => {
  await create(page);
  await freeze(page);
  const id = await page.evaluate(async () => {
    const { B, makeStack } = await import("/src/data.js");
    const g = dcsmcraft;
    g.world.set(-1, 180, 16, B.chest);
    g.world.containers["-1,180,16"] = {
      type: "chest",
      slots: [makeStack("diamond", 5), ...Array(26).fill(null)],
    };
    g.inventory.slots[0] = makeStack("iron_pickaxe");
    g.inventory.slots[0].durability = 127;
    g.player.health = 13;
    g.player.food = 11;
    g.player.xp = 42;
    g.inventory.cursor = makeStack("coal", 3);
    await g.save();
    return g.id;
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.evaluate((id) => dcsmcraft.loadWorld(id), id);
  await freeze(page);
  const saved = await page.evaluate(async () => {
    const { B } = await import("/src/data.js");
    const g = dcsmcraft;
    return {
      block: g.world.get(-1, 180, 16),
      chest: B.chest,
      diamonds: g.world.containers["-1,180,16"].slots[0].count,
      tool: g.inventory.slots[0].durability,
      health: g.player.health,
      food: g.player.food,
      xp: g.player.xp,
      cursor: g.inventory.cursor,
      entities: g.entities.length,
    };
  });
  expect(saved.block).toBe(saved.chest);
  expect(saved.diamonds).toBe(5);
  expect(saved.tool).toBe(127);
  expect(saved.health).toBe(13);
  expect(saved.food).toBe(11);
  expect(saved.xp).toBe(42);
  expect(saved.cursor.count).toBe(3);
  expect(saved.entities).toBeGreaterThan(0);
});

test("corrupted current generation recovers last valid save and preserves it on subsequent save", async ({
  page,
}) => {
  await create(page);
  await freeze(page);
  const recovery = await page.evaluate(async () => {
    const g = dcsmcraft;
    g.player.xp = 7;
    await g.save();
    g.player.xp = 99;
    await g.save();
    const db = await g.store.open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("worlds", "readwrite"),
        s = tx.objectStore("worlds"),
        r = s.get(g.id);
      r.onsuccess = () => {
        const v = r.result;
        v.current.payload += "broken";
        s.put(v);
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    const recovered = await g.store.load(g.id);
    await g.store.save(recovered.data);
    const next = await g.store.load(g.id);
    return {
      recovered: recovered.recovered,
      xp: recovered.data.player.xp,
      nextXP: next.data.player.xp,
    };
  });
  expect(recovery).toEqual({ recovered: true, xp: 7, nextXP: 7 });
});

test("Creative catalog, unlimited placement, flight and water behavior", async ({
  page,
}) => {
  await create(page, "creative");
  await page.keyboard.press("KeyE");
  await expect(page.locator(".creative-catalog")).toBeVisible();
  await page.locator("#creative-search").fill("glass");
  const glassCount = await page.evaluate(async () => {
    const { CREATIVE_ITEMS, ITEMS } = await import("/src/data.js");
    return CREATIVE_ITEMS.filter((id) =>
      ITEMS[id].name.toLowerCase().includes("glass"),
    ).length;
  });
  await expect(page.locator(".creative-slot:visible")).toHaveCount(glassCount);
  await expect(
    page.locator('.creative-slot[data-name="emberglass"]'),
  ).toBeVisible();
  await page.locator('.creative-slot[data-name="glass"]').click();
  expect(await page.evaluate(() => dcsmcraft.inventory.cursor)).toMatchObject({
    id: "glass",
    count: 64,
  });
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => dcsmcraft.ui.screen === "play");
  // Deliver a real double tap in one browser task; two automation RPCs can
  // exceed the seven-tick window on a busy software renderer.
  await page.evaluate(() => {
    for (let i = 0; i < 2; i++) {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { code: "Space", bubbles: true }),
      );
      window.dispatchEvent(
        new KeyboardEvent("keyup", { code: "Space", bubbles: true }),
      );
    }
  });
  expect(await page.evaluate(() => dcsmcraft.player.flying)).toBe(true);
  await freeze(page);
  const result = await page.evaluate(async () => {
    const { B, makeStack } = await import("/src/data.js"),
      { updatePlayer } = await import("/src/physics.js");
    const g = dcsmcraft;
    Object.assign(g.player, { x: 8.5, y: 150, z: 8.5, flying: false });
    g.inventory.selected = 0;
    g.inventory.slots[0] = makeStack("glass", 64);
    g.target = {
      x: 10,
      y: 149,
      z: 8,
      id: B.stone,
      normal: { x: 0, y: 1, z: 0 },
    };
    g.lastPlace = -10;
    g.use();
    g.world.set(8, 150, 8, B.water);
    g.world.set(8, 151, 8, B.water);
    updatePlayer(g, new Set(["Space"]), 1 / 60);
    return {
      placed: g.world.get(10, 150, 8),
      glass: B.glass,
      count: g.inventory.held.count,
      inWater: g.player.inWater,
      underwater: g.player.underwater,
      vy: g.player.vy,
    };
  });
  expect(result.placed).toBe(result.glass);
  expect(result.count).toBe(64);
  expect(result.inWater).toBe(true);
  expect(result.underwater).toBe(true);
  expect(result.vy).toBe(3);
});

test("export and import restore a separate world without overwriting the original", async ({
  page,
}) => {
  await create(page);
  await page.evaluate(async () => {
    dcsmcraft.player.xp = 123;
    await dcsmcraft.quit();
  });
  await page.getByRole("button", { name: "Your saved worlds" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByTitle("Export world backup").click();
  const download = await downloadPromise,
    path = await download.path();
  await page.locator("#import-world").setInputFiles(path);
  await expect(page.locator(".world-row")).toHaveCount(2);
  const worlds = await page.evaluate(() => dcsmcraft.store.list());
  expect(new Set(worlds.map((w) => w.id)).size).toBe(2);
  const xp = await page.evaluate(
    async (id) => (await dcsmcraft.store.load(id)).data.player.xp,
    worlds[0].id,
  );
  expect(xp).toBe(123);
  await page.locator("#import-world").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"format":99}'),
  });
  await expect(page.locator("#toast")).toContainText("Import failed");
  await expect(page.locator(".world-row")).toHaveCount(2);
});
