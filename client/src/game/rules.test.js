import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMove, createPosition, isInCheck, legalMoves, movesRemaining, turnCapacity, RULESET, START_FEN } from './rules.js';

const play = (position, from, to, promotion) => applyMove(position, { from, to, ...(promotion ? { promotion } : {}) });

test('ordinary opening follows two White moves then two Black moves', () => {
  let position = createPosition();
  assert.equal(position.fen, START_FEN);
  assert.equal(RULESET, 'squad-double-v1');
  const sequence = [['e2', 'e4'], ['g1', 'f3'], ['e7', 'e5'], ['b8', 'c6']];
  const actors = [];
  for (const [from, to] of sequence) {
    const next = play(position, from, to);
    actors.push(next.move.seat);
    position = next.position;
  }
  assert.deepEqual(actors, ['w1', 'w2', 'b1', 'b2']);
  assert.equal(position.team, 'w');
  assert.equal(position.slot, 0);
  assert.equal(position.turnNumber, 2);
});

test('balanced opening gives only the first White turn one move, then restores full pairs for both colors', () => {
  let position = createPosition(undefined, { settings: { balancedOpening: true } });
  assert.equal(turnCapacity(position), 1);
  assert.equal(movesRemaining(position), 1);
  assert.equal(position.openingPending, true);
  const first = play(position, 'e2', 'e4');
  assert.equal(first.move.endsTurn, true);
  position = first.position;
  assert.equal(position.team, 'b');
  assert.equal(position.slot, 0);
  assert.equal(position.openingPending, false);
  assert.equal(movesRemaining(position), 2);
  position = play(position, 'e7', 'e5').position;
  assert.equal(position.team, 'b');
  assert.equal(movesRemaining(position), 1);
  position = play(position, 'b8', 'c6').position;
  assert.equal(position.team, 'w');
  assert.equal(movesRemaining(position), 2);
  position = createPosition(position.fen, position);
  position = play(position, 'g1', 'f3').position;
  assert.equal(position.team, 'w');
  assert.equal(position.slot, 1);
  position = play(position, 'b1', 'c3').position;
  assert.equal(position.team, 'b');
  assert.deepEqual(position.settings, { balancedOpening: true, fullTwoMoveOpening: false });
});

test('full two-move opening remains the default and opening eligibility survives a mid-pair restore', () => {
  const initial = createPosition();
  assert.equal(turnCapacity(initial), 2);
  assert.deepEqual(initial.settings, { balancedOpening: false, fullTwoMoveOpening: true });
  const first = play(initial, 'e2', 'e4').position;
  assert.equal(first.openingPending, true);
  const restored = createPosition(first.fen, first);
  assert.equal(movesRemaining(restored), 1);
  const second = play(restored, 'g1', 'f3').position;
  assert.equal(second.openingPending, false);
  assert.equal(second.team, 'b');
});

test('repetition distinguishes an unused single opening from a later identical board', () => {
  const settings = { balancedOpening: true };
  const initial = createPosition(undefined, { settings });
  const initialKey = Object.keys(initial.repetition)[0];
  const revisited = createPosition(undefined, { settings, openingPending: false });
  assert.notEqual(Object.keys(revisited.repetition)[0], initialKey);
  const restored = createPosition(undefined, { settings, openingPending: false, repetition: { [initialKey]: 3 } });
  assert.equal(restored.result, null);
  assert.equal(movesRemaining(restored), 2);
  assert.throws(() => createPosition(undefined, { settings, openingPending: true, slot: 1 }), /not valid/);
});

test('teammates may move the same piece twice without hidden passes', () => {
  const first = play(createPosition(), 'e2', 'e3');
  const second = play(first.position, 'e3', 'e4');
  assert.equal(second.position.team, 'b');
  assert.equal(second.position.halfmove, 0);
  assert.equal(second.position.turnNumber, 1);
  assert.equal(first.move.endsTurn, false);
  assert.equal(second.move.endsTurn, true);
});

test('a first-slot check ends the pair and an escape can keep the responding second slot', () => {
  const position = createPosition('4k3/8/8/8/8/8/K7/R7 w - - 0 1');
  const checked = play(position, 'a1', 'e1');
  assert.equal(checked.move.givesCheck, true);
  assert.equal(checked.move.endsTurn, true);
  assert.equal(checked.position.team, 'b');
  assert.equal(checked.position.slot, 0);
  assert.equal(isInCheck(checked.position), true);
  assert.throws(() => play(checked.position, 'e8', 'e7'), /not legal/);
  const escape = play(checked.position, 'e8', 'd7');
  assert.equal(escape.position.team, 'b');
  assert.equal(escape.position.slot, 1);
  assert.equal(isInCheck(escape.position), false);
});

test('escaping check with countercheck ends the responding pair immediately', () => {
  const position = createPosition('r7/4k3/8/8/8/8/1B6/K7 w - - 0 1');
  assert.equal(isInCheck(position), true);
  const result = play(position, 'b2', 'a3');
  assert.equal(result.move.givesCheck, true);
  assert.equal(result.position.team, 'b');
  assert.equal(result.position.slot, 0);
});

test('mate at a handoff beats the hundredth quiet-move draw', () => {
  const position = createPosition('7k/8/6K1/5Q2/8/8/8/8 w - - 99 1');
  const result = play(position, 'f5', 'f8');
  assert.deepEqual(result.position.result, { winner: 'w', reason: 'checkmate' });
  assert.equal(result.position.halfmove, 100);
  assert.equal(result.move.endsTurn, true);
});

test('opponent stalemate is considered at handoff, not halfway through a pair', () => {
  const fen = '7k/8/6K1/5Q2/8/8/8/8 w - - 0 1';
  const intermediate = play(createPosition(fen), 'f5', 'f7');
  assert.equal(intermediate.position.result, null);
  assert.equal(intermediate.position.slot, 1);
  const completed = play(createPosition(fen, { slot: 1 }), 'f5', 'f7');
  assert.deepEqual(completed.position.result, { winner: null, reason: 'stalemate' });
});

test('an impossible second move is skipped instead of declaring intermediate stalemate', () => {
  const position = createPosition('8/8/8/8/p7/8/P6r/K1k5 w - - 0 1');
  const next = play(position, 'a2', 'a3');
  assert.equal(next.move.givesCheck, false);
  assert.equal(next.move.endsTurn, true);
  assert.equal(next.position.team, 'b');
  assert.equal(next.position.slot, 0);
  assert.equal(next.position.result, null);
});

test('castling is one move, preserves the teammate move, and removes rights', () => {
  const next = play(createPosition('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'e1', 'g1');
  assert.equal(next.move.castle, 'kingside');
  assert.equal(next.position.slot, 1);
  assert.equal(next.position.fen.split(' ')[2], 'kq');
  assert.match(next.position.fen, /R4RK1/);
  const attacked = createPosition('4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1');
  assert.equal(legalMoves(attacked, 'e1').some((move) => move.to === 'g1'), false);
});

test('en passant exists only immediately after the last move of a pair', () => {
  const fen = '7k/8/8/8/3p4/8/4P3/K7 w - - 0 1';
  const finalPush = play(createPosition(fen, { slot: 1 }), 'e2', 'e4');
  assert.equal(finalPush.position.fen.split(' ')[3], 'e3');
  const capture = play(finalPush.position, 'd4', 'e3');
  assert.equal(capture.move.captured, 'p');
  assert.equal(capture.move.captureSquare, 'e4');
  assert.equal(capture.position.fen.split(' ')[3], '-');
  const firstPush = play(createPosition(fen), 'e2', 'e4');
  assert.equal(firstPush.position.fen.split(' ')[3], '-');
  const next = play(firstPush.position, 'a1', 'b1');
  assert.throws(() => play(next.position, 'd4', 'e3'), /not legal/);
  const declined = play(finalPush.position, 'h8', 'g8');
  assert.throws(() => play(declined.position, 'd4', 'e3'), /not legal/);
});

test('all promotion choices work and a newly promoted piece may move again', () => {
  const fen = '8/P7/7k/8/8/8/8/K7 w - - 0 1';
  assert.throws(() => play(createPosition(fen), 'a7', 'a8'), /not legal/);
  for (const promotion of ['q', 'r', 'b', 'n']) {
    const result = play(createPosition(fen), 'a7', 'a8', promotion);
    assert.equal(result.move.promotion, promotion);
    assert.equal(result.position.slot, 1);
  }
  const promoted = play(createPosition(fen), 'a7', 'a8', 'q');
  assert.doesNotThrow(() => play(promoted.position, 'a8', 'b8'));
});

test('capture-promotion records the actual captured piece and destination', () => {
  const position = createPosition('1r6/P7/7k/8/8/8/8/K7 w - - 0 1');
  const next = play(position, 'a7', 'b8', 'n');
  assert.equal(next.move.captured, 'r');
  assert.equal(next.move.captureSquare, 'b8');
  assert.equal(next.move.promotion, 'n');
});

test('repetition counts team boundaries and survives reconstruction', () => {
  let position = createPosition('6nk/8/8/8/8/8/8/K5N1 w - - 0 1');
  const initialKey = Object.keys(position.repetition)[0];
  for (let cycle = 0; cycle < 2; cycle += 1) {
    for (const [from, to] of [['g1', 'f3'], ['f3', 'g1'], ['g8', 'f6'], ['f6', 'g8']]) {
      position = play(position, from, to).position;
    }
    if (cycle === 0) {
      assert.equal(position.repetition[initialKey], 2);
      position = createPosition(position.fen, position);
      assert.equal(position.result, null);
    }
  }
  assert.deepEqual(position.result, { winner: null, reason: 'repetition' });
  assert.equal(Object.keys(position.repetition).length, 2);
});

test('a non-capturable en passant field does not make a distinct repetition position', () => {
  const position = createPosition('7k/8/8/8/4P3/8/8/K7 b - e3 0 1');
  assert.equal(Object.keys(position.repetition)[0].split(' ')[3], '-');
});

test('hundredth quiet move draws immediately, while a pawn move resets the count', () => {
  const position = createPosition('6nk/8/8/8/8/8/8/K5N1 w - - 99 1');
  const drawn = play(position, 'g1', 'f3').position;
  assert.deepEqual(drawn.result, { winner: null, reason: 'fifty-move' });
  assert.deepEqual(legalMoves(drawn), []);
  const pawn = play(createPosition(START_FEN, { halfmove: 99 }), 'e2', 'e4').position;
  assert.equal(pawn.halfmove, 0);
  assert.equal(pawn.result, null);
});

test('only bare kings is assumed to be an automatic dead position', () => {
  assert.deepEqual(createPosition('7k/8/8/8/8/8/8/K7 w - - 0 1').result,
    { winner: null, reason: 'bare-kings' });
  assert.equal(createPosition('7k/8/8/8/8/8/8/KB6 w - - 0 1').result, null);
});

test('invalid actions are safe and neither valid nor invalid actions mutate their input', () => {
  const position = createPosition();
  const snapshot = JSON.stringify(position);
  Object.freeze(position.repetition);
  Object.freeze(position);
  assert.throws(() => play(position, 'e2', 'e5'), /not legal/);
  assert.throws(() => play(position, 'x2', 'e4'), /valid starting/);
  assert.throws(() => play(position, 'e2', 'e4', 'k'), /valid starting/);
  assert.doesNotThrow(() => play(position, 'e2', 'e4'));
  assert.equal(JSON.stringify(position), snapshot);
  assert.throws(() => createPosition('8/8/8/8/8/8/8/K7 w - - 0 1'), /not valid/);
  assert.throws(() => createPosition(START_FEN, { team: 'b' }), /turn is not valid/);
  assert.throws(() => createPosition('4k3/8/8/8/8/8/4R3/K7 w - - 0 1'), /checking move/);
  const impossible = { ...position, fen: '4k3/8/8/8/8/8/4R3/K7 w - - 0 1' };
  assert.equal(legalMoves(impossible).some((move) => move.captured === 'k'), false);
  assert.throws(() => play(impossible, 'e2', 'e8'), /never captured/);
});
