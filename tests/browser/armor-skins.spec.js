import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { ARMOR_IDS, armorPalette } from "../../src/armor-art.js";
import { SKINS } from "../../src/skins.js";
import { B, ITEMS } from "../../src/data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out = "/workspace/artifacts/armor-skins-2717";
mkdirSync(out, { recursive: true });
let server, origin;
test.use({ trace: "off" });
test.beforeAll(async () => {
  server = createServer((q, r) => {
    r.setHeader("Content-Type", "text/html");
    r.end(html);
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
    if (/Shader Error|GL_INVALID|WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  await page.addInitScript(
    () =>
      localStorage.getItem("dcsmcraft-settings") ||
      localStorage.setItem(
        "dcsmcraft-settings",
        JSON.stringify({
          graphics: 1,
          renderDistance: 2,
          distantTerrain: false,
          volume: 0,
          musicEnabled: false,
          ambientSounds: false,
          frameLimit: 30,
          skin: "explorer",
        }),
      ),
  );
  await page.route("**/*", (r) =>
    r
      .request()
      .url()
      .startsWith(origin + "/")
      ? r.continue()
      : (external.push(r.request().url()), r.abort()),
  );
  await page.goto(origin + "/armor-skins.html");
  await page.waitForFunction(() => dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[name=difficulty]").selectOption("peaceful");
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(
    () => dcsmcraft.running && dcsmcraft.ui.screen === "play",
  );
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.ui.play();
    g.entities = [];
    g.inventory.slots.fill(null);
    g.world.set(0, 199, 0, 3);
    g.inventory.selected = 0;
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 0.5,
      yaw: 0,
      pitch: 0,
      vy: 0,
      onGround: true,
      health: 20,
    });
  });
  return { errors, external };
}
async function gallery(page, shots, name, cols = 4) {
  await page.evaluate(
    ({ shots, cols }) => {
      const old = document.querySelector("#weapon-gallery");
      old?.remove();
      let panel = document.createElement("div");
      panel.id = "weapon-gallery";
      panel.style.cssText = `position:fixed;inset:0;overflow:auto;background:#1e252c;z-index:100000;display:grid;grid-template-columns:repeat(${cols},1fr);align-content:start;gap:4px;color:#fff;font:12px monospace;padding:8px`;
      for (const s of shots) {
        const cell = document.createElement("div");
        cell.textContent = s.id;
        let img = new Image();
        img.src = s.image;
        img.style.cssText =
          "display:block;width:100%;image-rendering:pixelated";
        cell.append(img);
        panel.append(cell);
      }
      document.body.append(panel);
    },
    { shots, cols },
  );
  await page
    .locator("#weapon-gallery img")
    .last()
    .evaluate((i) => i.decode());
  const ratio = await page
    .locator("#weapon-gallery img")
    .first()
    .evaluate((i) => i.naturalHeight / i.naturalWidth);
  await page.setViewportSize({
    width: 1280,
    height: Math.ceil(
      Math.ceil(shots.length / cols) * ((1280 / cols) * ratio + 28) + 40,
    ),
  });
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.locator("#weapon-gallery").evaluate((n) => n.remove());
  await page.setViewportSize({ width: 854, height: 478 });
}
const families = [
  "dirt",
  "leather",
  "chainmail",
  "copper",
  "iron",
  "golden",
  "diamond",
  "netherite",
  "hellfire",
];
const equipment = (family) =>
  ["helmet", "chestplate", "leggings", "boots"].map((part) => ({
    id: family + "_" + part,
    count: 1,
  }));
function saveShots(shots) {
  for (const s of shots)
    writeFileSync(
      `${out}/${s.id}.png`,
      Buffer.from(s.image.split(",")[1], "base64"),
    );
}
test("all eleven original skins keep their classic models and render continuous clean arm texels, mirrored hairlines and distinct fronts/backs in the real wardrobe", async ({
  page,
}) => {
  test.setTimeout(150000);
  const evidence = await boot(page),
    shots = [];
  await page.evaluate(() => dcsmcraft.ui.skins());
  for (const id of Object.keys(SKINS)) {
    await page.locator(`[data-skin=${id}]`).click();
    await page.waitForFunction((id) => dcsmcraft.ui.skinPreview?.id === id, id);
    const results = await page.evaluate((id) => {
      const v = dcsmcraft.ui.skinPreview,
        u = v.model.userData,
        out = [];
      for (const [angle, yaw] of [
        ["front", Math.PI],
        ["back", 0],
        ["side", Math.PI / 2],
      ]) {
        v.model.rotation.y = yaw;
        u.head.rotation.set(0, 0, 0);
        v.gl.render(v.scene, v.camera);
        out.push({ id: id + "-" + angle, image: v.gl.domElement.toDataURL() });
      }
      return {
        shots: out,
        body: u.body.geometry.parameters,
        arms: u.arms.map((a) => a.children[0].userData.sourceRows),
        same:
          u.arms[1].children[0].material.map ===
          u.forearms[1].children[1].material.map,
        error: v.gl.getContext().getError(),
      };
    }, id);
    expect(results.same, id).toBe(true);
    expect(results.body.width).toBe(0.45);
    expect(results.body.height).toBe(0.675);
    expect(results.arms).toEqual([
      [0, 16 / 3],
      [0, 16 / 3],
    ]);
    expect(results.error).toBe(0);
    shots.push(...results.shots);
  }
  saveShots(shots);
  await gallery(
    page,
    shots.filter((s) => s.id.endsWith("-front")),
    "all-skins-front",
  );
  await gallery(
    page,
    shots.filter((s) => s.id.endsWith("-back")),
    "all-skins-back",
  );
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});
test("all 38 armor icons match equipped material palettes, and all eleven skins wear every full set without misplaced parts or costume overlays", async ({
  page,
}) => {
  test.setTimeout(180000);
  const evidence = await boot(page);
  const results = await page.evaluate(
    ({ skinIds, families, armorIds, slots }) => {
      const g = dcsmcraft,
        r = g.renderer,
        rows = [],
        shots = [],
        icons = [],
        individual = [];
      let time = g.elapsed;
      for (const id of armorIds) {
        g.inventory.slots[0] = { id, count: 1 };
        g.ui.updateHotbar();
        icons.push({ id, image: document.querySelector("#hotbar img").src });
        g.inventory.equipment.fill(null);
        g.inventory.equipment[slots[id]] = { id, count: 1 };
        r.setHeld(id, g.inventory.held);
        time += 0.033;
        r.draw({
          game: g,
          player: g.player,
          playing: true,
          cameraMode: 2,
          equipment: g.inventory.equipment,
          elapsed: time,
          animating: true,
        });
        const worn = r.playerModel.userData.armor;
        individual.push({
          id,
          ok: worn.length > 0 && worn.every((a) => a.userData.armor === id),
        });
      }
      g.inventory.slots[0] = { id: "diamond_sword", count: 1 };
      r.setHeld("diamond_sword", g.inventory.held);
      for (const skin of skinIds)
        for (const family of families) {
          g.settings.skin = skin;
          g.inventory.equipment = [
            "helmet",
            "chestplate",
            "leggings",
            "boots",
          ].map((part) => ({ id: family + "_" + part, count: 1 }));
          r.playerSwing = 0;
          r.animator.reset();
          r.animator.equip = 0;
          time += 0.033;
          r.draw({
            game: g,
            player: g.player,
            playing: true,
            cameraMode: 2,
            equipment: g.inventory.equipment,
            elapsed: time,
            animating: true,
          });
          const u = r.playerModel.userData;
          let finite = true;
          u.rig.traverse(
            (n) => (finite &&= n.matrixWorld.elements.every(Number.isFinite)),
          );
          rows.push({
            skin,
            family,
            finite,
            parts: u.armor.length,
            overlaysHidden: u.accessories.every((a) => !a.visible),
            white: u.body.material.color.getHex() === 0xffffff,
            palette: u.armor.every(
              (a) => a.material.map.userData.armor === a.userData.armor,
            ),
          });
          if (skin === "dante") {
            r.camera.position.set(
              g.player.x,
              g.player.y + 1.05,
              g.player.z - 2.45,
            );
            r.camera.lookAt(g.player.x, g.player.y + 0.95, g.player.z);
            r.gl.render(r.scene, r.camera);
            shots.push({
              id: "set-" + family,
              image: r.gl.domElement.toDataURL(),
            });
          }
        }
      return { rows, shots, icons, individual };
    },
    {
      skinIds: Object.keys(SKINS),
      families,
      armorIds: ARMOR_IDS,
      slots: Object.fromEntries(
        ARMOR_IDS.map((id) => [id, ITEMS[id].armorSlot]),
      ),
    },
  );
  expect(results.rows.length).toBe(99);
  expect(results.individual.length).toBe(38);
  for (const item of results.individual) expect(item.ok, item.id).toBe(true);
  for (const row of results.rows)
    expect(row, `${row.skin}/${row.family}`).toMatchObject({
      finite: true,
      parts: 11,
      overlaysHidden: true,
      white: true,
      palette: true,
    });
  saveShots(results.shots);
  await gallery(page, results.shots, "all-armor-sets");
  await gallery(page, results.icons, "armor-icons", 8);
  // Render mixed pieces and translucent chainmail against every outfit in the
  // same inventory preview used by players, including actual head look changes.
  const mixed = [];
  for (const skin of Object.keys(SKINS)) {
    const result = await page.evaluate((skin) => {
      const g = dcsmcraft;
      g.settings.skin = skin;
      g.inventory.equipment = [
        { id: "turtle_shell" },
        { id: "chainmail_chestplate" },
        { id: "golden_leggings" },
        { id: "diamond_boots" },
      ];
      g.ui.creativeTab = "inventory";
      g.openInventory("personal");
      const v = g.ui.inventoryPreview;
      if (!v) throw Error("Missing equipped preview");
      v.model.rotation.y = Math.PI;
      v.gl.render(v.scene, v.camera);
      const u = v.model.userData;
      return {
        id: skin + "-mixed",
        image: v.gl.domElement.toDataURL(),
        items: [...new Set(u.armor.map((a) => a.userData.armor))].sort(),
        skin: v.id,
        mailShowsCloth: u.arms[1].children[0].visible,
        error: v.gl.getContext().getError(),
      };
    }, skin);
    expect(result.skin).toBe(skin);
    expect(result.mailShowsCloth).toBe(true);
    expect(result.items).toEqual([
      "chainmail_chestplate",
      "diamond_boots",
      "golden_leggings",
      "turtle_shell",
    ]);
    expect(result.error).toBe(0);
    mixed.push(result);
    await page.evaluate(() => dcsmcraft.ui.play());
  }
  saveShots(mixed);
  await gallery(page, mixed, "mixed-armor-all-skins");
  const allowed = Object.fromEntries(
    ARMOR_IDS.map((id) => [
      id,
      Object.values(armorPalette(id)).filter((c) => c.startsWith("#")),
    ]),
  );
  const iconPixels = await page.evaluate(
    async ({ icons, allowed }) => {
      for (const icon of icons) {
        const img = new Image();
        img.src = icon.image;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = c.height = 32;
        const x = c.getContext("2d");
        x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, 32, 32).data;
        for (let i = 0; i < d.length; i += 4)
          if (d[i + 3]) {
            if (d[i + 3] !== 255) throw Error("Blurred alpha " + icon.id);
            const hex =
              "#" +
              Array.from(d.slice(i, i + 3))
                .map((n) => n.toString(16).padStart(2, "0"))
                .join("");
            if (!allowed[icon.id].includes(hex))
              throw Error("Icon palette mismatch " + icon.id + " " + hex);
          }
      }
      return icons.length;
    },
    { icons: results.icons, allowed },
  );
  expect(iconPixels).toBe(38);
  writeFileSync(
    `${out}/armor-matrix.json`,
    JSON.stringify(results.rows, null, 2),
  );
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});
test("actual equip actions, inventory preview, empty-arm armor sleeves, held-arm hiding and saved reload retain the selected skin and armor", async ({
  page,
}) => {
  const evidence = await boot(page);
  await page.evaluate(() => dcsmcraft.ui.skins());
  await page.locator("[data-skin=dante]").click();
  await page.evaluate(() => dcsmcraft.ui.play());
  const state = await page.evaluate(() => {
    const g = dcsmcraft,
      r = g.renderer;
    g.inventory.equipment.fill(null);
    for (const part of ["helmet", "chestplate", "leggings", "boots"]) {
      g.inventory.slots[0] = {
        id: "diamond_" + part,
        count: 1,
        durability: 100,
      };
      g.target = null;
      g.lastPlace = -1e6;
      g.use();
    }
    r.setHeld(null);
    r.setArmor(g.inventory.equipment);
    r.animator.reset();
    r.draw({
      game: g,
      player: g.player,
      playing: true,
      equipment: g.inventory.equipment,
      elapsed: g.elapsed,
      animating: false,
    });
    const empty = {
      visible: r.handRig.armVisuals.visible,
      map: r.handRig.shoulder.material.map.userData.armor,
      cloth: r.handRig.cuff.visible,
      glove: r.handRig.glove.visible,
    };
    g.inventory.slots[0] = { id: "diamond_sword", count: 1 };
    r.setHeld("diamond_sword", g.inventory.held);
    r.draw({
      game: g,
      player: g.player,
      playing: true,
      equipment: g.inventory.equipment,
      elapsed: g.elapsed,
      animating: false,
    });
    return {
      empty,
      hidden: !r.handRig.armVisuals.visible,
      equipment: g.inventory.equipment.map((s) => s?.id),
    };
  });
  expect(state.empty).toEqual({
    visible: true,
    map: "diamond_chestplate",
    cloth: false,
    glove: false,
  });
  expect(state.hidden).toBe(true);
  expect(state.equipment).toEqual(equipment("diamond").map((s) => s.id));
  await page.evaluate(() => {
    dcsmcraft.ui.creativeTab = "inventory";
    dcsmcraft.openInventory("personal");
  });
  await page.screenshot({ path: `${out}/equipped-inventory.png` });
  await page.evaluate(() => dcsmcraft.ui.play());
  await page.evaluate(() => dcsmcraft.save());
  await page.reload();
  await page.waitForFunction(() => dcsmcraft?.initialized);
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(
    () => dcsmcraft.running && dcsmcraft.ui.screen === "play",
  );
  expect(
    await page.evaluate(() => ({
      skin: dcsmcraft.settings.skin,
      equipment: dcsmcraft.inventory.equipment.map((s) => s?.id),
      held: dcsmcraft.inventory.held?.id,
    })),
  ).toEqual({
    skin: "dante",
    equipment: equipment("diamond").map((s) => s.id),
    held: "diamond_sword",
  });
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});
