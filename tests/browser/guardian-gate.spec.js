import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { World } from "../../src/world.js";
import { B } from "../../src/data.js";
import { relicSite } from "../../src/relic.js";
const p = relicSite(new World("Wildflower"));
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
async function holdSword(page) {
  await page.evaluate((p) => {
    const g = dcsmcraft;
    Object.assign(g.player, {
      x: p.x + 0.5,
      y: p.y,
      z: p.z + 2.8,
      yaw: 0,
      pitch: Math.atan2(-0.12, 2.8),
      vx: 0,
      vy: 0,
      vz: 0,
      fallStart: p.y,
      health: 20,
      flying: false,
    });
    g.inventory.slots[0] = null;
    g.inventory.selected = 0;
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
    g.renderer.gl.domElement.dispatchEvent(
      new MouseEvent("mousedown", { button: 0, bubbles: true }),
    );
  }, p);
}
async function kill(page, indices) {
  return page.evaluate(
    ({ p, indices }) => {
      const g = dcsmcraft;
      g.pause();
      g.ui.play();
      g.inventory.selected = 0;
      g.inventory.slots[0] = {
        id: "hellfire_sword",
        count: 1,
        durability: 2031,
      };
      for (const index of indices) {
        const e = g.entities.find(
          (e) =>
            e.type === "devin_guardian" &&
            e.guardianIndex === index &&
            e.hp > 0,
        );
        if (!e) throw Error("Missing live Guardian " + index);
        for (const [i, other] of g.entities
          .filter((v) => v.type === "devin_guardian" && v !== e && v.hp > 0)
          .entries())
          Object.assign(other, { x: p.x - 14 - i * 4, y: p.y, z: p.z - 12 });
        Object.assign(e, { x: p.x + 11, y: p.y, z: p.z + 4 });
        let hits = 0;
        while (e.hp > 0 && hits++ < 60) {
          Object.assign(g.player, {
            x: e.x,
            y: e.y,
            z: e.z + 2.3,
            vx: 0,
            vy: 0,
            vz: 0,
            yaw: 0,
            pitch: 0,
          });
          g.target = null;
          g.lastAttack = g.elapsed - 2;
          if (g.targetEntity()?.id !== e.id)
            throw Error("Incorrect Guardian target");
          g.tryAttack();
        }
        if (e.hp > 0) throw Error("Guardian survived actual melee");
      }
      return g.world.settlements["devin-temple"].defeated;
    },
    { p, indices },
  );
}
test("offline temple sword rejects Creative, Peaceful and two saved victories; the last real Guardian death enables a unique 30-second claim", async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors = [];
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
        volume: 0,
        ambientVolume: 0,
        musicEnabled: false,
      }),
    ),
  );
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/guardian.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : r.abort(),
  );
  await page.goto("/guardian.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").first().click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate((p) => {
    const g = dcsmcraft;
    g.pause();
    g.entities = [];
    Object.assign(g.player, {
      x: p.x + 0.5,
      y: p.y,
      z: p.z + 12,
      health: 20,
      vx: 0,
      vy: 0,
      vz: 0,
      fallStart: p.y,
      flying: false,
    });
    g.renderer.loadAround(g.player.x, g.player.z, 2, 5);
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
  }, p);
  await page.waitForFunction(
    () =>
      dcsmcraft.entities.filter((e) => e.type === "devin_guardian" && e.hp > 0)
        .length === 3,
  );
  await holdSword(page);
  await page.waitForTimeout(650);
  expect(
    await page.evaluate(() => ({
      progress: dcsmcraft.extraction,
      claimed: dcsmcraft.world.relicClaimed,
    })),
  ).toEqual({ progress: null, claimed: false });
  expect(
    await page.evaluate(({ p, B }) => dcsmcraft.world.get(p.x, p.y, p.z + 7), {
      p,
      B,
    }),
  ).toBe(B.temple_seal);
  await page.evaluate(() => {
    dcsmcraft.mode = "survival";
    dcsmcraft.difficulty = "peaceful";
  });
  await page.waitForTimeout(650);
  expect(await page.evaluate(() => dcsmcraft.extraction)).toBeNull();
  expect((await kill(page, [0, 1])).length).toBe(2);
  await holdSword(page);
  await page.waitForTimeout(650);
  expect(await page.evaluate(() => dcsmcraft.extraction)).toBeNull();
  const id = await page.evaluate(async () => {
    dcsmcraft.pause();
    await dcsmcraft.save();
    return dcsmcraft.id;
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.evaluate((id) => dcsmcraft.loadWorld(id), id);
  await page.waitForFunction(() => dcsmcraft.active);
  await holdSword(page);
  await page.waitForTimeout(650);
  expect(await page.evaluate(() => dcsmcraft.extraction)).toBeNull();
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.entities.filter(
          (e) => e.type === "devin_guardian" && e.hp > 0,
        ).length,
    ),
  ).toBe(1);
  expect((await kill(page, [2])).length).toBe(3);
  await page.evaluate(
    ({ p, B }) => {
      const g = dcsmcraft;
      g.mode = "survival";
      g.difficulty = "normal";
      g.inventory.slots[0] = { id: "cinder_sigil", count: 1 };
      g.inventory.selected = 0;
      Object.assign(g.player, { x: p.x + 2.5, y: p.y, z: p.z + 34.5 });
      g.target = { x: p.x + 2, y: p.y + 1, z: p.z + 32, id: B.runestone };
      g.use();
    },
    { p, B },
  );
  expect(
    await page.evaluate(
      () => dcsmcraft.world.settlements["devin-temple"].attuned,
    ),
  ).toBe(true);
  await holdSword(page);
  await page.waitForFunction(() => dcsmcraft.extraction?.progress > 0);
  await page.waitForFunction(() => dcsmcraft.world.relicClaimed, null, {
    timeout: 40000,
  });
  await page.evaluate(async () => {
    dcsmcraft.mouseDown = false;
    dcsmcraft.pause();
    await dcsmcraft.save();
  });
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.inventory.slots.filter((s) => s?.id === "devin_sword").length,
    ),
  ).toBe(1);
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.evaluate((id) => dcsmcraft.loadWorld(id), id);
  await page.waitForFunction(() => dcsmcraft.active);
  await page.evaluate(() => dcsmcraft.pause());
  expect(await page.evaluate(() => dcsmcraft.world.relicClaimed)).toBe(true);
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.inventory.slots.filter((s) => s?.id === "devin_sword").length,
    ),
  ).toBe(1);
  expect(
    await page.evaluate(() => dcsmcraft.renderer.gl.getContext().getError()),
  ).toBe(0);
  expect(errors).toEqual([]);
});
