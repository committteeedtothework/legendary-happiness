DCSMCRAFT 2.2.3 — Skin & Grip Repair

Fixes the floating held-block regression from 2.2.2. Blocks now fit around the actual hand contact point through placement, mining and other actions, with no separate finger geometry. Modeled tools/pistols use the same socket and ordinary sprites remain flat. Smooth action curves are retained.

First-person arms share the selected F5 skin's sleeve, skin and glove palette. Fixed hand proportions and a slightly raised rest pose keep the sleeve visible while idle. Dante, Vergil and Bandit retain the proper partial glove colors. Chest armor covers the shoulder instead of repainting the entire sleeve; invalid non-armor equipment cannot tint it. Hidden left pistols no longer receive offsets for other items or influence the swimming-hand bounds.

399 core tests and seven final offline browser scenarios pass. All 72 solid block items retain physical hand contact through 12,096 unit pose samples; real wardrobe buttons across all 11 skins, visible idle sleeves, 484 rendered block-contact poses, armor guards, persisted reloads, actual melee hits, F5, independent pistol recoil, flat drops and actual water swimming are tested. Screenshots were inspected. 110 F5 geometry/material configurations match 2.2.2 exactly. World generation, gameplay definitions, simulation, controls, combat timing, saves, audio, weather, Stands, discs and multiplayer remain unchanged. Existing worlds need no regeneration.

Windows, HTML, source/assets/dependencies and matching relay packages are included. All 416 packaged inputs, ZIP CRCs, 189 supplied PNGs and executable embedded HTML are verified. Native Windows execution remains unverified on this Linux build host; installed Edge or Chrome is required. Testing does not establish a zero-bug guarantee. Mechanics reference remains Java 1.20.4 with partial baseline parity.

Downloads:

- [Windows 10/11 x64 ZIP](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/refs/heads/downloads-v2.2.3/downloads/DCSMCRAFT-Windows-2.2.3.zip)
- [Standalone HTML](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/refs/heads/downloads-v2.2.3/downloads/DCSMCRAFT-Standalone-v2.2.3.html)
- [Complete source](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/refs/heads/downloads-v2.2.3/downloads/dcsmcraft-source-v2.2.3.zip)