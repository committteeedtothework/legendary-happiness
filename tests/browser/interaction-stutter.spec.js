import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html");
const out = "/workspace/artifacts/interaction-polish-2711";
mkdirSync(out, { recursive: true });
let server, origin;
test.use({ trace: "off" });
test.beforeAll(async () => {
  server = createServer((q, s) => {
    s.setHeader("Content-Type", "text/html");
    s.end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  server?.closeAllConnections();
  if (server) await new Promise((r) => server.close(r));
});
test("placing/breaking blocks, shaped items and containers uses snapshot workers, coalesces rapid edits, preserves boundaries and survives reload", async ({
  page,
}) => {
  test.setTimeout(180000);
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
          volume: 0,
          frameLimit: 30,
          ambientOcclusion: true,
        }),
      );
  });
  await page.route("**/*", (r) =>
    r
      .request()
      .url()
      .startsWith(origin + "/")
      ? r.continue()
      : (external.push(r.request().url()), r.abort()),
  );
  await page.goto(origin + "/interaction-stutter.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.active);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.entities = [];
    g.ui.play();
    const cx = Math.floor(g.player.x / 16),
      cz = Math.floor(g.player.z / 16);
    window.editSpot = { x: cx * 16 + 8, y: 200, z: cz * 16 + 8 };
    for (let z = cz - 2; z <= cz + 2; z++)
      for (let x = cx - 2; x <= cx + 2; x++) g.world.ensure(x, z);
    g.world.set(editSpot.x, 199, editSpot.z, 3);
    Object.assign(g.player, {
      x: editSpot.x + 2.5,
      y: 202,
      z: editSpot.z + 2.5,
      vy: 0,
      onGround: true,
    });
  });
  await page.waitForFunction(
    () =>
      dcsmcraft.renderer.streamSettled &&
      !dcsmcraft.renderer.jobs.size &&
      dcsmcraft.renderer.settledRevision === dcsmcraft.world.meshRevision,
  );
  await page.evaluate(() => {
    const r = dcsmcraft.renderer;
    window.editProfile = {
      syncRemesh: 0,
      snapshots: 0,
      snapshotBytes: 0,
      staleInstalled: 0,
      postTimes: {},
      latencies: [],
    };
    const rebuild = r.rebuild.bind(r);
    r.rebuild = (...a) => {
      editProfile.syncRemesh++;
      return rebuild(...a);
    };
    const install = r.installMesh.bind(r);
    r.installMesh = (x, z, g, s, e) => {
      if (e.ticket) {
        if (e.revision !== r.entryRevision(e)) editProfile.staleInstalled++;
        if (editProfile.postTimes[e.ticket])
          editProfile.latencies.push(
            performance.now() - editProfile.postTimes[e.ticket],
          );
      }
      return install(x, z, g, s, e);
    };
    for (const slot of r.workers) {
      const post = slot.worker.postMessage.bind(slot.worker);
      slot.worker.postMessage = (job, transfers) => {
        if (job.chunks) {
          editProfile.snapshots++;
          editProfile.snapshotBytes += (transfers || []).reduce(
            (s, b) => s + b.byteLength,
            0,
          );
          editProfile.postTimes[job.ticket] = performance.now();
        }
        return post(job, transfers);
      };
    }
  });
  const rows = await page.evaluate(() => {
    const g = dcsmcraft,
      r = g.renderer,
      rows = [];
    for (const id of [3, 17, 1422, 18, 0]) {
      g.world.set(editSpot.x, 200, editSpot.z, id);
      const old = editProfile.syncRemesh,
        t = performance.now();
      for (let i = 0; i < 12; i++) r.loadAround(g.player.x, g.player.z, 2, 1);
      rows.push({
        id,
        syncRemesh: editProfile.syncRemesh - old,
        loadMs: performance.now() - t,
      });
    }
    return rows;
  });
  expect(rows.every((r) => r.syncRemesh === 0)).toBe(true);
  await page.waitForFunction(
    () =>
      dcsmcraft.renderer.streamSettled &&
      !dcsmcraft.renderer.jobs.size &&
      dcsmcraft.renderer.settledRevision === dcsmcraft.world.meshRevision,
  );
  const operations = [];
  for (const [i, id] of [
    "stone",
    "oak_stairs",
    "glass_pane",
    "oak_fence",
    "chest",
    "torch",
    "furnace",
    "glass",
    "oak_slab",
  ].entries()) {
    await page.waitForFunction(
      () => dcsmcraft.elapsed - dcsmcraft.lastPlace >= 0.2,
    );
    const placement = await page.evaluate(
      ({ id, i }) => {
        const g = dcsmcraft,
          x = editSpot.x + (i >= 5 ? 7 : 0),
          y = 200,
          z = editSpot.z + (i >= 5 ? 7 : 0);
        g.world.set(x, y - 1, z, 3);
        g.inventory.selected = 0;
        g.inventory.slots[0] = { id, count: 64 };
        g.target = {
          x,
          y: y - 1,
          z,
          id: 3,
          normal: { x: 0, y: 1, z: 0 },
          distance: 3,
        };
        const t = performance.now();
        g.use();
        return { x, y, z, id: g.world.get(x, y, z), ms: performance.now() - t };
      },
      { id, i },
    );
    expect(placement.id, id).toBeGreaterThan(0);
    await page.waitForFunction(
      () =>
        dcsmcraft.renderer.streamSettled &&
        !dcsmcraft.renderer.jobs.size &&
        dcsmcraft.renderer.settledRevision === dcsmcraft.world.meshRevision,
    );
    if (id === "chest")
      expect(
        await page.evaluate(
          (p) =>
            dcsmcraft.renderer.worldAnimations.models.get(
              `${p.x},${p.y},${p.z}`,
            )?.userData.kind,
          placement,
        ),
      ).toBe("chest");
    const removal = await page.evaluate((p) => {
      const g = dcsmcraft,
        t = performance.now();
      g.breakBlock(p);
      return { id: g.world.get(p.x, p.y, p.z), ms: performance.now() - t };
    }, placement);
    expect(removal.id, id).toBe(0);
    await page.waitForFunction(
      () =>
        dcsmcraft.renderer.streamSettled &&
        !dcsmcraft.renderer.jobs.size &&
        dcsmcraft.renderer.settledRevision === dcsmcraft.world.meshRevision,
    );
    operations.push({ item: id, placeMs: placement.ms, breakMs: removal.ms });
  }
  const result = await page.evaluate(() => {
    const g = dcsmcraft,
      r = g.renderer;
    return {
      ...editProfile,
      postTimes: undefined,
      allBuffersAttached: [...g.world.chunks.values()].every(
        (c) => c.data.byteLength > 0,
      ),
      currentMeshes: [...r.meshes.entries()]
        .filter(([, m]) => !m.userData.horizon)
        .every(
          ([k, m]) => m.userData.revision === (g.world.revisions.get(k) || 0),
        ),
      fallback: r.workerFallback,
    };
  });
  expect(result.syncRemesh).toBe(0);
  expect(result.snapshots).toBeGreaterThan(10);
  expect(result.staleInstalled).toBe(0);
  expect(result.allBuffersAttached).toBe(true);
  expect(result.currentMeshes).toBe(true);
  expect(result.fallback).toBe(false);
  const report = { version: "2.7.11", rows, operations, ...result };
  writeFileSync(out + "/edit-profile.json", JSON.stringify(report, null, 2));
  console.log("EDIT_PROFILE " + JSON.stringify(report));
  await page.evaluate(() => {
    dcsmcraft.world.set(editSpot.x + 1, 200, editSpot.z, 17);
    return dcsmcraft.save();
  });
  const pos = await page.evaluate(() => ({ x: editSpot.x + 1, z: editSpot.z }));
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(() => dcsmcraft.active);
  expect(
    await page.evaluate((p) => dcsmcraft.world.get(p.x, 200, p.z), pos),
  ).toBe(17);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
