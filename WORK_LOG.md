# SquadChess implementation checkpoint

Updated: 2026-11-10

## Scope and decisions

Complete the local React SquadChess game. Human and computer teammate share two consecutive moves, then two opponents do the same. Check ends a team turn. Keep the original server and Python sources available, but normal play runs entirely in the browser.

Preserve the illustrated humanoid pieces, weapons, visible arms and legs. Use familiar Chess.com-like navigation, setup, settings, system typography and green/cream board. Keep SquadChess branding. All normal moves have character-specific movement; captures use the saved, varied 24-attack registry.

Default full two-move White opening remains. Optional Balanced opening limits only White's first turn to one move. Rules, search, planner and restoration share this setting.

## Implemented

- Shared variant rules with focused edge-case tests and dynamically calculated turn capacity.
- Browser worker search with allied objectives across both moves, three difficulty budgets, cooperative hints and exact confirmed follow-up.
- Match controller, stale-search protection, clocks, pause, undo, restore, import/export, history and replay.
- Illustrated pieces, 24 capture attacks, victim reactions, saved variation and sound; declarative movement and battle registries.
- Familiar dark/green UI, setup page, responsive board, normalized numbered preview arrows, keyboard/touch/drag controls.
- Backward-compatible saves for balanced opening; documented one-command local launch.

## Current finishing work

1. Ordinary movement is connected to gameplay and replay; castling moves both pieces, quiet promotion combines travel and transformation.
2. Familiar Play / Match History / How to Play / Settings navigation and sectioned settings are implemented. Board colors and coordinates are configurable.
3. Run final automated checks and 28 browser scenarios, inspect desktop/mobile appearance and repair any failures.
4. Update screenshots and contributor/run instructions, commit coherent checkpoints.

## Ownership

- Root: App, controller, layout, integration, commits and final checks.
- game_rules_review: shared rules/search and tests; independent final correctness review.
- save_system: storage, browser test suite, run documentation.
- experience_review: piece artwork, movement/capture/special effects and animation registry.

## Run and verification

`npm run dev` serves the game at http://localhost:5173. `npm test`, `npm run lint`, `npm run build` run local checks. Browser tests are in `client/tests/game.spec.js` and require Playwright Chromium and a running local server.

The code can be checkpointed without resetting the conversation. There is no reliable tool to detect a 10% usage threshold or request a usage reset. Continue from this file and the concrete source/tests after context compaction.

## Verification checkpoint

First full integrated run passed 88 tests, lint and the release build. Browser suite is running with updated navigation, all six ordinary movements, all 24 capture attacks and preference recovery. Independent review found malformed imported castling/en-passant rights accepted by chess.js; additional validation is being tested.
