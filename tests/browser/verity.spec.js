import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { B } from "../../src/data.js";
const out = process.env.DCSMCRAFT_TEST_ARTIFACTS || "test-results/verity";
mkdirSync(out, { recursive: true });
test("Lord Verity appears as a rigged 3D character; dance input, pause/resume, completion, camera and local music settings work", async ({
  page,
}) => {
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/youtube/.test(r.url())) external.push(r.url());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({
        graphics: 1,
        renderDistance: 2,
        frameLimit: 20,
        volume: 0,
        musicEnabled: false,
        ambientSounds: false,
      }),
    ),
  );
  await page.goto("/");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=difficulty]").selectOption("peaceful");
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.active);
  await page.evaluate(async (B) => {
    const g = dcsmcraft;
    g.pause();
    g.rules.doMobSpawning = false;
    g.entities = [];
    g.drops = [];
    for (let x = -12; x <= 12; x++)
      for (let z = -12; z <= 12; z++) {
        g.world.set(x, 199, z, B.stone);
        for (let y = 200; y < 207; y++) g.world.set(x, y, z, B.air);
      }
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 3.5,
      yaw: 0,
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: true,
      health: 20,
      fallStart: 200,
    });
    g.cameraMode = 0;
    const { summonVerity, tickVerity } =
      await import("/src/verity-simulation.js");
    if (!summonVerity(g)) throw Error("No safe spawn");
    tickVerity(g);
    g.ui.play();
    g.running = true;
  }, B);
  await expect(page.locator("#verity-hud")).toBeVisible();
  await page.waitForFunction(
    () =>
      dcsmcraft.renderer.verityVisuals.model &&
      dcsmcraft.player.verityDance?.phase === "dance",
  );
  const mesh = await page.evaluate(() => {
    const v = dcsmcraft.renderer.verityVisuals,
      a = [];
    v.model.traverse((o) => {
      if (o.isSkinnedMesh)
        a.push({
          bones: o.skeleton.bones.length,
          vertices: o.geometry.attributes.position.count,
        });
    });
    return {
      meshes: a,
      clip: v.clip,
      position: {
        x: dcsmcraft.player.x,
        y: dcsmcraft.player.y,
        z: dcsmcraft.player.z,
      },
      cameraMode: dcsmcraft.cameraMode,
    };
  });
  expect(mesh.meshes.length).toBeGreaterThan(3);
  expect(mesh.meshes[0].bones).toBe(18);
  expect(mesh.clip).toBe("VerityDance");
  expect(mesh.cameraMode).toBe(0);
  const motionBefore = await page.evaluate(() => {
    const m = dcsmcraft.renderer.verityVisuals.model;
    let bones;
    m.traverse((o) => {
      if (!bones && o.isSkinnedMesh) bones = o.skeleton.bones;
    });
    return bones.flatMap((b) => b.quaternion.toArray());
  });
  await page.waitForTimeout(500);
  const motionAfter = await page.evaluate(() => {
    const m = dcsmcraft.renderer.verityVisuals.model;
    let bones;
    m.traverse((o) => {
      if (!bones && o.isSkinnedMesh) bones = o.skeleton.bones;
    });
    return bones.flatMap((b) => b.quaternion.toArray());
  });
  expect(
    motionAfter.some((n, i) => Math.abs(n - motionBefore[i]) > 0.005),
  ).toBe(true);
  await page.screenshot({
    path: out + "/lord-verity-dance.png",
    timeout: 90000,
  });
  await page.evaluate(() => dcsmcraft.pause());
  const paused = await page.evaluate(() => dcsmcraft.player.verityDance.time);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => dcsmcraft.player.verityDance.time)).toBe(
    paused,
  );
  await page.locator("[data-action=verity-settings]").click();
  await page.evaluate(() => {
    dcsmcraft.settings.musicEnabled = true;
    dcsmcraft.settings.volume = 0.3;
    dcsmcraft.settings.musicVolume = 0.5;
  });
  await page
    .locator("#verity-mp3")
    .setInputFiles({
      name: "dance-test.mp3",
      mimeType: "audio/mpeg",
      buffer: readFileSync(new URL("../fixtures/verity-tone.mp3",import.meta.url)),
    });
  await expect(page.locator("#verity-file-status")).toHaveText("MP3 ready.");
  await page.locator("[data-action=back]").click();
  await page.locator("[data-action=resume]").click();
  await page.waitForFunction(
    () => dcsmcraft.verity.music.media && !dcsmcraft.verity.music.media.paused,
    null,
    { timeout: 15000 },
  );
  await page.evaluate(() => dcsmcraft.pause());
  expect(await page.evaluate(() => dcsmcraft.verity.music.media.paused)).toBe(
    true,
  );
  await page.locator("[data-action=resume]").click();
  await page.waitForFunction(
    () => dcsmcraft.verity.music.media && !dcsmcraft.verity.music.media.paused,
  );
  await page.evaluate(async () => {
    const { scoreVerityStep, VERITY } =
      await import("/src/verity-simulation.js");
    const g = dcsmcraft,
      d = g.player.verityDance,
      beat = Math.round(d.time / VERITY.beat);
    d.time = beat * VERITY.beat;
    scoreVerityStep(g, g.player, VERITY.steps[beat % 8]);
    g.world.settlements["lord-verity"].active.age=VERITY.arrival+VERITY.beats*VERITY.beat-.1;
  });
  await page.waitForFunction(() => !dcsmcraft.player.verityDance, null, {
    timeout: 45000,
  });
  await expect(page.locator("#verity-hud")).toBeHidden();
  expect(await page.evaluate(() => dcsmcraft.cameraMode)).toBe(0);
  const after = await page.evaluate(() => ({
    position: {
      x: dcsmcraft.player.x,
      y: dcsmcraft.player.y,
      z: dcsmcraft.player.z,
    },
    music: dcsmcraft.verity.music.state,
    source: dcsmcraft.settings.verityMusic,
    rendererErrors: dcsmcraft.renderer.verityVisuals.error || null,
  }));
  expect(after.position.x).toBeCloseTo(mesh.position.x);
  expect(after.position.z).toBeCloseTo(mesh.position.z);
  expect(after.rendererErrors).toBeNull();
  expect(after.music).toBe("idle");
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  writeFileSync(
    out + "/encounter.json",
    JSON.stringify(
      {
        mesh,
        after,
        pausedClock: true,
        animatedBonesVerified: true,
        localMP3PlayedPausedResumed: true,
        errors,
        external,
      },
      null,
      2,
    ),
  );
});

test.describe('supplied Lord Verity soundtrack and controls',()=>{
 test.use({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1'});
 test('the entire longer encounter plays the supplied song from zero, accepts S/Down, stick and touch, and restarts at zero next visit',async({page})=>{
  test.setTimeout(240000);const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/youtube/.test(r.url()))external.push(r.url())});
  await page.goto('/');await page.waitForFunction(()=>window.dcsmcraft?.initialized);await page.locator('[data-action=create]').tap();await page.locator('[name=difficulty]').selectOption('peaceful');await page.locator('[data-action=start-world]').tap();await page.waitForFunction(()=>dcsmcraft.active&&dcsmcraft.running);await page.waitForTimeout(400);
  await page.evaluate(async B=>{const g=dcsmcraft;g.entities=[];g.drops=[];g.rules.doMobSpawning=false;for(let x=-12;x<=12;x++)for(let z=-12;z<=12;z++){g.world.set(x,199,z,B.stone);for(let y=200;y<207;y++)g.world.set(x,y,z,B.air);}Object.assign(g.player,{x:.5,y:200,z:3.5,yaw:0,pitch:0,vx:0,vy:0,vz:0,onGround:true,health:20,fallStart:200});Object.assign(g.settings,{volume:.2,musicVolume:.5,musicEnabled:true,verityMusic:'supplied'});g.audio.unlock();const {summonVerity}=await import('/src/verity-simulation.js');if(!summonVerity(g))throw Error('No safe floor');},B);
  await page.waitForFunction(()=>dcsmcraft.verity.music.media&&!dcsmcraft.verity.music.media.paused);const start=await page.evaluate(()=>({time:dcsmcraft.verity.music.media.currentTime,duration:dcsmcraft.verity.music.media.duration,buffered:dcsmcraft.verity.music.buffered,id:dcsmcraft.verity.id,position:{x:dcsmcraft.player.x,z:dcsmcraft.player.z}}));expect(start.time).toBeLessThan(1.2);expect(start.duration).toBeCloseTo(140.852245,1);expect(start.buffered).toBe(true);
  const hit=async(step,action)=>{await page.waitForFunction(step=>{const d=dcsmcraft.player.verityDance;if(d?.phase!=='dance')return false;let beat=Math.max(0,Math.ceil((d.time-.31)/(60/112)));while(d.used.includes(beat))beat++;return ['left','right','kick','clap'][beat%4]===step&&d.time-beat*60/112>=-.2&&d.time-beat*60/112<=-.08;},step);const score=await page.evaluate(()=>dcsmcraft.player.verityDance.score);await action();await expect.poll(()=>page.evaluate(()=>dcsmcraft.player.verityDance.score)).toBeGreaterThan(score);};
  await hit('clap',()=>page.keyboard.press('s'));await hit('clap',()=>page.keyboard.press('ArrowDown'));
  await page.evaluate(()=>{window.verityPad={id:'Xbox 360 Controller (XInput STANDARD GAMEPAD)',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.verityPad]});});
  await hit('left',()=>page.evaluate(()=>verityPad.axes[0]=-1));const heldScore=await page.evaluate(()=>dcsmcraft.player.verityDance.score);await page.waitForTimeout(2400);expect(await page.evaluate(()=>dcsmcraft.player.verityDance.score)).toBe(heldScore);await page.evaluate(()=>verityPad.axes[0]=0);
  await page.touchscreen.tap(800,300);await expect(page.locator('#verity-touch')).toBeVisible();await page.locator('#verity-touch button[aria-label=right]').tap();
  await page.locator('[data-touch=pause]').tap();const paused=await page.evaluate(()=>({song:dcsmcraft.verity.music.media.currentTime,dance:dcsmcraft.player.verityDance.time}));await page.waitForTimeout(400);expect(await page.evaluate(()=>dcsmcraft.verity.music.media.currentTime)).toBeCloseTo(paused.song,2);expect(await page.evaluate(()=>dcsmcraft.player.verityDance.time)).toBe(paused.dance);await page.locator('[data-action=resume]').tap();await page.waitForFunction(()=>!dcsmcraft.verity.music.media.paused);expect(await page.evaluate(()=>dcsmcraft.verity.music.media.currentTime)).toBeLessThan(paused.song+.7);
  await page.screenshot({path:out+'/supplied-song-dance.png'});
  // Let this encounter run naturally: no duration, age, HP or clock overrides.
  await page.waitForFunction(()=>!dcsmcraft.player.verityDance&&dcsmcraft.verity.music.state==='idle',null,{timeout:170000});const ended=await page.evaluate(()=>({music:dcsmcraft.verity.music.state,x:dcsmcraft.player.x,z:dcsmcraft.player.z,age:dcsmcraft.world.tick}));expect(ended.music).toBe('idle');expect(ended.x).toBe(start.position.x);expect(ended.z).toBe(start.position.z);
  await page.evaluate(()=>{const g=dcsmcraft;g.rules.doMobSpawning=true;g.world.settlements['lord-verity'].next=0;});await page.waitForFunction(id=>dcsmcraft.verity.id&&dcsmcraft.verity.id!==id&&dcsmcraft.verity.music.media&&!dcsmcraft.verity.music.media.paused,start.id);const restart=await page.evaluate(()=>dcsmcraft.verity.music.media.currentTime);expect(restart).toBeLessThan(1.2);expect(errors).toEqual([]);expect(external).toEqual([]);writeFileSync(out+'/supplied-song-controls.json',JSON.stringify({start,restart,paused,ended,fullEncounterUnaccelerated:true,keyboardSAndDown:true,stickEdgeAndHold:true,touchHandoff:true,noYouTubeRequests:true,errors,physicalIOSVerified:false},null,2));
 });
});
