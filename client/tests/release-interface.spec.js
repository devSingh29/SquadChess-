import { test, expect } from '@playwright/test';
import { createMatch } from '../src/game/controller.js';
import { applyMove, createPosition } from '../src/game/rules.js';
import { battleDetails } from '../src/game/battles.js';
const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const caught = []; errors.set(page, caught);
  page.on('pageerror', error => caught.push(error.message));
  page.on('console', message => { if (message.type() === 'error') caught.push(message.text()); });
  await page.addInitScript(() => { if (!localStorage.getItem('squadchess.preferences.v1')) localStorage.setItem('squadchess.preferences.v1', JSON.stringify({ motion: 'off', sound: false, volume: .35 })); });
  await page.goto('/');
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));
const square = (page, name) => page.locator(`.arena-screen [data-square="${name}"]`);
async function play(page) {
  await page.getByRole('group', { name: 'Your teammate', exact: true }).getByRole('button', { name: 'easy', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Squad match', exact: true })).toBeVisible();
}
async function plan(page) {
  await square(page, 'e2').click(); await square(page, 'e4').click();
  await expect(page.getByRole('button', { name: 'Play team turn', exact: true })).toBeEnabled();
}
test('laptop controls fit and a board proposal or hint reveals the plan from Moves', async ({ page }, info) => {
  await page.setViewportSize({ width: 1366, height: 768 }); await play(page);
  const toolbar = await page.locator('.board-toolbar').boundingBox();
  expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(768);
  await page.getByRole('tab', { name: /^Moves/ }).click(); await plan(page);
  await expect(page.getByRole('tab', { name: 'Plan', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.planner-overlay text')).toHaveCount(2);
  const confirm = await page.getByRole('button', { name: 'Play team turn', exact: true }).boundingBox();
  expect(confirm.y + confirm.height).toBeLessThanOrEqual(768);
  await page.getByRole('button', { name: 'Change my move', exact: true }).click();
  await page.getByRole('tab', { name: /^Moves/ }).click();
  await page.getByRole('button', { name: 'Ask Lyra for a hint', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Plan', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Play team turn', exact: true })).toBeEnabled();
  await page.screenshot({ path: info.outputPath('laptop-controls.png') });
});
test('last match choices survive reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Black', exact: true }).click();
  await page.getByRole('group', { name: 'Your teammate', exact: true }).getByRole('button', { name: 'hard', exact: true }).click();
  await page.getByRole('group', { name: 'Rival squad', exact: true }).getByRole('button', { name: 'medium', exact: true }).click();
  await page.getByRole('combobox', { name: 'Time control', exact: true }).selectOption('10+5');
  await page.getByRole('checkbox', { name: 'Balanced opening', exact: true }).check(); await page.reload();
  await expect(page.getByRole('button', { name: 'Black', exact: true })).toHaveClass(/chosen/);
  for (const [group, level] of [['Your teammate','hard'],['Rival squad','medium']]) await expect(page.getByRole('group', { name: group, exact: true }).getByRole('button', { name: level, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: 'Time control', exact: true })).toHaveValue('10+5');
  await expect(page.getByRole('checkbox', { name: 'Balanced opening', exact: true })).toBeChecked();
});
test('categorized settings preview and preserve independent movement and sound choices', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click(); const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('tabpanel', { name: 'Board & pieces', exact: true })).toBeVisible();
  await expect(dialog.getByRole('tabpanel', { name: 'Animations', exact: true })).toBeHidden();
  await dialog.getByRole('tab', { name: 'Animations', exact: true }).click();
  await dialog.getByRole('button', { name: 'full', exact: true }).click();
  await dialog.getByRole('button', { name: 'Preview movement', exact: true }).click();
  await expect(dialog.getByTestId('movement-overlay')).toBeVisible();
  await dialog.getByRole('checkbox', { name: /^Finishers/ }).uncheck();
  await dialog.getByRole('checkbox', { name: /^Board shake/ }).uncheck();
  await dialog.getByRole('tab', { name: 'Sound', exact: true }).click();
  await expect(dialog.getByRole('checkbox', { name: 'Battle sounds', exact: true })).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Test sound', exact: true }).click();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click(); await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await dialog.getByRole('tab', { name: 'Animations', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'full', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('checkbox', { name: /^Finishers/ })).not.toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: /^Board shake/ })).not.toBeChecked();
});
test('replay captures and highlights follow the displayed move, then return to the preserved match', async ({ page }) => {
  const match = createMatch({ humanColor: 'w', teammateDifficulty: 'easy', opponentDifficulty: 'easy' });
  match.initialPosition = createPosition('7k/8/3r4/3q4/3R4/8/8/K7 w - - 0 1'); match.position = match.initialPosition;
  for (const input of [{ from: 'd4', to: 'd5' }, { from: 'd5', to: 'd6' }]) {
    const { position, move } = applyMove(match.position, input);
    match.events.push({ ...move, ...battleDetails(move, match.events, 'w', 99 + match.events.length), id: `${match.id}:${match.events.length}`, index: match.events.length, humanColor: 'w', positionAfter: position, clocksBefore: match.clocks });
    match.position = position;
  }
  match.phase = 'paused'; match.revision = 2;
  await page.evaluate(async game => { const { saveMatch } = await import('/src/game/storage.js'); await saveMatch(game); }, match);
  await page.reload(); await page.getByRole('button', { name: 'Continue match', exact: true }).click();
  await page.getByRole('tab', { name: /^Moves/ }).click(); await page.locator('.move-log-row').first().click();
  await expect(page.locator('.captured-section summary > span')).toHaveText('1');
  await page.getByRole('button', { name: 'First move', exact: true }).click();
  await expect(page.locator('.captured-section summary > span')).toHaveText('0');
  await expect(page.locator('.move-log-row.current')).toHaveCount(0);
  await expect(square(page, 'd4').locator('[data-piece="wR"]')).toBeVisible();
  await page.getByRole('button', { name: 'Last move', exact: true }).click();
  await expect(page.locator('.captured-section summary > span')).toHaveText('2');
  await expect(page.locator('.move-log-row.current')).toHaveCount(1);
  await expect(square(page, 'd6').locator('[data-piece="wR"]')).toBeVisible();
  await page.getByRole('button', { name: 'Return to Match', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Return to battle', exact: true })).toBeVisible();
  const restored = await page.evaluate(async () => (await import('/src/game/storage.js')).getSavedMatch());
  expect(restored.id).toBe(match.id); expect(restored.events).toHaveLength(2);
});
test.describe('phone controls', () => {
  test.use({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
  test('setup comes first and confirmation stays above navigation without covering the board', async ({ page }, info) => {
    const setup = await page.locator('.home-intro').boundingBox(); const decoration = await page.locator('.home-showcase').boundingBox();
    expect(setup.y + setup.height).toBeLessThan(decoration.y); await play(page); await plan(page);
    const board = await page.locator('.arena-screen .board-surface').boundingBox(); const confirm = await page.locator('.match-actions').boundingBox(); const navigation = await page.locator('.navigation-rail').boundingBox();
    expect(confirm.y + confirm.height).toBeLessThanOrEqual(navigation.y + 1);
    expect(confirm.y).toBeGreaterThanOrEqual(board.y + board.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await page.getByRole('button', { name: 'Play team turn', exact: true }).tap();
    await expect(page.getByRole('heading', { name: 'Make the first move.' })).toBeVisible();
    await page.screenshot({ path: info.outputPath('phone-controls.png'), fullPage: true });
  });
});
