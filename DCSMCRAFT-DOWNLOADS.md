# DCSMCRAFT 1.8.1 — Supplied Assets

Download the Windows ZIP, extract it and run DCSMCRAFT.exe using installed Edge or Chrome. The standalone HTML remains self-contained for offline browser play. **Existing worlds work; no new world is needed.**

Enable the pack under **Options → Video Settings → World detail → Texture Pack → Supplied Assets — Minecraft textures**. Renewed stays the default. Renewed, Soft and Classic remain selectable.

- Imports **183 supplied PNG images**, covering **109 block states** and **87 item icons**: terrain, ores, doors, fluids, foliage, workstations, common items, standard tool/armor icons and available vanilla creature eggs.
- Crisp native 16-pixel artwork, transparent cutouts, explicit grass/foliage/water base tints and saved pack preference. All runtime pixels are embedded; no CDN or first-use asset download.
- Custom blocks/items retain Renewed artwork. The Devin Sword, Matthew’s pistols, creature/weapon models, worn armor, menus, sounds, gameplay, progression and generator 12 are retained. Standard weapon/armor inventory icons change with the pack, while modeled weapons and worn armor keep their existing materials.
- Animated strips use frame zero with existing fluid shimmer; full metadata animations, resource-pack models and creature textures are not implemented. No block/item JSON, shaders, text, sounds or gameplay data from the archive are imported.

The optional pack contains user-supplied **Minecraft artwork owned by Mojang/Microsoft**. It is not original DCSMCRAFT artwork or covered by the project MIT license; respective owners retain their rights. Attribution, selected original PNGs and a hash/coverage manifest are included in the complete source. DCSMCRAFT is independent and unaffiliated. The mechanics reference remains **Minecraft Java Edition 1.20.4, partial parity**.

- [Windows 10/11 game ZIP](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/downloads-v1.8.1/downloads/DCSMCRAFT-Windows-1.8.1.zip)
- [Standalone offline HTML](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/downloads-v1.8.1/downloads/DCSMCRAFT-Standalone-v1.8.1.html)
- [Browser build ZIP](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/downloads-v1.8.1/downloads/dcsmcraft-build-v1.8.1.zip)
- [Multiplayer relay ZIP](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/downloads-v1.8.1/downloads/DCSMCRAFT-Multiplayer-Server-1.8.1.zip)
- [Complete source ZIP](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/downloads-v1.8.1/downloads/dcsmcraft-source-v1.8.1.zip)
- [Checksums](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/downloads-v1.8.1/downloads/DCSMCRAFT-v1.8.1-checksums.json)
- [Validation report](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/downloads-v1.8.1/downloads/DCSMCRAFT-v1.8.1-validation.json)
- [Terrain compatibility report](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/downloads-v1.8.1/downloads/DCSMCRAFT-v1.8.1-compatibility.json)

Validation: **363 core tests** and **three browser scenarios** pass. Browser checks compare every imported block face and all 87 item icons, verify transparent held/dropped flint and steel, reversible switching among all four packs, saved choice/world reloads and normal movement. The exact standalone is tested over HTTP with outside requests blocked. All 66 sampled chunks and 22 accumulated container snapshots match v1.8.0 across generators 2–12; all gameplay/model source files and gameplay definitions remain unchanged. Source/build inputs are frozen and verified again before packaging.

Web, standalone and Windows x64 builds succeed; the executable payload is verified byte-for-byte against the standalone. Native Windows launch and direct file:// storage remain unverified on this Linux test host. This is a focused texture update; the entire historical Survival playthrough and multiplayer suite were not repeated. Existing documented foundation limitations remain. See the included README.md, FEATURES.md, THIRD_PARTY.md and VALIDATION.md for coverage and limits.
