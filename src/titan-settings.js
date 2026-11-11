export const ARENA_DEFAULTS = Object.freeze({
  graphicsQuality: "auto",
  sceneryDetail: "auto",
  atmosphere: true,
  antialiasing: true,
  impactEffects: true,
  cinematicCamera: true,
  moveCamera: true,
  cinematicBars: true,
  colossalScale: true,
  titanScale: 2.8,
  cinematicPace: 0.65,
  dynamicSky: true,
  arenaDayLength: 900,
  arenaWeather: "auto",
  weatherEffects: true,
  groundEffects: true,
  liveReflections: true,
  adaptiveBoss: true,
  aggression: 1,
  bossPower: 1,
  renderScale: 1,
  bloomIntensity: 0.26,
  exposure: 1.05,
  ambientOcclusion: "low",
  masterVolume: null,
  musicVolume: null,
  scoreCues: null,
  battleTrack: null,
  effectsVolume: 0.75,
  motionBlur: false,
  speedTrails: true,
  cameraShake: 0.35,
  cameraFov: 67,
  cameraSensitivity: 0.0025,
});
export function arenaConfig(raw) {
  const clamp = (k, lo, hi) =>
    Number.isFinite(raw[k])
      ? Math.max(lo, Math.min(hi, raw[k]))
      : ARENA_DEFAULTS[k];
  return {
    graphicsQuality: ["auto", "low", "balanced", "high"].includes(
      raw.graphicsQuality,
    )
      ? raw.graphicsQuality
      : "auto",
    ambientOcclusion: ["off", "low", "high"].includes(raw.ambientOcclusion)
      ? raw.ambientOcclusion
      : "low",
    sceneryDetail: ["auto", "off", "low", "high"].includes(raw.sceneryDetail)
      ? raw.sceneryDetail
      : "auto",
    atmosphere: raw.atmosphere !== false,
    antialiasing: raw.antialiasing !== false,
    impactEffects: raw.impactEffects !== false,
    cinematicCamera: raw.cinematicCamera !== false,
    moveCamera: raw.moveCamera !== false,
    cinematicBars: raw.cinematicBars !== false,
    colossalScale: raw.colossalScale !== false,
    titanScale: clamp("titanScale", 1, 3.2),
    cinematicPace: clamp("cinematicPace", 0.4, 1),
    dynamicSky: raw.dynamicSky !== false,
    arenaDayLength: clamp("arenaDayLength", 600, 3600),
    arenaWeather: ["auto", "clear", "storm"].includes(raw.arenaWeather)
      ? raw.arenaWeather
      : "auto",
    weatherEffects: raw.weatherEffects !== false,
    groundEffects: raw.groundEffects !== false,
    liveReflections: raw.liveReflections !== false,
    adaptiveBoss: raw.adaptiveBoss !== false,
    aggression: clamp("aggression", 0.7, 1.5),
    bossPower: clamp("bossPower", 0.5, 2),
    renderScale: clamp("renderScale", 0.65, 1),
    bloomIntensity: clamp("bloomIntensity", 0, 0.65),
    exposure: clamp("exposure", 0.7, 1.4),
    masterVolume: clamp("masterVolume", 0, 1),
    musicVolume: clamp("musicVolume", 0, 1),
    effectsVolume: clamp("effectsVolume", 0, 1),
    cameraShake: clamp("cameraShake", 0, 1),
    cameraFov: clamp("cameraFov", 45, 95),
    cameraSensitivity: clamp("cameraSensitivity", 0.0005, 0.01),
    motionBlur: raw.motionBlur === true,
    speedTrails: raw.speedTrails !== false,
    scoreCues: raw.scoreCues ? titanScoreCues(raw.scoreCues) : null,
    battleTrack:
      raw.battleTrack &&
      /^titan:[\w-]{1,80}$/.test(raw.battleTrack.id) &&
      typeof raw.battleTrack.name === "string" &&
      Number.isFinite(raw.battleTrack.duration) &&
      raw.battleTrack.duration > 0 &&
      raw.battleTrack.duration <= 900
        ? {
            id: raw.battleTrack.id,
            name: raw.battleTrack.name.slice(0, 80),
            duration: raw.battleTrack.duration,
          }
        : null,
  };
}
export function initializeArenaSettings(config, world) {
  if (config.masterVolume == null) config.masterVolume = world.volume ?? 0.65;
  if (config.musicVolume == null)
    config.musicVolume = world.musicVolume ?? 0.45;
  return config;
}
export function arenaAudioSettings(config, world = {}) {
  return {
    volume: config.masterVolume ?? world.volume ?? 0.65,
    musicVolume: config.musicVolume ?? world.musicVolume ?? 0.45,
    musicEnabled: config.music !== false,
  };
}
export function arenaQuality(config, world = {}) {
  return (
    { low: 1, balanced: 2, high: 3 }[config.graphicsQuality] ||
    world.graphics ||
    2
  );
}
import { titanScoreCues } from "./giganto-score-timeline.js";
