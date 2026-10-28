2.7.10 changes local first-person item positioning/clearance only. Full remote/F5 models, protocol 4 and host authority remain compatible.

2.7.9 hides local first-person arms while holding an object. Remote/F5 player bodies and protocol 4 are unchanged; no relay or gameplay changes.

2.7.8 renders the same eleven existing network skin IDs with new block proportions and original pixel artwork. No new packets or protocol changes; the same models serve local F5, remote players and the local wardrobe preview. Skin selection remains device-local. Protocol 4, host authority and prior co-op limits remain.

2.7.7 uses independent local Overworld playlists: six Creative and 12 Survival tracks. Mode/realm gates prevent mixing; music remains local and outside relay/world-save packets. In the Windows ZIP the hosting CMD scripts use DCSMCRAFT.exe --extract-only when a standalone HTML is absent, then serve its extracted local game HTML. The separate server ZIP still includes HTML directly. Protocol 4 and host-authority rules remain unchanged.

2.7.6 plays the 12 embedded C418 tracks only for Survival Overworld clients. Playback remains local, with no music data in relay/world-save packets. In the Windows ZIP, hosting tools reuse their existing Multiplayer-Server/dist HTML and OPEN-BROWSER.cmd opens the same file. Matching optional relay and deployable web-build ZIPs remain available. Protocol 4 is unchanged.

2.7.5 changes local sky/weather/cloud rendering only. Shared weather/time authority and protocol 4 remain unchanged. Cloud drift and cosmetic fades are local visual clocks; terrain, weather physics and host authority remain.

2.7.4 embeds the same four supplied Overworld tracks in every client. Background music is local to each listener, follows their current realm/menus/volume, and is not synchronized or sent through relay packets. Protocol 4 and existing co-op limits remain.

2.7.3 changes title splash placement/animation only; generation 16 and protocol 4 remain unchanged.

2.7.2 changes title splash text/layout only. Generation 16 and protocol 4 remain unchanged; no new co-op behavior is introduced.

2.7.1 adds rendering/audio preferences only; these are local to each client. Menu drawing may be capped separately while the host continues simulation through menus. Existing co-op restrictions below remain.

Current content build: **2.7.1, relay protocol 4**. Use the matching client and server; older protocols are rejected. The connection probe now shares the protocol constant with the actual browser handshake and relay, fixing its obsolete protocol-2 expectation. New construction, crafting stations and arrow combat use host authority; no arrow PvP or offhand support.


2.7.0 farm feeding/milking, breeding/growth/eggs/fleece and enchanted harvesting/combat remain host-authoritative and saved in the existing world/entity/inventory records. Matching guests use the same milk/loot/air/mining rules; guest enchanting remains owner-only. Existing loaded-host-region, realm, PvP and hosting limits still apply. Older numbered sections are historical.

## 2.5.0 Aquatic Voyages

Use matching 2.5.0 host, client and relay downloads. Survival host authority covers shared aquatic creatures/loot, fishing, fish buckets, brewing slots, conduits/effects and charged trident release/returns. The same durable enchanted trident is returned once; public projectile ownership uses a persisted random player ID, never private reconnect credentials. Creative guest utility restrictions and host-region simulation still apply. Ocean discoveries are world-wide. New terrain/structures require a new world; saved generators 2–14 retain their landscape. See AQUATIC.md for complete partial/missing behavior and launch instructions below.

## 2.4.0 world interaction visuals

Use matching 2.4.0 clients/relay. Chest lids reflect all current host/Survival-guest viewers, remain open until the last viewer closes and stop rendering after block removal. Host and guest menus validate block identity, container identity, roof clearance and reach before slot changes, preventing use of removed/replaced containers. Visual packets include only chest positions and bounded furnace/disc state; inventory contents, local MP3 paths/files and resume secrets are excluded. Actual shared inventory/physics/save rules remain host-authoritative. New species transfer as normal persistent entity records; initial/ongoing wildlife follows the host's vicinity as before. Guest dimension travel and other existing co-op restrictions remain.

## 2.3.1 Connected Worlds

Use matching 2.3.1 clients/relay. New shared worlds transfer generator 14; saved generators 2–13 remain unchanged. Connected terrain/caves require a new world. Existing host-authoritative boat/combat, public ownership IDs and per-player inventory rules remain. Cinderworld natural spawn density is higher and still bounded by difficulty; this does not add guest dimension travel. The existing dimension and shared-weather limitations below remain.

## 2.3.0 boats and return shots

Use matching 2.3.0 clients/relay packages. Survival guests can launch, board, row and dismount single-seat boats through host-checked item use/input. The host owns physics, inventory consumption and saved rider state; clients predict movement locally. Public peer IDs are used in replicated boats and reflected fireballs, never private reconnect tokens. Shift dismount is a discrete host command as well as a held-key action. Creative guests observe host-controlled boats. Existing dimension-travel and PvP limits remain; reflected fireballs target hostile entities only. Terrain generator 13 is transferred with world state; old worlds retain their recorded generator.

# DCSMCRAFT Survival & Creative Co-op Beta — 2.2.1

Up to **8 players including the owner**. A Node.js WebSocket relay serves the single-file game and routes messages; the owner's browser runs the authoritative simulation and saves the world. Both Survival and Creative can be shared. This is a playable beta, with the limits below.

## Devil’s Palm & Stands — 2.2.1

Use the 2.2.1 client **and** updated relay package. The host resolves per-player trials/fate once, saves permanent ownership, validates Stand ability intents/energy/cooldowns, and synchronizes visible spirits, transformations, nails, rope effects, rifts and relocation. H/F/G/V are configurable personal defaults; R retains weapon moves. Death, inventory and respawn use the existing shared-world rules, including the new optional Keep Inventory rule. Guests cannot set probabilities, choose outcomes or supply damage. Duplicate sequences are ignored. Healing may target teammates; PvP remains disabled.

Interrupted guest trials cancel without a roll on disconnect. Committed ownership persists with the saved resume credential and restores on reconnect. Offline-occupied Palm sites remain harmless ruins during relocation. The existing stable-address/browser-origin requirements for resume profiles still apply. This is the original browser-hosted simulation, not a new dedicated server. See STANDS.md for exact abilities, rules, safeguards and limits.

## Windows quick start

1. Extract `DCSMCRAFT-Multiplayer-Server-2.2.1.zip`, or open `Multiplayer-Server` inside the Windows ZIP. Install Node.js 22.12+ or 24 if needed. Run `HOST-SERVER.cmd` (Linux: `sh server/HOST-SERVER.sh`). The packaged relay includes its `ws` dependency and HTML, so no npm install is needed.
2. Open the address printed by the server. Create/load a **Survival Overworld** or Creative world. Escape → **Open Survival / Creative Co-op**, enter your name and relay address, then **Open This World to Friends**.
3. Copy the invitation. Friends open it in their own desktop browsers, enter a name and choose **Join World**, then **Back to Game**. Keep both the relay and owner's game open. The simulation continues through menus and the owner's death while sharing.
4. Press **T** for in-game chat, **/** for commands, **Tab** for the session/players menu. Chat also appears briefly above the HUD. Escape closes chat. Arrow Up/Down recalls sent messages/commands. The session menu retains its chat log and host removal controls.
5. Use **Save and Quit to Title** on the host to save everyone and close the session. Reopen that save, host again and share a **new** invitation to resume.

`localhost` works only on that PC. A LAN address works only on the same network. The offline HTML and Windows launcher can connect to a running public relay too; singleplayer stays self-contained and requires no relay.

## Public HTTPS hosting from a Windows PC — new in 1.4.1

1. Extract the server ZIP (or use `Multiplayer-Server` in the Windows ZIP). Install Node.js 22.12+ or 24 and the official **cloudflared** utility once. Windows installation: `winget install --id Cloudflare.cloudflared -e`; reopen the hosting window after installation. The utility is not bundled. Official downloads: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/ . You can also set `CLOUDFLARED_PATH` to its executable path.
2. Double-click **HOST-PUBLIC.cmd**. It starts a relay bound only to localhost, then starts a Cloudflare Quick Tunnel using outbound HTTP/2. No router port forwarding, domain or Cloudflare account is needed for a Quick Tunnel. Internet access to Cloudflare is required.
3. Wait for **PUBLIC HTTPS RELAY READY**. The launcher tests both HTTPS `/health` and encrypted WSS `/relay` before reporting readiness. It prints an `https://…trycloudflare.com` address, writes `PUBLIC-RELAY.txt`, and opens that page. Missing tools, provider failures, cancellation and readiness timeouts stop the relay and explain the problem. Ctrl+C stops the relay/tunnel and closes its rooms.
4. To keep an existing world/save profile, open your existing **DCSMCRAFT.exe or downloaded HTML**, load your world, then Multiplayer → **Public HTTPS** and paste the printed address. Use **Test Relay Connection**, then **Open This World to Friends → Copy Invitation**. Friends open the full invitation on their own networks. Keep the hosting window and owner's game open.
5. Alternatively, create a world at the opened HTTPS page, or import a world backup there. Public HTTPS pages, the local desktop profile and standalone files have different browser save origins. The relay never has its own world disk save.

The Windows release ZIP also has a top-level HOST-PUBLIC.cmd. On Linux/macOS install cloudflared from the official provider, then use `sh server/HOST-PUBLIC.sh` or `npm run multiplayer:public`. `CLOUDFLARED_PATH` selects an installed binary; the script never silently downloads or installs one. Quick Tunnel output is accepted only for its `trycloudflare.com` HTTPS origin. Nothing starts or contacts Cloudflare during normal offline singleplayer.

**Temporary service:** the random public address lasts only while that tunnel runs and changes on restart. Quick Tunnels depend on Cloudflare availability, have provider limits, and are intended for temporary/testing sessions rather than a permanent game service. Existing cloudflared configuration can prevent Quick Tunnel startup; use the provider's setup guidance rather than deleting your configuration. This feature is not a bundled always-on public server.

**Survival guest profiles:** reconnect credentials are scoped to the relay address and browser storage. A new random tunnel address or a different browser origin starts a fresh guest profile. For ongoing worlds with the same guest inventories across hosting sessions, use a stable public HTTPS relay below. The owner's original desktop/file save remains in its existing profile when it connects to a tunnel.

This environment blocks the official Cloudflare/GitHub endpoints with HTTP 403. Live Quick Tunnel creation and play across real separate Wi-Fi networks could not be verified here. Launcher lifecycle/readiness/failure tests use an explicit test-only provider process. Native HTTPS/WSS transport is verified separately with actual encrypted sockets and browser clients. No test tunnel or fake service is shipped as a public endpoint.

## Stable public HTTPS / WSS relay

For a permanent address, run the relay on a publicly reachable machine. The game supports both direct Node TLS and a reverse proxy:

- **Direct TLS:** set `TLS_CERT_FILE` and `TLS_KEY_FILE` to a valid certificate chain and private-key file, `PUBLIC_URL=https://play.example.com`, and `PORT=8787` (or your mapped HTTPS port), then run `node server/relay.mjs`. Both files are required. The certificate must cover the public hostname and be trusted by guests. Node serves both HTTPS and WSS on that same port. Restart the process after certificate renewal; Caddy is an alternative for automatic certificate management. Do not distribute a private key with the game.
- **Cloud HTTPS host:** use the full source ZIP's `server/Dockerfile` on a Docker-capable web host with WebSocket support. `render.yaml` supplies an optional Render Blueprint. Set PUBLIC_URL to the resulting HTTPS origin and retain the provider's PORT. The operator supplies the cloud account/deployment.
- **VPS/domain with automatic TLS:** point DNS to your public machine; from the full source run `DCSMCRAFT_DOMAIN=play.example.com docker compose -f server/compose.yaml up --build -d`. Caddy terminates HTTPS and forwards WSS; ports 80/443 must reach the machine.
- **Home server with a stable address:** deliberately configure your router/reverse proxy to reach the relay and use a trusted HTTPS certificate. CGNAT can prevent inbound forwarding; a tunnel or publicly hosted relay avoids that requirement.

The relay advertises operator-configured PUBLIC_URL in invitations; updating that address also refreshes the owner's invitation UI. PUBLIC_URL must be an HTTP(S) origin without credentials, a path, query or fragment. It is never inferred from untrusted forwarding headers. Setting PUBLIC_URL alone does not obtain a certificate or expose a private computer.

The **Public HTTPS** menu choice requires an encrypted public address and rejects localhost/private-network/insecure addresses; **Local / LAN** remains available. Test Relay Connection checks protocol-2 WSS without joining a room, and successful addresses are remembered on that device. An HTTPS page cannot use insecure WS. A connection test confirms reachability from that client; test the final invitation from a friend's network too.

Reverse proxies must support `/relay` WebSocket upgrades and long-lived connections. Routes are `/` (built game), `/health` (status/protocol) and `/relay` (WebSockets). Check a deployed server with `node server/check-address.mjs https://your-public-address`. The previous release's Docker build hit environment DNS failure; no cloud deployment or public TLS certificate provisioning was performed here. Local native TLS tests use an isolated self-signed test certificate, never a shipping client certificate bypass.

## Owner commands

Only the player hosting their own world can execute slash commands. Guests can chat but cannot invoke commands, promote themselves, grant items, change time/weather or remove players. Commands are parsed locally by the owner; received chat text is never executed. Names with spaces need quotes. `@s` means the owner; `/list` also shows IDs for ambiguous names.

| Command | Behavior |
| --- | --- |
| `/help`, `/list`, `/seed` | Show commands, connected players/IDs, or world seed. |
| `/time set day`, `night`, `noon`, `midnight`, or `0–23999` | Set shared world time. |
| `/weather clear`, `rain`, `thunder`, `hail`, `tornado` | Set weather. Rain falls as snow in cold biomes. |
| `/difficulty peaceful`, `easy`, `normal`, `hard` | Set shared difficulty. |
| `/give "Friend One" iron_pickaxe 1` | Give a known item, 1–64 units, without partial grants if inventory is full. Owner cheats are available in Survival. |
| `/tp "Friend One" 10 80 20` | Teleport a player to clear, bounded XYZ coordinates. |
| `/tp "Friend One" @s` | Teleport to another player's position. No health/XP copy. |
| `/heal [player]`, `/spawn [player]` | Restore a living player's vitals, or return them to their spawn. Default is `@s`. |
| `/kick "Friend One"` | Remove a guest. Does not ban their invitation permanently. |
| `/save` | Save the world and guest profiles on the owner's device. |

These are an implemented subset, without a command block language, permission ranks, console execution, `/gamemode`, `/ban` or arbitrary scripts. Owner commands also work in singleplayer.

## Survival authority and saves

- New guests start with empty inventories, real health/hunger and no flight/catalog. The host simulates their movement, fall damage, oxygen, hunger, regeneration, starvation, fire/lava/cactus/weather damage, progressive mining and item pickup. The client predicts movement; corrections can be visible with latency.
- Guests send bounded input and inventory actions, not trusted inventory exports, positions or damage values. Mining takes real host physics time. Selected tools, durability, stack consumption, recipes, equipment, drops, combat cooldowns and placement are checked against the host's inventory/world. Repeated action IDs are ignored.
- Personal/table crafting and the recipe sidebar work, as do shared chests and furnaces. Transfers use current host slots serially, so two guests cannot both take the same stack. Workstation access requires reach and the same current block/container. Closing crafting returns its contents on the host. Guest Q drops one item; Ctrl+Q drops its held stack.
- Hostiles can target guests; melee, arrows, Guardian attacks and explosions use their authoritative health/armor. No PvP. Death drops inventory/cursor/crafting/armor once and respawn starts empty. Guest beds set personal spawn; the owner controls skipping the night. Guest trading/enchanting, unique planted-sword extraction and style movement remain owner-only in Survival. Ordinary owned pistol shots and melee weapons work.
- Guest player/inventory/equipment/crafting/cursor/spawn/health records persist in the owner's normal checksummed world save. A private random reconnect token identifies the same guest on the same relay address/browser profile, even with a changed name or new invitation. Tokens are sent only to their recipient and stored in that guest's browser; guest snapshots exclude other profiles. Simultaneous token reuse is rejected. At most 64 saved guest profiles are retained per world; the room still allows at most eight online players. Clearing guest browser storage or moving to a different relay address creates a new profile; there is no account/profile recovery UI. World backups contain these private profile records and should be kept private.

Autosave remains every 30 active simulation seconds; use `/save` or Save and Quit before closing. Reconnect can restore only the last committed host save after a crash. The relay itself stores no worlds or credentials on disk.

## Remaining limits

Survival sharing currently starts in the **Overworld**. Close co-op to travel dimensions; no simultaneous independent realms. Creative retains its previous active-realm sharing behavior and unlimited inventories. Host spawning, structures, fluids and AI activity still concentrate around the owner's vicinity; nearby existing mobs can attack remote players, but distant exploration does not create a full independent simulation region. No host migration, dedicated simulation, distributed chunk streaming, offline ticking, background-tab performance guarantee, accounts, permanent bans or competitive anti-cheat guarantee. Closing the owner closes the room. Remote visual effects and positional sound remain approximate; jukebox playback is personal and external-service dependent.

The relay enforces protocol 2, membership, private routing, message/packet/queue limits, a chat interval, and host-only state/announcements. It rejects forged guest snapshots. These are practical co-op controls, not a public-server security audit. Share invitations with people you trust; there is no automatic public discovery. All players need the new build; older protocol-1 clients cannot join.

## Run from source

```sh
npm ci
npm run build:standalone
npm run multiplayer
```

Environment: `PORT=8787`, `HOST=0.0.0.0`, optional `PUBLIC_URL=https://play.example.com` and `DCSMCRAFT_HTML=/path/to/game.html`. On PowerShell: `$env:PUBLIC_URL="https://play.example.com"; npm run multiplayer`. Deployment configuration uses the full source; packaged relay users can run Node directly. Run `npm test` and the real-client `tests/browser/survival-coop.spec.js` tests after building to validate changes.

Snow accumulation uses the normal authoritative block-edit stream, including thin-layer IDs. Use matching 2.2.1 host/guest clients and relay. Tornado paths are host-simulated and weather state is shared; each Survival guest receives its own exposure damage through existing server simulation.

2.2.1: Creative guests can choose Stands via the authoritative host; Survival grant requests are rejected. Disc insertion/ejection is host-only. Guests may use the same inserted disc ID with a personal local MP3; no audio files or playback positions are uploaded/synchronized.
