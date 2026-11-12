// Original notification cue; no external recording or timer survives the cue.
export const ACHIEVEMENT_NOTICE = Object.freeze({
  fadeIn: 0.24,
  hold: 3.2,
  fadeOut: 0.56,
  duration: 4,
});
export function achievementEnvelope(age) {
  const { fadeIn, hold, fadeOut } = ACHIEVEMENT_NOTICE;
  const t = Math.max(
    0,
    Math.min(
      1,
      Math.min(age / fadeIn, (fadeIn + hold + fadeOut - age) / fadeOut),
    ),
  );
  return t * t * (3 - 2 * t);
}
export function playAchievementCue(
  context,
  output,
  { arena = false, challenge = false, volume = 1 } = {},
) {
  if (!context || !output || context.state !== "running" || !(volume > 0))
    return false;
  const start = context.currentTime + 0.005;
  const notes = arena
    ? [740, 988, 1480, 1976]
    : [523.25, 659.25, 783.99, 1046.5];
  if (challenge) notes.push(arena ? 2489 : 1567.98);
  for (const [i, hz] of notes.entries()) {
    const osc = context.createOscillator(),
      gain = context.createGain(),
      at = start + i * 0.085;
    osc.type = arena ? "sine" : "triangle";
    osc.frequency.setValueAtTime(hz, at);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.11 * Math.min(1, volume), at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
    osc.connect(gain);
    gain.connect(output);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(at);
    osc.stop(at + 0.36);
  }
  return true;
}
