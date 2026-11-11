import { test, expect } from "@playwright/test";
import { createRelay } from "../../server/relay.mjs";
import { testCertificate } from "../helpers/tls-fixture.js";
import { B } from "../../src/data.js";
let relay, origin, cert;
test.beforeAll(async () => {
  cert = testCertificate();
  relay = createRelay({ tls: cert });
  const { port } = await relay.listen(0, "127.0.0.1");
  origin = `https://127.0.0.1:${port}`;
  relay.setPublicURL(origin);
});
test.afterAll(async () => {
  await relay.close();
  cert.close();
});
async function prep(browser) {
  // Self-signed test certificate only. Shipping clients retain normal TLS validation.
  const context = await browser.newContext({ ignoreHTTPSErrors: true }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({
        graphics: 1,
        renderDistance: 2,
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
test("built game probes the relay, remembers its address and runs Survival chat/inventory/world synchronization over actual HTTPS/WSS", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const h = await prep(browser),
    g = await prep(browser),
    host = h.page,
    guest = g.page;
  try {
    await host.locator("[data-action=multiplayer]").click();
    await host.locator("[name=relay-access][value=public]").check();
    await host.locator("#multiplayer-server").fill("http://127.0.0.1:8787");
    await host.locator("[data-action=test-relay]").click();
    await expect(host.locator("#multiplayer-status")).toContainText(
      "Public hosting needs",
    );
    await host.locator("[name=relay-access][value=local]").check();
    await host.locator("#multiplayer-server").fill(origin);
    await host.locator("[data-action=test-relay]").click();
    await expect(host.locator("#multiplayer-status")).toContainText(
      "Relay connected",
    );
    expect(relay.rooms.size).toBe(0);
    expect(
      await host.evaluate(() =>
        localStorage.getItem("dcsmcraft-relay-address"),
      ),
    ).toBe(origin);
    await host.reload();
    await host.waitForFunction(() => window.dcsmcraft?.initialized);
    await host.locator("[data-action=create]").click();
    await host.locator("[name=seed]").fill("HTTPS Campfire");
    await host.locator("[name=difficulty]").selectOption("peaceful");
    await host.locator("[data-action=start-world]").click();
    await host.waitForFunction(() => dcsmcraft.active);
    await host.evaluate(() => dcsmcraft.pause());
    await host.locator("[data-action=multiplayer]").click();
    await expect(host.locator("#multiplayer-server")).toHaveValue(origin);
    await host.locator("#multiplayer-name").fill("TLS Owner");
    await host.locator("[data-role=host]").click();
    await expect(host.locator("#session-invite")).toBeVisible();
    const invite = await host.locator("#session-invite").inputValue();
    expect(invite.startsWith(origin + "/#")).toBe(true);
    expect(await host.evaluate(() => dcsmcraft.multiplayer.socket.url)).toMatch(
      /^wss:/,
    );
    await guest.goto(invite);
    await guest.waitForFunction(() => window.dcsmcraft?.initialized);
    await expect(guest.locator("#multiplayer-invite")).toHaveValue(invite);
    await guest.locator("#multiplayer-name").fill("TLS Friend");
    await guest.locator("[data-role=guest]").click();
    await guest.waitForFunction(() => dcsmcraft.multiplayer.sessionReady);
    expect(
      await guest.evaluate(() => dcsmcraft.multiplayer.socket.url),
    ).toMatch(/^wss:/);
    expect(await guest.evaluate(() => dcsmcraft.mode)).toBe("survival");
    await guest.evaluate(() => dcsmcraft.resume());
    await guest.keyboard.press("KeyT");
    await guest
      .locator("#world-chat-input")
      .fill("Encrypted hello from another client");
    await guest.locator("#world-chat-form button[type=submit]").click();
    await expect(host.locator("#chat-log")).toContainText(
      "Encrypted hello from another client",
    );
    await host.evaluate(() => dcsmcraft.chat.open("/"));
    await host.locator("#world-chat-input").fill('/give "TLS Friend" planks 2');
    await host.locator("#world-chat-form button[type=submit]").click();
    await guest.waitForFunction(() =>
      dcsmcraft.inventory.slots.some(
        (s) => s?.id === "planks" && s.count === 2,
      ),
    );
    await host.evaluate((B) => dcsmcraft.world.set(0, 200, 0, B.glass), B);
    await guest.waitForFunction(() => dcsmcraft.world.get(0, 200, 0) === 17);
    await host.evaluate(() => dcsmcraft.ui.multiplayerMenu());
    relay.setPublicURL("https://public-relay.example.com");
    await expect(host.locator("#session-invite")).toHaveValue(
      /https:\/\/public-relay\.example\.com\/#/,
    );
    await expect(host.locator(".relay-badge")).toContainText("PUBLIC HTTPS");
    relay.setPublicURL(origin);
    await expect(host.locator("#session-invite")).toHaveValue(
      new RegExp(origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/#"),
    );
    await host.screenshot({
      path: "/workspace/artifacts/DCSMCRAFT-v1.4.1-https-relay.png",
    });
    expect([...h.errors, ...g.errors]).toEqual([]);
  } finally {
    await h.context.close();
    await g.context.close();
  }
});
