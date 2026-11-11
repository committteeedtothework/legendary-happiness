// Original full-body rotations on the supplied rigs. No scale or bind-offset tracks.
const pulse = (u, t, w = 0.1) => Math.exp(-(((u - t) / w) ** 2));
export function addAdvancedTitanClips(make, role) {
  if (role === "sonic") {
    make("stomp_attack", 1.05, {
      hip: (u) => [0.25 + 0.6 * pulse(u, 0.55), 0, 0],
      spine: (u) => [-0.15 * pulse(u, 0.3), 0, 0],
      head: () => [-0.1, 0, 0],
      armL: () => [0.2, 0, -1.1],
      armR: () => [0.2, 0, 1.1],
      elbowL: () => [-0.8, 0, 0],
      elbowR: () => [-0.8, 0, 0],
      legL: (u) => [-0.3 - 1.35 * pulse(u, 0.55), 0, -0.1],
      legR: (u) => [0.3 + 0.6 * pulse(u, 0.3), 0, 0.1],
      kneeL: (u) => [1 - pulse(u, 0.55), 0, 0],
      kneeR: () => [1.15, 0, 0],
    });
    make("spin_slash", 1.05, {
      hip: (u) => [0.16, 0, 0.12 * Math.sin(u * Math.PI * 4)],
      chest: (u) => [0, 0.22 * Math.sin(u * Math.PI * 4), 0],
      head: () => [-0.1, 0, 0],
      armL: () => [-0.35, 0, -0.65],
      armR: () => [-0.35, 0, 0.65],
      elbowL: () => [-1.15, 0, 0],
      elbowR: () => [-1.15, 0, 0],
      legL: () => [-1.15, 0, -0.18],
      legR: () => [-1.15, 0, 0.18],
      kneeL: () => [1.25, 0, 0],
      kneeR: () => [1.25, 0, 0],
    });
    make("cyclone_kick", 1.3, {
      hip: (u) => [0.2, 0, 0.2 * Math.sin(u * Math.PI * 4)],
      spine: () => [-0.12, 0, 0],
      head: () => [-0.08, 0, 0],
      armL: () => [0.25, 0, -1.3],
      armR: () => [0.25, 0, 1.3],
      elbowL: () => [-0.6, 0, 0],
      elbowR: () => [-0.65, 0, 0],
      legL: (u) => [-1.3, 0, -0.45 * Math.sin(u * Math.PI * 3)],
      legR: (u) => [-0.3, 0, 0.8 + Math.sin(u * Math.PI * 3) * 0.2],
      kneeL: () => [0.15, 0, 0],
      kneeR: () => [0.5, 0, 0],
    });
    const boomKick = u => Math.sin(u*Math.PI*5-Math.PI/2)*Math.min(1,u/0.12)*Math.min(1,(1-u)/0.15);
    make("sonic_boom", 1.1, {
      spine: () => [-0.08, 0, 0],
      hip: (u) => [
        0.18,
        0.25 * boomKick(u),
        -0.28 * Math.sin(Math.PI*u),
      ],
      head: () => [-0.1, 0, 0],
      chest: (u) => [-0.1, -0.2 * boomKick(u), 0],
      armL: () => [0.15, 0, -1.2],
      armR: () => [0.15, 0, 1.2],
      elbowL: () => [-0.65, 0, 0],
      elbowR: () => [-0.65, 0, 0],
      legL: (u) => [-1.45 * Math.max(0, boomKick(u)), 0, -0.1],
      legR: (u) => [1.45 * Math.min(0, boomKick(u)), 0, 0.1],
      kneeL: (u) => [0.6 - 0.5 * Math.max(0, boomKick(u)), 0, 0],
      kneeR: (u) => [0.6 + 0.5 * Math.min(0, boomKick(u)), 0, 0],
    });
  } else {
    make("rotating_sweep", 4.5, {
      hip: (u) => [0.08, 0, 0],
      chest: (u) => [
        -0.12 * Math.sin(u * Math.PI),
        0.2 * Math.sin(u * Math.PI),
        0,
      ],
      head: (u) => [-0.1, 0, 0],
      armL: (u) => [-0.1, 0, 1.1 * Math.min(1, u / 0.45)],
      armR: (u) => [-0.1, 0, -1.1 * Math.min(1, u / 0.45)],
      elbowL: () => [0.08, 0, 0],
      elbowR: () => [0.08, 0, 0],
      legL: () => [0, 0, -0.025],
      legR: () => [0, 0, 0.025],
      kneeL: () => [0.05, 0, 0],
      kneeR: () => [0.05, 0, 0],
    });
    for (const side of ["L", "R"])
      make("uppercut_" + side, 2.85, {
        hip: (u) => [
          0.04,
          0,
          (side === "L" ? 1 : -1) * 0.07 * Math.sin(u * Math.PI),
        ],
        chest: (u) => [
          0.12 * Math.sin(u * Math.PI),
          0.2 * (side === "L" ? 1 : -1) * Math.sin(u * Math.PI),
          0,
        ],
        head: (u) => [-0.14 * Math.sin(u * Math.PI), 0, 0],
        jaw: (u) => [0.12 * Math.sin(u * Math.PI), 0, 0],
        ["arm" + side]: (u) => [
          -0.4 * Math.sin(u * Math.PI),
          0,
          (side === "L" ? 1 : -1) * 0.4,
        ],
        ["elbow" + side]: (u) => [0.5 * Math.sin(u * Math.PI), 0, 0],
        legL: () => [0, 0, 0],
        legR: () => [0, 0, 0],
      });
  }
}
