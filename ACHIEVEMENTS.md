# Achievements — 2.18.0

Open **Pause → Achievements** in a world or Titan arena. The screen has six categories, search, locked/unlocked filters, progress counters and earned states. Keyboard, mouse, touch and the existing controller menu navigation work; the right stick scrolls the cards. Unlock toasts use existing item icons and the menu sound bus. They queue while paused and during Titan cinematics instead of obscuring prompts.

There are **64 goals**: 16 Survival, 9 Equipment, 6 Adventure, 8 Ocean, 13 DCSMCRAFT and 12 Titans. Completing a goal never changes item stats, boss balance, resources or rewards. Survival/equipment/ocean goals require Survival. Exploration, explicit custom discoveries and Titan goals also work in Creative; merely selecting custom gear from the Creative catalog does not grant a relic claim. Each card states its actual requirement.

Progress is local to each player in each world, stored in `player.achievements` inside the existing atomic save and backup envelope. It survives dimension travel, death/respawn, arena entry/reload/return, world backup export/import and host-saved co-op resume. The host records co-op actions for the acting peer and sends that peer's progress through private state; guests cannot submit unlocks. Opening an older save starts a bounded ledger and recognizes safely verifiable carried equipment, existing Stands and saved Titan victory ledgers. Historical crafts, furnace outputs, kills and visits cannot be reconstructed and are earned when performed again. No Microsoft/Xbox/Steam account or achievement service is used.

Craft awards happen after successful output commits, including rollback of failed craft-all. Furnace goals require taking an actual output, not just carrying an ingot. Combat goals use successful damage/death or encounter events rather than input presses. Duplicate Titan presentation events do not add rings or rewards twice. Background inventory observation runs at most twice a second; menu cards rebuild on interaction, not every frame.

## References

Minecraft has different Bedrock Achievements and Java Advancements. Names such as Taking Inventory, Getting Wood, Benchmaking, Time to Mine!, Acquire Hardware, DIAMONDS!, Suit Up, A Seedy Place, What a Deal!, and Cover Me in Debris come from these references. Descriptions are written for the actual supported mechanics here; thresholds and some conditions are adapted. Unsupported Minecraft objectives are not listed as working achievements.

- https://minecraft.wiki/w/Achievement
- https://minecraft.wiki/w/Advancement
- https://raw.githubusercontent.com/misode/mcmeta/assets/assets/minecraft/lang/en_us.json

The source record in `reference/achievements-2.18.0.json` includes fetched-page hashes and names cross-checked. An attempted Minecraft.net article URL returned 404, so it is not cited as verified reference material. No external graphics, recordings, models or paid services were added.

## Goals

### Survival

| Goal | Requirement |
| --- | --- |
| Taking Inventory | Open your inventory in Survival. |
| Getting Wood | Collect a log. |
| Benchmaking | Craft a crafting table. |
| Time to Mine! | Craft a wooden pickaxe. |
| Getting an Upgrade | Craft a stone pickaxe. |
| Hot Topic | Craft a furnace. |
| Acquire Hardware | Take an iron ingot from a furnace. |
| Time to Strike! | Craft a wooden sword. |
| Time to Farm! | Craft a wooden hoe. |
| Bake Bread | Craft bread from wheat. |
| Cow Tipper | Collect leather. |
| DIAMONDS! | Collect a diamond. |
| Ice Bucket Challenge | Collect obsidian. |
| MOAR Tools | Craft a wooden pickaxe, axe, shovel, hoe, and sword. |
| A Seedy Place | Plant wheat seeds on farmland. |
| Block by Block | Place 128 blocks. |

### Equipment

| Goal | Requirement |
| --- | --- |
| Isn't It Iron Pick | Obtain an iron pickaxe. |
| Suit Up | Obtain a piece of iron armor. |
| Ironclad | Carry or wear a complete iron armor set. |
| Diamond Tipped | Obtain a diamond pickaxe. |
| Cover Me with Diamonds | Carry or wear a complete diamond armor set. |
| Enchanter | Enchant an item at an enchanting table. |
| Lode to Riches | Obtain a netherite ingot. |
| Cover Me in Debris | Carry or wear a complete netherite armor set. |
| Serious Dedication | Obtain a netherite hoe. |

### Adventure

| Goal | Requirement |
| --- | --- |
| Monster Hunter | Defeat a hostile creature. |
| Night Watch | Defeat 50 hostile creatures. |
| Sweet Dreams | Sleep through the night in a bed. |
| What a Deal! | Complete a villager trade. |
| Trailblazer | Visit five different Overworld biomes. |
| Into the Cinderworld | Travel through a portal to Cinderworld. |

### Ocean

| Goal | Requirement |
| --- | --- |
| Fishy Business | Reel in a successful fishing catch. |
| Tactical Fishing | Catch a fish in a water bucket. |
| Moskstraumen | Receive Conduit Power from an active conduit. |
| Turtle Master | Drink a Turtle Master potion. |
| Do a Barrel Roll! | Launch yourself with Riptide. |
| A Throw to Remember | Hit a creature with a thrown trident. |
| Heart of the Deep | Collect a Heart of the Sea. |
| Shell Keeper | Obtain a turtle shell helmet. |

### DCSMCRAFT

| Goal | Requirement |
| --- | --- |
| Fire in the Forge | Take a Hellfire ingot from a furnace. |
| Forged in Cinder | Obtain Hellfire alloy in Survival. |
| Beyond Diamond | Obtain a Hellfire pickaxe in Survival. |
| Fireproof Fashion | Carry or wear a full Hellfire armor set in Survival. |
| Sword in the Stone | Claim the Devin Sword from its relic, or possess it in Survival. |
| Gunslinger | Claim Matthew's pistols from the altar, or possess them in Survival. |
| Temple Breaker | Defeat a Devin Guardian. |
| Riftbreaker | Defeat the Mad Titan. |
| Devin's Reach | Strike three hostiles with a single Devin's Pulse. |
| A Fighting Spirit | Obtain a Stand. |
| Stand Master | Reach Stand level 5. |
| Sacred Remains | Collect a Saint's Corpse Part in Survival. |
| Legendary Arsenal | Carry the Devin Sword and Matthew's pistols together in Survival. |

### Titans

| Goal | Requirement |
| --- | --- |
| Titan Signals | Enter a Titan arena. |
| The Final Emerald | Reach and collect the final Chaos Emerald. |
| Super Sonic | Complete the Super Sonic transformation. |
| Right Back at You | Successfully parry a Titan attack or missile. |
| Perfect Timing | Land a perfect Titan parry. |
| Straight to the Point | Connect a Homing Attack with a Titan. |
| Full Circle | Damage a Titan with a completed Cyloop. |
| Sonic Boom | Land a Sonic Boom wave on a Titan. |
| Ring Runner | Collect 200 rings in Titan arenas. |
| Undefeatable | Defeat Giganto and complete the finishing sequence. |
| Break Through It All | Defeat Wyvern and complete the finishing sequence. |
| Titan Slayer | Defeat both Giganto and Wyvern. |


## Implementation and validation

`src/achievement-data.js` defines the 64 stable goals; `src/achievements.js` owns normalization, event matching, polling and Titan adaptation; `src/achievement-ui.js` and `src/achievements.css` render the screen and queued notifications. Existing actions call the tracker only after successful commits. Arena restoration and respawn preserve the current ledger, while co-op uses each authoritative peer's player data. `tests/achievements.test.js`, `tests/browser/achievements.spec.js` and the packaged desktop test exercise these paths. See VALIDATION.md and the verification archive for results and platform limits.
