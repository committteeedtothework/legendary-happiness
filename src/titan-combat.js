import { TITAN_CYLOOP } from "./titan-cyloop.js";
import { TITAN_POWER } from "./titan-balance.js";
// Independently configurable damage. Rush's value is per contact, three maximum.
export const TITAN_DAMAGE = TITAN_POWER;
export const TITAN_ACTIONS = Object.freeze({
  punch: {
    duration: 0.32,
    contacts: [0.13],
    reach: 6.5,
    cooldown: 0.32,
  },
  combo: {
    duration: 0.35,
    contacts: [0.15],
    reach: 6.5,
    cooldown: 0.35,
  },
  heavy: { duration: 0.4, contacts: [0.18], reach: 7, cooldown: 0.4 },
  finisher: {
    duration: 0.55,
    contacts: [0.25],
    reach: 7.5,
    cooldown: 0.55,
  },
  homing: {
    duration: 0.72,
    contacts: [0.48],
    reach: 7.5,
    cooldown: 1.3,
  },
  shot: {
    duration: 1.15,
    contacts: [0.36, 0.44, 0.52, 0.6, 0.68, 0.76],
    reach: 65,
    cooldown: 8,
  },
  cross: {
    duration: 0.8,
    contacts: [0.24, 0.46],
    reach: 32,
    cooldown: 5,
  },
  boom: {
    duration: 1.1,
    contacts: [0.22, 0.44, 0.66, 0.88],
    reach: 43,
    cooldown: 3.3,
  },
  stomp: { duration: 1.05, contacts: [0.58], reach: 7, cooldown: 4 },
  spin: {
    duration: 1.05,
    contacts: [0.23, 0.43, 0.63, 0.83],
    reach: 7.2,
    cooldown: 5,
  },
  cyclone: {
    duration: 1.3,
    contacts: [0.4, 0.7, 1],
    reach: 7.2,
    cooldown: 7,
  },
  rush: {
    duration: 0.8,
    contacts: [0.22, 0.4, 0.61],
    reach: 8,
    cooldown: 4.5,
  },
  loop: {
    duration: TITAN_CYLOOP.duration,
    contacts: [TITAN_CYLOOP.contact],
    reach: 13,
    cooldown: 0.8,
  },
  counter: {
    duration: 1.2,
    contacts: [0.48],
    reach: 16,
    cooldown: 1.2,
  },
});
export function titanDamageConfig(raw = {}) {
  return Object.fromEntries(
    Object.entries(TITAN_DAMAGE).map(([k, v]) => [
      k,
      Math.max(1, Math.min(v * 3, Number.isFinite(+raw?.[k]) ? +raw[k] : v)),
    ]),
  );
}
export function titanActionDuration(s) {
  return (
    s.strike?.duration ||
    {
      punch: 0.32,
      counter: 1.2,
      boom: 0.65,
      rush: 0.8,
      loop: TITAN_CYLOOP.duration,
      dodge: 0.42,
      hurt: 0.5,
    }[s.action] ||
    1
  );
}
