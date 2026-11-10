import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { createMatch } from '../src/game/controller.js';
import { applyMove, createPosition } from '../src/game/rules.js';
import { battleDetails, BATTLE_VARIANTS } from '../src/game/battles.js';
import { exportMatch } from '../src/game/storage.js';

const runtimeErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    if (!localStorage.getItem('squadchess.preferences.v1')) {
      localStorage.setItem('squadchess.preferences.v1', JSON.stringify({ motion: 'off', sound: false, volume: 0.35 }));
    }
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page), 'No browser errors should occur during real play').toEqual([]);
});

const square = (page, name) => page.locator(`.arena-screen [data-square="${name}"]`);

async function savedMatch(page) {
  return page.evaluate(async () => {
    const storage = await import('/src/game/storage.js');
    return storage.getSavedMatch();
  });
}

async function start(page, { black = false, clock = 'untimed' } = {}) {
  if (black) await page.getByRole('button', { name: 'Black', exact: true }).click();
  await page.getByRole('group', { name: 'Your teammate', exact: true }).getByRole('button', { name: 'easy', exact: true }).click();
  await page.getByRole('combobox', { name: 'Time control', exact: true }).selectOption(clock);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Squad match' })).toBeVisible();
}

async function propose(page, from, to, touch = false) {
  if (touch) { await square(page, from).tap(); await square(page, to).tap(); }
  else { await square(page, from).click(); await square(page, to).click(); }
  await expect(page.getByRole('button', { name: 'Play team turn', exact: true })).toBeEnabled();
}

async function finishOpeningCycle(page) {
  await page.getByRole('button', { name: 'Play team turn', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make the first move.' })).toBeVisible();
  await expect.poll(async () => (await savedMatch(page))?.events.length).toBe(4);
}

function fixture({ fen, moves = [], finished = false, humanColor = 'w' } = {}) {
  const match = createMatch({ humanColor, teammateDifficulty: 'easy', opponentDifficulty: 'easy' });
  match.initialPosition = createPosition(fen);
  match.position = match.initialPosition;
  for (const payload of moves) {
    const { position, move } = applyMove(match.position, payload);
    const event = {
      ...move, id: `${match.id}:move-${match.events.length}`, index: match.events.length,
      humanColor, positionAfter: position, clocksBefore: { ...match.clocks },
      ...(move.captured ? battleDetails(move, match.events, humanColor, 747 + match.events.length) : {}),
    };
    match.events.push(event);
    match.position = position;
  }
  match.revision = match.events.length;
  if (finished && !match.position.result) match.position = { ...match.position, result: { winner: humanColor === 'w' ? 'b' : 'w', reason: 'resignation' } };
  match.phase = match.position.result ? 'finished' : 'paused';
  return match;
}

async function installFixture(page, match) {
  await page.evaluate(async game => {
    const { saveMatch } = await import('/src/game/storage.js');
    await saveMatch(game);
  }, match);
  await page.reload();
  await page.getByRole('button', { name: 'Continue match', exact: true }).click();
}

test('home explains the unique rules and starts a usable local match', async ({ page }, info) => {
  await expect(page.getByRole('heading', { name: 'Play Squad Chess', exact: true })).toBeVisible();
  await expect(page.locator('.home-showcase [data-square]')).toHaveCount(64);
  const pieceSize = await page.locator('.home-showcase [data-square="e2"]').evaluate(element => {
    const square = element.getBoundingClientRect();
    const piece = element.querySelector('.board-character > .piece-art').getBoundingClientRect();
    return { squareWidth: square.width, squareHeight: square.height, pieceWidth: piece.width, pieceHeight: piece.height };
  });
  expect(pieceSize.pieceWidth).toBeCloseTo(pieceSize.squareWidth, 1);
  expect(pieceSize.pieceHeight).toBeCloseTo(pieceSize.squareHeight, 1);
  expect(pieceSize.pieceWidth).toBeCloseTo(pieceSize.pieceHeight, 1);
  await page.screenshot({ path: info.outputPath('home-desktop.png'), fullPage: true });
  await start(page);
  await expect(page.getByRole('heading', { name: 'Make the first move.' })).toBeVisible();
  await expect(page.locator('.arena-screen [data-square]')).toHaveCount(64);
  await expect(page.locator('.move-log-row')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('arena-desktop.png'), fullPage: true });
});

test('mouse planning promises the teammate move and executes both teams in order', async ({ page }) => {
  await start(page);
  await propose(page, 'e2', 'e4');
  const planned = await savedMatch(page);
  expect(planned.events).toHaveLength(0);
  expect(planned.preview.first).toMatchObject({ from: 'e2', to: 'e4' });
  const promised = planned.preview.second;
  await finishOpeningCycle(page);
  const played = await savedMatch(page);
  expect(played.events.map(event => event.seat)).toEqual(['w1', 'w2', 'b1', 'b2']);
  expect(played.events[1]).toMatchObject(promised);
  await page.getByRole('button', { name: 'Undo your last team turn' }).click();
  await expect(page.locator('.move-log-row')).toHaveCount(0);
  expect((await savedMatch(page)).assisted.undos).toBe(1);
});

test('dragging and keyboard controls both create and cancel a plan', async ({ page }) => {
  await start(page);
  const from = await square(page, 'e2').boundingBox();
  const to = await square(page, 'e4').boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Play team turn', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Change my move' }).click();
  const board = page.getByRole('group', { name: /^Chessboard/ });
  await board.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Play team turn', exact: true })).toBeEnabled();
  expect((await savedMatch(page)).preview.first).toMatchObject({ from: 'e2', to: 'e4' });
  await board.focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Make the first move.' })).toBeVisible();
});

test('choosing Black lets the rival White squad take its opening pair', async ({ page }) => {
  await start(page, { black: true });
  await expect(page.getByRole('heading', { name: 'Make the first move.' })).toBeVisible();
  const game = await savedMatch(page);
  expect(game.config.humanColor).toBe('b');
  expect(game.events.map(event => event.seat)).toEqual(['w1', 'w2']);
  expect(game.position.team).toBe('b');
  await expect(square(page, 'e7').locator('[data-piece="bP"]')).toBeVisible();
});

test('balanced opening skips White’s teammate only for the first team turn', async ({ page }) => {
  await page.getByRole('checkbox', { name: 'Balanced opening', exact: true }).check();
  await start(page);
  await propose(page, 'e2', 'e4');
  const planned = await savedMatch(page);
  expect(planned.settings).toMatchObject({ balancedOpening: true, fullTwoMoveOpening: false });
  expect(planned.preview.second).toBeNull();
  await page.getByRole('button', { name: 'Play team turn', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make the first move.' })).toBeVisible();
  await expect.poll(async () => (await savedMatch(page))?.events.length).toBe(3);
  const game = await savedMatch(page);
  expect(game.events.map(event => event.seat)).toEqual(['w1', 'b1', 'b2']);
  expect(game.position.openingPending).toBe(false);
  await propose(page, 'g1', 'f3');
  expect((await savedMatch(page)).preview.second).not.toBeNull();
  await page.reload();
  await page.getByRole('button', { name: 'Continue match', exact: true }).click();
  await page.getByRole('button', { name: 'Return to battle' }).click();
  const restored = await savedMatch(page);
  expect(restored.settings.balancedOpening).toBe(true);
  expect(restored.preview.second).not.toBeNull();
});

test('balanced opening also limits the computer White squad when playing Black', async ({ page }) => {
  await page.getByRole('checkbox', { name: 'Balanced opening', exact: true }).check();
  await start(page, { black: true });
  await expect(page.getByRole('heading', { name: 'Make the first move.' })).toBeVisible();
  const game = await savedMatch(page);
  expect(game.settings.balancedOpening).toBe(true);
  expect(game.events.map(event => event.seat)).toEqual(['w1']);
  expect(game.position).toMatchObject({ team: 'b', slot: 0, openingPending: false });
});

test('pause freezes a timed match and resume preserves its turn', async ({ page }) => {
  await start(page, { clock: '5+3' });
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Match paused' })).toBeVisible();
  const before = await savedMatch(page);
  await page.waitForTimeout(450);
  const after = await savedMatch(page);
  expect(after.clocks).toEqual(before.clocks);
  expect(after.events).toHaveLength(0);
  await page.getByRole('button', { name: 'Return to battle' }).click();
  await expect(page.getByRole('heading', { name: 'Make the first move.' })).toBeVisible();
  expect((await savedMatch(page)).position).toEqual(before.position);
});

test('reload preserves a proposed combination without applying it', async ({ page }) => {
  await start(page);
  await propose(page, 'e2', 'e4');
  const before = await savedMatch(page);
  await page.reload();
  await page.getByRole('button', { name: 'Continue match', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Match paused' })).toBeVisible();
  await page.getByRole('button', { name: 'Return to battle' }).click();
  await expect(page.getByRole('button', { name: 'Play team turn', exact: true })).toBeEnabled();
  const after = await savedMatch(page);
  expect(after.preview.first).toEqual(before.preview.first);
  expect(after.preview.second).toEqual(before.preview.second);
  expect(after.events).toHaveLength(0);
  await finishOpeningCycle(page);
  expect((await savedMatch(page)).events[1]).toMatchObject(before.preview.second);
});

test('resuming between allied moves uses the already-promised follow-up once', async ({ page }) => {
  const game = fixture({ moves: [{ from: 'e2', to: 'e4' }] });
  game.lockedMove = { from: 'd2', to: 'd4' };
  game.phase = 'animating';
  await installFixture(page, game);
  await expect(page.getByRole('heading', { name: 'Match paused' })).toBeVisible();
  await expect(page.getByTestId('battle-overlay')).toHaveCount(0);
  await page.getByRole('button', { name: 'Return to battle' }).click();
  await expect.poll(async () => (await savedMatch(page))?.events.length).toBe(4);
  const resumed = await savedMatch(page);
  expect(resumed.events[0]).toMatchObject({ from: 'e2', to: 'e4', seat: 'w1' });
  expect(resumed.events[1]).toMatchObject({ from: 'd2', to: 'd4', seat: 'w2' });
  expect(new Set(resumed.events.map(event => event.id)).size).toBe(4);
});

test('a checking first move explicitly ends the pair without a teammate move', async ({ page }) => {
  await installFixture(page, fixture({ fen: '4k3/8/8/8/8/8/7P/R3K3 w - - 0 1' }));
  await page.getByRole('button', { name: 'Return to battle' }).click();
  await propose(page, 'a1', 'a8');
  await expect(page.getByText('Check ends our turn. The opposing squad must answer immediately.')).toBeVisible();
  expect((await savedMatch(page)).preview.second).toBeNull();
  await page.getByRole('button', { name: 'Play team turn', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make the first move.' })).toBeVisible();
  const game = await savedMatch(page);
  expect(game.events[0]).toMatchObject({ seat: 'w1', givesCheck: true });
  expect(game.events[1].seat).toBe('b1');
  expect(game.events.some(event => event.seat === 'w2')).toBe(false);
});

test('capture-promotion offers all four pieces and keeps the selected knight', async ({ page }) => {
  await installFixture(page, fixture({ fen: '1r5k/P7/8/8/8/8/7p/4K3 w - - 0 1' }));
  await page.getByRole('button', { name: 'Return to battle' }).click();
  await square(page, 'a7').click();
  await square(page, 'b8').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Choose your promotion' })).toBeVisible();
  for (const name of ['Queen', 'Rook', 'Bishop', 'Knight']) await expect(dialog.getByRole('button', { name: new RegExp(`${name}$`) })).toBeVisible();
  await dialog.getByRole('button', { name: /Knight$/ }).click();
  await expect(page.getByRole('button', { name: 'Play team turn', exact: true })).toBeEnabled();
  expect((await savedMatch(page)).preview.first).toMatchObject({ from: 'a7', to: 'b8', promotion: 'n' });
  await expect(square(page, 'b8').locator('[data-piece="wN"]')).toBeVisible();
  await page.getByRole('button', { name: 'Play team turn', exact: true }).click();
  await expect.poll(async () => (await savedMatch(page))?.events[0]?.promotion).toBe('n');
});

test('en passant battle removes the correct victim on a flipped board', async ({ page }, info) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog').getByRole('tab', { name: 'Animations', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'full', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await installFixture(page, fixture({ fen: '7k/8/8/3pP3/8/8/8/K7 w - d6 0 1' }));
  await page.getByRole('button', { name: 'Return to battle' }).click();
  await propose(page, 'e5', 'd6');
  await page.getByRole('button', { name: 'Flip board' }).click();
  await page.getByRole('button', { name: 'Play team turn', exact: true }).click();
  const battle = page.getByTestId('battle-overlay');
  await expect(battle).toHaveAttribute('data-capture-square', 'd5');
  await expect(battle).toHaveAttribute('data-attacker', 'p');
  await expect(battle.locator('.battle-victim')).toHaveCSS('left', /.+/);
  await expect(battle.locator('.battle-victim')).toHaveAttribute('style', /left: 56\.25%; top: 56\.25%/);
  await page.screenshot({ path: info.outputPath('en-passant-battle.png'), fullPage: true });
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(battle).toHaveCount(0);
  expect((await savedMatch(page)).events[0]).toMatchObject({ from: 'e5', to: 'd6', captureSquare: 'd5', captured: 'p' });
});

test('settings survive reload and the field guide explains the two-move rule', async ({ page }, info) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await page.screenshot({ path: info.outputPath('settings-desktop.png'), fullPage: true });
  await dialog.getByRole('tab', { name: 'Animations', exact: true }).click();
  await dialog.getByRole('button', { name: 'reduced', exact: true }).click();
  await dialog.getByRole('tab', { name: 'Board & pieces', exact: true }).click();
  await dialog.getByRole('button', { name: 'Walnut board', exact: true }).click();
  await dialog.getByRole('checkbox', { name: /Show coordinates/ }).uncheck();
  await dialog.getByRole('tab', { name: 'Sound', exact: true }).click();
  await dialog.getByLabel('Battle sounds').check();
  await dialog.getByLabel('Volume').focus();
  await page.keyboard.press('End');
  await dialog.getByRole('button', { name: 'Done' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await dialog.getByRole('tab', { name: 'Animations', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'reduced', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('tab', { name: 'Board & pieces', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Walnut board', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('checkbox', { name: /Show coordinates/ })).not.toBeChecked();
  await dialog.getByRole('tab', { name: 'Sound', exact: true }).click();
  await expect(dialog.getByLabel('Battle sounds')).toBeChecked();
  await expect(dialog.getByLabel('Volume')).toHaveValue('1');
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.home-showcase [data-square="a8"]')).toHaveCSS('background-color', 'rgb(240, 217, 181)');
  await expect(page.locator('.home-showcase [data-square="a8"]').getByText('8', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'How to Play', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Check changes the rhythm' })).toBeVisible();
  await expect(dialog.getByText(/Any move that gives check ends that team’s turn immediately/)).toBeVisible();
  await page.getByRole('button', { name: 'I’m ready' }).click();
});

test('damaged preferences show a recovery notice and use safe defaults', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('squadchess.preferences.v1', JSON.stringify({ motion: 'forever', boardTheme: 'missing', volume: 500, showCoordinates: 'maybe' })));
  await page.reload();
  await expect(page.locator('.notice')).toContainText('Your saved settings are damaged or invalid');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Animations', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'full', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('tab', { name: 'Board & pieces', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Green board', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('checkbox', { name: /Show coordinates/ })).toBeChecked();
  await dialog.getByRole('tab', { name: 'Animations', exact: true }).click();
  await dialog.getByRole('button', { name: 'off', exact: true }).click();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await page.reload();
  await expect(page.locator('.notice')).toHaveCount(0);
});

test('battle gallery exposes all 24 distinct attacks plus target and player variations', async ({ page }, info) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog').getByRole('tab', { name: 'Animations', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'full', exact: true }).click();
  await page.getByRole('button', { name: 'Explore the capture battles', exact: true }).click();
  const gallery = page.getByRole('region', { name: 'Battle atelier', exact: true });
  await expect(gallery.getByRole('heading', { name: 'Battle atelier', exact: true })).toBeVisible();
  const champions = { p: 'Sentinel, Pawn', n: 'Rider, Knight', b: 'Oracle, Bishop', r: 'Bastion, Rook', q: 'Empress, Queen', k: 'Sovereign, King' };
  const animations = new Set();
  for (const [type, label] of Object.entries(champions)) {
    await gallery.getByRole('button', { name: label, exact: true }).click();
    for (const [index, variant] of BATTLE_VARIANTS[type].entries()) {
      await gallery.locator('.battle-gallery-attacks button').nth(index).click();
      const overlay = gallery.getByTestId('battle-overlay');
      await expect(overlay).toHaveAttribute('data-variant', variant);
      await expect(overlay).toHaveAttribute('data-attacker', type);
      const animation = await overlay.locator('.battle-attacker').evaluate(element => getComputedStyle(element).animationName);
      expect(animation).toContain(`battle-${variant}`);
      animations.add(animation);
    }
  }
  expect(animations.size).toBe(24);
  const victimNames = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen' };
  for (const [type, name] of Object.entries(victimNames)) {
    await gallery.getByRole('group', { name: 'The opposing piece', exact: true }).getByRole('button', { name, exact: true }).click();
    await expect(gallery.getByTestId('battle-overlay')).toHaveAttribute('data-victim', type);
  }
  const accents = new Set();
  for (const name of ['You', 'Lyra', 'Vex', 'Mordren']) {
    await gallery.getByRole('group', { name: 'Whose move?', exact: true }).getByRole('button', { name: new RegExp(`^${name}`) }).click();
    accents.add(await gallery.getByTestId('battle-overlay').evaluate(element => element.style.getPropertyValue('--battle-accent')));
  }
  expect(accents.size).toBe(4);
  await gallery.getByRole('button', { name: /Squad combination/ }).click();
  await expect(gallery.getByTestId('battle-overlay')).toHaveClass(/battle-combo/);
  // Capture the moving artwork during the strike rather than its first frame.
  await page.waitForTimeout(450);
  await page.screenshot({ path: info.outputPath('battle-gallery.png'), fullPage: true });
  await gallery.getByRole('button', { name: 'Close battle atelier', exact: true }).click();
  await expect(gallery).toHaveCount(0);
});

test('corrupt imports leave the saved battle intact and valid imports create a copy', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  const original = await savedMatch(page);
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await page.getByLabel('Import SquadChess game').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
  await expect(page.locator('.notice')).toContainText('This save cannot be opened');
  expect((await savedMatch(page)).id).toBe(original.id);
  await expect(page.locator('.history-card')).toHaveCount(1);
  await page.getByLabel('Import SquadChess game').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(exportMatch(original)) });
  await expect(page.locator('.notice')).toContainText('Game imported');
  await expect(page.getByRole('heading', { name: 'Match paused' })).toBeVisible();
  expect((await savedMatch(page)).id).not.toBe(original.id);
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await expect(page.locator('.history-card')).toHaveCount(2);
});

test('a finished battle has a complete replay and portable export', async ({ page }) => {
  await start(page);
  await propose(page, 'e2', 'e4');
  await finishOpeningCycle(page);
  await page.getByRole('button', { name: 'Resign', exact: true }).click();
  await page.getByRole('button', { name: 'Resign match', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A battle to learn from.' })).toBeVisible();
  await page.getByRole('button', { name: 'Watch the replay' }).click();
  await expect(page.getByText('Move 0 of 4', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next move', exact: true }).click();
  await expect(page.getByText('Move 1 of 4', { exact: true })).toBeVisible();
  await expect(square(page, 'e4').locator('[data-piece="wP"]')).toBeVisible();
  await page.getByRole('button', { name: 'Last move', exact: true }).click();
  await expect(page.getByText('Move 4 of 4', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'First move', exact: true }).click();
  await page.getByRole('button', { name: 'Play replay', exact: true }).click();
  await expect(page.getByText('Move 4 of 4', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save a portable copy' }).click();
  expect((await download).suggestedFilename()).toMatch(/^squadchess-.*\.json$/);
});

test('castling visibly moves the king and rook together without stationary duplicates', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog').getByRole('tab', { name: 'Animations', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'full', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await installFixture(page, fixture({ fen: '4k3/7p/8/8/8/8/7P/R3K2R w KQ - 0 1' }));
  await page.getByRole('button', { name: 'Return to battle' }).click();
  await propose(page, 'e1', 'g1');
  await page.getByRole('button', { name: 'Play team turn', exact: true }).click();
  await expect(page.getByTestId('movement-overlay')).toHaveAttribute('data-role', 'k');
  const traveling = await page.evaluate(() => {
    const movement = document.querySelector('[data-testid="movement-overlay"]');
    const companion = movement.querySelector('.movement-companion');
    return {
      actors: movement.querySelectorAll('.movement-unit').length,
      mainMotion: getComputedStyle(movement.querySelector('.movement-unit:not(.movement-companion)')).animationName,
      rookMotion: getComputedStyle(companion).animationName,
      rookFrom: companion.dataset.from, rookTo: companion.dataset.to,
      special: document.querySelector('[data-testid="special-move-overlay"]').dataset.specialMove,
      hiddenSquares: ['e1', 'g1', 'h1', 'f1'].map(name => document.querySelector(`.arena-screen [data-square="${name}"] > div`).style.opacity),
    };
  });
  expect(traveling).toMatchObject({ actors: 2, rookFrom: 'h1', rookTo: 'f1', special: 'castle', hiddenSquares: ['0', '0', '0', '0'] });
  expect(traveling.mainMotion).toMatch(/movement-lifetime, movement-king-/);
  expect(traveling.rookMotion).toMatch(/movement-lifetime, movement-rook-/);
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await expect(page.getByTestId('movement-overlay')).toHaveCount(0);
  await expect(square(page, 'g1').locator('[data-piece="wK"]')).toBeVisible();
  await expect(square(page, 'f1').locator('[data-piece="wR"]')).toBeVisible();
  await expect(square(page, 'h1').locator('[data-piece]')).toHaveCount(0);
  expect((await savedMatch(page)).events[0]).toMatchObject({ from: 'e1', to: 'g1', castle: 'kingside' });
});

test('quiet promotion has one traveling pawn before the chosen piece appears', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog').getByRole('tab', { name: 'Animations', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'full', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await installFixture(page, fixture({ fen: '7k/P7/8/8/8/8/7p/4K3 w - - 0 1' }));
  await page.getByRole('button', { name: 'Return to battle' }).click();
  await square(page, 'a7').click();
  await square(page, 'a8').click();
  await page.getByRole('dialog').getByRole('button', { name: /Knight$/ }).click();
  await expect(page.getByRole('button', { name: 'Play team turn', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Play team turn', exact: true }).click();
  await expect(page.getByTestId('movement-overlay')).toHaveAttribute('data-role', 'p');
  const promotion = await page.evaluate(() => {
    const movement = document.querySelector('[data-testid="movement-overlay"]');
    const special = document.querySelector('[data-testid="special-move-overlay"]');
    return {
      actors: movement.querySelectorAll('.movement-unit').length,
      movement: getComputedStyle(movement.querySelector('.movement-unit')).animationName,
      kind: special.dataset.specialMove,
      extraPawns: special.querySelectorAll('.special-move-pawn').length,
      promoted: special.querySelectorAll('.special-move-promoted').length,
      hiddenSquares: ['a7', 'a8'].map(name => document.querySelector(`.arena-screen [data-square="${name}"] > div`).style.opacity),
    };
  });
  expect(promotion).toMatchObject({ actors: 1, kind: 'promotion', extraPawns: 0, promoted: 1, hiddenSquares: ['0', '0'] });
  expect(promotion.movement).toMatch(/movement-promotion-lifetime, movement-pawn-/);
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await expect(page.getByTestId('special-move-overlay')).toHaveCount(0);
  await expect(square(page, 'a8').locator('[data-piece="wN"]')).toBeVisible();
  await expect(square(page, 'a7').locator('[data-piece]')).toHaveCount(0);
  expect((await savedMatch(page)).events[0]).toMatchObject({ from: 'a7', to: 'a8', piece: 'p', promotion: 'n' });
});

test('played movement choices survive portable export, import, and animated replay', async ({ page }) => {
  await start(page);
  await propose(page, 'g1', 'f3');
  await finishOpeningCycle(page);
  const original = await savedMatch(page);
  const first = original.events[0];
  expect(first.movementVariant).toEqual(expect.any(String));
  await page.getByRole('button', { name: 'Resign', exact: true }).click();
  await page.getByRole('button', { name: 'Resign match', exact: true }).click();
  const downloadReady = page.waitForEvent('download');
  await page.getByRole('tab', { name: /^Moves/ }).click();
  await page.getByRole('button', { name: 'Save a portable copy' }).click();
  const download = await downloadReady;
  const exported = await readFile(await download.path());
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await page.getByLabel('Import SquadChess game').setInputFiles({ name: 'played-game.json', mimeType: 'application/json', buffer: exported });
  await expect(page.locator('.notice')).toContainText('Game imported');
  const imported = await savedMatch(page);
  expect(imported.id).not.toBe(original.id);
  expect(imported.events[0]).toMatchObject({ movementVariant: first.movementVariant, seed: first.seed, duration: first.duration, accent: first.accent });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog').getByRole('tab', { name: 'Animations', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'full', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Watch the replay' }).click();
  await page.getByRole('button', { name: 'Play replay', exact: true }).click();
  await expect(page.getByTestId('movement-overlay')).toHaveAttribute('data-movement', first.movementVariant);
  await expect(page.getByTestId('movement-overlay')).toHaveAttribute('data-role', 'n');
  await page.getByRole('button', { name: 'Pause replay', exact: true }).click();
});

test('opening Settings or leaving replay stops automatic progression', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog').getByRole('tab', { name: 'Animations', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'full', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  const game = fixture({ moves: [{ from: 'e2', to: 'e4' }, { from: 'd2', to: 'd4' }, { from: 'e7', to: 'e5' }, { from: 'd7', to: 'd5' }], finished: true });
  await installFixture(page, game);
  await page.getByRole('button', { name: 'Watch the replay' }).click();
  await page.getByRole('button', { name: 'Play replay', exact: true }).click();
  await expect(page.getByTestId('movement-overlay')).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByTestId('movement-overlay')).toHaveCount(0);
  const move = await page.getByRole('slider', { name: 'Replay move', exact: true }).inputValue();
  // Wait longer than a complete ordinary movement and the next replay interval.
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Replay move', exact: true })).toHaveValue(move);
  await expect(page.getByRole('button', { name: 'Play replay', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Play replay', exact: true }).click();
  await expect(page.getByTestId('movement-overlay')).toBeVisible();
  await page.getByRole('button', { name: 'Play home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Play Squad Chess', exact: true })).toBeVisible();
  await page.waitForTimeout(1100);
  await expect(page.getByTestId('movement-overlay')).toHaveCount(0);
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await page.getByRole('button', { name: 'Watch replay', exact: true }).click();
  await expect(page.getByText('Move 0 of 4', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play replay', exact: true })).toBeVisible();
});

test('a legacy capture without saved duration plays fully once in replay', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog').getByRole('tab', { name: 'Animations', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'full', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  const game = fixture({ fen: '7k/8/8/3p4/2P5/8/8/K7 w - - 0 1', moves: [{ from: 'c4', to: 'd5' }], finished: true });
  delete game.events[0].duration;
  await installFixture(page, game);
  await page.getByRole('button', { name: 'Watch the replay' }).click();
  await page.getByRole('button', { name: 'Next move', exact: true }).click();
  const battle = page.getByTestId('battle-overlay');
  await expect(battle).toHaveAttribute('data-variant', game.events[0].variant);
  // A legacy save still receives a complete staged battle, not a single frame.
  await page.waitForTimeout(650);
  await expect(battle).toBeVisible();
  await expect(battle).toHaveCount(0);
  await expect(page.getByText('Move 1 of 1', { exact: true })).toBeVisible();
  await page.waitForTimeout(400);
  await expect(battle).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play replay', exact: true })).toBeVisible();
});

const captureCases = [
  { type: 'p', fen: '7k/8/8/3p4/2P5/8/8/K7 w - - 0 1', from: 'c4' },
  { type: 'n', fen: '7k/8/8/3p4/8/2N5/8/K7 w - - 0 1', from: 'c3' },
  { type: 'b', fen: '7k/8/8/3p4/2B5/8/8/K7 w - - 0 1', from: 'c4' },
  { type: 'r', fen: '7k/8/8/3p4/3R4/8/8/K7 w - - 0 1', from: 'd4' },
  { type: 'q', fen: '8/7k/8/3p4/3Q4/8/8/K7 w - - 0 1', from: 'd4' },
  { type: 'k', fen: '7k/8/8/3p4/3K4/8/8/8 w - - 0 1', from: 'd4' },
];

const movementCases = [
  { type: 'p', from: 'e2', to: 'e4' },
  { type: 'n', from: 'g1', to: 'f3' },
  { type: 'b', fen: '7k/7p/8/8/8/8/8/K1B5 w - - 0 1', from: 'c1', to: 'e3' },
  { type: 'r', fen: '7k/7p/8/8/8/8/8/RK6 w - - 0 1', from: 'a1', to: 'a4' },
  { type: 'q', fen: '7k/7p/8/8/8/8/8/K2Q4 w - - 0 1', from: 'd1', to: 'd3' },
  { type: 'k', fen: '7k/7p/8/8/8/8/P7/4K3 w - - 0 1', from: 'e1', to: 'e2' },
];

for (const { type, fen, from, to } of movementCases) {
  test(`ordinary ${type} moves use their own visible travel animation`, async ({ page }, info) => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('dialog').getByRole('tab', { name: 'Animations', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'full', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await installFixture(page, fixture({ fen }));
    await page.getByRole('button', { name: 'Return to battle' }).click();
    await propose(page, from, to);
    await page.getByRole('button', { name: 'Play team turn', exact: true }).click();
    const movement = page.getByTestId('movement-overlay');
    await expect(movement).toHaveAttribute('data-role', type);
    await expect(movement).toHaveAttribute('data-movement', /.+/);
    await expect(movement.locator('.movement-unit')).toHaveCSS('animation-name', /movement-lifetime, movement-.+/);
    if (type === 'n') await page.screenshot({ path: info.outputPath('knight-travel.png'), fullPage: true });
    const event = (await savedMatch(page)).events[0];
    expect(event).toMatchObject({ piece: type, from, to });
    expect(event.captured).toBeUndefined();
    expect(event.movementVariant).toEqual(expect.any(String));
    await page.getByRole('button', { name: 'Pause game', exact: true }).click();
    await expect(page.getByTestId('movement-overlay')).toHaveCount(0);
  });
}

for (const { type, fen, from } of captureCases) {
  test(`replay renders a saved ${type} capture family and its original variation`, async ({ page }, info) => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('dialog').getByRole('tab', { name: 'Animations', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'full', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    const game = fixture({ fen, moves: [{ from, to: 'd5' }], finished: true });
    game.events[0].variant = BATTLE_VARIANTS[type][1];
    await installFixture(page, game);
    await page.getByRole('button', { name: 'Watch the replay' }).click();
    await page.getByRole('button', { name: 'Play replay', exact: true }).click();
    const battle = page.getByTestId('battle-overlay');
    await expect(battle).toHaveAttribute('data-variant', BATTLE_VARIANTS[type][1]);
    await expect(battle).toHaveAttribute('data-attacker', type);
    await expect(battle).toHaveAttribute('data-victim', 'p');
    await page.screenshot({ path: info.outputPath(`capture-${type}.png`), fullPage: true });
    await expect(battle).toHaveCount(0);
    await expect(page.getByText('Move 1 of 1', { exact: true })).toBeVisible();
  });
}

test.describe('narrow touch layout', () => {
  test.use({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });

  test('360px home and arena fit the screen and support tap-to-move', async ({ page }, info) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('home-mobile.png'), fullPage: true });
    await start(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await propose(page, 'e2', 'e4', true);
    await page.screenshot({ path: info.outputPath('plan-mobile.png'), fullPage: true });
    await finishOpeningCycle(page);
    expect((await savedMatch(page)).events.map(event => event.seat)).toEqual(['w1', 'w2', 'b1', 'b2']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
