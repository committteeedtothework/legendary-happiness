import { DatabaseSync } from "node:sqlite";
import { randomUUID, createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export { usernameOf, publicKeyOf } from "./social-protocol.mjs";
import { usernameOf, publicKeyOf } from "./social-protocol.mjs";
const pair = (a, b) => (a < b ? [a, b] : [b, a]);
export class SocialStore {
  constructor(path = ":memory:") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA foreign_keys=ON;PRAGMA journal_mode=WAL;PRAGMA busy_timeout=5000;",
    );
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,key_hash TEXT NOT NULL UNIQUE,public_key TEXT NOT NULL,created INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS contacts(a TEXT NOT NULL REFERENCES accounts(id),b TEXT NOT NULL REFERENCES accounts(id),requester TEXT NOT NULL REFERENCES accounts(id),accepted INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(a,b),CHECK(a<>b));
   CREATE TABLE IF NOT EXISTS blocks(owner TEXT NOT NULL REFERENCES accounts(id),target TEXT NOT NULL REFERENCES accounts(id),PRIMARY KEY(owner,target),CHECK(owner<>target));
   CREATE TABLE IF NOT EXISTS invitations(id TEXT PRIMARY KEY,sender TEXT NOT NULL REFERENCES accounts(id),recipient TEXT NOT NULL REFERENCES accounts(id),room TEXT NOT NULL,expires INTEGER NOT NULL);`);
  }
  account(username) {
    return this.db
      .prepare("SELECT * FROM accounts WHERE username=?")
      .get(usernameOf(username));
  }
  byId(id) {
    return this.db.prepare("SELECT * FROM accounts WHERE id=?").get(id);
  }
  register(username, raw) {
    const name = usernameOf(username),
      key = publicKeyOf(raw),
      encoded = JSON.stringify(key),
      hash = createHash("sha256").update(encoded).digest("hex");
    if (this.account(name)) throw Error("That username is taken.");
    if (this.db.prepare("SELECT id FROM accounts WHERE key_hash=?").get(hash))
      throw Error("This account key already has a username.");
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO accounts VALUES(?,?,?,?,?)")
      .run(id, name, hash, encoded, Date.now());
    return this.byId(id);
  }
  blocked(a, b) {
    return !!this.db
      .prepare(
        "SELECT 1 FROM blocks WHERE (owner=? AND target=?) OR (owner=? AND target=?)",
      )
      .get(a, b, b, a);
  }
  areFriends(a, b) {
    const [x, y] = pair(a, b);
    return (
      !this.blocked(a, b) &&
      !!this.db
        .prepare("SELECT 1 FROM contacts WHERE a=? AND b=? AND accepted=1")
        .get(x, y)
    );
  }
  target(owner, name) {
    const p = this.account(name);
    if (!p || this.blocked(owner, p.id)) throw Error("Player unavailable.");
    if (p.id === owner) throw Error("Choose another player.");
    return p;
  }
  request(owner, name) {
    const p = this.target(owner, name),
      [a, b] = pair(owner, p.id);
    if (
      this.db
        .prepare("SELECT COUNT(*) AS n FROM contacts WHERE a=? OR b=?")
        .get(owner, owner).n >= 200
    )
      throw Error("Friend limit reached.");
    const old = this.db
      .prepare("SELECT * FROM contacts WHERE a=? AND b=?")
      .get(a, b);
    if (old) {
      if (old.accepted) throw Error("Already friends.");
      throw Error(
        old.requester === owner
          ? "Request already sent."
          : "Accept their pending request.",
      );
    }
    this.db
      .prepare("INSERT INTO contacts(a,b,requester) VALUES(?,?,?)")
      .run(a, b, owner);
    return p.id;
  }
  accept(owner, id) {
    const [a, b] = pair(owner, id);
    if (this.blocked(owner, id)) throw Error("Player unavailable.");
    const r = this.db
      .prepare("SELECT * FROM contacts WHERE a=? AND b=?")
      .get(a, b);
    if (!r || r.accepted || r.requester === owner)
      throw Error("Friend request unavailable.");
    this.db
      .prepare("UPDATE contacts SET accepted=1 WHERE a=? AND b=?")
      .run(a, b);
  }
  remove(owner, id) {
    const [a, b] = pair(owner, id);
    this.db.prepare("DELETE FROM contacts WHERE a=? AND b=?").run(a, b);
    this.db
      .prepare(
        "DELETE FROM invitations WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)",
      )
      .run(owner, id, id, owner);
  }
  block(owner, id) {
    if (!this.byId(id) || owner === id) throw Error("Player unavailable.");
    this.remove(owner, id);
    this.db.prepare("INSERT OR IGNORE INTO blocks VALUES(?,?)").run(owner, id);
  }
  unblock(owner, id) {
    this.db
      .prepare("DELETE FROM blocks WHERE owner=? AND target=?")
      .run(owner, id);
  }
  invite(owner, target, room) {
    if (!this.areFriends(owner, target))
      throw Error("Accept the friend request first.");
    this.db
      .prepare("DELETE FROM invitations WHERE sender=? AND recipient=?")
      .run(owner, target);
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO invitations VALUES(?,?,?,?,?)")
      .run(id, owner, target, room, Date.now() + 120000);
    return id;
  }
  takeInvite(owner, id) {
    const r = this.db
      .prepare(
        "SELECT * FROM invitations WHERE id=? AND recipient=? AND expires>?",
      )
      .get(id, owner, Date.now());
    if (!r || !this.areFriends(owner, r.sender))
      throw Error("Invitation expired.");
    this.db.prepare("DELETE FROM invitations WHERE id=?").run(id);
    return r;
  }
  dismiss(owner, id) {
    this.db
      .prepare("DELETE FROM invitations WHERE id=? AND recipient=?")
      .run(id, owner);
  }
  snapshot(owner) {
    this.db.prepare("DELETE FROM invitations WHERE expires<?").run(Date.now());
    const list = this.db
      .prepare(
        "SELECT c.*,p.id,p.username FROM contacts c JOIN accounts p ON p.id=CASE WHEN c.a=? THEN c.b ELSE c.a END WHERE c.a=? OR c.b=?",
      )
      .all(owner, owner, owner);
    return {
      profile: { id: owner, username: this.byId(owner).username },
      friends: list
        .filter((r) => r.accepted)
        .map((r) => ({ id: r.id, username: r.username })),
      requests: list
        .filter((r) => !r.accepted)
        .map((r) => ({
          id: r.id,
          username: r.username,
          incoming: r.requester !== owner,
        })),
      blocked: this.db
        .prepare(
          "SELECT p.id,p.username FROM blocks b JOIN accounts p ON p.id=b.target WHERE b.owner=?",
        )
        .all(owner),
      invitations: this.db
        .prepare(
          "SELECT i.id,i.sender,p.username,i.expires FROM invitations i JOIN accounts p ON p.id=i.sender WHERE i.recipient=? AND i.expires>?",
        )
        .all(owner, Date.now()),
    };
  }
  close() {
    this.db.close();
  }
}
