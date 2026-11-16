import { test, expect } from "@playwright/test";
import { SocialHub } from "../../server/social-hub.mjs";
import { createRelay } from "../../server/relay.mjs";
import { B } from "../../src/data.js";
import { mkdirSync, writeFileSync } from "node:fs";
const out = process.env.DCSMCRAFT_TEST_ARTIFACTS || "test-results/social";
mkdirSync(out, { recursive: true });
let relay, url;
test.beforeAll(async () => {
  relay = createRelay({ social: new SocialHub() });
  const { port } = await relay.listen(0, "127.0.0.1");
  url = `http://127.0.0.1:${port}`;
});
test.afterAll(() => relay.close());
async function player(browser, name) {
  const context = await browser.newContext(),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((url) => {
    window.DCSMCRAFT_SOCIAL_URL = url;
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({
        graphics: 0,
        renderDistance: 2,
        shadows: false,
        entityShadows: false,
        frameLimit: 15,
        volume: 0,
        musicEnabled: false,
        ambientSounds: false,
      }),
    );
  }, url);
  await page.goto("/");
  await page.waitForFunction(
    () => window.dcsmcraft?.initialized && dcsmcraft.friends.url,
  );
  await page.locator("[data-action=friends]").first().click();
  await page.locator("[data-social-form=signin] [name=username]").fill(name);
  await page.locator("[data-social-form=signin] button").click();
  await page.waitForFunction(() => dcsmcraft.friends.status === "online");
  return { context, page, errors };
}
test("accounts, friend requests and in-game invitations open a real shared world without Cloudflare; guests travel independently", async ({
  browser,
}) => {
  const a = await player(browser, "alice_social"),
    b = await player(browser, "bob_social");
  try {
    await b.page.locator("[data-social-form=add] input").fill("alice_social");
    await b.page.locator("[data-social-form=add] button").click();
    await a.page.locator("[data-social=accept]").click();
    await expect(
      a.page.locator(".friend-row").filter({ hasText: "bob_social" }),
    ).toHaveCount(1);
    await a.page.locator("[data-action=back]").click();
    await a.page.locator("[data-action=create]").click();
    await a.page.getByLabel("Allow Cheats", { exact: true }).check();
    await a.page.locator("[name=difficulty]").selectOption("peaceful");
    await a.page.locator("[data-action=start-world]").click();
    await a.page.waitForFunction(
      () => dcsmcraft.active && dcsmcraft.ui.screen === "play",
    );
    await a.page.evaluate((B) => {
      const g = dcsmcraft;
      g.pause();
      g.entities = [];
      g.drops = [];
      g.rules.doMobSpawning = false;
      for (let x = -4; x < 10; x++)
        for (let z = -4; z < 10; z++) {
          g.world.set(x, 199, z, B.stone);
          for (let y = 200; y < 206; y++) g.world.set(x, y, z, B.air);
        }
      g.spawn = { x: 0.5, y: 200, z: 4.5 };
      Object.assign(g.player, {
        x: 0.5,
        y: 200,
        z: 4.5,
        vx: 0,
        vy: 0,
        vz: 0,
        fallStart: 200,
        onGround: true,
        health: 20,
      });
    }, B);
    await a.page.locator("[data-action=friends]").first().click();
    await a.page
      .locator(".friend-row")
      .filter({ hasText: "bob_social" })
      .getByRole("button", { name: "Invite", exact: true })
      .click();
    await b.page.locator("[data-social=join]").click();
    await b.page.waitForFunction(
      () => dcsmcraft.multiplayer.sessionReady && dcsmcraft.active,
    );
    await a.page.waitForFunction(
      () =>
        dcsmcraft.multiplayer.peers.size === 1 &&
        !Array.from(dcsmcraft.multiplayer.peers.values())[0].awaitingRealm,
    );
    const joined = await b.page.evaluate(() => ({
      guest: dcsmcraft.multiplayer.isGuest,
      name: dcsmcraft.multiplayer.players.find(
        (p) => p.id === dcsmcraft.multiplayer.id,
      )?.name,
      dimension: dcsmcraft.dimension,
    }));
    expect(joined).toEqual({
      guest: true,
      name: "bob_social",
      dimension: "overworld",
    });
    await a.page.evaluate(async (B) => {
      const g = dcsmcraft,
        p = [...g.multiplayer.peers.values()][0];
      await g.chat.send("/give bob_social diamond 3");
      g.world.set(2, 200, 4, B.end_portal);
      Object.assign(p.player, { x: 2.5, y: 200, z: 4.5, vx: 0, vy: 0, vz: 0 });
      p.teleport = true;
    }, B);
    await b.page.waitForFunction(() => dcsmcraft.dimension === "end", null, {
      timeout: 45000,
    });
    const independent = await a.page.evaluate(() => ({
      owner: dcsmcraft.dimension,
      guest: [...dcsmcraft.multiplayer.peers.values()][0].dimension,
    }));
    expect(independent).toEqual({ owner: "overworld", guest: "end" });
    expect(
      await b.page.evaluate(
        () => dcsmcraft.inventory.slots.find((s) => s?.id === "diamond")?.count,
      ),
    ).toBe(3);
    await a.page.evaluate(() => {
      const p = [...dcsmcraft.multiplayer.peers.values()][0];
      p.context.world.endgame.defeated = true;
    });
    // Use the real exit block ID and host portal contact, without moving the owner.
    await a.page.evaluate((B) => {
      const p = [...dcsmcraft.multiplayer.peers.values()][0];
      p.context.endTravelCooldown = 0;
      p.context.world.set(
        Math.floor(p.player.x),
        Math.floor(p.player.y),
        Math.floor(p.player.z),
        B.end_exit,
      );
    }, B);
    await b.page.waitForFunction(
      () => dcsmcraft.dimension === "overworld",
      null,
      { timeout: 45000 },
    );
    expect(
      await b.page.evaluate(
        () => dcsmcraft.inventory.slots.find((s) => s?.id === "diamond")?.count,
      ),
    ).toBe(3);
    await a.page.evaluate(async () => {
      const { buildPortal } = await import("/src/portals.js");
      const g = dcsmcraft,
        p = [...g.multiplayer.peers.values()][0];
      buildPortal(g.world, { x: 4, y: 200, z: 4, axis: "x" });
      Object.assign(p.player, {
        x: 5.5,
        y: 201.01,
        z: 4.5,
        vx: 0,
        vy: 0,
        vz: 0,
      });
      p.context.portalCooldown = 0;
      p.context.portalCharge = 79;
      p.teleport = true;
    });
    await b.page.waitForFunction(
      () => dcsmcraft.dimension === "cinderwild",
      null,
      { timeout: 45000 },
    );
    expect(await a.page.evaluate(() => dcsmcraft.dimension)).toBe("overworld");
    await b.page.screenshot({
      path: out + "/guest-cinderworld.png",
      timeout: 90000,
    });
    await b.page.evaluate(() => dcsmcraft.friends.panel.open());
    const downloaded=b.page.waitForEvent('download');
    await b.page.locator('[data-social=backup]').click();
    const backup=await (await downloaded).path();
    await b.page.evaluate(()=>dcsmcraft.quit());
    await a.page.waitForFunction(()=>dcsmcraft.multiplayer.peers.size===0);
    const restoredContext=await browser.newContext(), restored=await restoredContext.newPage();
    try {
      restored.on('pageerror',e=>b.errors.push(e.message));
      await restored.addInitScript(url=>{window.DCSMCRAFT_SOCIAL_URL=url;localStorage.setItem('dcsmcraft-settings',JSON.stringify({graphics:0,renderDistance:2,shadows:false,entityShadows:false,frameLimit:15,volume:0,musicEnabled:false,ambientSounds:false}));},url);
      await restored.goto('/');await restored.waitForFunction(()=>dcsmcraft?.initialized&&dcsmcraft.friends.url);
      await restored.locator('[data-action=friends]').first().click();
      await restored.locator('[data-restore-account]').setInputFiles(backup);
      await restored.waitForFunction(()=>dcsmcraft.friends.status==='online'&&dcsmcraft.friends.state.profile.username==='bob_social');
      expect(await restored.evaluate(()=>dcsmcraft.friends.state.friends[0].username)).toBe('alice_social');
      await a.page.locator('.friend-row').filter({hasText:'bob_social'}).getByRole('button',{name:'Invite',exact:true}).click();
      await restored.locator('[data-social=join]').click();
      await restored.waitForFunction(()=>dcsmcraft.multiplayer.sessionReady&&dcsmcraft.dimension==='cinderwild');
      expect(await restored.evaluate(()=>dcsmcraft.inventory.slots.find(s=>s?.id==='diamond')?.count)).toBe(3);
    } finally { await restoredContext.close(); }
    expect(a.errors).toEqual([]);
    expect(b.errors).toEqual([]);
    writeFileSync(
      out + "/browser-flow.json",
      JSON.stringify(
        {
          joined,
          independent,
          guestReturnedWithItems: true,
          cinderworld: true,
          accountBackupRestoredOnNewDevice:true,
          reconnectDimensionAndInventory:true,
          hostErrors: a.errors,
          guestErrors: b.errors,
        },
        null,
        2,
      ),
    );
  } finally {
    await b.context.close();
    await a.context.close();
  }
});
