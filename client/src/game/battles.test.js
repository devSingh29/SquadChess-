import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { actorAccent, BATTLE_REGISTRY, BATTLE_VARIANTS, MOVEMENT_REGISTRY, REACTION_REGISTRY, battleDetails, battleSpec, hashSeed, movementDetails, movementSpec, phaseTimings, randomFromSeed, specialMoveDetails, squareCenter } from './battles.js';

const capture = { id: 'move-1', from: 'e4', to: 'd5', piece: 'p', color: 'w', seat: 'W1', captured: 'p' };

test('saved battle choices reproduce identically, including zero-valued seeds', () => {
  const first = battleDetails(capture, [], 'w', 0);
  assert.equal(first.seed, 0);
  assert.deepEqual(battleDetails(capture, [], 'w', 0), first);
  const replay = battleSpec({ ...capture, ...first });
  assert.equal(replay.variant, first.variant);
  assert.equal(replay.seed, first.seed);
  assert.equal(replay.duration, first.duration);
});

test('all six attackers have four sequences and never repeat their previous capture sequence', () => {
  assert.equal(new Set(Object.values(BATTLE_VARIANTS).flat()).size, 24);
  for (const piece of Object.keys(BATTLE_VARIANTS)) {
    const history = [];
    const observed = new Set();
    for (let index = 0; index < 80; index += 1) {
      const move = { ...capture, id: `${piece}-${index}`, piece };
      const detail = battleDetails(move, history, 'w', index);
      assert.notEqual(detail.variant, history.at(-1)?.variant);
      assert.ok(BATTLE_VARIANTS[piece].includes(detail.variant));
      history.push({ ...move, ...detail });
      observed.add(detail.variant);
    }
    assert.equal(observed.size, 4);
  }
});

test('same-attacker repeat prevention survives other piece captures between turns', () => {
  const first = { ...capture, ...battleDetails(capture, [], 'w', 18) };
  const intervening = { ...capture, piece: 'n', color: 'b', seat: 'B1', variant: 'knight-vault' };
  const next = battleDetails(capture, [first, intervening], 'w', 18);
  assert.notEqual(next.variant, first.variant);
});

test('a squad combo requires consecutive captures by the same color', () => {
  assert.equal(battleDetails({ ...capture, seat: 'W2' }, [capture]).combo, true);
  assert.equal(battleDetails(capture, [{ ...capture, color: 'b', seat: 'B1' }]).combo, false);
  assert.equal(battleDetails(capture, [capture, { ...capture, captured: undefined }]).combo, false);
  assert.equal(battleDetails(capture, []).combo, false);
});

test('pawn captures of major pieces get a giant-slayer treatment without consecutive repetition', () => {
  const firstMove = { ...capture, captured: 'q' };
  const first = battleDetails(firstMove, [], 'w', 8);
  assert.equal(first.underdog, true);
  assert.equal(first.variant, 'pawn-underdog');
  const next = battleDetails({ ...capture, captured: 'r' }, [{ ...firstMove, ...first }], 'w', 8);
  assert.equal(next.underdog, true);
  assert.notEqual(next.variant, first.variant);
  assert.equal(battleDetails(capture).underdog, false);
});

test('actor colors follow the human team when the human chooses black', () => {
  assert.equal(actorAccent('b', 'B1', 'b'), '#f5c76e');
  assert.equal(actorAccent('b', 'B2', 'b'), '#67dfc7');
  assert.equal(actorAccent('w', 'W1', 'b'), '#fb7e8b');
  assert.equal(actorAccent('w', 'W2', 'b'), '#bd9bff');
});

test('en passant animates the actual captured square and orientation mirrors both coordinates', () => {
  const event = battleSpec({ ...capture, from: 'e5', to: 'd6', captureSquare: 'd5' });
  assert.equal(event.captureSquare, 'd5');
  assert.deepEqual(squareCenter('a8'), { x: 6.25, y: 6.25 });
  assert.deepEqual(squareCenter('a8', 'black'), { x: 93.75, y: 93.75 });
  const white = squareCenter(event.captureSquare);
  const black = squareCenter(event.captureSquare, 'black');
  assert.equal(white.x + black.x, 100);
  assert.equal(white.y + black.y, 100);
  assert.equal(squareCenter('z9'), null);
});

test('quiet moves and king captures never create capture battles', () => {
  assert.equal(battleDetails({ ...capture, captured: undefined }), null);
  assert.equal(battleDetails({ ...capture, captured: 'k' }), null);
  assert.equal(battleSpec({ ...capture, captured: 'k' }), null);
  assert.equal(battleSpec(null), null);
});

test('bad imported effect settings fall back to a known sequence and bounded duration', () => {
  const event = battleSpec({ ...capture, variant: 'not-a-sequence', duration: 999999 });
  assert.ok(BATTLE_VARIANTS.p.includes(event.variant));
  assert.equal(event.duration, 2400);
  assert.equal(battleSpec({ ...capture, duration: -20 }).duration, 200);
});

test('seed generators are repeatable and remain within the expected range', () => {
  assert.equal(hashSeed('squad-combination'), hashSeed('squad-combination'));
  assert.notEqual(hashSeed('first-move'), hashSeed('second-move'));
  const a = randomFromSeed(18);
  const b = randomFromSeed(18);
  for (let index = 0; index < 30; index += 1) {
    const value = a();
    assert.equal(value, b());
    assert.ok(value >= 0 && value < 1);
  }
});

test('ordinary captures last 900–1100ms and special combinations remain under 1500ms', () => {
  for (let seed = 0; seed < 100; seed += 1) {
    const normal = battleDetails(capture, [], 'w', seed);
    assert.ok(normal.duration >= 900 && normal.duration <= 1100);
    const special = battleDetails({ ...capture, captured: 'q' }, [capture], 'w', seed);
    assert.ok(special.duration >= 900 && special.duration <= 1500);
  }
});

test('quiet special moves identify promotion, castling, and the checked king', () => {
  const quiet = { from: 'e2', to: 'e4', piece: 'p', color: 'w' };
  assert.equal(specialMoveDetails(quiet), null);
  assert.equal(specialMoveDetails({ ...quiet, promotion: 'n' }).kind, 'promotion');
  assert.equal(specialMoveDetails({ ...quiet, castle: 'kingside' }).kind, 'castle');
  const check = specialMoveDetails({ ...quiet, givesCheck: true, afterFen: '4k3/8/8/8/8/8/8/4K3 b - - 0 1' });
  assert.equal(check.kind, 'check');
  assert.equal(check.square, 'e8');
  const blackCheck = specialMoveDetails({ ...quiet, color: 'b', givesCheck: true, afterFen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1' });
  assert.equal(blackCheck.square, 'e1');
  assert.equal(specialMoveDetails({ ...capture, givesCheck: true }), null);
});

test('every registered capture, victim reaction, and ordinary movement ships its named animation', () => {
  const battleCss = readFileSync(new URL('../components/battle.css', import.meta.url), 'utf8');
  const movementCss = readFileSync(new URL('../components/movement.css', import.meta.url), 'utf8');
  for (const entry of Object.values(BATTLE_REGISTRY).flat()) {
    assert.ok(battleCss.includes(`@keyframes ${entry.motionName} {`), `Missing capture motion: ${entry.motionName}`);
    assert.ok(battleCss.includes(`[data-variant="${entry.id}"]`), `Missing selectable capture: ${entry.id}`);
  }
  for (const entry of Object.values(REACTION_REGISTRY)) {
    assert.ok(battleCss.includes(`@keyframes ${entry.motionName} {`), `Missing reaction: ${entry.motionName}`);
  }
  for (const entry of Object.values(MOVEMENT_REGISTRY).flat()) {
    assert.ok(movementCss.includes(`@keyframes ${entry.motionName} {`), `Missing ordinary movement: ${entry.motionName}`);
  }
});

test('capture phases partition the duration and align the impact hold with the authored strike', () => {
  for (const entry of Object.values(BATTLE_REGISTRY).flat()) {
    const timing = phaseTimings(entry, 1000);
    assert.ok(timing.anticipation > 0 && timing.attack > 0 && timing.impact > 0 && timing.settle > 0);
    assert.ok(Math.abs(timing.anticipation + timing.attack + timing.impact + timing.settle - 1000) < .00001);
    assert.ok(Math.abs(timing.impactAt / timing.motion - .43) < .00001);
    assert.equal(timing.settleAt, timing.impactAt + timing.impact);
  }
});

test('ordinary movements cover every role, vary without repetition, and remain short', () => {
  for (const piece of Object.keys(MOVEMENT_REGISTRY)) {
    const history = [];
    const seen = new Set();
    for (let seed = 0; seed < 12; seed += 1) {
      const move = { id: `quiet-${piece}-${seed}`, from: 'a1', to: seed % 2 ? 'h8' : 'a2', piece, color: 'w', seat: 'w1' };
      const details = movementDetails(move, history, 'w', seed);
      assert.ok(details.duration >= 350 && details.duration <= 650);
      assert.notEqual(details.movementVariant, history.at(-1)?.movementVariant);
      assert.deepEqual(movementDetails(move, history, 'w', seed), details);
      seen.add(details.movementVariant);
      history.push({ ...move, ...details });
    }
    assert.equal(seen.size, 2);
  }
  assert.equal(movementDetails(capture), null);
});

test('ordinary movement replays use saved choices and tolerate unknown imported names', () => {
  const move = { from: 'c3', to: 'd5', piece: 'n', color: 'w', seat: 'w1' };
  const details = movementDetails(move, [], 'w', 0);
  const replay = movementSpec({ ...move, ...details });
  assert.equal(replay.seed, 0);
  assert.equal(replay.movementVariant, details.movementVariant);
  assert.equal(replay.duration, details.duration);
  assert.equal(movementSpec({ ...move, movementVariant: 'unknown' }).movementVariant, MOVEMENT_REGISTRY.n[0].id);
});

test('capture-promotion preserves the final role and reserves a bounded coronation finish', () => {
  const move = { ...capture, from: 'b7', to: 'a8', captured: 'n', promotion: 'q' };
  const details = battleDetails(move, [], 'w', 4);
  const event = battleSpec({ ...move, ...details });
  assert.equal(event.piece, 'p');
  assert.equal(event.promotion, 'q');
  assert.ok(event.duration >= 1150 && event.duration <= 1350);
});
