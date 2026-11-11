// Original PCM synthesis, informed by the uploaded reference's short broadband
// attacks, strong ~100 Hz body and mechanical decay. No reference samples are
// copied. Generate once per AudioContext; firing reuses these non-looping buffers.
export function createPistolBank(context) {
  const bank = {},
    rate = context.sampleRate;
  for (const finish of ["black", "silver"]) {
    const dark = finish === "black";
    bank[`pistol_${finish}`] = Array.from({ length: 4 }, (_, variant) => {
      const length = Math.ceil(rate * 0.42);
      const buffer = context.createBuffer(1, length, rate);
      const data = buffer.getChannelData(0),
        dry = new Float32Array(length);
      let state = (dark ? 0x6a09e667 : 0x3c6ef372) ^ ((variant + 1) * 7919);
      let low = 0,
        mid = 0,
        warm = 0,
        air = 0;
      const coefficient = (hz) => 1 - Math.exp((-2 * Math.PI * hz) / rate);
      const warmAlpha = coefficient(600),
        lowAlpha = coefficient(260),
        midAlpha = coefficient(dark ? 1650 : 2200),
        airAlpha = coefficient(6500);
      const detune = 1 + (variant - 1.5) * 0.009;
      const clackAt = (dark ? 0.047 : 0.035) + variant * 0.0015;
      for (let i = 0; i < length; i++) {
        const t = i / rate;
        state = (Math.imul(state, 1664525) + 1013904223) | 0;
        const noise = (state >>> 0) / 2147483648 - 1;
        low += lowAlpha * (noise - low);
        mid += midAlpha * (noise - mid);
        warm += warmAlpha * (noise - warm);
        air += airAlpha * (noise - air);
        const attack = 1 - Math.exp(-t / 0.0007);
        const base = dark ? 96 : 119,
          fall = dark ? 55 : 65;
        const phase =
          2 *
          Math.PI *
          detune *
          (base * t + fall * 0.012 * (1 - Math.exp(-t / 0.012)));
        const body =
          Math.sin(phase) * 0.72 * Math.exp(-t / (dark ? 0.049 : 0.039));
        const chest =
          Math.sin(2 * Math.PI * (dark ? 57 : 67) * detune * t) *
          0.14 *
          Math.exp(-t / 0.065);
        const crack = (air - mid) * (dark ? 1.8 : 2.3) * Math.exp(-t / 0.014);
        const chamber =
          ((mid - warm) * 0.5 + (warm - low) * 3.8 + low * 0.8) *
          Math.exp(-t / 0.042);
        const tail =
          (mid - low) *
          0.18 *
          (1 - Math.exp(-t / 0.012)) *
          Math.exp(-t / 0.085);
        const ct = t - clackAt;
        const clack =
          ct > 0
            ? (Math.sin(2 * Math.PI * (dark ? 2700 : 3400) * ct) * 0.095 +
                Math.sin(2 * Math.PI * 5700 * ct) * 0.035 +
                noise * 0.14) *
              (1 - Math.exp(-ct / 0.0005)) *
              Math.exp(-ct / 0.008)
            : 0;
        dry[i] = attack * (body + chest + crack + chamber + tail) + clack;
      }
      // Quiet early reflections add air without turning sustained fire into a
      // long reverb loop. No oscillators, filters or convolvers run per shot.
      let previous = 0,
        filtered = 0,
        peak = 0;
      const dc = Math.exp((-2 * Math.PI * 28) / rate);
      const taps = [
        [0.026, 0.14],
        [0.059, 0.075],
        [0.103, 0.035],
      ].map(([s, g]) => [Math.round(s * rate), g]);
      for (let i = 0; i < length; i++) {
        let value = dry[i];
        for (const [offset, gain] of taps)
          if (i >= offset) value += dry[i - offset] * gain;
        const saturated = Math.tanh(value * 1.25);
        filtered = saturated - previous + dc * filtered;
        previous = saturated;
        const fade = Math.min(1, (length - 1 - i) / (rate * 0.015));
        data[i] = filtered * fade;
        peak = Math.max(peak, Math.abs(data[i]));
      }
      const gain = 0.82 / Math.max(peak, 0.001);
      for (let i = 0; i < length; i++) data[i] *= gain;
      return buffer;
    });
  }
  return bank;
}
