// Original full-body rotations for the supplied skeleton. Every ability retains
// its simulation duration/contact clock; no scale keys or extra body meshes.
export function addSonicFlightCombat(make) {
  const tau = Math.PI * 2;
  const smooth = (x) => {
    x = Math.max(0, Math.min(1, x));
    return x * x * x * (x * (x * 6 - 15) + 10);
  };
  const pulse = (u, at, width = 0.16) => Math.exp(-(((u - at) / width) ** 2));
  const flight = (tilt, roll = 0, rise = 0) => ({
    hip: (u) => [tilt + Math.sin(u * tau) * 0.018, 0, roll],
    spine: (u) => [-tilt * 0.18, 0, -roll * 0.25],
    chest: () => [0, 0, 0],
    head: () => [-tilt * 0.42, 0, -roll * 0.15],
    armL: () => [0.25 + tilt * 0.55, 0, -1.18],
    armR: () => [0.25 + tilt * 0.55, 0, 1.18],
    elbowL: () => [-0.35 - rise * 0.15, 0, 0],
    elbowR: () => [-0.35 - rise * 0.15, 0, 0],
    legL: (u) => [0.08 + rise * 0.24 + Math.sin(u * tau) * 0.045, 0, 0.08],
    legR: (u) => [0.2 - rise * 0.16 - Math.sin(u * tau) * 0.045, 0, -0.08],
    kneeL: (u) => [0.25 + Math.sin(u * tau) * 0.04, 0, 0],
    kneeR: (u) => [0.42 - Math.sin(u * tau) * 0.04, 0, 0],
  });
  const tuck={
    hip:u=>[0.35,0,0],spine:()=>[0.45,0,0],head:()=>[0.18,0,0],
    armL:()=>[-0.65,0,-0.8],armR:()=>[-0.65,0,0.8],
    elbowL:()=>[-1.35,0,0],elbowR:()=>[-1.35,0,0],
    legL:()=>[-1.25,0,0.15],legR:()=>[-1.25,0,-0.15],kneeL:()=>[1.75,0,0],kneeR:()=>[1.75,0,0]};
  make("jump_takeoff",0.18,{...tuck,hip:u=>[-0.22+u*0.57,0,0],legL:u=>[-0.2-u,0,0.1],legR:u=>[-0.2-u,0,-0.1]});
  make("jump_spin",0.55,{...tuck,hip:u=>[0.35+u*tau,0,0]},true);
  make("jump_fall",0.8,{...flight(0.02),armL:()=>[-0.35,0,-0.85],armR:()=>[-0.35,0,0.85],kneeL:()=>[0.8,0,0],kneeR:()=>[0.65,0,0]},true);
  make("land",0.2,{...flight(0),hip:u=>[0.2*(1-smooth(u)),0,0],kneeL:u=>[0.95*(1-smooth(u)),0,0],kneeR:u=>[0.95*(1-smooth(u)),0,0]});
  make('traversal_slide',0.7,{hip:()=>[0.35,0,0],head:()=>[-0.18,0,0],armL:()=>[0.8,0,-0.25],armR:()=>[0.8,0,0.25],legL:()=>[-0.9,0,0],legR:()=>[0.6,0,0],kneeL:()=>[0.15,0,0],kneeR:()=>[1.3,0,0]},true);
  make("fly", 2.4, flight(0.04), true);
  make("flight_forward", 1.8, flight(0.52), true);
  make("flight_rise", 1.8, flight(-0.28, 0, 1), true);
  make("flight_fall", 1.8, flight(0.25, 0, -1), true);
  make("flight_left", 1.8, flight(0.18, 0.25), true);
  make("flight_right", 1.8, flight(0.18, -0.25), true);
  make("boost_flight", 1.5, flight(0.9), true);
  make(
    "cyloop_run",
    0.45,
    {
      ...flight(0.2, 0.12),
      legL: (u) => [Math.sin(u * tau) * 0.85, 0, 0.04],
      legR: (u) => [-Math.sin(u * tau) * 0.85, 0, -0.04],
      kneeL: (u) => [0.2 + Math.max(0, -Math.sin(u * tau)) * 0.95, 0, 0],
      kneeR: (u) => [0.2 + Math.max(0, Math.sin(u * tau)) * 0.95, 0, 0],
    },
    true,
  );
  const strike = (at, side = 1, kick = false) => {
    const hit = (u) => pulse(u, at, 0.13),
      wind = (u) => pulse(u, Math.max(0.08, at - 0.25), 0.18),
      recover = (u) => smooth((u - at) / Math.max(0.01, 1 - at));
    return {
      ...flight(0.12),
      hip: (u) => [
        0.1 + hit(u) * 0.15,
        side * (wind(u) * -0.24 + hit(u) * 0.4) * (1 - recover(u) * 0.7),
        side * hit(u) * 0.03,
      ],
      chest: (u) => [-0.05, side * (wind(u) * -0.12 + hit(u) * 0.23), 0],
      armL: (u) => [
        side < 0 ? -0.2 - 0.5 * hit(u) : 0.3,
        0,
        -1.1 + (side < 0 ? 0.35 * hit(u) : -0.1 * wind(u)),
      ],
      armR: (u) => [
        side > 0 ? -0.2 - 0.5 * hit(u) : 0.3,
        0,
        1.1 - (side > 0 ? 0.35 * hit(u) : -0.1 * wind(u)),
      ],
      elbowL: (u) => [-0.7 + (side < 0 ? 0.55 * hit(u) : 0), 0, 0],
      elbowR: (u) => [-0.7 + (side > 0 ? 0.55 * hit(u) : 0), 0, 0],
      legL: (u) => [kick && side < 0 ? -1.6 * hit(u) : 0.25, 0, 0.08],
      legR: (u) => [kick && side > 0 ? -1.6 * hit(u) : 0.15, 0, -0.08],
      kneeL: (u) => [kick && side < 0 ? 0.65 * (1 - hit(u)) : 0.48, 0, 0],
      kneeR: (u) => [kick && side > 0 ? 0.65 * (1 - hit(u)) : 0.5, 0, 0],
    };
  };
  make("attack_left", 0.32, strike(0.13 / 0.32, -1));
  make("attack_right", 0.32, strike(0.13 / 0.32, 1));
  make("combo_left", 0.35, strike(0.15 / 0.35, -1));
  make("combo_right", 0.35, strike(0.15 / 0.35, 1));
  make("combo_kick", 0.4, strike(0.18 / 0.4, -1, true));
  make("combo_finisher", 0.55, strike(0.25 / 0.55, 1, true));
  make("grand_slam", 1.2, strike(0.48 / 1.2, -1, true));
  make("sonic_boom", 0.65, {
    ...strike(0.3 / 0.65, 1, true),
    hip: (u) => [0.12, Math.sin(Math.PI * u) * 0.7, 0],
    armL: () => [0.25, 0, -1.25],
    armR: () => [0.25, 0, 1.25],
  });
  make("wild_rush", 0.8, {
    ...flight(0.75),
    hip: (u) => [
      0.7,
      Math.sin(u * tau * 1.5) * 0.12,
      Math.sin(u * tau * 1.5) * 0.28,
    ],
    head: (u) => [-0.32, 0, -Math.sin(u * tau * 1.5) * 0.1],
    armL: (u) => [0.35 - 0.5 * (pulse(u, 0.275) + pulse(u, 0.7625)), 0, -1.15],
    armR: (u) => [0.35 - 0.5 * pulse(u, 0.5), 0, 1.15],
  });
  make("quick_cyloop", 3.1, {
    ...flight(0.6, 0.2),
    hip: (u) => [0.55, 0, 0.2 * Math.sin(Math.PI * u)],
    head: (u) => [-0.25, 0.15 * Math.sin(Math.PI * u), 0],
  });
  make("dodge", 0.42, {
    ...flight(0.1),
    hip: (u) => [0.1, 0, Math.sin(u * Math.PI) * 0.48],
    armL: (u) => [0.1, 0, -1.2 - 0.12 * Math.sin(Math.PI * u)],
    armR: (u) => [0.1, 0, 1.2 + 0.12 * Math.sin(Math.PI * u)],
    kneeL: (u) => [0.45 + Math.sin(Math.PI * u) * 0.35, 0, 0],
    kneeR: (u) => [0.4 + Math.sin(Math.PI * u) * 0.35, 0, 0],
  });
  make(
    "parry",
    1.8,
    {
      ...flight(-0.05),
      armL: () => [-0.65, 0, -0.7],
      armR: () => [-0.65, 0, 0.7],
      elbowL: () => [-1.1, 0, 0],
      elbowR: () => [-1.1, 0, 0],
    },
    true,
  );
  make("damage", 0.5, {
    ...flight(-0.1),
    hip: (u) => [
      -0.1 - 0.3 * Math.sin(Math.PI * u),
      0,
      0.08 * Math.sin(Math.PI * u),
    ],
    head: (u) => [0.15 * Math.sin(Math.PI * u), 0, 0],
    armL: (u) => [0.15, 0, -1.25],
    armR: (u) => [0.15, 0, 1.25],
    kneeL: (u) => [0.45 + 0.25 * Math.sin(Math.PI * u), 0, 0],
    kneeR: (u) => [0.6 + 0.2 * Math.sin(Math.PI * u), 0, 0],
  });
  make("homing_attack", 0.72, {
    ...flight(0.45),
    hip: (u) => [
      0.3 + 0.7 * Math.sin(Math.PI * u),
      0,
      0.15 * Math.sin(tau * u),
    ],
    armL: () => [-0.6, 0, -0.9],
    armR: () => [-0.6, 0, 0.9],
    elbowL: () => [-1.15, 0, 0],
    elbowR: () => [-1.15, 0, 0],
    legL: (u) => [-0.8 * Math.sin(Math.PI * u), 0, 0.1],
    legR: (u) => [-0.8 * Math.sin(Math.PI * u), 0, -0.1],
    kneeL: (u) => [0.3 + Math.sin(Math.PI * u), 0, 0],
    kneeR: (u) => [0.3 + Math.sin(Math.PI * u), 0, 0],
  });
  make("cross_slash", 0.8, {
    ...flight(0.12),
    hip: (u) => [0.1, Math.sin(tau * u) * 0.48, 0],
    chest: (u) => [0, -Math.sin(tau * u) * 0.15, 0],
    legL: (u) => [-1.55 * pulse(u, 0.3), 0, -0.65 * pulse(u, 0.3)],
    legR: (u) => [-1.55 * pulse(u, 0.575), 0, 0.65 * pulse(u, 0.575)],
    kneeL: (u) => [0.45 * (1 - pulse(u, 0.3)), 0, 0],
    kneeR: (u) => [0.45 * (1 - pulse(u, 0.575)), 0, 0],
  });
  const volley = (u) =>
    [0.36, 0.44, 0.52, 0.6, 0.68, 0.76].reduce(
      (w, t) => Math.max(w, pulse(u, t / 1.15, 0.045)),
      0,
    );
  const curl = u => pulse(u,0.14,0.13);
  make("homing_shot", 1.15, {
    ...flight(-0.12),
    hip: (u) => [-0.12 - 0.05 * volley(u)+curl(u)*0.75, 0, 0.025 * Math.sin(u * tau * 3)],
    chest: (u) => [-0.13 - 0.06 * volley(u), 0, 0],
    armL: (u) => [-0.6 + 0.08 * volley(u), 0, -0.85],
    armR: (u) => [-0.6 + 0.08 * volley(u), 0, 0.85],
    elbowL: (u) => [-0.85 + 0.12 * volley(u), 0, 0],
    elbowR: (u) => [-0.85 + 0.12 * volley(u), 0, 0],
    legL: (u) => [0.12-curl(u)*1.25, 0, 0.12],
    legR: (u) => [-0.1-curl(u)*1.1, 0, -0.12],
    kneeL: (u) => [0.55+curl(u)*0.9, 0, 0],
    kneeR: (u) => [0.7+curl(u)*0.8, 0, 0],
  });
}
