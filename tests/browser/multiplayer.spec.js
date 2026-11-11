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
async function prep(page) {
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({
        renderDistance: 2,
        graphics: 1,
        ambientSounds: false,
        musicEnabled: false,
      }),
    ),
  );
  await page.goto(origin);
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  return errors;
}
test("real relay and three independent players share invitations, block edits, doors, skins, chat, host saves and leave safely", async ({
  browser,
}) => {
  test.setTimeout(240000);
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const [host, guest, third] = pages;
  const errors = [];
  for (const page of pages) errors.push(await prep(page));
  try {
    await host.locator("[data-action=create]").click();
    await host.locator("[name=seed]").fill("Cooperative Wildflower");
    await host.locator("[name=mode][value=creative]").check();
    await host.locator("[data-action=start-world]").click();
    await host.waitForFunction(() => dcsmcraft.active);
    await host.evaluate((B) => {
      const g = dcsmcraft;
      g.pause();
      g.entities = [];
      for (let x = 3; x <= 14; x++)
        for (let z = 0; z <= 12; z++) {
          g.world.set(x, 199, z, B.stone);
          for (let y = 200; y <= 203; y++) g.world.set(x, y, z, B.air);
        }
      g.world.set(8, 200, 5, B.stone);
      g.world.set(10, 200, 5, B.oak_door);
      g.world.set(10, 201, 5, B.oak_door + 1);
      Object.assign(g.player, {
        x: 8.5,
        y: 200,
        z: 8.5,
        yaw: 0,
        pitch: 0,
        flying: true,
        vx: 0,
        vy: 0,
        vz: 0,
      });
      g.settings.skin = "devin";
    }, B);
    await host.locator("[data-action=multiplayer]").click();
    await host.locator("#multiplayer-name").fill("Devin Host");
    await host.locator("#multiplayer-server").fill(origin);
    await host.locator("[data-role=host]").click();
    await expect(host.locator("#session-invite")).toBeVisible();
    const invite = await host.locator("#session-invite").inputValue();
    expect(new URL(invite).hash).toContain("key=");
    await guest.locator("[data-action=multiplayer]").click();
    await guest.locator("#multiplayer-name").fill("Friend One");
    await guest.locator("#multiplayer-invite").fill(invite);
    await guest.locator("[data-role=guest]").click();
    await guest.waitForFunction(() => dcsmcraft.multiplayer.sessionReady);
    await expect(guest.locator("[data-action=resume]")).toBeVisible();
    await third.goto(invite);
    await third.waitForFunction(() => window.dcsmcraft?.initialized);
    await expect(third.locator("#multiplayer-invite")).toHaveValue(invite);
    await third.locator("#multiplayer-name").fill("Friend Two");
    await third.locator("[data-role=guest]").click();
    await third.waitForFunction(() => dcsmcraft.multiplayer.sessionReady);
    await host.waitForFunction(
      () => dcsmcraft.multiplayer.players.length === 3,
    );
    await guest.evaluate(() => {
      const g = dcsmcraft;
      Object.assign(g.player, {
        x: 8.5,
        y: 200,
        z: 8.5,
        yaw: 0,
        pitch: -0.52,
        flying: true,
        vx: 0,
        vy: 0,
        vz: 0,
      });
      g.settings.skin = "dante";
      g.resume();
      g.pointerLockFallback = true;
    });
    await host.waitForFunction(() =>
      Array.from(dcsmcraft.multiplayer.peers.values()).some(
        (p) => p.skin === "dante",
      ),
    );
    await host.waitForFunction(() =>
      Array.from(dcsmcraft.multiplayer.models.values()).some(
        ({ model }) =>
          model.userData.skin === "dante" && model.userData.coat.length === 2,
      ),
    );
    // Guest edits are sent to the host and echoed to every player, never applied locally first.
    await guest.waitForFunction(
      () => dcsmcraft.target?.x === 8 && dcsmcraft.target?.z === 5,
    );
    await guest.locator("#game-canvas").click({ force: true });
    await host.waitForFunction(() => dcsmcraft.world.get(8, 200, 5) === 0);
    await third.waitForFunction(() => dcsmcraft.world.get(8, 200, 5) === 0);
    // Both peers target a platform floor; place a shared block using the ordinary right click.
    await guest.evaluate(() => {
      dcsmcraft.inventory.slots[0] = { id: "planks", count: 64 };
      dcsmcraft.inventory.selected = 0;
      dcsmcraft.player.pitch = -0.85;
    });
    await guest.waitForFunction(() => dcsmcraft.target?.y === 199);
    const target = await guest.evaluate(() => ({ ...dcsmcraft.target }));
    await guest.locator("#game-canvas").click({ button: "right", force: true });
    const placed = {
      x: target.x + target.normal.x,
      y: target.y + target.normal.y,
      z: target.z + target.normal.z,
    };
    await host.waitForFunction(
      (p) => dcsmcraft.world.get(p.x, p.y, p.z) === 8,
      placed,
    );
    await third.waitForFunction(
      (p) => dcsmcraft.world.get(p.x, p.y, p.z) === 8,
      placed,
    );
    // Door clicks are authoritative and remain open while host menus are up.
    await guest.evaluate(() => {
      Object.assign(dcsmcraft.player, {
        x: 10.09,
        y: 200,
        z: 8.5,
        yaw: 0,
        pitch: 0,
      });
    });
    await guest.waitForTimeout(250);
    await guest.waitForFunction(() => dcsmcraft.target?.id === 38);
    await guest.locator("#game-canvas").click({ button: "right", force: true });
    await host.waitForFunction(() => dcsmcraft.world.get(10, 200, 5) === 39);
    await third.waitForFunction(() => dcsmcraft.world.get(10, 200, 5) === 39);
    const before = await host.evaluate(() => dcsmcraft.tickCount);
    await host.waitForTimeout(500);
    expect(await host.evaluate(() => dcsmcraft.tickCount)).toBeGreaterThan(
      before,
    );
    // The host rejects placing a solid block into another player's body.
    await guest.evaluate(() => {
      const g = dcsmcraft;
      Object.assign(g.player, {
        x: 10.5,
        y: 200,
        z: 8.5,
        yaw: Math.PI / 2,
        pitch: -0.68,
      });
      g.inventory.slots[0] = { id: "planks", count: 64 };
    });
    await guest.waitForFunction(
      () =>
        dcsmcraft.target?.x === 8 &&
        dcsmcraft.target?.y === 199 &&
        dcsmcraft.target?.z === 8,
    );
    await guest.locator("#game-canvas").click({ button: "right", force: true });
    await expect(guest.locator("#toast")).toContainText(
      "A player is standing there",
    );
    expect(await host.evaluate(() => dcsmcraft.world.get(8, 200, 8))).toBe(0);
    // A guest's actual R key launches the host-simulated Seeker and receives its cooldown.
    await host.evaluate(() => {
      const g = dcsmcraft;
      g.time = 14000;
      g.entities = [
        {
          id: "coop-seeker",
          type: "shade",
          x: 10.5,
          y: 200,
          z: 1.5,
          vx: 0,
          vy: 0,
          vz: 0,
          onGround: true,
          hp: 30,
          yaw: 0,
          age: 0,
          attack: 0,
          hurt: 0,
          turn: 0,
          dir: 0,
          speed: 0,
        },
      ];
    });
    await guest.evaluate(() => {
      dcsmcraft.inventory.slots[0] = { id: "devin_sword", count: 1 };
      dcsmcraft.player.yaw = 0;
      dcsmcraft.player.pitch = 0;
    });
    await guest.waitForTimeout(250);
    await guest.keyboard.press("KeyR");
    await expect
      .poll(
        () =>
          host.evaluate(() => ({
            hp: dcsmcraft.entities.find((e) => e.id === "coop-seeker")?.hp,
            bolts: dcsmcraft.seekers?.length,
            peerCooldown: [...dcsmcraft.multiplayer.peers.values()].map(
              (p) => p.player.devinSeekerTick || 0,
            ),
          })),
        { timeout: 12000 },
      )
      .toMatchObject({ hp: 18 });
    await guest.waitForFunction(
      () => dcsmcraft.player.devinSeekerTick > dcsmcraft.tickCount,
    );
    await guest.waitForTimeout(250);
    await guest.keyboard.press("KeyR");
    await expect(guest.locator("#toast")).toContainText("recharges");
    expect(await host.evaluate(() => dcsmcraft.player.x)).toBe(8.5);
    // A guest's ordinary left clicks use host damage/cooldowns and synchronize
    // alternating hand animation, rather than trusting client damage messages.
    await host.evaluate(() => {
      dcsmcraft.entities = [
        {
          id: "coop-pistols",
          type: "zombie",
          x: 10.5,
          y: 200,
          z: 1.5,
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
    await guest.evaluate(() => {
      const g = dcsmcraft;
      g.inventory.slots[0] = { id: "matthew_dual_pistols", count: 1 };
      Object.assign(g.player, {
        x: 10.5,
        y: 200,
        z: 8.5,
        yaw: 0,
        pitch: -0.06,
        vx: 0,
        vy: 0,
        vz: 0,
        matthewHand: 0,
      });
      g.pointerLockFallback = true;
      window.pistolSounds = [];
      const tone = g.audio.tone.bind(g.audio);
      g.audio.tone = (...args) => {
        if (args[0] === "pistol") pistolSounds.push(args[1]);
        tone(...args);
      };
    });
    await guest.waitForTimeout(350);
    await guest.locator("#game-canvas").click({ force: true });
    await host.waitForFunction(
      () => dcsmcraft.entities.find((e) => e.id === "coop-pistols")?.hp === 95,
    );
    await guest.waitForFunction(
      () =>
        dcsmcraft.player.matthewHand === 1 &&
        dcsmcraft.player.matthewShotTick > 0,
    );
    await host.waitForFunction(() =>
      [...dcsmcraft.multiplayer.peers.values()].every(
        (p) => (p.player.matthewShotTick || 0) <= dcsmcraft.tickCount,
      ),
    );
    await host.evaluate(() => {
      const e = dcsmcraft.entities.find((e) => e.id === "coop-pistols");
      Object.assign(e, {
        x: 10.5,
        y: 200,
        z: 1.5,
        flee: 0,
        turn: 9999,
        speed: 0,
        vx: 0,
        vz: 0,
      });
    });
    await guest.waitForTimeout(200);
    await guest.locator("#game-canvas").click({ force: true });
    await host.waitForFunction(
      () => dcsmcraft.entities.find((e) => e.id === "coop-pistols")?.hp === 90,
    );
    await guest.waitForFunction(() => dcsmcraft.player.matthewHand === 0);
    expect(await guest.evaluate(() => pistolSounds)).toEqual([
      "silver",
      "black",
    ]);
    await guest.keyboard.press("KeyR");
    await expect(guest.locator("#toast")).toContainText("host-only");
    await guest.keyboard.press("Tab");
    await expect(guest.locator("#session-players")).toContainText("Friend Two");
    await guest.locator("#chat-message").fill("<hello> from a real client");
    await guest.locator("#chat-form button").click();
    await expect(host.locator("#chat-log")).toContainText(
      "<hello> from a real client",
    );
    expect(await host.locator("#chat-log script").count()).toBe(0);
    await guest.evaluate(() => {
      dcsmcraft.cameraMode = 1;
      dcsmcraft.ui.play();
    });
    await host.waitForFunction(() => dcsmcraft.multiplayer.models.size === 2);
    await guest.waitForFunction(() => dcsmcraft.multiplayer.models.size === 2);
    await guest.screenshot({
      path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-coop-world.png",
    });
    await host.screenshot({
      path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-multiplayer.png",
    });
    const saved = await host.evaluate(async () => {
      await dcsmcraft.save();
      const { data } = await dcsmcraft.store.load(dcsmcraft.id);
      return { edits: data.edits, mode: data.mode };
    });
    expect(saved.edits[`${placed.x},${placed.y},${placed.z}`]).toBe(B.planks);
    expect(saved.mode).toBe("creative");
    await third.locator("[data-action=quit]").click();
    await third.waitForFunction(() => !dcsmcraft.active);
    await host.waitForFunction(
      () => dcsmcraft.multiplayer.players.length === 2,
    );
    // Host removal closes the guest session but leaves the saved host world intact.
    const peer = await host
      .locator("[data-action=kick-player]")
      .first()
      .getAttribute("data-id");
    await host.locator(`[data-action=kick-player][data-id="${peer}"]`).click();
    await guest.waitForFunction(() => !dcsmcraft.multiplayer.connected);
    await expect(guest.locator(".pause-dialog")).toContainText("removed");
    await host.locator("[data-action=disconnect-multiplayer]").click();
    expect(
      await host.evaluate(
        () => dcsmcraft.active && !dcsmcraft.multiplayer.connected,
      ),
    ).toBe(true);
    // Closing and immediately reopening must ignore the previous socket's late close event.
    const reopened = await host.evaluate(async (origin) => {
      const m = dcsmcraft.multiplayer;
      await m.connect({ server: origin, name: "Quick Reopen" });
      m.disconnect();
      await m.connect({ server: origin, name: "New Session" });
      await new Promise((resolve) => setTimeout(resolve, 120));
      const ok = m.connected && m.sessionReady;
      m.disconnect();
      return ok;
    }, origin);
    expect(reopened).toBe(true);
    expect(errors.flat()).toEqual([]);
  } finally {
    for (const c of contexts) await c.close();
  }
});
