# DCSMCRAFT Mobile · 2.11.2

The mobile edition runs the existing game with touch input, a smaller initial download, and an installable web app. World rules, arena balance and save format are unchanged. Desktop HTML and Windows builds remain available.

## iPhone and iPad

Open the hosted mobile edition in Safari. Tap **Share → Add to Home Screen → Add**, then open DCSMCRAFT from its icon. Use **Mobile & Offline → Download for offline play** and keep the app open until **Offline ready** appears. The complete download is about 102 MB; installation initially caches only the roughly 4 MB game core. The two character models and audio load separately when needed.

Home Screen installation requires an HTTPS website; opening the mobile ZIP or an HTML attachment in Files does not install the app. Safari 16.4 or later with WebGL 2 is the target. Landscape is recommended, with portrait menus also supported. Android Chrome can use its Install app action.

iOS can remove website storage under storage pressure. Export world backups from the Worlds menu. A desktop file, the hosted mobile site, Safari and an installed Home Screen app may use separate storage: export/import worlds when changing location, browser or device. Existing desktop worlds are not uploaded automatically. Imported local MP3 discs still use the existing local file picker.

## Touch controls

- Left stick: move. Drag the open view: look. Independent fingers allow moving, looking and holding another action together.
- Mine: hold to mine/attack. Use: place/interact/eat. Jump, Crouch and Sprint use their named buttons. Tap any hotbar slot to select it.
- Inventory: tap slots to move stacks. Select Split to place/take individual portions; Quick move transfers between available sections. Done closes the inventory. Crafting and recipe buttons work by tapping.
- Actions: weapon ability, item drops, view, coordinates, journal, chat, flight in Creative, and configured Stand actions. These invoke the same game actions as keyboard/controller input.
- Arena: Attack, Parry, Rise, Down, Dodge and Boost. Actions opens the move tray, including targeting, climbing, all current specials and held Draw loop. The Inventory button opens arena controls. Touching the screen restores touch control after controller use.
- Pause: normal world or isolated arena settings. App switching, cancelled touches and pause release held input. Changing touch sensitivity and opacity is under Touch Controls.

Mobile defaults use near terrain, reduced particles, 30 FPS and disabled distant terrain/shadows/AO on first run. Existing preferences are preserved. Arena Auto quality follows the selected world graphics tier. Increase quality only if the device can sustain it; the imported Titan encounter remains demanding on phones.

## Controller prompts

Visible controls, move HUDs, tooltips, inventory help, guides and QTE prompts follow the active device. Xbox, PlayStation and Switch use their corresponding button names. Custom bindings show the physical button when recognized, or Button N for unknown controllers. Explicit raw trigger-axis mappings also show Axis N; unbound actions say Unbound. Controller binding fields remain in the main/Overworld settings. Native keyboard entry and user-authored messages are not rewritten. Keyboard/mouse activity restores keyboard prompts; touching restores touch controls.

## Hosting and building

Use the pinned Node/npm versions in BUILDING.md, then:

```
npm ci
npm run build:mobile
```

Host the **contents** of `dist/mobile` on an HTTPS static server, including `sw.js`, `offline-manifest.json`, `.nojekyll`, icons and `assets`. Relative paths support a subdirectory. Do not redirect asset URLs to login pages. Local testing can use `python3 -m http.server 8080 --directory dist/mobile` on localhost; a phone connecting to an ordinary LAN HTTP address cannot install the offline service worker. Public multiplayer still needs the existing public secure relay and does not work offline.

Offline downloads verify byte length and SHA-256, reject interrupted/corrupt responses and resume by retaining verified files. Cached audio supports byte-range requests. New builds wait for **Update & restart**, which saves the active world before switching workers. Caches contain app files only, not world databases; cache migration never deletes world storage.

## Limits

This is a web app, not an App Store IPA. Browser/iOS permissions and memory limits apply. Hardware iOS/Safari, physical controllers and native Windows launch require device testing; Chromium touch emulation cannot establish compatibility or frame rate on every phone. Multiplayer guests use the existing digital movement stream, whereas local/host movement is analog. Imported browser files can require selecting them again after changing browser/origin. Keep world backups.

## Published files and website activation

The HTTPS play site is https://committteeedtothework.github.io/legendary-happiness/ . On iOS, open it in Safari and use Share → Add to Home Screen. Update the cached offline content to receive new builds. The existing deployment branch is mobile-v2.11.0; its name is retained to preserve the installed site URL.

The 2.11.1 mobile package includes Wyvern, its rig and textures as a hashed offline asset. Download the complete offline content before disconnecting; Titan models are loaded when entering their arenas.
