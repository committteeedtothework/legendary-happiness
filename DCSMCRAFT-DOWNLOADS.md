DCSMCRAFT 2.6.1 — Creative Menu

Creative inventory now follows a classic pixel-panel layout: icon tabs above/below, a nine-column/five-row scrolling catalog, a visible draggable scrollbar and the player hotbar underneath. Ten item varieties separate building blocks, colors, natural materials, functional blocks, redstone, tools/travel, combat/armor, food/drinks, ingredients and spawn eggs. Search Items covers the entire catalog. Stands and Player Inventory & Crafting remain available, including armor and the recipe book.

Items are grouped by material/type with multiword search inside categories. Left/right/shift-click retain original stack behavior. Arrow keys navigate tabs. A bounded row window avoids constructing the entire 1,124-icon catalog at once while keeping every item reachable. Sorting preserves authoritative inventory indices and works with existing Creative co-op. Narrow layouts and the player-crafting tab are fitted to keep their controls accessible.

485 core tests and eight unique selected browser scenarios pass; the three new offline cases were repeated after final layout refinement. Exact-standalone tests block outside requests and verify tabs, sorting/filtering, quantities, scrolling through the last item, empty results, keyboard focus, narrow layouts, crafting/armor/Stands, native close and Survival separation. Retained checks cover previous content, equipment, saves, Creative movement/building and host-authoritative multiplayer Stands. Native Windows execution and direct file:// navigation remain unverified on Linux; the exact HTML is tested over local HTTP with external requests blocked.

This is a menu-only update. Every existing block/item/recipe/stat/default-setting registry and Creative inventory index matches 2.6.0; 90 chunk arrays across generators 2–16 and both dimensions match, and all 200 public assets are unchanged. Existing worlds work without regeneration. No content, generation or protocol change; 2.6.0 content limitations remain documented in CONTENT.md.

Download/save the new standalone HTML and open it in Chrome/Edge, or extract the Windows ZIP and run DCSMCRAFT.exe with Edge/Chrome installed. Singleplayer requires no ChatGPT, local server or internet. The launcher embeds the same tested HTML. Source/assets/dependency locks, checklist and validation evidence are included in the source ZIP. Older downloaded copies do not update themselves.

Downloads:

- [Creative menu preview](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/refs/heads/downloads-v2.6.1/downloads/creative-menu-preview.png)
- [Current feature checklist and known limitations](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/refs/heads/downloads-v2.6.1/downloads/CONTENT.md)
- [Testing and compatibility notes](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/refs/heads/downloads-v2.6.1/downloads/VALIDATION.md)
- [Complete reference content audit (CSV)](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/refs/heads/downloads-v2.6.1/downloads/content-audit-26.3.csv)
- [Windows 10/11 x64 ZIP](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/refs/heads/downloads-v2.6.1/downloads/DCSMCRAFT-Windows-2.6.1.zip)
- [Standalone HTML](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/refs/heads/downloads-v2.6.1/downloads/DCSMCRAFT-Standalone-v2.6.1.html)
- [Complete source](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/refs/heads/downloads-v2.6.1/downloads/dcsmcraft-source-v2.6.1.zip)
- [Matching multiplayer relay](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/refs/heads/downloads-v2.6.1/downloads/DCSMCRAFT-Multiplayer-Server-2.6.1.zip)