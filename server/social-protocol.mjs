export const usernameOf = (value) => {
  const name = String(value || "")
    .trim()
    .toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,19}$/.test(name))
    throw Error(
      "Use 3–20 letters, numbers or underscores; start with a letter.",
    );
  return name;
};
export const publicKeyOf = (raw) => {
  if (
    raw?.kty !== "EC" ||
    raw.crv !== "P-256" ||
    !["x", "y"].every(
      (k) => typeof raw[k] === "string" && /^[A-Za-z0-9_-]{43}$/.test(raw[k]),
    )
  )
    throw Error("Invalid account key.");
  return { kty: "EC", crv: "P-256", x: raw.x, y: raw.y };
};
export function serviceURL(value) {
  const u = new URL(value);
  if (
    !["https:", "http:", "wss:", "ws:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/"
  )
    throw Error("Enter the friends service address.");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  if (!local && !["https:", "wss:"].includes(u.protocol))
    throw Error("Use HTTPS for online accounts.");
  u.protocol = ["https:", "wss:"].includes(u.protocol) ? "https:" : "http:";
  return u.origin;
}
export const challengeMessage = (nonce, name, key, audience) =>
  `DCSMCRAFT account v1\n${audience}\n${nonce}\n${name}\n${key.x}\n${key.y}`;
