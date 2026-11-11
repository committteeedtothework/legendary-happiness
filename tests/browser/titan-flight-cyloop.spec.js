import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out = process.env.DCSMCRAFT_FLIGHT_ARTIFACTS || "test-results/flight";
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
  await page.goto(origin + "/titan.html");
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

async function portal(page, full = false) {
  await page.evaluate((full) => {
    const g = dcsmcraft;
    if (full)
      g.inventory.slots = Array.from({ length: 36 }, () => ({
        id: "stone",
        count: 64,
      }));
    for (let x = 0; x <= 10; x++)
      for (let z = 0; z <= 10; z++) {
        g.world.set(x, 199, z, 3);
        for (let y = 200; y < 206; y++) g.world.set(x, y, z, 0);
      }
    Object.assign(g.player, {
      x: 4.5,
      y: 200,
      z: 7,
      yaw: 0,
      pitch: 0,
      onGround: true,
      health: 17,
      hunger: 12,
      saturation: 3,
    });
    g.inventory.slots[0] = {
      id: "diamond_sword",
      count: 1,
      durability: 500,
      enchantments: { sharpness: 2 },
    };
    g.giganto.record.config.spawnChance = 0;
    g.giganto.record.portal = {
      id: "browser-titan",
      cell: "0,0",
      x: 4,
      y: 200,
      z: 4,
    };
    g.giganto.overworld(0.01);
    g.running = true;
    g.pointerLockFallback = true;
  }, full);
  await page.keyboard.press("KeyE");
  await page.waitForFunction(
    () =>
      dcsmcraft.giganto.active &&
      !dcsmcraft.giganto.pending &&
      dcsmcraft.giganto.view?.assetsReady,
  );
}

test("base Sonic draws a Cyloop using actual movement keys, releases rings and reloads pickups without duplicate awards", async ({
  page,
}) => {
  test.setTimeout(180000);
  const ev = await boot(page);
  await portal(page);
  await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    g.pause();
    Object.assign(s, {
      stage: "traversal",
      emerald: false,
      stageTime: 10,
      time: 10,
    });
    Object.assign(s.config, {
      graphicsQuality: "low",
      shadowQuality: "off",
      postProcessing: false,
      audio: false,
      music: false,
      dynamicSky: false,
      arenaWeather: "clear",
    });
    Object.assign(s.avatar, {
      x: -115,
      y: 0.05,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: 0,
      onGround: true,
    });
    e.controls.clear();
    g.ui.play();
    g.running = true;
  });
  await page.keyboard.down("KeyC");
  for (const [key, axis, sign] of [
    ["KeyW", "z", -1],
    ["KeyD", "x", 1],
    ["KeyS", "z", 1],
    ["KeyA", "x", -1],
  ]) {
    const start = await page.evaluate(
      (axis) => dcsmcraft.giganto.session.avatar[axis],
      axis,
    );
    await page.keyboard.down(key);
    await page
      .waitForFunction(
        ({ axis, sign, start }) =>
          sign * (dcsmcraft.giganto.session.avatar[axis] - start) > 7,
        { axis, sign, start },
        { timeout: 10000 },
      )
      .catch(async () => {
        throw Error("Movement did not reach Cyloop edge " + key);
      });
    await page.keyboard.up(key);
    if (key === "KeyD")
      await page.screenshot({ path: out + "/cyloop-open.png" });
  }
  await page.keyboard.up("KeyC");
  await page.waitForFunction(
    () => dcsmcraft.giganto.session.grassCyloop.serial === 1,
  );
  await page.screenshot({ path: out + "/cyloop-rings.png" });
  const saved = await page.evaluate(async () => {
    const g = dcsmcraft,
      e = g.giganto;
    g.pause();
    await g.save();
    return {
      id: g.id,
      rings: e.session.rings,
      drops: e.session.grassCyloop.drops.map((d) => d.id),
      serial: e.session.grassCyloop.serial,
    };
  });
  expect(saved.drops.length).toBeGreaterThan(0);
  expect(saved.rings).toBeGreaterThanOrEqual(80);
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.pause();
  }, saved.id);
  await page.waitForFunction(() => dcsmcraft.giganto.view?.assetsReady);
  const loaded = await page.evaluate(() => {
    const s = dcsmcraft.giganto.session;
    return {
      rings: s.rings,
      drops: s.grassCyloop.drops.map((d) => d.id),
      serial: s.grassCyloop.serial,
    };
  });
  expect(loaded).toEqual({
    rings: saved.rings,
    drops: saved.drops,
    serial: saved.serial,
  });
  const picked = await page.evaluate(async () => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    g.ui.play();
    e.controls.clear();
    for (const d of [...s.grassCyloop.drops]) {
      d.age = 1;
      Object.assign(s.avatar, {
        x: d.x,
        z: d.z,
        y: 0.05,
        vx: 0,
        vy: 0,
        vz: 0,
        onGround: true,
      });
      g.running = true;
      e.frame(1 / 60);
      g.running = false;
    }
    e.view.draw(s, 0);
    await g.save();
    const value = s.rings;
    await g.loadWorld(g.id);
    g.pause();
    return {
      before: value,
      after: g.giganto.session.rings,
      drops: g.giganto.session.grassCyloop.drops.length,
    };
  });
  expect(picked).toEqual({ before: 120, after: 120, drops: 0 });
  expect(ev.errors).toEqual([]);
  expect(ev.external).toEqual([]);
  writeFileSync(
    out + "/grass-cyloop-report.json",
    JSON.stringify(
      {
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        saved,
        loaded,
        picked,
        errors: ev.errors,
      },
      null,
      2,
    ),
  );
});

test("Super Sonic flight and all abilities render through the real rig with no blue ribbon, stable body scale and bounded effects", async ({
  page,
}) => {
  test.setTimeout(300000);
  const ev = await boot(page);
  await portal(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  const samples = [];
  for (const [name, action, move, velocity] of [
    ["hover", "idle", null, [0, 0, 0]],
    ["flight-forward", "idle", null, [0, 0, -17]],
    ["flight-rise", "idle", null, [0, 8, 0]],
    ["flight-strafe", "idle", null, [17, 0, 0]],
    ["boost", "idle", null, [0, 0, -36]],
    ["punch", "punch", "punch", [0, 0, 0]],
    ["combo", "punch", "combo", [0, 0, 0]],
    ["heavy", "punch", "heavy", [0, 0, 0]],
    ["finisher", "punch", "finisher", [0, 0, 0]],
    ["homing", "homing", "homing", [0, 0, 0]],
    ["sonic-boom", "boom", "boom", [0, 0, 0]],
    ["wild-rush", "rush", "rush", [0, 0, 0]],
    ["cyloop", "loop", "loop", [0, 0, 0]],
    ["cross-slash", "cross", "cross", [0, 0, 0]],
    ["homing-shot", "shot", "shot", [0, 0, 0]],
    ["stomp", "stomp", "stomp", [0, 0, 0]],
    ["spin", "spin", "spin", [0, 0, 0]],
    ["cyclone", "cyclone", "cyclone", [0, 0, 0]],
    ["parry", "idle", null, [0, 0, 0]],
    ["dodge", "dodge", null, [0, 0, 0]],
    ["damage", "hurt", null, [0, 0, 0]],
    ["counter", "counter", "counter", [0, 0, 0]],
  ]) {
    const result = await page.evaluate(
      ({ name, action, move, velocity }) => {
        const g = dcsmcraft,
          e = g.giganto,
          s = e.session,
          v = e.view;
        g.running = false;
        e.controls.clear();
        Object.assign(s, {
          stage: "combat",
          emerald: true,
          won: false,
          phase: 1,
          stageTime: 30,
          time: 30,
          action,
          actionTime: 0,
          attack: "idle",
          qte: null,
          counterScene: null,
          lock: false,
          boosting: name === "boost",
          parryHeld: name === "parry",
        });
        Object.assign(s.config, {
          graphicsQuality: "balanced",
          shadowQuality: "low",
          postProcessing: true,
          ambientOcclusion: "low",
          audio: false,
          music: false,
          dynamicSky: false,
          arenaWeather: "clear",
          motionBlur: false,
        });
        Object.assign(s.avatar, {
          x: 0,
          y: 57,
          z: 52,
          yaw: 0,
          pitch: 0,
          vx: velocity[0],
          vy: velocity[1],
          vz: velocity[2],
          onGround: false,
        });
        const lengths = {
          punch: 0.32,
          combo: 0.35,
          heavy: 0.4,
          finisher: 0.55,
          homing: 0.72,
          boom: 1.1,
          rush: 0.8,
          loop: 3.1,
          cross: 0.8,
          shot: 1.15,
          counter: 1.2,
          stomp:1.05,spin:1.05,cyclone:1.3,
        };
        const at = {
          punch: 0.13,
          combo: 0.15,
          heavy: 0.18,
          finisher: 0.25,
          homing: 0.48,
          boom: 0.3,
          rush: 0.4,
          loop: 1.6,
          cross: 0.24,
          shot: 0.6,
          counter: 0.48,
          stomp:0.58,spin:0.43,cyclone:0.7,
        };
        s.strike = move
          ? {
              move,
              kind: move === "punch" ? "basic" : move,
              elapsed: at[move],
              duration: lengths[move],
              hand: "R",
              next: 0,
              direction: { x: 0, y: 0, z: -1 },
            }
          : null;
        s.actionTime = move
          ? lengths[move] - at[move]
          : action === "dodge"
            ? 0.2
            : action === "hurt"
              ? 0.3
              : 0;
        if (move === "loop")
          s.strike.orbit = {
            center: { x: 0, z: -7.5 },
            from: { x: 0, y: 57, z: 52 },
            angle: 0,
            height: 57,
          };
        const before = { x: s.avatar.x, y: s.avatar.y, z: s.avatar.z };
        v.draw(s, 0.3);
        v.draw(s, 1 / 60);
        v.draw(s, 1 / 60);
        const u = v.sonic.userData;
        let meshes = 0;
        v.sonic.traverse((o) => {
          if (o.isMesh) meshes++;
        });
        const q = {
          name,
          clip: u.currentClip,
          trails: v.trails.count,
          trailVisible: v.trails.visible,
          scale: v.sonic.scale.toArray(),
          meshes,
          positionStable: ["x", "y", "z"].every(
            (k) => s.avatar[k] === before[k],
          ),
          finite: [...(u.bones ? Object.values(u.bones) : [])].every((b) =>
            b.quaternion.toArray().every(Number.isFinite),
          ),
          lastPassDrawCalls: g.renderer.gl.info.render.calls,
          triangles: g.renderer.gl.info.render.triangles,
          anisotropy: v.arena.userData.surfaceFiltering,
        };
        if (
          [
            "hover",
            "flight-forward",
            "boost",
            "sonic-boom",
            "homing-shot",
          ].includes(name)
        ) {
          const start = performance.now();
          for (let i = 0; i < 5; i++) v.draw(s, 1 / 60);
          q.renderSubmissionMilliseconds = (performance.now() - start) / 5;
        }
        return q;
      },
      { name, action, move, velocity },
    );
    expect(result.trails).toBe(0);
    expect(result.trailVisible).toBe(false);
    expect(result.positionStable).toBe(true);
    expect(result.finite).toBe(true);
    expect(result.scale[0]).toBe(result.scale[1]);
    expect(result.scale[1]).toBe(result.scale[2]);
    samples.push(result);
    if (
      [
        "hover",
        "flight-forward",
        "boost",
        "sonic-boom",
        "cyloop",
        "homing-shot",
      ].includes(name)
    )
      await page.screenshot({ path: out + "/" + name + ".png" });
  }
  expect(samples.find((s) => s.name === "hover").clip).toBe("fly");
  expect(samples.find((s) => s.name === "flight-forward").clip).toBe(
    "flight_forward",
  );
  expect(samples.find((s) => s.name === "flight-rise").clip).toBe(
    "flight_rise",
  );
  expect(samples.find((s) => s.name === "boost").clip).toBe("boost_flight");
  expect(new Set(samples.map((s) => s.meshes)).size).toBe(1);
  expect(ev.errors).toEqual([]);
  expect(ev.external).toEqual([]);
  writeFileSync(
    out + "/flight-render-report.json",
    JSON.stringify(
      {
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        samples,
        errors: ev.errors,
      },
      null,
      2,
    ),
  );
});

test("the native encounter completes both rebalanced phases, defeat, retry and the finishing explosion without changing the world state", async ({
  page,
}) => {
  test.setTimeout(150000);
  const ev = await boot(page);
  await portal(page);
  await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    g.pause();
    Object.assign(s, {
      stage: "combat",
      emerald: true,
      rings: 0.001,
      checkpoint: "combat",
      stageTime: 0,
      time: 0,
    });
    Object.assign(s.config, {
      audio: false,
      music: false,
      graphicsQuality: "low",
      postProcessing: false,
      shadowQuality: "off",
    });
    g.ui.play();
    g.running = true;
    e.frame(1 / 60);
    g.running = false;
  });
  await expect(page.locator('[data-titan="retry"]')).toBeVisible();
  await page.locator('[data-titan="retry"]').click();
  await page.waitForFunction(
    () => dcsmcraft.giganto.session.stage === "combat",
  );
  const result = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session,
      v = e.view;
    g.running = false;
    g.ui.play();
    e.controls.clear();
    Object.assign(s, {
      stage: "combat",
      emerald: true,
      phase: 1,
      hp: s.maxHp,
      rings: 400,
      stageTime: 0,
      time: 0,
    });
    Object.assign(s.avatar, { x: 0, y: 57, z: 5, onGround: false });
    Object.assign(s.config, {
      audio: false,
      music: false,
      graphicsQuality: "low",
      postProcessing: false,
      shadowQuality: "off",
    });
    const original = JSON.stringify(s.original),
      draw = v.draw;
    v.draw = () => {};
    let hits = 0;
    const moves = new Set(),
      phases = new Set();
    for (
      let i = 0;
      i < 60 * 250 && !["victory", "defeat"].includes(s.stage);
      i++
    ) {
      if (s.qte && i % 5 === 0) e.input("jump");
      if (i % 5 === 0) for (const a of ["boom", "rush"]) e.input(a);
      if (i % 5 === 0 && !s.stagger && s.staggerRest <= 0) e.input("loop");
      const p = s.avatar,
        dx = s.boss.x + Math.sin(s.boss.yaw) * 5 - p.x,
        dz = s.boss.z + Math.cos(s.boss.yaw) * 5 - p.z,
        d = Math.hypot(dx, dz);
      if (d > 1) p.yaw = Math.atan2(-dx, -dz);
      e.controls.clear();
      e.controls.add("Mouse0");
      e.controls.add("Mouse2");
      if (d > 1) e.controls.add("KeyW");
      if (p.y < 56) e.controls.add("Space");
      if (p.y > 58) e.controls.add("ControlLeft");
      g.running = true;
      e.frame(1 / 60);
      g.running = false;
      hits += s.events.filter((v) => v.type === "hit").length;
      if (s.attack !== "idle") moves.add(s.attack);
      phases.add(s.phase);
    }
    e.controls.clear();
    v.draw = draw;
    v.draw(s, 0.3);
    const victory = {
      stage: s.stage,
      hp: s.hp,
      maxHp: s.maxHp,
      time: s.time,
      rings: s.rings,
      portal: !!s.returnPortal,
      phases: [...phases],
      moves: [...moves],
      hits,
      bodyVisible: v.boss.visible,
      originalUnchanged: JSON.stringify(s.original) === original,
    };
    return victory;
  });
  expect(result.stage).toBe("victory");
  expect(result.maxHp).toBe(120000);
  expect(result.phases).toEqual([1, 2]);
  expect(result.time).toBeGreaterThan(40);
  expect(result.time).toBeLessThan(180);
  expect(result.portal).toBe(true);
  expect(result.bodyVisible).toBe(false);
  expect(result.originalUnchanged).toBe(true);
  await page.screenshot({ path: out + "/victory.png" });
  expect(ev.errors).toEqual([]);
  expect(ev.external).toEqual([]);
  writeFileSync(
    out + "/combat-report.json",
    JSON.stringify(
      {
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        result,
        errors: ev.errors,
      },
      null,
      2,
    ),
  );
});

test('Giganto parry leads into a golden Homing Attack with physical contact and no energy HUD',async({page})=>{
 const ev=await boot(page);await portal(page);
 const result=await page.evaluate(()=>{
  const g=dcsmcraft,e=g.giganto,s=e.session,v=e.view;g.running=false;g.ui.play();g.running=false;
  Object.assign(s,{stage:'combat',emerald:true,rings:400,stageTime:0,time:0,strike:null,qte:null,counterScene:null,action:'idle',actionTime:0,attack:'swing',attackTime:1.5,idle:100,iframes:0,parryHeld:false});
  Object.assign(s.config,{audio:false,music:false,drain:0,colossalScale:false,adaptiveBoss:false,bossMobility:false,graphicsQuality:'low',postProcessing:false,shadowQuality:'off'});Object.assign(s.avatar,{x:0,y:57,z:18,vx:0,vy:0,vz:0,yaw:0,pitch:0,onGround:false});
  const draw=v.draw,hud=e.updateHUD;v.draw=()=>{};e.updateHUD=()=>{};let parried=false,launches=0,hits=0;
  e.controls=new Set(['Mouse2']);for(let i=0;i<100&&!parried;i++){g.running=true;e.frame(1/60);g.running=false;parried=s.events.some(e=>e.type==='parry');}e.controls.clear();
  const from={...s.avatar};for(let i=0;i<18;i++){g.running=true;e.frame(1/60);g.running=false;launches+=s.events.filter(e=>e.type==='homing').length;hits+=s.events.filter(e=>e.type==='hit'&&e.kind==='homing').length;}
  v.draw=draw;e.updateHUD=hud;for(let i=0;i<90;i++)v.draw(s,1/60);e.updateHUD();e.hud.hidden=false;
  window.gigantoHomingEvidence={parried,from,launches,hits};
  return {...gigantoHomingEvidence,phase:s.strike?.homing?.phase,ball:v.jumpBall.group.visible,rig:v.sonic.userData.model.visible,color:v.jumpBall.core.material.color.getHexString(),energyNodes:e.hud.querySelectorAll('#titan-energy,#titan-boost,.titan-energy-track').length};
 });
 expect(result.parried).toBe(true);expect(result.hits).toBe(0);expect(result.phase).toBe('flight');expect(result.ball).toBe(true);expect(result.rig).toBe(false);expect(result.color).toBe('ffd331');expect(result.energyNodes).toBe(0);
 await page.screenshot({path:out+'/giganto-parry-homing.png'});
 const end=await page.evaluate(()=>{const g=dcsmcraft,e=g.giganto,v=e.view,s=e.session,draw=v.draw,hud=e.updateHUD;v.draw=()=>{};e.updateHUD=()=>{};for(let i=0;i<120;i++){g.running=true;e.frame(1/60);g.running=false;gigantoHomingEvidence.hits+=s.events.filter(e=>e.type==='hit'&&e.kind==='homing').length;gigantoHomingEvidence.launches+=s.events.filter(e=>e.type==='homing').length;}v.draw=draw;e.updateHUD=hud;return {...gigantoHomingEvidence,strike:s.strike};});
 expect(end.hits).toBe(1);expect(end.launches).toBe(1);expect(end.strike).toBeNull();expect(ev.errors).toEqual([]);expect(ev.external).toEqual([]);writeFileSync(out+'/giganto-homing-results.json',JSON.stringify({result,end},null,2));
});
