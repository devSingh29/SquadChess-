# SquadChess browser application

Use the Node.js 24 and npm 11 versions recorded in the parent project. Run the complete game from there:

```sh
npm run setup
npm run dev
```

Within this folder, `npm run dev`, `npm test`, `npm run lint`, `npm run build`, and `npm run preview` run the corresponding client tasks directly. `npm run test:e2e` starts or reuses the development server on port 5173. `npm run test:packaged` tests an already-built `dist` folder using a separate preview server on port 4173; use the parent command to build and test in one step. The packaged tests use visible controls and exported files without importing source modules.

## Responsibilities

- The game rules own consecutive same-color moves, check-ending turns, legal individual moves, results, repetition, and saved move history.
- Computer players use those same rules in a background worker. Search results are matched to the current game and position so an old reply cannot change a newly loaded or undone board.
- The screen shows a tentative first move and a promised teammate follow-up. Once confirmed, the follow-up remains locked even if the page is refreshed between the two moves.
- Capture battles receive committed move events, including the actual capture square and saved variation. Replays can reproduce the same battle; restoring a game does not replay old effects.
- IndexedDB stores games and history. Browser settings use localStorage. Save-file imports replay and validate the complete custom move history before writing anything.

No game server, Python service, hosted AI, or account is needed for this local version. The root README describes the full rules and controls; [CONTRIBUTING.md](../CONTRIBUTING.md) describes development and release checks.

**Definitions:** client = the part of the game running in the browser; worker = a background browser task; committed move = an accepted move that changes the real board; IndexedDB = the browser's game database; localStorage = browser storage for small settings; validation = checking saved data before accepting it.
