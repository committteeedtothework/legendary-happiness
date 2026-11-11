const MOBILE =
  typeof __DCSMCRAFT_MOBILE__ !== "undefined" && __DCSMCRAFT_MOBILE__;
export function installMobileApp(g) {
  if (!MOBILE) return;
  document.querySelector("#mobile-loading")?.remove();
  const app = { game: g };
  g.mobileApp = app;
  app.registration = navigator.serviceWorker
    ?.register("./sw.js", { scope: "./", updateViaCache: "none" })
    .catch((e) => {
      app.error = e.message;
      return null;
    });
  app.manifest = fetch("./offline-manifest.json")
    .then((r) => {
      if (!r.ok) throw Error("Offline list unavailable");
      return r.json();
    })
    .catch((e) => {
      app.error = e.message;
      return null;
    });
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    app.installPrompt = e;
  });
  app.status = async () => {
    const m = await app.manifest;
    if (!m) return "Offline download unavailable";
    const cache = await caches.open(m.cache);
    const keys = new Set((await cache.keys()).map((r) => r.url));
    const ready = m.files.every((f) =>
      keys.has(new URL(f.url, location.href).href),
    );
    return ready ? "Offline ready" : "Online · Download for offline play";
  };
  app.panel = async () => {
    g.ui.setScreen(
      "mobile-app",
      `<main class="dialog settings-dialog"><h2>Mobile Edition</h2><p>On iPhone or iPad, open this site in Safari. Tap Share, then Add to Home Screen and Add.</p><p id="mobile-offline-status" role="status">Checking offline files…</p><button data-mobile="download">Download for offline play</button><button data-mobile="cancel" hidden>Cancel download</button><button data-mobile="install" ${app.installPrompt ? "" : "hidden"}>Install app</button><button data-mobile="update" hidden>Update & restart</button><p>Keep the app open while downloading. iOS may clear offline files when storage is low. Export world backups before clearing Safari data or changing devices.</p><button data-action="back" class="primary wide">Done</button></main>`,
    );
    const status = document.querySelector("#mobile-offline-status");
    try {
      status.textContent = await app.status();
    } catch (e) {
      status.textContent = "Offline storage unavailable";
    }
    const registration = await app.registration;
    if (registration?.waiting)
      document
        .querySelector('[data-mobile="update"]')
        ?.removeAttribute("hidden");
  };
  app.download = async () => {
    if (app.downloading) return;
    app.downloading = true;
    app.abort = new AbortController();
    const status = () => document.querySelector("#mobile-offline-status");
    const cancel = document.querySelector('[data-mobile="cancel"]');
    if (cancel) cancel.hidden = false;
    let lock;
    try {
      const m = await app.manifest;
      if (!m) throw Error("Offline list unavailable");
      const cache = await caches.open(m.cache);
      try {
        lock = await navigator.wakeLock?.request("screen");
      } catch {}
      let completed = 0;
      for (const file of m.files) {
        if (app.abort.signal.aborted)
          throw new DOMException("Cancelled", "AbortError");
        const valid = async (response) => {
          if (!response?.ok) return false;
          const bytes = await response.arrayBuffer();
          if (bytes.byteLength !== file.bytes) return false;
          const digest = [
            ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          ]
            .map((v) => v.toString(16).padStart(2, "0"))
            .join("");
          return digest === file.sha256;
        };
        if (!(await valid(await cache.match(file.url)))) {
          await cache.delete(file.url);
          const response = await fetch(file.url, {
            signal: app.abort.signal,
            cache: "reload",
          });
          if (!response.ok) throw Error("Download interrupted");
          const bytes = await response.arrayBuffer();
          if (bytes.byteLength !== file.bytes)
            throw Error("Download size mismatch");
          const digest = [
            ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          ]
            .map((v) => v.toString(16).padStart(2, "0"))
            .join("");
          if (digest !== file.sha256)
            throw Error("Download verification failed");
          const headers = new Headers(response.headers);
          headers.delete("content-encoding");
          headers.delete("transfer-encoding");
          headers.set("content-length", String(bytes.byteLength));
          await cache.put(file.url, new Response(bytes, { headers }));
        }
        completed++;
        if (status())
          status().textContent = `Saving offline · ${completed} / ${m.files.length}`;
      }
      try {
        await navigator.storage?.persist?.();
      } catch {}
      if (status()) status().textContent = await app.status();
    } catch (e) {
      if (status())
        status().textContent =
          e.name === "AbortError"
            ? "Download paused · You can continue later"
            : "Could not finish offline download. Check storage and connection, then try again.";
    } finally {
      app.downloading = false;
      await lock?.release().catch(() => {});
      if (cancel) cancel.hidden = true;
    }
  };
  g.ui.overlay.addEventListener("click", async (e) => {
    if (e.target.closest('[data-action="mobile-app"]')) {
      app.panel();
      return;
    }
    const action = e.target.closest("[data-mobile]")?.dataset.mobile;
    if (action === "download") app.download();
    if (action === "cancel") app.abort?.abort();
    if (action === "install" && app.installPrompt) {
      await app.installPrompt.prompt();
      app.installPrompt = null;
    }
    if (action === "update") {
      try {
        if (g.active) {
          g.pause();
          await g.save();
        }
        const r = await app.registration;
        if (!r?.waiting) return;
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => location.reload(),
          { once: true },
        );
        r.waiting.postMessage({ type: "ACTIVATE_UPDATE" });
      } catch {
        g.ui.toast("Save failed. Export a world backup before restarting.");
      }
    }
  });
}
