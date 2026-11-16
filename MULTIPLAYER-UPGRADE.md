# Multiplayer · 2.23.0

Both Windows editions and the browser edition contain the same multiplayer game.
Singleplayer works offline. Multiplayer needs a running relay and every player
must use this version; protocol 5 replaces protocol 4.

## Play together

Open a world, choose **Multiplayer → Host**, and share the complete invitation
link. Guests join through **Multiplayer → Join**. The owner keeps the world and
guest inventories. Rejoining from the same browser/app profile restores the
guest's saved inventory, achievements, PvP statistics and Titan checkpoints.
Changing profiles requires a world backup for owned worlds; do not delete the
browser/app storage that holds a guest's rejoin identity.

New worlds have PvP enabled. Older worlds keep it disabled until their owner
turns it on in **Pause → World → World Options**. PvP uses server-owned inventory,
movement, damage, armor and shields. Melee, arrows, tridents, pistols, Stand
attacks, Devin's Pulse and Seeker can hit eligible players. Existing PvE damage
and Titan balance are unchanged. PvP damage is 80% of the source hit, capped at
12 before armor, with the existing half-second player hurt protection. There is
no damage to spectators or players inside private encounters. Hits still need
the weapon's actual targeting/collision checks; the extra maximum-distance
check cannot extend weapon reach. Death drops obey Keep Inventory.

Guest inventory operations now include Creative catalog selection, trading,
enchanting, offhand use/swap, cursor dropping and sorting. Custom movement,
equipment, Stand and weapon actions use the host's real inventory and cooldowns.
Remote player swings/recoil are visual only and cannot schedule damage.

## Watch encounters

Choose **Watch** beside another player in the multiplayer roster, or type
`/spectate "Player Name"`. This shows their actual game view, including Titan
encounters, trials and realm expeditions. **Stop Watching** or Escape restores
your own view and prior pause state. Stand safely on the ground and leave PvP
combat for five seconds before watching or entering an arena. The owner can
disable watching in World Options. Watching never forwards controls to the
other player.

Direct WebRTC streams carry game video and game audio; no microphone or desktop
is captured. Direct connections depend on the players' networks and use public
STUN, without a TURN service. If direct video is unavailable, the relay supplies
a bounded 640×360 JPEG view at approximately six frames per second **without
audio**. Spectator overlays reproduce essential health/rings/QTE information;
they are not a pixel copy of every DOM menu. Streaming only runs while watched.

Guests can enter their own Giganto/Wyvern portals. The host replays their fixed
simulation inputs, verifies victory and return-portal crossing, and awards loot
once. Client health, rewards and victory flags are not authoritative. Encounter
input is separate from overworld controls. The shared world continues running
when the owner is in a Titan encounter or a private realm expedition.

Realm expeditions are started by the owner. Guests remain in the shared realm,
can continue playing, and can watch the owner; independent guest travel to a
different dimension is not supported. This is a hosted co-op game, not a
dedicated persistent Minecraft server. A relay does not simulate the world.

## World options and commands

Before creating a world, set **Allow Cheats** and expand **Game Rules**. New
Survival worlds default cheats off; Creative defaults them on. Existing saves
retain their previous command access. Options persist per world: PvP, watching,
Keep Inventory, Fall Damage, Daylight Cycle, Weather Cycle, Natural Regeneration, Mob
Spawning and Death Messages. Mob Spawning controls natural recurring spawns;
structures and scripted encounter enemies retain their existing generation.

Only the owner can use mutation commands, and Allow Cheats must be on:

| Command | Function |
| --- | --- |
| `/give player item [count]` | Give an existing item, including custom items; `@a` gives everyone items atomically |
| `/tp player x y z` / `/tp player player` | Move a player to a clear destination |
| `/time set day` / `/weather clear` | Set time or a supported weather type |
| `/difficulty peaceful` | Set difficulty |
| `/gamerule [rule] [true\|false]` | List, inspect or change a supported rule |
| `/gamemode survival\|creative` | Change the **whole world's** mode outside encounters |
| `/spawnpoint [player] [x y z]` | Set a personal respawn location |
| `/setworldspawn [x y z]` | Set the world/owner spawn location |
| `/setblock x y z block` | Place an existing block ID |
| `/fill x1 y1 z1 x2 y2 z2 block` | Fill up to 4,096 blocks; relative `~` coordinates supported |
| `/summon mob [x y z]` | Summon a supported spawn-egg creature |
| `/clear [player] [item]` | Clear carried/equipped items, including cursor and offhand |
| `/effect give player effect [seconds] [amplifier]` | Apply an implemented effect |
| `/effect clear [player]` | Clear effects |
| `/enchant player enchantment [level]` | Apply a compatible enchantment within its real level limit |
| `/kill [player]` | Defeat a player outside an encounter |
| `/heal [player]` / `/spawn [player]` | Restore vitals or return to spawn |
| `/say message` | Send an owner announcement |

Implemented effects: resistance, night_vision, water_breathing, conduit_power,
dolphins_grace, slowness and levitation. Amplifiers are limited to 0–4 and
durations to 1–3,600 seconds. Existing enchantment compatibility rules apply.
Selectors `@s` and `@a` are supported by the new inventory/effect commands;
individual names/IDs work throughout. Quote names containing spaces.

`/help`, `/list`, `/seed`, `/save` and owner `/kick` do not require cheats.
Guests can use `/list`, `/msg player message` (`/tell`, `/w`), `/me message` and
`/spectate player|stop`. Private messages are routed only to sender and recipient.
These commands intentionally cover implemented game systems, not every vanilla
Minecraft command, selector or per-player game mode.

## Run the relay

With Node 24.22.1 and project dependencies installed:

```sh
npm ci
npm run multiplayer
```

The default relay listens on port 8787. Remote players need a reachable relay
address (HTTPS/WSS for an HTTPS browser game). `npm run multiplayer:public`
retains the existing temporary tunnel helper. Network/server hosting is not
included in the portable executable. Updating an old relay requires the new
`server/watch.mjs`, `server/arena.mjs`, `server/protocol.mjs` and `server/relay.mjs`.

## References

Minecraft behavior was researched using the Minecraft Wiki pages for
[Multiplayer](https://minecraft.wiki/w/Multiplayer),
[Create New World](https://minecraft.wiki/w/Create_New_World),
[Game rules](https://minecraft.wiki/w/Game_rule),
[server.properties](https://minecraft.wiki/w/Server.properties),
[Spectator](https://minecraft.wiki/w/Spectator),
[Commands](https://minecraft.wiki/w/Commands),
[/give](https://minecraft.wiki/w/Commands/give),
[/gamemode](https://minecraft.wiki/w/Commands/gamemode) and
[/effect](https://minecraft.wiki/w/Commands/effect).
This game's PvP tuning, custom items and live encounter viewer are adaptations.

## Validation

The release verification ZIP contains test logs, real two-browser relay tests,
watch screenshots and payload/checksum reports. Native Windows execution cannot
be tested on the Linux build host; the Windows runtime payload is inspected and
its matching game payload is launched in Linux Electron. Direct media track negotiation and the relay fallback are tested. Cloud Chromium
produced no ICE candidates even in a separate loopback probe, so actual direct
video/audio playback and Internet NAT traversal remain unverified.
