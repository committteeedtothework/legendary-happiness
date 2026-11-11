import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { SKINS } from "../../src/skins.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html");
const out = "/workspace/artifacts/skin-overhaul-278";
mkdirSync(out, { recursive: true });
let server, origin;
test.use({ trace: "off" });
test.beforeAll(async () => {
  server = createServer((req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  server?.closeAllConnections();
  if (server) await new Promise((r) => server.close(r));
});
async function boot(page) {
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (
      /Shader Error|GL_INVALID|WebGLProgram|Too many active WebGL/.test(
        m.text(),
      )
    )
      errors.push(m.text());
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem("dcsmcraft-settings"))
      localStorage.setItem(
        "dcsmcraft-settings",
        JSON.stringify({
          graphics: 1,
          renderDistance: 2,
          distantTerrain: false,
          volume: 0,
          frameLimit: 30,
        }),
      );
  });
  await page.route("**/*", (r) =>
    r
      .request()
      .url()
      .startsWith(origin + "/")
      ? r.continue()
      : (external.push(r.request().url()), r.abort()),
  );
  await page.goto(origin + "/skin-wardrobe.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  return { errors, external };
}
test("all eleven skins render in a live shared-rig preview, cycle both ways, rotate with controls/drag and retain saved selection", async ({
  page,
}) => {
  test.setTimeout(120000);
  const evidence = await boot(page);
  await page.locator("[data-action=skins]").click();
  const original = await page.evaluate(() => {
    window.originalPreview = dcsmcraft.ui.skinPreview;
    return dcsmcraft.settings.skin;
  });
  for (const [id, s] of Object.entries(SKINS)) {
    await page.locator(`[data-skin=${id}]`).click();
    await expect(page.locator("#skin-name")).toHaveText(s.name);
    await expect(page.locator(`[data-skin=${id}]`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.waitForFunction(
      (id) =>
        dcsmcraft.ui.skinPreview?.id === id &&
        dcsmcraft.ui.skinPreview.gl.info.render.calls > 0,
      id,
    );
    const state = await page.evaluate(() => {
      const u = dcsmcraft.ui.skinPreview,
        p = u.model.userData;
      return {
        sameContext: u === window.originalPreview,
        id: u.id,
        model: p.skin,
        saved: JSON.parse(localStorage.getItem("dcsmcraft-settings")).skin,
        head: p.head.children[0].geometry.parameters,
        body: p.body.geometry.parameters,
        canvasCount: document.querySelectorAll("#skin-preview canvas").length,
        draws: u.gl.info.render.calls,
        geometries: u.gl.info.memory.geometries,
        error: u.gl.getContext().getError(),
      };
    });
    expect(state).toMatchObject({
      sameContext: true,
      id,
      model: id,
      saved: id,
      canvasCount: 1,
      error: 0,
      head: { width: 0.45, height: 0.45, depth: 0.45 },
      body: { width: 0.45, height: 0.675, depth: 0.225 },
    });
    expect(state.draws).toBeLessThanOrEqual(21);
    expect(state.geometries).toBeLessThanOrEqual(21);
    await page.screenshot({ path: `${out}/${id}-menu.png` });
  }
  // Vergil is last: next wraps to Devin, previous returns to Vergil.
  await page.getByRole("button", { name: "Next skin", exact: true }).click();
  await expect(page.locator("#skin-name")).toHaveText("Devin The Hero");
  await page
    .getByRole("button", { name: "Previous skin", exact: true })
    .click();
  await expect(page.locator("#skin-name")).toHaveText("Vergil");
  const angle = await page.evaluate(() => dcsmcraft.ui.skinPreview.yaw);
  await page
    .getByRole("button", { name: "Turn preview right", exact: true })
    .click();
  expect(await page.evaluate(() => dcsmcraft.ui.skinPreview.yaw)).toBeCloseTo(
    angle + Math.PI / 4,
  );
  await page
    .getByRole("button", { name: "Turn preview left", exact: true })
    .click();
  expect(await page.evaluate(() => dcsmcraft.ui.skinPreview.yaw)).toBeCloseTo(
    angle,
  );
  const box = await page.locator("#skin-preview canvas").boundingBox();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.4, {
    steps: 10,
  });
  await page.mouse.up();
  expect(
    await page.evaluate(() => dcsmcraft.ui.skinPreview.yaw),
  ).toBeGreaterThan(angle + 0.5);
  await page.locator("[data-skin=vergil]").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#skin-name")).toHaveText("Devin The Hero");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#skin-name")).toHaveText("Vergil");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  expect(
    await page.evaluate(() => ({
      preview: dcsmcraft.ui.skinPreview,
      disposed: window.originalPreview.disposed,
      canvases: document.querySelectorAll("#skin-preview canvas").length,
    })),
  ).toEqual({ preview: null, disposed: true, canvases: 0 });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=skins]").click();
  await expect(page.locator("[data-skin=vergil]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#skin-name")).toHaveText("Vergil");
  expect(original).toBeTruthy();
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});
test("wardrobe is responsive, respects reduced motion and releases its rendering resources every time it closes", async ({
  page,
}) => {
  test.setTimeout(120000);
  const evidence = await boot(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [width, height] of [
    [1280, 800],
    [960, 540],
    [620, 760],
    [390, 844],
    [360, 640],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => dcsmcraft.ui.skins());
    await expect(page.locator("#skin-preview canvas")).toBeVisible();
    const layout = await page.evaluate(() => {
      const el = document.querySelector(".wardrobe"),
        r = el.getBoundingClientRect(),
        c = document
          .querySelector("#skin-preview canvas")
          .getBoundingClientRect(),
        p = dcsmcraft.ui.skinPreview;
      return {
        left: r.left,
        right: r.right,
        scrollWidth: el.scrollWidth,
        width: el.clientWidth,
        canvasWidth: c.width,
        canvasHeight: c.height,
        cameraAspect: p.camera.aspect,
        idleTime: p.model.userData.motionTime || 0,
      };
    });
    expect(layout.left).toBeGreaterThanOrEqual(0);
    expect(layout.right).toBeLessThanOrEqual(width);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width + 2);
    expect(layout.canvasWidth).toBeGreaterThan(200);
    expect(layout.cameraAspect).toBeCloseTo(
      layout.canvasWidth / layout.canvasHeight,
      1,
    );
    expect(layout.idleTime).toBe(0);
    await page.locator("[data-skin=dante]").click();
    await page.screenshot({
      path: `${out}/responsive-${width}x${height}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Done", exact: true }).click();
  }
  for (let n = 0; n < 8; n++) {
    await page.evaluate(() => dcsmcraft.ui.skins());
    await page.evaluate(() => (window.lastPreview = dcsmcraft.ui.skinPreview));
    await page.getByRole("button", { name: "Done", exact: true }).click();
    expect(
      await page.evaluate(
        () =>
          window.lastPreview.disposed &&
          window.lastPreview.gl.getContext().isContextLost(),
      ),
    ).toBe(true);
  }
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});

test("selected outfits use the new model in actual F5 views, retain held-item attachment and survive a saved-world reload", async ({
  page,
}) => {
  test.setTimeout(120000);
  const evidence = await boot(page);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[name=difficulty]").selectOption("peaceful");
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.active);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.entities = [];
    g.ui.play();
    g.inventory.selected = 0;
    g.inventory.slots[0] = null;
    Object.assign(g.player, {
      y: g.player.y + 4,
      vy: 0,
      pitch: 0.12,
      yaw: 0,
      onGround: true,
    });
    for (const selector of ["#toast", "#cycle-banner"])
      document
        .querySelector(selector)
        ?.style.setProperty("visibility", "hidden");
  });
  await page.keyboard.press("F5");
  await page.waitForFunction(() => dcsmcraft.cameraMode === 1);
  await page.keyboard.press("F5");
  await page.waitForFunction(
    () => dcsmcraft.cameraMode === 2 && dcsmcraft.renderer.playerModel?.visible,
  );
  for (const skin of ["devin", "clown", "dante", "vergil"]) {
    await page.evaluate(() => dcsmcraft.ui.skins());
    await page.locator(`[data-skin=${skin}]`).click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page.evaluate(() => dcsmcraft.ui.play());
    await page.waitForFunction(
      (id) => dcsmcraft.renderer.playerModel?.userData.skin === id,
      skin,
    );
    const state = await page.evaluate(() => {
      const r = dcsmcraft.renderer,
        u = r.playerModel.userData;
      return {
        visible: r.playerModel.visible,
        head: u.head.children[0].geometry.parameters.width,
        skinMap: r.handRig.skin.map === u.forearms[1].children[1].material.map,
        sleeveMap: r.handRig.sleeve.map === u.arms[1].children[0].material.map,
        error: r.gl.getContext().getError(),
      };
    });
    expect(state).toEqual({
      visible: true,
      head: 0.45,
      skinMap: true,
      sleeveMap: true,
      error: 0,
    });
    await page.screenshot({ path: `${out}/${skin}-f5.png` });
  }
  await page.evaluate(() => dcsmcraft.save());
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(() => dcsmcraft.active);
  expect(await page.evaluate(() => dcsmcraft.settings.skin)).toBe("vergil");
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.play();
  });
  await page.keyboard.press("F5");
  await page.waitForFunction(
    () => dcsmcraft.renderer.playerModel?.userData.skin === "vergil",
  );
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});
