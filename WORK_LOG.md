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
