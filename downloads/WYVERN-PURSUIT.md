# Wyvern pursuit · 2.11.6

Wyvern health is 62,500 / 100,000 / 137,500 on Easy / Normal / Hard, before the existing health multiplier: 25% above 2.11.5. Sonic damage and ring-drain settings are unchanged. Saved encounters migrate their remaining health fraction to the new maximum.

Free flight is 32 m/s, boost 60 m/s, and ribbon running 29 / 46 m/s. The moving battle frame follows a 1,300-metre-radius route at 0.082 radians/second after its entrance blend. Speed widens the camera field of view smoothly, with optional peripheral warm-white streaks controlled by the existing Speed Trails and Particles settings. They disappear during the successful-parry slow motion. No blue Super Sonic trail was added.

Wyvern now requires a new parry press near contact: 340 / 280 / 230 milliseconds on Easy / Normal / Hard; Strict Parry uses 200 ms. Hold never provides indefinite protection. Each press can deflect one attack; release and press again for the second phase's second claw. Keyboard/mouse, controller and touch retain their existing parry buttons. A successful parry triggers a glove finger flick and 460 milliseconds of real-time slow motion at 22% simulation speed. Camera and music continue at normal time. Pause freezes the encounter normally, and reload never restores a stale held input or partial slowdown. Attack/dodge inputs remain available.

Missiles now have an original larger metal casing, pointed nose, four stabilizer fins, seeker band, nozzle and animated exhaust, rendered in four bounded instanced pools. Their launch points sit outside the boss; lofted arcs clear its head on the way out and back. The shared trajectory drives both direction and trails. Their aim, arrival timing, avoidance and damage rules remain unchanged; size is a visual improvement, not a hidden increase in damage range.

The terrain spans 6,400 × 6,400 metres. The walking radius is 340 m (previously 170); the aerial radius is 230 m (previously 140), with altitude 30–200 m. Both terrain LODs, foot placement and camera clearance sample the same piecewise planar height field. Rock and ruin placements avoid the walking field, chase ribbon and the whole flight corridor. Camera clearance applies before and after interpolation. Wyvern's contacts include the same head bob, bounded spine pose and cinematic spin/drop as its rendered rig; the unrepresented whole-body flight bank was removed. Existing portal, Emerald, transformation, phase/QTE, checkpoint and return systems remain.

References read for this update:

- https://www.destructoid.com/sonic-frontiers-how-to-beat-wyvern-boss-guide/
- https://www.gamepur.com/guides/how-to-defeat-the-wyvern-in-sonic-frontiers
- Existing recording analysis in WYVERN-VIDEO.md (its independent frame verification remains unavailable).

The guides agree on reflected missiles, claw parries, a second claw in phase two and the timing/jaw ending. The original game's ordinary parry can be held; this release deliberately uses the user's requested timed parry. The finger flick, larger missiles, free-flight space and timing are original adaptations, not verified frame-for-frame reproductions. The supplied Sonic rig has wrist joints but no individual finger bones; an original animated two-joint glove digit supplies the flick. Imported character animations and analytic collision shapes remain approximations; exhaustive absence of mesh-level clipping cannot be guaranteed.
