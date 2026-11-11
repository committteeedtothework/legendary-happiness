import { cinemaRate } from "./titan-cinema-rate.js";
import { TITAN_SCORE_CUES, scorePosition } from "./giganto-score-timeline.js";
// A fixed-step catch-up may queue a cue several steps before the final pose.
// Carry its complete age into delivery so audio never treats it as fresh.
export function ageTitanEvents(s, events) {
  for (const e of events)
    if (
      ["cinematic-cue", "transformation-cue", "shot"].includes(e.type) &&
      Number.isFinite(e.age) &&
      Number.isFinite(e.at)
    )
      e.age += Math.max(0, s.time - e.at) / (["phase", "finale"].includes(s.stage) ? cinemaRate(s) : 1);
  return events;
}
// Protected cinematic poses share the music transport, including frame hitches
// and resumed cursor offsets. Gameplay remains fixed-step and event-driven.
export function alignTitanCinematic(s, score, pendingStep = 0) {
  const section = { phase: "transition", finale: "finale" }[s.stage],
    voice = score?.current;
  if (
    !section ||
    !voice ||
    voice.section !== section ||
    score.context.state !== "running"
  )
    return;
  const cue = (score.cues || TITAN_SCORE_CUES)[section],
    clock = scorePosition(voice, score.context.currentTime) - cue.start;
  if (Number.isFinite(clock))
    // The caller is about to simulate pendingStep seconds. Subtract that here;
    // adding it twice let poses lead the song after ordinary frames and hitches.
    s.stageTime = Math.max(
      0,
      Math.min(cue.duration, clock * cinemaRate(s)) -
        pendingStep * cinemaRate(s),
    );
}
