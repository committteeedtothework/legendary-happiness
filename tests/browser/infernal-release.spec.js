import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { B, MOB_INFO } from "../../src/data.js";
import { World } from "../../src/world.js";
import { infernalSite } from "../../src/infernal-world.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
async function boot(page) {
  const errors = [];
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
          renderDistance: 2,
          graphics: 1,
          ambientVolume: 0,
          musicEnabled: false,
          volume: 0,
        }),
      );
  });
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/infernal.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : r.abort(),
  );
  await page.goto("/infernal.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  return errors;
}
async function create(page) {
  await page.locator("[data-action=create]").first().click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.play();
    dcsmcraft.pointerLockFallback = true;
  });
}
async function enterCinderworld(page) {
  return page.evaluate((B) => {
    const g = dcsmcraft,
      f = { x: 8, y: 180, z: 8, axis: "x" };
    g.pause();
    for (let u = 0; u < 4; u++)
      for (let v = 0; v < 5; v++)
        g.world.set(
          f.x + u,
          f.y + v,
          f.z,
          u === 0 || u === 3 || v === 0 || v === 4 ? B.obsidian : B.air,
        );
    g.inventory.slots[0] = { id: "flint_and_steel", count: 1, durability: 64 };
    g.inventory.selected = 0;
    g.target = {
      x: 8,
      y: 181,
      z: 8,
      id: B.obsidian,
      normal: { x: 1, y: 0, z: 0 },
    };
    g.lastPlace = -10;
    g.use();
    const lit = Object.keys(g.world.portals).length;
    g.travelDimension(f);
    g.pause();
    g.ui.play();
    g.pointerLockFallback = true;
    return {
      lit,
      dimension: g.dimension,
      generation: g.world.generationVersion,
    };
  }, B);
}
function allSites() {
  const w = new World("Wildflower", {}, "cinderwild"),
    out = {};
  for (let z = -3; z <= 3; z++)
    for (let x = -3; x <= 3; x++) {
      const s = infernalSite(w, x, z);
      out[s.kind] ||= s;
    }
  return out;
}
test("offline standalone Vergil wardrobe persists, F5 renders his coat, and real obsidian portal enters revamped Cinderworld", async ({
  page,
}) => {
  const errors = await boot(page);
  await page.locator("[data-action=skins]").click();
  await expect(page.locator(".skin-card")).toHaveCount(11);
  await page.locator("[data-skin=vergil]").click();
  await expect(page.locator("[data-skin=vergil]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.5.0-vergil-wardrobe.png",
  });
  await page.reload();
  await page.waitForFunction(() => dcsmcraft?.initialized);
  expect(await page.evaluate(() => dcsmcraft.settings.skin)).toBe("vergil");
  await create(page);

  await page.evaluate(() => {
    const g = dcsmcraft;
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
  });
  await page.keyboard.press("F5");
  await page.keyboard.press("F5");
  await page.evaluate(() => {
    const g = dcsmcraft;
    const x = Math.floor(g.player.x) + 12,
      z = Math.floor(g.player.z) + 12;
    for (let dx = -5; dx <= 5; dx++)
      for (let dz = -5; dz <= 5; dz++) g.world.set(x + dx, 200, z + dz, 1);
    Object.assign(g.player, {
      x: x + 0.5,
      y: 201,
      z: z + 0.5,
      yaw: 0,
      pitch: 0,
      flying: false,
      fallStart: 201,
    });
    g.ui.root.querySelector("#cycle-banner")?.classList.remove("show");
  });
  await page.waitForFunction(
    () => dcsmcraft.renderer.playerModel?.userData.skin === "vergil",
  );
  expect(
    await page.evaluate(
      () => dcsmcraft.renderer.playerModel.userData.coat.length,
    ),
  ).toBe(2);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.5.0-vergil-f5.png",
  });
  expect(await enterCinderworld(page)).toEqual({
    lit: 1,
    dimension: "cinderwild",
    generation: 11,
  });
  expect(errors).toEqual([]);
});
test("all three monumental Cinderworld structures render with real vaults and new articulated monster types", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors = await boot(page);
  await create(page);
  await enterCinderworld(page);
  for (const site of Object.values(allSites())) {
    await page.evaluate((s) => {
      const g = dcsmcraft;
      g.pause();
      g.settings.renderDistance = 8;
      Object.assign(g.player, {
        x: s.x + 46,
        y: s.y + 47,
        z: s.z + 74,
        yaw: Math.atan2(46, 74),
        pitch: -0.2,
        flying: true,
        vx: 0,
        vy: 0,
        vz: 0,
      });
      g.ui.play();
      g.running = true;
      g.pointerLockFallback = true;
    }, site);
    await expect
      .poll(
        () =>
          page.evaluate(
            (s) =>
              [...dcsmcraft.renderer.meshes.keys()].filter((k) => {
                const [x, z] = k.split(",").map(Number);
                return (
                  Math.abs(x - Math.floor(s.x / 16)) < 3 &&
                  Math.abs(z - Math.floor(s.z / 16)) < 3
                );
              }).length,
            site,
          ),
        { timeout: 45000 },
      )
      .toBeGreaterThan(9);
    await expect
      .poll(
        () =>
          page.evaluate(
            (s) =>
              dcsmcraft.entities.filter((e) => e.encounter === s.id).length,
            site,
          ),
        { timeout: 20000 },
      )
      .toBe(6);
    await expect
      .poll(() => page.evaluate(() => dcsmcraft.renderer.meshes.size), {
        timeout: 45000,
      })
      .toBeGreaterThan(65);
    await page.evaluate(() =>
      dcsmcraft.ui.root
        .querySelector("#cycle-banner")
        ?.classList.remove("show"),
    );
    const result = await page.evaluate((s) => {
      const g = dcsmcraft;
      g.world.get(s.x, s.y + 1, s.z - 15);
      const c = g.world.containers[`${s.x},${s.y + 1},${s.z - 15}`];
      return {
        loot: c.slots.filter(Boolean).map((v) => v.id),
        types: [
          ...new Set(
            g.entities.filter((e) => e.encounter === s.id).map((e) => e.type),
          ),
        ],
        gl: g.renderer.gl.getContext().getError(),
      };
    }, site);
    expect(result.loot).toContain("cinder_sigil");
    expect(result.types.sort()).toEqual([
      "dread_knight",
      "magma_maw",
      "soul_reaver",
    ]);
    expect(result.gl).toBe(0);
    await page.screenshot({
      path: `/workspace/artifacts/DCSMCRAFT-v1.5.0-${site.kind}.png`,
    });
  }
  await page.evaluate((s) => {
    const g = dcsmcraft;
    g.pause();
    g.settings.renderDistance = 3;
    for (const [i, type] of [
      "dread_knight",
      "soul_reaver",
      "magma_maw",
    ].entries()) {
      const e = g.entities.find((e) => e.encounter === s.id && e.type === type);
      Object.assign(e, {
        x: s.x + (i - 1) * 4,
        y: s.y + 1,
        z: s.z + 14,
        yaw: Math.PI,
      });
    }
    Object.assign(g.player, {
      x: s.x,
      y: s.y + 2,
      z: s.z + 23,
      yaw: 0,
      pitch: -0.13,
      fallStart: s.y + 2,
    });
    g.ui.play();
    g.pointerLockFallback = true;
    g.inventory.slots[g.inventory.selected] = null;
  }, Object.values(allSites()).at(-1));
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.5.0-infernal-defenders.png",
  });
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.pause();
  });
  await page
    .getByRole("button", { name: "Cinderworld Expedition", exact: true })
    .click();
  await expect(page.locator(".dialog")).toContainText("Cinder Sigil");
  await expect(page.locator(".dialog")).toContainText("six infernal regions");
  expect(errors).toEqual([]);
});
test("Survival vault lock blocks opening and mining, melee clears six guards, Sigil enters temple, and bulletproof Guardians and saves work", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors = await boot(page);
  await create(page);
  await enterCinderworld(page);
  const site = allSites().citadel;
  await page.evaluate((s) => {
    const g = dcsmcraft;
    g.mode = "survival";
    g.difficulty = "normal";
    g.entities = [];
    Object.assign(g.player, {
      x: s.x + 0.5,
      y: s.y + 1,
      z: s.z + 5,
      flying: false,
      health: 20,
    });
    g.inventory.slots = Array(36).fill(null);
    g.inventory.slots[0] = {
      id: "hellfire_sword",
      count: 1,
      durability: 2031,
      enchantments: { sharpness: 4 },
    };
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
  }, site);
  await expect
    .poll(() =>
      page.evaluate(
        (s) => dcsmcraft.entities.filter((e) => e.encounter === s.id).length,
        site,
      ),
    )
    .toBe(6);
  const outcome = await page.evaluate(
    ({ s, B, MOB_INFO }) => {
      const g = dcsmcraft;
      g.pause();
      const target = { x: s.x, y: s.y + 1, z: s.z - 15, id: B.chest };
      g.world.get(target.x, target.y, target.z);
      g.target = target;
      g.lastPlace = -10;
      g.ui.play();
      g.use();
      const closed = g.ui.screen === "play";
      g.breakBlock(target);
      const notBroken = g.world.get(target.x, target.y, target.z) === B.chest;
      for (const e of g.entities.filter((e) => e.encounter === s.id)) {
        // Controlled combat fixture: preserve production targeting, cooldown calculation and damage; advance charge between strikes.
        for (let i = 0; i < 40 && e.hp > 0; i++) {
          Object.assign(g.player, {
            x: e.x,
            y: e.y,
            z: e.z + 2.3,
            yaw: 0,
            pitch: Math.atan2(MOB_INFO[e.type].height / 2 - 1.62, 2.3),
            vx: 0,
            vy: 0,
            vz: 0,
            onGround: true,
          });
          g.target = null;
          g.lastAttack = g.elapsed - 2;
          if (!g.tryAttack()) throw Error("Cannot target " + e.type);
        }
        if (e.hp > 0) throw Error("Melee could not defeat " + e.type);
      }
      g.target = target;
      g.lastPlace = -10;
      g.use();
      const opened = g.ui.screen === "inventory";
      const chest = g.world.containers[`${target.x},${target.y},${target.z}`];
      for (let i = 0; i < chest.slots.length; i++) {
        if (chest.slots[i]) {
          const left = g.inventory.add(chest.slots[i]);
          if (left) throw Error("Fixture inventory full");
          chest.slots[i] = null;
        }
      }
      g.closeInventory();
      g.pause();
      return {
        closed,
        notBroken,
        opened,
        defeated: g.world.settlements[s.id].defeated.length,
        keys: g.inventory.slots
          .filter((v) => v?.id === "cinder_sigil")
          .reduce((n, v) => n + v.count, 0),
      };
    },
    { s: site, B, MOB_INFO },
  );
  expect(outcome).toEqual({
    closed: true,
    notBroken: true,
    opened: true,
    defeated: 6,
    keys: 1,
  });
  const temple = await page.evaluate((B) => {
    const g = dcsmcraft;
    g.travelDimension(Object.values(g.world.portals)[0]);
    g.pause();
    g.openJournal();
    const p = g.world.relicPlan;
    g.ui.play();
    g.target = { x: p.x, y: p.y, z: p.z + 32, id: B.temple_seal };
    g.world.get(g.target.x, g.target.y, g.target.z);
    g.inventory.selected = g.inventory.slots.findIndex(
      (v) => v?.id === "cinder_sigil",
    );
    g.use();
    Object.assign(g.player, {
      x: p.x + 0.5,
      y: p.y,
      fallStart: p.y,
      z: p.z + 13,
      health: 20,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
    return p;
  }, B);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          dcsmcraft.entities.filter((e) => e.type === "devin_guardian").length,
      ),
    )
    .toBe(3);
  const verified = await page.evaluate(
    async ({ p, B }) => {
      const g = dcsmcraft;
      g.pause();
      const e = g.entities.find((v) => v.type === "devin_guardian");
      // Isolate the selected target: other Guardians can walk into this ray
      // while the setup waits for population on slower software WebGL hosts.
      for (const [i, other] of g.entities
        .filter((v) => v.type === "devin_guardian" && v !== e)
        .entries())
        Object.assign(other, { x: p.x - 12 - i * 4, y: p.y, z: p.z - 12 });
      Object.assign(e, { x: p.x + 11, y: p.y, z: p.z + 4 });
      Object.assign(g.player, {
        x: e.x,
        y: e.y,
        z: e.z + 3,
        yaw: 0,
        pitch: Math.atan2(-0.35, 3),
      });
      g.inventory.slots[0] = { id: "matthew_dual_pistols", count: 1 };
      g.inventory.selected = 0;
      g.target = null;
      const hp = e.hp;
      g.player.matthewShotTick = 0;
      g.firePistols();
      const after = e.hp;
      g.inventory.slots[0] = {
        id: "hellfire_sword",
        count: 1,
        durability: 2031,
      };
      g.player.z = e.z + 2.3;
      g.lastAttack = -10;
      g.target = null;
      if (g.targetEntity()?.id !== e.id)
        throw Error("Guardian melee fixture targets a different entity");
      g.tryAttack();
      const result = {
        bulletBefore: hp,
        bulletAfter: after,
        meleeAfter: e.hp,
        attuned: g.world.settlements["devin-temple"].attuned,
        gate: g.world.get(p.x, p.y, p.z + 32),
        sigils: g.inventory.slots.filter((v) => v?.id === "cinder_sigil")
          .length,
      };
      return { ...result, id: g.id };
    },
    { p: temple, B },
  );
  expect(verified.bulletBefore).toBe(140);
  expect(verified.bulletAfter).toBe(140);
  expect(verified.meleeAfter).toBeLessThan(140);
  expect(verified.attuned).toBe(true);
  expect(verified.gate).toBe(B.air);
  expect(verified.sigils).toBe(0);
  await page.evaluate(
    ({ p, MOB_INFO }) => {
      const g = dcsmcraft;
      g.inventory.selected = 0;
      g.inventory.slots[0] = {
        id: "hellfire_sword",
        count: 1,
        durability: 2031,
        enchantments: { sharpness: 4 },
      };
      for (const e of g.entities.filter((v) => v.type === "devin_guardian"))
        for (let i = 0; i < 40 && e.hp > 0; i++) {
          Object.assign(g.player, {
            x: e.x,
            y: e.y,
            z: e.z + 2.3,
            yaw: 0,
            pitch: Math.atan2(MOB_INFO[e.type].height / 2 - 1.62, 2.3),
            vx: 0,
            vy: 0,
            vz: 0,
            onGround: true,
          });
          g.target = null;
          g.lastAttack = g.elapsed - 2;
          if (!g.tryAttack()) throw Error("Cannot target Guardian");
        }
      if (g.world.settlements["devin-temple"].defeated.length !== 3)
        throw Error("Guardians were not defeated");
      Object.assign(g.player, {
        x: p.x + 0.5,
        y: p.y,
        z: p.z + 2.8,
        yaw: 0,
        pitch: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        health: 20,
        fallStart: p.y,
      });
      g.target = g.world.raycast(
        { x: g.player.x, y: g.player.y + 1.62, z: g.player.z },
        g.direction(),
        4.5,
      );
      g.ui.play();
      g.running = true;
      g.pointerLockFallback = true;
      g.renderer.gl.domElement.dispatchEvent(
        new MouseEvent("mousedown", { button: 0, bubbles: true }),
      );
    },
    { p: temple, MOB_INFO },
  );
  await page.waitForFunction(
    () => dcsmcraft.world.relicClaimed,
    {},
    { timeout: 40000 },
  );
  await page.mouse.up();
  await page.evaluate(async () => {
    dcsmcraft.pause();
    await dcsmcraft.save();
  });
  await page.reload();
  await page.waitForFunction(() => dcsmcraft?.initialized);
  await page.evaluate((id) => dcsmcraft.loadWorld(id), verified.id);
  await page.waitForFunction(() => dcsmcraft.active);
  expect(
    await page.evaluate(
      () => dcsmcraft.world.settlements["devin-temple"].attuned,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.inventory.slots.filter((v) => v?.id === "devin_sword").length,
    ),
  ).toBe(1);
  expect(
    await page.evaluate(
      (s) =>
        dcsmcraft.realms.cinderwild.world.settlements[s.id].defeated.length,
      site,
    ),
  ).toBe(6);
  expect(errors).toEqual([]);
});
