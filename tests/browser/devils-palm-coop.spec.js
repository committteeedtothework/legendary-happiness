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
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Shader Error|GL_INVALID|WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({
        graphics: 1,
        renderDistance: 2,
        volume: 0,
        musicEnabled: false,
        distantTerrain: false,
        frameLimit: 30,
      }),
    ),
  );
  await page.goto(origin);
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  return { context, page, errors };
}
async function join(page, invite, name) {
  await page.locator("[data-action=multiplayer]").first().click();
  await page.locator("#multiplayer-name").fill(name);
  await page.locator("#multiplayer-invite").fill(invite);
  await page.locator("[data-role=guest]").click();
  await page.waitForFunction(() => dcsmcraft.multiplayer.sessionReady);
  await page.evaluate(() => {
    dcsmcraft.resume();
    dcsmcraft.pointerLockFallback = true;
  });
}
test("host resolves simultaneous trials, synchronizes Stands and combat, rejects duplicate commands, and retains ownership across reconnect and relocation", async ({
  browser,
}) => {
  test.setTimeout(210000);
  const h = await prep(browser),
    f = await prep(browser),
    l = await prep(browser),
    host = h.page,
    guest = f.page,
    late = l.page;
  try {
    await host.locator("[data-action=create]").click();
    await host.locator("[name=seed]").fill("Wildflower");
    await host.locator("[name=difficulty]").selectOption("peaceful");
    await host.locator("[data-action=start-world]").click();
    await host.waitForFunction(() => dcsmcraft.running && dcsmcraft.world.palm);
    await host.evaluate(() => {
      const g = dcsmcraft;
      g.world.palm.config = {
        ...g.world.palm.config,
        rarity: 1,
        trialSeconds: 5,
        awakening: 100,
        death: 0,
        neutral: 0,
      };
    });
    await host.waitForFunction(() =>
      dcsmcraft.world.palm.sites.some((s) => s.phase === "active"),
    );
    const site = await host.evaluate(() =>
      dcsmcraft.world.palm.sites.find((s) => s.phase === "active"),
    );
    await host.evaluate(() => dcsmcraft.pause());
    await host.locator("[data-action=multiplayer]").click();
    await host.locator("#multiplayer-name").fill("Owner");
    await host.locator("#multiplayer-server").fill(origin);
    await host.locator("[data-role=host]").click();
    await expect(host.locator("#session-invite")).toBeVisible();
    const invite = await host.locator("#session-invite").inputValue();
    await join(guest, invite, "Stand Friend");
    const snow = await host.evaluate(() => {
      const g=dcsmcraft,x=Math.floor(g.player.x)+80,z=Math.floor(g.player.z)+80;
      // IDs appended after the old catalog must cross the actual edit stream.
      g.world.set(x,199,z,3);g.world.set(x,200,z,131);
      return{x,z};
    });
    await guest.waitForFunction(({x,z})=>dcsmcraft.world.get(x,200,z)===131,snow);

    await host.evaluate((site) => {
      const g = dcsmcraft,
        peer = [...g.multiplayer.peers.values()][0],
        y = g.world.skyHeight(site.x, site.z) + 1.001;
      Object.assign(g.player, {
        x: site.x + 0.5,
        y,
        z: site.z + 0.5,
        vx: 0,
        vy: 0,
        vz: 0,
        fallStart: y,
      });
      Object.assign(peer.player, {
        x: site.x + 2.5,
        y,
        z: site.z + 0.5,
        vx: 0,
        vy: 0,
        vz: 0,
        fallStart: y,
      });
      peer.teleport = true;
      g.resume();
      g.pointerLockFallback = true;
    }, site);
    await host.waitForFunction(
      () => dcsmcraft.player.standData?.lastFate?.outcome === "stand",
      null,
      { timeout: 20000 },
    );
    await guest.waitForFunction(
      () => dcsmcraft.player.standData?.lastFate?.outcome === "stand",
      null,
      { timeout: 20000 },
    );
    const ownership = await guest.evaluate(() => ({
      soul: dcsmcraft.player.standData.soul,
      serial: dcsmcraft.player.standData.serial,
      outcome: dcsmcraft.player.standData.lastFate.outcome,
    }));
    expect(await host.evaluate(() => dcsmcraft.player.standData.soul)).not.toBe(
      ownership.soul,
    );
    await guest.waitForFunction(
      () => dcsmcraft.renderer.standVisuals.entries.size >= 2,
    );
    await host.evaluate(
      ({ B, site }) => {
        const g = dcsmcraft,
          peer = [...g.multiplayer.peers.values()][0],
          x = site.x + 120,
          z = site.z;
        for (let dx = -7; dx <= 7; dx++)
          for (let dz = -10; dz <= 10; dz++)
            g.world.set(x + dx, 199, z + dz, B.stone);
        Object.assign(g.player, {
          x: x + 0.5,
          y: 200,
          z: z + 3,
          vx: 0,
          vy: 0,
          vz: 0,
          fallStart: 200,
          onGround: true,
        });
        Object.assign(peer.player, {
          x: x + 0.5,
          y: 200,
          z: z + 6.5,
          vx: 0,
          vy: 0,
          vz: 0,
          yaw: 0,
          pitch: 0,
          fallStart: 200,
          onGround: true,
        });
        peer.teleport = true;
        Object.assign(peer.player.standData, {
          id: "tusk",
          summoned: true,
          energy: 100,
          cooldowns: {},
          awakeningUntil: 0,
        });
        g.time = 18000;
        g.difficulty = "normal";
        g.entities = [
          {
            id: "shared-target",
            type: "zombie",
            x: x + 0.5,
            y: 200,
            z,
            hp: 100,
            vx: 0,
            vy: 0,
            vz: 0,
            yaw: 0,
            age: 0,
            turn: 10000,
            dir: 0,
            speed: 0,
            attack: 999,
            onGround: true,
          },
        ];
      },
      { B, site },
    );
    await guest.waitForFunction(
      () =>
        dcsmcraft.player.standData.id === "tusk" && dcsmcraft.player.y > 190,
    );
    await guest.evaluate(() => {
      dcsmcraft.player.yaw = 0;
      dcsmcraft.player.pitch = 0;
    });
    await guest.keyboard.press("KeyF");
    await host.waitForFunction(
      () => dcsmcraft.entities.find((e) => e.id === "shared-target")?.hp <= 94,
    );
    const state = await host.evaluate(() => {
      const p = [...dcsmcraft.multiplayer.peers.values()][0];
      return {
        seq: p.lastSeq,
        health: dcsmcraft.player.health,
        energy: p.player.standData.energy,
      };
    });
    await guest.evaluate(
      (seq) =>
        dcsmcraft.multiplayer.send({
          type: "command",
          seq,
          kind: "stand",
          payload: {
            slot: "secondary",
            id: "d4c",
            damage: 999999,
            forceOutcome: "stand",
          },
        }),
      state.seq,
    );
    await guest.waitForTimeout(250);
    expect(
      await host.evaluate(
        () => [...dcsmcraft.multiplayer.peers.values()][0].player.standData.id,
      ),
    ).toBe("tusk");
    expect(await host.evaluate(() => dcsmcraft.player.health)).toBe(
      state.health,
    );
    expect(
      await host.evaluate(
        () =>
          [...dcsmcraft.multiplayer.peers.values()][0].player.standData.energy,
      ),
    ).toBeGreaterThanOrEqual(state.energy);
    await host.evaluate(() => dcsmcraft.save());
    await guest.evaluate(() => dcsmcraft.quit());
    await host.waitForFunction(() => dcsmcraft.multiplayer.peers.size === 0);
    await guest.reload();
    await guest.waitForFunction(() => window.dcsmcraft?.initialized);
    await join(guest, invite, "Stand Friend");
    expect(
      await guest.evaluate(() => ({
        soul: dcsmcraft.player.standData.soul,
        serial: dcsmcraft.player.standData.serial,
        outcome: dcsmcraft.player.standData.lastFate.outcome,
      })),
    ).toEqual(ownership);
    expect(await guest.evaluate(() => dcsmcraft.player.standData.id)).toBe(
      "tusk",
    );
    // An unrelated player disconnects before fate. The host preserves their
    // position as a harmless ruin during relocation, rather than burying them.
    await join(late, invite, "Unawakened");
    await host.evaluate((site) => {
      const peer = [...dcsmcraft.multiplayer.peers.values()].find(
          (p) => p.name === "Unawakened",
        ),
        g = dcsmcraft;
      g.world.palm.config.trialSeconds = 10;
      Object.assign(peer.player, {
        x: site.x + 0.5,
        y: g.world.skyHeight(site.x, site.z) + 1.001,
        z: site.z + 0.5,
        vx: 0,
        vy: 0,
        vz: 0,
        fallStart: site.y,
      });
      peer.teleport = true;
    }, site);
    await late.waitForFunction(
      () => dcsmcraft.player.standData?.trial?.elapsed >= 25,
    );
    await late.evaluate(() => dcsmcraft.quit());
    await host.waitForFunction(() => dcsmcraft.multiplayer.peers.size === 1);
    await host.evaluate(() => {
      const g = dcsmcraft;
      g.world.palm.nextMove = g.tickCount + 1;
      g.world.palm.config.rarity = 1;
    });
    await host.waitForFunction(
      (id) =>
        dcsmcraft.world.palm.sites.some(
          (s) => s.phase === "active" && s.id !== id,
        ),
      site.id,
      { timeout: 30000 },
    );
    await guest.waitForFunction(
      (id) =>
        dcsmcraft.world.palm.sites.some(
          (s) => s.phase === "active" && s.id !== id,
        ),
      site.id,
      { timeout: 15000 },
    );
    expect(
      await host.evaluate(
        (id) => dcsmcraft.world.palm.sites.find((s) => s.id === id)?.phase,
        site.id,
      ),
    ).toBe("ruin");
    await late.reload();
    await late.waitForFunction(() => window.dcsmcraft?.initialized);
    await join(late, invite, "Unawakened");
    expect(
      await late.evaluate(() => dcsmcraft.player.standData.lastFate),
    ).toBeUndefined();
    expect(await late.evaluate(() => dcsmcraft.player.standData.id)).toBeNull();
    expect(h.errors).toEqual([]);
    expect(f.errors).toEqual([]);
    expect(l.errors).toEqual([]);
  } finally {
    await l.context.close();
    await f.context.close();
    await h.context.close();
  }
});
