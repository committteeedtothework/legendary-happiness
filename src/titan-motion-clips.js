import { addAdvancedTitanClips } from "./titan-advanced-clips.js";
import * as T from "three";
import { addTitanCinemaPoses } from "./titan-cinema-poses.js";
import { addSonicFlightCombat } from "./titan-sonic-clips.js";
// Original rotational keyframes in the uploaded rigs' bind coordinates. Never
// animate scale or joint offsets: limb lengths remain constant through blends.
export function addTitanMotionClips(u) {
  const { bones: b, model, mixer, actions, role } = u;
  model.updateMatrixWorld(true);
  const make = (name, duration, poses, loop = false) => {
    const times = Array.from({ length: Math.ceil(duration * 60) + 1 }, (_, i) =>
      Math.min(duration, i / 60),
    );
    const tracks = [];
    for (const [key, pose] of Object.entries(poses)) {
      const bone = b[key];
      if (!bone) continue;
      const parent = bone.parent.getWorldQuaternion(new T.Quaternion()),
        bind = bone.quaternion.clone(),
        values = [];
      let previous;
      for (const t of times) {
        const delta = new T.Quaternion().setFromEuler(
          new T.Euler(...pose(t / duration)),
        );
        const q = parent
          .clone()
          .invert()
          .multiply(delta)
          .multiply(parent)
          .multiply(bind)
          .normalize();
        if (previous && q.dot(previous) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
        values.push(...q.toArray());
        previous = q;
      }
      tracks.push(
        new T.QuaternionKeyframeTrack(bone.name + ".quaternion", times, values),
      );
    }
    const clip = new T.AnimationClip(name, duration, tracks),
      action = mixer.clipAction(clip);
    action
      .setEffectiveWeight(0)
      .setLoop(loop ? T.LoopRepeat : T.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = true;
    actions.set(name, action);
    if (loop) (u.loopClips ||= new Set()).add(name);
  };
  if (role === "sonic") {
    make(
      "boost_run",
      0.38,
      {
        hip: (u) => [0.28, 0, Math.sin(u * Math.PI * 2) * 0.025],
        spine: () => [0.12, 0, 0],
        head: () => [-0.22, 0, 0],
        armL: () => [0.7, 0, -1.3],
        armR: () => [0.7, 0, 1.3],
        elbowL: () => [-0.12, 0, 0],
        elbowR: () => [-0.12, 0, 0],
        legL: (u) => [Math.sin(u * Math.PI * 2) * 0.95, 0, 0.025],
        legR: (u) => [-Math.sin(u * Math.PI * 2) * 0.95, 0, -0.025],
        kneeL: (u) => [
          0.15 + Math.max(0, -Math.sin(u * Math.PI * 2)) * 1.15,
          0,
          0,
        ],
        kneeR: (u) => [
          0.15 + Math.max(0, Math.sin(u * Math.PI * 2)) * 1.15,
          0,
          0,
        ],
      },
      true,
    );
    const strikePulse = (u, at) => Math.exp(-(((u - at) / 0.12) ** 2));
    make("grand_slam", 1.2, {
      hip: (u) => [
        0.15 + strikePulse(u, 0.4) * 0.3,
        Math.sin(Math.PI * u) * 0.55,
        0,
      ],
      spine: (u) => [-0.12, -Math.sin(Math.PI * u) * 0.2, 0],
      head: () => [-0.06, 0, 0],
      armL: () => [0.25, 0, -1.1],
      armR: () => [0.25, 0, 1.1],
      elbowL: () => [-0.6, 0, 0],
      elbowR: () => [-0.6, 0, 0],
      legL: (u) => [-1.65 * strikePulse(u, 0.4), 0, -0.08],
      legR: () => [0.3, 0, 0.1],
      kneeL: (u) => [0.85 * (1 - strikePulse(u, 0.4)), 0, 0],
      kneeR: () => [0.8, 0, 0],
    });
    make("combo_kick", 0.4, {
      hip: (u) => [0.08, Math.sin(Math.PI * u) * 0.85, 0],
      spine: (u) => [0, -Math.sin(Math.PI * u) * 0.3, 0],
      armL: () => [0.15, 0, -1.0],
      armR: () => [0.15, 0, 1.0],
      elbowL: () => [-0.7, 0, 0],
      elbowR: () => [-0.7, 0, 0],
      legL: (u) => [
        -1.5 * strikePulse(u, 0.45),
        0,
        -0.55 * strikePulse(u, 0.45),
      ],
      legR: () => [0.2, 0, 0.08],
      kneeL: (u) => [0.7 * (1 - strikePulse(u, 0.45)), 0, 0],
      kneeR: () => [0.65, 0, 0],
    });
    make("combo_finisher", 0.55, {
      hip: (u) => [
        0.2 + 0.35 * strikePulse(u, 0.455),
        Math.sin(Math.PI * u) * 0.25,
        0,
      ],
      spine: (u) => [-0.1, 0, 0],
      head: () => [-0.06, 0, 0],
      armL: () => [0.3, 0, -1.15],
      armR: () => [0.3, 0, 1.15],
      elbowL: () => [-0.45, 0, 0],
      elbowR: () => [-0.45, 0, 0],
      legR: (u) => [-1.7 * strikePulse(u, 0.455), 0, 0.04],
      legL: () => [0.3, 0, -0.12],
      kneeL: () => [0.65, 0, 0],
      kneeR: (u) => [0.9 * (1 - strikePulse(u, 0.455)), 0, 0],
    });
    make("homing_shot", 1.15, {
      hip: (u) => [-0.1 * Math.sin(Math.PI * u), 0, 0],
      chest: (u) => [-0.16 * Math.sin(Math.PI * u), 0, 0],
      head: (u) => [0.12 * Math.sin(Math.PI * u), 0, 0],
      armL: (u) => [
        -0.65 * Math.sin(Math.PI * u),
        0,
        -1.15 + 0.5 * Math.sin(Math.PI * u),
      ],
      armR: (u) => [
        -0.65 * Math.sin(Math.PI * u),
        0,
        1.15 - 0.5 * Math.sin(Math.PI * u),
      ],
      elbowL: (u) => [-0.8 + 0.35 * Math.sin(Math.PI * u), 0, 0],
      elbowR: (u) => [-0.8 + 0.35 * Math.sin(Math.PI * u), 0, 0],
      legL: (u) => [0.25 * Math.sin(Math.PI * u), 0, 0.1],
      legR: (u) => [-0.2 * Math.sin(Math.PI * u), 0, -0.1],
      kneeL: (u) => [0.45 * Math.sin(Math.PI * u), 0, 0],
      kneeR: (u) => [0.65 * Math.sin(Math.PI * u), 0, 0],
    });
    make(
      "wall_run",
      0.7,
      {
        hip: (u) => [0.1, 0, 0],
        chest: (u) => [0.08, 0, 0],
        head: (u) => [-0.08, 0, 0],
        armL: (u) => [Math.sin(u * Math.PI * 2) * 0.65, 0, -1.0],
        armR: (u) => [-Math.sin(u * Math.PI * 2) * 0.65, 0, 1.0],
        elbowL: (u) => [-0.7, 0, 0],
        elbowR: (u) => [-0.7, 0, 0],
        legL: (u) => [Math.sin(u * Math.PI * 2) * 0.75, 0, 0.03],
        legR: (u) => [-Math.sin(u * Math.PI * 2) * 0.75, 0, -0.03],
        kneeL: (u) => [
          0.2 + Math.max(0, -Math.sin(u * Math.PI * 2)) * 0.8,
          0,
          0,
        ],
        kneeR: (u) => [
          0.2 + Math.max(0, Math.sin(u * Math.PI * 2)) * 0.8,
          0,
          0,
        ],
      },
      true,
    );
    make(
      "wall_idle",
      1,
      {
        hip: (u) => [0.03, 0, 0],
        chest: (u) => [0.04, 0, 0],
        armL: (u) => [-0.2, 0, -1.15],
        armR: (u) => [-0.2, 0, 1.15],
        legL: (u) => [0.08, 0, 0.07],
        legR: (u) => [-0.08, 0, -0.07],
        kneeL: (u) => [0.15, 0, 0],
        kneeR: (u) => [0.15, 0, 0],
      },
      true,
    );
    const pulse = (u) => Math.sin(Math.PI * u) ** 2;
    for (const kind of ["beam", "grab"])
      make(
        "brace_" + kind,
        1,
        {
          hip: (u) => [
            kind === "beam" ? -0.18 : 0.12,
            0,
            Math.sin(u * Math.PI * 2) * 0.015,
          ],
          chest: (u) => [0.12, 0, 0],
          armL: (u) => [-0.65, 0, -0.65],
          armR: (u) => [-0.65, 0, 0.65],
          elbowL: (u) => [-1.1, 0, 0],
          elbowR: (u) => [-1.1, 0, 0],
          legL: (u) => [0.25, 0, 0.2],
          legR: (u) => [-0.25, 0, -0.2],
          kneeL: (u) => [0.45, 0, 0],
          kneeR: (u) => [0.6, 0, 0],
        },
        true,
      );
    make("counter_break", 1.65, {
      hip: (u) => [0.16, Math.sin(u * Math.PI) * 0.45, 0],
      chest: (u) => [-0.15, 0, 0],
      armL: (u) => [0.2, 0, -1.1],
      armR: (u) => [0.2, 0, 1.1],
      elbowL: (u) => [-0.6, 0, 0],
      elbowR: (u) => [-0.6, 0, 0],
      legL: (u) => [-1.5 * Math.exp(-(((u - 0.515) / 0.11) ** 2)), 0, -0.15],
      legR: (u) => [0.35, 0, 0.15],
      kneeL: (u) => [0.7 * (1 - Math.exp(-(((u - 0.515) / 0.11) ** 2))), 0, 0],
      kneeR: (u) => [0.7, 0, 0],
    });
    make("finale_strike", 7, {
      hip: (u) => [
        0.15 + Math.exp(-(((u - 0.514286) / 0.06) ** 2)) * 0.45,
        Math.sin(u * Math.PI * 2) * 0.2,
        0,
      ],
      chest: (u) => [-0.1, 0, 0],
      armL: (u) => [0.3, 0, -1.1],
      armR: (u) => [0.3, 0, 1.1],
      elbowL: (u) => [-0.2, 0, 0],
      elbowR: (u) => [-0.2, 0, 0],
      legL: (u) => [0.2, 0, -0.12],
      legR: (u) => [-1.6 * Math.exp(-(((u - 0.514286) / 0.05) ** 2)), 0, 0.1],
      kneeL: (u) => [0.5, 0, 0],
      kneeR: (u) => [
        0.9 * (1 - Math.exp(-(((u - 0.514286) / 0.05) ** 2))),
        0,
        0,
      ],
    });

    make(
      "boost_flight",
      2,
      {
        hip: (u) => [0.18, 0, Math.sin(u * Math.PI * 2) * 0.015],
        chest: (u) => [0.025 * Math.sin(u * Math.PI * 2), 0, 0],
        armL: (u) => [0.65, 0, -1.3],
        armR: (u) => [0.65, 0, 1.3],
        elbowL: (u) => [-0.15, 0, 0],
        elbowR: (u) => [-0.15, 0, 0],
        legL: (u) => [0.08, 0, 0.045],
        legR: (u) => [0.08, 0, -0.045],
        kneeL: (u) => [0.08, 0, 0],
        kneeR: (u) => [0.08, 0, 0],
      },
      true,
    );
    make("homing_attack", 0.72, {
      hip: (u) => [0.65 * pulse(u), 0, Math.sin(u * Math.PI * 2) * 0.32],
      armL: (u) => [-0.7, 0, -1.05],
      armR: (u) => [-0.7, 0, 1.05],
      elbowL: (u) => [-1.1, 0, 0],
      elbowR: (u) => [-1.1, 0, 0],
      legL: (u) => [-0.9 * pulse(u), 0, 0.1],
      legR: (u) => [-0.9 * pulse(u), 0, -0.1],
      kneeL: (u) => [1.3 * pulse(u), 0, 0],
      kneeR: (u) => [1.3 * pulse(u), 0, 0],
    });
    const kick = (u, at) => Math.exp(-(((u - at) / 0.13) ** 2));
    make("cross_slash", 0.8, {
      hip: (u) => [0.1, Math.sin(u * Math.PI * 2) * 0.55, 0],
      chest: (u) => [0, -Math.sin(u * Math.PI * 2) * 0.18, 0],
      armL: (u) => [0.3, 0, -1.25],
      armR: (u) => [0.3, 0, 1.25],
      legL: (u) => [-1.5 * kick(u, 0.3), 0, -0.8 * kick(u, 0.3)],
      legR: (u) => [-1.5 * kick(u, 0.575), 0, 0.8 * kick(u, 0.575)],
      kneeL: (u) => [0.35 * (1 - kick(u, 0.3)), 0, 0],
      kneeR: (u) => [0.35 * (1 - kick(u, 0.575)), 0, 0],
    });
    addSonicFlightCombat(make);
  } else {
    const ramp = (v) => {
        v = Math.max(0, Math.min(1, v));
        return v * v * (3 - 2 * v);
      },
      sweepTwist = (u) =>
        -0.18 * ramp((u * 3.25) / 1.7) +
        0.36 * ramp((u * 3.25 - 1.7) / 0.6) -
        0.36 * ramp((u * 3.25 - 2.6) / 0.6);
    make("double_sweep", 3.25, {
      chest: (u) => [0.05, sweepTwist(u), 0.035 * Math.sin(u * Math.PI * 2)],
      head: (u) => [-0.04, -sweepTwist(u) * 0.6, 0],
      armL: (u) => [-0.3, 0.2 * Math.sin(u * Math.PI * 2), -0.2],
      armR: (u) => [-0.3, -0.2 * Math.sin(u * Math.PI * 2), 0.2],
      elbowL: (u) => [0, 0, -0.3],
      elbowR: (u) => [0, 0, 0.3],
    });

    make(
      "climb_motion",
      12,
      {
        ...Object.fromEntries(Object.keys(b).map((k) => [k, () => [0, 0, 0]])),
        chest: (u) => [
          Math.sin(u * Math.PI * 2) * 0.022,
          Math.sin(u * Math.PI * 2) * 0.025,
          0,
        ],
        head: (u) => [-0.015, -Math.sin(u * Math.PI * 2) * 0.03, 0],
        armL: (u) => [
          Math.sin(u * Math.PI * 2) * 0.14,
          0,
          -Math.sin(u * Math.PI * 2) * 0.035,
        ],
        armR: (u) => [
          -Math.sin(u * Math.PI * 2) * 0.14,
          0,
          Math.sin(u * Math.PI * 2) * 0.035,
        ],
        elbowL: (u) => [Math.sin(u * Math.PI * 2) * 0.12, 0, 0],
        elbowR: (u) => [-Math.sin(u * Math.PI * 2) * 0.12, 0, 0],
        legL: (u) => [Math.sin(u * Math.PI * 2) * 0.008, 0, 0],
        legR: (u) => [-Math.sin(u * Math.PI * 2) * 0.008, 0, 0],
        kneeL: (u) => [Math.sin(u * Math.PI * 2) * 0.012, 0, 0],
        kneeR: (u) => [-Math.sin(u * Math.PI * 2) * 0.012, 0, 0],
      },
      true,
    );
    make(
      "climb_stance",
      1,
      Object.fromEntries(Object.keys(b).map((k) => [k, () => [0, 0, 0]])),
      true,
    );
    const recoil = (u) =>
      Math.sin(Math.max(0, Math.min(1, (u - 0.515) / 0.485)) * Math.PI);
    make("counter_recoil", 1.65, {
      chest: (u) => [-0.16 * recoil(u), 0, 0.035 * recoil(u)],
      head: (u) => [-0.18 * recoil(u), 0, 0],
      armL: (u) => [0.15 * recoil(u), 0, 0.65 * recoil(u)],
      armR: (u) => [0.15 * recoil(u), 0, -0.65 * recoil(u)],
      elbowL: (u) => [0.15 * recoil(u), 0, 0],
      elbowR: (u) => [0.15 * recoil(u), 0, 0],
    });
    make("finale_brace", 3.6, {
      chest: (u) => [0.04 + u * 0.08, 0, 0],
      head: (u) => [-0.12, 0, 0],
      jaw: (u) => [u * 0.25, 0, 0],
      armL: (u) => [-0.1, 0, 0.15 + u * 0.2],
      armR: (u) => [-0.1, 0, -0.15 - u * 0.2],
      elbowL: (u) => [0.14, 0, 0],
      elbowR: (u) => [0.14, 0, 0],
    });
    make("finale_collapse", 3.4, {
      hip: (u) => [u * u * 0.13, 0, 0],
      chest: (u) => [-Math.sin(u * Math.PI) * 0.16 + u * u * 0.48, 0, u * 0.04],
      head: (u) => [u * 0.28, 0, 0],
      jaw: (u) => [(1 - u) * 0.3, 0, 0],
      armL: (u) => [u * 0.4, 0, 0.3],
      armR: (u) => [u * 0.4, 0, -0.3],
      elbowL: (u) => [u * 0.25, 0, 0],
      elbowR: (u) => [u * 0.25, 0, 0],
      legL: (u) => [-u * 0.25, 0, 0.1],
      legR: (u) => [-u * 0.25, 0, -0.1],
      kneeL: (u) => [u * 0.8, 0, 0],
      kneeR: (u) => [u * 0.8, 0, 0],
    });
    for (const side of ["L", "R"]) {
      const sign = side === "L" ? 1 : -1,
        pose = {
          hip: (u) => [
            0.05,
            -sign * 0.06,
            -sign * 0.08 * Math.sin(Math.PI * u),
          ],
          chest: (u) => [
            0.07 * Math.sin(Math.PI * u),
            0,
            sign * 0.05 * Math.sin(Math.PI * u),
          ],
          ["leg" + side]: (u) => [-0.5 * Math.sin(Math.PI * u), 0, sign * 0.12],
          ["knee" + side]: (u) => [0.6 * Math.sin(Math.PI * u), 0, 0],
          armL: (u) => [-0.08, 0, 0.15],
          armR: (u) => [-0.08, 0, -0.15],
        };
      make("stomp_" + side, 2.7, pose);
    }
  }
  addTitanCinemaPoses(make, role);
  addAdvancedTitanClips(make, role);
}
