import { test, expect } from '@playwright/test';

test('gallery respects saved volume and cancels playing sounds when muted or closed', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    const key = 'squadchess.preferences.v1';
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ motion: 'full', sound: false, volume: 0 }));
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    window.galleryAudioProbe = { sources: [] };
    // Observe real browser audio nodes: playback, scheduling, and cancellation still run normally.
    for (const [method, kind] of [['createOscillator', 'oscillator'], ['createBufferSource', 'noise']]) {
      const create = AudioContext.prototype[method];
      AudioContext.prototype[method] = function (...args) {
        const node = create.apply(this, args);
        const record = { kind, started: false, ended: false, immediateStops: 0, contextState: this.state };
        window.galleryAudioProbe.sources.push(record);
        const start = node.start;
        const stop = node.stop;
        node.start = function (...times) { record.started = true; return start.apply(this, times); };
        node.stop = function (...times) {
          if (!times.length || times[0] <= this.context.currentTime) record.immediateStops += 1;
          return stop.apply(this, times);
        };
        node.addEventListener('ended', () => { record.ended = true; });
        return node;
      };
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore capture battles', exact: true }).click();
  const gallery = page.getByRole('region', { name: 'Battle atelier', exact: true });
  await gallery.getByRole('button', { name: 'Sound off', exact: true }).click();
  await gallery.getByRole('button', { name: /^(Play again|Replay battle)$/ }).click();
  await expect(gallery.getByTestId('battle-overlay')).toBeHidden();
  expect(await page.evaluate(() => window.galleryAudioProbe.sources)).toEqual([]);

  await gallery.getByRole('button', { name: 'Close battle atelier', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog');
  await settings.getByRole('tab', { name: 'Sound', exact: true }).click();
  await expect(settings.getByRole('slider', { name: 'Volume', exact: true })).toHaveValue('0');
  await settings.getByRole('slider', { name: 'Volume', exact: true }).press('End');
  await expect(settings.getByRole('slider', { name: 'Volume', exact: true })).toHaveValue('1');
  await settings.getByRole('button', { name: 'Done', exact: true }).click();
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('squadchess.preferences.v1')).volume)).toBe(1);
  await page.getByRole('button', { name: 'Explore capture battles', exact: true }).click();
  await gallery.getByRole('group', { name: 'Preview collection', exact: true }).getByRole('button', { name: 'Finishers', exact: true }).click();
  await gallery.getByRole('button', { name: 'Sound off', exact: true }).click();
  await gallery.getByRole('button', { name: /^(Play again|Replay battle)$/ }).click();
  await expect.poll(() => page.evaluate(() => window.galleryAudioProbe.sources.filter(source => source.started).map(source => source.kind))).toEqual(expect.arrayContaining(['oscillator', 'noise']));
  expect(await page.evaluate(() => window.galleryAudioProbe.sources.every(source => source.contextState === 'running'))).toBe(true);
  const activeBeforeMute = await page.evaluate(() => window.galleryAudioProbe.sources.flatMap((source, index) => source.ended ? [] : [index]));
  expect(activeBeforeMute.length).toBeGreaterThan(0);
  await gallery.getByRole('button', { name: 'Sound on', exact: true }).click();
  expect(await page.evaluate(indices => indices.every(index => window.galleryAudioProbe.sources[index].immediateStops > 0), activeBeforeMute)).toBe(true);

  const firstBatchSize = await page.evaluate(() => window.galleryAudioProbe.sources.length);
  await gallery.getByRole('button', { name: 'Sound off', exact: true }).click();
  await gallery.getByRole('button', { name: /^(Play again|Replay battle)$/ }).click();
  await expect.poll(() => page.evaluate(() => window.galleryAudioProbe.sources.length)).toBeGreaterThan(firstBatchSize);
  const activeBeforeClose = await page.evaluate(start => window.galleryAudioProbe.sources.flatMap((source, index) => index >= start && !source.ended ? [index] : []), firstBatchSize);
  expect(activeBeforeClose.length).toBeGreaterThan(0);
  await gallery.getByRole('button', { name: 'Close battle atelier', exact: true }).click();
  await expect(gallery).toBeHidden();
  expect(await page.evaluate(indices => indices.every(index => window.galleryAudioProbe.sources[index].immediateStops > 0), activeBeforeClose)).toBe(true);
  expect(errors).toEqual([]);
});
