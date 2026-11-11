import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { B } from "../../src/data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out =
    process.env.DCSMCRAFT_LIGHT_ARTIFACTS ||
    "/workspace/artifacts/torch-titan-281";
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
async function boot(page, url = origin + "/light.html") {
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
        graphics: 2,
        renderDistance: 2,
        distantTerrain: false,
        volume: 0,
        musicEnabled: false,
        ambientSounds: false,
        frameLimit: 30,
        shadows: false,
        fancyGraphics: false,
        localLightCount: 0,
      }),
    ),
  );
  await page.goto(url);
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
    dcsmcraft.pause();
    dcsmcraft.ui.play();
    dcsmcraft.entities = [];
    dcsmcraft.giganto.record.config.enabled = false;
  });
  return errors;
}
test("placed torches in all four packs stay textured; six lamps and dropped items light loaded terrain offscreen, beyond the old radius, with Fancy disabled, after save/reload", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors = await boot(page);
  await page.evaluate(
    ({ B }) => {
      const g = dcsmcraft,
        w = g.world;
      for (let z = -1; z <= 1; z++)
        for (let x = -1; x <= 2; x++) w.ensure(x, z);
      for (let x = 0; x < 32; x++)
        for (let z = 0; z < 13; z++) w.set(x, 199, z, B.stone);
      for (const x of [2, 6, 10, 14, 18, 22]) w.set(x, 200, 4, B.torch);
      Object.assign(g.player, {
        x: 12,
        y: 200,
        z: 12,
        yaw: 0,
        pitch: 0.4,
        vy: 0,
        onGround: true,
      });
      g.renderer.rebuild(w.ensure(0, 0));
      g.renderer.rebuild(w.ensure(1, 0));
    },
    { B },
  );
  const packs = [];
  for (const pack of ["renewed", "classic", "soft", "supplied"]) {
    const report = await page.evaluate((pack) => {
      const g = dcsmcraft,
        r = g.renderer;
      g.settings.texturePack = pack;
      r.applyGraphics();
      r.rebuild(g.world.ensure(0, 0));
      const geo = r.meshes.get("0,0").children[0].geometry,
        p = geo.attributes.position.array,
        uv = geo.attributes.uv.array;
      const cvs = r.atlas.canvas,
        c = cvs.getContext("2d");
      let alpha = [];
      for (let n = 0; n < p.length / 3; n++)
        if (
          p[n * 3] > 6 &&
          p[n * 3] < 7 &&
          p[n * 3 + 1] > 200 &&
          p[n * 3 + 2] > 4 &&
          p[n * 3 + 2] < 5
        ) {
          const x = Math.min(cvs.width - 1, Math.floor(uv[n * 2] * cvs.width)),
            y = Math.min(
              cvs.height - 1,
              Math.floor((1 - uv[n * 2 + 1]) * cvs.height),
            );
          alpha.push(c.getImageData(x, y, 1, 1).data[3]);
        }
      return {
        pack,
        vertices: alpha.length,
        minAlpha: Math.min(...alpha),
        lightMax: Math.max(...geo.attributes.blockLight.array),
      };
    }, pack);
    expect(report.vertices).toBeGreaterThan(0);
    console.log("torch pack", JSON.stringify(report));
    expect(report.minAlpha, pack).toBe(255);
    expect(report.lightMax).toBeGreaterThan(1);
    packs.push(report);
  }
  const lighting = await page.evaluate(() => {
    const g = dcsmcraft,
      r = g.renderer;
    g.settings.texturePack = "renewed";
    r.applyGraphics();
    r.rebuild(g.world.ensure(0, 0));
    r.rebuild(g.world.ensure(1, 0));
    function render() {
      r.hemi.intensity = 0.04;
      r.sun.intensity = 0;
      r.localLights.forEach((l) => (l.visible = false));
      r.scene.fog = null;
      r.clouds.visible = false;
      r.sunOrb.visible = r.moonOrb.visible = r.starField.visible = false;
      r.camera.position.set(8, 203, 12);
      r.camera.lookAt(8, 199.5, 4);
      r.camera.updateMatrixWorld();
      r.gl.setRenderTarget(null);
      r.gl.render(r.scene, r.camera);
      const gl = r.gl.getContext(),
        pixels = new Uint8Array(32 * 32 * 4);
      gl.readPixels(
        Math.floor(gl.drawingBufferWidth / 2) - 16,
        Math.floor(gl.drawingBufferHeight / 2) - 16,
        32,
        32,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );
      return [...pixels].reduce((a, b, i) => a + (i % 4 === 3 ? 0 : b), 0);
    }
    window.lightRender = render;
    const first = render();
    const attributes = ["0,0", "1,0"].map(
        (k) => r.meshes.get(k).children[0].geometry.attributes.blockLight,
      ),
      saved = attributes.map((a) => a.array.slice());
    attributes.forEach((a) => {
      a.array.fill(0);
      a.needsUpdate = true;
    });
    const unlit = render();
    attributes.forEach((a, i) => {
      a.array.set(saved[i]);
      a.needsUpdate = true;
    });
    const sum = () =>
        [
          ...r.meshes.get("0,0").children[0].geometry.attributes.blockLight
            .array,
        ].reduce((a, b) => a + b, 0),
      before = sum();
    Object.assign(g.player, { x: 66, y: 200, z: 35, yaw: Math.PI });
    const far = render();
    g.player.yaw += Math.PI;
    const turned = render();
    return {
      first,
      unlit,
      far,
      turned,
      before,
      after: sum(),
      pointLights: r.localLights.filter((l) => l.visible).length,
    };
  });
  expect(lighting.first).toBeGreaterThan(lighting.unlit * 2);
  expect(lighting.far).toBe(lighting.first);
  expect(lighting.turned).toBe(lighting.first);
  expect(lighting.after).toBe(lighting.before);
  expect(lighting.pointLights).toBe(0);
  const image = await page.evaluate(() => {
    window.lightRender();
    return dcsmcraft.renderer.gl.domElement.toDataURL("image/png");
  });
  writeFileSync(
    out + "/six-torches-night.png",
    Buffer.from(image.split(",")[1], "base64"),
  );
  const dropped = await page.evaluate(() => {
    const g = dcsmcraft,
      r = g.renderer;
    g.drops.push({
      uid: "light-drop-281",
      id: "glowstone",
      count: 1,
      x: 25.5,
      y: 200,
      z: 8.5,
      life: 300,
    });
    r.syncEntities([], g.drops, 123);
    r.rebuild(g.world.ensure(1, 0));
    return g.world.itemLightSources.find((p) => p[0] === 25 && p[2] === 8);
  });
  expect(dropped[3]).toBe(15);
  const id = await page.evaluate(async () => {
    const g = dcsmcraft;
    Object.assign(g.player, { x: 12, y: 200, z: 12, vy: 0, onGround: true });
    await g.save();
    return g.active.id;
  });
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.pause();
    dcsmcraft.ui.play();
    dcsmcraft.renderer.syncEntities([], dcsmcraft.drops, 125);
    dcsmcraft.renderer.rebuild(dcsmcraft.world.ensure(0, 0));
  }, id);
  const loaded = await page.evaluate(() => ({
    lamps: [2, 6, 10, 14, 18, 22].filter(
      (x) => dcsmcraft.world.get(x, 200, 4) === 18,
    ).length,
    lit: [
      ...dcsmcraft.renderer.meshes.get("0,0").children[0].geometry.attributes
        .blockLight.array,
    ].some((x) => x > 1),
    drops: dcsmcraft.drops.filter((d) => d.uid === "light-drop-281").length,
  }));
  expect(loaded).toEqual({ lamps: 6, lit: true, drops: 1 });
  expect(errors).toEqual([]);
  writeFileSync(
    out + "/lighting-report.json",
    JSON.stringify({ packs, lighting, dropped, loaded, errors }, null, 2),
  );
});
test("the actual standalone file opens directly from disk and can create a playable world without a local server", async ({
  page,
}) => {
  test.setTimeout(120000);
  let errors;
  try {
    errors = await boot(
      page,
      pathToFileURL(resolve("dist/DCSMCRAFT-Standalone.html")).href,
    );
  } catch (e) {
    if (!String(e).includes("ERR_BLOCKED_BY_ADMINISTRATOR")) throw e;
    writeFileSync(
      out + "/direct-file-report.json",
      JSON.stringify(
        {
          tested: false,
          blockedByManagedBrowserPolicy: true,
          error: "ERR_BLOCKED_BY_ADMINISTRATOR",
        },
        null,
        2,
      ),
    );
    test.skip(
      true,
      "Managed Chromium policy blocks file:// navigation; not a game result",
    );
    return;
  }

  const state = await page.evaluate(async () => {
    const g = dcsmcraft;
    await g.save();
    return {
      id: g.active.id,
      world: !!g.world.chunks.size,
      workers: g.renderer.workers.length,
      player: Number.isFinite(g.player.y),
      scheme: location.protocol,
    };
  });
  expect(state.scheme).toBe("file:");
  expect(state.world).toBe(true);
  expect(state.player).toBe(true);
  expect(errors).toEqual([]);
  writeFileSync(
    out + "/direct-file-report.json",
    JSON.stringify(state, null, 2),
  );
});

test("worker-lit torch tunnel crosses a chunk seam and updates after cached/uncached wall edits and torch removal", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors = await boot(page);
  await page.evaluate(
    ({ B }) => {
      const g = dcsmcraft,
        w = g.world;
      for (let z = -1; z <= 1; z++)
        for (let x = -1; x <= 2; x++) w.ensure(x, z);
      for (let x = -1; x <= 22; x++)
        for (let y = 199; y <= 202; y++)
          for (let z = 4; z <= 6; z++) w.set(x, y, z, B.stone);
      for (let x = 0; x <= 21; x++) w.set(x, 200, 5, B.air);
      w.set(13, 200, 5, B.torch);
      for (const c of w.chunks.values()) delete c.lightSources;
      Object.assign(g.player, {
        x: 16.5,
        y: 200,
        z: 5.5,
        vy: 0,
        onGround: true,
      });
      window.seamLight = () => {
        const r = g.renderer,
          m = r.meshes.get("1,0");
        if (!m) return -1;
        if (m.userData.revision !== (w.revisions.get("1,0") || 0)) return -1;
        let value = 0;
        for (const child of m.children) {
          const a = child.geometry?.attributes;
          if (!a?.blockLight) continue;
          for (let i = 0; i < a.position.count; i++)
            if (
              a.position.getX(i) < 3 &&
              a.position.getY(i) >= 199.9 &&
              a.position.getY(i) <= 201.1 &&
              a.position.getZ(i) >= 5 &&
              a.position.getZ(i) <= 6
            )
              value = Math.max(value, a.blockLight.getX(i));
        }
        return value;
      };
    },
    { B },
  );
  const wait = async (lit) =>
    page.waitForFunction(
      (lit) => {
        dcsmcraft.renderer.loadAround(16, 5, 2);
        const n = seamLight();
        return lit ? n > 0 : n === 0;
      },
      lit,
      { timeout: 45000 },
    );
  await wait(true);
  const initial = await page.evaluate(() => seamLight());
  for (let i = 0; i < 2; i++) {
    await page.evaluate(
      ({ B }) => {
        for (const c of dcsmcraft.world.chunks.values()) delete c.lightSources;
        dcsmcraft.world.set(14, 200, 5, B.stone);
      },
      { B },
    );
    await wait(false);
    await page.evaluate(({ B }) => dcsmcraft.world.set(14, 200, 5, B.air), {
      B,
    });
    await wait(true);
    expect(await page.evaluate(() => seamLight())).toBe(initial);
  }
  await page.evaluate(({ B }) => dcsmcraft.world.set(13, 200, 5, B.air), { B });
  await wait(false);
  expect(errors).toEqual([]);
  writeFileSync(
    out + "/worker-seam-report.json",
    JSON.stringify(
      { initial, afterRemoval: await page.evaluate(() => seamLight()), errors },
      null,
      2,
    ),
  );
});
