// Original PCM impact synthesis. The sample bank contains no recordings or game assets.
const families = [
  "wood",
  "stone",
  "grass",
  "sand",
  "glass",
  "cloth",
  "snow",
  "metal",
  "water",
];
export function createFoleyBank(context) {
  const bank = {};
  for (const [familyIndex, family] of families.entries()) {
    bank[family] = Array.from({ length: 4 }, (_, variant) => {
      const duration =
          family === "glass" ? 0.62 : family === "sand" ? 0.34 : 0.29,
        buffer = context.createBuffer(
          1,
          Math.ceil(context.sampleRate * duration),
          context.sampleRate,
        ),
        data = buffer.getChannelData(0);
      let state = (familyIndex + 1) * 41719 + (variant + 1) * 1777,
        low = 0,
        slow = 0,
        last = 0;
      const random = () => {
        state = (Math.imul(state, 1664525) + 1013904223) | 0;
        return ((state >>> 0) / 4294967296) * 2 - 1;
      };
      for (let i = 0; i < data.length; i++) {
        const t = i / context.sampleRate,
          noise = random(),
          attack = Math.min(1, t / 0.0015);
        low += 0.12 * (noise - low);
        slow += 0.025 * (noise - slow);
        let value = 0;
        if (family === "wood")
          value =
            (Math.sin(2 * Math.PI * (150 + variant * 11) * t) * 0.34 +
              Math.sin(2 * Math.PI * (380 + variant * 17) * t) * 0.16) *
              Math.exp(-t * 36) +
            (noise - low) * 0.23 * Math.exp(-t * 55);
        if (family === "stone")
          value =
            (low * 0.55 + noise * 0.12) * Math.exp(-t * 33) +
            Math.sin(2 * Math.PI * (95 + variant * 9) * t) *
              0.24 *
              Math.exp(-t * 48) +
            (noise - last) * 0.16 * Math.exp(-t * 105);
        if (family === "grass")
          value =
            (noise - low) *
              0.3 *
              Math.exp(-t * 22) *
              (0.6 + 0.4 * Math.sin(t * 370)) +
            slow * 0.6 * Math.exp(-t * 32);
        if (family === "sand")
          value =
            (noise * 0.22 + low * 0.24) *
            Math.exp(-t * 16) *
            (Math.sin(t * (250 + variant * 23)) ** 2 * 0.6 + 0.4);
        if (family === "cloth") value = (low * 0.7 + slow) * Math.exp(-t * 24);
        if (family === "glass")
          for (let j = 0; j < 7; j++)
            value +=
              Math.sin(2 * Math.PI * (860 + j * j * 199 + variant * 31) * t) *
              0.105 *
              Math.exp(-t * (12 + j * 3));
        if (family === "snow")
          value =
            (low * 0.4 + (noise - low) * 0.28) *
            (0.25 + 0.75 * Math.sin(t * 190 + Math.sin(t * 41)) ** 8) *
            Math.exp(-t * 12);
        if (family === "metal")
          for (let j = 0; j < 5; j++)
            value +=
              Math.sin(2 * Math.PI * (340 + j * j * 249 + variant * 23) * t) *
              0.15 *
              Math.exp(-t * (15 + j * 5));
        if (family === "water")
          value =
            low * Math.exp(-t * 9) * 0.5 +
            Math.sin(
              (2 * Math.PI * (240 + variant * 21) * Math.log(1 + t * 22)) / 22,
            ) *
              Math.exp(-t * 21) *
              0.2;
        // A second contact, material resonance and friction tail soften the
        // old single impulse and give each original sample a layered body.
        const contact = Math.exp(
            -(((t - (0.026 + variant * 0.004)) / 0.007) ** 2),
          ),
          scrape = Math.max(0, t - 0.02) * Math.exp(-t * 19),
          modal =
            family === "wood"
              ? Math.sin(t * 2 * Math.PI * (317 + variant * 13)) *
                0.1 *
                Math.exp(-t * 24)
              : family === "stone"
                ? Math.sin(t * 2 * Math.PI * (211 + variant * 7)) *
                  0.06 *
                  Math.exp(-t * 31)
                : 0;
        value =
          value * 0.78 +
          contact * low * 0.65 +
          (noise - low) *
            scrape *
            (family === "grass" ? 1.8 : family === "sand" ? 1.2 : 0.3) +
          modal;
        const fade = Math.min(
          1,
          (data.length - i) / Math.max(1, context.sampleRate * 0.015),
        );
        const grain =
          Math.max(0, Math.sin(t * (510 + variant * 37) + noise * 1.5)) ** 8;
        const settle = Math.exp(
          -(((t - 0.065 - variant * 0.003) / 0.025) ** 2),
        );
        const friction =
          (noise - low) *
          settle *
          (family === "grass" ? 0.22 : family === "sand" ? 0.16 : 0.035);
        const resonance =
          Math.sin(
            2 *
              Math.PI *
              (family === "wood"
                ? 237
                : family === "stone"
                  ? 173
                  : family === "glass"
                    ? 2410
                    : 420) *
              t,
          ) *
          Math.exp(-t * 24) *
          0.045;
        value =
          value * 0.88 +
          friction +
          resonance +
          low * grain * Math.exp(-t * 20) * 0.08;
        data[i] = Math.max(-0.92, Math.min(0.92, value * attack * fade));
        last = noise;
      }
      return buffer;
    });
  }
  return bank;
}
export function surfaceFamily(surface = "grass") {
  if (/snow|ice/.test(surface)) return "snow";
  if (/iron|gold|hellfire|anvil|metal/.test(surface) && !/ore/.test(surface))
    return "metal";
  if (/water/.test(surface)) return "water";
  if (/glass/.test(surface)) return "glass";
  if (/log|plank|chest|table|bed|door/.test(surface)) return "wood";
  if (/stone|ore|cobble|obsidian|basalt|furnace|brick|gravel/.test(surface))
    return "stone";
  if (/sand|path|dirt|farmland|terracotta/.test(surface)) return "sand";
  if (/wool/.test(surface)) return "cloth";
  return "grass";
}
