// Original rotational choreography on the existing rigs; simulation cues own
// contacts. No joint scale/translation or root movement is authored here.
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => {
  x = clamp(x);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const pulse = (u, at, width) => Math.exp(-(((u - at) / width) ** 2));
export function addTitanCinemaPoses(make, role) {
  if (role === "sonic") {
    const charge = (t) =>
      ease((t - 2.55) / 1.1) * (1 - ease((t - 4.05) / 0.45));
    const launch = (t) => ease((t - 4.65) / 0.65);
    make("transform", 6, {
      hip: (u) => [
        -0.1 * charge(u * 6) + 0.65 * launch(u * 6),
        0,
        0.035 * Math.sin(u * Math.PI * 2),
      ],
      spine: (u) => [-0.12 * charge(u * 6), 0, 0],
      chest: (u) => [-0.08 * ease((u * 6 - 3.85) / 0.5), 0, 0],
      head: (u) => [0.22 * charge(u * 6) - 0.3 * launch(u * 6), 0, 0],
      armR: (u) => [
        -0.8 * pulse(u * 6, 0.72, 0.35) -
          0.55 * charge(u * 6) +
          0.65 * launch(u * 6),
        0,
        1.15 - 0.6 * charge(u * 6),
      ],
      armL: (u) => [
        -0.55 * charge(u * 6) + 0.65 * launch(u * 6),
        0,
        -1.15 + 0.6 * charge(u * 6),
      ],
      elbowR: (u) => [-0.35 - 0.75 * charge(u * 6), 0, 0],
      elbowL: (u) => [-0.35 - 0.75 * charge(u * 6), 0, 0],
      legL: (u) => [-0.3 * charge(u * 6) + 0.1 * launch(u * 6), 0, 0.1],
      legR: (u) => [0.2 * charge(u * 6) + 0.1 * launch(u * 6), 0, -0.1],
      kneeL: (u) => [0.18 + 0.6 * charge(u * 6) - 0.1 * launch(u * 6), 0, 0],
      kneeR: (u) => [0.28 + 0.55 * charge(u * 6) - 0.15 * launch(u * 6), 0, 0],
    });
    for (const kind of ["beam", "grab"]) {
      const hit = (u) => pulse(u, 0.85 / 1.65, 0.085),
        coil = (u) => pulse(u, 0.28, 0.18),
        unwind = (u) => ease((u - 0.56) / 0.44),
        sign = kind === "grab" ? -1 : 1;
      make(kind === "beam" ? "counter_break" : "counter_grab", 1.65, {
        hip: (u) => [
          0.12 + 0.24 * hit(u),
          sign * (-0.3 * coil(u) + 0.65 * hit(u)) * (1 - unwind(u) * 0.7),
          sign * 0.1 * hit(u),
        ],
        chest: (u) => [-0.1, -sign * 0.23 * hit(u), 0],
        head: (u) => [-0.08, sign * 0.1 * coil(u), 0],
        armL: (u) => [-0.5 * coil(u) + 0.35 * hit(u), 0, -1.1 + 0.25 * coil(u)],
        armR: (u) => [-0.5 * coil(u) + 0.35 * hit(u), 0, 1.1 - 0.25 * coil(u)],
        elbowL: (u) => [-0.55 - 0.4 * coil(u), 0, 0],
        elbowR: (u) => [-0.55 - 0.4 * coil(u), 0, 0],
        legL: (u) => [-1.65 * hit(u) + 0.2 * unwind(u), 0, -0.08],
        legR: (u) => [0.25 + 0.2 * coil(u), 0, 0.1],
        kneeL: (u) => [0.8 * (1 - hit(u)) - 0.2 * unwind(u), 0, 0],
        kneeR: (u) => [0.7 - 0.25 * unwind(u), 0, 0],
      });
    }
  } else {
    const wake = (u) => ease(u / 0.45),
      settle = (u) => ease((u - 0.65) / 0.35);
    make("awakening", 4, {
      hip: (u) => [0.02, 0, 0],
      chest: (u) => [
        -0.1 * wake(u) + 0.06 * settle(u),
        0,
        0.015 * Math.sin(u * Math.PI * 2),
      ],
      head: (u) => [-0.18 * wake(u) + 0.1 * settle(u), 0, 0],
      jaw: (u) => [0.32 * wake(u) * (1 - settle(u)), 0, 0],
      armL: (u) => [-0.16 * wake(u), 0, 0.32 * wake(u) - 0.16 * settle(u)],
      armR: (u) => [-0.16 * wake(u), 0, -0.32 * wake(u) + 0.16 * settle(u)],
      elbowL: (u) => [0.14 * wake(u), 0, 0.08 * wake(u)],
      elbowR: (u) => [0.14 * wake(u), 0, -0.08 * wake(u)],
      legL: () => [0, 0, 0],
      legR: () => [0, 0, 0],
      kneeL: () => [0, 0, 0],
      kneeR: () => [0, 0, 0],
    });
  }
}
