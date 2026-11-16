import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import { SocialHub, challengeMessage } from "../server/social-hub.mjs";
import { SocialStore } from "../server/social-store.mjs";
import { createRelay } from "../server/relay.mjs";
import { PROTOCOL } from "../server/protocol.mjs";
const keypair = () => {
  const p = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return {
    privateKey: p.privateKey,
    publicKey: p.publicKey.export({ format: "jwk" }),
  };
};
function client(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url),
      queue = [],
      wait = [];
    ws.on("message", (b) => {
      const m = JSON.parse(b),
        i = wait.findIndex(
          (w) =>
            w.type === m.type &&
            (w.request === undefined || w.request === m.request),
        );
      if (i < 0) queue.push(m);
      else {
        const w = wait.splice(i, 1)[0];
        clearTimeout(w.timer);
        w.resolve(m);
      }
    });
    ws.once("error", reject);
    ws.once("open", () =>
      resolve({
        ws,
        send: (m) => ws.send(JSON.stringify(m)),
        next: (type, request) =>
          new Promise((resolve, reject) => {
            const i = queue.findIndex(
              (m) =>
                m.type === type &&
                (request === undefined || m.request === request),
            );
            if (i >= 0) return resolve(queue.splice(i, 1)[0]);
            const timer = setTimeout(
              () => reject(Error("Missing " + type)),
              4000,
            );
            wait.push({ type, request, resolve, timer });
          }),
      }),
    );
  });
}
async function setup(t) {
  const social = new SocialHub(),
    relay = createRelay({ social }),
    { port } = await relay.listen(0, "127.0.0.1");
  t.after(() => relay.close());
  return {
    social,
    relay,
    base: `ws://127.0.0.1:${port}`,
    audience: `http://127.0.0.1:${port}`,
  };
}
async function account(
  base,
  audience,
  username,
  pair = keypair(),
  action = "register",
) {
  const c = await client(base + "/social"),
    challenge = await c.next("challenge");
  assert.equal(challenge.audience, audience);
  const signature = sign(
    "sha256",
    Buffer.from(
      challengeMessage(challenge.nonce, username, pair.publicKey, audience),
    ),
    { key: pair.privateKey, dsaEncoding: "ieee-p1363" },
  ).toString("base64url");
  c.send({
    request: 1,
    action,
    username,
    publicKey: pair.publicKey,
    signature,
  });
  const r = await c.next("response", 1);
  assert.equal(r.ok, true, r.message);
  let seq = 1;
  return {
    ...c,
    ...r.result,
    pair,
    call: async (action, data = {}) => {
      const request = ++seq;
      c.send({ request, action, ...data });
      return c.next("response", request);
    },
  };
}
test("usernames and key identities are unique, normalized and persisted across database restarts", () => {
  const dir = mkdtempSync(join(tmpdir(), "dcsmcraft-friends-")),
    file = join(dir, "accounts.sqlite");
  try {
    let s = new SocialStore(file);
    const key = keypair().publicKey,
      a = s.register("Alice_123", key);
    assert.equal(a.username, "alice_123");
    assert.throws(() => s.register("ALICE_123", keypair().publicKey), /taken/);
    assert.throws(() => s.register("another", key), /already/);
    assert.throws(() => s.register("<script>", keypair().publicKey), /letters/);
    const b = s.register("bob_player", keypair().publicKey);
    s.request(a.id, b.username);
    assert.throws(() => s.accept(a.id, b.id), /unavailable/);
    s.accept(b.id, a.id);
    s.close();
    s = new SocialStore(file);
    assert.equal(s.byId(a.id).username, "alice_123");
    assert.equal(s.areFriends(a.id, b.id), true);
    s.block(a.id, b.id);
    assert.equal(s.areFriends(a.id, b.id), false);
    assert.throws(() => s.request(b.id, a.username), /unavailable/);
    s.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("real signed sign-in, mutual requests, recipient-only invitation, one-use admission and canonical usernames work without a tunnel", async (t) => {
  const { social, base, audience } = await setup(t),
    a = await account(base, audience, "alice_player"),
    b = await account(base, audience, "bob_player"),
    stranger = await account(base, audience, "mallory_player");
  let r = await a.call("request", { username: "bob_player" });
  assert.equal(r.ok, true);
  r = await b.call("sync");
  assert.equal(r.result.requests[0].incoming, true);
  r = await b.call("accept", { id: a.profile.id });
  assert.equal(r.ok, true);
  const host = await client(base + "/relay");
  host.send({
    type: "create",
    protocol: PROTOCOL,
    name: "Forged",
    hubToken: a.token,
    friendsOnly: true,
  });
  const room = await host.next("created");
  assert.equal(room.players[0].name, "alice_player");
  r = await stranger.call("invite", { id: b.profile.id, room: room.room });
  assert.equal(r.ok, false);
  r = await a.call("invite", { id: b.profile.id, room: room.room });
  assert.equal(r.ok, true);
  const invites = (await b.call("sync")).result.invitations;
  assert.equal(invites.length, 1);
  assert.equal((await stranger.call("sync")).result.invitations.length, 0);
  assert.equal((await stranger.call("join", { id: invites[0].id })).ok, false);
  const ticket = (await b.call("join", { id: invites[0].id })).result;
  const guest = await client(base + "/relay");
  guest.send({
    type: "join",
    protocol: PROTOCOL,
    name: "Spoofed",
    hubToken: b.token,
    room: ticket.room,
    key: ticket.ticket,
  });
  const joined = await guest.next("joined");
  assert.equal(
    joined.players.find((p) => p.id === joined.id).name,
    "bob_player",
  );
  assert.equal((await host.next("peer-join")).accountId, b.profile.id);
  guest.send({ type: "pose", realmEpoch: 7, pose: { x: 1, y: 70, z: 1 } });
  assert.equal((await host.next("pose")).realmEpoch, 7);
  guest.send({
    type: "command",
    realmEpoch: 7,
    seq: 1,
    kind: "attack",
    selected: 0,
    payload: {},
  });
  assert.equal((await host.next("command")).realmEpoch, 7);
  const repeat = await client(base + "/relay");
  repeat.send({
    type: "join",
    protocol: PROTOCOL,
    hubToken: b.token,
    room: ticket.room,
    key: ticket.ticket,
  });
  assert.equal((await repeat.next("error")).message.includes("invalid"), true);
  assert.equal((await a.call("block", { id: b.profile.id })).ok, true);
  assert.equal(
    (await a.call("invite", { id: b.profile.id, room: room.room })).ok,
    false,
  );
  assert.equal(social.identity("not-a-token"), null);
});
test("wrong keys and replayed or cross-service account proofs never authenticate", async (t) => {
  const { base, audience } = await setup(t),
    pair = keypair(),
    a = await account(base, audience, "alice_proof", pair);
  const wrong = await client(base + "/social"),
    c = await wrong.next("challenge"),
    bad = keypair();
  wrong.send({
    request: 1,
    action: "login",
    username: "alice_proof",
    signature: sign(
      "sha256",
      Buffer.from(
        challengeMessage(c.nonce, "alice_proof", pair.publicKey, audience),
      ),
      { key: bad.privateKey, dsaEncoding: "ieee-p1363" },
    ).toString("base64url"),
  });
  assert.equal((await wrong.next("response", 1)).ok, false);
  const good = await account(base, audience, "alice_proof", pair, "login");
  assert.equal(good.profile.id, a.profile.id);
  const cross = await client(base + "/social"),
    cc = await cross.next("challenge");
  cross.send({
    request: 1,
    action: "login",
    username: "alice_proof",
    signature: sign(
      "sha256",
      Buffer.from(
        challengeMessage(
          cc.nonce,
          "alice_proof",
          pair.publicKey,
          "https://another.example",
        ),
      ),
      { key: pair.privateKey, dsaEncoding: "ieee-p1363" },
    ).toString("base64url"),
  });
  assert.equal((await cross.next("response", 1)).ok, false);
});
