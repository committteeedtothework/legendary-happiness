// C2 camera curves: shared velocities and zero acceleration at authored keys.
// Monotone slopes avoid orbit/FOV overshoot without stopping at every key.
export function titanCameraTrack(keys, time) {
  if (time <= keys[0][0]) return keys[0].slice(1);
  if (time >= keys.at(-1)[0]) return keys.at(-1).slice(1);
  time = Math.max(keys[0][0], Math.min(keys.at(-1)[0], time));
  let i = 0;
  while (i < keys.length - 2 && time > keys[i + 1][0]) i++;
  const a = keys[i],
    b = keys[i + 1],
    d = b[0] - a[0],
    u = (time - a[0]) / d;
  const slope = (n, k) => {
    if (n === 0 || n === keys.length - 1) return 0;
    const p = keys[n - 1],
      q = keys[n],
      r = keys[n + 1],
      l = (q[k] - p[k]) / (q[0] - p[0]),
      h = (r[k] - q[k]) / (r[0] - q[0]);
    if (l * h <= 0) return 0;
    const w1 = 2 * (r[0] - q[0]) + (q[0] - p[0]),
      w2 = r[0] - q[0] + 2 * (q[0] - p[0]);
    return (w1 + w2) / (w1 / l + w2 / h);
  };
  return a.slice(1).map((v, k) => {
    const j = k + 1,
      m0 = slope(i, j) * d,
      m1 = slope(i + 1, j) * d,
      delta = b[j] - v;
    return (
      v +
      m0 * u +
      (10 * delta - 6 * m0 - 4 * m1) * u ** 3 +
      (-15 * delta + 8 * m0 + 7 * m1) * u ** 4 +
      (6 * delta - 3 * m0 - 3 * m1) * u ** 5
    );
  });
}
const ease = (x) => {
  x = Math.max(0, Math.min(1, x));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const copy = (p) => ({ x: p.x, y: p.y, z: p.z });
const mix = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});
export function titanShotKey(s, shot) {
  if (!shot)
    return s.stage === "combat" && s.strike && s.config.moveCamera !== false
      ? `move:${s.strike.serial}:${s.strike.move}`
      : "gameplay";
  if (s.counterScene)
    return `counter:${s.counterScene.kind}:${s.counterScene.serial}`;
  if (s.qte) return `qte:${s.qte.kind}`;
  return s.stage;
}
// Compose a short contact zoom from an unmodified base lens; never subtract
// repeatedly from the previous rendered FOV (which drifted with FPS/pause).
export function titanCameraLens(base, target, dt, impactTime = 0) {
  base = target + (base - target) * Math.exp(-Math.max(0, dt) * 5);
  const pulse =
    Math.sin(Math.PI * Math.max(0, Math.min(1, impactTime / 0.22))) * 0.65;
  return { base, fov: base - pulse };
}
// Transient view history only. Saves retain their ordinary encounter clocks.
export function flowTitanShot(history, key, time, current, planned) {
  if (history.key === undefined || time < (history.time ?? time)) {
    history.key = key;
    history.transition = null;
  } else if (history.key !== key) {
    history.transition = {
      at: time,
      from: {
        position: copy(current.position),
        target: copy(current.target),
        fov: current.fov,
      },
      duration:
        key === "gameplay"
          ? history.key === "finale"
            ? 1.4
            : 0.65
          : key.startsWith("move:")
            ? 0.18
            : key.startsWith("counter:")
              ? 0.22
              : 0.4,
    };
    history.key = key;
  }
  history.time = time;
  const t = history.transition;
  if (!t) return planned;
  if (time - t.at + 1e-9 >= t.duration) {
    history.transition = null;
    return planned;
  }
  const w = ease((time - t.at) / t.duration);
  if (w === 1) {
    history.transition = null;
    return planned;
  }
  return {
    position: mix(t.from.position, planned.position, w),
    target: mix(t.from.target, planned.target, w),
    fov: t.from.fov + (planned.fov - t.from.fov) * w,
  };
}
