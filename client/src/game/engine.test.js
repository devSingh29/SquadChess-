import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMove, createPosition, legalMoves } from './rules.js';
import { evaluatePosition, explainMove, searchPosition } from './engine.js';

const isLegal = (position, action) => legalMoves(position).some((move) =>
  move.from === action?.from && move.to === action?.to && move.promotion === action?.promotion);

test('White computer finds a capture requiring both consecutive team moves', () => {
  const position = createPosition('7k/8/8/8/8/1q6/8/R6K w - - 0 1');
  const result = searchPosition(position, { difficulty: 'easy', budgetMs: 1500 });
  assert.ok(isLegal(position, result.move));
  const first = applyMove(position, result.move);
  assert.equal(first.position.team, 'w');
  assert.ok(isLegal(first.position, result.continuation));
  const second = applyMove(first.position, result.continuation);
  assert.equal(second.move.captured, 'q');
  assert.ok(result.score > 0);
});

test('Black computer cooperates twice rather than maximizing the opponent score', () => {
  const position = createPosition('r6k/8/1Q6/8/8/8/8/7K b - - 0 1');
  const result = searchPosition(position, { difficulty: 'easy', budgetMs: 1500 });
  const first = applyMove(position, result.move);
  assert.equal(first.position.team, 'b');
  const second = applyMove(first.position, result.continuation);
  assert.equal(second.move.captured, 'q');
  assert.ok(result.score < 0);
});

test('a mating first move is selected and has no invented teammate reply', () => {
  const position = createPosition('7k/8/6K1/5Q2/8/8/8/8 w - - 0 1');
  const result = searchPosition(position, { difficulty: 'hard', budgetMs: 1000 });
  const next = applyMove(position, result.move);
  assert.deepEqual(next.position.result, { winner: 'w', reason: 'checkmate' });
  assert.equal(result.continuation, null);
  assert.match(result.explanation, /Checkmate/);
});

test('Hard sees an opposing two-move mating threat and makes room to survive it', () => {
  const position = createPosition('3qk2r/8/8/2b5/8/8/5PPP/5RK1 w - - 0 1', { slot: 1 });
  let greedyLine = applyMove(position, { from: 'g2', to: 'g4' }).position;
  greedyLine = applyMove(greedyLine, { from: 'd8', to: 'h4' }).position;
  greedyLine = applyMove(greedyLine, { from: 'h4', to: 'h2' }).position;
  assert.deepEqual(greedyLine.result, { winner: 'b', reason: 'checkmate' });
  const result = searchPosition(position, { difficulty: 'hard' });
  assert.ok(result.depth >= 2, 'The search must complete the opposing pair.');
  const defended = applyMove(position, result.move).position;
  for (const firstMove of legalMoves(defended)) {
    const first = applyMove(defended, firstMove).position;
    assert.notDeepEqual(first.result, { winner: 'b', reason: 'checkmate' });
    if (first.team !== 'b' || first.result) continue;
    for (const secondMove of legalMoves(first)) {
      const second = applyMove(first, secondMove).position;
      assert.notDeepEqual(second.result, { winner: 'b', reason: 'checkmate' });
    }
  }
});

test('board scoring recognizes mobility, king pressure, pawn shelter, and promotion threats', () => {
  const evaluate = (fen) => evaluatePosition(createPosition(fen));
  const trappedBishop = evaluate('7k/8/8/8/8/8/3P1P2/4B2K w - - 0 1');
  const activeBishop = evaluate('7k/8/8/8/8/3P1P2/8/4B2K w - - 0 1');
  assert.ok(activeBishop > trappedBishop + 30);
  const attackedKing = evaluate('7k/8/8/8/8/6q1/5PPP/5RK1 w - - 0 1');
  const distantQueen = evaluate('7k/8/8/8/8/q7/5PPP/5RK1 w - - 0 1');
  assert.ok(attackedKing < distantQueen - 30);
  const shelter = evaluate('r6k/8/8/8/8/8/5PPP/6K1 w - - 0 1');
  const exposed = evaluate('r6k/8/8/8/5PPP/8/8/6K1 w - - 0 1');
  assert.ok(shelter > exposed);
  const farPawn = evaluate('7k/8/8/8/8/8/P7/7K w - - 0 1');
  const nearPromotion = evaluate('7k/8/P7/8/8/8/8/7K w - - 0 1');
  assert.ok(nearPromotion > farPawn + 60);
});

test('Easy varies close quiet choices reproducibly with the seed', () => {
  const position = createPosition();
  const run = (seed) => searchPosition(position, { difficulty: 'easy', budgetMs: 1000, seed });
  const a = run(0);
  const b = run(1);
  const repeated = run(0);
  assert.notDeepEqual(a.move, b.move);
  assert.deepEqual(a.move, repeated.move);
  assert.deepEqual(a.continuation, repeated.continuation);
  assert.ok(Math.abs(a.score - b.score) <= 24);
  for (const result of [a, b]) {
    assert.ok(isLegal(position, result.move));
    assert.ok(isLegal(applyMove(position, result.move).position, result.continuation));
  }
});

test('Easy variation never passes up an immediate mate or free recapture', () => {
  const mate = createPosition('7k/8/6K1/5Q2/8/8/8/8 w - - 0 1');
  const capture = createPosition('7k/8/8/8/8/q7/8/R6K w - - 0 1', { slot: 1 });
  for (const seed of [0, 1]) {
    const mating = searchPosition(mate, { difficulty: 'easy', budgetMs: 1000, seed });
    assert.deepEqual(applyMove(mate, mating.move).position.result, { winner: 'w', reason: 'checkmate' });
    const recapture = searchPosition(capture, { difficulty: 'easy', budgetMs: 1000, seed });
    assert.equal(applyMove(capture, recapture.move).move.captured, 'q');
  }
});

test('balanced-opening search returns one White move but still plans a full Black pair', () => {
  const position = createPosition(undefined, { settings: { balancedOpening: true } });
  const white = searchPosition(position, { difficulty: 'easy', budgetMs: 100 });
  assert.ok(isLegal(position, white.move));
  assert.equal(white.continuation, null);
  const afterWhite = applyMove(position, white.move).position;
  assert.equal(afterWhite.team, 'b');
  const black = searchPosition(afterWhite, { difficulty: 'easy', budgetMs: 100 });
  const afterBlack = applyMove(afterWhite, black.move).position;
  if (!afterBlack.result && afterBlack.team === 'b') assert.ok(isLegal(afterBlack, black.continuation));
});

test('tiny budgets still return a legal complete pair and never mutate the position', () => {
  const position = createPosition();
  const snapshot = JSON.stringify(position);
  const result = searchPosition(position, { difficulty: 'hard', budgetMs: 1 });
  assert.ok(isLegal(position, result.move));
  const first = applyMove(position, result.move);
  if (first.position.team === position.team && !first.position.result) {
    assert.ok(isLegal(first.position, result.continuation));
  }
  assert.equal(JSON.stringify(position), snapshot);
  assert.ok(Number.isFinite(result.score));
  const anotherSeed = searchPosition(position, { difficulty: 'hard', budgetMs: 1, seed: 991 });
  assert.deepEqual(anotherSeed.move, result.move);
  assert.deepEqual(anotherSeed.continuation, result.continuation);
});

test('slot-one preview returns exactly one move and no opponent move as continuation', () => {
  const position = applyMove(createPosition(), { from: 'e2', to: 'e4' }).position;
  const result = searchPosition(position, { difficulty: 'medium', budgetMs: 100 });
  assert.ok(isLegal(position, result.move));
  assert.equal(result.continuation, null);
});

test('computer search refuses finished games and explanations state visible facts', () => {
  const finished = createPosition('7k/8/8/8/8/8/8/K7 w - - 0 1');
  assert.throws(() => searchPosition(finished), /no legal moves/);
  const position = createPosition('7k/8/8/8/3p4/8/4P3/K7 w - - 0 1', { slot: 1 });
  const push = applyMove(position, { from: 'e2', to: 'e4' });
  const capture = applyMove(push.position, { from: 'd4', to: 'e3' });
  assert.equal(explainMove(push.position, capture.move, capture.position), 'Captures a pawn on e4.');
});

test('worker preserves request identity on both successful and failed searches', async () => {
  const messages = [];
  const previous = globalThis.self;
  const fakeWorker = { postMessage: (message) => messages.push(message) };
  globalThis.self = fakeWorker;
  try {
    await import('./engine.worker.js');
    fakeWorker.onmessage({ data: { id: 'preview-7', revision: 14, position: createPosition(), budgetMs: 1 } });
    assert.equal(messages[0].id, 'preview-7');
    assert.equal(messages[0].revision, 14);
    assert.ok(isLegal(createPosition(), messages[0].result.move));
    fakeWorker.onmessage({ data: { id: 'preview-8', revision: 15, position: null } });
    assert.equal(messages[1].id, 'preview-8');
    assert.equal(messages[1].revision, 15);
    assert.equal(typeof messages[1].error, 'string');
  } finally {
    if (previous === undefined) delete globalThis.self;
    else globalThis.self = previous;
  }
});
