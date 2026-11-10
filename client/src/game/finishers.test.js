import test from 'node:test';
import assert from 'node:assert/strict';
import { battleDetails, battleSpec, phaseTimings } from './battles.js';
import { FINISHER_REGISTRY, REACTION_VARIANTS } from './finishers.js';

const capture = { from: 'e4', to: 'd5', captureSquare: 'd5', piece: 'p', captured: 'p', color: 'w', seat: 'w1', endsTurn: false };
const recorded = (move, history = [], seed = 1, options) => ({ ...move, index: history.length, ...battleDetails(move, history, 'w', seed, options) });
const quiet = index => ({ index, from: 'a2', to: 'a3', piece: 'p', color: index % 2 ? 'b' : 'w', seat: 'b2', endsTurn: true });

test('twelve permanent finishers cover all attackers with bounded total durations and synchronized contact', () => {
  assert.equal(Object.keys(FINISHER_REGISTRY).length, 12);
  for (const piece of ['p', 'n', 'b', 'r', 'q', 'k']) {
    const entries = Object.values(FINISHER_REGISTRY).filter(entry => entry.piece === piece);
    assert.equal(entries.length, 2);
    for (const entry of entries) {
      assert.ok(entry.duration >= 2300 && entry.duration <= 2800);
      assert.equal(entry.motionName, entry.id);
      const timing = phaseTimings(entry, entry.duration);
      assert.ok(Math.abs(timing.impactAt / timing.motion - .43) < 1e-9);
    }
  }
  assert.equal(Object.values(REACTION_VARIANTS).flat().length, 15);
});

test('the first qualifying capture is eligible immediately and exactly eight indices unlock the next', () => {
  const first = recorded({ ...capture, captured: 'q' });
  assert.ok(first.finisher, 'No arbitrary eight-move wait before the first finisher');
  const history = [first, ...Array.from({ length: 6 }, (_, index) => quiet(index + 1))];
  assert.equal(recorded({ ...capture, captured: 'q' }, history).finisher, undefined);
  history.push(quiet(7));
  assert.ok(recorded({ ...capture, captured: 'q' }, history).finisher);
  for (let index = 8; index <= 80; index += 8) {
    while (history.length < index) history.push(quiet(history.length));
    const next = recorded({ ...capture, captured: 'q' }, history);
    assert.ok(next.finisher, `No lifetime count cap at move ${index}`);
    history.push(next);
  }
});

test('only the approved capture facts qualify for finishers', () => {
  for (const move of [capture, { ...capture, piece: 'r' }, { ...capture, piece: 'q' }]) {
    assert.equal(recorded(move).finisher, undefined, 'Attacker value alone is not eligibility');
  }
  for (const captured of ['q', 'r']) assert.ok(recorded({ ...capture, piece: 'n', captured }).finisher);
  assert.ok(recorded({ ...capture, promotion: 'n' }).finisher);
  assert.ok(recorded(capture, [], 7, { result: { winner: 'w', reason: 'checkmate' } }).finisher);
  assert.equal(recorded(capture, [], 7, { result: { winner: null, reason: 'stalemate' } }).finisher, undefined);
  assert.equal(battleDetails({ ...capture, captured: undefined, promotion: 'q' }), null);
});

test('confirmed second captures defer the first finish and retain the exact allied echo', () => {
  const first = recorded({ ...capture, piece: 'n', captured: 'q' }, [], 4, { deferFinisher: true });
  assert.equal(first.finisher, undefined);
  const second = recorded({ ...capture, from: 'f4', to: 'e5', captureSquare: 'e5', seat: 'w2' }, [first]);
  assert.ok(second.finisher);
  assert.equal(second.combo, true);
  assert.deepEqual(second.finisher.echo, { from: first.from, to: first.to, captureSquare: first.captureSquare, piece: 'n', color: 'w', seat: 'w1' });
  assert.equal(recorded({ ...capture, seat: 'w2' }, [first, quiet(1)]).finisher, undefined);
  assert.equal(recorded({ ...capture, seat: 'w2' }, [{ ...first, endsTurn: true }]).finisher, undefined);
});

test('saved seeds vary finishers and reactions without immediately repeating the same role', () => {
  for (const piece of ['p', 'n', 'b', 'r', 'q', 'k']) {
    const history = [];
    const seen = new Set();
    let previous;
    for (let index = 0; index < 5; index += 1) {
      const move = { ...capture, piece, captured: 'q' };
      const next = recorded(move, history, 0);
      assert.deepEqual(recorded(move, history, 0), next);
      assert.notEqual(next.finisher.id, previous?.finisher.id);
      assert.notEqual(next.reactionVariant, previous?.reactionVariant);
      seen.add(next.finisher.id);
      history.push(next);
      previous = next;
      for (let padding = 0; padding < 7; padding += 1) history.push(quiet(history.length));
    }
    assert.equal(seen.size, 2);
  }
  for (const captured of ['p', 'n', 'b', 'r', 'q']) {
    const history = [];
    const seen = new Set();
    for (let seed = 0; seed < 24; seed += 1) {
      const event = recorded({ ...capture, captured }, history, seed);
      assert.notEqual(event.reactionVariant, history.at(-1)?.reactionVariant);
      assert.equal(battleSpec(event).reaction.id, event.reactionVariant);
      seen.add(event.reactionVariant);
      history.push(event);
    }
    assert.equal(seen.size, 3);
  }
});
