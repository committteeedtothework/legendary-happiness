import { test, expect } from "@playwright/test";
import { createReadStream, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { B, BLOCKS, ATLAS_COLS } from "../../src/data.js";

test.use({ trace: "off" });
test.setTimeout(180000);
let server, origin;
const wool = BLOCKS.map((b, id) => ({ b, id }))
  .filter(({ b }) => !b.internal && /(?:^|_)wool$/.test(b.key))
  .map(({ id }) => id);
const water = BLOCKS.map((b, id) => ({ b, id }))
  .filter(({ b }) => /^water(?:_flow_\d+)?$/.test(b.key))
  .map(({ id }) => id);
const tiles = [...wool, ...water].flatMap((id) =>
  [0, 1, 2].map((face) => (BLOCKS[id].artTile ?? id * 3) + face),
);
const reference = JSON.parse(
  readFileSync("reference/rendered-art-2.7.18.json"),
);
test.beforeAll(async () => {
  server = createServer((request, response) => {
    response.setHeader("Content-Type", "text/html");
    const file =
      request.url === "/before.html"
        ? process.env.DCSMCRAFT_BEFORE_HTML
        : "dist/DCSMCRAFT-Standalone.html";
    createReadStream(file).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});
async function boot(page, before) {
  await page.goto(origin + (before ? "/before.html" : "/after.html"));
  await page
    .getByRole("button", { name: "Create a world", exact: true })
    .click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[name=difficulty]").selectOption("peaceful");
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.active && dcsmcraft.running);
  await page.evaluate(
    ({ B, wool }) => {
      const g = dcsmcraft;
      g.pause();
      g.ui.play();
      g.entities = [];
      g.drops = [];
      g.inventory.slots.fill(null);
      for (let x = -10; x <= 10; x++)
        for (let z = -5; z <= 10; z++) {
          g.world.set(x, 199, z, B.stone);
          for (let y = 200; y < 205; y++) g.world.set(x, y, z, B.air);
        }
      wool.forEach((id, i) => {
        g.world.set(i - 8, 200, -2, id);
        g.world.set(i - 8, 201, -2, id);
      });
      for (let x = -7; x <= 7; x++)
        for (let z = 0; z <= 4; z++) g.world.set(x, 200, z, B.water);
      for (let i = 1; i <= 8; i++)
        g.world.set(i - 5, 200, 6, B["water_flow_" + i]);
      Object.assign(g.player, {
        x: 0.5,
        y: 203,
        z: 9,
        yaw: 0,
        pitch: -0.45,
        vx: 0,
        vy: 0,
        vz: 0,
        onGround: true,
      });
      g.renderer.loadAround(g.player.x, g.player.z, 2, 9);
      g.ui.updateHotbar();
    },
    { B, wool },
  );
  await page.waitForTimeout(1000);
}
async function snapshot(page, pack) {
  return page.evaluate(
    async ({ pack, tiles, cols }) => {
      const g = dcsmcraft;
      g.settings.texturePack = pack;
      g.renderer.applyGraphics();
      const canvas = g.renderer.atlas.canvas,
        ctx = canvas.getContext("2d");
      const protectedPixels = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const hex = async (bytes) =>
        Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          (n) => n.toString(16).padStart(2, "0"),
        ).join("");
      const hashes = {};
      for (const tile of tiles) {
        const x = (tile % cols) * 16,
          y = Math.floor(tile / cols) * 16;
        hashes[tile] = await hex(ctx.getImageData(x, y, 16, 16).data);
        for (let row = y; row < y + 16; row++)
          protectedPixels.data.fill(
            0,
            (row * canvas.width + x) * 4,
            (row * canvas.width + x + 16) * 4,
          );
      }
      return { hashes, protectedHash: await hex(protectedPixels.data) };
    },
    { pack, tiles, cols: ATLAS_COLS },
  );
}
test("all wool colors and source/flowing water restore earlier pixels; every other atlas pixel and Classic remain unchanged", async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.DCSMCRAFT_BEFORE_HTML,
    "Set DCSMCRAFT_BEFORE_HTML to the unmodified 2.8.6 audit HTML for comparison.",
  );
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({
        graphics: 1,
        renderDistance: 2,
        distantTerrain: false,
        volume: 0,
        frameLimit: 30,
        ambientSounds: false,
        musicEnabled: false,
      }),
    ),
  );
  const previous = {};
  await boot(page, true);
  for (const pack of ["classic", "renewed", "supplied"])
    previous[pack] = await snapshot(page, pack);
  await snapshot(page, "renewed");
  await page.screenshot({ path: testInfo.outputPath("wool-water-before.png") });
  await boot(page, false);
  const report = [];
  expect(wool).toHaveLength(16);
  expect(water).toHaveLength(9);
  for (const pack of ["classic", "renewed", "supplied"]) {
    const next = await snapshot(page, pack);
    expect(next.protectedHash, `${pack}: all non-wool/water atlas pixels`).toBe(
      previous[pack].protectedHash,
    );
    for (const tile of tiles)
      expect(next.hashes[tile], `${pack}: restored tile ${tile}`).toBe(
        reference.packs[pack].hashes[tile],
      );
    if (pack === "classic") expect(next).toEqual(previous[pack]);
    report.push({
      pack,
      restoredFaces: tiles.length,
      otherPixelsUnchanged: true,
    });
  }
  await snapshot(page, "renewed");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: testInfo.outputPath("wool-water-after.png") });
  await testInfo.attach("restoration-report", {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
  expect(errors).toEqual([]);
});
