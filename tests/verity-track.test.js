import test from "node:test";
import assert from "node:assert/strict";
import { VerityTrack } from "../src/verity-track.js";
function setup() {
  const starts = [],
    nodes = [];
  const context = {
    state: "running",
    currentTime: 10,
    createGain() {
      return {
        gain: { value: 1 },
        connect() {},
        disconnect() {
          this.closed = true;
        },
      };
    },
    createBufferSource() {
      const n = {
        connect() {},
        disconnect() {},
        start(when, offset) {
          starts.push({ when, offset });
        },
        stop() {
          this.stopped = true;
          this.onended?.();
        },
      };
      nodes.push(n);
      return n;
    },
    async resume() {
      this.state = "running";
    },
  };
  return {
    context,
    starts,
    nodes,
    media: new VerityTrack(context, {}, { duration: 140.852245 }),
  };
}
test("gesture-unlocked Web Audio plays the real track from zero, resumes its playhead and cleans up sources", async () => {
  const { context, starts, nodes, media } = setup();
  await media.play();
  assert.deepEqual(starts, [{ when: 0, offset: 0 }]);
  context.currentTime = 14;
  assert.equal(media.currentTime, 4);
  media.pause();
  assert.ok(nodes[0].stopped);
  context.currentTime = 30;
  await media.play();
  assert.equal(starts[1].offset, 4);
  context.currentTime = 32;
  assert.equal(media.currentTime, 6);
  media.removeAttribute();
  assert.ok(media.gain.closed);
  assert.ok(media.paused);
  await media.play();
  assert.equal(starts.length, 2);
});
test("suspended-context resume does not duplicate a voice or start after disposal", async () => {
  const { context, starts, media } = setup();
  context.state = "suspended";
  let resume;
  context.resume = () =>
    new Promise((r) => {
      resume = () => {
        context.state = "running";
        r();
      };
    });
  const pending = media.play();
  media.removeAttribute();
  resume();
  await pending;
  assert.equal(starts.length, 0);
});
