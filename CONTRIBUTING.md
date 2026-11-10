# Contributing to SquadChess

SquadChess is a local, browser-based game: you and a computer teammate share two consecutive moves before the opposing computer squad responds. Contributions should improve that experience while preserving saved matches and the two-move rules. The original online server and Python source remain available for reference; they are outside the local game's launch and release requirements.

## Set up

Use Node.js **24.22.2** and npm **11.21.2**. `.nvmrc` and `.node-version` record the Node version; both package manifests record the npm version. With nvm installed, run `nvm install` and `nvm use` in this folder. Then:

```sh
npm run setup
npm run test:browsers
npm run dev
```

Setup runs `npm ci` for the root and client, installing exactly the committed lockfile versions. Browser installation is needed only for browser tests. Do not add external AI credentials or require the preserved server for normal play.

Node 24.22.2 ships with npm 11.19.1. To run the recorded npm version without changing a global installation, prefix a project command with `npm exec --yes --package=npm@11.21.2 --`, for example `npm exec --yes --package=npm@11.21.2 -- npm run setup`. The hosted checks select npm 11.21.2 explicitly.

## Make a focused change

Start from an issue or describe the player-facing problem in your change request. Keep changes small enough to review. Include screenshots or a short recording for visual changes, with desktop and a 360px-wide phone layout when affected.

Read [ARCHITECTURE.md](ARCHITECTURE.md) before changing rules, search, clocks, or saving. Read [CONTRIBUTING_BATTLES.md](CONTRIBUTING_BATTLES.md) before changing characters or choreography.

- Use the shared rules module for real moves, previews, computer search, imports, and replay. Presentation must never decide whether a move is legal.
- Keep saved animation identifiers stable. Save all variation choices needed to replay an encounter faithfully. Existing save files and pending teammate moves must continue to work.
- Test full, reduced, and disabled motion. Keyboard, tapping, board rotation, pause, and skipping must remain usable. Sounds must respect the sound and volume settings.
- Keep the board readable and the two-move planner prominent. Explain technical terms briefly in player-facing documentation.
- Preserve `server/`, `ai/`, `shared/`, and the old client scaffold. Propose legacy maintenance separately instead of making it a requirement for the local game.
- Use original or appropriately licensed artwork and audio. Keep required attribution and license notices with any bundled asset. The project license is [ISC](LICENSE); the bundled font licenses remain in `client/public/fonts/`.

## Check the result

Run the focused checks relevant to your change, then the complete verification before requesting review:

```sh
npm run lint
npm test
npm run test:e2e
npm run test:packaged
# Or run all four:
npm run check
```

`test:e2e` starts a development server on port 5173 if needed and reuses your existing local server. Automation starts a fresh server and uses one browser worker. Each test gets an isolated browser context, so it does not alter your own saved games.

`test:packaged` first builds `client/dist`, then starts a separate preview server on port 4173. Keep that port free. Its tests interact with the released interface, exported save files, and built computer-player worker; they must not import `/src/` modules or depend on the development server. The test-owned preview server shuts down afterward.

Failure screenshots and traces are in `client/test-results/`; HTML reports are in `client/playwright-report/`. Do not commit those generated folders. Only update durable screenshots in `docs/screenshots/` when they help explain an intentional interface change.

The hosted checks install with `npm ci`, run the same verification, and retain browser failure details. They upload a verified browser bundle and a source snapshot for review. Publishing a release or hosting a demo is a separate maintainer action.

## Dependencies and releases

Commit each changed package manifest together with its lockfile. npm install-script approvals are pinned in the client manifest for its build dependencies; review any newly required script or version before updating that approval. Weekly grouped dependency suggestions cover the active root/client packages and GitHub Actions. Review major upgrades separately and explain any new runtime dependency. Keep the legacy packages available without silently including them in the playable bundle.

Before a release, run `npm run check`, verify a previous exported save still imports, and review motion/sound and a phone-sized board. Include the version, player-facing changes, known limitations, and any save-format change in the release notes. The build emits `THIRD_PARTY_LICENSES.md` for bundled dependencies; keep it, the project `LICENSE`, and the font notices in the release. The built files need an HTTP server; opening `index.html` directly is not supported. Serve the bundle at the site root unless its asset paths have been configured and tested for another location. Public hosting, accounts, and online multiplayer are not part of the local release.

## Tool references

The setup follows the official [Node 24.22.2 release information](https://nodejs.org/en/download/archive/v24.22.2), [npm clean-install behavior](https://docs.npmjs.com/cli/v11/commands/npm-ci/), and [npm install-script approvals](https://docs.npmjs.com/cli/v11/commands/npm-install-scripts/). Browser automation follows Playwright's [server management](https://playwright.dev/docs/test-webserver) and [continuous integration guidance](https://playwright.dev/docs/ci). Hosted checks use GitHub's [Node workflow guidance](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs) and [Dependabot configuration](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference). Bundled dependency notices use Vite's [build license output](https://vite.dev/config/build-options.html#build-license).

Definitions: Node.js = the program running development tools; npm = the package installer; lockfile = the recorded exact package versions; module = a related group of program functions; choreography = the sequence of battle movements; worker = a background browser task; context = an isolated browser session; trace = a recorded test run for debugging; bundle = built browser files; HTTP server = a program serving those files through a local or hosted web address; continuous integration = automatically checking submitted changes.
