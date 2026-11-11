export const CONTROLLER_PRESETS = Object.freeze([
  ["auto", "Automatic"],
  ["xbox", "Xbox"],
  ["playstation", "PlayStation"],
  ["switch", "Switch Pro"],
  ["generic", "Generic standard"],
  ["custom", "Custom"],
]);
export const PAD_DEFAULTS = Object.freeze({
  enabled: true,
  preset: "auto",
  deadzone: 0.18,
  lookSensitivity: 2.6,
  lookDeadzone: 0.18,
  outerDeadzone: 0.02,
  moveCurve: "linear",
  lookCurve: "smooth",
  verticalLookScale: 1,
  lookSmoothing: 0,
  invertX: false,
  sprintMode: "toggle",
  triggerThreshold: 0.55,
  invertY: false,
  vibration: true,
  moveX: 0,
  moveY: 1,
  lookX: 2,
  lookY: 3,
  leftTriggerAxis: -1,
  rightTriggerAxis: -1,
  bindings: {},
});
export const PAD_BUTTONS = Object.freeze({
  jump: 0,
  crouch: 1,
  attack: 2,
  inventory: 3,
  leftShoulder: 4,
  rightShoulder: 5,
  use: 6,
  mine: 7,
  view: 8,
  pause: 9,
  sprint: 10,
  target: 11,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
});
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function controllerConfig(raw = {}) {
  raw = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const n = (k, a, b) =>
    Number.isFinite(raw[k]) ? clamp(raw[k], a, b) : PAD_DEFAULTS[k];
  return {
    enabled: raw.enabled !== false,
    preset: CONTROLLER_PRESETS.some(([k]) => k === raw.preset)
      ? raw.preset
      : "auto",
    deadzone: n("deadzone", 0.05, 0.45),
    lookSensitivity: n("lookSensitivity", 0.5, 6),
    lookDeadzone: Number.isFinite(raw.lookDeadzone)?clamp(raw.lookDeadzone,0.02,0.45):n('deadzone',0.05,0.45),
    outerDeadzone: n('outerDeadzone',0,0.2),
    moveCurve: ['linear','precise','fast'].includes(raw.moveCurve)?raw.moveCurve:'linear',
    lookCurve: ['linear','smooth','precision'].includes(raw.lookCurve)?raw.lookCurve:'smooth',
    verticalLookScale: n('verticalLookScale',0.25,2),
    lookSmoothing: n('lookSmoothing',0,0.2),
    invertX: raw.invertX===true,
    sprintMode: raw.sprintMode==='hold'?'hold':'toggle',
    triggerThreshold:n('triggerThreshold',0.1,0.95),
    invertY: raw.invertY === true,
    vibration: raw.vibration !== false,
    ...Object.fromEntries(
      [
        "moveX",
        "moveY",
        "lookX",
        "lookY",
        "leftTriggerAxis",
        "rightTriggerAxis",
      ].map((k) => [k, Math.round(n(k, -1, 15))]),
    ),
    bindings: Object.fromEntries(
      Object.entries(PAD_BUTTONS).map(([k, v]) => [
        k,
        Number.isInteger(raw.bindings?.[k])
          ? clamp(raw.bindings[k], -1, 63)
          : v,
      ]),
    ),
  };
}
export function controllerFamily(id = "", preset = "auto") {
  if (preset !== "auto")
    return ["xbox", "playstation", "switch"].includes(preset)
      ? preset
      : "generic";
  if (/playstation|dualshock|dualsense|sony|054c/i.test(id))
    return "playstation";
  if (/nintendo|switch|057e/i.test(id)) return "switch";
  if (/xbox|xinput|microsoft|045e/i.test(id)) return "xbox";
  return "generic";
}
export function radialDeadzone(x, y, zone = 0.18, outer = 0) {
  x = Number.isFinite(x) ? clamp(x, -1, 1) : 0;
  y = Number.isFinite(y) ? clamp(y, -1, 1) : 0;
  const r = Math.hypot(x, y);
  if (r <= zone) return { x: 0, y: 0 };
  const m = clamp((r - zone) / Math.max(0.01,1 - outer - zone), 0, 1) / r;
  return { x: x * m, y: y * m };
}
export function readController(pad, raw = {}) {
  const c = controllerConfig(raw),
    axis = (i) =>
      i >= 0 && Number.isFinite(pad?.axes?.[i]) ? clamp(pad.axes[i], -1, 1) : 0;
  const curve=(v,power)=>{const m=Math.hypot(v.x,v.y);if(!m)return v;const scale=m**power/m;return{x:v.x*scale,y:v.y*scale};};
  const navigationMove=radialDeadzone(axis(c.moveX),axis(c.moveY),c.deadzone,c.outerDeadzone),navigationLook=radialDeadzone(axis(c.lookX),axis(c.lookY),c.lookDeadzone,c.outerDeadzone);
  const move=curve(navigationMove,{linear:1,precise:1.6,fast:0.7}[c.moveCurve]),
    look=curve(navigationLook,{linear:1,smooth:1.5,precision:2.2}[c.lookCurve]);
  const values = Array.from(
    { length: Math.min(64, pad?.buttons?.length || 0) },
    (_, i) => {
      const b = pad.buttons[i];
      return Number.isFinite(b?.value)?clamp(b.value,0,1):b?.pressed?1:0;
    },
  );
  const buttons = Object.fromEntries(
    Object.entries(PAD_BUTTONS).map(([k, v]) => [
      k,
      values[c.preset === "custom" ? c.bindings[k] : v] >= (["use","mine"].includes(k)?c.triggerThreshold:0.55),
    ]),
  );
  if (c.leftTriggerAxis >= 0)
    buttons.use = (axis(c.leftTriggerAxis) + 1) / 2 >= c.triggerThreshold;
  if (c.rightTriggerAxis >= 0)
    buttons.mine = (axis(c.rightTriggerAxis) + 1) / 2 >= c.triggerThreshold;
  return {
    move,navigationMove,navigationLook,
    look: {
      x: look.x*(c.invertX?-1:1)||0,
      y: look.y*(c.invertY?-1:1)||0,
    },
    buttons,
    values,
    family: controllerFamily(pad?.id, c.preset),
    standard: pad?.mapping === "standard",
  };
}
const faces = {
  xbox: ["A", "B", "X", "Y"],
  playstation: ["×", "○", "□", "△"],
  switch: ["B", "A", "Y", "X"],
  generic: ["1", "2", "3", "4"],
};
export function padGlyph(family, action) {
  const face = faces[family] || faces.generic;
  const n = PAD_BUTTONS[action];
  if (n >= 0 && n <= 3) return face[n];
  const labels =
    family === "playstation"
      ? {
          leftShoulder: "L1",
          rightShoulder: "R1",
          use: "L2",
          mine: "R2",
          view: "Create",
          pause: "Options",
          sprint: "L3",
          target: "R3",
        }
      : family === "switch"
        ? {
            leftShoulder: "L",
            rightShoulder: "R",
            use: "ZL",
            mine: "ZR",
            view: "−",
            pause: "+",
            sprint: "L Stick",
            target: "R Stick",
          }
        : {
            leftShoulder: "LB",
            rightShoulder: "RB",
            use: "LT",
            mine: "RT",
            view: "View",
            pause: "Menu",
            sprint: "L Stick",
            target: "R Stick",
          };
  return (
    labels[action] ||
    { up: "↑", down: "↓", left: "←", right: "→" }[action] ||
    action
  );
}
export function arenaPadGlyph(family, move) {
  const a = padGlyph(family, "leftShoulder");
  return (
    {
      homing: padGlyph(family, "inventory"),
      boom: "↑",
      rush: "↓",
      loop: "←",
      cross: "→",
      shot: a + " + ↑",
      stomp: a + " + ↓",
      spin: a + " + →",
      cyclone: a + " + ←",
    }[move] || move
  );
}
export function menuButtonNames(family) {
  return {
    confirm: family === "switch" ? "crouch" : "jump",
    cancel: family === "switch" ? "jump" : "crouch",
  };
}
// Compare raw samples, not cleared output vectors: a held stick must not steal
// input back from mouse/keyboard when a menu or pause releases gameplay keys.
export function controllerActivity(previous, current, anchor = previous) {
  if (
    Object.entries(current.buttons).some(
      ([k, v]) => v && !previous?.buttons?.[k],
    )
  )
    return true;
  for (const k of ["move", "look"]) {
    const field=k==='move'?'navigationMove':'navigationLook';
    const a=anchor?.[field]||anchor?.[k]||{x:0,y:0},b=current[field]||current[k];
    if (Math.hypot(b.x, b.y) > 0.1 && Math.hypot(b.x - a.x, b.y - a.y) > 0.08)
      return true;
  }
  return false;
}

export function smoothControllerLook(previous,current,seconds,dt){
 if(!seconds||!Math.hypot(current.x,current.y))return {...current};
 const a=1-Math.exp(-Math.max(0,dt)/seconds);
 return {x:previous.x+(current.x-previous.x)*a,y:previous.y+(current.y-previous.y)*a};
}
