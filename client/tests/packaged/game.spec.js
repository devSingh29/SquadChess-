import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const observations = new WeakMap();

test.beforeEach(async ({ page, context }) => {
  const observed = { errors: [], requests: [], workers: [] };
  observations.set(page, observed);
  page.on('pageerror', error => observed.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') observed.errors.push(message.text()); });
  page.on('worker', worker => observed.workers.push(worker.url()));
  context.on('request', request => observed.requests.push(request.url()));
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Animations', exact: true }).click();
  await dialog.getByRole('button', { name: 'off', exact: true }).click();
  await dialog.getByRole('tab', { name: 'Sound', exact: true }).click();
  await dialog.getByLabel('Battle sounds', { exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
});

test.afterEach(async ({ page }) => {
  const observed = observations.get(page);
  expect(observed.errors, 'The packaged application should have no browser errors').toEqual([]);
  expect(observed.requests.every(url => new URL(url).origin === 'http://localhost:4173'), 'Normal play must make no external requests').toBe(true);
  expect(observed.requests.filter(url => /\/(?:src\/|@vite\/|@react-refresh)/.test(new URL(url).pathname)), 'The packaged game must not request development source').toEqual([]);
  expect(observed.workers.length, 'Computer play must start a real background worker').toBeGreaterThan(0);
  expect(observed.workers.every(url => /^\/assets\/engine\.worker-[\w-]+\.js$/.test(new URL(url).pathname)), 'Each computer search must load the built worker asset').toBe(true);
});

async function portableMatch(page) {
  await page.getByRole('tab', { name: /^Moves/ }).click();
  const ready = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save a portable copy', exact: true }).click();
  const download = await ready;
  const match = JSON.parse(await readFile(await download.path(), 'utf8'));
  await page.getByRole('tab', { name: 'Plan', exact: true }).click();
  return match;
}

async function start(page, black = false) {
  if (black) await page.getByRole('button', { name: 'Black', exact: true }).click();
  await page.getByRole('group', { name: 'Your teammate', exact: true }).getByRole('button', { name: 'easy', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
}

test('built game completes the promised team combination and restores its save', async ({ page }) => {
  await start(page);
  await page.locator('.arena-screen [data-square="e2"]').click();
  await page.locator('.arena-screen [data-square="e4"]').click();
  await expect(page.getByRole('button', { name: 'Play team turn', exact: true })).toBeEnabled();
  const proposed = await portableMatch(page);
  expect(proposed.events).toHaveLength(0);
  expect(proposed.preview.first).toMatchObject({ from: 'e2', to: 'e4' });
  expect(proposed.preview.second).toBeTruthy();
  await page.getByRole('button', { name: 'Play team turn', exact: true }).click();
  await expect(page.locator('.move-log-row')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Ask Lyra for a hint', exact: true })).toBeEnabled();
  const played = await portableMatch(page);
  expect(played.events.map(event => event.seat)).toEqual(['w1', 'w2', 'b1', 'b2']);
  expect(played.events[1]).toMatchObject(proposed.preview.second);
  await page.reload();
  await page.getByRole('button', { name: 'Continue match', exact: true }).click();
  await page.getByRole('button', { name: 'Return to battle', exact: true }).click();
  await expect(page.locator('.move-log-row')).toHaveCount(4);
  const restored = await portableMatch(page);
  expect(restored.id).toBe(played.id);
  expect(restored.events).toEqual(played.events);
  expect(restored.position).toEqual(played.position);
});

test('built game opens with the computer White pair when the human chooses Black', async ({ page }) => {
  await start(page, true);
  await expect(page.locator('.move-log-row')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Ask Lyra for a hint', exact: true })).toBeEnabled();
  const match = await portableMatch(page);
  expect(match.config.humanColor).toBe('b');
  expect(match.events.map(event => event.seat)).toEqual(['w1', 'w2']);
  expect(match.position).toMatchObject({ team: 'b', slot: 0 });
  await expect(page.locator('.arena-screen [data-square="e7"] [data-piece="bP"]')).toBeVisible();
});
