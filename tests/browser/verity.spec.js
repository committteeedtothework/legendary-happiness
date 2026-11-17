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
