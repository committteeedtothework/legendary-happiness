import { actionDuration } from "./animation.js";
import { ITEMS } from "./data.js";
const serials = new WeakMap();
let nextSerial = 0;
const kinds = new Set([
  "attack",
  "mine",
  "use",
  "eat",
  "fire",
  "hurt",
  "place",
  "swing",
]);
export function cleanRemoteAction(a) {
  if (
    !a ||
    !kinds.has(a.kind) ||
    !Number.isSafeInteger(a.serial) ||
    a.serial < 1 ||
    !Number.isFinite(a.age) ||
    !Number.isFinite(a.duration) ||
    a.duration <= 0 ||
    a.duration > 2 ||
    a.age < 0 ||
    a.age >= a.duration
  )
    return null;
  return {
    serial: a.serial,
    kind: a.kind,
    age: a.age,
    duration: a.duration,
    direction: a.direction === -1 ? -1 : 1,
  };
}
export function sampleAction(g) {
  const a = g.renderer?.animator?.action;
  if (!a) return null;
  if (!serials.has(a)) serials.set(a, ++nextSerial);
  return cleanRemoteAction({ ...a, serial: serials.get(a) });
}
export function recordPeerAction(session, peer, kind) {
  const id = peer.inventory.held?.id;
  peer.visualAction = {
    serial: (peer.visualSequence = (peer.visualSequence || 0) + 1),
    kind,
    age: 0,
    duration: actionDuration(kind, ITEMS[id]?.tool, id),
    direction: 1,
    started: (session.simulationGame || session.game).elapsed,
  };
}
