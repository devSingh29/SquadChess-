# Extending SquadChess movement and battles

The illustrated characters and battle drawings are original SVG artwork authored for SquadChess. No external artwork, recordings, or copied animation assets are required. Sounds are generated with Web Audio. Preserve the armed humanoid characters, their small articulated limbs, and recognizable chess silhouettes.

## Start with the registries

`client/src/game/choreography.js` owns the existing motion library:

- `BATTLE_REGISTRY`: 24 ordinary attacks, four per role. Each entry declares a stable `id`, title, CSS `motionName`, illustrated `effect`, `durationScale`, and anticipation/attack/impact/settle phases.
- `MOVEMENT_REGISTRY`: 12 ordinary movements, two per role, with a motion name, gait, trail effect, duration scale, and phases.
- `REACTION_REGISTRY`: the five original defender reactions, retained for old saved events. Kings have no capture reaction because the game ends through checkmate.

`client/src/game/finishers.js` adds version-two presentation:

- `FINISHER_REGISTRY`: 12 environmental finishes, two per attacking role. Each permanent ID selects a title, attacker role, duration, motion name, and phase timing.
- `REACTION_VARIANTS`: 15 defender reactions, three per capturable role. Entries name the main motion, articulated detail, and fragment material.
- Selection helpers use accepted move facts, preceding events, and seeded random streams. Keep selection here, outside rendering and audio.

Keep published IDs stable. New captures save `presentationVersion: 2`, `reactionVariant`, attack `variant`, `seed`, and `duration`. A selected finisher also saves `{ id, baseDuration, echo? }`: `baseDuration` is the ordinary capture length, while the event's `duration` is the full finish length. The optional echo records the actual preceding allied capture's `from`, `to`, `captureSquare`, `piece`, `color`, and `seat`. Old events without version two retain their original reactions and never gain a newly selected finisher during replay. Unknown future choices fall back to ordinary playback without changing the accepted move.

## Timing, rarity, and preferences

Ordinary captures last 900–1100 milliseconds. Combinations, giant-slayer pawn captures, and capture-promotions can add 250 milliseconds and remain below 1500. Quiet travel lasts 350–650 milliseconds, with longer combined quiet-special presentation where needed. Environmental finishes last 2300–2800 milliseconds.

A finisher is eligible on capture-promotion, capture of a queen or rook, the second consecutive allied capture, or a mating capture. There must be at least eight accepted actions between recorded finishers. When a locked follow-up is also a capture, the controller reserves the finish for that second action. A combination requires the immediately preceding capture to belong to the same team's first seat without ending its turn. Selection avoids immediately repeating a role's previous finisher or a victim role's previous reaction.

Use `battleSpec(event, preferences)` to resolve saved choices. Use `presentationDuration(event, preferences)` for every playback completion timer; do not invent another timing calculation. The controller fallback, live/replay overlays, and audio share this duration. `phaseTimings()` converts the resolved ordinary or finisher phases to milliseconds. The finisher's impact starts at 40.85% of its duration, matching the existing attack curves at 43% of active movement after excluding the impact hold.

Preferences affect playback, never saved choices. `finishers: false` resolves the stored ordinary capture using `baseDuration`. Reduced motion takes 220 milliseconds and omits environmental effects; off takes zero and leaves the accepted board visible. `boardShake: false` disables only board shake. Sound is independent: off-motion sound is a tiny immediate cue, while full/reduced playback returns a cancellation function for skip, pause, mute, navigation, and unmount.

## Add an ordinary attack or movement

1. Add an attack entry to its role in `BATTLE_REGISTRY`. Use the `capture()` helper to align contact with the existing 43% strike position.
2. Add movement keyframes to `client/src/components/battle.css`. Attacker movement excludes the impact hold; `BattleOverlay` pauses the attacker and weapon during contact. Effect and sound timing use the same phases.
3. Add original signature geometry to `AttackSignature` in `BattleOverlay.jsx`, or explicitly reuse a known registry effect. Generate variation from the saved seed, never uncontrolled randomness while rendering.
4. Add its brief description to `BattleGallery.jsx`. Its attack choices come from the registry-derived variants.

For an ordinary movement, add a `MOVEMENT_REGISTRY` entry and matching keyframes in `movement.css`. The gait drives legs, arms, rider motion, or levitation. Keep quiet moves shorter and less dramatic than captures. `PieceArt.jsx` exposes left/right limbs, weapon, cape, shield, rider, mount, crown, and base groups as applicable.

## Add a finisher or defender reaction

Add a finisher entry to `FINISHER_REGISTRY` without renaming published IDs. Keep the total duration bounded and preserve the contact alignment if reusing ordinary attacker paths. Implement its environmental drawing in `FinisherEffects.jsx` and the distinct sequence in `finisher-effects.css`; merely changing colors or particle counts is insufficient. Add the short description to `BattleGallery.jsx`. Gallery finishers are explicit previews that bypass match rarity and the gameplay finisher toggle, while honoring motion and board-shake preferences.

Finishes remain within the visible board. Use the actual `captureSquare`, including en passant, and transform coordinates through `squareCenter()` for either orientation. Leave surrounding pieces and squares visible. The nearest `.board-scene` is the only shake target. Cancel its browser animation on unmount; never shake the document or sidebar. Maximum visible debris is 36 on desktop and 18 on phones; maximum tile fragments is 16/8. Ground cracks and other signature geometry do not need per-frame JavaScript.

For a new version-two reaction, extend `REACTION_VARIANTS`, add its named keyframes in `battle.css`, and preserve the original `REACTION_REGISTRY` behavior. Version-two reactions begin at the shared impact time after a defensive pose. Use articulated groups for shields, riders, crowns, and limbs; use clipped character fragments only where the reaction calls for actual separation. Keep all destruction blood-free. Both the environmental allied trail and character echo derive colors from the saved actors via `actorAccent()`.

## Integration and state boundaries

Overlays never alter chess state. The controller accepts the move, records presentation choices, saves the resulting position, and then presents the event. Completion callbacks are guarded by event identity; a bounded controller fallback releases a stuck presentation. Skipping or interrupting a finish therefore preserves the same move and promised teammate continuation.

Treat accepted events and published controller snapshots as immutable. Create new objects when state changes; do not deep-clone the entire match on every animation frame or clock tick. `storage.js` deep-copies at save and validation boundaries, and browser worker messages cross the browser's structured-copy boundary. Keep SVG nodes, animation handles, timers, and audio nodes in the presentation layer rather than saved events. See [ARCHITECTURE.md](ARCHITECTURE.md) for the ownership model.

On full motion, hide the ordinary pieces represented by an overlay. For castling, `MovementOverlay` travels both the king and the rook returned by `castlingRookSquares(event)`; hide both source and destination squares. For quiet promotion, combine `MovementOverlay` with `SpecialMoveOverlay withMovement`: the pawn travels first and the promoted figure arrives in the final third, with the special overlay owning completion. Capture-promotion stays entirely in `BattleOverlay`.

## Verify a change

Run `npm run test --prefix client`, `npm run lint --prefix client`, and `npm run build --prefix client`. Run the browser suite with `npm run test:e2e --prefix client`; include packaged checks when preparing a release. Verify actual computed movement names, every gallery choice, both armies and all four actors, board corners and rotated orientation, reduced/off motion, disabled finishers/shake, faithful saved replay, and interrupted playback. The phone gallery scrolls an explicitly selected preview into view immediately.

Definitions: SVG = scalable vector drawing; registry = organized animation descriptions; keyframes = named poses over time; seed = saved number producing repeatable variation; gait = characteristic travel motion; overlay = graphics above the board; impact hold = brief freeze emphasizing a strike; Web Audio = the browser's sound-generation system; immutable = not modified in place; snapshot = one published state; deep copy = an independent copy including nested values; structured copy = the browser's safe copying of data between contexts; boundary = a point where ownership changes; unmount = removal from the screen.
