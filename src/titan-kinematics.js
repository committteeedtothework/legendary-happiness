import {
  titanPierceMotion,
  cinemaEase,
  titanDefeatPose,
} from "./titan-finale.js";
import { sonicLength } from "./titan-metrics.js";
import { titanTransformation } from "./titan-transformation.js";
import { TITAN_SWEEP } from "./titan-sweep.js";
import { armorMode } from "./titan-climb.js";
import {
  TITAN_FINALE,
  TITAN_COUNTER,
  titanCounterContact,
} from "./titan-cinematics.js";
import { titanFootYaw } from "./titan-mobility.js";
import { titanWorldPoint, titanTurn } from "./titan-space.js";
import {
  nearestTitanSurface,
  titanArmPath,
  titanAttackSide,
  titanFootPath,
} from "./titan-contact.js";
import { titanActionDuration, TITAN_ACTIONS } from "./titan-combat.js";
import * as T from "three";
const up = new T.Vector3(0, 1, 0);
function rotateWorld(bone, from, to, weight) {
  if (from.lengthSq() < 1e-8 || to.lengthSq() < 1e-8) return;
  const delta = new T.Quaternion().setFromUnitVectors(
      from.normalize(),
      to.normalize(),
    ),
    q = bone.getWorldQuaternion(new T.Quaternion()).premultiply(delta),
    parent =
      bone.parent?.getWorldQuaternion(new T.Quaternion()) || new T.Quaternion();
  q.premultiply(parent.invert());
  bone.quaternion.slerp(q, weight).normalize();
}
export function solveTitanArm(
  root,
  upper,
  elbow,
  hand,
  target,
  pole,
  weight = 1,
) {
  if (!upper || !elbow || !hand || weight <= 0) return;
  root.updateMatrixWorld(true);
  const a = upper.getWorldPosition(new T.Vector3()),
    b = elbow.getWorldPosition(new T.Vector3()),
    c = hand.getWorldPosition(new T.Vector3()),
    l1 = a.distanceTo(b),
    l2 = b.distanceTo(c),
    direction = target.clone().sub(a);
  if (l1 < 1e-4 || l2 < 1e-4 || direction.lengthSq() < 1e-8) return;
  const distance = T.MathUtils.clamp(
    direction.length(),
    Math.abs(l1 - l2) + 0.001,
    l1 + l2 - 0.001,
  );
  direction.normalize();
  const side = pole
    .clone()
    .sub(a)
    .addScaledVector(direction, -pole.clone().sub(a).dot(direction));
  if (side.lengthSq() < 1e-8) side.crossVectors(direction, up);
  if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
  side.normalize();
  const along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance),
    height = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const bend = a
    .clone()
    .addScaledVector(direction, along)
    .addScaledVector(side, height);
  rotateWorld(upper, b.clone().sub(a), bend.clone().sub(a), weight);
  root.updateMatrixWorld(true);
  const now = elbow.getWorldPosition(new T.Vector3()),
    end = hand.getWorldPosition(new T.Vector3());
  rotateWorld(elbow, end.sub(now), target.clone().sub(now), weight);
  root.updateMatrixWorld(true);
}
export function performTitanSonic(root, s, dt = 1 / 60) {
  const b = root.userData.bones;
  if (s.stage === "transform") {
    const a = titanTransformation(s.stageTime),
      target = titanWorldPoint(s, { x: 0, y: 95, z: 0 });
    if (a.reach > 0.001) {
      const hand = new T.Vector3(target.x, target.y, target.z),
        pole = root.localToWorld(new T.Vector3(-1.2, 1.7, 0.6));
      solveTitanArm(root, b.armR, b.elbowR, b.handR, hand, pole, a.reach);
    }
    b.head.rotation.x -= Math.sin(Math.PI * a.orbit) * (1 - a.gold) * 0.12;
    root.rotation.z =
      Math.sin(s.stageTime * 3) * 0.035 * a.spiral * (1 - a.gold);
  }
  const contactTime = s.counterScene
    ? s.counterScene.elapsed - TITAN_COUNTER.impact
    : Infinity;
  const contactWeight = Math.exp(-((contactTime / 0.12) ** 2));
  if (contactWeight > 0.001) {
    root.updateMatrixWorld(true);
    const target = s.counterScene
        ? titanCounterContact(s).point
        : titanWorldPoint(s, { x: 0, y: 85, z: 18 }),
      side = s.counterScene ? "L" : "R",
      foot = root.userData.model.getObjectByName(
        side === "L" ? "LeftFoot" : "RightFoot",
      );
    const aim = new T.Vector3(target.x, target.y, target.z),
      hip = b["leg" + side].getWorldPosition(new T.Vector3()),
      reach =
        hip.distanceTo(b["knee" + side].getWorldPosition(new T.Vector3())) +
        b["knee" + side]
          .getWorldPosition(new T.Vector3())
          .distanceTo(foot.getWorldPosition(new T.Vector3()));
    // Root motion closes the final gap; IK articulates the kick without
    // stretching a joint or scaling the character into the contact point.
    const delta = aim.clone().sub(hip),
      distance = delta.length();
    if (distance > reach * 0.9)
      root.position.addScaledVector(
        delta.normalize(),
        Math.min(3, distance - reach * 0.9) * contactWeight,
      );
    root.position.y = Math.max(0.05, root.position.y);
    const pole = root.localToWorld(
      new T.Vector3(side === "L" ? 0.8 : -0.8, 1, 1),
    );
    solveTitanArm(
      root,
      b["leg" + side],
      b["knee" + side],
      foot,
      aim,
      pole,
      contactWeight,
    );
  }
  if (s.stage === "finale") {
    const v = titanPierceMotion(s),
      d = Math.hypot(v.x, v.y, v.z) || 1,
      flight =
        cinemaEase((s.stageTime - 1.65) / 0.5) *
        (1 - cinemaEase((s.stageTime - 5.3) / 1.7));
    root.rotation.y = Math.atan2(v.x, v.z);
    root.rotation.x = -Math.asin(Math.max(-1, Math.min(1, v.y / d))) * flight;
    root.rotation.z = Math.sin(s.stageTime * 4) * 0.035 * flight;
    b.armL.rotation.x -= 0.3 * flight;
    b.armR.rotation.x -= 0.3 * flight;
    b.elbowL.rotation.z += 0.15 * flight;
    b.elbowR.rotation.z -= 0.15 * flight;
  }
  if (s.strike && ["spin", "cyclone"].includes(s.strike.move)) {
    const q = nearestTitanSurface(s, s.avatar).point;
    root.rotation.y =
      (s.lock
        ? Math.atan2(q.x - s.avatar.x, q.z - s.avatar.z)
        : s.avatar.yaw + Math.PI) +
      (s.strike.elapsed / s.strike.duration) * Math.PI * 4;
  }
  if (s.strike?.move === "homing") {
    const u=Math.max(0,Math.min(1,s.strike.elapsed/0.36));
    root.rotation.x += Math.PI*2*(u*u*(3-2*u));
  }
  if (s.strike?.move === "cross")
    root.rotation.z += Math.sin(s.strike.elapsed/s.strike.duration*Math.PI*4)*0.22;
  // The rig always follows the physical avatar, including the explicit E orbit.
  if (s.action === "loop") root.rotation.z = -0.28;
  if (s.action === "rush")
    root.rotation.z = T.MathUtils.clamp(-s.avatar.vx * 0.009, -0.26, 0.26);
  if (s.stage === "combat" && s.parryHeld && !s.strike && !s.qte) {
    for (const side of ["L","R"]) {
      const target=root.localToWorld(new T.Vector3(side === "L" ? -0.22 : 0.22,side === "L" ? 2.4 : 2.15,0.85));
      const pole=root.localToWorld(new T.Vector3(side === "L" ? 1.1 : -1.1,1.6,0.3));
      solveTitanArm(root,b["arm"+side],b["elbow"+side],b["hand"+side],target,pole,0.9);
    }
  }
  const speed = Math.hypot(s.avatar.vx, s.avatar.vz);
  if (s.stage === "combat" && s.action === "idle") {
    root.rotation.z = T.MathUtils.clamp(-s.avatar.vx * 0.007, -0.18, 0.18);
    root.rotation.x = T.MathUtils.clamp(s.avatar.vy * 0.006, -0.15, 0.15);
    root.position.y +=
      Math.sin(s.time * 2.6) * 0.06 * (1 - Math.min(1, speed / 20));
  }

  if (
    s.stage === "combat" &&
    ["punch", "rush"].includes(s.action) &&
    !["heavy", "finisher"].includes(s.strike?.move)
  ) {
    const u = T.MathUtils.clamp(
        1 - s.actionTime / titanActionDuration(s),
        0,
        1,
      ),
      rushTime = s.strike?.elapsed || 0,
      contactIndex = TITAN_ACTIONS.rush.contacts.reduce(
        (best, t, i) =>
          Math.abs(t - rushTime) <
          Math.abs(TITAN_ACTIONS.rush.contacts[best] - rushTime)
            ? i
            : best,
        0,
      ),
      strike =
        s.action === "rush"
          ? Math.exp(
              -(
                ((rushTime - TITAN_ACTIONS.rush.contacts[contactIndex]) /
                  0.07) **
                2
              ),
            )
          : Math.sin(Math.PI * T.MathUtils.clamp(u / 0.82, 0, 1)) ** 1.6,
      left =
        s.strike?.move === "rush"
          ? contactIndex % 2 !== 0
          : (s.strike?.hand || (s.comboStep % 2 ? "L" : "R")) === "L";
    const contact = nearestTitanSurface(s, {
        x: s.avatar.x,
        y: s.avatar.y + sonicLength(s, 1.8),
        z: s.avatar.z,
      }),
      direction = new T.Vector3(
        contact.point.x - s.avatar.x,
        contact.point.y - s.avatar.y - sonicLength(s, 1.8),
        contact.point.z - s.avatar.z,
      ),
      distance = direction.length();
    if (distance > 2 && distance < 9)
      root.position.addScaledVector(
        direction.normalize(),
        Math.min(0.7, Math.max(0,contact.distance-sonicLength(s,1.45))) * strike,
      );
    root.updateMatrixWorld(true);
    const localTarget = root.localToWorld(
        new T.Vector3(left ? 0.38 : -0.38, 2.25, 0.35 + strike * 1.45),
      ),
      target = localTarget.lerp(
        new T.Vector3(contact.point.x, contact.point.y, contact.point.z),
        strike * 0.65,
      ),
      pole = root.localToWorld(new T.Vector3(left ? 1.5 : -1.5, 1.5, 0.1));
    solveTitanArm(
      root,
      b[left ? "armL" : "armR"],
      b[left ? "elbowL" : "elbowR"],
      b[left ? "handL" : "handR"],
      target,
      pole,
      0.85 * strike,
    );
  }
  if (
    s.stage === "combat" &&
    ["heavy", "finisher", "counter", "stomp"].includes(s.strike?.move)
  ) {
    const move = s.strike.move,
      at = TITAN_ACTIONS[move].contacts[0],
      weight = Math.exp(-(((s.strike.elapsed - at) / 0.09) ** 2)),
      side = move === "finisher" ? "R" : "L";
    if (weight > 0.001) {
      const contact = nearestTitanSurface(s, {
          ...s.avatar,
          y: s.avatar.y + sonicLength(s, 1.8),
        }),
        foot = root.userData.model.getObjectByName(
          side === "L" ? "LeftFoot" : "RightFoot",
        ),
        pole = root.localToWorld(
          new T.Vector3(side === "L" ? 1.2 : -1.2, 1, 1.2),
        );
      solveTitanArm(
        root,
        b["leg" + side],
        b["knee" + side],
        foot,
        new T.Vector3(contact.point.x, contact.point.y, contact.point.z),
        pole,
        weight * 0.85,
      );
    }
  }
  const u = root.userData,
    boosting =
      s.stage === "traversal" &&
      !s.climb?.attached &&
      u.currentClip === "boost_run";
  u.boostArmWeight =
    (u.boostArmWeight || 0) +
    ((boosting ? 1 : 0) - (u.boostArmWeight || 0)) *
      (1 - Math.exp(-Math.max(0, dt) * 20));
  if (
    s.stage === "traversal" &&
    !s.climb?.attached &&
    u.boostArmWeight > 0.001
  ) {
    for (const side of ["L", "R"]) {
      const sign = side === "L" ? 1 : -1;
      solveTitanArm(
        root,
        b["arm" + side],
        b["elbow" + side],
        b["hand" + side],
        root.localToWorld(new T.Vector3(sign * 0.48, 2.2, -0.8)),
        root.localToWorld(new T.Vector3(sign * 0.85, 2.1, -0.35)),
        u.boostArmWeight,
      );
    }
  }
  const wantsGuard =
    s.stage === "combat" &&
    ((s.parryHeld && s.action === "idle") || s.qte) &&
    !s.counterScene;
  u.guardWeight =
    (u.guardWeight || 0) +
    ((wantsGuard ? 1 : 0) - (u.guardWeight || 0)) *
      (1 - Math.exp(-Math.max(0, dt) * 16));
  if (
    s.stage === "combat" &&
    u.guardWeight > 0.001 &&
    !s.counterScene &&
    !s.strike &&
    !["punch", "counter", "shot", "dodge", "hurt"].includes(s.action)
  ) {
    for (const side of ["L", "R"]) {
      const sign = side === "L" ? 1 : -1,
        target = root.localToWorld(new T.Vector3(sign * 0.3, 2.45, 0.78)),
        pole = root.localToWorld(new T.Vector3(sign * 1.4, 1.7, 0));
      solveTitanArm(
        root,
        b["arm" + side],
        b["elbow" + side],
        b["hand" + side],
        target,
        pole,
        0.72 * u.guardWeight,
      );
    }
  }
}
export function performTitanBoss(root, s) {
  const chest = root.userData.bones.chest || root.userData.bones.spine;
  if (chest && s.stage === "combat") {
    const walk = s.boss?.walk ? Math.sin(s.boss.walk.elapsed * 4.4) : 0;
    chest.rotation.z += walk * 0.009;
    chest.rotation.x += Math.sin(s.time * 0.75) * 0.003;
  }
  const head = root.userData.bones.head;
  if (
    head &&
    !(armorMode(s) && ["intro", "traversal"].includes(s.stage)) &&
    ["intro", "traversal", "combat"].includes(s.stage)
  ) {
    root.updateMatrixWorld(true);
    const origin = head.getWorldPosition(new T.Vector3()),
      forward = root.userData.jawSocket
        ? root.userData.jawSocket.getWorldPosition(new T.Vector3()).sub(origin)
        : new T.Vector3(0, 0, 1).applyQuaternion(
            head.getWorldQuaternion(new T.Quaternion()),
          ),
      target = new T.Vector3(
        s.avatar.x,
        s.avatar.y + sonicLength(s, 2),
        s.avatar.z,
      ).sub(origin);
    rotateWorld(head, forward, target, 0.38);
  }

  const b = root.userData.bones;
  if (["finale", "victory"].includes(s.stage)) {
    const time = s.stage === "victory" ? 7 : s.stageTime,
      a = titanDefeatPose(time),
      w = cinemaEase((time - 3.6) / 0.7);
    root.updateMatrixWorld(true);
    for (const side of ["L", "R"]) {
      const sign = side === "L" ? 1 : -1,
        target = root.localToWorld(
          new T.Vector3(
            sign * (23 + 6 * a.fall),
            65 - 12 * a.fall,
            28 + 8 * a.fall,
          ),
        ),
        pole = root.localToWorld(new T.Vector3(sign * 58, 46, 13));
      solveTitanArm(
        root,
        b["arm" + side],
        b["elbow" + side],
        b["hand" + side],
        target,
        pole,
        w,
      );
    }
    b.head.rotation.z += w * 0.13;
    return;
  }
  if (s.boss?.walk && s.stage !== "finale" && s.stage !== "victory") {
    for (const side of ["L", "R"]) plantFoot(root, s, side);
  }
  if (s.counterScene?.kind === "crunch" && s.counterScene.elapsed < 0.6) {
    const c = s.counterScene,
      t = c.elapsed / 0.6,
      e = t * t * (3 - 2 * t);
    for (const side of ["L", "R"]) {
      const held = titanArmPath(
          { ...s, attack: "crunch", attackAim: c.from },
          side,
          10,
        ),
        rest = titanWorldPoint(s, {
          x: side === "L" ? 18 : -18,
          y: 25,
          z: -10.5,
        }),
        q = new T.Vector3(held.x, held.y, held.z).lerp(
          new T.Vector3(rest.x, rest.y, rest.z),
          e,
        ),
        pole = titanWorldPoint(s, { x: side === "L" ? 58 : -58, y: 49, z: 1 });
      solveTitanArm(
        root,
        b["arm" + side],
        b["elbow" + side],
        b["hand" + side],
        q,
        new T.Vector3(pole.x, pole.y, pole.z),
        1,
      );
    }
  }
  if (
    ["combat", "phase", "finale"].includes(s.stage) &&
    s.attack === "idle" &&
    !s.counterScene &&
    root.userData.recovery?.hands
  ) {
    const recovery = root.userData.recovery,
      age = Math.max(0, s.time - recovery.start),
      t = Math.min(1, age / TITAN_SWEEP.recovery),
      weight = 1 - t * t * (3 - 2 * t);
    if (weight > 0)
      for (const side of ["L", "R"]) {
        const pole = titanWorldPoint(s, {
          x: side === "L" ? 58 : -58,
          y: 49,
          z: 1,
        });
        solveTitanArm(
          root,
          b["arm" + side],
          b["elbow" + side],
          b["hand" + side],
          recovery.hands[side].clone(),
          new T.Vector3(pole.x, pole.y, pole.z),
          weight,
        );
      }
  }
  if (s.stage !== "combat" || (s.attack === "idle" && !s.tactics?.guard))
    return;
  if (s.attack === "stomp") {
    plantFoot(root, s, s.swatSide || "L");
  }

  for (const side of ["L", "R"]) {
    if (["beam", "stomp"].includes(s.attack)) continue;
    if (
      !s.tactics?.guard &&
      !["crunch", "sweep", "pulse", "spin"].includes(s.attack) &&
      side !== titanAttackSide(s)
    )
      continue;
    const q = titanArmPath(s, side),
      sign = side === "L" ? 1 : -1;
    solveTitanArm(
      root,
      b["arm" + side],
      b["elbow" + side],
      b["hand" + side],
      new T.Vector3(q.x, q.y, q.z),
      new T.Vector3(
        ...Object.values(titanWorldPoint(s, { x: sign * 58, y: 49, z: 1 })),
      ),
      1,
    );
  }
}

function plantFoot(root, s, side) {
  const binding = root.userData.footBindings?.get(side);
  if (!binding) return;
  const q = titanFootPath(s, side),
    b = root.userData.bones,
    pole = titanWorldPoint(s, { x: side === "L" ? 16 : -16, y: 20, z: 28 });
  let footYaw = titanFootYaw(s, side);
  if (s.stage === "finale") {
    const t = Math.max(0, Math.min(1, s.stageTime / 0.6)),
      u = t * t * (3 - 2 * t),
      rest = titanWorldPoint(
        s,
        { x: side === "L" ? 4.84 : -4.84, y: 1.48, z: -6.02 },
        { ...s.boss, walk: null },
      );
    for (const k of ["x", "y", "z"]) q[k] += (rest[k] - q[k]) * u;
    footYaw += titanTurn(footYaw, s.boss?.yaw || 0) * u;
  }
  solveTitanArm(
    root,
    b["leg" + side],
    b["knee" + side],
    binding.foot,
    new T.Vector3(q.x, q.y, q.z),
    new T.Vector3(pole.x, pole.y, pole.z),
    1,
  );
  const orientation = new T.Quaternion()
      .setFromAxisAngle(up, footYaw)
      .multiply(binding.orientation),
    parent = binding.foot.parent.getWorldQuaternion(new T.Quaternion());
  binding.foot.quaternion.copy(parent.invert().multiply(orientation));
  root.updateMatrixWorld(true);
}
