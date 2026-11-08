# DCSMCRAFT Mobile · 2.14.0

The mobile edition runs the existing game with touch input, a smaller initial download, and an installable web app. World rules, arena balance and save format are unchanged. Desktop HTML and Windows builds remain available.

## iPhone and iPad

Open the hosted mobile edition in Safari. Tap **Share → Add to Home Screen → Add**, then open DCSMCRAFT from its icon. Use **Mobile & Offline → Download for offline play** and keep the app open until **Offline ready** appears. The complete download is about 112 MB; installation initially caches only the roughly 4 MB game core. The two character models and audio load separately when needed.

Home Screen installation requires an HTTPS website; opening the mobile ZIP or an HTML attachment in Files does not install the app. Safari 16.4 or later with WebGL 2 is the target. Landscape is recommended, with portrait menus also supported. Android Chrome can use its Install app action.

iOS can remove website storage under storage pressure. Export world backups from the Worlds menu. A desktop file, the hosted mobile site, Safari and an installed Home Screen app may use separate storage: export/import worlds when changing location, browser or device. Existing desktop worlds are not uploaded automatically. Imported local MP3 discs still use the existing local file picker.

## Touch controls

- Choose **Joystick & crosshair** or **D-pad & crosshair** in **Options → Touch Controls**. Move on the left and drag the view to look. Independent fingers can move, aim and hold another action together.
- Push the joystick past its upper edge to sprint; moving it back stops automatic sprint. The Sprint button toggles manual sprint. Double-tap forward on the D-pad to sprint while holding it.
- Hold Mine to mine/attack. Use places/interacts/eats. Drag either held button to adjust aim. Jump also swims/rises; double-tap Jump for Creative flight. Sneak toggles by default and can be changed to hold. Down and Dismount appear when relevant.
- Tap a hotbar slot to select it; **⋯** beside the hotbar opens Inventory. Tap slots to move stacks, use Split for individual portions or Quick move for transfers. Done closes the inventory. Crafting and recipes work by tapping.
- **Moves** opens custom controls without pausing. Matthew's Air Trick and the Devin Sword's Seeker also get a quick button when equipped. Weapon use/dash/pulse remains on Use; configured Stand abilities are in Moves. **More…** retains drops, view, coordinates, journal, Creative flight and the original action menu.
- In the arena: Attack, Parry, Rise, Down, Dodge and Boost. Moves includes the existing Sonic specials, targeting, climbing and held Draw loop. **?** opens the arena controls guide. The top Chat and Pause buttons keep those actions directly accessible.
- Touch Controls also offers button size, opacity, look sensitivity, toggle sneak, joystick sprint, floating joystick and a left-handed layout. Mobile layout preferences are stored separately from desktop settings. Rotation, app switching, cancelled touches and pause release held input.

See [MOBILE-CONTROLS.md](MOBILE-CONTROLS.md) for references, tests and differences from Bedrock.

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
