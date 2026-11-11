// These approved UI/default-message edits are normalized for older source
// invariants. IDs, recipes, numbers, commands and simulation remain protected.
export function beforePlayerCopy(name, bytes) {
  const pairs = {
    "src/data.js": [
      [
        'dayEnd: "Sunset."',
        'dayEnd: "The sun is sinking. Find shelter before the shadows gather."',
      ],
      [
        'nightStart: "Nightfall."',
        'nightStart: "Night has fallen. You are not alone out here."',
      ],
      [
        'nightEnd: "Dawn."',
        'nightEnd: "The darkness is fading. Hold on until morning."',
      ],
      ['dayStart: "Sunrise."', 'dayStart: "A new day begins. Make it yours."'],
    ],
    "src/chat.js": [
      [
        "Chat · /help for commands",
        "Chat · T to talk · /help for owner commands",
      ],
      ["Message…", "Say something…"],
    ],
    "src/jukebox.js": [
      [
        '<div class="dialog-top"><button class="close" data-action="back" aria-label="Close jukebox">',
        '<div class="dialog-top"><span class="eyebrow">LOCAL DISC JUKEBOX</span><button class="close" data-action="back" aria-label="Close jukebox">',
      ],
      ["<h2>Jukebox</h2>", "<h2>Music from your own collection</h2>"],
      ["Loading tracks…", "Checking this PC’s library…"],
      [
        "<label>MP3 file<input",
        "<label>Choose a local MP3 for this disc<input",
      ],
      [
        "MP3 · 32 MB maximum. Tracks stay in this browser and aren’t included in world backups or multiplayer.",
        "MP3s (up to 32 MiB each) are copied into this browser’s local library. They stay on this PC, outside world backups and multiplayer. On another PC/browser, choose the files again. Playback starts only when you press Play.",
      ],
      [
        "Place a Jukebox and right-click it to insert a disc.",
        "Place and right-click a Jukebox to insert discs. This menu manages your local library.",
      ],
    ],
    "src/stand-ui.js": [
      [
        "H · Summon   F / G · Abilities   V · Details",
        "Choose a Stand for this Creative world. H summons, F/G use abilities, V opens details. Energy/cooldowns still apply. Survival trials are unchanged.",
      ],
      [" equipped.", " equipped. Press E to return to play."],
      ['"Saved."', '"Saved. Fate weights are normalized to 100%."'],
      ["Max level", "Maximum energy progression"],
    ],
  };
  if (!pairs[name]) return bytes;
  let text = bytes.toString();
  for (const [now, before] of pairs[name] || [])
    text = text.replaceAll(now, before);
  if (name === "src/stand-ui.js")
    text = text.replace(
      'ui.overlay.querySelector("#palm-config-status").textContent = "Saved. Fate weights are normalized to 100%.";',
      'ui.overlay.querySelector("#palm-config-status").textContent =\n        "Saved. Fate weights are normalized to 100%.";',
    );
  return Buffer.from(text);
}
