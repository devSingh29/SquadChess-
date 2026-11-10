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

`choreography.js` declares 24 ordinary attacks, 12 travel styles, and the five original defender reactions. `finishers.js` adds 12 environmental finishes and 15 version-two defender reactions. `battles.js` combines these registries with saved seeds and accepted move facts. Selection is made once, at acceptance; replay resolves the recorded choice instead of running eligibility again. Captures without `presentationVersion: 2` retain their original reactions. Version-two events record `reactionVariant` and optional `finisher: { id, baseDuration, echo? }`; the echo names the actual immediately preceding allied capture. Unknown future choices fall back to ordinary presentation.

`battleSpec(event, preferences)` resolves a capture. `presentationDuration(event, preferences)` is the shared clock for controller fallback, movement/special/battle overlays, replay, and sound. Disabling finishers restores the recorded `baseDuration`; reduced motion lasts 220 milliseconds without environmental effects, and off completes immediately. Preferences never rewrite event history. The controller measures fallback time from the presentation's original start and reschedules the remaining wait when preferences change.

`MovementOverlay` animates every ordinary move, including both castling pieces. `BattleOverlay` gives the defender a guarded pose and starts its reaction at contact. `FinisherEffects` supplies distinct board-local geometry and only animates the nearest `.board-scene` for optional shake. Effects never replace the battlefield with a cutaway. Animation and sound handles are canceled on interruption or removal. `playMoveSound()` returns cancellation for scheduled sources; off-motion sound uses a short immediate cue that can finish naturally. See [the battle contribution guide](CONTRIBUTING_BATTLES.md) for timing, visual budgets, gallery previews, and extension steps.

`PlannerOverlay` uses a normalized 8×8 drawing layer, shortened arrow endpoints and numbered badges. Coordinates flip with the board and do not depend on a fixed pixel size. This independently implemented approach follows the pattern in [Chessground's SVG layer](https://github.com/lichess-org/chessground/blob/master/src/svg.ts).

## Copy and ownership boundaries

Controller snapshots and accepted events are treated as immutable values. `update()` creates a new match object; clock updates replace the small clock object; accepted moves append a new event array and use the new position returned by `applyMove()`. Unchanged history can be shared safely because presentation and search do not mutate it. The controller retains a snapshot reference in its save queue instead of serializing the full match on every clock update.

Deep copying belongs at ownership boundaries. `storage.js` clones a match before writing it and returns an independent validated save, rebuilding authoritative positions from accepted moves. Browser worker messages receive the browser's structured copies. Search works with lightweight FEN/variant positions instead of copying complete match history per node. Overlay timers, SVG elements, browser animation handles, and audio nodes stay in the presentation layer; saved events contain only bounded data choices. Contributors should not add full-match JSON cloning to rendering, clock ticks, or the search loop.

## Saving and recovery

`storage.js` uses IndexedDB for matches and browser preferences for display/sound choices. Imports validate every action by replaying it through the shared rules; supplied derived boards are rebuilt. Clock checkpoints, pending confirmed moves and animation choices survive restoration. Imports create a new local match identity and cannot overwrite a valid saved match accidentally. Invalid rule rights, impossible unfinished turns, malformed preferences and damaged imports produce readable errors.

Portable files are versioned SquadChess records. Presentation version is separate from file/rules version: old records remain valid, while version-two reaction/finisher metadata is validated against piece roles and bounded durations. An allied echo must exactly match the preceding accepted first-seat capture; forged histories cannot inject an unrelated actor. Unknown future visual IDs can be retained and played through the ordinary fallback. Player-labelled text export does not claim to be ordinary chess PGN. Completed games retain their assistance count and settings.

## Checks

`npm test` covers rules, search, controller, storage and choreography. `npm run test:e2e` exercises the actual board, worker, browser storage, controls and responsive layout. `npm run lint` and `npm run build` check source quality and release packaging. Use `npm run dev` for local play after `npm run setup`.

Definitions: FEN = compact board-position text; JSDoc = descriptions of JavaScript types in comments; worker = background browser task; alpha-beta = pruning search branches that cannot improve a decision; PGN = ordinary chess game notation; mutation = changing an existing object in place; SVG = resolution-independent vector drawing; IndexedDB = browser database; choreography = the ordered movements and effects of an animation; revision = number identifying the current match state; registry = organized animation descriptions; immutable = not modified in place; snapshot = one published state; deep copy = an independent copy including nested data; structured copy = the browser’s copying of data between contexts; boundary = a point where ownership changes; overlay = graphics drawn above the board; handle = a reference used to stop an active effect.
