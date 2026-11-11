import * as T from "three";
// Rig-local pose transitions. Interruption blends from the currently displayed
// pre-IK pose; it never promotes a half-weight old clip back to full weight.
export function initializeTitanPose(u) {
  u.bindPose = new Map();
  u.sampledPositions = new Map();
  u.displayPose = new Map();
  u.layeredBones = new Set();
  u.blendQ = new T.Quaternion();
  u.blendP = new T.Vector3();
  for (const name of ["super_quills", "dorsal_extend", "dorsal_pulse"]) {
    for (const t of u.actions.get(name)?.getClip().tracks || []) {
      const bone = u.model.getObjectByName(
        t.name.slice(0, t.name.lastIndexOf(".")),
      );
      if (bone) u.layeredBones.add(bone);
    }
  }
  // Partial runtime clips inherit a fully posed idle, never an unposed bind/T
  // stance. Keep the true rest offsets/scales in the rig's existing bindings.
  const idle = u.actions.get("idle");
  idle.reset().play().setEffectiveWeight(1).setEffectiveTimeScale(0);
  idle.time = 0;
  u.mixer.update(0);
  const neutral = new Map();
  u.model.traverse((b) => {
    if (b.isBone)
      neutral.set(b, { q: b.quaternion.clone(), p: b.position.clone() });
  });
  idle.stop();
  u.model.traverse((b) => {
    if (!b.isBone) return;
    const pose = u.layeredBones.has(b)
      ? { q: b.quaternion.clone(), p: b.position.clone() }
      : neutral.get(b);
    b.quaternion.copy(pose.q);
    b.position.copy(pose.p);
    u.bindPose.set(b, pose);
    u.sampledPositions.set(b, pose.p.clone());
    u.displayPose.set(b, { q: pose.q.clone(), p: pose.p.clone() });
  });
}
export function titanActionAt(u, name, time, dt, layer = "body") {
  const action = u.actions.get(name);
  if (!action) throw Error("Missing imported clip " + name);
  const previous = u[layer];
  if (previous !== action) {
    if (layer === "body") {
      const from = new Map(
        [...u.displayPose]
          .filter(([b]) => !u.layeredBones.has(b))
          .map(([b, p]) => [b, { q: p.q.clone(), p: p.p.clone() }]),
      );
      previous?.stop();
      for (const [bone, pose] of u.bindPose) {
        if (u.layeredBones.has(bone)) continue;
        bone.quaternion.copy(pose.q);
        bone.position.copy(pose.p);
        u.sampledRotations.get(bone)?.copy(pose.q);
        u.sampledPositions.get(bone)?.copy(pose.p);
      }
      action.reset().play().setEffectiveWeight(1).setEffectiveTimeScale(0);
      u.transitions.set(layer, {
        from,
        age: previous ? 0 : 0.16,
        duration: /attack|counter|boom|rush|dodge|shot/.test(name)
          ? (u.role === "sonic" ? 0.075 : 0.09)
          : u.role === "sonic" ? (/jump|land|flight/.test(name) ? 0.14 : 0.18) : 0.22,
      });
    } else {
      const existing = u.transitions.get(layer);
      if (existing?.previous && existing.previous !== previous)
        existing.previous.stop();
      action.reset().play().setEffectiveWeight(0).setEffectiveTimeScale(0);
      u.transitions.set(layer, {
        previous,
        action,
        age: previous ? 0 : 0.16,
        duration: 0.16,
      });
    }
    u[layer] = action;
  }
  const duration = action.getClip().duration,
    loop = u.metadata.clips[name]?.loop || u.loopClips?.has(name);
  action.paused = false;
  action.enabled = true;
  action.time = loop
    ? ((Math.max(0, time) % duration) + duration) % duration
    : Math.max(0, Math.min(duration - 1e-6, time));
  return action;
}
export function blendTitanPose(u, dt) {
  for (const [layer, tr] of u.transitions) {
    tr.age += Math.max(0, dt);
    const t = Math.min(1, tr.age / tr.duration),
      w = t * t * t * (t * (t * 6 - 15) + 10);
    tr.weight = w;
    if (layer !== "body") {
      tr.action.setEffectiveWeight(w);
      tr.previous?.setEffectiveWeight(1 - w);
      if (t === 1) {
        tr.previous?.stop();
        u.transitions.delete(layer);
      }
    }
  }
  for (const [b, q] of u.sampledRotations) b.quaternion.copy(q);
  for (const [b, p] of u.sampledPositions) b.position.copy(p);
  u.mixer.update(0);
  for (const [b, q] of u.sampledRotations) q.copy(b.quaternion);
  for (const [b, p] of u.sampledPositions) p.copy(b.position);
  const tr = u.transitions.get("body");
  if (tr) {
    for (const [b, from] of tr.from) {
      const q = u.blendQ.copy(b.quaternion),
        p = u.blendP.copy(b.position);
      b.quaternion.copy(from.q).slerp(q, tr.weight).normalize();
      b.position.copy(from.p).lerp(p, tr.weight);
    }
    if (tr.weight === 1) u.transitions.delete("body");
  }
  for (const [b, pose] of u.displayPose) {
    pose.q.copy(b.quaternion);
    pose.p.copy(b.position);
  }
}
export function titanLocomotionTime(u, name, clock) {
  if (
    !u.motionClock ||
    u.motionClock.name !== name ||
    clock < u.motionClock.last
  ) {
    u.motionClock = { name, start: clock, last: clock };
  }
  u.motionClock.last = clock;
  return Math.max(0, clock - u.motionClock.start);
}

// Both the isolated collision rig and the visible rig sample this exact clock.
// No render-frame-dependent crossfade can separate the armor from its collider.
export function sampleTitanArmorPose(u, clock) {
  titanActionAt(u, "climb_motion", clock, 0);
  u.transitions.delete("body");
  blendTitanPose(u, 0);
}
