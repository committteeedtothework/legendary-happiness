import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { WEAPON_IDS } from "../../src/weapon-art.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out = "/workspace/artifacts/weapon-style-2716";
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
  await page.addInitScript(() =>
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
  await page.goto(origin + "/weapon-style.html");
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
  await page.setViewportSize({
    width: 1280,
    height: Math.ceil(shots.length / cols) * 200 + 40,
  });
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.locator("#weapon-gallery").evaluate((n) => n.remove());
  await page.setViewportSize({ width: 854, height: 478 });
}
test("all 61 weapons render real pixel models and matching inventory icons, preserve hidden-arm/action rules and use original shared assets", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 854, height: 478 });
  const evidence = await boot(page);
  const data = await page.evaluate((ids) => {
    const g = dcsmcraft,
      r = g.renderer,
      rows = [],
      shots = [],
      icons = [];
    const draw = () =>
      r.draw({
        game: g,
        player: g.player,
        playing: true,
        elapsed: g.elapsed,
        animating: false,
      });
    for (const id of ids) {
      g.inventory.slots[0] = { id, count: 1 };
      r.setHeld(id, g.inventory.held);
      r.animator = new r.animator.constructor();
      draw();
      g.ui.updateHotbar();
      icons.push({ id, image: document.querySelector("#hotbar img").src });
      shots.push({ id, image: r.gl.domElement.toDataURL() });
      let finite = true,
        nearest = true,
        clear = true,
        hidden = true;
      for (const kind of ["attack", "mine", "use", "fire"])
        for (const t of [0, 0.25, 0.6, 1]) {
          r.action(kind);
          r.animator.equip = 0;
          r.animator.action.age = r.animator.action.duration * t;
          draw();
          r.heldMesh.traverse((n) => {
            finite &&= n.matrixWorld.elements.every(Number.isFinite);
            if (n.material?.map) {
              nearest &&=
                n.material.map.magFilter === 1003 &&
                n.material.map.minFilter === 1003 &&
                n.material.map.generateMipmaps === false;
            }
          });
          clear &&= r.handRig.viewBounds.max.z <= -0.1099;
          hidden &&= !r.handRig.armVisuals.visible;
        }
      rows.push({
        id,
        finite,
        nearest,
        clear,
        hidden,
        pixel: r.heldMesh.userData.pixelProfile,
      });
    }
    return { rows, shots, icons };
  }, WEAPON_IDS);
  for (const row of data.rows)
    expect(row, row.id).toMatchObject({
      finite: true,
      nearest: true,
      clear: true,
      hidden: true,
      pixel: true,
    });
  for (const shot of data.shots.filter((s) =>
    [
      "diamond_sword",
      "devin_sword",
      "iron_spear",
      "shield",
      "trident",
      "mace",
      "bow",
      "crossbow",
      "matthew_dual_pistols",
    ].includes(s.id),
  ))
    writeFileSync(
      `${out}/${shot.id}-first.png`,
      Buffer.from(shot.image.split(",")[1], "base64"),
    );
  await gallery(page, data.shots, "all-weapons-first-person");
  await gallery(page, data.icons, "all-weapons-icons", 8);
  // Actual hotbar PNGs must be transparent crisp palette pixels, not a generic
  // item card or a smoothed rotated canvas. Compare shared art across packs.
  const pixels = await page.evaluate(async (icons) => {
    const rows = [];
    for (const s of icons) {
      const i = new Image();
      i.src = s.image;
      await i.decode();
      const c = document.createElement("canvas");
      c.width = c.height = 32;
      const x = c.getContext("2d");
      x.drawImage(i, 0, 0);
      const d = x.getImageData(0, 0, 32, 32).data,
        a = new Set();
      let colored = 0,
        transparent = 0;
      for (let j = 0; j < d.length; j += 4) {
        if (!d[j + 3]) transparent++;
        else {
          colored++;
          a.add([...d.slice(j, j + 4)].join(","));
          if (d[j + 3] !== 255) throw Error("smoothed alpha " + s.id);
        }
      }
      rows.push({ id: s.id, colored, transparent, colors: a.size });
    }
    return rows;
  }, data.icons);
  for (const p of pixels) {
    expect(p.colored, p.id).toBeGreaterThan(25);
    expect(p.transparent, p.id).toBeGreaterThan(25);
    expect(p.colors, p.id).toBeLessThan(20);
  }
  writeFileSync(
    `${out}/first-person.json`,
    JSON.stringify({ rows: data.rows, icons: pixels }, null, 2),
  );
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});
test("all 61 third-person weapons remain at the palm through idle, swings and movement; F5 shows distinct pixel models", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 854, height: 478 });
  const evidence = await boot(page);
  const data = await page.evaluate((ids) => {
    const g = dcsmcraft,
      r = g.renderer,
      rows = [],
      shots = [];
    let time = g.elapsed;
    for (const id of ids) {
      g.inventory.slots[0] = { id, count: 1 };
      r.setHeld(id, g.inventory.held);
      r.animator = new r.animator.constructor();
      let finite = true,
        contact = true;
      for (const t of [0, 0.25, 0.6, 1]) {
        if (t) r.action("attack");
        if (r.animator.action)
          r.animator.action.age = t * r.animator.action.duration;
        time += 0.033;
        r.draw({
          game: g,
          player: g.player,
          playing: true,
          cameraMode: 2,
          elapsed: time,
          animating: true,
        });
        const u = r.playerModel.userData;
        finite &&= u.grip.children[0].matrixWorld.elements.every(
          Number.isFinite,
        );
        const a = u.grip.getWorldPosition(u.rig.position.clone()),
          b = u.forearms[1].children[1].getWorldPosition(
            u.rig.position.clone(),
          );
        contact &&= a.distanceTo(b) < 0.1;
      }
      r.animator.action = null;
      r.playerSwing = 0;
      time += 0.033;
      r.draw({
        game: g,
        player: g.player,
        playing: true,
        cameraMode: 2,
        elapsed: time,
        animating: true,
      });
      shots.push({ id, image: r.gl.domElement.toDataURL() });
      rows.push({
        id,
        finite,
        contact,
        pixel: r.playerModel.userData.grip.children[0].userData.pixelProfile,
      });
    }
    return { rows, shots };
  }, WEAPON_IDS);
  for (const row of data.rows)
    expect(row, row.id).toMatchObject({
      finite: true,
      contact: true,
      pixel: true,
    });
  for (const shot of data.shots.filter((s) =>
    [
      "diamond_sword",
      "devin_sword",
      "iron_spear",
      "shield",
      "trident",
      "bow",
      "crossbow",
      "matthew_dual_pistols",
    ].includes(s.id),
  ))
    writeFileSync(
      `${out}/${shot.id}-third.png`,
      Buffer.from(shot.image.split(",")[1], "base64"),
    );
  await gallery(page, data.shots, "all-weapons-third-person");
  writeFileSync(`${out}/third-person.json`, JSON.stringify(data.rows, null, 2));
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});
test("real bow/crossbow charging and loaded firing, shield blocking and trident windup drive both first/F5 poses and retain ammunition/damage controls", async ({
  page,
}) => {
  test.setTimeout(120000);
  const evidence = await boot(page);
  const states = [];
  for (const id of ["bow", "crossbow", "shield", "trident"]) {
    const row = await page.evaluate((id) => {
      const g = dcsmcraft,
        r = g.renderer;
      g.inventory.slots[0] = { id, count: 1, durability: 100 };
      g.target = null;
      g.lastPlace = -1e6;
      r.setHeld(id, g.inventory.held);
      r.animator = new r.animator.constructor();
      g.use();
      g.elapsed += 1.5;
      g.tickCount += 15;
      r.animator.action = null;
      r.animator.equip = 0;
      const draw = (mode = 0) => {
        g.elapsed += 0.033;
        r.draw({
          game: g,
          player: g.player,
          playing: true,
          cameraMode: mode,
          elapsed: g.elapsed,
          animating: true,
        });
      };
      draw();
      const firstImage = r.gl.domElement.toDataURL();
      const stage = r.heldMesh.userData.drawStage,
        first = r.handGroup.position.toArray();
      draw(2);
      const u = r.playerModel.userData;
      const arms = u.arms.map((a) => a.rotation.x),
        kind = u.grip.children[0].userData.displayKind,
        stageF5 = u.grip.children[0].userData.drawStage;
      const thirdImage = r.gl.domElement.toDataURL();
      const before = (g.hostileProjectiles || []).length;
      dispatchEvent(new MouseEvent("mouseup", { button: 2 }));
      const charged = g.inventory.held?.charged;
      if (id === "crossbow") {
        g.lastPlace = -1e6;
        g.use();
      }
      const arrows = (g.hostileProjectiles || []).filter((q) => q.playerArrow);
      const projectile = (g.hostileProjectiles || []).at(-1);
      draw();
      return {
        id,
        firstImage,
        thirdImage,
        stage,
        first,
        arms,
        kind,
        stageF5,
        charged,
        shield: !!g.player.shieldRaised,
        draw: !!g.player.editionDraw,
        trident: !!g.tridentCharge,
        arrows: arrows.length,
        before,
        damage: projectile?.damage,
        rest: r.handGroup.position.toArray(),
      };
    }, id);
    if (row.firstImage) {
      writeFileSync(
        `${out}/${id}-active-first.png`,
        Buffer.from(row.firstImage.split(",")[1], "base64"),
      );
      writeFileSync(
        `${out}/${id}-active-third.png`,
        Buffer.from(row.thirdImage.split(",")[1], "base64"),
      );
      delete row.firstImage;
      delete row.thirdImage;
    }
    states.push(row);
    if (["bow", "crossbow"].includes(id)) {
      expect(row.stage).toBe(3);
      expect(row.stageF5).toBe(3);
      expect(row.arms.every((x) => x > 1)).toBe(true);
      expect(row.arrows).toBeGreaterThan(0);
      expect(row.damage).toBe(6);
      if (id === "crossbow") expect(row.charged).toBe(true);
    }
    if (id === "shield") {
      expect(row.kind).toBe("shield_blocking");
      expect(row.shield).toBe(false);
    }
    if (id === "trident") {
      expect(row.kind).toBe("trident_throwing");
      expect(row.arms[1]).toBeGreaterThan(2.5);
    }
    expect(row.draw).toBe(false);
    expect(row.trident).toBe(false);
  }
  writeFileSync(`${out}/use-states.json`, JSON.stringify(states, null, 2));
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});
test("weapon camera transforms stay finite on narrow and ultrawide screens and pack changes keep the same original weapon/icon", async ({
  page,
}) => {
  const evidence = await boot(page);
  for (const width of [480, 1280, 2560]) {
    await page.setViewportSize({ width, height: 720 });
    const result = await page.evaluate(() => {
      const g = dcsmcraft,
        r = g.renderer;
      const rows = [];
      for (const id of [
        "diamond_sword",
        "mace",
        "iron_spear",
        "bow",
        "crossbow",
        "shield",
        "trident",
        "devin_sword",
        "matthew_dual_pistols",
      ]) {
        g.inventory.slots[0] = { id, count: 1 };
        r.setHeld(id, g.inventory.held);
        r.animator.reset();
        r.animator.equip = 0;
        r.draw({
          game: g,
          player: g.player,
          playing: true,
          elapsed: g.elapsed,
          animating: false,
        });
        rows.push([
          id,
          r.handRig.root.matrixWorld.elements.every(Number.isFinite),
          r.handRig.viewBounds.max.z <= -0.1099,
        ]);
      }
      return rows;
    });
    for (const [id, finite, clear] of result)
      expect([finite, clear], `${id} ${width}`).toEqual([true, true]);
  }
  const iconByPack = [];
  for (const pack of ["classic", "renewed", "supplied"]) {
    await page.evaluate((pack) => {
      const g = dcsmcraft;
      g.settings.texturePack = pack;
      g.renderer.applyGraphics();
      g.inventory.slots[0] = { id: "diamond_sword", count: 1 };
      g.renderer.setHeld("diamond_sword", g.inventory.held);
      g.ui.updateHotbar();
    }, pack);
    iconByPack.push(
      await page.locator("#hotbar img").first().getAttribute("src"),
    );
    expect(
      await page.evaluate(
        () => dcsmcraft.renderer.heldMesh.userData.pixelProfile,
      ),
    ).toBe(true);
  }
  expect(new Set(iconByPack).size).toBe(1);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});

test("all 61 dropped weapons render as genuine 3D pixel items and equipment on skeletons, Guardians and Dread Knights shares the same art", async ({
  page,
}) => {
  const evidence = await boot(page);
  const data = await page.evaluate((ids) => {
    const g = dcsmcraft,
      r = g.renderer;
    r.draw({
      game: g,
      player: g.player,
      playing: true,
      elapsed: g.elapsed,
      animating: false,
    });
    const drops = ids.map((id, i) => ({
      uid: "visual-drop:" + i,
      id,
      count: 1,
      x: g.player.x + ((i % 9) - 4) * 0.65,
      y: g.player.y + 0.1,
      z: g.player.z - 4 - Math.floor(i / 9) * 0.55,
    }));
    r.syncEntities([], drops, g.elapsed);
    const rows = drops.map((d) => {
      const m = r.dropMeshes.get(d.uid);
      let pixel = false,
        meshes = 0,
        finite = true;
      m?.traverse((n) => {
        if (n.userData.pixelProfile) pixel = true;
        if (n.isMesh) meshes++;
        finite &&= n.matrixWorld.elements.every(Number.isFinite);
      });
      return { id: d.id, pixel, meshes, finite };
    });
    r.draw({
      game: g,
      player: g.player,
      playing: true,
      elapsed: g.elapsed,
      animating: false,
    });
    const image = r.gl.domElement.toDataURL();
    r.syncEntities([], [], g.elapsed);
    return { rows, remaining: r.dropMeshes.size, image };
  }, WEAPON_IDS);
  writeFileSync(
    `${out}/dropped-weapons-world.png`,
    Buffer.from(data.image.split(",")[1], "base64"),
  );
  delete data.image;
  expect(data.rows.length).toBe(61);
  for (const row of data.rows) {
    expect(row.pixel, row.id).toBe(true);
    expect(row.meshes, row.id).toBeGreaterThan(0);
    expect(row.finite, row.id).toBe(true);
  }
  expect(data.remaining).toBe(0);
  const npcs = await page.evaluate(() => {
    const r = dcsmcraft.renderer,
      g = dcsmcraft,
      rows = [];
    r.syncEntities(
      ["skeleton", "devin_guardian", "dread_knight"].map((type, i) => ({
        id: "weapon-npc:" + i,
        type,
        x: 0.5 + i * 1.5,
        y: 200,
        z: -3,
        yaw: 0,
        health: 100,
        hp: 100,
        onGround: true,
      })),
      [],
      g.elapsed,
    );
    for (const [id, m] of r.mobMeshes) {
      let weapons = [];
      m.traverse((n) => {
        if (n.userData.weaponModel) weapons.push(n.userData.weaponModel);
      });
      rows.push({ id, weapons });
    }
    r.syncEntities([], [], g.elapsed);
    return rows;
  });
  expect(npcs.flatMap((n) => n.weapons)).toEqual(
    expect.arrayContaining(["bow", "golden_sword", "shield", "hellfire_sword"]),
  );
  writeFileSync(
    `${out}/drops-and-npcs.json`,
    JSON.stringify({ drops: data.rows, npcs }, null, 2),
  );
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});
