import { isWeapon } from "../../src/weapon-art.js";
import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { SKINS } from "../../src/skins.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html");
const out = "/workspace/artifacts/java-item-motion-2713";
mkdirSync(out, { recursive: true });
let server, origin;
test.use({ trace: "off" });
test.beforeAll(async () => {
  server = createServer((req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(html);
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
        frameLimit: 30,
        skin: "dante",
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
  await page.goto(origin + "/item-only.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
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
    g.inventory.selected = 0;
    g.inventory.equipment[1] = { id: "diamond_chestplate", count: 1 };
    Object.assign(g.player, {
      y: 200,
      vy: 0,
      yaw: 0,
      pitch: 0,
      onGround: true,
    });
    for (const s of ["#toast", "#cycle-banner"])
      document.querySelector(s)?.style.setProperty("visibility", "hidden");
  });
  return { errors, external };
}
test("held blocks, tools, ordinary items and both pistols render without any arm geometry through actions, armor refresh and swimming", async ({
  page,
}) => {
  test.setTimeout(120000);
  const evidence = await boot(page);
  const ids = [
    "stone",
    "log",
    "diamond_pickaxe",
    "iron_sword",
    "devin_sword",
    "matthew_dual_pistols",
    "flint_and_steel",
    "apple",
    "water_bucket",
    "torch",
    "iron_chestplate",
    "zombie_spawn_egg",
    "music_disc_amber",
    "saint_corpse_part",
  ];
  for (const id of ids) {
    await page.evaluate((id) => {
      dcsmcraft.inventory.slots[0] = { id, count: 1 };
    }, id);
    await page.waitForFunction(
      (id) => dcsmcraft.renderer.heldId === id && !!dcsmcraft.renderer.heldMesh,
      id,
    );
    const result = await page.evaluate(() => {
      const g = dcsmcraft,
        r = g.renderer;
      let hidden = true,
        itemPresent = true,
        finite = true,
        near = true,
        trajectory = true;
      r.animator.equip = 0;
      const armNames = [
        "block-hand",
        "block-sleeve",
        "block-glove",
        "armor-shoulder",
      ];
      for (const kind of ["attack", "mine", "place", "use", "fire"])
        for (const progress of [0, 0.3, 0.6, 1]) {
          r.setArmor(g.inventory.equipment);
          r.animator.trigger(kind);
          r.animator.action.age = r.animator.action.duration * progress;
          r.animator.swim = 1;
          r.draw({
            player: g.player,
            playing: true,
            elapsed: g.elapsed,
            animating: false,
          });
          const visible = [];
          r.handScene.traverseVisible((o) => {
            if (o.isMesh) visible.push(o);
          });
          hidden &&= !visible.some((o) => armNames.includes(o.name));
          let count = 0;
          r.heldMesh.traverseVisible((o) => {
            if (o.isMesh) count++;
          });
          itemPresent &&= count > 0 && r.heldMesh.parent === r.handRig.grip;
          finite &&= r.heldMesh.matrixWorld.elements.every(Number.isFinite);
          near &&= r.handRig.viewBounds.max.z <= -0.1099;
          if (r.leftHandRig.root.visible)
            near &&= r.leftHandRig.viewBounds.max.z <= -0.1099;
          if (!["devin_sword", "matthew_dual_pistols"].includes(r.heldId)) {
            const arc = Math.sin(Math.sqrt(progress) * Math.PI);
            trajectory &&=
              Math.abs(
                r.handGroup.position.x - r.handRig.restMount.x + 0.4 * arc,
              ) < 1e-6;
            trajectory &&=
              Math.abs(
                r.handGroup.position.y -
                  r.handRig.restMount.y -
                  0.2 * Math.sin(Math.sqrt(progress) * Math.PI * 2),
              ) < 1e-6;
          }
          if (r.heldId === "matthew_dual_pistols")
            itemPresent &&= r.leftHandRig.root.visible && r.leftPistol.visible;
          else hidden &&= !r.leftHandRig.root.visible;
        }
      return {
        hidden,
        itemPresent,
        finite,
        near,
        trajectory,
        rightArm: r.handRig.armVisuals.visible,
        leftArm: r.leftHandRig.armVisuals.visible,
        error: r.gl.getContext().getError(),
      };
    });
    expect(result, id).toEqual({
      hidden: true,
      itemPresent: true,
      finite: true,
      near: true,
      trajectory: true,
      rightArm: false,
      leftArm: false,
      error: 0,
    });
    const mounted = await page.evaluate(() => {
      const g = dcsmcraft,
        r = g.renderer;
      r.animator = new r.animator.constructor();
      r.pistolStyle = 0;
      r.pistolKick = 0;
      r.draw({
        player: g.player,
        playing: true,
        elapsed: g.elapsed,
        animating: false,
      });
      const center = r.handRig.viewBounds
        .getCenter(r.handRig.arm.hand.clone())
        .project(r.handCamera);
      return { y: center.y, x: center.x, root: r.handGroup.position.toArray() };
    });
    const edge = await page.evaluate(() => {
      const r = dcsmcraft.renderer;
      return Math.min(
        ...r.handRig.itemSilhouette.map(
          (p) =>
            p
              .clone()
              .applyMatrix4(r.handRig.wrist.matrixWorld)
              .project(r.handCamera).y,
        ),
      );
    });
    if (!isWeapon(id))
      expect(edge, id + " should meet the viewport edge").toBeCloseTo(
        -1.035,
        4,
      );
    expect(mounted.y, id + " should remain visible").toBeGreaterThan(-0.95);
    expect(mounted.x).toBeGreaterThan(0);
    expect(mounted.x).toBeLessThan(1);
    if (["stone", "matthew_dual_pistols", "flint_and_steel"].includes(id)) {
      await page.evaluate(() => {
        const g = dcsmcraft,
          r = g.renderer;
        r.animator.reset();
        r.animator.equip = 0;
        r.animator.swim = 0;
        r.draw({
          player: g.player,
          playing: true,
          elapsed: g.elapsed,
          animating: false,
        });
      });
      await page.screenshot({ path: `${out}/${id}-only.png` });
    }
  }
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});
test("empty hotbar slots restore each skin arm, glove and armor; switching back hides them and F5 keeps the full player", async ({
  page,
}) => {
  test.setTimeout(120000);
  const evidence = await boot(page);
  await page.evaluate(() => {
    dcsmcraft.inventory.slots[0] = { id: "stone", count: 64 };
    dcsmcraft.inventory.slots[8] = null;
  });
  for (const id of Object.keys(SKINS)) {
    await page.evaluate((id) => {
      dcsmcraft.settings.skin = id;
    }, id);
    await page.keyboard.press("Digit9");
    await page.waitForFunction(
      () =>
        !dcsmcraft.renderer.heldId &&
        dcsmcraft.renderer.handRig.armVisuals.visible,
    );
    const empty = await page.evaluate(() => {
      const g = dcsmcraft,
        r = g.renderer;
      r.animator.reset();
      r.animator.equip = 0;
      r.animator.swim = 0;
      r.draw({
        player: g.player,
        playing: true,
        elapsed: g.elapsed,
        animating: false,
      });
      const names = [];
      r.handRig.root.traverseVisible((o) => {
        if (o.isMesh) names.push(o.name);
      });
      return {
        hand: names.includes("block-hand"),
        sleeve:
          names.includes("block-sleeve") || names.includes("armor-shoulder"),
        glove: r.handRig.glove.userData.texturedGlove,
        gloveBox: names.includes("block-glove"),
        armor: names.includes("armor-shoulder"),
        appearance: r.handRig.appearance.id,
        handOnScreen: (() => {
          const point = r.handRig.forearm
            .localToWorld(r.handRig.arm.hand.clone().set(0, -0.5, 0))
            .project(r.handCamera);
          return (
            Math.abs(point.x) < 1 &&
            Math.abs(point.y) < 1 &&
            Math.abs(point.z) < 1
          );
        })(),
      };
    });
    expect(empty).toEqual({
      hand: true,
      sleeve: true,
      glove: ["dante", "vergil", "criminal"].includes(id),
      gloveBox: false,
      armor: true,
      appearance: id,
      handOnScreen: true,
    });
    await page.keyboard.press("Digit1");
    await page.waitForFunction(
      () =>
        dcsmcraft.renderer.heldId === "stone" &&
        !dcsmcraft.renderer.handRig.armVisuals.visible,
    );
  }
  await page.keyboard.press("Digit9");
  await page.waitForFunction(() => !dcsmcraft.renderer.heldId);
  await page.evaluate(() => {
    const g = dcsmcraft,
      r = g.renderer;
    r.animator.reset();
    r.animator.equip = 0;
    r.animator.swim = 0;
    r.draw({
      player: g.player,
      playing: true,
      elapsed: g.elapsed,
      animating: false,
    });
  });
  await page.screenshot({ path: `${out}/empty-hand.png` });
  const swim = await page.evaluate(() => {
    const g = dcsmcraft,
      r = g.renderer;
    r.animator.swim = 1;
    r.draw({
      player: g.player,
      playing: true,
      elapsed: g.elapsed,
      animating: false,
    });
    return {
      left: r.leftHandRig.root.visible,
      arm: r.leftHandRig.armVisuals.visible,
      pistol: r.leftPistol.visible,
    };
  });
  expect(swim).toEqual({ left: true, arm: true, pistol: false });
  await page.keyboard.press("Digit1");
  await page.keyboard.press("F5");
  await page.waitForFunction(
    () => dcsmcraft.cameraMode === 1 && dcsmcraft.renderer.playerModel?.visible,
  );
  const f5 = await page.evaluate(() => {
    const u = dcsmcraft.renderer.playerModel.userData;
    return {
      arms: u.arms.every(
        (a) => a.visible && a.children.some((m) => m.isMesh && m.visible),
      ),
      coveredSkinHidden: u.arms.every((a) => !a.children[0].visible),
      hands: u.forearms.every((a) => a.children[1].visible),
      held: !!u.grip.children[0],
    };
  });
  expect(f5).toEqual({
    arms: true,
    hands: true,
    held: true,
    coveredSkinHidden: true,
  });
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});

test("Java-style swing/equip preserve their natural paths through resized views; only custom weapons retain edge-pivot moves", async ({
  page,
}) => {
  test.setTimeout(150000);
  const evidence = await boot(page);
  for (const viewport of [
    { width: 640, height: 960 },
    { width: 1280, height: 800 },
    { width: 1920, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(
      ({ width, height }) =>
        Math.abs(dcsmcraft.renderer.handCamera.aspect - width / height) < 1e-6,
      viewport,
    );
    for (const id of [
      "stone",
      "iron_sword",
      "diamond_pickaxe",
      "devin_sword",
      "iron_spear",
      "matthew_dual_pistols",
      "flint_and_steel",
      "apple",
      "torch",
      "zombie_spawn_egg",
    ]) {
      await page.evaluate((id) => {
        dcsmcraft.inventory.slots[0] = { id, count: 1 };
      }, id);
      await page.waitForFunction((id) => dcsmcraft.renderer.heldId === id, id);
      const failures = await page.evaluate(() => {
        const g = dcsmcraft,
          r = g.renderer,
          failures = [];
        const standard = ![
          "devin_sword",
          "iron_spear",
          "matthew_dual_pistols",
        ].includes(r.heldId);
        r.animator = new r.animator.constructor();
        for (const equip of [1, 0.75, 0.5, 0.25, 0])
          for (const kind of ["attack", "mine", "place", "use", "eat", "fire"])
            for (const progress of [0, 0.3, 0.6, 1]) {
              r.action(kind);
              r.animator.equip = equip;
              r.animator.action.age = r.animator.action.duration * progress;
              r.draw({
                player: g.player,
                playing: true,
                elapsed: g.elapsed,
                animating: false,
              });
              const meshes = [];
              r.handScene.traverseVisible((o) => {
                if (o.isMesh) meshes.push(o.name);
              });
              if (
                meshes.some((n) =>
                  [
                    "block-hand",
                    "block-sleeve",
                    "block-glove",
                    "armor-shoulder",
                  ].includes(n),
                )
              )
                failures.push("visible arm");
              if (!r.heldMesh.matrixWorld.elements.every(Number.isFinite))
                failures.push("invalid item matrix");
              if (standard) {
                const e = Math.min(1, progress / 0.12, (1 - progress) / 0.12);
                const x =
                  kind === "eat"
                    ? -0.3 * e
                    : -0.4 * Math.sin(Math.sqrt(progress) * Math.PI);
                const y =
                  (kind === "eat"
                    ? (0.24 +
                        Math.abs(Math.cos(progress * Math.PI * 16)) * 0.018) *
                      e
                    : 0.2 * Math.sin(Math.sqrt(progress) * Math.PI * 2)) -
                  equip * 0.6;
                if (
                  Math.abs(r.handGroup.position.x - r.handRig.restMount.x - x) >
                    1e-6 ||
                  Math.abs(r.handGroup.position.y - r.handRig.restMount.y - y) >
                    1e-6
                )
                  failures.push(
                    `${kind}/${progress} equip=${equip}: rewritten trajectory`,
                  );
              }
              for (const rig of [
                r.handRig,
                ...(r.heldId === "matthew_dual_pistols" ? [r.leftHandRig] : []),
              ]) {
                if (
                  !r.heldMesh.userData.pixelProfile &&
                  (!standard ||
                    (equip === 0 && (progress === 0 || progress === 1)))
                ) {
                  const points = rig.itemSilhouette
                    .map((p) =>
                      p
                        .clone()
                        .applyMatrix4(rig.wrist.matrixWorld)
                        .project(r.handCamera),
                    )
                    .filter((p) => Math.abs(p.x) < 1);
                  if (
                    !points.length ||
                    Math.min(...points.map((p) => p.y)) > -1.0349 ||
                    Math.max(...points.map((p) => p.y)) < -0.98
                  )
                    failures.push("rest/custom item gap");
                }
                if (rig.viewBounds.max.z > -0.1099)
                  failures.push("camera clipping");
              }
            }
        r.animator.reset();
        r.animator.equip = 0;
        r.draw({
          player: g.player,
          playing: true,
          elapsed: g.elapsed,
          animating: false,
        });
        return failures;
      });
      expect(failures, `${id} ${viewport.width}x${viewport.height}`).toEqual(
        [],
      );
      if (["stone", "iron_sword", "flint_and_steel"].includes(id))
        await page.screenshot({
          path: `${out}/${id}-${viewport.width}-rest.png`,
        });
      if (
        viewport.width === 1280 &&
        ["stone", "iron_sword", "flint_and_steel"].includes(id)
      ) {
        await page.evaluate(() => {
          const g = dcsmcraft,
            r = g.renderer;
          r.action("attack");
          r.animator.equip = 0;
          r.animator.action.age = r.animator.action.duration * 0.25;
          r.draw({
            player: g.player,
            playing: true,
            elapsed: g.elapsed,
            animating: false,
          });
        });
        await page.screenshot({ path: `${out}/${id}-quarter-swing.png` });
      }
    }
  }
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});

test("real bow/crossbow/shield/trident use and release drive the matching held pose; spyglass hides and restores its item", async ({
  page,
}) => {
  test.setTimeout(120000);
  const evidence = await boot(page);
  for (const id of ["bow", "crossbow", "shield", "trident", "spyglass"]) {
    await page.evaluate((id) => {
      const g = dcsmcraft;
      g.inventory.slots[0] = { id, count: 1, durability: 100 };
      g.target = null;
      g.lastPlace = -1e6;
      g.player.health = 20;
    }, id);
    await page.waitForFunction((id) => dcsmcraft.renderer.heldId === id, id);
    const state = await page.evaluate((id) => {
      const g = dcsmcraft,
        r = g.renderer;
      r.animator = new r.animator.constructor();
      const draw = () =>
        r.draw({
          game: g,
          player: g.player,
          playing: true,
          elapsed: g.elapsed,
          animating: false,
        });
      draw();
      const rest = r.handGroup.position.toArray();
      g.use();
      g.elapsed += 1.5;
      g.tickCount += 12;
      r.animator.action = null;
      r.animator.equip = 0;
      draw();
      const held = r.handGroup.position.toArray(),
        visible = r.heldMesh.visible;
      const active =
        id === "spyglass"
          ? g.player.spyglassUntil > g.elapsed
          : id === "shield"
            ? g.player.shieldRaised
            : id === "trident"
              ? !!g.tridentCharge
              : g.player.editionDraw?.id === id;
      const before = (g.hostileProjectiles || []).length;
      dispatchEvent(new MouseEvent("mouseup", { button: 2 }));
      if (id === "spyglass") {
        g.lastPlace = -1e6;
        g.use();
      }
      r.animator.action = null;
      r.animator.equip = 0;
      draw();
      const cleared =
        !g.player.editionDraw && !g.player.shieldRaised && !g.tridentCharge;
      return {
        active: !!active,
        moved: held.some((n, i) => Math.abs(n - rest[i]) > 0.01),
        visible,
        restored: r.heldMesh.visible,
        cleared,
        charged: !!g.inventory.held?.charged,
        bowShot: (g.hostileProjectiles || []).length > before,
        near: r.handRig.viewBounds.max.z <= -0.1099,
        arm: r.handRig.armVisuals.visible,
      };
    }, id);
    expect(state.active, id).toBe(true);
    expect(state.cleared, id).toBe(true);
    expect(state.restored, id).toBe(true);
    expect(state.near, id).toBe(true);
    expect(state.arm, id).toBe(false);
    if (id === "spyglass") expect(state.visible).toBe(false);
    else {
      expect(state.visible).toBe(true);
      expect(state.moved, id).toBe(true);
    }
    if (id === "bow") expect(state.bowShot).toBe(true);
    if (id === "crossbow") expect(state.charged).toBe(true);
  }
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});
