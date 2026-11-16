import { test, expect } from "@playwright/test";
import { createRelay } from "../../server/relay.mjs";
import { B } from "../../src/data.js";
import { mkdirSync, writeFileSync } from "node:fs";
const out = process.env.DCSMCRAFT_TEST_ARTIFACTS || "test-results/multiplayer";
mkdirSync(out, { recursive: true });
let relay, relayURL;
test.beforeAll(async () => {
  relay = createRelay();
  const { port } = await relay.listen(0, "127.0.0.1");
  relayURL = `http://127.0.0.1:${port}`;
});
test.afterAll(async () => relay.close());
async function pageFor(browser, { fallback = false } = {}) {
  const context = await browser.newContext(),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.stack || e.message));
  await page.addInitScript(
    ({ fallback }) => {
      localStorage.setItem(
        "dcsmcraft-settings",
        JSON.stringify({
          graphics: 1,
          renderDistance: 2,
          frameLimit: 15,
          volume: 0,
          musicEnabled: false,
          ambientSounds: false,
        }),
      );
      if (fallback) window.RTCPeerConnection = undefined;
    },
    { fallback },
  );
  await page.goto("/");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  return { context, page, errors };
}
async function world(page) {
  await page.locator("[data-action=create]").click();
  await expect(
    page.getByLabel("Allow Cheats", { exact: true }),
  ).not.toBeChecked();
  await page.getByLabel("Allow Cheats", { exact: true }).check();
  await page.locator("[name=seed]").fill("Shared updates");
  await page.locator("[name=difficulty]").selectOption("peaceful");
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(
    () => dcsmcraft.active && dcsmcraft.ui.screen === "play",
  );
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.pause();
    g.entities = [];
    g.drops = [];
    g.rules.doMobSpawning = false;
    for (let x = -3; x < 7; x++)
      for (let z = -3; z < 9; z++) {
        g.world.set(x, 199, z, B.stone);
        for (let y = 200; y < 205; y++) g.world.set(x, y, z, B.air);
      }
    g.spawn = { x: 0.5, y: 200, z: 4.5 };
    Object.assign(g.player, {
      ...g.spawn,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: 0,
      onGround: true,
      health: 20,
      fallStart: 200,
    });
  }, B);
  await page.evaluate(async (url) => {
    await dcsmcraft.multiplayer.connect({ server: url, name: "Owner" });
  }, relayURL);
  return page.evaluate(() => dcsmcraft.multiplayer.invite);
}
async function join(page, invite) {
  await page.evaluate(async (invite) => {
    await dcsmcraft.multiplayer.connect({ invite, name: "Friend" });
    dcsmcraft.pause();
  }, invite);
  await page.waitForFunction(() => dcsmcraft.multiplayer.sessionReady);
}

test("new-world cheat options, host-authoritative PvP, viewer fallback and command ownership work through a real relay", async ({
  browser,
}) => {
  const host = await pageFor(browser),
    guest = await pageFor(browser, { fallback: true });
  try {
    const invite = await world(host.page);
    await join(guest.page, invite);
    await host.page.evaluate(() => {
      const g = dcsmcraft,
        p = [...g.multiplayer.peers.values()][0];
      Object.assign(p.player, {
        x: 0.5,
        y: 200,
        z: 1.5,
        yaw: Math.PI,
        pitch: 0,
        onGround: true,
        vx: 0,
        vy: 0,
        vz: 0,
      });
      p.teleport = true;
      g.inventory.slots[0] = { id: "iron_sword", count: 1 };
      g.inventory.selected = 0;
      g.player.yaw = 0;
      g.player.pitch = 0;
    });
    await guest.page.waitForFunction(
      () => Math.abs(dcsmcraft.player.z - 1.5) < 0.2,
    );
    expect(
      await host.page.evaluate(() => {
        dcsmcraft.lastAttack = -10;
        return dcsmcraft.tryAttack();
      }),
    ).toBe(true);
    await guest.page.waitForFunction(() => dcsmcraft.player.health < 20);
    const hp = await guest.page.evaluate(() => dcsmcraft.player.health);
    expect(hp).toBeGreaterThan(0);
    await guest.page.evaluate(() =>
      dcsmcraft.multiplayer.watch.request(
        dcsmcraft.multiplayer.players.find((p) => p.host).id,
      ),
    );
    await expect(guest.page.locator("#toast")).toContainText("Leave combat");
    await expect(guest.page.locator(".spectator-view")).toHaveCount(0);
    await host.page.evaluate(() => {
      for (const p of dcsmcraft.multiplayer.peers.values())
        delete p.player.pvpLastCombat;
    });
    await guest.page.evaluate(() =>
      dcsmcraft.multiplayer.watch.request(
        dcsmcraft.multiplayer.players.find((p) => p.host).id,
      ),
    );
    await expect(guest.page.locator(".spectator-view")).toBeVisible();
    await guest.page.waitForFunction(
      () => document.querySelector(".spectator-view img")?.naturalWidth === 640,
    );
    const watching = await host.page.evaluate(
      () => [...dcsmcraft.multiplayer.peers.values()][0].player.multiplayerAway,
    );
    expect(watching).toBe(true);
    await guest.page.screenshot({ path: out + "/relay-spectator.png" });
    await guest.page
      .getByRole("button", { name: "Stop Watching", exact: true })
      .click();
    await expect(guest.page.locator(".spectator-view")).toHaveCount(0);
    await host.page.waitForFunction(
      () =>
        ![...dcsmcraft.multiplayer.peers.values()][0].player.multiplayerAway,
    );
    const ownership = await guest.page.evaluate(async () => {
      await dcsmcraft.chat.send("/give @s diamond 64");
      return dcsmcraft.chat.lines.at(-1).message;
    });
    expect(ownership).toContain("hosting");
    const command = await host.page.evaluate(async () => {
      await dcsmcraft.chat.send("/give @a ender_pearl 2");
      return dcsmcraft.chat.lines.at(-1).message;
    });
    expect(command).toContain("Gave");
    await guest.page.waitForFunction(() =>
      dcsmcraft.inventory.slots.some(
        (s) => s?.id === "ender_pearl" && s.count === 2,
      ),
    );
    expect(host.errors).toEqual([]);
    expect(guest.errors).toEqual([]);
    writeFileSync(
      out + "/pvp-watch-commands.json",
      JSON.stringify(
        {
          hp,
          watching,
          ownership,
          command,
          hostErrors: host.errors,
          guestErrors: guest.errors,
        },
        null,
        2,
      ),
    );
  } finally {
    await guest.context.close();
    await host.context.close();
  }
});

test("owner realm travel preserves guests; media tracks, fallback and spectator cleanup work", async ({
  browser,
}) => {
  const host = await pageFor(browser),
    guest = await pageFor(browser);
  try {
    const invite = await world(host.page);
    await join(guest.page, invite);
    await host.page.evaluate(async () => {
      const g = dcsmcraft;
      await g.chat.send("/give guest diamond 3").catch(() => {});
      g.audio.unlock();
      if (g.audio.context?.state === "suspended")
        await g.audio.context.resume();
      const { selectRealm } = await import("/src/realms.js");
      selectRealm(g, "cinderwild");
      for (let x = -2; x < 3; x++)
        for (let z = -2; z < 3; z++) g.world.set(x, 199, z, 1);
      Object.assign(g.player, {
        x: 0,
        y: 200,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        fallStart: 200,
        onGround: true,
      });
    });
    await guest.page.waitForFunction(
      () =>
        dcsmcraft.dimension === "overworld" &&
        dcsmcraft.multiplayer.sessionReady,
    );
    const dims = await host.page.evaluate(() => ({
      host: dcsmcraft.dimension,
      shared: dcsmcraft.multiplayer.simulationGame.dimension,
      peer: [...dcsmcraft.multiplayer.peers.values()][0].context.dimension,
    }));
    expect(dims).toEqual({
      host: "cinderwild",
      shared: "overworld",
      peer: "overworld",
    });
    await host.page.evaluate(() => {
      const p = [...dcsmcraft.multiplayer.peers.values()][0];
      Object.assign(p.player, { onGround: true, vy: 0 });
    });
    await guest.page.evaluate(() =>
      dcsmcraft.multiplayer.watch.request(
        dcsmcraft.multiplayer.players.find((p) => p.host).id,
      ),
    );
    await expect(guest.page.locator(".spectator-view")).toBeVisible();
    const direct = await guest.page
      .waitForFunction(() => dcsmcraft.multiplayer.watch.live, null, {
        timeout: 10000,
      })
      .then(() => true)
      .catch(() => false);
    if (!direct)
      await guest.page.waitForFunction(
        () =>
          document.querySelector(".spectator-view img")?.naturalWidth === 640,
      );
    const stream = await guest.page.evaluate(() => {
      const v = document.querySelector(".spectator-view video");
      return {
        direct: !!dcsmcraft.multiplayer.watch.live,
        video: v.srcObject?.getVideoTracks().length,
        audio: v.srcObject?.getAudioTracks().length,
        title: document.querySelector(".spectator-heading span").textContent,
      };
    });
    expect(stream.video).toBe(1);
    expect(stream.audio).toBe(1);
    await guest.page
      .getByRole("button", { name: "Stop Watching", exact: true })
      .click();
    await expect(guest.page.locator(".spectator-view")).toHaveCount(0);
    await host.page.waitForFunction(
      () =>
        dcsmcraft.multiplayer.watch.peers.size === 0 &&
        !dcsmcraft.multiplayer.watch.stream,
    );
    await host.page.evaluate(async () => {
      const { selectRealm } = await import("/src/realms.js");
      selectRealm(dcsmcraft, "overworld");
    });
    expect(
      await host.page.evaluate(() => dcsmcraft.multiplayer.sharedRealm.base),
    ).toBeNull();
    expect(await guest.page.evaluate(() => dcsmcraft.dimension)).toBe(
      "overworld",
    );
    expect(host.errors).toEqual([]);
    expect(guest.errors).toEqual([]);
    writeFileSync(
      out + "/realm-direct-stream.json",
      JSON.stringify(
        { dims, stream, hostErrors: host.errors, guestErrors: guest.errors },
        null,
        2,
      ),
    );
  } finally {
    await guest.context.close();
    await host.context.close();
  }
});

test("a guest can enter a real Titan portal while the host watches; exit restores canonical inventory", async ({
  browser,
}) => {
  const host = await pageFor(browser, { fallback: true }),
    guest = await pageFor(browser, { fallback: true });
  try {
    const invite = await world(host.page);
    await join(guest.page, invite);
    await host.page.evaluate(() => {
      const g = dcsmcraft,
        p = [...g.multiplayer.peers.values()][0];
      g.giganto.record.config.enabled = true;
      g.giganto.record.cooldownUntil = 0;
      g.giganto.record.portal = {
        id: "network-test",
        cell: "network",
        x: 2,
        y: 200,
        z: 3,
      };
      Object.assign(p.player, {
        x: 2.5,
        y: 200,
        z: 5.5,
        vx: 0,
        vy: 0,
        vz: 0,
        onGround: true,
      });
      p.teleport = true;
    });
    await guest.page.waitForFunction(
      () =>
        dcsmcraft.giganto.record.portal?.id === "network-test" &&
        Math.abs(dcsmcraft.player.x - 2.5) < 0.2,
    );
    await guest.page.evaluate(() => {
      dcsmcraft.resume();
      dcsmcraft.giganto.overworld(0.01);
    });
    expect(await guest.page.evaluate(() => dcsmcraft.giganto.enter())).toBe(
      true,
    );
    await guest.page.waitForFunction(
      () => dcsmcraft.giganto.active && dcsmcraft.giganto.view?.assetsReady,
      null,
      { timeout: 90000 },
    );
    await host.page.waitForFunction(
      () =>
        [...dcsmcraft.multiplayer.peers.values()][0].arena?.session.stageTime >
        0,
    );
    await host.page.evaluate(() => {
      const g = dcsmcraft;
      g.player.onGround = true;
      g.player.vy = 0;
      g.multiplayer.watch.request([...g.multiplayer.peers.keys()][0]);
    });
    await expect(host.page.locator(".spectator-view")).toBeVisible();
    await host.page.waitForFunction(
      () => document.querySelector(".spectator-view img")?.naturalWidth === 640,
    );
    await expect(host.page.locator(".spectator-heading span")).toHaveText(
      "GIGANTO",
    );
    await host.page.screenshot({
      path: out + "/guest-titan-watched.png",
      timeout: 90000,
    });
    await host.page
      .getByRole("button", { name: "Stop Watching", exact: true })
      .click();
    expect(await guest.page.evaluate(() => dcsmcraft.giganto.exit())).toBe(
      true,
    );
    await host.page.waitForFunction(
      () =>
        ![...dcsmcraft.multiplayer.peers.values()][0].player.multiplayerAway &&
        ![...dcsmcraft.multiplayer.peers.values()][0].arena,
    );
    expect(
      await guest.page.evaluate(() => ({
        arena: dcsmcraft.giganto.active,
        away: !!dcsmcraft.player.multiplayerAway,
      })),
    ).toEqual({ arena: false, away: false });
    expect(host.errors).toEqual([]);
    expect(guest.errors).toEqual([]);
  } finally {
    await guest.context.close();
    await host.context.close();
  }
});
