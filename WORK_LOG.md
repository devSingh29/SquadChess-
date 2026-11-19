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

### Milestone 3 — everyday controls

Extracted HomeScreen, MatchPanel, shared labels and icons from the large application component. Added prominent Continue, remembered setup, Plan/Moves tabs, compact numbered combinations, explicit skipped-follow-up messages, Return to Match, replay-accurate captures/highlights, categorized settings and previews. New proposals and hints reveal Plan before confirmation. A 1366×768 laptop fits the board and essential controls; phone setup comes first and confirmation stays above navigation without covering the board.

All original 35 browser scenarios and five new interface scenarios pass. Desktop and phone images are recorded in docs/screenshots/v1.1.0/. Independent review found the initially hidden plan when selecting from Moves; this is fixed and covered by a regression scenario.

### Milestone 4 — public project and release preparation

Added ISC licensing credited to Dev Singh and contributors, contributor guides, issue/change-request templates, release notes, weekly grouped dependency updates, Node 24.22.2/npm 11.21.2 pins and reproducible installation. Browser tests manage their own servers; a separate packaged-game suite exercises the built worker without development imports. GitHub Actions retains reports, failure traces and verified browser/source archives.

Clean installation passed. Full local verification passed: 107 game tests, all 53 game/interface/battle browser scenarios, both packaged-game scenarios, source checks and release build. Independent review then caught a pre-existing gallery volume override; it is corrected and a new actual-audio browser scenario passes (54 browser scenarios total). The game still runs at http://localhost:5173 for play.

Independent complete-game validation covered four games across both colors/opening rules: 275 moves, 98 captures, 16 finishers, 20 interrupted-pair reloads, 126 exact promised moves and 736 validated saves. Details and limits are in docs/verification-v1.1.0.json.

Release publication proceeds through release/battlefield-finishers, a reviewed public change request, successful hosted checks, a merge preserving all history, and v1.1.0 downloadable packages. No website hosting is included. Public source/checks: https://github.com/devSingh29/SquadChess- ; release: https://github.com/devSingh29/SquadChess-/releases/tag/v1.1.0 .

## Usability follow-up — 2026-11-18

### Saved-match controls

Deleting the loaded match now cancels outstanding game work, clears the live reference before draining queued saves, and removes the stored copy exactly once. Failed deletion restores the paused match only if a newer game has not replaced it. Delayed saved-game reads cannot reopen a deleted match. Deleting another archived match leaves the current plan intact.

Home now distinguishes Continue match from Review finished match, shows the selected army/move count/clock choice, and exposes the selected army to assistive software. Added seven controller checks and three browser scenarios for deletion, exact-plan preservation, and finished-game review. All 114 game checks, source checks, and the three focused browser scenarios pass. Independent review caught and verified the delayed-load fix. The public check suite runs before merging this checkpoint.

The saved-match checkpoint is public in PR #8, merged as `6092566` after the complete hosted checks passed (run `44452102374`). The original 35 browser game scenarios also passed locally alongside the three new saved-match scenarios.

### Planning, pause, keyboard, and replay controls

Both promised moves now remain in the phone confirmation area, with direct inspection of either position and a route to the complete explanation. The short-phone board reserves room for that area. Shared category controls support arrows, Home, End, and one Tab stop. Board focus announces the piece, selection, and legal destinations; dialogs have explicit accessible names. Movement and thinking descriptions match the current activity.

Undo from a paused or error-stopped timed game stays paused. Pausing a proposed combination displays the accepted board while preserving the exact proposal for Resume. Paused players no longer appear active. History replays return to History without replacing the loaded match, and clocks follow recorded move snapshots. Replay controls disable unavailable steps and empty playback. Hints, revisions, rematches, Continue, and imports reset stale view choices.

Independent review found no remaining material blockers. Verification: 118 game checks, all 68 development-browser scenarios, both packaged-game scenarios, source checks, and the release build pass. The full browser run initially found four expectations for the previous import wording; the message now keeps the established import confirmation and clearly identifies a finished match. Finisher setup also respects the intentionally disabled first-move control. All 13 finisher scenarios were rerun successfully after those adjustments. No rules, saved formats, character art, or attack choreography changed. Desktop and 360×640 phone screenshots are in `docs/screenshots/usability-2026-11-18/`.

This checkpoint publishes through a second reviewed change request and the full hosted check suite. The local game remains available at http://localhost:5173/.
