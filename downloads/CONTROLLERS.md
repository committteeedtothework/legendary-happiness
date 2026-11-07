## 2.10.0 · Device-aware prompts

World, inventory, weapon and arena prompts now use the active Xbox, PlayStation, Switch or custom binding. Unknown custom hardware uses Button N. Keyboard/mouse restores keyboard text; screen touches switch to touch labels and controls. See [MOBILE.md](MOBILE.md).

# Controller support · 2.9.0

Connect a controller supported by your browser and press a button. DCSMCRAFT switches between controller and keyboard/mouse prompts as you use them. Main menu or Overworld pause → Options → Controller contains Automatic, Xbox, PlayStation, Switch Pro, Generic standard and Custom presets. Controller presets are deliberately absent from arena menus. Settings are local browser preferences, not world data.

Automatic reads the browser's controller identifier. DualSense/DualShock/Sony identifiers use PlayStation prompts; Nintendo/Switch identifiers use Switch prompts; Xbox/XInput uses Xbox prompts. Steam Input and similar software can expose any device as Xbox. Select the physical preset yourself in that case. Unidentified devices receive numbered face prompts; Custom supports button indices, stick axes, disabled bindings (-1), and optional trigger axes. The live readout helps map devices without standard browser mappings. Physical button positions are consistent across presets; Switch menus use A to confirm and B to return.

| Input | World | Arena |
|---|---|---|
| Left / right stick | Move / Look | Move / Camera |
| Bottom face | Jump; double press for Creative flight | Jump / Rise |
| Right face | Crouch / Dismount | Descend |
| Left face | Inventory: split stack | Attack / Counter |
| Top face | Inventory; inventory: quick transfer | Homing attack |
| Left / right trigger | Use / Mine / Attack | Parry / Boost |
| Left / right shoulder | Hotbar | Skill modifier / Dodge |
| Left / right stick click | Sprint / Camera view | — / Lock on |
| D-pad ↑ ↓ ← → | Weapon ability / Drop / Journal / Chat | Sonic Boom / Wild Rush / Quick Cyloop / Cross Slash |
| Left shoulder + ↑ ↓ ← → | — | Homing Shot / Stomp / Cyclone Kick / Spin Slash |
| View / Create / − | Actions | Controls overlay |
| Menu / Options / + | Pause | Pause |

During pre-fight traversal hold the left shoulder to draw a grass Cyloop, or press D-pad left near armor to climb. Use the left trigger at the Overworld boss portal. During a struggle rotate the left stick or tap Attack / Jump. Normal counters and perfect timing use the same combat simulation as mouse/keyboard.

Menus use D-pad or left stick, bottom face Confirm (Switch: right face A), right face Back (Switch: bottom B), left/right to adjust sliders or selections and right stick to scroll. Inventory Confirm moves a stack, left face splits, top face quick-transfers. Focus a text field and Confirm to open an on-screen keyboard. Done applies the text; Cancel discards it. Actions exposes flight, view, abilities, Stands and chat without reserving additional gameplay buttons.

Disconnect pauses active play and releases held actions. Stick deadzone, camera sensitivity, vertical inversion and optional supported rumble are adjustable. Physical mouse/keyboard use restores its prompts. Audio may require one click in the browser due to autoplay policy; a “Click for sound” button appears if needed. System file pickers and OS dialogs still use OS controls.

Validation uses an injected Gamepad API in Chromium, not physical controllers. The Gamepad API cannot expose devices the browser/OS does not recognize, identify physical hardware hidden behind XInput, or configure drivers. Real Xbox, PlayStation, Switch, custom USB, Bluetooth and Windows hardware remain untested. Multiplayer guests use the existing server's digital eight-direction movement protocol; local/host movement is analog. Custom remappings use generic numbered prompts rather than dynamically redrawing every raw button number.
