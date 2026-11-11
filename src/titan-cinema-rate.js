// Pose/cue clocks stay in their authored units; only protected movie time slows.
export const TITAN_MOVIES = Object.freeze([
  "intro",
  "transform",
  "phase",
  "finale",
]);
export function cinemaRate(s) {
  const v = s?.cinemaRate ?? s?.config?.cinematicPace ?? 1;
  return Number.isFinite(v) ? Math.max(0.4, Math.min(1, v)) : 1;
}
