import { _electron } from "playwright";
import { createRelay } from "../../server/relay.mjs";
import { SocialHub } from "../../server/social-hub.mjs";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
const out =
  process.env.DCSMCRAFT_DESKTOP_ARTIFACTS || "test-results/desktop-friends";
mkdirSync(out, { recursive: true });
const relay = createRelay({ social: new SocialHub() }),
  { port } = await relay.listen(0, "127.0.0.1"),
  url = `http://127.0.0.1:${port}`,
  profile = mkdtempSync(join(tmpdir(), "dcsmcraft-account-desktop-")),
  errors = [];
let app;
async function launch() {
  app = await _electron.launch({
    executablePath: resolve("dist/electron/linux-unpacked/electron"),
    args: [
      "--no-sandbox",
      "--disable-background-networking",
      "--ozone-platform=headless",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
    env: {
      ...process.env,
      DCSMCRAFT_USER_DATA: profile,
      XDG_CACHE_HOME: profile + "/cache",
    },
    timeout: 30000,
  });
  const page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForFunction(() => window.dcsmcraft?.initialized, null, {
    timeout: 60000,
  });
  return page;
}
try {
  let page = await launch();
  await page.evaluate((url) => dcsmcraft.friends.configure(url), url);
  await page.locator("[data-action=friends]").first().click();
  await page.locator("[data-social-form=signin] input").fill("desktop_friend");
  await page.locator("[data-social-form=signin] button").click();
  await page.waitForFunction(() => dcsmcraft.friends.status === "online");
  const id = await page.evaluate(() => dcsmcraft.friends.state.profile.id);
  await app.close();
  app = null;
  page = await launch();
  await page.waitForFunction(() => dcsmcraft.friends.status === "online");
  assert.equal(
    await page.evaluate(() => dcsmcraft.friends.state.profile.id),
    id,
  );
  assert.equal(await page.evaluate(() => location.origin), "dcsmcraft://game");
  await page.locator("[data-action=friends]").first().click();
  await page.screenshot({ path: out + "/desktop-friends.png", timeout: 90000 });
  assert.deepEqual(errors, []);
  writeFileSync(
    out + "/friends.json",
    JSON.stringify(
      {
        customSecureOrigin: true,
        webCryptoSignIn: true,
        cryptoKeyPersisted: true,
        automaticReconnect: true,
        profilePreserved: true,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  if (app) await app.close();
  await relay.close();
}
