import { test, expect } from "@playwright/test";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Stream the real 134 MB offline file, rather than duplicating it through the
// browser protocol or retaining its entire script in a Playwright trace.
test.use({ trace: "off" });
let server, packagedOrigin;
test.beforeAll(async () => {
  server = createServer((request, response) => {
    response.setHeader("Content-Type", "text/html");
    createReadStream("dist/DCSMCRAFT-Standalone.html").pipe(response);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  packagedOrigin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test("packaged HTML launches directly from a file where browser policy permits", async ({ page }) => {
  try {
    await page.goto(pathToFileURL(resolve("dist/DCSMCRAFT-Standalone.html")).href);
  } catch (error) {
    if (/ERR_BLOCKED_BY_ADMINISTRATOR/.test(error.message))
      test.skip(true, "Managed browser policy blocks file navigation before game load; exact HTML is tested over loopback.");
    throw error;
  }
  await page.getByRole("button", { name: "Create New World", exact: true }).click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.getByRole("button", { name: "Create New World" }).click();
  await page.waitForFunction(() => dcsmcraft.active && dcsmcraft.running);
});

for (const target of ["production web", "packaged HTML"]) {
  test(`${target}: create, move, save, reload and return through real menus`, async ({
    page,
  }) => {
    const errors = [],
      external = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (
        /^https?:/.test(r.url()) &&
        !r.url().startsWith("http://127.0.0.1:5173/") &&
        !r.url().startsWith(packagedOrigin + "/")
      )
        external.push(r.url());
    });
    await page.addInitScript(() =>
      localStorage.setItem(
        "dcsmcraft-settings",
        JSON.stringify({
          renderDistance: 2,
          graphics: 1,
          distantTerrain: false,
          volume: 0,
          musicEnabled: false,
          frameLimit: 30,
        }),
      ),
    );
    const url = target === "packaged HTML" ? packagedOrigin + "/" : "/";
    await page.goto(url);
    await page
      .getByRole("button", { name: "Create New World", exact: true })
      .click();
    await page.locator("[name=name]").fill(`Clean ${target}`);
    await page.locator("[name=seed]").fill("Wildflower");
    await page.getByRole("button", { name: "Create New World" }).click();
    await page.waitForFunction(() => dcsmcraft.active && dcsmcraft.running);
    const before = await page.evaluate(() => ({
      x: dcsmcraft.player.x,
      z: dcsmcraft.player.z,
    }));
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(600);
    await page.keyboard.up("KeyW");
    expect(
      await page.evaluate(
        (p) => Math.hypot(dcsmcraft.player.x - p.x, dcsmcraft.player.z - p.z),
        before,
      ),
    ).toBeGreaterThan(0.1);
    await page.keyboard.press("KeyE");
    await expect(page.locator(".inventory-window")).toBeVisible();
    const id = await page.evaluate(async () => {
      dcsmcraft.player.xp = 23;
      await dcsmcraft.save();
      return dcsmcraft.id;
    });
    await page.reload();
    await page.locator("[data-action=load]").first().click();
    await page.waitForFunction(() => dcsmcraft.active && dcsmcraft.running);
    expect(
      await page.evaluate(() => ({
        id: dcsmcraft.id,
        xp: dcsmcraft.player.xp,
      })),
    ).toEqual({ id, xp: 23 });
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", { name: "Game Menu" }),
    ).toBeVisible();
    await page.locator("[data-action=quit]").click();
    await expect(
      page.getByRole("button", { name: "Create New World", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}
