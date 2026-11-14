const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "dcsmcraftDesktop",
  Object.freeze({ quit: () => ipcRenderer.send("dcsmcraft:quit"),toggleFullscreen:()=>ipcRenderer.invoke("dcsmcraft:toggle-fullscreen") }),
);
