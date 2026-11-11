import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { SKINS } from "../../src/skins.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html");
test.use({ trace: "off" });
let server, origin;
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
const out = "/workspace/artifacts/interaction-polish-2711/grips";
mkdirSync(out, { recursive: true });

test("wardrobe skins match F5 arms; item-only blocks retain their mount and camera clearance without reserving an invisible hand", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Shader Error|GL_INVALID|WebGLProgram/.test(m.text()))
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
    r.request().url().endsWith("/skin-grip.html")
      ? r.continue()
      : (external.push(r.request().url()), r.abort()),
  );
  await page.goto(origin + "/skin-grip.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(
    () => dcsmcraft.running && dcsmcraft.ui.screen === "play",
  );
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.entities = [];
    g.ui.play();
    Object.assign(g.player, {
      y: 200,
      vy: 0,
      yaw: 0,
      pitch: 0,
      onGround: true,
    });
    g.inventory.selected = 0;
    g.inventory.slots[0] = { id: "stone", count: 64 };
    for (const selector of ["#toast", "#cycle-banner"])
      document
        .querySelector(selector)
        ?.style.setProperty("visibility", "hidden");
  });
  for (const id of Object.keys(SKINS)) {
    await page.evaluate(() => dcsmcraft.ui.skins());
    await page.locator(`[data-skin=${id}]`).click();
    await expect(page.locator(`[data-skin=${id}]`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const state = await page.evaluate((id) => {
      const g = dcsmcraft,
        r = g.renderer;
      g.ui.play();
      r.setHeld("stone", g.inventory.held);
      r.setArmor([]);
      r.animator.reset();
      r.animator.equip = 0;
      const draw = (cameraMode = 0) =>
        r.draw({
          player: g.player,
          playing: true,
          cameraMode,
          elapsed: g.elapsed,
          animating: false,
        });
      draw(2);
      const f5 = r.playerModel.userData;
      const match =
        r.handRig.skin.color.equals(
          f5.forearms[1].children[1].material.color,
        ) &&
        r.handRig.sleeve.color.equals(f5.arms[1].children[0].material.color);
      let attached = true,
        near = true;
      for (const kind of ["attack", "mine", "place", "use"])
        for (let n = 0; n <= 10; n++) {
          r.animator.trigger(kind);
          r.animator.action.age = (r.animator.action.duration * n) / 10;
          draw();
          r.handRig.root.updateMatrixWorld(true);
          attached &&= r.heldMesh.parent === r.handRig.grip;
          near &&= r.handRig.viewBounds.max.z <= -0.1099;
        }
      g.inventory.equipment[1] = { id: "diamond_chestplate", count: 1 };
      r.setArmor(g.inventory.equipment);
      draw();
      const armor =
        r.handRig.shoulder.visible &&
        r.handRig.sleeve.color.equals(f5.arms[1].children[0].material.color);
      g.inventory.equipment[1] = { id: "stone", count: 1 };
      r.setArmor(g.inventory.equipment);
      const invalid = !r.handRig.shoulder.visible;
      g.inventory.equipment[1] = null;
      r.setArmor([]);
      r.animator.reset();
      draw();
      return {
        match,
        armHidden: !r.handRig.armVisuals.visible,
        attached,
        near,
        armor,
        invalid,
        skin: g.settings.skin,
        gloved: r.handRig.glove.userData.texturedGlove,
        error: r.gl.getContext().getError(),
      };
    }, id);
    expect(state).toEqual({
      match: true,
      armHidden: true,
      attached: true,
      near: true,
      armor: true,
      invalid: true,
      skin: id,
      gloved: ["dante", "vergil", "criminal"].includes(id),
      error: 0,
    });
    if (["devin", "hero", "clown", "dante", "criminal"].includes(id))
      await page.screenshot({ path: `${out}/${id}-block.png` });
  }
  await page.evaluate(() => dcsmcraft.save());
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  expect(await page.evaluate(() => dcsmcraft.settings.skin)).toBe("vergil");
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(
    () => dcsmcraft.running && dcsmcraft.ui.screen === "play",
  );
  expect(
    await page.evaluate(() => ({
      skin: dcsmcraft.settings.skin,
      item: dcsmcraft.inventory.held?.id,
      count: dcsmcraft.inventory.held?.count,
    })),
  ).toEqual({ skin: "vergil", item: "stone", count: 64 });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
