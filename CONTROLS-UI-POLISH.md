# DCSMCRAFT 2.19.0

Achievements have separate Overworld and arena presentation, animated notices
and an original synthesized unlock cue. Existing progress and save schemas are
retained. The design references are recorded in reference/controls-ui-2.19.0.json.

Both Titan fights use persistent Super Sonic body-part selection, with view and
range weighted acquisition, manual-look grace, soft horizontal/vertical framing,
range release and toggle cancellation. Homing and aimed abilities use the selected
contact; actual damage still requires the existing swept contact windows. There
is no lock-induced position warp. R3 / Tab toggles lock-on.

Gameplay camera obstruction shortens the actor's boom instead of jumping around
the giant. Wyvern no longer replaces player look with a fixed missile camera.
Its camera transports with Sonic during travel and attacks; scenery/body/terrain
checks also run after shake. Moving chase frames preserve world heading and
velocity through turns. Authored cinematics and return portals remain intact.

Wyvern now shares Giganto's physical running, boosting, jumping and free-flight
rates, acceleration and short-jump handling. Pursuit boost retains its
higher closing speed so the moving boss remains catchable. On release Sonic keeps
his body heading while the camera can orbit independently.

The curled form has a shorter physical collider with the same foot position;
its visible ball is aligned to those feet. Swept tower/ribbon collision uses that
height and a small footprint at seams/edges. Boulder ejection cannot push Sonic
beneath a valid arena floor. Existing fall recovery and earned armor checkpoints
are retained. Intentional traversal gaps remain gaps.

The inventory has a free controller crosshair, existing stack transactions,
one-per-slot split painting, quick transfer, D-pad selection and adjustable
cursor speed. Focus navigation remains selectable. Original world assets,
terrain generation, combat damage/health/music segments and saves are preserved.

Windows executables are unsigned. Native Windows launch cannot be verified on
this Linux build host; packaged Electron gameplay is tested here with the same
ASAR payload included in the Windows portable build. This is an inspired UI and
control refinement, not an exact Sonic Frontiers or Minecraft reproduction.
