# SquadChess architecture

The game uses React, chess.js and a browser worker. Normal play has no server or external AI dependency. The original `server/`, `ai/` and `shared/` folders remain for reference.

## One authoritative rules path

`client/src/game/rules.js` owns the modified rules. `applyMove()` is used by accepted moves, combination previews, search and save restoration. It produces a new position and move details without mutating the input. Illegal moves throw before a caller replaces the current position.

`Position` contains the board as FEN, active team, first/second slot, turn number, draw history and opening settings. `turnCapacity()` and `movesRemaining()` are the shared hooks for move counts. A checking move hands control to the other team immediately. No artificial skipped chess move is used to switch colors. Only bare kings trigger the automatic material draw because ordinary chess's other insufficient-material assumptions do not apply to double moves.

## Contracts and ownership

`client/src/game/types.js` describes the existing `MatchState`, `MoveEvent`, `SearchRequest`, `SearchResult` and `SavedMatch` contracts using JSDoc. The match's `position` owns board/turn/result state; `config` owns player difficulty and clock choices; `settings` owns rule options. `lockedMove` stores the promised follow-up before the first accepted move is saved.

`controller.js` coordinates clocks, the worker, saving, pause, undo and accepted moves. `App.jsx` presents these states. Search results carry a request identity and match revision; cancelled, replaced or outdated successful **and failed** results are discarded. A retryable engine error freezes the clock and retains the position. Undo and restore use accepted events rather than screen state.

## Search

`engine.js` uses iterative deepening and alpha-beta search. Both allied actions pursue the same objective; that objective changes only when the other team gains control. A search horizon completes the current allied turn. Checks and valuable captures are considered early, and board evaluation includes material, movement opportunities, promotion pressure and king safety. Difficulty budgets are 200, 700 and 1,800 milliseconds, without human-rating claims.

Search positions use lightweight FEN and variant state. Search does not serialize full chess history or PGN. Evaluation reuses bounded board scores and precomputed movement directions. These patterns were informed by [chessops's position cloning](https://github.com/niklasf/chessops/blob/master/src/chess.ts) and [board representation](https://github.com/niklasf/chessops/blob/master/src/board.ts); no chessops implementation is imported. Individual legality remains with [chess.js](https://jhlywa.github.io/chess.js/).

## Independent presentation

Accepted events already contain their final board result. The movement and battle layers illustrate those events; their completion callback only releases the next presentation step. The controller also has a bounded completion timer. Skipping, reduced/off motion, pause, a hidden tab or a missing effect cannot decide move legality or strand the match.

`choreography.js` declares capture attacks, target reactions, travel styles and phase timing. `battles.js` selects repeatable variants from saved seeds and avoids immediate repetition. `MovementOverlay` animates every ordinary move, including both castling pieces. `BattleOverlay` retains the victim through its reaction and removes it visually only after the strike. See [the battle contribution guide](CONTRIBUTING_BATTLES.md).

`PlannerOverlay` uses a normalized 8×8 drawing layer, shortened arrow endpoints and numbered badges. Coordinates flip with the board and do not depend on a fixed pixel size. This independently implemented approach follows the pattern in [Chessground's SVG layer](https://github.com/lichess-org/chessground/blob/master/src/svg.ts).

## Saving and recovery

`storage.js` uses IndexedDB for matches and browser preferences for display/sound choices. Imports validate every action by replaying it through the shared rules; supplied derived boards are rebuilt. Clock checkpoints, pending confirmed moves and animation choices survive restoration. Imports create a new local match identity and cannot overwrite a valid saved match accidentally. Invalid rule rights, impossible unfinished turns, malformed preferences and damaged imports produce readable errors.

Portable files are versioned SquadChess records. Player-labelled text export does not claim to be ordinary chess PGN. Completed games retain their assistance count and settings.

## Checks

`npm test` covers rules, search, controller, storage and choreography. `npm run test:e2e` exercises the actual board, worker, browser storage, controls and responsive layout. `npm run lint` and `npm run build` check source quality and release packaging. Use `npm run dev` for local play after `npm run setup`.

Definitions: FEN = compact board-position text; JSDoc = descriptions of JavaScript types in comments; worker = background browser task; alpha-beta = pruning search branches that cannot improve a decision; PGN = ordinary chess game notation; mutation = changing an existing object in place; SVG = resolution-independent vector drawing; IndexedDB = browser database; choreography = the ordered movements and effects of an animation; revision = number identifying the current match state.
