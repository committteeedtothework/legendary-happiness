import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out = process.env.DCSMCRAFT_CONTROLLER_ARTIFACTS || "test-results/controller";
mkdirSync(out, { recursive: true });
let server, origin;
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
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Shader Error|GL_INVALID|WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  await page.addInitScript(() => {
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
      }),
    );
    window.pad = {
      id: "Xbox Wireless Controller (045e)",
      index: 0,
      connected: true,
      mapping: "standard",
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 18 }, () => ({ pressed: false, value: 0 })),
    };
    Object.defineProperty(navigator, "getGamepads", {
      value: () => (window.pad ? [window.pad] : []),
    });
  });
  await page.goto(origin);
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  return errors;
}
async function press(page, n) {
  await page.evaluate((n) => {
    pad.buttons[n] = { pressed: true, value: 1 };
    dcsmcraft.controller.frame(1 / 60);
  }, n);
  await page.waitForTimeout(80);
  await page.evaluate((n) => {
    pad.buttons[n] = { pressed: false, value: 0 };
    dcsmcraft.controller.frame(1 / 60);
  }, n);
  await page.waitForTimeout(60);
}
async function focus(page, selector) {
  await page.locator(selector).focus();
}
async function start(page) {
  await focus(page, "[data-action=create]");
  await press(page, 0);
  await expect(page.locator("[data-action=start-world]")).toBeVisible();
  await focus(page, "[name=mode][value=creative]");
  await press(page, 0);
  await focus(page, "[data-action=start-world]");
  await press(page, 0);
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.entities = [];
    g.world.set(0, 199, 0, 3);
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 0.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: 0,
      onGround: true,
    });
    g.pointerLockFallback = true;
  });
}
test("controller creates a world, operates analog movement, inventory transfers, settings, keyboard, pause and device handoff", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors = await boot(page);
  await press(page, 13);
  await expect(page.locator(".pad-focus")).toHaveCount(1);
  expect(await page.evaluate(() => dcsmcraft.controller.family)).toBe("xbox");
  await focus(page, "[data-action=settings]");
  await press(page, 0);
  await focus(page, "[data-action=controller-settings]");
  await press(page, 0);
  await expect(page.locator("#controller-status")).toContainText("Xbox");
  await page.screenshot({ path: out + "/controller-settings.png" });
  await focus(page, "[data-pad-setting=preset]");
  await page.selectOption("[data-pad-setting=preset]", "switch");
  await press(page, 13);
  expect(await page.evaluate(() => dcsmcraft.controller.family)).toBe("switch");
  await focus(page, "[data-pad-command=back]");
  await press(page, 1);
  await press(page, 0);
  await expect(page.locator("[data-action=create]")).toBeVisible();
  await page.evaluate(() => {
    dcsmcraft.settings.controller.preset = "auto";
    dcsmcraft.controller.frame(1 / 60);
  });
  await start(page);
  // Exercise analog travel on a clear platform, independently of seed foliage.
  await page.evaluate(() => {
    const g = dcsmcraft;
    for (let x = -6; x <= 6; x++)
      for (let z = -6; z <= 6; z++) {
        g.world.set(x, 199, z, 3);
        for (let y = 200; y < 205; y++) g.world.set(x, y, z, 0);
      }
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 0.5,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: true,
    });
  });
  const before = await page.evaluate(() => ({ ...dcsmcraft.player }));
  await page.evaluate(() => {
    pad.axes = [0.35, -0.6, 0.4, -0.2];
  });
  await expect
    .poll(async () =>
      page.evaluate(
        (before) =>
          Math.hypot(
            dcsmcraft.player.x - before.x,
            dcsmcraft.player.z - before.z,
          ),
        before,
      ),
    )
    .toBeGreaterThan(0.5);
  await page.evaluate(() => {
    pad.axes = [0, 0, 0, 0];
  });
  const after = await page.evaluate(() => ({ ...dcsmcraft.player }));
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(
    0.3,
  );
  expect(after.yaw).not.toBe(before.yaw);
  await press(page, 5);
  expect(await page.evaluate(() => dcsmcraft.inventory.selected)).toBe(1);
  await press(page, 3);
  await expect(page.locator("#overlay")).toBeVisible();
  expect(await page.evaluate(() => dcsmcraft.ui.screen)).toBe("inventory");
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.inventory.slots.fill(null);
    g.inventory.slots[9] = { id: "dirt", count: 12 };
    g.ui.creativeTab = "inventory";
    g.ui.buildInventory();
  });
  const slots = await page
    .locator(".slot[data-ref]")
    .evaluateAll((ns) => ns.map((n) => n.dataset.ref));
  writeFileSync(out + "/slot-refs.json", JSON.stringify(slots));
  await focus(page, '.slot[data-ref="inventory"][data-index="9"]');
  await press(page, 2);
  expect(await page.evaluate(() => dcsmcraft.inventory.cursor?.count)).toBe(6);
  expect(await page.evaluate(() => dcsmcraft.inventory.slots[9]?.count)).toBe(
    6,
  );
  await focus(page, '.slot[data-ref="inventory"][data-index="0"]');
  await press(page, 0);
  expect(await page.evaluate(() => dcsmcraft.inventory.slots[0]?.count)).toBe(
    6,
  );
  expect(await page.evaluate(() => dcsmcraft.inventory.cursor)).toBeNull();
  await press(page, 1);
  expect(await page.evaluate(() => dcsmcraft.ui.screen)).toBe("play");
  await press(page, 8);
  await expect(page.locator("#controller-actions")).toBeVisible();
  await press(page, 1);
  expect(await page.evaluate(() => dcsmcraft.ui.screen)).toBe("play");
  await press(page, 9);
  expect(await page.evaluate(() => dcsmcraft.running)).toBe(false);
  await press(page, 1);
  expect(await page.evaluate(() => dcsmcraft.running)).toBe(true);
  // An open text field is editable without a physical keyboard.
  await press(page, 15);
  await page.waitForTimeout(100);
  const input = page.locator("input:visible,textarea:visible").first();
  if (await input.count()) {
    await input.focus();
    await press(page, 0);
    await expect(page.locator("#controller-keyboard")).toBeVisible();
    await focus(page, "#controller-keyboard .pad-key-grid button:first-child");
    await press(page, 0);
    await focus(
      page,
      "#controller-keyboard .pad-key-actions button:nth-last-child(2)",
    );
    await press(page, 0);
    await expect(page.locator("#controller-keyboard")).toHaveCount(0);
  }
  await page.evaluate(() => {
    dcsmcraft.controller.clear();
    dcsmcraft.ui.play();
    dcsmcraft.running = true;
    pad.axes = [0, -1, 0, 0];
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    window.pad = null;
    dcsmcraft.controller.frame(1 / 60);
  });
  expect(await page.evaluate(() => dcsmcraft.running)).toBe(false);
  expect(await page.evaluate(() => dcsmcraft.controller.padKeys.size)).toBe(0);
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => dcsmcraft.controller.lastDevice)).toBe(
    "keyboard",
  );
  await page.evaluate(() => {
    window.pad = {
      id: "Raw USB pad",
      index: 0,
      connected: true,
      mapping: "",
      axes: [0, 0, 0, 0, -1, -1],
      buttons: [],
    };
    dcsmcraft.settings.controller = {
      preset: "custom",
      leftTriggerAxis: 4,
      rightTriggerAxis: 5,
    };
    dcsmcraft.controller.frame(1 / 60);
    pad.axes[5] = 1;
    dcsmcraft.controller.frame(1 / 60);
  });
  expect(await page.evaluate(() => dcsmcraft.controller.lastDevice)).toBe(
    "controller",
  );
  expect(errors).toEqual([]);
  writeFileSync(
    out + "/controller-evidence.json",
    JSON.stringify({ errors, before, after, slots }, null, 2),
  );
});
test("controller enters the larger arena, drives all new techniques, switches glyphs and pauses without changing overworld presets", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors = await boot(page);
  await start(page);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.ui.play();
    g.entities = [];
    for (let x = 0; x < 10; x++)
      for (let z = 0; z < 10; z++) g.world.set(x, 199, z, 3);
    Object.assign(g.player, { x: 4.5, y: 200, z: 7, vx: 0, vy: 0, vz: 0 });
    g.giganto.record.config.spawnChance = 0;
    g.giganto.record.portal = {
      id: "pad-titan",
      cell: "0,0",
      x: 4,
      y: 200,
      z: 4,
    };
    g.giganto.overworld(0.01);
    g.running = true;
  });
  await press(page, 6);
  await page.waitForFunction(
    () =>
      dcsmcraft.giganto.active &&
      !dcsmcraft.giganto.pending &&
      dcsmcraft.giganto.view?.assetsReady,
  );
  await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    g.running = false;
    g.ui.play();
    Object.assign(s, {
      stage: "combat",
      emerald: true,
      hp: s.maxHp,
      phase: 1,
      idle: 999,
      stageTime: 0,
      time: 0,
    });
    Object.assign(s.config, {
      audio: false,
      music: false,
      drain: 0,
      graphicsQuality: "low",
      postProcessing: false,
      shadowQuality: "off",
    });
  });
  const results = [];
  for (const [move, button, clip] of [
    ["stomp", 13, "stomp_attack"],
    ["spin", 15, "spin_slash"],
    ["cyclone", 14, "cyclone_kick"],
  ]) {
    await page.evaluate(() => {
      const s = dcsmcraft.giganto.session;
      Object.assign(s, {
        strike: null,
        action: "idle",
        actionTime: 0,
        energy: 100,
        attack: "idle",
        idle: 999,
        dodge: 0,
        qte: null,
        counterScene: null,
        knockback: null,
      });
      for (const k in s.cooldowns) s.cooldowns[k] = 0;
      Object.assign(s.avatar, {
        x: 0,
        y: 57,
        z: 5,
        vx: 0,
        vy: 0,
        vz: 0,
        onGround: false,
      });
      pad.buttons[4] = { pressed: true, value: 1 };
      dcsmcraft.controller.frame(1 / 60);
    });
    await press(page, button);
    expect(
      await page.evaluate(() => dcsmcraft.giganto.session.strike?.move),
    ).toBe(move);
    const result = await page.evaluate(() => {
      const g = dcsmcraft,
        e = g.giganto,
        s = e.session,
        hp = s.hp,
        draw = e.view.draw;
      e.view.draw = () => {};
      let hits = 0;
      for (let i = 0; i < 90; i++) {
        g.running = true;
        e.frame(1 / 60);
        g.running = false;
        hits += s.events.filter((e) => e.type === "hit").length;
        if (i === 30) draw.call(e.view, s, 1 / 60);
      }
      e.view.draw = draw;
      e.view.draw(s, 0);
      e.updateHUD();
      return {
        hits,
        damage: hp - s.hp,
        scale: s.config.titanScale,
        clipCount: e.view.sonic.userData.actions.size,
        clipNames: [...e.view.sonic.userData.actions.keys()],
      };
    });
    expect(result.hits).toBeGreaterThan(0);
    expect(result.damage).toBeGreaterThan(0);
    expect(result.scale).toBe(2.8);
    expect(result.clipNames).toEqual(expect.arrayContaining([clip,'jump_spin','boost_run','wall_run','traversal_slide']));
    results.push({ move, ...result });
    await page.evaluate(() => {
      pad.buttons[4] = { pressed: false, value: 0 };
    });
  }
  await page.evaluate(() => {
    const e = dcsmcraft.giganto,
      s = e.session;
    s.attack = "spin";
    s.attackTime = 3;
    s.time = 55;
    s.phase = 2;
    s.avatar.z = 25;
    e.view.draw(s, 1 / 60);
    e.updateHUD();
  });
  await page.screenshot({ path: out + "/larger-titan-controller.png" });
  await press(page, 9);
  await expect(page.locator("[data-titan=resume]")).toBeVisible();
  await page.locator("[data-titan=menu]").click();
  await expect(page.locator("[data-pad-setting]")).toHaveCount(0);
  await page.evaluate(() => {
    pad.id = "Sony DualSense 054c";
    dcsmcraft.controller.frame(1 / 60);
  });
  await press(page, 13);
  expect(await page.evaluate(() => dcsmcraft.controller.family)).toBe(
    "playstation",
  );
  await page.screenshot({ path: out + "/arena-controller-options.png" });
  expect(errors).toEqual([]);
  writeFileSync(
    out + "/arena-controller-evidence.json",
    JSON.stringify({ results, errors }, null, 2),
  );
});

test('controller tuning controls save their values and keep menu navigation independent of movement curves',async({page})=>{
 const errors=await boot(page);
 await page.evaluate(()=>{dcsmcraft.ui.settings();});await page.locator('[data-action="controller-settings"]').click();
 await expect(page.locator('[data-pad-setting="lookDeadzone"]')).toBeVisible();
 for(const [key,value] of [['deadzone','0.12'],['lookDeadzone','0.22'],['outerDeadzone','0.08'],['verticalLookScale','1.4'],['lookSmoothing','0.08'],['triggerThreshold','0.8']]){
  await page.locator(`[data-pad-setting="${key}"]`).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));},value);
 }
 await page.locator('[data-pad-setting="moveCurve"]').selectOption('precise');await page.locator('[data-pad-setting="lookCurve"]').selectOption('precision');await page.locator('[data-pad-setting="sprintMode"]').selectOption('hold');await page.locator('[data-pad-setting="invertX"]').check();
 const result=await page.evaluate(()=>{
  const g=dcsmcraft,c=g.controller;pad.axes=[0,0,0,0];c.frame(1/60);pad.axes=[0.6,0,0.6,0];c.frame(1/60);
  return {settings:g.settings.controller,saved:JSON.parse(localStorage.getItem('dcsmcraft-settings')).controller,move:c.raw.move,navigation:c.raw.navigationMove};
 });
 expect(result.saved).toEqual(result.settings);expect(result.settings.lookDeadzone).toBeCloseTo(0.22);expect(result.settings.lookSmoothing).toBeCloseTo(0.08);expect(result.settings.sprintMode).toBe('hold');expect(result.settings.invertX).toBe(true);expect(result.move.x).toBeLessThan(result.navigation.x);
 await page.screenshot({path:out+'/controller-tuning.png'});expect(errors).toEqual([]);writeFileSync(out+'/tuning-results.json',JSON.stringify(result,null,2));
});
