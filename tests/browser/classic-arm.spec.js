import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { ITEMS } from "../../src/data.js";

const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
const out = "/workspace/artifacts/classic-arm-playtest";
mkdirSync(out, { recursive: true });

test("offline classic arms render empty-hand, tools, placement, eating, gloved pistols and swimming without loose fingers or wrist gaps", async ({
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
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({
        graphics: 1,
        renderDistance: 2,
        distantTerrain: false,
        musicEnabled: false,
        volume: 0,
        frameLimit: 30,
      }),
    ),
  );
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/classic-arm.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : (external.push(r.request().url()), r.abort()),
  );
  await page.goto("/classic-arm.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.active);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.ui.play();
    g.entities = [];
    Object.assign(g.player, {
      y: 200,
      pitch: 0,
      yaw: 0,
      onGround: true,
      vy: 0,
    });
    document
      .querySelectorAll(".toast,.day-banner")
      .forEach((e) => (e.style.visibility = "hidden"));
  });
  for (const [id, kind, skin] of [
    [null, "attack", "hero"],
    ["diamond_sword", "attack", "hero"],
    ["planks", "place", "hero"],
    ["flint_and_steel", "use", "hero"],
    ["apple", "eat", "hero"],
    ["matthew_dual_pistols", "fire", "dante"],
    [null, "swim", "vergil"],
  ]) {
    const state = await page.evaluate(
      ({ id, kind, skin, tool }) => {
        const g = dcsmcraft,
          r = g.renderer;
        g.inventory.slots[0] = id ? { id, count: 1 } : null;
        g.settings.skin = skin;
        r.setHeld(id, g.inventory.slots[0]);
        r.setArmor([]);
        r.animator.reset();
        r.animator.equip = 0;
        Object.assign(g.player, {
          inWater: kind === "swim",
          underwater: kind === "swim",
          onGround: kind !== "swim",
          flying: false,
        });
        if (kind === "swim") {
          for (let n = 0; n < 60; n++)
            r.animator.step(1 / 60, g.player, { moving: true });
        } else {
          r.animator.swim = 0;
          r.animator.trigger(kind, tool);
          r.animator.action.age = r.animator.action.duration * 0.45;
        }
        r.pistolKick = kind === "fire" ? 0.16 : 0;
        r.draw({
          player: g.player,
          playing: true,
          elapsed: g.elapsed,
          animating: false,
        });
        const arms = [];
        for (const rig of [r.handRig, r.leftHandRig].filter(
          (v) => v.root.visible,
        )) {
          rig.root.updateMatrixWorld(true);
          const visible = [];
          for (const mesh of [rig.forearm, rig.cuff, rig.glove])
            if (mesh.visible) visible.push(mesh.name);
          const a = rig.arm.hand.clone().set(0, 0.5, 0),
            b = a.clone().set(0, -0.5, 0);
          arms.push({
            visible,
            near: rig.viewBounds.max.z,
            seam: rig.forearm
              .localToWorld(a)
              .distanceTo(rig.cuff.localToWorld(b)),
            wristMeshes: rig.wrist.children.filter((v) => v.isMesh).length,
            gloved: rig.glove.userData.texturedGlove,
          });
        }
        return { arms, error: r.gl.getContext().getError() };
      },
      { id, kind, skin, tool: ITEMS[id]?.tool },
    );
    for (const arm of state.arms) {
      expect(arm.visible).toHaveLength(arm.gloved ? 3 : 2);
      expect(arm.wristMeshes).toBe(0);
      expect(arm.seam).toBeLessThan(1e-10);
      expect(arm.near).toBeLessThanOrEqual(-0.1099);
      expect(arm.gloved).toBe(["dante", "vergil"].includes(skin));
    }
    expect(state.arms).toHaveLength(kind === "fire" || kind === "swim" ? 2 : 1);
    expect(state.error).toBe(0);
    await page.screenshot({ path: `${out}/${id || kind}.png` });
  }
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
