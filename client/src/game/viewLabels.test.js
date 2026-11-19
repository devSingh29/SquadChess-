import test from 'node:test';
import assert from 'node:assert/strict';
import { clocksAtReplayMove } from './viewLabels.js';

test('replay clocks show each accepted move with the bonus only at a team handoff', () => {
  const before = { enabled: true, w: 295000, b: 300000, increment: 3000 };
  const match = {
    clocks: { ...before, w: 200000, b: 0 },
    events: [
      { color: 'w', endsTurn: false, clocksBefore: before },
      { color: 'w', endsTurn: true, clocksBefore: { ...before, w: 294000 } },
      { color: 'b', endsTurn: true, clocksBefore: { ...before, w: 297000, b: 292000 } },
    ],
  };
  assert.deepEqual(clocksAtReplayMove(match, 0), before);
  assert.deepEqual(clocksAtReplayMove(match, 1), before);
  assert.deepEqual(clocksAtReplayMove(match, 2), { ...before, w: 297000 });
  assert.deepEqual(clocksAtReplayMove(match, 3), { ...before, w: 297000, b: 295000 });
  assert.equal(match.events[1].clocksBefore.w, 294000, 'Replay cannot change saved clock snapshots');
  assert.equal(clocksAtReplayMove({ ...match, events: [{ color: 'w' }] }, 1), null, 'Missing old timestamps are not replaced with final clocks');
});
