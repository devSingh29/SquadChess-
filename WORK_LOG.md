# SquadChess implementation checkpoint

Updated: 2026-11-10. The approved local-game scope is complete.

## Delivered

- React + chess.js + browser-worker foundation; no external AI/server needed for normal play.
- Shared rules for two allied moves, check ending a turn, special moves, draw boundaries, both playing colors, and optional balanced opening.
- Exact teammate combination preview and execution, three difficulty budgets, cooperative hints and explanations, stale-search protection and retry recovery.
- Optional team clocks, pause/resume, hidden-tab pause, undo, resignation, rematch, validated browser saves, portable import/export, match history and faithful replay.
- Familiar Chess.com-like Play, Match History, How to Play and Settings layout; green/cream default board, adjustable board colors and coordinates; keyboard, mouse and touch controls.
- Original armed humanoid artwork with visible articulated arms/legs and recognizable chess-role silhouettes.
- Twelve ordinary travel variations; twenty-four capture attacks with target-specific reactions, actor accents, combinations, capture-promotion and saved variation.
- Castling moves both pieces; promotion combines travel and transformation. Full/reduced/off motion, skip and independently controlled generated sound.
- Separate declarative choreography, documented shared contracts and contribution instructions. Original server/Python/nested-repository source preserved.

## Final validation

- `npm test`: **93 passed**, 0 failed.
- `npm run test:e2e`: **35 passed**, 0 failed; no browser errors.
- `npm run lint`: passed.
- `npm run build`: passed; worker packaged separately.
- `git diff --check`: passed.
- Independent simulations: **28 finished games, 5,539 moves**, both opening modes and both colors, with restored/replayed positions matching throughout. Four simulations exercised the actual controller and save validation.
- Visual inspection of desktop and 360px phone screens; screenshots in `docs/screenshots/`.
- Final review fixed malformed imported special-move rights, impossible second-move starts, duplicate effect identities, clipped artwork, replay continuing after navigation, older-save animation timing, and sound cancellation.

## Run

`npm run dev` serves the game at http://localhost:5173. After a fresh checkout, run `npm run setup` once. The local development server was left running for review.

## Saved checkpoints

1. `701859b`: base playable rules, planner, saves and battles.
2. `3cd0035`: familiar Play/Settings and animated travel.
3. `2a783b1`: recovery/replay improvements and shared-contract documentation.
4. Final presentation/audio verification, browser coverage, screenshots and completion record are committed after this update.

## Continuation

There are no known outstanding blockers in the authorized local version. Human multiplayer, accounts, rankings and public hosting remain outside the agreed scope. See `ARCHITECTURE.md`, `CONTRIBUTING_BATTLES.md` and `README.md` before future changes.

There is no available tool to detect a 10% usage threshold reliably or trigger a usage reset. This checkpoint and Git history preserve progress if conversation context resets.

## v1.1.0 release in progress — 2026-11-10

Approved next scope: twelve rare environmental finishers, fifteen defeat reactions, compact desktop/phone controls, contributor tools, public checks and release. The existing 93 game checks and 35 browser scenarios remain the regression baseline.

Milestones:
1. Shared finisher selection, saved-event compatibility and playback controls — in progress.
2. Twelve on-board finishers, expanded reactions, generated sound and gallery — in progress.
3. Start/setup, match planning, replay and categorized settings improvements — in progress.
4. Node 24, reproducible installation, contributor files, GitHub checks, reviewed change request and v1.1.0 — in progress.

The root release branch is `release/battlefield-finishers`. The public repository's original README-only commit has been merged as history without replacing the current game or removing any existing commit. Public website hosting remains outside this release.

### Milestone 1 — shared capture records and recovery

Implemented the twelve stable finisher identities, fifteen saved reaction choices, exact eight-move spacing, coordinated double captures, ordinary fallback timing, old-save compatibility and new presentation preferences. Quiet legacy special moves keep their complete animation duration. All 107 game tests pass under Node 24.22.2; the original 93 remain included. The backup completion timer retains a short recovery allowance and animation-off stays immediate.

### Milestone 2 — environmental battles and gallery

Delivered all twelve environmental finishes, fifteen defeat reactions, generated sound, board-only shake and colored allied echoes. Original armed character artwork is unchanged. The gallery exposes every attack, finish, reaction, army and player; phone selections bring the battle into view. Earthbreaker uses branching cracks, Royal Judgment converging shields, and Spearline rising stone.

All thirteen new battle browser scenarios pass, covering all finishes/reactions, both armies, four accents, board corners, both orientations, portrait/landscape phones, full/reduced/off motion, independent finisher/shake controls, import/replay fidelity, skip, pause, refresh and undo. Sound timing/cancellation tests, source checks and release build also pass. Current total: 107 game tests and 53 browser scenarios (the original 35 plus 18 new).
