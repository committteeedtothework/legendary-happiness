# Friends and independent dimensions — 2.24.0

Open **Friends** from the title or pause menu. Create a username, add another player by exact username, and accept their request. In a loaded world, choose **Invite**. The recipient chooses **Join**, or **Save & Join** if they already have a world open. The owner stays online and keeps the authoritative save. Up to eight players share a room.

Usernames are case-insensitive, 3–20 characters, start with a letter and contain letters, numbers or underscores. Sign-in uses a device-held P-256 key, not an unverified display name. **Back Up Account** exports the key for **Restore Account** on another device. Keep that file private: it grants access to the account. There is no email/password recovery. Account keys are stored separately from world saves in IndexedDB; the server stores public keys and the friend graph. Existing local worlds and guest inventories are retained. A signed-in returning guest resumes their saved player by account ID, including their dimension, even from a restored account on another device.

Requests persist while friends are offline. Presence shows online/in-world status to accepted friends. Invitations expire after two minutes and issue a recipient-bound, single-use admission ticket. Removing or blocking a friend revokes outstanding invitations. Blocking prevents new requests/invitations; it does not retroactively eject a player already admitted to a world. Classic invitation-link multiplayer remains available separately.

Guests use real portals to enter Cinderwild or The End without moving the owner or anyone else. Players in the same dimension share blocks, mobs and drops. Other dimensions receive separate simulation and network state. Inventory, achievements, personal spawns and reconnect positions remain per player. Portal transitions acknowledge a new realm epoch before controls resume, so stale movement/state cannot apply to the next dimension. End exits, gateways, death/respawn and owner commands use the relevant player's dimension. DRAGOON’s fixed victory XP is split among living players present in The End; players elsewhere receive no remote rewards. Cross-dimension PvP is rejected; private Titan encounters retain their existing spectator flow.

## Public service

**No Internet service is deployed or public URL bundled by this change.** This release includes the working service and deployment configuration. An operator must deploy it once; individual players do not run Cloudflare, start servers or forward ports after their clients are configured. A GitHub static downloads branch cannot run persistent WebSockets/SQLite.

The existing WebSocket relay carries game traffic as well as account invitations. This avoids introducing WebRTC signaling and a separate TURN service: WebRTC still requires signaling and often TURN behind restrictive NATs. It does mean relay bandwidth, persistence, uptime and hosting are the operator's responsibility. The owner browser still runs the world; there is no dedicated always-running world or offline host migration.

Local test/service:

```sh
npm ci
npm run build:standalone
npm run friends
# Open http://localhost:8787; Friends discovers the service automatically.
```

Use HTTPS/WSS for Internet clients. Plain HTTP is accepted only on loopback by the Friends client. For production set `PUBLIC_URL=https://friends.example.com`, `SOCIAL_DB=/data/friends.sqlite`, and `PORT` as required. Keep `PUBLIC_URL` equal to the origin used by clients; signatures bind to that origin. `SOCIAL_ALLOWED_ORIGINS` optionally restricts browser origins (comma separated). The game at the service origin, configured browser origins, file apps and the bundled `dcsmcraft://game` desktop origin are supported. Direct TLS uses `TLS_CERT_FILE` and `TLS_KEY_FILE`; otherwise terminate TLS at a trusted proxy. `/health` is the deployment health check.

`server/compose.yaml` runs the service behind Caddy with persistent SQLite and certificate volumes. Set `DCSMCRAFT_DOMAIN` to a DNS name pointing at the server, then run `docker compose -f server/compose.yaml up -d --build`. `render.yaml` provides a Docker web service with a persistent disk; the selected Starter plan is paid and has **not** been provisioned here. Configure PUBLIC_URL after choosing the host. Preserve the SQLite database and WAL together with a consistent SQLite backup when moving services; usernames/friends belong to that service. Losing the database loses those accounts.

For downloaded clients, configure **Friends → Connection Settings** once, or set `DCSMCRAFT_SOCIAL_URL` during the standalone/desktop build. A deployment serves the browser game and discovers itself, with no player configuration. Game packets and identity admission are versioned separately from local saves; use matching 2.24.0/protocol 6 clients and service.

The backend validates signed challenges, message sizes/rates, room ownership, friend acceptance and ticket recipient/expiry/reuse. It stores keys as public data, hashes session tokens in memory and uses parameterized SQLite statements. A production operator still needs monitoring, database backups and capacity testing; large-scale Internet load, native Windows networking and mobile background lifecycle are not established by local tests.

## References consulted

- [Minecraft Wiki multiplayer](https://minecraft.wiki/w/Multiplayer): joining shared worlds and friend invitations; these are DCSMCRAFT accounts, not Microsoft/Xbox accounts.
- [MDN WebRTC protocols](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Protocols) and [WebRTC TURN](https://webrtc.org/getting-started/turn-server): signaling/NAT relay requirements behind the architecture choice.
- [Render WebSockets](https://render.com/docs/websocket) and [persistent disks](https://render.com/docs/disks): long-lived connections and persistent identity storage.
- [Node SQLite](https://nodejs.org/api/sqlite.html): built-in database, prepared statements and WAL.
- [Web Crypto sign](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign) and [verify](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/verify): P-256 challenge proof and backup validation.
- [ws](https://github.com/websockets/ws/blob/master/README.md) and [OWASP WebSocket security](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html): upgrade routing, limits, heartbeat and authentication.

Research downloads and actual test results accompany the verification artifact. No paid generation or hosting was used.
