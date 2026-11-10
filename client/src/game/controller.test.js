import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, GameController } from './controller.js';
import { applyMove, createPosition } from './rules.js';
import { presentationDuration } from './battles.js';

const e4 = { from: 'e2', to: 'e4' };
const nf3 = { from: 'g1', to: 'f3' };
const d4 = { from: 'd2', to: 'd4' };

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function settle() {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

function harness(t, options = {}) {
  const calls = [];
  const saves = [];
  const controller = new GameController({
    tick: false,
    search: options.search || ((request, signal) => {
      const pending = deferred();
      calls.push({ ...pending, request, signal });
      return pending.promise;
    }),
    save: options.save || (async (match) => { saves.push(structuredClone(match)); }),
  });
  t.after(() => controller.destroy());
  return { controller, calls, saves };
}

function controlledClock(t, initial = 1000) {
  const clock = { value: initial };
  t.mock.method(performance, 'now', () => clock.value);
  return clock;
}

function loadPosition(controller, fen, options = {}, config = {}) {
  const initialPosition = createPosition(fen, options);
  const match = { ...createMatch(config), initialPosition, position: initialPosition };
  controller.load(match);
  controller.resume();
  return match;
}

test('confirmed capture pairs reserve the finisher for move two independently of preferences', async (t) => {
  const clock = controlledClock(t);
  const { controller, calls, saves } = harness(t);
  const scheduled = [];
  const originalTimeout = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, duration) => {
    scheduled.push(duration);
    return originalTimeout(callback, duration);
  });
  controller.setPreferences({ finishers: false });
  loadPosition(controller, '7k/8/8/3qp3/4PP2/8/8/K7 w - - 0 1');
  const proposal = controller.propose({ from: 'e4', to: 'd5' });
  calls[0].resolve({ move: { from: 'f4', to: 'e5' } });
  await proposal;
  controller.confirm();
  const first = controller.getSnapshot().presentation;
  assert.equal(first.captured, 'q');
  assert.equal(first.finisher, undefined, 'The confirmed second capture owns the finish');
  controller.skipAnimation();
  const second = controller.getSnapshot().presentation;
  assert.equal(second.seat, 'w2');
  assert.ok(second.finisher, 'Disabling playback must not erase the saved finisher');
  assert.equal(second.finisher.echo.from, first.from);
  assert.equal(second.finisher.echo.piece, first.piece);
  assert.equal(scheduled.at(-1), presentationDuration(second, { finishers: false }) + 60);
  const immutable = structuredClone(second);
  clock.value += 300;
  controller.setPreferences({ finishers: true });
  assert.equal(scheduled.at(-1), presentationDuration(second) - 300 + 60);
  assert.deepEqual(controller.getSnapshot().presentation, immutable);
  controller.setPreferences({ motion: 'reduced' });
  assert.equal(scheduled.at(-1), 0, 'An elapsed reduced presentation ends promptly');
  await controller.saveChain;
  assert.deepEqual(saves.at(-1).events[1].finisher, second.finisher);
});

test('a first-move capture mate gets a finisher without requesting a teammate move', async (t) => {
  const { controller, calls } = harness(t);
  loadPosition(controller, '5n1k/8/6K1/5Q2/8/8/8/8 w - - 0 1');
  await controller.propose({ from: 'f5', to: 'f8' });
  assert.equal(calls.length, 0);
  controller.confirm();
  const match = controller.getSnapshot().match;
  assert.equal(match.position.result.reason, 'checkmate');
  assert.equal(match.events[0].captured, 'n');
  assert.ok(match.events[0].finisher);
  assert.equal(match.lockedMove, null);
  controller.skipAnimation();
  assert.equal(controller.getSnapshot().match.phase, 'finished');
});

test('changing a proposed move cancels its request and ignores its late successful reply', async (t) => {
  const { controller, calls } = harness(t);
  controller.start();
  const first = controller.propose(d4);
  const second = controller.propose(e4);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].signal.aborted, true);
  calls[1].resolve({ move: nf3, explanation: 'Develops the knight.' });
  await second;
  calls[0].resolve({ move: { from: 'd4', to: 'd5' } });
  await first;
  const match = controller.getSnapshot().match;
  assert.deepEqual(match.preview.first, e4);
  assert.deepEqual(match.preview.second, nf3);
  assert.equal(match.preview.status, 'ready');
  assert.equal(match.events.length, 0);
  assert.equal(match.revision, 0);
});

test('a late successful reply cannot modify a newly started match', async (t) => {
  const { controller, calls } = harness(t);
  controller.start();
  const previousId = controller.getSnapshot().match.id;
  const pending = controller.propose(e4);
  controller.start();
  const newId = controller.getSnapshot().match.id;
  calls[0].resolve({ move: nf3 });
  await pending;
  const match = controller.getSnapshot().match;
  assert.notEqual(newId, previousId);
  assert.equal(match.id, newId);
  assert.equal(match.preview, null);
  assert.equal(match.phase, 'planning');
});

test('a late failed reply cannot put a newly started match into error', async (t) => {
  const { controller, calls } = harness(t);
  controller.start();
  const pending = controller.propose(e4);
  controller.start();
  const newId = controller.getSnapshot().match.id;
  calls[0].reject(new Error('Old engine failed after cancellation.'));
  await pending;
  const match = controller.getSnapshot().match;
  assert.equal(match.id, newId);
  assert.equal(match.phase, 'planning');
  assert.equal(match.error ?? null, null);
});

test('confirmation executes the displayed teammate move without searching again', async (t) => {
  const { controller, calls, saves } = harness(t);
  controller.start();
  const initialFen = controller.getSnapshot().match.position.fen;
  const pending = controller.propose(e4);
  calls[0].resolve({ move: nf3 });
  await pending;
  assert.equal(controller.getSnapshot().match.position.fen, initialFen);
  controller.confirm();
  let match = controller.getSnapshot().match;
  assert.equal(match.events.length, 1);
  assert.deepEqual(match.lockedMove, nf3);
  assert.equal(match.position.slot, 1);
  assert.equal(match.phase, 'animating');
  controller.skipAnimation();
  match = controller.getSnapshot().match;
  assert.equal(match.events.length, 2);
  assert.equal(match.events[1].from, nf3.from);
  assert.equal(match.events[1].to, nf3.to);
  assert.equal(match.position.team, 'b');
  assert.equal(match.lockedMove, null);
  assert.equal(calls.length, 1);
  await controller.saveChain;
  assert.ok(saves.some((saved) => saved.lockedMove && saved.position.slot === 1));
  assert.equal(saves.some((saved) => saved.lockedMove && saved.position.slot === 0), false,
    'A save must never attach a second move to the position before its first move.');
});

test('a checking first move previews no teammate reply and starts no teammate search', async (t) => {
  const { controller, calls } = harness(t);
  loadPosition(controller, '4k3/8/8/8/8/8/K7/R7 w - - 0 1');
  await controller.propose({ from: 'a1', to: 'e1' });
  let match = controller.getSnapshot().match;
  assert.equal(match.preview.status, 'ready');
  assert.equal(match.preview.second, null);
  assert.match(match.preview.explanation, /Check ends/);
  assert.equal(calls.length, 0);
  controller.confirm();
  match = controller.getSnapshot().match;
  assert.equal(match.events.length, 1);
  assert.equal(match.events[0].givesCheck, true);
  assert.equal(match.position.team, 'b');
  assert.equal(match.position.slot, 0);
  assert.equal(match.lockedMove, null);
});

test('a balanced White opening previews and confirms a single move without a teammate search', async (t) => {
  const { controller, calls } = harness(t);
  controller.start({ balancedOpening: true });
  const pending = controller.propose(e4);
  assert.equal(calls.length, 0);
  await pending;
  const preview = controller.getSnapshot().match.preview;
  assert.equal(preview.status, 'ready');
  assert.equal(preview.second, null);
  controller.confirm();
  const match = controller.getSnapshot().match;
  assert.equal(match.events.length, 1);
  assert.equal(match.events[0].seat, 'w1');
  assert.equal(match.position.team, 'b');
  assert.equal(match.position.slot, 0);
  assert.equal(match.lockedMove, null);
});

test('playing Black in balanced mode waits for one White opening then previews a full Black pair', async (t) => {
  const { controller, calls } = harness(t);
  controller.start({ humanColor: 'b', balancedOpening: true });
  assert.equal(calls.length, 1);
  calls[0].resolve({ move: e4, continuation: null });
  await settle();
  assert.equal(controller.getSnapshot().match.events.length, 1);
  controller.skipAnimation();
  assert.equal(controller.getSnapshot().match.phase, 'planning');
  const pending = controller.propose({ from: 'e7', to: 'e5' });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].request.position.team, 'b');
  assert.equal(calls[1].request.position.slot, 1);
  calls[1].resolve({ move: { from: 'b8', to: 'c6' } });
  await pending;
  assert.deepEqual(controller.getSnapshot().match.preview.second, { from: 'b8', to: 'c6' });
  controller.confirm();
  controller.skipAnimation();
  const match = controller.getSnapshot().match;
  assert.equal(match.events.length, 3);
  assert.equal(match.position.team, 'w');
  assert.equal(match.position.slot, 0);
  assert.equal(match.position.openingPending, false);
});

test('loading and resuming a pending pair preserves its already approved second move', (t) => {
  const { controller, calls } = harness(t);
  const match = createMatch();
  const first = applyMove(match.position, e4);
  const event = { ...first.move, id: 'saved-first', index: 0, positionAfter: first.position, clocksBefore: match.clocks };
  controller.load({
    ...match, position: first.position, events: [event], revision: 1,
    phase: 'animating', lockedMove: nf3, preview: null,
  });
  assert.equal(controller.getSnapshot().match.phase, 'paused');
  assert.equal(calls.length, 0);
  controller.resume();
  const resumed = controller.getSnapshot().match;
  assert.equal(resumed.events.length, 2);
  assert.equal(resumed.events[1].san, 'Nf3');
  assert.equal(resumed.position.team, 'b');
  assert.equal(resumed.lockedMove, null);
  assert.equal(calls.length, 0);
});

test('pausing during an animation does not lose the pending teammate move', async (t) => {
  const { controller, calls } = harness(t);
  controller.start();
  const pending = controller.propose(e4);
  calls[0].resolve({ move: nf3 });
  await pending;
  controller.confirm();
  controller.pause();
  assert.equal(controller.getSnapshot().presentation, null);
  assert.equal(controller.getSnapshot().match.phase, 'paused');
  assert.deepEqual(controller.getSnapshot().match.lockedMove, nf3);
  controller.resume();
  assert.equal(controller.getSnapshot().match.events.length, 2);
  assert.equal(controller.getSnapshot().match.events[1].san, 'Nf3');
  assert.equal(calls.length, 1);
});

test('undo returns to the human decision before their pair and the opponent response', async (t) => {
  const { controller, calls } = harness(t);
  controller.start();
  const initial = controller.getSnapshot().match.position;
  const proposal = controller.propose(e4);
  calls[0].resolve({ move: nf3 });
  await proposal;
  controller.confirm();
  controller.skipAnimation();
  controller.skipAnimation();
  assert.equal(calls.length, 2);
  calls[1].resolve({ move: { from: 'e7', to: 'e5' }, continuation: { from: 'b8', to: 'c6' } });
  await settle();
  controller.skipAnimation();
  controller.skipAnimation();
  const beforeUndo = controller.getSnapshot().match;
  assert.equal(beforeUndo.events.length, 4);
  assert.equal(beforeUndo.phase, 'planning');
  controller.undo();
  const undone = controller.getSnapshot().match;
  assert.deepEqual(undone.position, initial);
  assert.equal(undone.events.length, 0);
  assert.equal(undone.revision, beforeUndo.revision + 1);
  assert.equal(undone.assisted.undos, 1);
  assert.equal(undone.phase, 'planning');
  assert.equal(undone.preview, null);
  assert.equal(undone.lockedMove, null);
  assert.equal(controller.getSnapshot().presentation, null);
});

test('team clocks charge planning and thinking, exclude animations and pauses, and increment once per pair', async (t) => {
  const clock = controlledClock(t);
  const { controller, calls } = harness(t);
  controller.start({ timeControl: '5+3' });
  clock.value = 3000;
  controller.chargeClock();
  assert.equal(controller.getSnapshot().match.clocks.w, 298000);
  const pending = controller.propose(e4);
  calls[0].resolve({ move: nf3 });
  await pending;
  clock.value = 4000;
  controller.confirm();
  assert.equal(controller.getSnapshot().match.clocks.w, 297000);
  clock.value = 9000;
  controller.chargeClock();
  assert.equal(controller.getSnapshot().match.clocks.w, 297000);
  controller.skipAnimation();
  assert.equal(controller.getSnapshot().match.clocks.w, 300000);
  clock.value = 19000;
  controller.chargeClock();
  assert.equal(controller.getSnapshot().match.clocks.b, 300000);
  controller.skipAnimation();
  assert.equal(controller.getSnapshot().match.phase, 'thinking');
  clock.value = 20000;
  controller.chargeClock();
  assert.equal(controller.getSnapshot().match.clocks.b, 299000);
  clock.value = 21000;
  controller.pause();
  assert.equal(controller.getSnapshot().match.clocks.b, 298000);
  clock.value = 51000;
  controller.chargeClock();
  assert.equal(controller.getSnapshot().match.clocks.b, 298000);
  controller.resume();
  clock.value = 52000;
  controller.chargeClock();
  assert.equal(controller.getSnapshot().match.clocks.b, 297000);
});

test('clock expiry cancels an in-flight preview and cannot be undone by its late reply', async (t) => {
  const clock = controlledClock(t, 0);
  const { controller, calls } = harness(t);
  controller.start({ timeControl: '5+3' });
  const pending = controller.propose(e4);
  clock.value = 300001;
  controller.chargeClock();
  assert.equal(calls[0].signal.aborted, true);
  calls[0].resolve({ move: nf3 });
  await pending;
  const match = controller.getSnapshot().match;
  assert.deepEqual(match.position.result, { winner: 'b', reason: 'timeout' });
  assert.equal(match.phase, 'finished');
  assert.equal(match.clocks.w, 0);
  assert.equal(match.events.length, 0);
  assert.equal(match.preview, null);
  assert.equal(match.lockedMove, null);
});

test('a timeout against a bare king is a draw', (t) => {
  const clock = controlledClock(t, 0);
  const { controller } = harness(t);
  loadPosition(controller, '7k/8/8/8/8/8/R7/K7 w - - 0 1', {}, { timeControl: '5+3' });
  clock.value = 300001;
  controller.chargeClock();
  assert.deepEqual(controller.getSnapshot().match.position.result,
    { winner: null, reason: 'timeout-bare-king' });
});

test('a failed or illegal computer reply preserves the board and retry rebuilds the preview', async (t) => {
  const { controller, calls } = harness(t);
  controller.start();
  const initialFen = controller.getSnapshot().match.position.fen;
  const pending = controller.propose(e4);
  calls[0].reject(new Error('The worker stopped.'));
  await pending;
  assert.equal(controller.getSnapshot().match.phase, 'error');
  assert.equal(controller.getSnapshot().match.position.fen, initialFen);
  assert.equal(controller.getSnapshot().match.events.length, 0);
  controller.resume();
  assert.equal(calls.length, 2);
  calls[1].resolve({ move: { from: 'e7', to: 'e5' } });
  await settle();
  assert.equal(controller.getSnapshot().match.phase, 'error');
  assert.equal(controller.getSnapshot().match.position.fen, initialFen);
  controller.resume();
  calls[2].resolve({ move: nf3 });
  await settle();
  const match = controller.getSnapshot().match;
  assert.equal(match.phase, 'planning');
  assert.equal(match.preview.status, 'ready');
  assert.deepEqual(match.preview.second, nf3);
  assert.equal(match.error, null);
});

test('an invalid opposing pair is rejected before either move and retry can recover', async (t) => {
  const { controller, calls } = harness(t);
  controller.start({ humanColor: 'b' });
  const initialFen = controller.getSnapshot().match.position.fen;
  calls[0].resolve({ move: e4, continuation: { from: 'e7', to: 'e5' } });
  await settle();
  let match = controller.getSnapshot().match;
  assert.equal(match.phase, 'error');
  assert.equal(match.position.fen, initialFen);
  assert.equal(match.events.length, 0);
  assert.equal(match.lockedMove, null);
  controller.resume();
  assert.equal(calls.length, 2);
  calls[1].resolve({ move: e4, continuation: nf3 });
  await settle();
  controller.skipAnimation();
  match = controller.getSnapshot().match;
  assert.equal(match.events.length, 2);
  assert.equal(match.position.team, 'b');
  assert.equal(match.lockedMove, null);
});

test('a first-move check earns one clock increment for the shortened pair', async (t) => {
  const clock = controlledClock(t, 0);
  const { controller } = harness(t);
  loadPosition(controller, '4k3/8/8/8/8/8/K7/R7 w - - 0 1', {}, { timeControl: '5+3' });
  clock.value = 2000;
  await controller.propose({ from: 'a1', to: 'e1' });
  controller.confirm();
  const match = controller.getSnapshot().match;
  assert.equal(match.clocks.w, 301000);
  assert.equal(match.clocks.b, 300000);
  assert.equal(match.events.length, 1);
  assert.equal(match.position.team, 'b');
});

test('pausing a hint cancels it without adding assistance or committing a move', async (t) => {
  const { controller, calls } = harness(t);
  controller.start();
  const pending = controller.hint();
  assert.equal(controller.getSnapshot().hinting, true);
  controller.pause();
  calls[0].resolve({ move: e4, continuation: nf3 });
  await pending;
  const snapshot = controller.getSnapshot();
  assert.equal(snapshot.hinting, false);
  assert.equal(snapshot.match.phase, 'paused');
  assert.equal(snapshot.match.assisted.hints, 0);
  assert.equal(snapshot.match.events.length, 0);
  assert.equal(snapshot.match.preview, null);
});

test('save failures show a recovery notice without discarding the live game', async (t) => {
  const { controller } = harness(t, { save: async () => { throw new Error('Storage is full. Export your game.'); } });
  controller.start();
  await controller.saveChain;
  assert.match(controller.getSnapshot().notice, /Storage is full/);
  assert.equal(controller.getSnapshot().match.phase, 'planning');
  assert.equal(controller.getSnapshot().match.events.length, 0);
});
