import {
  PAD_BUTTONS,
  padGlyph,
  controllerFamily,
  controllerConfig,
  menuButtonNames,
} from "./controller-data.js";
export function inputDevice(g) {
  return g.controller?.lastDevice === "controller"
    ? "controller"
    : g.touch?.active
      ? "touch"
      : "keyboard";
}
export function buttonName(g, action) {
  const manager = g.controller || {},
    c = controllerConfig(g.settings?.controller);
  const family = manager.family || "generic";
  if (c.preset !== "custom") return padGlyph(family, action);
  const index = c.bindings[action];
  const axis =
    action === "mine"
      ? c.rightTriggerAxis
      : action === "use"
        ? c.leftTriggerAxis
        : -1;
  const physical = Object.keys(PAD_BUTTONS).find(
    (k) => PAD_BUTTONS[k] === index,
  );
  const detected = controllerFamily(manager.pad?.id || "");
  const button =
    index < 0
      ? null
      : physical && detected !== "generic"
        ? padGlyph(detected, physical)
        : `Button ${index}`;
  return axis >= 0
    ? `${button ? button + " / " : ""}Axis ${axis}`
    : button || "Unbound";
}
export function controlName(g, action, context = "world") {
  const device = inputDevice(g),
    arena = context === "arena",
    inventory = context === "inventory";
  if (device === "touch" && g.touch?.pocketReady) {
    const pocket = { move: g.touch.config.layout === "dpad" ? "D-pad" : "Move stick",
      ability: "Ability", actions: "Moves", chat: "Chat", crouch: "Sneak" };
    if (pocket[action]) return pocket[action];
  }
  if (device === "touch")
    return (
      {
        move: "Move stick",
        look: "Drag view",
        mine: inventory ? "Tap slot" : "Mine",
        use: inventory ? "Split" : "Use",
        jump: "Jump",
        crouch: "Crouch",
        sprint: "Sprint",
        inventory: "Inventory",
        pause: "Pause",
        actions: "Actions",
        ability: "Actions → Weapon ability",
        journal: "Actions → Journal",
        drop: "Actions → Drop one",
        dropStack: "Actions → Drop stack",
        view: "Actions → View",
        debug: "Actions → Coordinates",
        chat: "Actions → Chat",
        hotbar: "Hotbar",
        confirm: "Tap",
        cancel: "Back",
        transfer: "Quick move",
        split: "Split",
        attack: "Attack",
        parry: "Parry",
        dodge: "Dodge",
        target: "Target",
        boost: "Boost",
        rise: "Rise",
        descend: "Down",
        help: "Controls",
        climb: "Climb",
        draw: "Draw loop",
        homing: "Homing",
        boom: g.giganto?.session?.stage==='traversal'?"Light Dash":"Sonic Boom",
        rush: "Wild Rush",
        loop: "Cyloop",
        cross: "Cross Slash",
        shot: g.giganto?.session?.stage==='traversal'?"Slide":"Homing Shot",
        stomp: "Stomp",
        spin: g.giganto?.session?.stage==='traversal'?"Drop Dash":"Spin Slash",
        cyclone: "Cyclone Kick",
      }[action] || action
    );
  if (device !== "controller") return action;
  const p = (k) => buttonName(g, k),
    names = menuButtonNames(g.controller?.family);
  const buttons = {
    mine: inventory ? names.confirm : "mine",
    use: inventory ? "attack" : "use",
    jump: "jump",
    crouch: "crouch",
    sprint: "sprint",
    inventory: "inventory",
    pause: "pause",
    actions: "view",
    ability: "up",
    journal: "left",
    drop: "down",
    view: "target",
    chat: "right",
    confirm: names.confirm,
    cancel: names.cancel,
    transfer: "inventory",
    split: "attack",
    attack: arena ? "attack" : "mine",
    parry: "use",
    dodge: "rightShoulder",
    target: "target",
    boost: "mine",
    rise: "jump",
    descend: "crouch",
    help: "view",
    climb: "left",
    draw: "leftShoulder",
    homing: "inventory",
    boom: "up",
    rush: "down",
    loop: "left",
    cross: "right",
  };
  if(arena&&g.giganto?.session?.stage==='traversal'&&['stomp','spin'].includes(action))return p(action==='stomp'?'down':'right');
  if (buttons[action]) return p(buttons[action]);
  if (action === "move") return "Left stick";
  if (action === "look") return "Right stick";
  if (action === "dropStack") return p("view") + " → Drop stack";
  if (action === "debug") return p("view") + " → Coordinates";
  if (action === "hotbar")
    return p("leftShoulder") + " / " + p("rightShoulder");
  const chord = { shot: "up", stomp: "down", spin: "right", cyclone: "left" }[
    action
  ];
  return chord ? p("leftShoulder") + " + " + p(chord) : action;
}
export function promptText(g, text, context = "world") {
  if (inputDevice(g) === "keyboard") return text;
  if (
    !/\b(?:[A-Z]|F3|F5|LMB|RMB|WASD|SPACE|SHIFT|CTRL|CONTROL|ESC(?:APE)?|TAB|ENTER|MOUSE|SCROLL|CLICK)\b|left[- ]click|right[- ]click/i.test(
      text,
    )
  )
    return text;
  if (/Ctrl\+C/i.test(text))
    return "Use the device’s Copy command for the selected invitation.";
  const arena = context === "arena",
    inventory = context === "inventory";
  const labels = {};
  const n = (a) => (labels[a] ??= controlName(g, a, context));
  const actions = n("actions");
  let result = text;
  const rules = [
    [/SHIFT\s*\+\s*CLICK|[Ss]hift[- ]click/g, n("transfer")],
    [/CTRL\s*\+\s*Q/gi, n("dropStack")],
    [/CTRL\s*\+\s*W/gi, n("sprint")],
    [/W\s*→\s*W/g, n("sprint")],
    [/1[–—-]9\s*\/\s*SCROLL/gi, n("hotbar")],
    [
      /double[- ]tap Space to fly/gi,
      inputDevice(g) === "touch"
        ? "Actions → Flight"
        : actions + " → Toggle flight",
    ],
    [/\b(?:W\s+A\s+S\s+D|WASD)\b/g, n("move")],
    [/\b(?:Mouse wheel|MOUSE WHEEL|mouse wheel|SCROLL WHEEL)\b/g, n("hotbar")],
    [/\bW\s*\/\s*S\b/g, n("move") + " ↑ / ↓"],
    [/\bA\s*\/\s*D\b/g, n("move") + " ← / →"],
    [/[Cc]lick a recipe/g, "Select a recipe with " + n("confirm")],
    [/[Cc]lick to fill/g, n("confirm") + " to fill"],
    [
      /\b(?:LMB|LEFT CLICK|[Ll]eft[- ]click)\b/g,
      n(arena ? "attack" : inventory ? "confirm" : "mine"),
    ],
    [
      /\b(?:RMB|RIGHT CLICK|[Rr]ight[- ]click)\b/g,
      n(arena ? "parry" : inventory ? "split" : "use"),
    ],
    [
      /\b(?:ESCAPE|Escape|ESC|Esc)\b/g,
      n(/\b(?:Back|Close|Done)\b/i.test(text) ? "cancel" : "pause"),
    ],
    [/\b(?:SPACE|Space)\b/g, n(arena ? "rise" : "jump")],
    [/\b(?:SHIFT|Shift)\b/g, n(arena ? "boost" : "crouch")],
    [/\b(?:CTRL|Ctrl|Control)\b/g, n(arena ? "descend" : "sprint")],
    [/\b(?:MOUSE|Mouse)\b/g, n("look")],
    [/\b(?:TAB|Tab)\b/g, n(arena ? "target" : "inventory")],
    [/\bF3\b/g, n("debug")],
    [/\bF5\b/g, n("view")],
    [/\bENTER\b|\bEnter(?= to (?:send|chat|confirm))/g, n("confirm")],
  ];
  // Replace once from original text so generated button names are never treated
  // as keyboard keys (notably Xbox A/B/X/Y and Switch L/R).
  const literals = [];
  const protect = (s) => {
    literals.push(s);
    return `\uE100${literals.length - 1}\uE101`;
  };
  for (const [re, label] of rules)
    result = result.replace(re, () => protect(label));
  const keys = arena
    ? {
        W: "move",
        A: "move",
        S: "move",
        D: "move",
        E: g.giganto?.session?.stage === "traversal" ? "climb" : "loop",
        R: "boom",
        F: "rush",
        C: g.giganto?.session?.stage === "traversal" ? "draw" : "cross",
        V: "shot",
        X: "homing",
        Z: "stomp",
        G: "spin",
        B: "cyclone",
        Q: "dodge",
        H: "help",
      }
    : {
        E: /portal|Titan signal/i.test(text) ? "use" : "inventory",
        R: "ability",
        Q: "drop",
        J: "journal",
        W: "move",
        A: "move",
        S: "move",
        D: "move",
      };
  result = result.replace(/\b(?:F3|F5|[WERQJHASDFGVCXZB])\b/g, (key) => {
    if (
      "WASD".includes(key) &&
      text.trim() !== key &&
      !/\bW against\b/.test(text)
    )
      return key;
    if (keys[key]) return protect(n(keys[key]));
    const stand = Object.entries(g.settings?.standKeys || {}).find(
      ([, code]) => code === "Key" + key,
    );
    return stand &&
      (text.trim() === key ||
        new RegExp("\\b" + key + " (?:summons?|opens?|uses?|and)\\b", "i").test(
          text,
        ) ||
        /\bStand\b/.test(text))
      ? protect(actions + " → Stand · " + stand[0])
      : key;
  });
  return result.replace(/\uE100(\d+)\uE101/g, (_, i) => literals[+i]);
}
export class InputPrompts {
  constructor(g) {
    this.game = g;
    this.records = new WeakMap();
    this.attributes = new WeakMap();
    this.dirty = true;
    this.observer = new MutationObserver(() => {
      this.dirty = true;
      if (!this.queued) {
        this.queued = true;
        queueMicrotask(() => {
          this.queued = false;
          this.frame();
        });
      }
    });
    this.observer.observe(document.querySelector("#app"), {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["title", "data-tooltip", "aria-label"],
    });
  }
  frame() {
    const g = this.game,
      key = JSON.stringify([
        inputDevice(g),
        g.controller?.family,
        g.controller?.pad?.id,
        g.settings.controller,
        g.ui.screen,
        g.giganto?.session?.stage,
        g.settings.standKeys,
      ]);
    if (!this.dirty && key === this.key) return;
    this.dirty = false;
    this.key = key;
    const roots = [
      g.ui.overlay,
      g.ui.hud,
      document.querySelector("#titan-hud"),
      document.querySelector("#titan-portal-prompt"),
      document.querySelector("#tooltip"),
      document.querySelector("#toast"),
    ].filter(Boolean);
    const excluded =
      "input,textarea,select,script,style,#world-chat-log,#chat-messages,#chat-panel,#chat-log,#cycle-banner,#message-preview,.world-row,.wardrobe-list,#controller-keyboard,[data-user-text],[data-input-ready]";
    const guide = g.ui.overlay.querySelector(".controls-list");
    if (guide) {
      this.guideSource ||= new WeakMap();
      if (!this.guideSource.has(guide))
        this.guideSource.set(guide, guide.innerHTML);
      if (inputDevice(g) === "keyboard") {
        if (guide.dataset.inputReady) {
          guide.innerHTML = this.guideSource.get(guide);
          delete guide.dataset.inputReady;
        }
      } else if (guide.dataset.inputReady !== key) {
        const names = [
          ["move", "Move"],
          ["look", "Look"],
          ["jump", "Jump / swim up"],
          ["crouch", "Crouch / flight down"],
          ["sprint", "Toggle sprint"],
          ["mine", "Mine / attack"],
          ["use", "Use / place / eat"],
          ["hotbar", "Select hotbar slot"],
          ["inventory", "Inventory"],
          ["drop", "Drop one"],
          ["dropStack", "Drop stack"],
          ["pause", "Pause"],
          ["journal", "Relic Journal"],
          ["view", "Change view"],
          ["debug", "Coordinates"],
          ["actions", "Actions / flight / Stands"],
        ];
        guide.innerHTML = names
          .map(
            ([a, label]) =>
              `<dt><kbd>${controlName(g, a)}</kbd></dt><dd>${label}</dd>`,
          )
          .join("");
        guide.dataset.inputReady = key;
      }
    }
    for (const root of roots) {
      const context =
        root.closest?.("#titan-hud") ||
        root.id === "titan-hud" ||
        g.giganto?.active
          ? "arena"
          : g.ui.screen === "inventory" &&
              (root === g.ui.overlay || root.id === "tooltip")
            ? "inventory"
            : "world";
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node; (node = walker.nextNode()); ) {
        if (node.parentElement?.closest(excluded)) continue;
        const old = this.records.get(node);
        if (old && node.data === old.last && old.key === key) continue;
        const source = old && node.data === old.last ? old.source : node.data;
        const value = promptText(g, source, context);
        this.records.set(node, { source, last: value, key });
        if (node.data !== value) node.data = value;
      }
      for (const node of root.querySelectorAll("[title],[aria-label]")) {
        if (node.closest(excluded)) continue;
        let records = this.attributes.get(node);
        if (!records) {
          records = {};
          this.attributes.set(node, records);
        }
        for (const attr of ["title", "aria-label"]) {
          const raw = node.getAttribute(attr);
          if (raw === null) continue;
          const old = records[attr];
          if (old && raw === old.last && old.key === key) continue;
          const source = old && raw === old.last ? old.source : raw;
          const value = promptText(g, source, context);
          records[attr] = { source, last: value, key };
          if (raw !== value) node.setAttribute(attr, value);
        }
      }
    }
    this.observer.takeRecords();
  }
}
