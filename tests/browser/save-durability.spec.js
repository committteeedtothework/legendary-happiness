import { test, expect } from "@playwright/test";
import { createReadStream, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { B } from "../../src/data.js";

test.use({ trace: "off" });
test.setTimeout(180000);
let server, origin;
test.beforeAll(async () => {
  server = createServer((request, response) => {
    response.setHeader("Content-Type", "text/html");
    createReadStream("dist/DCSMCRAFT-Standalone.html").pipe(response);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

for (const backend of ["localstorage", "indexeddb"]) {
  test(`${backend}: denied writes remain honest, export latest state, preserve generations and recover after restart`, async ({
    page,
  }, testInfo) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((backend) => {
      localStorage.setItem(
        "dcsmcraft-settings",
        JSON.stringify({
          renderDistance: 2,
          graphics: 1,
          distantTerrain: false,
          volume: 0,
          musicEnabled: false,
          frameLimit: 30,
        }),
      );
      window.injectSaveFailure = false;
      if (backend === "localstorage") {
        Object.defineProperty(window, "indexedDB", {
          configurable: true,
          get() {
            throw new DOMException("IDB denied", "SecurityError");
          },
        });
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (
            window.injectSaveFailure &&
            key === "dcsmcraft-worlds-fallback-v1"
          )
            throw new DOMException(
              "World quota exceeded",
              "QuotaExceededError",
            );
          return set.call(this, key, value);
        };
      } else {
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
          const request = put.apply(this, args);
          if (window.injectSaveFailure && this.name === "worlds")
            request.addEventListener("success", () => this.transaction.abort());
          return request;
        };
      }
    }, backend);
    await page.goto(origin);
    await page
      .getByRole("button", { name: "Create New World", exact: true })
      .click();
    await page.locator("[name=seed]").fill("Wildflower");
    await page.locator("[name=name]").fill(`Durability ${backend}`);
    await page.getByRole("button", { name: "Create New World" }).click();
    await page.waitForFunction(() => dcsmcraft.active && dcsmcraft.running);
    const baseline = await page.evaluate(async (B) => {
      const g = dcsmcraft;
      g.pause();
      g.ui.play();
      g.inventory.slots[0] = {
        id: "iron_pickaxe",
        count: 1,
        durability: 91,
        enchantments: { efficiency: 2 },
      };
      g.world.set(16, 160, -1, B.planks);
      g.player.xp = 11;
      await g.save();
      g.player.xp = 22;
      const result = await g.save();
      return {
        id: g.id,
        generation: g.world.generationVersion,
        lastSaved: g.lastSaved,
        result,
        inventory: g.inventory.export(),
      };
    }, B);
    expect(baseline.result).toMatchObject({ status: "durable", backend });
    await expect(page.locator("#storage-warning")).toBeHidden();
    const failed = await page.evaluate(async () => {
      const g = dcsmcraft;
      window.injectSaveFailure = true;
      g.player.xp = 40;
      const first = g.save();
      g.player.xp = 50;
      const second = g.save();
      const results = await Promise.all([first, second]);
      return {
        results,
        lastSaved: g.lastSaved,
        live: (await g.store.load(g.id)).data.player.xp,
      };
    });
    expect(failed.results.map((r) => r.status)).toEqual([
      "session-only",
      "session-only",
    ]);
    expect(failed.lastSaved).toBe(baseline.lastSaved);
    expect(failed.live).toBe(50);
    await expect(page.locator("#save-status")).toHaveText(
      "SESSION ONLY · EXPORT TO KEEP",
    );
    await expect(page.locator("#storage-warning")).toContainText(
      "last durable save is unchanged",
    );
    // This newer change has not gone through save(): the persistent warning's
    // export must still include it, without waiting for or rotating any save.
    await page.evaluate(() => {
      dcsmcraft.player.xp = 77;
    });
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export latest backup" }).click();
    const download = await downloadPromise;
    const backup = JSON.parse(readFileSync(await download.path(), "utf8"));
    expect(backup.player.xp).toBe(77);
    expect(backup.inventory).toEqual(baseline.inventory);
    expect(backup.edits["16,160,-1"]).toBe(B.planks);
    expect(backup.generationVersion).toBe(baseline.generation);
    await page.screenshot({
      path: testInfo.outputPath(`${backend}-session-warning.png`),
    });
    await page.evaluate(() => dcsmcraft.quit());
    await expect(page.locator("#storage-warning")).toBeVisible();
    await page.reload();
    await page.locator("[data-action=load]").first().click();
    await page.waitForFunction(() => dcsmcraft.active && dcsmcraft.running);
    expect(
      await page.evaluate(() => ({
        id: dcsmcraft.id,
        xp: dcsmcraft.player.xp,
        version: dcsmcraft.world.generationVersion,
        inventory: dcsmcraft.inventory.export(),
      })),
    ).toEqual({
      id: baseline.id,
      xp: 22,
      version: baseline.generation,
      inventory: baseline.inventory,
    });
    await expect(page.locator("#storage-warning")).toBeHidden();
    // Corrupt only the current envelope through the real storage API. The
    // previous durable generation must still be 11, never a failed write.
    await page.evaluate(async (backend) => {
      const g = dcsmcraft;
      g.pause();
      await g.saving;
      if (backend === "localstorage") {
        const key = "dcsmcraft-worlds-fallback-v1",
          records = JSON.parse(localStorage.getItem(key));
        records[g.id].current.checksum = "corrupt";
        localStorage.setItem(key, JSON.stringify(records));
      } else {
        await new Promise((resolve, reject) => {
          const tx = g.store.db.transaction("worlds", "readwrite"),
            store = tx.objectStore("worlds"),
            read = store.get(g.id);
          read.onsuccess = () => {
            const record = read.result;
            record.current.checksum = "corrupt";
            store.put(record);
          };
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
      }
      // Simulate an interrupted/crashed document, rather than a graceful
      // pagehide autosave repairing the deliberate corruption before restart.
      g.active = false;
    }, backend);
    await page.reload();
    await page.locator("[data-action=load]").first().click();
    await page.waitForFunction(() => dcsmcraft.active && dcsmcraft.running);
    expect(await page.evaluate(() => dcsmcraft.player.xp)).toBe(11);
    await expect(page.locator("#toast")).toContainText(
      "Recovered the previous valid save generation",
    );
    expect(errors).toEqual([]);
  });
}

test("a newer live export and overlapping game saves do not return an older snapshot", async ({
  page,
}) => {
  await page.goto(origin);
  await page
    .getByRole("button", { name: "Create New World", exact: true })
    .click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.getByRole("button", { name: "Create New World" }).click();
  await page.waitForFunction(() => dcsmcraft.active && dcsmcraft.running);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    const original = g.store.save.bind(g.store);
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    window.releaseSave = release;
    g.store.save = async (data) => {
      await gate;
      return original(data);
    };
    g.player.xp = 101;
    window.saveOne = g.save();
    g.player.xp = 202;
    window.saveTwoFinished = false;
    window.saveTwo = g.save().then((r) => {
      window.saveTwoFinished = true;
      return r;
    });
    g.player.xp = 303;
  });
  const downloaded = page.waitForEvent("download");
  await page.locator("[data-action=backup-current]").click();
  expect(
    JSON.parse(readFileSync(await (await downloaded).path(), "utf8")).player.xp,
  ).toBe(303);
  expect(await page.evaluate(() => window.saveTwoFinished)).toBe(false);
  const saved = await page.evaluate(async () => {
    window.releaseSave();
    const results = await Promise.all([window.saveOne, window.saveTwo]);
    return {
      results,
      xp: (await dcsmcraft.store.load(dcsmcraft.id)).data.player.xp,
      pending: dcsmcraft.saving,
    };
  });
  expect(saved.results.map((r) => r.status)).toEqual(["durable", "durable"]);
  expect(saved.xp).toBe(202);
  expect(saved.pending).toBeNull();
  const failed = await page.evaluate(async () => {
    const g = dcsmcraft,
      snapshot = g.snapshot;
    const before = g.lastSaved;
    g.snapshot = () => {
      throw new Error("Snapshot capture rejected");
    };
    let result;
    try {
      await g.save();
    } catch (error) {
      result = error.outcome;
    }
    g.snapshot = snapshot;
    return { result, before, after: g.lastSaved };
  });
  expect(failed.result.status).toBe("failed");
  expect(failed.after).toBe(failed.before);
  await expect(page.locator("#storage-warning")).toContainText("save failed");
  await expect(page.locator("#save-status")).toContainText("SAVE FAILED");
  await page.evaluate(() => dcsmcraft.save());
  await expect(page.locator("#storage-warning")).toBeHidden();
});
