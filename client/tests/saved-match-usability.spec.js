import { test, expect } from '@playwright/test';
import { createMatch } from '../src/game/controller.js';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('squadchess.preferences.v1', JSON.stringify({ motion: 'off', sound: false, volume: .35 }));
  });
  await page.goto('/');
});

async function savedState(page) {
  return page.evaluate(async () => {
    const storage = await import('/src/game/storage.js');
    return { active: await storage.getSavedMatch(), games: await storage.listMatches() };
  });
}

async function start(page) {
  await page.getByRole('group', { name: 'Your teammate', exact: true }).getByRole('button', { name: 'easy', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make the first move.' })).toBeVisible();
}

test('deleting the loaded planned match removes Continue and never reappears after leaving or reloading', async ({ page }) => {
  await start(page);
  await page.locator('.arena-screen [data-square="e2"]').click();
  await page.locator('.arena-screen [data-square="e4"]').click();
  await expect(page.getByRole('button', { name: 'Play team turn', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await expect(page.locator('.history-card')).toHaveCount(1);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete saved game', exact: true }).click();
  await expect(page.locator('.history-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Play home', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continue match', exact: true })).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue match', exact: true })).toHaveCount(0);
  expect(await savedState(page)).toEqual({ active: null, games: [] });
});

test('deleting an older match keeps the current promised combination', async ({ page }) => {
  const older = createMatch({ opponentDifficulty: 'hard' });
  older.createdAt = older.updatedAt = '2025-01-01T00:00:00.000Z';
  await page.evaluate(async game => (await import('/src/game/storage.js')).saveMatch(game), older);
  await start(page);
  await page.locator('.arena-screen [data-square="e2"]').click();
  await page.locator('.arena-screen [data-square="e4"]').click();
  await expect(page.getByRole('button', { name: 'Play team turn', exact: true })).toBeEnabled();
  const current = (await savedState(page)).active;
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await expect(page.locator('.history-card')).toHaveCount(2);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('.history-card').filter({ hasText: 'hard rivals' }).getByRole('button', { name: 'Delete saved game', exact: true }).click();
  await expect(page.locator('.history-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Play home', exact: true }).click();
  await page.getByRole('button', { name: 'Continue match', exact: true }).click();
  await page.getByRole('button', { name: 'Return to battle', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play team turn', exact: true })).toBeEnabled();
  const restored = await savedState(page);
  expect(restored.games).toHaveLength(1);
  expect(restored.active.id).toBe(current.id);
  expect(restored.active.preview).toEqual(current.preview);
});

test('finished games are labelled for review on home, including after reload', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Resign', exact: true }).click();
  await page.getByRole('button', { name: 'Resign match', exact: true }).click();
  await page.getByRole('button', { name: 'Play home', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continue match', exact: true })).toHaveCount(0);
  await expect(page.locator('.continue-card')).toContainText('White · 0 moves · No clock');
  await page.reload();
  await page.getByRole('button', { name: 'Review finished match', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rematch', exact: true })).toBeVisible();
  expect((await savedState(page)).active.position.result.reason).toBe('resignation');
});
