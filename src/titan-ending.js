export const TITAN_DETONATION = {
  charge: 4.85,
  burst: 5.45,
  clear: 6.4,
  fadeStart: 5.2,
  fadeEnd: 7,
};
const clamp = (v) => Math.max(0, Math.min(1, v));
export const endingEase = (v) => {
  v = clamp(v);
  return v * v * v * (v * (v * 6 - 15) + 10);
};
export function endingTime(s) {
  return s.stage === "victory"
    ? 7 + s.stageTime
    : s.stage === "finale"
      ? s.stageTime
      : -100;
}
export function endingState(s) {
  const t = endingTime(s),
    age = t - TITAN_DETONATION.burst;
  return {
    t,
    age,
    charge: endingEase((t - TITAN_DETONATION.charge) / 0.6),
    rupture: endingEase(age / 0.95),
    flash: age >= 0 ? Math.exp(-age * 8) : 0,
    smoke: age >= 0 ? Math.min(1, age * 3) * Math.max(0, 1 - age / 8) : 0,
  };
}
export function finishingMusicGain(elapsed, end = TITAN_DETONATION.fadeEnd) {
  const duration = Math.min(1.8, Math.max(0.001, end));
  if (elapsed >= end) return 0;
  if (elapsed <= end - duration) return 1;
  return clamp(1 - endingEase((elapsed - (end - duration)) / duration));
}
export function freezeTitanSky(s, saved) {
  if (s.defeatSky) return s.defeatSky;
  const c = s.config,
    q = {
      time: s.time,
      skyClock: s.skyClock ?? s.time,
      phase: s.phase,
      phaseStartedAt: s.phaseStartedAt ?? Math.max(0, s.time - s.stageTime),
      dynamicSky: c.dynamicSky !== false,
      arenaDayLength: Math.max(600,Math.min(3600,c.arenaDayLength || 900)),
      arenaWeather: c.arenaWeather || "auto",
    };
  if (
    saved &&
    [saved.time, saved.phaseStartedAt, saved.arenaDayLength].every(
      Number.isFinite,
    ) &&
    saved.time >= 0 &&
    saved.time <= 1e7 &&
    saved.phaseStartedAt >= 0 &&
    saved.phaseStartedAt <= saved.time &&
    [1, 2].includes(saved.phase) &&
    saved.arenaDayLength >= 90 &&
    saved.arenaDayLength <= 3600 &&
    ["auto", "clear", "storm"].includes(saved.arenaWeather)
  )
    Object.assign(q, {
      time: saved.time,
      phase: saved.phase,
      phaseStartedAt: saved.phaseStartedAt,
      dynamicSky: saved.dynamicSky !== false,
      arenaDayLength: Math.max(600,saved.arenaDayLength),
      skyClock: (Number.isFinite(saved.skyClock)?saved.skyClock:saved.time)*Math.max(600,saved.arenaDayLength)/saved.arenaDayLength,
      arenaWeather: saved.arenaWeather,
    });
  s.defeatSky = q;
  return q;
}
