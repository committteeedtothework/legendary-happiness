import { createRelay } from "./relay.mjs";
import { SocialHub } from "./social-hub.mjs";
import { readFileSync } from "node:fs";
process.umask(0o077);
const social = new SocialHub({
  audience: process.env.PUBLIC_URL || "",
  database: process.env.SOCIAL_DB || "data/friends.sqlite",
  allowedOrigins: (process.env.SOCIAL_ALLOWED_ORIGINS || "")
    .split(",")
    .filter(Boolean),
});
if (!!process.env.TLS_CERT_FILE !== !!process.env.TLS_KEY_FILE)
  throw Error("Set both TLS certificate and key files.");
const tls = process.env.TLS_CERT_FILE
  ? {
      cert: readFileSync(process.env.TLS_CERT_FILE),
      key: readFileSync(process.env.TLS_KEY_FILE),
    }
  : undefined;
const server = createRelay({
  tls,
  social,
  publicURL: process.env.PUBLIC_URL || "",
});
const { port } = await server.listen(
  Number(process.env.PORT) || 8787,
  process.env.HOST || "0.0.0.0",
);
console.log(`DCSMCRAFT friends service listening on ${port}`);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await server.close();
}
process.on("SIGTERM", () => close().then(() => process.exit(0)));
process.on("SIGINT", () => close().then(() => process.exit(0)));
