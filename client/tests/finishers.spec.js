import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { createMatch } from '../src/game/controller.js';
import { applyMove, createPosition } from '../src/game/rules.js';
import { battleDetails } from '../src/game/battles.js';
import { exportMatch } from '../src/game/storage.js';

const errors = new WeakMap();
const roles = [
  ['Sentinel, Pawn', 'p', ['pawn-giants-fall', 'pawn-spearline']],
  ['Rider, Knight', 'n', ['knight-thunderhoof', 'knight-skybreaker']],
  ['Oracle, Bishop', 'b', ['bishop-astral-gate', 'bishop-runic-fault']],
  ['Bastion, Rook', 'r', ['rook-earthbreaker', 'rook-citadel-crush']],
  ['Empress, Queen', 'q', ['queen-gravity-crown', 'queen-starfall']],
  ['Sovereign, King', 'k', ['king-royal-judgment', 'king-crowns-wrath']],
];
const reactions = [
  ['Pawn', 'p', ['pawn-shield-break', 'pawn-launch', 'pawn-dissolve']],
  ['Knight', 'n', ['knight-unseat', 'knight-collapse', 'knight-scatter']],
  ['Bishop', 'b', ['bishop-unravel', 'bishop-shatter', 'bishop-vanish']],
  ['Rook', 'r', ['rook-fracture', 'rook-topple', 'rook-crumble']],
  ['Queen', 'q', ['queen-crownfall', 'queen-disperse', 'queen-collapse']],
];

test.beforeEach(async ({ page }) => {
  const messages = [];
  errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
  page.on('console', message => { if (message.type() === 'error') messages.push(message.text()); });
  await page.addInitScript(() => {
    if (!localStorage.getItem('squadchess.preferences.v1')) localStorage.setItem('squadchess.preferences.v1', JSON.stringify({ motion: 'full', sound: false, finishers: true, boardShake: true }));
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page), 'Capture playback must not produce browser errors').toEqual([]);
});

async function settings(page, values = {}) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Animations', exact: true }).click();
  if (values.motion) await dialog.getByRole('button', { name: values.motion, exact: true }).click();
  if (values.finishers !== undefined) await dialog.getByRole('checkbox', { name: /^Finishers/ }).setChecked(values.finishers);
  if (values.boardShake !== undefined) await dialog.getByRole('checkbox', { name: /^Board shake/ }).setChecked(values.boardShake);
  return dialog;
}
async function openGallery(page) {
  const dialog = await settings(page, { motion: 'full' });
  await dialog.getByRole('button', { name: 'Explore the capture battles', exact: true }).click();
  return page.getByRole('region', { name: 'Battle atelier', exact: true });
}
async function savedMatch(page) {
  return page.evaluate(async () => (await import('/src/game/storage.js')).getSavedMatch());
}
function fixture({ fen = '7k/8/8/3qp3/4PP2/8/8/K7 w - - 0 1', moves = [], humanColor = 'w', finished = false, planned = false } = {}) {
  const match = createMatch({ humanColor, teammateDifficulty: 'easy', opponentDifficulty: 'easy' });
  match.initialPosition = createPosition(fen);
  match.position = match.initialPosition;
  for (let index = 0; index < moves.length; index++) {
    const applied = applyMove(match.position, moves[index]);
    const next = moves[index + 1] && applied.position.team === match.position.team && applied.position.slot === 1
      ? applyMove(applied.position, moves[index + 1]).move : null;
    match.events.push({ ...applied.move, id: `${match.id}:${index}`, index, positionAfter: applied.position, clocksBefore: { ...match.clocks }, humanColor,
      ...(applied.move.captured ? battleDetails(applied.move, match.events, humanColor, 909 + index, { deferFinisher: Boolean(next?.captured), result: applied.position.result }) : {}),
    });
    match.position = applied.position;
  }
  if (planned) {
    const first = { from: 'e4', to: 'd5' }, second = { from: 'f4', to: 'e5' };
    const afterFirst = applyMove(match.position, first).position;
    match.preview = { status: 'ready', first, second, afterFirst, afterSecond: applyMove(afterFirst, second).position, explanation: 'Both allied captures are confirmed.' };
  }
  if (finished && !match.position.result) match.position = { ...match.position, result: { winner: humanColor === 'w' ? 'b' : 'w', reason: 'resignation' } };
  match.revision = match.events.length;
  match.phase = match.position.result ? 'finished' : 'paused';
  return match;
}
const pair = [{ from: 'e4', to: 'd5' }, { from: 'f4', to: 'e5' }];
async function importGame(page, match) {
  await page.getByLabel('Import SquadChess game').setInputFiles({ name: 'capture-study.json', mimeType: 'application/json', buffer: Buffer.from(exportMatch(match)) });
  await expect(page.locator('.notice')).toContainText('Game imported');
  await expect(page.getByRole('heading', { name: 'Squad match', exact: true })).toBeVisible();
}
async function replayGame(page, match) {
  await importGame(page, match);
  await page.getByRole('button', { name: 'Watch the replay', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Match replay', exact: true })).toBeVisible();
}
async function noEffects(page) {
  await expect(page.getByTestId('finisher-effects')).toHaveCount(0);
  await expect(page.getByTestId('battle-overlay')).toHaveCount(0);
  await expect(page.getByTestId('battle-ally-echo')).toHaveCount(0);
  expect(await page.locator('.arena-screen .board-scene').evaluateAll(elements => elements.flatMap(element => element.getAnimations()).length)).toBe(0);
}

for (const [label, piece, finishes] of roles) {
  test(`${label}: both legendary finishes render, strike, settle, and remove their effects`, async ({ page }) => {
    const gallery = await openGallery(page);
    await gallery.getByRole('button', { name: 'Finishers', exact: true }).click();
    await gallery.getByRole('button', { name: label, exact: true }).click();
    const shapes = new Set();
    for (const id of finishes) {
      await gallery.locator(`[data-finisher-choice="${id}"]`).click();
      const battle = gallery.getByTestId('battle-overlay');
      await expect(battle).toHaveAttribute('data-finisher', id);
      await expect(battle).toHaveAttribute('data-attacker', piece);
      await expect(battle.locator('.battle-attacker')).toHaveCount(1);
      await expect(battle.locator('.battle-victim')).toHaveCount(1);
      const effects = gallery.getByTestId('finisher-effects');
      await expect(effects.locator(`[data-environment="${id}"]`)).toBeVisible();
      const painted = await effects.evaluate(element => ({
        shapes: element.querySelector('.finisher-environment').innerHTML,
        paths: element.querySelectorAll('path,circle,ellipse,polygon,rect,line').length,
        animations: element.getAnimations({ subtree: true }).length,
      }));
      expect(painted.paths).toBeGreaterThan(10);
      expect(painted.animations).toBeGreaterThan(0);
      shapes.add(painted.shapes);
      await expect(battle).toHaveAttribute('data-phase', 'settle');
      await expect(battle).toHaveCount(0);
      await expect(effects).toHaveCount(0);
      await expect(gallery.locator('.battle-gallery-resting-piece')).toHaveCount(1);
      expect(await gallery.locator('.board-scene').evaluate(element => element.getAnimations().length)).toBe(0);
    }
    expect(shapes.size, 'Each selected finish needs different environmental artwork').toBe(2);
  });
}

test('all 15 victim reactions have a staged defeat and restore the finished board', async ({ page }) => {
  test.setTimeout(60000);
  const gallery = await openGallery(page);
  await gallery.getByRole('button', { name: 'Defeat reactions', exact: true }).click();
  for (const [name, piece, ids] of reactions) {
    await gallery.getByRole('group', { name: 'The opposing piece', exact: true }).getByRole('button', { name, exact: true }).click();
    for (const id of ids) {
      await gallery.locator(`[data-reaction-choice="${id}"]`).click();
      const battle = gallery.getByTestId('battle-overlay');
      await expect(battle).toHaveAttribute('data-victim', piece);
      await expect(battle).toHaveAttribute('data-reaction', id);
      await expect(gallery.getByTestId('finisher-effects')).toHaveCount(0);
      const reaction = await battle.locator('.battle-victim').evaluate(element => {
        const style = getComputedStyle(element);
        return { name: style.animationName, delay: parseFloat(style.animationDelay), frames: element.getAnimations().flatMap(animation => animation.effect.getKeyframes()).length };
      });
      expect(reaction.name).toBe(id);
      expect(reaction.delay, 'The defender remains before the contact').toBeGreaterThan(0);
      expect(reaction.frames).toBeGreaterThan(2);
      await expect(battle).toHaveCount(0);
      await expect(gallery.locator('.battle-gallery-resting-piece')).toHaveCount(1);
    }
  }
});

test('both armies preserve all four player accents and show a distinct allied echo', async ({ page }) => {
  const gallery = await openGallery(page);
  await gallery.getByRole('button', { name: 'Finishers', exact: true }).click();
  for (const army of ['White army', 'Black army']) {
    await gallery.getByRole('button', { name: army, exact: true }).click();
    for (const [actor, accent] of [['You', '#f5c76e'], ['Lyra', '#67dfc7'], ['Vex', '#fb7e8b'], ['Mordren', '#bd9bff']]) {
      await gallery.getByRole('group', { name: 'Whose move?', exact: true }).getByRole('button', { name: new RegExp(`^${actor}`) }).click();
      const battle = gallery.getByTestId('battle-overlay');
      await expect(battle).toHaveCount(1);
      expect(await battle.evaluate(element => element.style.getPropertyValue('--battle-accent'))).toBe(accent);
      const allied = actor === 'You' || actor === 'Lyra';
      const ivory = army === 'White army' ? allied : !allied;
      await expect(battle.locator('.battle-attacker > svg')).toHaveAttribute('aria-label', new RegExp(`^${ivory ? 'Ivory' : 'Obsidian'}`));
      expect(await gallery.locator('.board-scene').evaluate(element => element.getAnimations().length)).toBe(1);
    }
  }
  await gallery.getByRole('button', { name: /Squad combination/ }).click();
  await expect(gallery.getByTestId('battle-ally-echo')).toHaveCount(1);
  await expect(gallery.getByTestId('finisher-allied-echo')).toHaveCount(1);
  await expect(gallery.getByTestId('battle-ally-echo').locator('svg')).toHaveClass(/piece-art--b/);
  await gallery.getByRole('button', { name: 'Close battle atelier', exact: true }).click();
  await noEffects(page);
});

for (const humanColor of ['w', 'b']) {
  test(`${humanColor} corner promotion stays on a rotated board in portrait and landscape`, async ({ page }, info) => {
    const game = fixture(humanColor === 'w'
      ? { fen: 'r7/1P6/7k/8/8/8/8/K7 w - - 0 1', moves: [{ from: 'b7', to: 'a8', promotion: 'n' }], finished: true }
      : { fen: 'k7/8/8/8/8/7K/6p1/7R b - - 0 1', moves: [{ from: 'g2', to: 'h1', promotion: 'n' }], humanColor: 'b', finished: true });
    await replayGame(page, game);
    let flipped = false;
    for (const viewport of [{ width: 360, height: 800 }, { width: 800, height: 360 }]) {
      await page.setViewportSize(viewport);
      for (const requestedFlip of [false, true]) {
        await page.getByRole('button', { name: 'First move', exact: true }).click();
        if (flipped !== requestedFlip) { await page.getByRole('button', { name: 'Flip board', exact: true }).click(); flipped = requestedFlip; }
        await page.getByRole('button', { name: 'Next move', exact: true }).click();
        const battle = page.getByTestId('battle-overlay');
        await expect(battle).toHaveAttribute('data-promotes-to', 'n');
        await expect(battle).toHaveAttribute('data-capture-square', game.events[0].to);
        const box = await battle.evaluate(element => ({
          left: element.querySelector('.battle-victim').style.left,
          top: element.querySelector('.battle-victim').style.top,
          clipped: getComputedStyle(element).overflow,
          width: element.getBoundingClientRect().width,
          boardWidth: element.closest('.board-scene').getBoundingClientRect().width,
          hiddenSquare: element.closest('.board-scene').querySelector(`[data-square="${element.dataset.captureSquare}"] > div`).style.opacity,
        }));
        expect(box.left).toBe(flipped ? '93.75%' : '6.25%');
        expect(box.top).toBe(flipped ? '93.75%' : '6.25%');
        expect(box.clipped).toBe('hidden');
        expect(box.width).toBeCloseTo(box.boardWidth, 1);
        expect(box.hiddenSquare).toBe('0');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
        await expect(battle).toHaveAttribute('data-phase', 'settle');
        await page.screenshot({ path: info.outputPath(`corner-${humanColor}-${viewport.width}-${flipped}.png`) });
        await page.getByRole('button', { name: 'Skip', exact: true }).click();
        await noEffects(page);
      }
    }
    expect((await savedMatch(page)).events[0].finisher).toEqual(game.events[0].finisher);
  });
}

test('finishers, board shake, reduced motion, and motion off honor settings without rewriting saves', async ({ page }) => {
  await replayGame(page, fixture({ moves: pair, finished: true }));
  const saved = await savedMatch(page);
  const event = saved.events[1];
  const showFinish = async () => {
    await page.getByRole('button', { name: 'First move', exact: true }).click();
    await page.getByRole('button', { name: 'Next move', exact: true }).click();
    await page.getByRole('button', { name: 'Next move', exact: true }).click();
  };
  await showFinish();
  await expect(page.getByTestId('finisher-effects')).toHaveCount(1);
  expect(await page.locator('.arena-screen .board-scene').evaluate(element => element.getAnimations().length)).toBe(1);
  let dialog = await settings(page, { boardShake: false });
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await showFinish();
  await expect(page.getByTestId('finisher-effects')).toHaveCount(1);
  expect(await page.locator('.arena-screen .board-scene').evaluate(element => element.getAnimations().length)).toBe(0);
  dialog = await settings(page, { finishers: false });
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await showFinish();
  const battle = page.getByTestId('battle-overlay');
  await expect(battle).toHaveAttribute('data-variant', event.variant);
  await expect(battle).toHaveAttribute('data-reaction', event.reactionVariant);
  await expect(page.getByTestId('finisher-effects')).toHaveCount(0);
  expect(await battle.evaluate(element => parseFloat(element.style.getPropertyValue('--battle-duration')))).toBe(event.finisher.baseDuration);
  dialog = await settings(page, { motion: 'reduced', finishers: true });
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await showFinish();
  await expect(battle).toHaveClass(/battle-motion-reduced/);
  await expect(page.getByTestId('finisher-effects')).toHaveCount(0);
  await noEffects(page);
  dialog = await settings(page, { motion: 'off' });
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await showFinish();
  await expect(page.getByText('Move 2 of 2', { exact: true })).toBeVisible();
  await noEffects(page);
  expect((await savedMatch(page)).events).toEqual(saved.events);
});

test('a live capture pair survives skip, pause, refresh, and undo without duplicate moves', async ({ page }) => {
  await importGame(page, fixture({ planned: true }));
  await page.getByRole('button', { name: 'Return to battle', exact: true }).click();
  await page.getByRole('button', { name: 'Play team turn', exact: true }).click();
  await expect(page.getByTestId('battle-overlay')).toHaveAttribute('data-capture-square', 'd5');
  await expect(page.getByTestId('finisher-effects')).toHaveCount(0);
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(page.getByTestId('battle-overlay')).toHaveAttribute('data-capture-square', 'e5');
  await expect(page.getByTestId('finisher-effects')).toHaveCount(1);
  await expect(page.getByTestId('battle-ally-echo')).toHaveCount(1);
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await noEffects(page);
  const saved = await savedMatch(page);
  expect(saved.events.map(event => [event.from, event.to])).toEqual([['e4', 'd5'], ['f4', 'e5']]);
  expect(saved.events[0].finisher).toBeUndefined();
  expect(saved.events[1].finisher.echo).toMatchObject({ from: 'e4', to: 'd5', piece: 'p', seat: 'w1' });
  await page.reload();
  await page.getByRole('button', { name: 'Continue match', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Match paused' })).toBeVisible();
  await noEffects(page);
  expect((await savedMatch(page)).events).toEqual(saved.events);
  await page.getByRole('button', { name: 'Undo your last team turn' }).click();
  await expect.poll(async () => (await savedMatch(page)).events.length).toBe(0);
  await noEffects(page);
  const undone = await savedMatch(page);
  expect(undone.position).toEqual(undone.initialPosition);
  expect(undone.lockedMove).toBeNull();
  expect(undone.assisted.undos).toBe(1);
});

test('imported finishes replay identical choices and stop cleanly when paused or left', async ({ page }) => {
  const game = fixture({ moves: pair, finished: true });
  await replayGame(page, game);
  const saved = await savedMatch(page);
  await page.getByRole('button', { name: 'Next move', exact: true }).click();
  await page.getByRole('button', { name: 'Next move', exact: true }).click();
  const battle = page.getByTestId('battle-overlay');
  await expect(battle).toHaveAttribute('data-finisher', game.events[1].finisher.id);
  await expect(battle).toHaveAttribute('data-reaction', game.events[1].reactionVariant);
  const artwork = await page.getByTestId('finisher-effects').locator('[data-debris]').evaluateAll(elements => elements.map(element => [element.getAttribute('d'), element.getAttribute('style')]));
  await expect(page.getByTestId('battle-ally-echo')).toHaveCount(1);
  await page.getByRole('button', { name: 'Play home', exact: true }).click();
  await noEffects(page);
  await importGame(page, saved);
  const imported = await savedMatch(page);
  expect(imported.id).not.toBe(saved.id);
  expect(imported.events).toEqual(saved.events);
  await page.getByRole('button', { name: 'Watch the replay', exact: true }).click();
  await page.getByRole('button', { name: 'Next move', exact: true }).click();
  await page.getByRole('button', { name: 'Next move', exact: true }).click();
  await expect(battle).toHaveAttribute('data-finisher', game.events[1].finisher.id);
  expect(await page.getByTestId('finisher-effects').locator('[data-debris]').evaluateAll(elements => elements.map(element => [element.getAttribute('d'), element.getAttribute('style')]))).toEqual(artwork);
  await page.getByRole('button', { name: 'First move', exact: true }).click();
  await page.getByRole('button', { name: 'Play replay', exact: true }).click();
  await expect(battle).toBeVisible();
  await page.getByRole('button', { name: 'Pause replay', exact: true }).click();
  await noEffects(page);
  const stopped = await page.getByRole('slider', { name: 'Replay move', exact: true }).inputValue();
  // Longer than a finisher plus the replay advance delay: stale completion cannot restart playback.
  await page.waitForTimeout(3200);
  await expect(page.getByRole('slider', { name: 'Replay move', exact: true })).toHaveValue(stopped);
  await noEffects(page);
  expect((await savedMatch(page)).events).toEqual(imported.events);
});
