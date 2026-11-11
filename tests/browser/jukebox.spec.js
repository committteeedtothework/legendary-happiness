import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { B } from "../../src/data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8"),
  mp3 = readFileSync("tests/fixtures/local-disc.mp3"),
  out = "/workspace/artifacts/local-discs-playtest";
mkdirSync(out, { recursive: true });
async function boot(page, mode = "creative") {
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Shader Error|GL_INVALID|WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({
        renderDistance: 2,
        graphics: 1,
        distantTerrain: false,
        volume: 0.8,
        musicEnabled: false,
        ambientSounds: false,
      }),
    ),
  );
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/discs.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : (external.push(r.request().url()), r.abort()),
  );
  await page.goto("/discs.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator(`[name=mode][value=${mode}]`).check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.entities = [];
  });
  return { errors, external };
}
async function physical(page) {
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.world.set(0, 200, 0, B.jukebox);
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 2.5,
      yaw: 0,
      pitch: 0,
      flying: true,
    });
    g.jukebox.open({ x: 0, y: 200, z: 0, id: B.jukebox });
  }, B);
  await expect(page.locator("#jukebox-file")).toBeVisible();
}
async function choose(page) {
  await page.locator("#jukebox-file").setInputFiles({
    name: "My Local Song.mp3",
    mimeType: "audio/mpeg",
    buffer: mp3,
  });
  await expect(page.locator("#jukebox-track-name")).toContainText(
    "My Local Song",
  );
}
test("offline real MP3 discs import, play, pause, obey volume, persist without autoplay and eject exactly once", async ({
  page,
}) => {
  const result = await boot(page);
  await physical(page);
  await choose(page);
  expect(await page.locator("iframe").count()).toBe(0);
  expect(await page.locator("#jukebox-link").count()).toBe(0);
  await page.evaluate(() => {
    dcsmcraft.inventory.slots.fill(null);
    dcsmcraft.inventory.slots[0] = { id: "music_disc_amber", count: 1 };
  });
  await page.locator("#jukebox-insert").click();
  await expect(page.locator("#jukebox-status")).toContainText("inserted");
  expect(await page.evaluate(() => dcsmcraft.inventory.slots[0])).toBeNull();
  await page.locator("#jukebox-play").click();
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.jukebox.state))
    .toBe("playing");
  await page.waitForTimeout(250);
  expect(
    await page.evaluate(() => dcsmcraft.jukebox.audio.currentTime),
  ).toBeGreaterThan(0.1);
  await page.evaluate(() => dcsmcraft.ui.settings());
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.jukebox.state))
    .toBe("menu-paused");
  await page.evaluate(() => dcsmcraft.jukebox.open());
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.jukebox.state))
    .toBe("playing");
  await page.locator("#jukebox-volume").fill("0.5");
  expect(await page.evaluate(() => dcsmcraft.jukebox.audio.volume)).toBeCloseTo(
    0.4,
  );
  await page.locator("#jukebox-pause").click();
  const t = await page.evaluate(() => dcsmcraft.jukebox.audio.currentTime);
  await page.waitForTimeout(150);
  expect(
    await page.evaluate(() => dcsmcraft.jukebox.audio.currentTime),
  ).toBeCloseTo(t, 1);
  await page.locator("#jukebox-play").click();
  await page.setViewportSize({ width: 640, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: out + "/jukebox-narrow.png" });
  const id = await page.evaluate(async () => {
    await dcsmcraft.save();
    return dcsmcraft.id;
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(() => dcsmcraft.active);
  await physical(page);
  await expect(page.locator("#jukebox-track-name")).toContainText(
    "My Local Song",
  );
  expect(await page.evaluate(() => dcsmcraft.jukebox.audio)).toBeNull();
  expect(
    await page.evaluate(
      () => dcsmcraft.world.containers["0,200,0"].slots[0].id,
    ),
  ).toBe("music_disc_amber");
  await page.locator("#jukebox-play").click();
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.jukebox.state))
    .toBe("playing");
  const objectURL = await page.evaluate(() => dcsmcraft.jukebox.objectURL);
  await page.locator("#jukebox-eject").click();
  expect(await page.evaluate(() => dcsmcraft.jukebox.objectURL)).toBeNull();
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.inventory.slots.filter((x) => x?.id === "music_disc_amber")
          .length,
    ),
  ).toBe(1);
  await expect(page.locator("#jukebox-eject")).toBeDisabled();
  expect(
    await page.evaluate(() =>
      JSON.stringify(dcsmcraft.snapshot()).includes("audio/mpeg"),
    ),
  ).toBe(false);
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});
test("offline Survival discs craft, reject invalid files/full ejection, drop on breaking and stop playback", async ({
  page,
}) => {
  const result = await boot(page, "survival");
  await physical(page);
  await page.locator("#jukebox-file").setInputFiles({
    name: "bad.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from("x"),
  });
  await expect(page.locator("#jukebox-status")).toContainText("Choose an MP3");
  await choose(page);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.inventory.craft = [
      ...Array.from({ length: 4 }, () => ({ id: "paper", count: 1 })),
      { id: "coal", count: 1 },
      ...Array(4).fill(null),
    ];
    if (!g.inventory.craftOne(3)) throw Error("Disc recipe failed");
    g.inventory.slots[0] = g.inventory.cursor;
    g.inventory.cursor = null;
  });
  await page.locator("#jukebox-insert").click();
  await page.locator("#jukebox-play").click();
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.jukebox.state))
    .toBe("playing");
  await page.evaluate(() =>
    dcsmcraft.inventory.slots.fill({ id: "stone", count: 64 }),
  );
  await page.locator("#jukebox-eject").click();
  await expect(page.locator("#jukebox-status")).toContainText("Make room");
  expect(
    await page.evaluate(
      () => dcsmcraft.world.containers["0,200,0"].slots[0].count,
    ),
  ).toBe(1);
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.inventory.slots[0] = { id: "wooden_axe", count: 1, durability: 59 };
    g.breakBlock({ x: 0, y: 200, z: 0, id: B.jukebox });
  }, B);
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.jukebox.audio))
    .toBeNull();
  expect(
    await page.evaluate(() =>
      dcsmcraft.drops
        .filter((x) => x.id === "music_disc_amber")
        .reduce((n, x) => n + x.count, 0),
    ),
  ).toBe(1);
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});
test("Creative Stand catalog equips all five, uses hotkeys and persists; Survival has no catalog or grant", async ({
  page,
}) => {
  const result = await boot(page);
  await page.evaluate(() => dcsmcraft.openInventory("personal"));
  await page.locator("[data-tab=stands]").click();
  expect(await page.locator("[data-action=creative-stand]").count()).toBe(5);
  for (const id of ["tusk", "lonesome", "monsters", "cream", "d4c"]) {
    await page.locator(`[data-stand=${id}]`).click();
    expect(await page.evaluate(() => dcsmcraft.player.standData.id)).toBe(id);
    await expect(page.locator(`[data-stand=${id}]`)).toHaveText("Selected");
  }
  await page.screenshot({ path: out + "/creative-stands.png" });
  await page.evaluate(async () => {
    dcsmcraft.closeInventory();
    await dcsmcraft.save();
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(() => dcsmcraft.running);
  expect(await page.evaluate(() => dcsmcraft.player.standData.id)).toBe("d4c");
  await page.keyboard.press("KeyH");
  expect(await page.evaluate(() => dcsmcraft.player.standData.summoned)).toBe(
    false,
  );
  await page.evaluate(() => {
    dcsmcraft.mode = "survival";
    dcsmcraft.openInventory("personal");
  });
  expect(await page.locator("[data-tab=stands]").count()).toBe(0);
  expect(
    await page.evaluate(() => dcsmcraft.ui.selectCreativeStand("tusk")),
  ).toBe(false);
  expect(await page.evaluate(() => dcsmcraft.player.standData.id)).toBe("d4c");
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});
