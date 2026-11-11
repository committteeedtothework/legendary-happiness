const {
  app,
  BrowserWindow,
  protocol,
  net,
  dialog,
  Menu,
  session,
  ipcMain,
} = require("electron");
const path = require("node:path");
const { saveBeforeClose } = require("./lifecycle.cjs");
const { pathToFileURL } = require("node:url");
const {
  APP_ORIGIN,
  localAssetPath,
  allowedPermissions,
} = require("./policy.cjs");
// An isolated stable desktop profile; never open or modify an Edge/Chrome profile.
const profile =
  process.env.DCSMCRAFT_USER_DATA ||
  path.join(
    process.env.LOCALAPPDATA || app.getPath("appData"),
    "DCSMCRAFT",
    "DesktopApp",
  );
app.setPath("userData", profile);
app.setName("DCSMCRAFT");
app.enableSandbox();
protocol.registerSchemesAsPrivileged([
  {
    scheme: "dcsmcraft",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);
let window,
  exiting = false,
  saving = false;
const saveScript = `(${saveBeforeClose.toString()})(window.dcsmcraft)`;
async function closeAfterSaving(event) {
  if (exiting) return;
  event.preventDefault();
  if (saving) return;
  saving = true;
  try {
    await window.webContents.executeJavaScript(saveScript);
    exiting = true;
    window.close();
  } catch (error) {
    const result = await dialog.showMessageBox(window, {
      type: "error",
      title: "Could not save",
      message: "Your world could not be saved.",
      detail: String(error.message || error),
      buttons: ["Retry", "Cancel", "Quit Without Saving"],
      defaultId: 0,
      cancelId: 1,
    });
    saving = false;
    if (result.response === 0) return closeAfterSaving(event);
    if (result.response === 2) {
      exiting = true;
      window.close();
    }
  }
  saving = false;
}
app.on("second-instance", () => {
  if (window) {
    if (window.isMinimized()) window.restore();
    window.focus();
  }
});
if (!app.requestSingleInstanceLock()) app.quit();
else
  app
    .whenReady()
    .then(async () => {
      const root = path.join(__dirname, "game");
      session
        .fromPartition("persist:dcsmcraft")
        .protocol.handle("dcsmcraft", (request) => {
          const filename = localAssetPath(request.url, root);
          if (!filename) return new Response("Not found", { status: 404 });
          return net.fetch(pathToFileURL(filename).href);
        });
      Menu.setApplicationMenu(null);
      window = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 640,
        minHeight: 360,
        title: "DCSMCRAFT",
        icon: path.join(root, "icon-192.png"),
        backgroundColor: "#202a1f",
        show: false,
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
          partition: "persist:dcsmcraft",
          backgroundThrottling: true,
        },
      });
      ipcMain.on("dcsmcraft:quit", (event) => {
        if (
          event.sender === window.webContents &&
          event.senderFrame?.url.startsWith(APP_ORIGIN + "/")
        )
          window.close();
      });
      window.webContents.session.setPermissionRequestHandler(
        (_contents, permission, callback) =>
          callback(allowedPermissions.has(permission)),
      );
      window.webContents.session.setPermissionCheckHandler(
        (_contents, permission) => allowedPermissions.has(permission),
      );
      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      window.webContents.on("will-navigate", (event, url) => {
        if (!url.startsWith(APP_ORIGIN + "/")) event.preventDefault();
      });
      window.on("close", closeAfterSaving);
      window.once("ready-to-show", () => window.show());
      window.webContents.on("render-process-gone", (_event, details) => {
        if (details.reason !== "clean-exit")
          dialog.showErrorBox(
            "DCSMCRAFT",
            "The game stopped unexpectedly. Your last saved world is kept. Restart the app to continue.",
          );
      });
      await window.loadURL(APP_ORIGIN + "/");
    })
    .catch((error) => {
      dialog.showErrorBox(
        "DCSMCRAFT",
        "Could not start the game: " + error.message,
      );
      app.exit(1);
    });
app.on("window-all-closed", () => app.quit());
