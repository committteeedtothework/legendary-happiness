DCSMCRAFT 2.7.0 — Overworld Foundations I (staged preview)

This is the first playable stage of the request for all remaining non-Nether/non-End features. THE FULL REQUEST IS NOT FINISHED. It introduces no new Nether/End blocks, items, species, structures or progression; existing custom/Cinderworld content is retained. OVERWORLD.md and reference/overworld-backlog.json record completed behavior, simplified mechanics, remaining stages and explicit scope exclusions. Content reference stays Java Edition 26.3.

Fixes expanded Creative block icons being cropped below their canvas. Adds original species-specific, uniquely marked spawn eggs and clearer compass/clock, material and milk icons. Hotbar/catalog/flat-item art shares its source; existing supplied item PNGs still take priority when available.

Existing cows, pigs/Grazers, sheep/Woollings, chickens and rabbits gain food following, feeding, safe same-species breeding, saved cooldowns, love hearts, half-sized babies, parent following and loaded-time growth. Adult chickens lay eggs, sheep graze to regain fleece, and cow milk clears status effects while conserving buckets. Babies cannot be milked/sheared or farmed for meat/XP. Pasture, AI, milk timing, growth and loot remain simplified; eggs are ingredients, not thrown hatchers.

Eleven additional enchantments now affect gameplay: Silk Touch, Fortune, Looting, Smite, Bane of Arthropods, Fire Aspect, Fire Protection, Blast Protection, Projectile Protection, Respiration and Aqua Affinity. The table has 24 functional custom upgrades; conflicts are rejected before charging and disabled in its menu. General Java loot tables, books/anvils/random offers, remaining enchantments and exact combat behavior are not complete.

Fixes the multiplayer connection probe's obsolete protocol-2 check. The browser handshake, probe and relay now share protocol 4 and reject older clients. Use matching 2.7.0 host, guests and relay.

Existing worlds need no regeneration. All 2,625 existing block states, 1,292 recipes, 1,124 old item definitions/Creative indices, 39 species definitions and 200 public asset files are retained; 24 sampled chunk arrays across older/current generators and both existing realms match 2.6.1. One new inventory item is appended: Milk Bucket. Original supplied audio/textures remain unchanged.

Extract the Browser ZIP and open DCSMCRAFT.html in Chrome/Edge on Windows 10/11. Singleplayer is self-contained and offline. The Windows ZIP provides an x64 launcher embedding the same HTML and needs installed Edge/Chrome. Native Windows execution is unverified on this Linux host. Complete source/assets/dependency locks, validation, scoped backlog and matching optional relay are included.

Verification: 496 core tests and 25 unique selected browser scenarios passed. Final exact-standalone checks verify all 4,500 item/texture-pack pairs, imported face/item pixels, real farm mouse interactions, save/reload, enchanting and harvesting. Retained tests cover early Survival progression/death/recovery, shared-container duplication races, HTTPS/WSS co-op and tornado budgets. Tests are scoped evidence, not a zero-bug or full-parity guarantee.

Downloads:

- [Browser HTML ZIP (extract and open DCSMCRAFT.html)](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/refs/heads/downloads-v2.7.0/downloads/DCSMCRAFT-Browser-2.7.0.zip)
- [Windows 10/11 x64 ZIP](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/refs/heads/downloads-v2.7.0/downloads/DCSMCRAFT-Windows-2.7.0.zip)
- [Completed features, limitations and remaining stages](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/refs/heads/downloads-v2.7.0/downloads/OVERWORLD.md)
- [Named scoped backlog](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/refs/heads/downloads-v2.7.0/downloads/overworld-backlog.json)
- [Playtest/validation evidence](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/refs/heads/downloads-v2.7.0/downloads/VALIDATION.md)
- [Complete source](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/refs/heads/downloads-v2.7.0/downloads/dcsmcraft-source-v2.7.0.zip)
- [Matching protocol-4 relay](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/refs/heads/downloads-v2.7.0/downloads/DCSMCRAFT-Multiplayer-Server-2.7.0.zip)
- [Standalone HTML](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/refs/heads/downloads-v2.7.0/downloads/DCSMCRAFT-Standalone-v2.7.0.html)
- [Creative menu preview](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/refs/heads/downloads-v2.7.0/downloads/overworld-foundations-preview.png)