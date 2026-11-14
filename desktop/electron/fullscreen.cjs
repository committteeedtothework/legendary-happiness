const { APP_ORIGIN } = require('./policy.cjs');
const CHANNEL = 'dcsmcraft:toggle-fullscreen';
function isFullscreenShortcut(input) {
  const key = String(input.key || input.code || '').toLowerCase();
  if (input.control || input.meta) return false;
  return (key === 'f11' && !input.alt) || (key === 'enter' && input.alt === true);
}
function trustedSender(event, window) {
  return !window.isDestroyed() && event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame &&
    event.senderFrame?.url.startsWith(APP_ORIGIN + '/');
}
function toggleFullscreen(window) {
  if (window.isDestroyed()) return false;
  const next = !window.isFullScreen();
  window.setFullScreen(next);
  return next;
}
function installFullscreen(window, ipcMain) {
  // BrowserWindow fullscreen is independent of Chromium's DOM fullscreen and
  // pointer lock. Escape and menu navigation can release the mouse normally.
  ipcMain.handle(CHANNEL, event => {
    if (!trustedSender(event, window)) throw Error('Fullscreen request denied');
    return toggleFullscreen(window);
  });
  window.webContents.on('before-input-event', (event, input) => {
    if (!isFullscreenShortcut(input)) return;
    event.preventDefault();
    if (input.type === 'keyDown' && !input.isAutoRepeat) toggleFullscreen(window);
  });
  window.once('closed', () => ipcMain.removeHandler(CHANNEL));
}
module.exports = { CHANNEL, isFullscreenShortcut, trustedSender, toggleFullscreen, installFullscreen };
