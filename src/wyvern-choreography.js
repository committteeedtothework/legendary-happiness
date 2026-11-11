// Original choreography informed by the user's reference recording.
import { wyvernRoutePoint } from "./wyvern-route.js";
import { clamp, ease, wyvernGround, WYVERN_SCALE } from "./wyvern-space.js";
export const WYVERN_CINEMA = Object.freeze({
  intro: 8,
  transform: 12,
  phase: 20,
  counter: 6,
  slam: 6.5,
  launch: 5,
  finale: 10,
  detonate: 6.8,
});
export const WYVERN_QTE = Object.freeze({
  target: 0.4,
  low: 0.50,
  high: 0.72,
  period: 3,
});
export function wyvernQteTargetScale(outerRadius = 51, innerRadius = 41) {
  return (WYVERN_QTE.target * outerRadius) / Math.max(1, innerRadius);
}
export const WYVERN_QTE_STAGES = Object.freeze({
  "wyvern-volley": "timing",
  "wyvern-dive": "timing",
  "wyvern-hold": "mash",
  "wyvern-barrage": "timing",
  "wyvern-mouth": "mash",
  "wyvern-missile": "mash",
});
export function wyvernFlightFrame(s) {
  const w=s.wyvern,q=wyvernRoutePoint(w.routeDistance || 0),f=s.stage==='transform'?ease(s.stageTime/WYVERN_CINEMA.transform):ease((w.flightTime || 0)/6);
  const c=Math.cos(q.yaw),a=Math.sin(q.yaw);
  let highest=wyvernGround(q.x,q.z);
  for(const z of [120,240,380,470])highest=Math.max(highest,wyvernGround(q.x+z*a,q.z+z*c));
  return {x:q.x*f,y:(Math.max(highest+105,wyvernGround(q.x,q.z)+150+(q.rise||0)))*f+(w.cinemaLift || 0),z:q.z*f,yaw:q.yaw*f};
}
export function wyvernDaylight(s) {
  return s.config.dynamicSky === false
    ? 0.8
    : ease(((s.wyvern.skyClock ?? s.wyvern.flightTime ?? 0) - 12) / Math.max(240,(s.config.arenaDayLength || 900)*0.5));
}
export function wyvernCinemaTarget(s,q){
 const yaw=s.wyvern.yaw || 0,c=Math.cos(yaw),a=Math.sin(yaw);
 return {x:(q.x*c+q.z*a)*WYVERN_SCALE,y:66+(q.y-66)*WYVERN_SCALE,z:(q.z*c-q.x*a)*WYVERN_SCALE};
}
export function wyvernCinemaPoint(s) {
  const w = s.wyvern,
    t = s.stageTime,
    from = w.cinematicFrom || s.avatar;
  const blend = (q, u) =>
    Object.fromEntries(
      ["x", "y", "z"].map((k) => [k, from[k] + (wyvernCinemaTarget(s,q)[k] - from[k]) * ease(u)]),
    );
  if (s.stage === "wyvern-counter" || s.stage === "wyvern-slam") {
    const duration =
      s.stage === "wyvern-counter" ? WYVERN_CINEMA.counter : WYVERN_CINEMA.slam;
    const a = Math.max(0, t - 1) * 2.4,
      r = 25;
    let q = blend(
      {
        x: Math.sin(a) * r,
        y: 67 + Math.sin(a * 0.5) * 7,
        z: -10 + Math.cos(a) * r,
      },
      t,
    );
    const out = ease((t - duration + 1.2) / 1.2);
    return {
      x: q.x * (1-out) + Math.sin(w.yaw || 0)*26*WYVERN_SCALE*out,
      y: q.y + ((66-WYVERN_SCALE) - q.y) * out,
      z: q.z + (Math.cos(w.yaw || 0)*26*WYVERN_SCALE - q.z) * out,
    };
  }
  if (s.stage === "wyvern-launch") {
    const a = ease(t / WYVERN_CINEMA.launch);
    return blend({ x: 0, y: 78 + Math.sin(a * Math.PI) * 14, z: 32 }, t / 1.2);
  }
  if (s.stage === "wyvern-hold") return blend({ x: 18, y: 64, z: -5 }, t);
  if (["wyvern-mouth", "wyvern-missile"].includes(s.stage))
    return blend({ x: 0, y: 66, z: 15 }, t / 1.1);
  if (s.stage === "finale") {
    if (t < WYVERN_CINEMA.detonate) return blend({ x: 0, y: 67, z: 5 }, t / 2);
    const a = ease(
      (t - WYVERN_CINEMA.detonate) /
        (WYVERN_CINEMA.finale - WYVERN_CINEMA.detonate),
    );
    return wyvernCinemaTarget(s,{x:22*a,y:67+10*a,z:5+54*a});
  }
  return null;
}
export function wyvernMissilePoint(m) {
  const u = clamp(m.age / m.eta, 0, 1),
    from = m.reflected ? m.target : m.from,
    to = m.reflected ? m.from : m.target;
  const a = Math.sin(u * Math.PI),
    spiral = u * Math.PI * 2 + m.id * 2.4;
  return {
    x: from.x + (to.x - from.x) * u + a * Math.sin(spiral) * 3,
    y: from.y + (to.y - from.y) * u + a * (10 + Math.cos(spiral) * 2),
    z: from.z + (to.z - from.z) * u,
  };
}
