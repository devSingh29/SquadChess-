# Extending SquadChess movement and battles

The illustrated characters and battle drawings in this project are original SVG artwork authored for SquadChess. No external artwork, audio recordings, or copied animation assets are required. Sounds are generated with Web Audio.

## The registries are the starting point

`client/src/game/choreography.js` exports three registries:

- `BATTLE_REGISTRY`: four authored attacks for each of the six piece roles. An entry declares its stable `id`, title, CSS `motionName`, illustrated `effect`, `durationScale`, and anticipation/attack/impact/settle phases.
- `REACTION_REGISTRY`: five defeated-piece reactions. Kings have no capture reaction because the game ends through checkmate. Entries select the main motion, articulated detail, and fragment material.
- `MOVEMENT_REGISTRY`: two ordinary movements for each role, with a motion name, gait, trail effect, duration scale, and phases.

Keep published IDs stable: accepted moves store their selected variant, seed, and duration so saves and replays reproduce the same choices. Unknown imported variants resolve to a known entry. Selection avoids repeating the previous capture or ordinary-move variant for the same piece role. Capture combinations require the immediately previous accepted move to be a capture by the same team.

## Add an attack

1. Add an entry to its role in `BATTLE_REGISTRY`. Use the `capture()` helper to keep the contact point aligned with the 43% strike position in the existing movement curves. The helper derives phase fractions; `phaseTimings()` converts them to real milliseconds.
2. Add the entry's movement keyframes to `client/src/components/battle.css`. The attacker and its weapon use active motion time, excluding the impact hold. `BattleOverlay` switches from anticipation to attack, then pauses the attacker during impact before resuming the settle. The registry's actual phase timings also drive glow, signature, particle, and sound timing.
3. Add its original illustrated signature to `AttackSignature` in `BattleOverlay.jsx`, or explicitly reuse an existing `effect` from the registry. Particle spread is generated from the saved seed, never from uncontrolled random values during rendering.
4. Add the short encounter explanation to `BattleGallery.jsx`. The gallery automatically takes its attack list from the registry-derived variants.
5. Test normal captures, a capture near an edge, the rotated board, reduced/off motion, reconnect/replay, a capture followed quickly by another move, and pawn capture-promotion where relevant.

Ordinary captures last 900–1100 milliseconds. Squad combinations, giant-slayer pawn captures, and capture-promotions receive an additional 250 milliseconds and remain below 1500. Capture-promotions retain the pawn during its attack, then replace it with the promoted role and a coronation finish in the final third.

## Add a reaction or ordinary movement

For a reaction, change `REACTION_REGISTRY`, add its named keyframes, and use the registry's `articulation` attribute for any independently moving shield, rider, crown, or limb. The overlay reads `motionName` and `fragments` directly; these are operational settings, not documentation-only metadata.

For an ordinary movement, add a `MOVEMENT_REGISTRY` entry and matching keyframes in `movement.css`. The gait determines leg motion, arms, rider movement, and floating details. Anticipation and settle phases start and stop the gait; the registry supplies the actual playback duration and motion name. Standard travel lasts 350–650 milliseconds, adjusted for distance. Keep ordinary moves quieter and shorter than captures.

Characters in `PieceArt.jsx` expose separate left/right leg and arm groups, plus weapon, cape, shield, rider, mount, crown, and base groups as applicable. Preserve their identifiable chess silhouette, humanoid anatomy, and weapons when extending artwork.

## Verify and integrate

Run `npm run test --prefix client`, `npm run lint --prefix client`, and `npm run build --prefix client`. The focused battle tests ensure every registered motion has shipped keyframes, all roles are covered, timings remain bounded, and seeded choices remain reproducible. Browser checks should inspect the actual computed motion and all gallery choices.

Overlays never change chess state. The controller first accepts the move, records its presentation choices, and then plays the overlay. A completion callback and bounded fallback prevent animation from stranding a turn. On full motion, the board hides the ordinary pieces represented by the overlay; reduced/off motion leaves the accepted board visible. The application sets the initial motion preference from the device and honors later player overrides.

For castling, `MovementOverlay` also animates the rook returned by `castlingRookSquares(event)`. Hide both moving pieces' source and destination squares while full motion runs. For quiet promotion, render `MovementOverlay` with `SpecialMoveOverlay withMovement`: the pawn travels first and the promoted figure appears in the last third. Use the special overlay's completion callback for combined special effects. Capture-promotions are contained entirely within `BattleOverlay`.

Definitions: SVG = scalable vector drawing; registry = organized set of animation descriptions; keyframes = named poses over an animation; seed = saved number used to reproduce visual variation; gait = characteristic walking or travel motion; overlay = graphics above the board; impact hold = brief pause that gives a strike weight; Web Audio = the browser's sound-generation system.
