import { cinemaRate } from "./titan-cinema-rate.js";
// User-requested source timestamps. EOF markers resolve to the decoded buffer's
// exact duration (MP3 container padding may differ), never a frame timer.
export const TITAN_SCORE_CUES = Object.freeze({
  bpm: 200,
  phaseOne: { start: 0, loopStart: 0, loopEnd: 120 },
  phaseTwo: { start: 121, loopStart: 121, loopEnd: 264.96, toEnd: true },
  transition: { start: 121, duration: 4 },
  finale: { start: 237, duration: 7, toEnd: true },
});
export const TITAN_CUE_FIELDS = Object.freeze([
  ["phaseOne.start", "Battle opening"],
  ["phaseOne.loopStart", "Phase 1 loop in"],
  ["phaseOne.loopEnd", "Phase 1 loop out"],
  ["phaseTwo.start", "Phase 2 start"],
  ["phaseTwo.loopStart", "Phase 2 loop in"],
  ["phaseTwo.loopEnd", "Phase 2 loop out"],
  ["finale.start", "Victory start"],
]);
// Source seconds belong to a particular recording. Custom files never inherit
// purported official markers. Invalid groups fall back atomically, not piecemeal.
export function titanScoreCues(raw) {
  const c = structuredClone(TITAN_SCORE_CUES);
  if (!raw) return c;
  const number = (x) => Number.isFinite(x) && x >= 0 && x <= 900;
  for (const name of ["phaseOne", "phaseTwo"]) {
    const p = raw[name];
    if (
      p &&
      [p.start, p.loopStart, p.loopEnd].every(number) &&
      p.loopEnd - p.loopStart >= 1 &&
      p.start < p.loopEnd &&
      (name === "phaseOne"
        ? p.start <= p.loopStart
        : p.start >= 4 && p.start >= p.loopStart)
    )
      c[name] = {
        start: p.start,
        loopStart: p.loopStart,
        loopEnd: p.loopEnd,
        ...(name === "phaseTwo" && p.toEnd === true ? { toEnd: true } : {}),
      };
  }
  if (number(raw.finale?.start) && raw.finale.start <= 893)
    c.finale.start = raw.finale.start;
  if (Number.isFinite(raw.bpm) && raw.bpm >= 40 && raw.bpm <= 300)
    c.bpm = raw.bpm;
  c.transition.start = c.phaseTwo.start;
  return c;
}
export function titanScoreLength(cues) {
  return Math.max(
    cues.phaseOne.loopEnd,
    cues.phaseTwo.toEnd ? cues.phaseTwo.start + 1 : cues.phaseTwo.loopEnd,
    cues.transition.start + cues.transition.duration,
    cues.finale.start + cues.finale.duration,
  );
}
export function titanScorePlan(s, cues = titanScoreCues(s?.config?.scoreCues)) {
  const time = Number.isFinite(s?.stageTime) ? Math.max(0, s.stageTime) : 0;
  let section;
  if (s?.stage === "combat") section = s.phase === 2 ? "phaseTwo" : "phaseOne";
  else if (s?.stage === "phase") section = "transition";
  else if (s?.stage === "finale" || s?.stage === "victory") section = "finale";
  else return null;
  const cue = cues[section];
  const rate = cinemaRate(s);
  const elapsed =
    s?.stage === "victory"
      ? time + 7 / rate
      : ["phase", "finale"].includes(s?.stage)
        ? time / rate
        : time;
  let offset =
    cue.start +
    (cue.toEnd
      ? elapsed
      : Math.min(
          elapsed,
          (cue.duration ?? Infinity) /
            (["transition", "finale"].includes(section) ? rate : 1),
        ));
  if (cue.end) offset = Math.min(offset, cue.end);
  if (cue.loopEnd && offset >= cue.loopEnd)
    offset =
      cue.loopStart + ((offset - cue.loopEnd) % (cue.loopEnd - cue.loopStart));
  return {
    section,
    offset,
    loopStart: cue.loopStart,
    loopEnd: cue.loopEnd,
    ...(cue.end ? { end: cue.end } : {}),
  };
}
export function scorePosition(voice, now) {
  let position = voice.offset + Math.max(0, now - voice.when);
  if (voice.loopEnd && position >= voice.loopEnd)
    position =
      voice.loopStart +
      ((position - voice.loopEnd) % (voice.loopEnd - voice.loopStart));
  return voice.end ? Math.min(position, voice.end) : position;
}
