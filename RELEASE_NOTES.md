# SquadChess v1.1.0 — Battlefield finishers

SquadChess remains a complete local game: you and Lyra take two consecutive moves with a shared army before two computer opponents respond. This update adds rare, blood-free fantasy finishes and clearer everyday controls. The existing two-move rules, armed characters, exact teammate promises, saved games, and original movements remain intact.

## Battles that change the scene

Twelve environmental finishes bring earthquakes, rising stone, astral gates, falling stars, and spectral shields onto the board. Each capturing role has two finishes, and each capturable role now has three defeat reactions. Ordinary captures stay brief; big finishes last 2.3–2.8 seconds and are separated by at least eight individual moves.

Eligible encounters include powerful victims, capture-promotion, a second allied capture, or a capture delivering checkmate. Confirmed double captures reserve the big finish for the teammate's second move, with an echo of the first attacker in its own player color. Saved choices reproduce the same battle in replay. Unknown visual additions use an ordinary capture, and older saves keep their original presentation.

Finishers and board shake have separate settings. Reduced motion removes environmental effects and shake; motion-off settles immediately. Skip stops the battle and its sound. The gallery exposes all 24 ordinary attacks, all 12 finishes, all 15 reactions, both armies, and four player accents.

## Easier to play

- Continue is prominent, and new-match setup remembers the last choices. Setup appears before the decorative board on phones.
- The match panel separates **Plan** and **Moves**. Selecting a move or asking for a hint reveals the proposed combination before confirmation.
- Compact numbered moves and an explicit explanation show when check or balanced opening removes Lyra's follow-up.
- The board and essential controls fit a 1366×768 laptop. Phone confirmation stays above navigation without covering the board.
- Replay has **Return to Match**, and capture counts and highlights follow the displayed move.
- Settings use selectable Board & pieces, Animations, and Sound categories, with small previews.

## Public code and contributor tools

The project now includes its ISC license, contributor guides, issue forms, a change-request template, and weekly grouped dependency suggestions. Node.js 24.22.2 and npm 11.21.2 are recorded for repeatable installation. Browser checks start their own servers, and separate packaged-game checks verify the actual released computer worker.

GitHub Actions runs source, game, browser, and packaged-game checks and preserves failure details. Successful checks produce downloadable browser and source archives. The original public README-only history and every local implementation commit are preserved without rewriting history.

## Verification

The release includes 107 game checks and 54 browser scenarios, preserving all original 93 game checks and 35 browser scenarios. Two additional packaged-game checks verify the built worker and both playing colors. Independent complete-game checks covered 275 moves, 98 captures, 16 finishes, 20 reloads between allied moves, 126 promised follow-ups, and 736 validated saved states. These stress games used a short search budget; separate checks verified the normal Easy, Medium, and Hard budgets.

## Run and scope

With the recorded Node/npm versions, run `npm run setup` once, then `npm run dev`. Open the printed local address. Normal play needs no account, Python process, external computer-player service, or game server.

The downloadable web archive must be served over HTTP; opening its index file directly is not supported. Saved games remain local to the browser and address used. Export a portable copy to transfer or independently back up a match.

Human multiplayer, accounts, rankings, and public website hosting remain outside this release.

Definitions: ISC = a permissive software license; Node.js = the program running development tools; npm = its package installer; worker = a background computer-player task; archive = a downloadable collection of files; commit = a recorded code checkpoint; HTTP = the method a browser uses to load a site from a server.
