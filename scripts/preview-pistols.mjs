import { createPistolBank } from "../src/pistol-audio.js";
import { writeFileSync } from "node:fs";
const rate = 48000,
  context = {
    sampleRate: rate,
    createBuffer(channels, n) {
      const data = new Float32Array(n);
      return {
        duration: n / rate,
        length: n,
        numberOfChannels: channels,
        sampleRate: rate,
        getChannelData() {
          return data;
        },
      };
    },
  };
const start = performance.now(),
  bank = createPistolBank(context),
  generationMs = performance.now() - start;
const output = new Float32Array(rate * 5);
const shots = [
  ["black", 0.2],
  ["silver", 1],
  ...Array.from({ length: 10 }, (_, i) => [
    i % 2 ? "black" : "silver",
    1.8 + i * 0.2,
  ]),
];
for (const [finish, t] of shots) {
  const d = bank[`pistol_${finish}`][Math.floor(t * 5) % 4].getChannelData(0),
    offset = Math.round(t * rate);
  for (let i = 0; i < d.length; i++) output[offset + i] += d[i] * 0.34;
}
function wav(data, file) {
  const b = Buffer.alloc(44 + data.length * 2);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++)
    b.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, data[i])) * 32767),
      44 + i * 2,
    );
  writeFileSync(file, b);
}
wav(output, process.argv[2] || "dist/DCSMCRAFT-Pistol-Audio.wav");
const stats = {
  generationMs,
  monoBuffers: 8,
  durationSeconds: 0.42,
  bytes: 8 * bank.pistol_black[0].length * 4,
  previewPeak: output.reduce((a, b) => Math.max(a, b), 0),
  previewMin: output.reduce((a, b) => Math.min(a, b), 0),
};
console.log(stats);
