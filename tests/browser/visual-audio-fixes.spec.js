import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { World } from "../../src/world.js";
import { villageAt } from "../../src/villages.js";
import { B } from "../../src/data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out = "/workspace/artifacts/visual-audio-2715";
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
        texturePack: "renewed",
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
  await page.goto(origin + "/polish.html");
  await page.waitForFunction(() => dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[name=difficulty]").selectOption("peaceful");
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(
    () => dcsmcraft.running && dcsmcraft.ui.screen === "play",
  );
  await page.evaluate((stone) => {
    const g = dcsmcraft;
    g.pause();
    g.entities = [];
    g.inventory.slots.fill(null);
    g.inventory.selected = 0;
    g.world.set(0, 199, 0, stone);
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 0.5,
      vy: 0,
      vx: 0,
      vz: 0,
      yaw: 0,
      pitch: 0,
      onGround: true,
      health: 20,
      fallStart: 200,
    });
    g.ui.play();
    for (const s of ["#toast", "#cycle-banner"])
      document.querySelector(s)?.style.setProperty("visibility", "hidden");
  }, B.stone);
  return { errors, external };
}
test("reference hand framing puts the sword at the cropped lower-right angle while held-item actions, hidden arms and camera safety remain", async ({
  page,
}) => {
  test.setTimeout(150000);
  const evidence = await boot(page);
  await page.setViewportSize({ width: 854, height: 478 });
  for (const id of [
    "diamond_sword",
    "diamond_pickaxe",
    "stone",
    "flint_and_steel",
    "devin_sword",
    "iron_spear",
    "matthew_dual_pistols",
  ]) {
    await page.evaluate((id) => {
      dcsmcraft.inventory.slots[0] = { id, count: 1 };
    }, id);
    await page.waitForFunction((id) => dcsmcraft.renderer.heldId === id, id);
    const frame = await page.evaluate(() => {
      const g = dcsmcraft,
        r = g.renderer;
      r.animator = new r.animator.constructor();
      r.pistolKick = 0;
      r.draw({
        player: g.player,
        playing: true,
        elapsed: g.elapsed,
        animating: false,
      });
      const p = r.handRig.itemSilhouette.map((p) =>
        p
          .clone()
          .applyMatrix4(r.handRig.wrist.matrixWorld)
          .project(r.handCamera),
      );
      let clear = true,
        hidden = true;
      for (const kind of ["attack", "mine", "place", "use"])
        for (const progress of [0, 0.25, 0.6, 1]) {
          r.action(kind);
          r.animator.equip = 0;
          r.animator.action.age = r.animator.action.duration * progress;
          r.draw({
            player: g.player,
            playing: true,
            elapsed: g.elapsed,
            animating: false,
          });
          clear &&= r.handRig.viewBounds.max.z <= -0.1099;
          hidden &&=
            !r.handRig.armVisuals.visible && !r.leftHandRig.armVisuals.visible;
          if (r.leftHandRig.root.visible)
            clear &&= r.leftHandRig.viewBounds.max.z <= -0.1099;
        }
      r.animator.reset();
      r.animator.equip = 0;
      r.draw({
        player: g.player,
        playing: true,
        elapsed: g.elapsed,
        animating: false,
      });
      return {
        minX: Math.min(...p.map((p) => p.x)),
        maxX: Math.max(...p.map((p) => p.x)),
        top: Math.max(...p.map((p) => p.y)),
        bottom: Math.min(...p.map((p) => p.y)),
        clear,
        hidden,
        finite: r.heldMesh.matrixWorld.elements.every(Number.isFinite),
      };
    });
    expect(frame.clear, id).toBe(true);
    expect(frame.hidden, id).toBe(true);
    expect(frame.finite, id).toBe(true);
    if (id === "diamond_sword") {
      expect(frame.minX).toBeGreaterThan(0.4);
      expect(frame.maxX).toBeGreaterThan(1);
      expect(frame.top).toBeGreaterThan(0.1);
      expect(frame.top).toBeLessThan(0.5);
      expect(frame.bottom).toBeLessThan(-1);
    }
    await page.screenshot({ path: `${out}/${id}-reference.png` });
  }
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});
test("a naturally generated village chest keeps its loot/floor position with corrected faces in all packs, opens normally, and village doors switch instantly", async ({
  page,
}) => {
  test.setTimeout(150000);
  const evidence = await boot(page);
  const w = new World("Wildflower");
  let v;
  for (let rz = -1; rz < 2 && !v; rz++)
    for (let rx = -1; rx < 2 && !v; rx++) v = villageAt(w, rx, rz);
  expect(v).toBeTruthy();
  const h = v.houses[0],
    floor = h.floor ?? v.y,
    target = { x: h.x + 1, y: floor + 1, z: h.z + 5, id: B.chest };
  await page.evaluate(
    ({ h, floor, target }) => {
      const g = dcsmcraft;
      g.pause();
      g.player.x = target.x + 2.5;
      g.player.y = floor + 1;
      g.player.z = target.z + 0.5;
      g.player.yaw = Math.PI / 2;
      g.player.pitch = -0.4;
      g.world.get(target.x, target.y, target.z);
      g.renderer.loadAround(g.player.x, g.player.z, 2, 9);
      g.ui.play();
    },
    { h, floor, target },
  );
  const key = `${target.x},${target.y},${target.z}`;
  await page.waitForFunction(
    (key) => dcsmcraft.renderer.worldAnimations.models.has(key),
    key,
  );
  const loot = await page.evaluate(
    (key) => JSON.stringify(dcsmcraft.world.containers[key].slots),
    key,
  );
  for (const pack of ["classic", "renewed", "supplied"]) {
    await page.evaluate((pack) => {
      const g = dcsmcraft;
      g.settings.texturePack = pack;
      g.renderer.applyGraphics();
    }, pack);
    await page.waitForFunction(
      (pack) => dcsmcraft.renderer.appliedPack === pack,
      pack,
    );
    const shape = await page.evaluate(
      ({ key, target }) => {
        const g = dcsmcraft,
          r = g.renderer;
        r.draw({
          game: g,
          player: g.player,
          playing: true,
          elapsed: g.elapsed,
          animating: false,
        });
        const m = r.worldAnimations.models.get(key),
          u = m.userData;
        let maps = 0,
          bad = 0;
        m.traverse((o) => {
          if (o.material?.map) {
            maps++;
            if (
              o.material.map !== r.atlas.texture ||
              ![...o.geometry.attributes.uv.array].every(
                (v) => v >= 0 && v <= 1,
              )
            )
              bad++;
          }
        });
        return {
          facing: g.world.containers[key].facing,
          angle: u.chestPivot.rotation.y,
          maps,
          bad,
          root: m.position.toArray(),
          loot: JSON.stringify(g.world.containers[key].slots),
        };
      },
      { key, target },
    );
    expect(shape.facing).toBe(1);
    expect(shape.angle).toBeCloseTo(-Math.PI / 2, 6);
    expect(shape.maps).toBeGreaterThanOrEqual(2);
    expect(shape.bad).toBe(0);
    expect(shape.root).toEqual([target.x, target.y, target.z]);
    expect(shape.loot).toBe(loot);
    await page.screenshot({ path: `${out}/village-chest-${pack}.png` });
  }
  await page.evaluate((target) => {
    const g = dcsmcraft;
    g.target = target;
    g.lastPlace = -1e6;
    g.use();
  }, target);
  await expect(page.locator(".container-grid")).toBeVisible();
  await page.waitForFunction(
    (key) =>
      dcsmcraft.renderer.worldAnimations.models.get(key)?.userData.openness >
      0.95,
    key,
  );
  await page.evaluate(() => {
    dcsmcraft.ui.overlay.style.visibility = "hidden";
  });
  await page.screenshot({ path: out + "/village-chest-open.png" });
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.closeCraft();
    g.ui.overlay.style.visibility = "";
    g.ui.play();
  });
  const door = { x: h.doorX, y: floor + 1, z: h.doorZ };
  const states = await page.evaluate((door) => {
    const g = dcsmcraft;
    const closed = g.world.get(door.x, door.y, door.z);
    g.target = { ...door, id: closed };
    g.lastPlace = -1e6;
    g.use();
    const opened = g.world.get(door.x, door.y, door.z);
    g.target = { ...door, id: opened };
    g.lastPlace = -1e6;
    g.use();
    return {
      closed,
      opened,
      again: g.world.get(door.x, door.y, door.z),
      animated: g.renderer.worldAnimations.models.has(
        `${door.x},${door.y},${door.z}`,
      ),
    };
  }, door);
  expect(states.opened).not.toBe(states.closed);
  expect(states.again).toBe(states.closed);
  expect(states.animated).toBe(false);
  expect(
    await page.evaluate(
      (key) => JSON.stringify(dcsmcraft.world.containers[key].slots),
      key,
    ),
  ).toBe(loot);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});
test("actual pistol damage to a distant mob is quiet, live Web Audio voices fade when moving away, and tornado layers follow funnel range", async ({
  page,
}) => {
  test.setTimeout(120000);
  const evidence = await boot(page);
  const hit = await page.evaluate(() => {
    const g = dcsmcraft,
      a = g.audio;
    g.settings.volume = 1;
    g.settings.mobSounds = true;
    g.settings.mobVolume = 1;
    g.settings.musicEnabled = false;
    g.settings.ambientSounds = false;
    a.unlock();
    a.updateVolume();
    g.inventory.slots[0] = { id: "matthew_dual_pistols", count: 1 };
    g.tickCount = 10000;
    g.elapsed = 100;
    const e = {
      id: "audio-target",
      type: "zombie",
      x: 0.5,
      y: 200,
      z: -25,
      hp: 20,
      vx: 0,
      vy: 0,
      vz: 0,
    };
    g.entities = [e];
    const events = [],
      original = a.world.bind(a);
    a.world = (...args) => {
      const result = original(...args);
      events.push({
        kind: args[1],
        x: args[2].x,
        y: args[2].y,
        z: args[2].z,
        result,
      });
      return result;
    };
    g.firePistols();
    return {
      hp: e.hp,
      events,
      positioned: a.positionedVoices?.size || 0,
      state: a.context.state,
    };
  });
  expect(hit.hp).toBeLessThan(20);
  expect(hit.events.some((e) => e.kind === "hit" && e.result === false)).toBe(
    true,
  );
  expect(hit.positioned).toBe(0);
  expect(hit.state).toBe("running");
  const initial = await page.evaluate(() => {
    const g = dcsmcraft,
      a = g.audio;
    g.entities = [];
    a.world(g, "thunder", { x: g.player.x + 3, y: g.player.y, z: g.player.z });
    window.__soundRecord = [...a.positionedVoices].at(-1);
    const initial = __soundRecord.volume.gain.value;
    g.player.x = 400;
    a.nextPositionMix = 0;
    a.updatePositioned(g);
    return initial;
  });
  expect(initial).toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(() => window.__soundRecord.volume.gain.value))
    .toBeLessThan(initial * 0.05);
  const weather = await page.evaluate(() => {
    const g = dcsmcraft,
      a = g.audio;
    g.player.x = 0.5;
    g.settings.ambientSounds = true;
    g.world.weather = {
      ...g.world.weather,
      kind: "tornado",
      intensity: 1,
      strike: null,
      funnel: { x: 0.5, z: 0.5, age: 0, seed: 1 },
    };
    g.running = true;
    a.nextAmbienceMix = 0;
    a.ambient(g);
    const near = {
      wind: a.soundscape.targets.wind,
      rumble: a.soundscape.targets.rumble,
    };
    g.world.weather.funnel.x = 400;
    a.nextAmbienceMix = 0;
    a.ambient(g);
    const far = {
      wind: a.soundscape.targets.wind,
      rumble: a.soundscape.targets.rumble,
    };
    g.running = false;
    g.settings.ambientSounds = false;
    return { near, far };
  });
  expect(weather.far.wind).toBeLessThan(weather.near.wind);
  expect(weather.far.rumble).toBe(0);
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.audio.positionedVoices.size))
    .toBe(0);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});
