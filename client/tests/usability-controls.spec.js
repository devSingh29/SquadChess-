import { test, expect } from '@playwright/test';
async function openHome(page, motion = 'off') {
  await page.addInitScript(mode => localStorage.setItem('squadchess.preferences.v1', JSON.stringify({ motion: mode, sound: false, volume: .35 })), motion);
  await page.goto('/');
  await page.getByRole('group', { name: 'Your teammate', exact: true }).getByRole('button', { name: 'easy', exact: true }).click();
}
async function start(page) { await page.getByRole('button', { name: 'Play', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Make the first move.', exact: true })).toBeVisible(); }
async function propose(page) {
  await page.locator('.arena-screen [data-square="e2"]').click(); await page.locator('.arena-screen [data-square="e4"]').click();
  await expect(page.getByRole('button', { name: 'Play team turn', exact: true })).toBeEnabled();
}
async function saved(page) { return page.evaluate(async () => (await import('/src/game/storage.js')).getSavedMatch()); }
const errors = new WeakMap();
test.beforeEach(({ page }) => { const messages = []; errors.set(page, messages); page.on('pageerror', error => messages.push(error.message)); });
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

test('match and settings tabs support arrows, Home, End, and one Tab stop', async ({ page }) => {
  await openHome(page); await start(page);
  const plan = page.getByRole('tab', { name: 'Plan', exact: true }); const moves = page.getByRole('tab', { name: /^Moves/ });
  await plan.focus(); await page.keyboard.press('ArrowRight');
  await expect(moves).toBeFocused(); await expect(moves).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.match-tabs [role="tab"][tabindex="0"]')).toHaveCount(1);
  await page.keyboard.press('Home'); await expect(plan).toBeFocused();
  await page.keyboard.press('End'); await expect(moves).toBeFocused();
  await page.keyboard.press('ArrowRight'); await expect(plan).toBeFocused();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const categories = page.getByRole('tablist', { name: 'Setting categories', exact: true });
  const board = categories.getByRole('tab', { name: 'Board & pieces', exact: true }); const sound = categories.getByRole('tab', { name: 'Sound', exact: true });
  await expect(categories).toHaveAttribute('aria-orientation', 'vertical'); await board.focus(); await page.keyboard.press('ArrowDown');
  await expect(categories.getByRole('tab', { name: 'Animations', exact: true })).toBeFocused();
  await expect(page.getByRole('tabpanel', { name: 'Animations', exact: true })).toBeVisible();
  await page.keyboard.press('End'); await expect(sound).toBeFocused();
  await expect(categories.locator('[tabindex="0"]')).toHaveCount(1);
  await page.keyboard.press('Home'); await expect(board).toBeFocused();
});

test('confirmed movement is described as playing rather than thinking', async ({ page }) => {
  await openHome(page, 'full'); await start(page); await propose(page);
  await page.getByRole('button', { name: 'Play team turn', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your move is playing.', exact: true })).toBeVisible();
  await expect(page.locator('.plan-description')).toHaveText('Playing your confirmed combination.');
});

test.describe('short phone plan access', () => {
  test.use({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true });
  test('both promised moves stay readable beside confirmation and can return to the board', async ({ page }, info) => {
    await openHome(page); await start(page); await propose(page);
    const promised = (await saved(page)).preview.second;
    const yourMove = page.getByRole('button', { name: /^Preview your move:/ }); const lyraMove = page.getByRole('button', { name: /^Preview Lyra’s move:/ });
    await expect(yourMove).toBeInViewport(); await expect(lyraMove).toBeInViewport();
    const bounds = async () => ({ board: await page.locator('.arena-screen .board-surface').boundingBox(), dock: await page.locator('.match-actions').boundingBox() });
    let { board, dock } = await bounds(); expect(board.y + board.height).toBeLessThanOrEqual(dock.y); expect(board.width).toBeGreaterThanOrEqual(180); expect(dock.y + dock.height).toBeLessThanOrEqual(575);
    await page.getByRole('button', { name: /Review full plan/ }).tap(); await expect(page.locator('.plan-title')).toBeInViewport(); await expect(lyraMove).toBeInViewport();
    await lyraMove.tap(); await expect(lyraMove).toHaveAttribute('aria-pressed', 'true');
    ({ board, dock } = await bounds()); expect(board.y).toBeGreaterThanOrEqual(0); expect(board.y + board.height).toBeLessThanOrEqual(dock.y);
    await expect(page.locator('.preview-badge')).toContainText('move 2'); await page.screenshot({ path: info.outputPath('short-phone-promised-moves.png') });
    await page.getByRole('button', { name: 'Play team turn', exact: true }).tap();
    await expect(page.getByRole('heading', { name: 'Make the first move.', exact: true })).toBeVisible();
    const played = await saved(page); expect(played.events[1]).toMatchObject(promised); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });
  test('a single opening move explains the skipped follow-up and settings tabs adapt', async ({ page }) => {
    await openHome(page); await page.getByRole('checkbox', { name: 'Balanced opening', exact: true }).check(); await start(page); await propose(page);
    await expect(page.locator('.phone-plan-pending')).toContainText('No follow-up'); await expect(page.locator('.phone-plan-end-reason')).toHaveText('Balanced opening: White gets one move');
    const board = await page.locator('.arena-screen .board-surface').boundingBox(); const dock = await page.locator('.match-actions').boundingBox(); expect(board.y + board.height).toBeLessThanOrEqual(dock.y);
    await page.getByRole('button', { name: 'Settings', exact: true }).tap();
    const tabs = page.getByRole('tablist', { name: 'Setting categories', exact: true }); await expect(tabs).toHaveAttribute('aria-orientation', 'horizontal');
    await tabs.getByRole('tab', { name: 'Board & pieces', exact: true }).focus(); await page.keyboard.press('ArrowRight'); await expect(tabs.getByRole('tab', { name: 'Animations', exact: true })).toBeFocused();
  });
});

test('a finished match with no moves has no active replay controls', async ({ page }) => {
  await openHome(page); await start(page);
  await page.getByRole('button', { name: 'Resign', exact: true }).click();
  await page.getByRole('button', { name: 'Resign match', exact: true }).click();
  await page.getByRole('button', { name: 'Watch the replay', exact: true }).click();
  for (const name of ['First move', 'Previous move', 'Play replay', 'Next move', 'Last move']) await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  await expect(page.getByRole('slider', { name: 'Replay move', exact: true })).toBeDisabled();
  await expect(page.locator('.replay-position')).toContainText('Move 0');
});

test('replay boundaries disable unavailable steps and playing at the end restarts', async ({ page }) => {
  await openHome(page); await start(page); await propose(page);
  await page.getByRole('button', { name: 'Play team turn', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make the first move.', exact: true })).toBeVisible();
  const count = (await saved(page)).events.length;
  expect(count).toBeGreaterThan(0);
  await page.getByRole('tab', { name: /^Moves/ }).click();
  await page.locator('.move-log-row').first().click();
  await page.getByRole('button', { name: 'First move', exact: true }).click();
  for (const name of ['First move', 'Previous move']) await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  for (const name of ['Play replay', 'Next move', 'Last move']) await expect(page.getByRole('button', { name, exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Last move', exact: true }).click();
  for (const name of ['Next move', 'Last move']) await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  for (const name of ['First move', 'Previous move', 'Play replay']) await expect(page.getByRole('button', { name, exact: true })).toBeEnabled();
  await expect(page.getByRole('slider', { name: 'Replay move', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Play replay', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause replay', exact: true })).toBeEnabled();
  await expect(page.locator('.replay-position strong')).not.toHaveText(`Move ${count}`);
  await page.getByRole('button', { name: 'Pause replay', exact: true }).click();
});
