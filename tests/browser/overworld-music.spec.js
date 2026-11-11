import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html");
let server, origin;
// Stream the exact file over loopback. Route.fulfill base64-encodes large HTML
// into a single DevTools message, exceeding the browser protocol's frame limit.
test.use({trace:"off"});
test.beforeAll(async()=>{
 server=createServer((request,response)=>{response.setHeader("Content-Type","text/html; charset=utf-8");response.end(html);});
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));origin=`http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async()=>{server?.closeAllConnections();if(server)await new Promise(resolve=>server.close(resolve));});
async function boot(page, mode = "survival") {
  const errors = [],
    external = [];
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
          graphics: 1,
          renderDistance: 2,
          distantTerrain: false,
          frameLimit: 30,
          musicEnabled: true,
          musicVolume: 0.5,
          volume: 0.5,
          ambientSounds: false,
          mobSounds: false,
        }),
      );
  });
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/overworld-music.html")
      ? r.continue()
      : (external.push(r.request().url()), r.abort()),
  );
  await page.goto(origin+"/overworld-music.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("C418 playlist review");
  await page.locator(`[name=mode][value=${mode}]`).check();
  await page.locator("[name=difficulty]").selectOption("peaceful");
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  if (mode === "survival")
    await page.waitForFunction(
      () => dcsmcraft.audio.music?.overworld.state === "playing",
    );
  return { errors, external };
}
async function meter(page, mode = "survival") {
  return page.evaluate(async (mode) => {
    const p =
        mode === "creative"
          ? dcsmcraft.audio.music.creative
          : dcsmcraft.audio.music.overworld,
      analyser = dcsmcraft.audio.context.createAnalyser();
    analyser.fftSize = 2048;
    p.output.connect(analyser);
    const data = new Float32Array(2048);
    let peak = 0;
    for (let i = 0; i < 30; i++) {
      analyser.getFloatTimeDomainData(data);
      for (const x of data) peak = Math.max(peak, Math.abs(x));
      await new Promise((r) => setTimeout(r, 12));
    }
    p.output.disconnect(analyser);
    analyser.disconnect();
    return peak;
  }, mode);
}
test("exact offline game plays all twelve full supplied Survival recordings through native media, cycles after real ended events and leaves no generated Overworld notes", async ({
  page,
}) => {
  test.setTimeout(180000);
  const r = await boot(page),
    order = [],
    peaks = [];
  for (let i = 0; i < 13; i++) {
    await page.waitForFunction(
      () => dcsmcraft.audio.music.overworld.state === "playing",
    );
    const info = await page.evaluate(() => {
      const g = dcsmcraft,
        p = g.audio.music.overworld,
        m = p.media;
      return {
        id: p.currentTrack.id,
        duration: m.duration,
        expected: p.currentTrack.duration,
        loop: m.loop,
        src: m.currentSrc.startsWith("data:audio/mpeg;base64,"),
        generated: g.audio.music.scheduled,
        pendingNotes: g.audio.music.events.length,
        liveGenerated: g.audio.music.sources.size,
      };
    });
    expect(info.duration).toBeCloseTo(info.expected, 0);
    expect(info.loop).toBe(false);
    expect(info.src).toBe(true);
    expect(info.generated).toBe(0);
    expect(info.pendingNotes).toBe(0);
    expect(info.liveGenerated).toBe(0);
    order.push(info.id);
    if (i < 12) {
      await page.evaluate(
        () => (dcsmcraft.audio.music.overworld.media.currentTime = 30),
      );
      await page.waitForFunction(
        () =>
          !dcsmcraft.audio.music.overworld.media.seeking &&
          dcsmcraft.audio.music.overworld.media.currentTime >= 30,
      );
      const peak = await meter(page);
      peaks.push(peak);
      expect(peak).toBeGreaterThan(0.00001);
    }
    if (i === 12) break;
    await page.evaluate(() => {
      const m = dcsmcraft.audio.music.overworld.media;
      m.currentTime = m.duration - 0.12;
    });
    await page.waitForFunction(
      () => dcsmcraft.audio.music.overworld.state === "waiting",
    );
    const delay = await page.evaluate(
      () =>
        dcsmcraft.audio.music.overworld.nextTrackAt -
        dcsmcraft.audio.context.currentTime,
    );
    expect(delay).toBeGreaterThan(7);
    expect(delay).toBeLessThanOrEqual(18);
    if (i > 0)
      await page.evaluate(
        () =>
          (dcsmcraft.audio.music.overworld.nextTrackAt =
            dcsmcraft.audio.context.currentTime),
      );
    await page.waitForFunction(
      () => dcsmcraft.audio.music.overworld.state === "playing",
      null,
      { timeout: 22000 },
    );
  }
  expect(new Set(order.slice(0, 12)).size).toBe(12);
  expect(order[12]).not.toBe(order[11]);
  expect(r.errors).toEqual([]);
  expect(r.external).toEqual([]);
  console.log(
    "C418 native playback",
    JSON.stringify({
      order,
      peaks,
      naturalFirstGap: true,
      laterGapsAccelerated: true,
      trackEndsReachedBySeeking: true,
    }),
  );
});
test("music controls persist, pause resumes the same position, Cinderworld keeps generated music, and quit/reload releases the old player", async ({
  page,
}) => {
  test.setTimeout(150000);
  const r = await boot(page);
  await page.evaluate(() => {
    const p = dcsmcraft.audio.music.overworld;
    window.reviewTrack = p.media;
    window.reviewId = p.currentTrack.id;
    p.media.currentTime = 45;
  });
  await page.waitForFunction(
    () => !reviewTrack.seeking && reviewTrack.currentTime >= 45,
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => reviewTrack.paused);
  const time = await page.evaluate(() => reviewTrack.currentTime);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => reviewTrack.currentTime)).toBe(time);
  await page.locator("[data-action=settings]").click();
  await expect(
    page.getByText(/Overworld music uses separate C418 playlists/),
  ).toBeVisible();
  await page.locator('[data-audio="musicEnabled"]').click();
  await expect(page.locator('[data-audio="musicEnabled"]')).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.locator('[data-setting="musicVolume"]').fill("0.2");
  await page.locator("[data-action=resume]").first().click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => reviewTrack.paused)).toBe(true);
  await page.keyboard.press("Escape");
  await page.locator("[data-action=settings]").click();
  await page.locator('[data-audio="musicEnabled"]').click();
  await page.locator("[data-action=resume]").first().click();
  await page.waitForFunction(
    () => dcsmcraft.audio.music.overworld.state === "playing",
  );
  expect(
    await page.evaluate(
      () => dcsmcraft.audio.music.overworld.media === reviewTrack,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => Math.abs(reviewTrack.currentTime - 45)),
  ).toBeLessThan(3);
  await page.evaluate(() => {
    dcsmcraft.settings.volume = 0;
    dcsmcraft.audio.updateVolume();
  });
  await page.waitForFunction(() => reviewTrack.paused);
  expect(await meter(page)).toBeLessThan(0.000001);
  await page.evaluate(() => {
    dcsmcraft.settings.volume = 0.5;
    dcsmcraft.audio.updateVolume();
  });
  await page.waitForFunction(() => !reviewTrack.paused);
  await page.evaluate(() =>
    dcsmcraft.travelDimension({ x: 0, y: 140, z: 0, axis: "x" }),
  );
  await page.waitForFunction(
    () =>
      dcsmcraft.dimension === "cinderwild" &&
      dcsmcraft.audio.music.enabled &&
      reviewTrack.paused,
  );
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.audio.music.events.length + dcsmcraft.audio.music.scheduled,
    ),
  ).toBeGreaterThan(0);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.travelDimension(
      Object.values(g.world.portals)[0] || { x: 0, y: 140, z: 0, axis: "x" },
    );
  });
  await page.waitForFunction(
    () =>
      dcsmcraft.dimension === "overworld" &&
      dcsmcraft.audio.music.overworld.state === "playing",
  );
  expect(
    await page.evaluate(
      () => dcsmcraft.audio.music.overworld.media === reviewTrack,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await page.locator("[data-action=quit]").click();
  await page.waitForFunction(() => dcsmcraft.ui.screen === "title");
  await page.waitForFunction(() => !dcsmcraft.audio.music.overworld.media);
  expect(
    await page.evaluate(
      () => reviewTrack.paused && !reviewTrack.getAttribute("src"),
    ),
  ).toBe(true);
  await page.reload();
  await page.waitForFunction(() => dcsmcraft.initialized);
  expect(await page.evaluate(() => dcsmcraft.settings.musicEnabled)).toBe(true);
  expect(await page.evaluate(() => dcsmcraft.settings.musicVolume)).toBe(0.2);
  await page.locator("#recent-world button").click();
  await page.waitForFunction(
    () => dcsmcraft.audio.music.overworld.state === "playing",
  );
  expect(r.errors).toEqual([]);
  expect(r.external).toEqual([]);
});

test("Creative plays only its six Beta tracks through a complete real native shuffle round", async ({
  page,
}) => {
  test.setTimeout(180000);
  const r = await boot(page, "creative"),
    order = [],
    peaks = [];
  for (let i = 0; i < 7; i++) {
    await page.waitForFunction(
      () => dcsmcraft.audio.music.creative.state === "playing",
    );
    const info = await page.evaluate(() => {
      const m = dcsmcraft.audio.music;
      return {
        id: m.creative.currentTrack.id,
        duration: m.creative.media.duration,
        expected: m.creative.currentTrack.duration,
        survivalPlaying: !!m.overworld.media && !m.overworld.media.paused,
        ids: m.creative.tracks.map((t) => t.id),
        legacy: m.scheduled,
      };
    });
    expect(info.ids).toContain(info.id);
    expect(info.survivalPlaying).toBe(false);
    expect(info.legacy).toBe(0);
    expect(info.duration).toBeCloseTo(info.expected, 0);
    order.push(info.id);
    if (i === 6) break;
    await page.evaluate(
      () => (dcsmcraft.audio.music.creative.media.currentTime = 30),
    );
    await page.waitForFunction(
      () =>
        !dcsmcraft.audio.music.creative.media.seeking &&
        dcsmcraft.audio.music.creative.media.currentTime >= 30,
    );
    const peak = await meter(page, "creative");
    peaks.push(peak);
    expect(peak).toBeGreaterThan(0.00001);
    await page.evaluate(() => {
      const p = dcsmcraft.audio.music.creative;
      p.media.currentTime = p.media.duration - 0.12;
    });
    await page.waitForFunction(
      () => dcsmcraft.audio.music.creative.state === "waiting",
    );
    await page.evaluate(
      () =>
        (dcsmcraft.audio.music.creative.nextTrackAt =
          dcsmcraft.audio.context.currentTime),
    );
  }
  expect(new Set(order.slice(0, 6)).size).toBe(6);
  expect(order[6]).not.toBe(order[5]);
  expect(r.errors).toEqual([]);
  expect(r.external).toEqual([]);
  console.log(
    "Creative C418 native playback",
    JSON.stringify({
      order,
      peaks,
      gapsAccelerated: true,
      trackEndsReachedBySeeking: true,
    }),
  );
});
test("switching modes pauses the old pool, plays only the new pool and resumes each song's own position", async ({
  page,
}) => {
  test.setTimeout(120000);
  const r = await boot(page, "creative");
  await page.waitForFunction(
    () => dcsmcraft.audio.music.creative.state === "playing",
  );
  await page.evaluate(() => {
    window.creativeReview = dcsmcraft.audio.music.creative.media;
    creativeReview.currentTime = 30;
  });
  await page.waitForFunction(
    () => !creativeReview.seeking && creativeReview.currentTime >= 30,
  );
  await page.evaluate(() => (dcsmcraft.mode = "survival"));
  await page.waitForFunction(
    () =>
      dcsmcraft.audio.music.overworld.state === "playing" &&
      creativeReview.paused,
  );
  await page.evaluate(() => {
    window.survivalReview = dcsmcraft.audio.music.overworld.media;
    survivalReview.currentTime = 40;
  });
  await page.waitForFunction(
    () => !survivalReview.seeking && survivalReview.currentTime >= 40,
  );
  const creativeTime = await page.evaluate(() => creativeReview.currentTime);
  await page.evaluate(() => (dcsmcraft.mode = "creative"));
  await page.waitForFunction(
    () =>
      dcsmcraft.audio.music.creative.state === "playing" &&
      survivalReview.paused,
  );
  expect(
    await page.evaluate(
      () => dcsmcraft.audio.music.creative.media === creativeReview,
    ),
  ).toBe(true);
  expect(await page.evaluate(() => creativeReview.currentTime)).toBeLessThan(
    creativeTime + 2,
  );
  await page.evaluate(() => {
    dcsmcraft.settings.musicEnabled = false;
  });
  await page.waitForFunction(
    () => creativeReview.paused && survivalReview.paused,
  );
  await page.waitForTimeout(180);
  expect(await meter(page, "creative")).toBeLessThan(0.000001);
  expect(r.errors).toEqual([]);
  expect(r.external).toEqual([]);
});
