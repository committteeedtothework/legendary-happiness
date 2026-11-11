import { test, expect } from "@playwright/test";
import { createRelay } from "../../server/relay.mjs";
import { B } from "../../src/data.js";
let relay, origin;
test.beforeAll(async () => {
  relay = createRelay();
  const { port } = await relay.listen(0, "127.0.0.1");
  origin = `http://127.0.0.1:${port}`;
});
test.afterAll(async () => relay.close());
async function prep(browser) {
  const context = await browser.newContext(),
    page = await context.newPage(),
    errors = [];
  page.setDefaultTimeout(20000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({
        renderDistance: 2,
        graphics: 1,
        ambientSounds: false,
        musicEnabled: false,
        volume: 0,
      }),
    ),
  );
  await page.goto(origin);
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  return { context, page, errors };
}
async function hostWorld(page) {
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Survival with friends");
  await page.locator("[name=difficulty]").selectOption("peaceful");
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.active);
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.pause();
    g.entities = [];
    g.drops = [];
    for (let x = 0; x <= 16; x++)
      for (let z = 0; z <= 16; z++) {
        g.world.set(x, 199, z, B.stone);
        for (let y = 200; y < 205; y++) g.world.set(x, y, z, B.air);
      }
    g.spawn = { x: 8.5, y: 200, z: 10.5 };
    Object.assign(g.player, {
      x: 12.5,
      y: 200,
      z: 10.5,
      yaw: 0,
      pitch: 0,
      onGround: true,
      vx: 0,
      vy: 0,
      vz: 0,
      fallStart: 200,
    });
  }, B);
  await page.locator("[data-action=multiplayer]").click();
  await page.locator("#multiplayer-name").fill("Owner");
  await page.locator("#multiplayer-server").fill(origin);
  await page.locator("[data-role=host]").click();
  await expect(page.locator("#session-invite")).toBeVisible();
  return page.locator("#session-invite").inputValue();
}
async function join(page, invite, name = "Friend One") {
  await page.locator("[data-action=multiplayer]").click();
  await page.locator("#multiplayer-name").fill(name);
  await page.locator("#multiplayer-invite").fill(invite);
  await page.locator("[data-role=guest]").click();
  await page.waitForFunction(() => dcsmcraft.multiplayer.sessionReady);
}
async function chat(page, text) {
  await page.evaluate(() => {
    dcsmcraft.resume();
    dcsmcraft.pointerLockFallback = true;
  });
  await page.keyboard.press("KeyT");
  await expect(page.locator("#world-chat-input")).toBeVisible();
  await page.locator("#world-chat-input").fill(text);
  await page.locator("#world-chat-form button[type=submit]").click();
}
async function play(page, pitch = 0) {
  await page.mouse.move(640, 400);
  await page.evaluate((pitch) => {
    dcsmcraft.resume();
    dcsmcraft.pointerLockFallback = true;
    dcsmcraft.player.yaw = 0;
    dcsmcraft.player.pitch = pitch;
  }, pitch);
}
test("Survival players chat, mine, craft, place, use shared workstations, die, respawn and resume their own saved inventory", async ({
  browser,
}) => {
  test.setTimeout(240000);
  const h = await prep(browser),
    f = await prep(browser),
    host = h.page,
    guest = f.page;
  try {
    let invite = await hostWorld(host);
    await join(guest, invite);
    expect(
      await guest.evaluate(() => ({
        mode: dcsmcraft.mode,
        flying: dcsmcraft.player.flying,
        items: dcsmcraft.inventory.slots.filter(Boolean).length,
      })),
    ).toEqual({ mode: "survival", flying: false, items: 0 });
    await chat(guest, "<hello> from Survival");
    await expect(host.locator("#chat-log")).toContainText(
      "<hello> from Survival",
    );
    expect(await host.locator("#chat-log script").count()).toBe(0);
    await chat(guest, "/give @s diamond 64");
    await expect(guest.locator("#world-chat-log")).toContainText(
      "Only the person hosting",
    );
    expect(
      await guest.evaluate(
        () => dcsmcraft.inventory.slots.filter(Boolean).length,
      ),
    ).toBe(0);
    await chat(host, '/tp "Friend One" 8.5 200 8.5');
    await expect(host.locator("#world-chat-log")).toContainText(
      "Teleported Friend One",
    );
    await guest.waitForFunction(
      () =>
        Math.abs(dcsmcraft.player.x - 8.5) < 0.05 &&
        Math.abs(dcsmcraft.player.z - 8.5) < 0.05,
    );
    await host.evaluate((B) => dcsmcraft.world.set(8, 201, 5, B.log), B);
    await play(guest);
    await guest.waitForFunction(() => dcsmcraft.target?.id === 6);
    await guest.locator("#game-canvas").click({ force: true });
    await guest.mouse.down();
    await guest.waitForTimeout(250);
    expect(await host.evaluate(() => dcsmcraft.world.get(8, 201, 5))).toBe(
      B.log,
    );
    await host.waitForFunction(
      () => dcsmcraft.world.get(8, 201, 5) === 0,
      null,
      { timeout: 15000 },
    );
    await guest.mouse.up();
    await guest.keyboard.down("KeyW");
    await guest.waitForTimeout(550);
    await guest.keyboard.up("KeyW");
    await guest.waitForFunction(() =>
      dcsmcraft.inventory.slots.some((s) => s?.id === "log"),
    );
    await guest.keyboard.press("KeyE");
    await expect(guest.locator(".inventory-window")).toBeVisible();
    // The compact recipe book starts closed; open it through its real button.
    if (
      (await guest
        .locator('[data-action="toggle-recipes"]')
        .getAttribute("aria-expanded")) === "false"
    )
      await guest.locator('[data-action="toggle-recipes"]').click();
    await guest.locator('[data-action=recipe][data-recipe="0"]').click();
    await expect
      .poll(() => guest.evaluate(() => dcsmcraft.inventory.craft[0]?.id))
      .toBe("log");
    await guest.locator(".output-slot").click({ modifiers: ["Shift"] });
    await guest.waitForFunction(() =>
      dcsmcraft.inventory.slots.some(
        (s) => s?.id === "planks" && s.count === 4,
      ),
    );
    await guest.keyboard.press("KeyE");
    await play(guest, -0.7);
    await guest.evaluate(() => {
      const g = dcsmcraft;
      g.inventory.selected = g.inventory.slots.findIndex(
        (s) => s?.id === "planks",
      );
      g.player.pitch = -0.7;
    });
    await guest.waitForFunction(() => dcsmcraft.target?.y === 199);
    const t = await guest.evaluate(() => dcsmcraft.target);
    await guest.locator("#game-canvas").click({ button: "right", force: true });
    const placed = {
      x: t.x + t.normal.x,
      y: t.y + t.normal.y,
      z: t.z + t.normal.z,
    };
    await host.waitForFunction(
      (p) => dcsmcraft.world.get(p.x, p.y, p.z) === 8,
      placed,
    );
    await guest.waitForFunction(() =>
      dcsmcraft.inventory.slots.some(
        (s) => s?.id === "planks" && s.count === 3,
      ),
    );
    // A forged held item cannot grant or place diamonds; the host chooses the actual slot.
    await guest.evaluate(() =>
      dcsmcraft.multiplayer.send({
        type: "command",
        seq: ++dcsmcraft.multiplayer.sequence,
        kind: "use",
        held: "diamond_block",
        selected: 35,
      }),
    );
    await guest.waitForTimeout(300);
    expect(
      await host.evaluate(
        (id) =>
          [...dcsmcraft.world.edits.values()].filter((value) => value === id)
            .length,
        B.diamond_block,
      ),
    ).toBe(0);
    await chat(host, '/tp "Friend One" 8.5 200 7.5');
    await guest.waitForFunction(
      () => Math.abs(dcsmcraft.player.z - 7.5) < 0.05,
    );
    await host.evaluate((B) => {
      const g = dcsmcraft;
      g.world.set(8, 200, 4, B.chest);
      g.world.containers["8,200,4"] = {
        type: "chest",
        slots: Array(27).fill(null),
      };
      g.world.containers["8,200,4"].slots[0] = { id: "log", count: 3 };
    }, B);
    await play(guest, -0.35);
    await guest.waitForFunction(() => dcsmcraft.target?.id === 16);
    await guest.locator("#game-canvas").click({ button: "right", force: true });
    await expect(guest.locator(".inventory-title h2")).toHaveText("Chest");
    await guest
      .locator('[data-ref=container][data-index="0"]')
      .click({ modifiers: ["Shift"] });
    await guest.waitForFunction(() =>
      dcsmcraft.inventory.slots.some((s) => s?.id === "log" && s.count === 3),
    );
    await guest
      .locator('[data-ref=container][data-index="0"]')
      .click({ modifiers: ["Shift"] });
    await guest.keyboard.press("KeyE");
    await host.evaluate((B) => {
      const g = dcsmcraft;
      g.world.set(8, 200, 4, B.furnace);
      g.world.containers["8,200,4"] = {
        type: "furnace",
        slots: [{ id: "raw_iron", count: 1 }, null, null],
        burn: 100,
        progress: 190,
        xp: 0,
      };
    }, B);
    await play(guest, -0.35);
    await guest.waitForFunction(() => dcsmcraft.target?.id === 15);
    await guest.locator("#game-canvas").click({ button: "right", force: true });
    await expect(guest.locator(".inventory-title h2")).toHaveText("Furnace");
    await expect(
      guest.locator('[data-ref=container][data-index="2"]'),
    ).toHaveAttribute("aria-label", "1 Iron ingot");
    await guest
      .locator('[data-ref=container][data-index="2"]')
      .click({ modifiers: ["Shift"] });
    await guest.waitForFunction(() =>
      dcsmcraft.inventory.slots.some(
        (s) => s?.id === "iron_ingot" && s.count === 1,
      ),
    );
    await guest.keyboard.press("KeyE");
    // A real hostile attacks the guest on the host simulation, with a low-health fixture to reach death quickly.
    await host.evaluate(() => {
      const g = dcsmcraft,
        p = [...g.multiplayer.peers.values()][0].player;
      p.health = 2;
      p.hurt = 0;
      g.difficulty = "normal";
      g.time = 14000;
      g.entities = [
        {
          id: "guest-zombie",
          type: "zombie",
          x: p.x,
          y: p.y,
          z: p.z - 0.9,
          vx: 0,
          vy: 0,
          vz: 0,
          onGround: true,
          hp: 100,
          yaw: 0,
          age: 0,
          attack: 0,
          hurt: 0,
          turn: 9999,
          dir: 0,
          speed: 0,
        },
      ];
    });
    await expect(guest.locator("[data-action=respawn]")).toBeVisible();
    const deathCount = await host.evaluate(() =>
      dcsmcraft.drops.reduce((n, d) => n + d.count, 0),
    );
    expect(deathCount).toBeGreaterThan(0);
    await host.evaluate(() => {
      dcsmcraft.entities = [];
      dcsmcraft.difficulty = "peaceful";
    });
    await guest.locator("[data-action=respawn]").click();
    await guest.waitForFunction(
      () => dcsmcraft.player.health === 20 && dcsmcraft.ui.screen === "play",
    );
    expect(
      await guest.evaluate(
        () => dcsmcraft.inventory.slots.filter(Boolean).length,
      ),
    ).toBe(0);
    expect(
      await host.evaluate(() =>
        dcsmcraft.drops.reduce((n, d) => n + d.count, 0),
      ),
    ).toBe(deathCount);
    await chat(host, '/give "Friend One" diamond 2');
    await guest.waitForFunction(() =>
      dcsmcraft.inventory.slots.some(
        (s) => s?.id === "diamond" && s.count === 2,
      ),
    );
    await host.evaluate(() => {
      const g = dcsmcraft,
        p = [...g.multiplayer.peers.values()][0].player;
      g.difficulty = "normal";
      g.time = 1000;
      p.health = 9;
      p.food = 10;
    });
    await guest.waitForFunction(() => dcsmcraft.player.health === 9);
    const token = await guest.evaluate(() =>
      localStorage.getItem("dcsmcraft-resume:" + dcsmcraft.multiplayer.server),
    );
    await guest.evaluate(() => dcsmcraft.quit());
    await guest.waitForFunction(() => !dcsmcraft.active);
    await host.waitForFunction(() => dcsmcraft.multiplayer.peers.size === 0);
    const id = await host.evaluate(async () => {
      await dcsmcraft.save();
      return dcsmcraft.id;
    });
    await host.evaluate(() => dcsmcraft.quit());
    await host.waitForFunction(() => !dcsmcraft.active);
    await host.evaluate(async (id) => dcsmcraft.loadWorld(id), id);
    await host.waitForFunction(() => dcsmcraft.active);
    await host.evaluate(() => dcsmcraft.pause());
    await host.locator("[data-action=multiplayer]").click();
    await host.locator("#multiplayer-name").fill("Owner");
    await host.locator("#multiplayer-server").fill(origin);
    await host.locator("[data-role=host]").click();
    invite = await host.locator("#session-invite").inputValue();
    await join(guest, invite, "Friend Renamed");
    await guest.waitForFunction(
      () =>
        dcsmcraft.player.health === 9 &&
        dcsmcraft.inventory.slots[0]?.id === "diamond",
    );
    expect(await guest.evaluate(() => dcsmcraft.inventory.slots[0].count)).toBe(
      2,
    );
    expect(
      await guest.evaluate(() =>
        localStorage.getItem(
          "dcsmcraft-resume:" + dcsmcraft.multiplayer.server,
        ),
      ),
    ).toBe(token);
    await guest.evaluate(() => dcsmcraft.chat.open());
    await guest.screenshot({
      path: "/workspace/artifacts/DCSMCRAFT-v1.4.0-survival-chat.png",
    });
    expect([...h.errors, ...f.errors]).toEqual([]);
  } catch (error) {
    for (const [name, page] of [
      ["host", host],
      ["guest", guest],
    ])
      console.log(
        name,
        JSON.stringify(
          await page.evaluate(() => ({
            screen: dcsmcraft.ui.screen,
            connected: dcsmcraft.multiplayer.connected,
            reason: dcsmcraft.multiplayer.endReason,
            pending: dcsmcraft.multiplayer.pending.size,
            pos: {
              x: dcsmcraft.player.x,
              y: dcsmcraft.player.y,
              z: dcsmcraft.player.z,
            },
            target: dcsmcraft.target,
            authoritative: [...dcsmcraft.multiplayer.peers.values()].map(
              (p) => ({
                pos: { x: p.player.x, y: p.player.y, z: p.player.z },
                target: p.context.target,
                slots: p.inventory.slots.slice(0, 3),
              }),
            ),
            toasts: document.querySelector("#toast")?.textContent,
            menu: [...dcsmcraft.multiplayer.peers.values()].map((p) => ({
              menu: p.menu?.type,
              feedback: p.feedback,
              lastAction: p.lastAction,
            })),
            elapsed: dcsmcraft.elapsed,
            lastCommand: dcsmcraft.multiplayer.lastCommand,
          })),
        ),
      );
    console.log("browser errors", h.errors, f.errors);
    throw error;
  } finally {
    await h.context.close();
    await f.context.close();
  }
});
test("two Survival guests race a shared chest without duplication; owner commands synchronize and guest commands cannot kick", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const h = await prep(browser),
    a = await prep(browser),
    b = await prep(browser);
  try {
    const invite = await hostWorld(h.page);
    await join(a.page, invite, "Alice");
    await join(b.page, invite, "Bob");
    await chat(h.page, "/tp Alice 8.5 200 7.5");
    await chat(h.page, "/tp Bob 8.5 200 7.5");
    await h.page.evaluate((B) => {
      dcsmcraft.world.set(8, 200, 4, B.chest);
      dcsmcraft.world.containers["8,200,4"] = {
        type: "chest",
        slots: Array(27).fill(null),
      };
      dcsmcraft.world.containers["8,200,4"].slots[0] = {
        id: "diamond",
        count: 4,
      };
    }, B);
    for (const p of [a.page, b.page]) {
      await p.waitForFunction(() => Math.abs(dcsmcraft.player.z - 7.5) < 0.05);
      await play(p, -0.35);
      await p.waitForFunction(() => dcsmcraft.target?.id === 16);
      await p.locator("#game-canvas").click({ button: "right", force: true });
      await expect(p.locator(".inventory-title h2")).toHaveText("Chest");
    }
    await Promise.all(
      [a.page, b.page].map((p) =>
        p
          .locator('[data-ref=container][data-index="0"]')
          .click({ modifiers: ["Shift"] }),
      ),
    );
    await expect
      .poll(() =>
        h.page.evaluate(() =>
          [...dcsmcraft.multiplayer.peers.values()].reduce(
            (n, p) =>
              n +
              p.inventory.slots.reduce(
                (sum, s) => sum + (s?.id === "diamond" ? s.count : 0),
                0,
              ),
            0,
          ),
        ),
      )
      .toBe(4);
    expect(
      await h.page.evaluate(
        () => dcsmcraft.world.containers["8,200,4"].slots[0],
      ),
    ).toBeNull();
    await chat(h.page, "/time set night");
    await a.page.waitForFunction(
      () => dcsmcraft.time % 24000 >= 14000 && dcsmcraft.time % 24000 < 14500,
    );
    await chat(h.page, "/weather rain");
    await b.page.waitForFunction(() => dcsmcraft.world.weather.kind === "rain");
    await chat(a.page, "/kick Bob");
    await expect(a.page.locator("#world-chat-log")).toContainText(
      "Only the person hosting",
    );
    expect(await b.page.evaluate(() => dcsmcraft.multiplayer.connected)).toBe(
      true,
    );
    await chat(h.page, "/kick Bob");
    await b.page.waitForFunction(() => !dcsmcraft.multiplayer.connected);
    expect(await a.page.evaluate(() => dcsmcraft.multiplayer.connected)).toBe(
      true,
    );
    expect([...h.errors, ...a.errors, ...b.errors]).toEqual([]);
  } finally {
    for (const c of [h.context, a.context, b.context]) await c.close();
  }
});
