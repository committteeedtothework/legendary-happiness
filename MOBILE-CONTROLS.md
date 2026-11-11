# Mobile controls · 2.11.3

The mobile asset build now uses PocketTouchInput. Desktop TouchInput, mouse/keyboard and controller behavior are unchanged. Game mechanics, world generation, arena combat tuning, saves and supplied audio are preserved.

## Reference

- Minecraft Wiki, [Controls → Touch](https://minecraft.wiki/w/Controls#Touch): joystick/crosshair and D-pad/split-control layouts, top menu controls, hotbar inventory, Creative double-jump flight, configurable opacity/size and contextual swimming/flying buttons.
- Mojang, [Minecraft Preview 1.19.50.21](https://www.minecraft.net/en-us/article/minecraft-preview-1-19-50-21): immediate Attack/Interact action, joystick auto-sprint above its background and disengaging on return.

These pages were read directly on 7 November 2026. Their observations guided original CSS/vector button art, without extracting Minecraft assets. The optional wiki control diagram image returned HTTP 403 and was not fetched or copied. Upcoming controls described on the wiki were not treated as current requirements.

## Included

Joystick & crosshair (default), D-pad & crosshair, beyond-edge joystick sprint, D-pad forward double-tap sprint, toggle/hold sneak, independent movement/look/held actions, aiming by dragging a held Mine/Use button, responsive hotbar inventory button, top Chat/Pause, contextual Jump/Swim/Up/Down/Dismount, size/opacity/sensitivity, floating joystick origin and left-handed layout. Existing Creative double-tap Jump behavior is retained. Control preferences persist under the separate dcsmcraft-mobile-controls key; inventory/world data is not moved.

Custom controls remain mobile buttons: Air Trick/Seeker quick actions, weapon Use/Dash/Pulse, Stand bindings, and a non-pausing Sonic moves tray. Existing pause/action menus retain item drop, view, journal, coordinates and Creative flight. Controller handoff clears held touch state. Touch cancel, blur, pause, resize and app switching release movement/mining/use.

## Limits

Both layouts aim with the crosshair. Tap-at-finger block targeting, Bedrock auto-jump, arbitrary per-button dragging, native mobile haptics and Bedrock's proportional stack-drag gestures are not included. Inventory retains working Move stack/Split/Quick move controls. Floating mode re-centers within the existing stick touch zone. Scaling, handedness and safe-area layout are provided instead of a freeform layout editor. Existing shared physics and reach remain the game's Java reference behavior.

Physical iOS/Safari/controller hardware requires device testing; Chromium touch emulation does not establish performance on every phone. The build remains a web app installable from Safari through Share → Add to Home Screen, with the existing HTTPS/offline requirements.
