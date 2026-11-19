import { test, expect } from '@playwright/test';
import { createMatch } from '../src/game/controller.js';
import { applyMove } from '../src/game/rules.js';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('squadchess.preferences.v1', JSON.stringify({ motion: 'off', sound: false, volume: .35 })));
  await page.goto('/');
});
async function start(page) {
  await page.getByRole('group', { name: 'Your teammate', exact: true }).getByRole('button', { name: 'easy', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
}
async function plan(page) {
  await page.locator('.arena-screen [data-square="e2"]').click();
  await page.locator('.arena-screen [data-square="e4"]').click();
  await expect(page.getByRole('button', { name: 'Play team turn', exact: true })).toBeEnabled();
}
async function saved(page) { return page.evaluate(async () => (await import('/src/game/storage.js')).getSavedMatch()); }

test('keyboard board announces occupants, selection, and legal destinations in both orientations', async ({ page }) => {
  await start(page);
  const board = page.locator('.arena-screen .board-surface');
  const announcement = page.locator('.arena-screen .board-announcement');
  await board.focus();
  await expect(announcement).toHaveText('E2, White pawn. Press Enter to select.');
  await page.keyboard.press('Enter');
  await expect(announcement).toContainText('Selected. Legal destinations: E3, E4.');
  await page.keyboard.press('ArrowUp');
  await expect(announcement).toContainText('E3, empty. Legal destination for E2.');
  await page.getByRole('button', { name: 'Flip board', exact: true }).click();
  await board.focus(); await page.keyboard.press('ArrowDown');
  await expect(announcement).toContainText('E4, empty. Legal destination for E2.');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Play team turn', exact: true })).toBeEnabled();
  expect((await saved(page)).preview.first).toMatchObject({ from: 'e2', to: 'e4' });
});

test('pausing a plan shows the accepted position and resuming restores the exact proposal', async ({ page }) => {
  await start(page); await plan(page);
  const proposal = (await saved(page)).preview;
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Match paused', exact: true })).toBeVisible();
  await expect(page.locator('.preview-badge')).toHaveCount(0);
  await expect(page.locator('.arena-screen [data-square="e2"] [data-piece="wP"]')).toBeVisible();
  await expect(page.getByLabel('Active player', { exact: true })).toHaveCount(0);
  await expect(page.locator('.pause-panel')).toContainText('Resume to review your plan.');
  await page.getByRole('button', { name: 'Return to battle', exact: true }).click();
  await expect(page.locator('.preview-badge')).toBeVisible();
  await expect(page.locator('.arena-screen [data-square="e4"] [data-piece="wP"]')).toBeVisible();
  expect((await saved(page)).preview).toEqual(proposal);
});

test('Undo through the paused match controls does not restart a timed game', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Time control', exact: true }).selectOption('5+3');
  await start(page); await plan(page);
  await page.getByRole('button', { name: 'Play team turn', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make the first move.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await page.getByRole('button', { name: 'Undo your last team turn', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Match paused', exact: true })).toBeVisible();
  const before = await saved(page);
  await page.waitForTimeout(650);
  const after = await saved(page);
  expect(after.clocks).toEqual(before.clocks);
  expect(after.events).toHaveLength(0);
  expect(after.phase).toBe('paused');
  await expect(page.getByRole('button', { name: 'Resume game', exact: true })).toBeVisible();
});

test('archive replay returns to history, uses recorded clocks, and preserves the live plan', async ({ page }) => {
  const archived = createMatch({ opponentDifficulty: 'hard', timeControl: '5+3' });
  for (const [index, input] of [{ from: 'e2', to: 'e4' }, { from: 'e4', to: 'e5' }].entries()) {
    const { position, move } = applyMove(archived.position, input);
    archived.events.push({ ...move, id: `${archived.id}:${index}`, index, positionAfter: position, clocksBefore: { ...archived.clocks, w: index ? 293000 : 295000 } });
    archived.position = position;
  }
  archived.position = { ...archived.position, result: { winner: 'b', reason: 'resignation' } };
  archived.phase = 'finished'; archived.revision = 2;
  archived.clocks = { ...archived.clocks, w: 240000, b: 200000 };
  await page.evaluate(async game => (await import('/src/game/storage.js')).saveMatch(game), archived);
  await start(page); await plan(page);
  const current = await saved(page);
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await page.locator('.history-card').filter({ hasText: 'hard rivals' }).getByRole('button', { name: 'Watch replay', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Match replay', exact: true })).toBeVisible();
  const clock = page.getByLabel('Your squad recorded clock', { exact: true });
  await expect(clock).toHaveText('4:55');
  await page.getByRole('button', { name: 'Next move', exact: true }).click();
  await expect(clock).toHaveText('4:55');
  await page.getByRole('button', { name: 'Last move', exact: true }).click();
  await expect(clock).toHaveText('4:56');
  await page.getByRole('button', { name: 'Back to Match History', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Match History', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Play home', exact: true }).click();
  await page.getByRole('button', { name: 'Continue match', exact: true }).click();
  await page.getByRole('button', { name: 'Return to battle', exact: true }).click();
  const restored = await saved(page);
  expect(restored.id).toBe(current.id);
  expect(restored.preview).toEqual(current.preview);
});

test('settings and capture gallery dialogs expose clear accessible names', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Settings', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Explore capture battles', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Battle gallery', exact: true })).toBeVisible();
});
