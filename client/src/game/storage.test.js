import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMove, createPosition, RULESET } from './rules.js';
import { StorageError, exportMatch, exportMoveList, importMatch, loadPreferences, savePreferences, validateSavedMatch, saveMatch } from './storage.js';
import { battleDetails, battleSpec } from './battles.js';
import { DEFAULT_MATCH_CONFIG } from './types.js';

function matchFixture(moves = [], { balancedOpening = false } = {}) {
  const settings = { balancedOpening, fullTwoMoveOpening: !balancedOpening };
  const initialPosition = createPosition(undefined, { settings });
  let position = initialPosition;
  const events = moves.map((move, index) => {
    const applied = applyMove(position, { from: move.slice(0, 2), to: move.slice(2, 4), ...(move[4] ? { promotion: move[4] } : {}) });
    position = applied.position;
    return { ...applied.move, id: `event-${index + 1}`, seed: index + 10, variant: 'pawn-thrust', duration: 850, combo: false, positionAfter: position };
  });
  return {
    formatVersion: 1, rulesVersion: RULESET, id: 'match-test', revision: events.length,
    createdAt: '2026-11-10T12:00:00.000Z', updatedAt: '2026-11-10T12:00:00.000Z',
    config: { humanColor: 'w', teammateDifficulty: 'medium', opponentDifficulty: 'easy', timeControl: 'untimed', balancedOpening },
    settings,
    initialPosition, position, events, clocks: { enabled: false, w: 0, b: 0, increment: 0 },
    preview: null, lockedMove: null, phase: 'planning', assisted: { hints: 0, undos: 0 },
  };
}

test('save round trip rebuilds legal history and keeps battle variations', () => {
  const original = matchFixture(['e2e4', 'd2d4', 'e7e5', 'd7d5', 'e4d5', 'd4e5']);
  original.events[5].combo = true;
  original.events[5].variant = 'pawn-underdog';
  original.events[5].underdog = true;
  original.events[0].movementVariant = 'pawn-step';
  const saved = validateSavedMatch(JSON.parse(exportMatch(original)));
  assert.deepEqual(saved.position, original.position);
  assert.equal(saved.events[5].variant, 'pawn-underdog');
  assert.equal(saved.events[5].combo, true);
  assert.equal(saved.events[5].underdog, true);
  assert.equal(saved.events[5].seed, original.events[5].seed);
  assert.equal(saved.events[0].movementVariant, 'pawn-step');
  assert.equal(saved.events[4].captureSquare, 'd5');
  assert.deepEqual(saved.events[5].positionAfter, saved.position);
});

function finisherFixture() {
  const match = matchFixture(['e2e4', 'd2d4', 'e7e5', 'd7d5', 'e4d5', 'd4e5']);
  for (const index of [4, 5]) {
    const event = match.events[index];
    Object.assign(event, battleDetails(event, match.events.slice(0, index), 'w', index, { deferFinisher: index === 4 }));
  }
  return match;
}

test('new capture records preserve every visual choice and allied echo on export and reconstruction', () => {
  const original = finisherFixture();
  const saved = validateSavedMatch(JSON.parse(exportMatch(original)));
  for (const index of [4, 5]) {
    for (const key of ['presentationVersion', 'seed', 'variant', 'duration', 'reactionVariant', 'finisher']) {
      assert.deepEqual(saved.events[index][key], original.events[index][key]);
    }
  }
  assert.equal(saved.events[4].finisher, undefined);
  assert.equal(saved.events[5].finisher.echo.from, 'e4');
  assert.equal(battleSpec(saved.events[5], { finishers: false }).duration, saved.events[5].finisher.baseDuration);
  saved.events[5].finisher.echo.from = 'a1';
  assert.equal(original.events[5].finisher.echo.from, 'e4', 'Saved records do not share mutable echo objects');
});

test('safe unknown future presentation names survive imports and use ordinary playback', () => {
  const match = finisherFixture();
  match.events[5].finisher.id = 'future-pawn-finish';
  match.events[5].reactionVariant = 'future-pawn-reaction';
  match.events[5].presentationVersion = 3;
  const saved = validateSavedMatch(JSON.parse(exportMatch(match)));
  assert.deepEqual(saved.events[5].finisher, match.events[5].finisher);
  assert.equal(saved.events[5].reactionVariant, 'future-pawn-reaction');
  assert.equal(saved.events[5].presentationVersion, 3);
  assert.equal(battleSpec(saved.events[5]).finisher, null);
  assert.equal(battleSpec(saved.events[5]).duration, saved.events[5].finisher.baseDuration);
});

test('malformed capture metadata and forged allied echoes are rejected before replay', () => {
  const patches = [
    event => { event.presentationVersion = '2'; },
    event => { event.reactionVariant = 8; },
    event => { event.reactionVariant = 'queen-crownfall'; },
    event => { event.finisher = null; },
    event => { event.finisher.id = 'king-royal-judgment'; },
    event => { event.finisher.baseDuration = -1; },
    event => { event.finisher.echo.from = 'a1'; },
    event => { event.finisher.echo.piece = 'q'; },
    event => { event.finisher.echo.injected = true; },
    event => { event.duration = 9999; },
  ];
  for (const patch of patches) {
    const match = finisherFixture();
    patch(match.events[5]);
    assert.throws(() => validateSavedMatch(match), error => error.code === 'invalid-save');
  }
  const quiet = matchFixture(['e2e4']);
  Object.assign(quiet.events[0], { presentationVersion: 2, reactionVariant: 'pawn-launch' });
  assert.throws(() => validateSavedMatch(quiet), /quiet move/);
});

test('balanced opening survives save and replay with one White opening move', () => {
  const original = matchFixture(['e2e4', 'e7e5', 'd7d5', 'g1f3', 'd2d4'], { balancedOpening: true });
  const saved = validateSavedMatch(JSON.parse(exportMatch(original)));
  assert.deepEqual(saved.settings, { balancedOpening: true, fullTwoMoveOpening: false });
  assert.equal(saved.config.balancedOpening, true);
  assert.deepEqual(saved.events.map(event => event.seat), ['w1', 'b1', 'b2', 'w1', 'w2']);
  assert.equal(saved.initialPosition.openingPending, true);
  assert.equal(saved.events[0].positionAfter.openingPending, false);
  assert.deepEqual(saved.position, original.position);
  assert.match(exportMoveList(saved), /Balanced — White has one opening move/);
});

test('balanced opening previews need no teammate follow-up and preserve that promise', () => {
  const original = matchFixture([], { balancedOpening: true });
  original.preview = { status: 'ready', first: { from: 'e2', to: 'e4' }, second: null, explanation: 'White has one opening move.' };
  const saved = validateSavedMatch(JSON.parse(exportMatch(original)));
  assert.equal(saved.preview.second, null);
  assert.equal(saved.preview.afterFirst.team, 'b');
  assert.equal(saved.preview.afterFirst.openingPending, false);
});

test('existing v1 progress without opening settings keeps the full two-move opening', () => {
  const original = matchFixture(['e2e4', 'd2d4', 'e7e5', 'd7d5']);
  const legacy = structuredClone(original);
  delete legacy.settings;
  delete legacy.config.balancedOpening;
  for (const position of [legacy.initialPosition, legacy.position, ...legacy.events.map(event => event.positionAfter)]) {
    delete position.settings;
    delete position.openingPending;
  }
  const saved = validateSavedMatch(legacy);
  assert.deepEqual(saved.settings, { balancedOpening: false, fullTwoMoveOpening: true });
  assert.deepEqual(saved.position, original.position);
  assert.deepEqual(saved.events.map(event => event.seat), ['w1', 'w2', 'b1', 'b2']);
  assert.equal(saved.id, original.id);
});

test('a full-opening game saved during upgrade keeps its pending teammate move', () => {
  const legacy = matchFixture(['e2e4']);
  delete legacy.settings;
  delete legacy.config.balancedOpening;
  delete legacy.initialPosition.settings;
  delete legacy.initialPosition.openingPending;
  legacy.position.openingPending = false;
  legacy.lockedMove = { from: 'd2', to: 'd4' };
  const saved = validateSavedMatch(legacy);
  assert.equal(saved.position.slot, 1);
  assert.equal(saved.position.openingPending, true);
  assert.deepEqual(saved.lockedMove, legacy.lockedMove);
});

test('contradictory or forged opening rules are rejected before restoration', () => {
  const inconsistent = matchFixture();
  inconsistent.settings.balancedOpening = true;
  assert.throws(() => validateSavedMatch(inconsistent), /opening rules contradict/);
  const forged = matchFixture(['e2e4'], { balancedOpening: true });
  forged.position.openingPending = true;
  assert.throws(() => validateSavedMatch(forged), /opening progress/);
});

test('forged computed snapshots are replaced with verified positions', () => {
  const match = matchFixture(['e2e4']);
  match.events[0].positionAfter = { fen: 'forged', team: 'b' };
  match.events[0].positionBefore = { fen: 'also forged' };
  const restored = validateSavedMatch(match);
  assert.deepEqual(restored.events[0].positionBefore, restored.initialPosition);
  assert.deepEqual(restored.events[0].positionAfter, restored.position);
});

test('a promised teammate move survives loading unchanged', () => {
  const match = matchFixture(['e2e4']);
  match.lockedMove = { from: 'd2', to: 'd4' };
  match.phase = 'animating';
  const restored = validateSavedMatch(match);
  assert.deepEqual(restored.lockedMove, match.lockedMove);
  assert.equal(restored.position.slot, 1);
  match.lockedMove = { from: 'e7', to: 'e5' };
  assert.throws(() => validateSavedMatch(match), /promised teammate move/);
});

test('an unfinished opponent combination restores its locked second move', () => {
  const match = matchFixture(['e2e4', 'd2d4', 'e7e5']);
  match.lockedMove = { from: 'd7', to: 'd5' };
  match.phase = 'paused';
  const restored = validateSavedMatch(match);
  assert.equal(restored.position.team, 'b');
  assert.equal(restored.position.slot, 1);
  assert.deepEqual(restored.lockedMove, match.lockedMove);
});

test('portable files omit derived boards but retain undo clock checkpoints', () => {
  const match = matchFixture(['e2e4']);
  match.config.timeControl = '5+3';
  match.clocks = { w: 295000, b: 300000, increment: 3000, enabled: true };
  match.events[0].clocksBefore = { ...match.clocks };
  const text = exportMatch(match);
  const portable = JSON.parse(text);
  assert.equal(portable.events[0].positionAfter, undefined);
  const restored = validateSavedMatch(portable);
  assert.deepEqual(restored.events[0].clocksBefore, match.clocks);
  assert.deepEqual(restored.events[0].positionAfter, match.position);
});

test('preview restoration reconstructs both speculative boards', () => {
  const match = matchFixture();
  match.preview = { status: 'ready', first: { from: 'e2', to: 'e4' }, second: { from: 'g1', to: 'f3' }, explanation: 'Develop our knight.', afterFirst: { fen: 'untrusted' }, afterSecond: { fen: 'untrusted' } };
  const restored = validateSavedMatch(match);
  assert.equal(restored.preview.afterFirst.team, 'w');
  assert.equal(restored.preview.afterFirst.slot, 1);
  assert.equal(restored.preview.afterSecond.team, 'b');
  assert.equal(restored.preview.explanation, 'Develop our knight.');
  assert.equal(restored.events.length, 0);
});

test('illegal or altered move history is rejected', () => {
  const illegal = matchFixture(['e2e4']);
  illegal.events[0].to = 'e5';
  assert.throws(() => validateSavedMatch(illegal), /not legal/);
  const altered = matchFixture(['e2e4']);
  altered.position.fen = altered.initialPosition.fen;
  assert.throws(() => validateSavedMatch(altered), /final fen/);
  const wrongSeat = matchFixture(['e2e4']);
  wrongSeat.events[0].seat = 'b1';
  assert.throws(() => validateSavedMatch(wrongSeat), /recorded seat/);
});

test('duplicate move identities and invalid versions are rejected', () => {
  const match = matchFixture(['e2e4', 'd2d4']);
  match.events[1].id = match.events[0].id;
  assert.throws(() => validateSavedMatch(match), /duplicate/);
  const future = matchFixture();
  future.formatVersion = 99;
  assert.throws(() => validateSavedMatch(future), /unsupported/);
});

test('clock settings and nonfinite counters cannot enter a save', () => {
  const match = matchFixture();
  match.clocks.w = Infinity;
  assert.throws(() => validateSavedMatch(match), /White clock/);
  match.clocks.w = 0;
  match.clocks.increment = 5000;
  assert.throws(() => validateSavedMatch(match), /clock bonus/);
  match.clocks.increment = 0;
  match.assisted.hints = -1;
  assert.throws(() => validateSavedMatch(match), /hint count/);
});

test('manual results are constrained to valid resignation or timeout', () => {
  const match = matchFixture();
  match.position = { ...match.position, result: { winner: 'b', reason: 'resignation' } };
  assert.equal(validateSavedMatch(match).phase, 'finished');
  match.position.result.winner = 'w';
  assert.throws(() => validateSavedMatch(match), /resignation result/);
  match.position.result = { winner: 'b', reason: 'timeout' };
  assert.throws(() => validateSavedMatch(match), /timeout does not match/);
  match.config.timeControl = '5+3';
  match.clocks = { w: 0, b: 300000, enabled: true, increment: 3000 };
  assert.equal(validateSavedMatch(match).position.result.reason, 'timeout');
});

test('readable move export labels allied players and custom team turns', () => {
  const match = matchFixture(['e2e4', 'd2d4', 'e7e5', 'd7d5']);
  const text = exportMoveList(match);
  assert.match(text, /Custom team-turn record/);
  assert.match(text, /1\.1 {2}You \(White\): e4/);
  assert.match(text, /1\.2 {2}Your teammate \(White\): d4/);
  assert.match(text, /2\.1 {2}Opponent \(Black\): e5/);
});

test('damaged imports fail validation before attempting a storage write', async () => {
  await assert.rejects(importMatch('{'), (error) => error instanceof StorageError && error.code === 'invalid-save');
  await assert.rejects(importMatch('x'.repeat(5 * 1024 * 1024 + 1)), /smaller than 5 MB/);
  const malformed = matchFixture(['e2e4']);
  malformed.events[0].from = 'e7';
  await assert.rejects(importMatch(JSON.stringify(malformed)), (error) => error.code === 'invalid-save');
});

test('unavailable database reports a recoverable error', async () => {
  const original = globalThis.indexedDB;
  globalThis.indexedDB = undefined;
  try {
    await assert.rejects(saveMatch(matchFixture()), (error) => error instanceof StorageError && error.code === 'storage-unavailable');
  } finally {
    if (original === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = original;
  }
});

test('preferences round trip and unavailable settings storage is reported', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const records = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) } });
  try {
    assert.deepEqual(loadPreferences(), {});
    const preferences = { motion: 'reduced', volume: 0.4, sound: true, boardTheme: 'walnut', showCoordinates: false, finishers: false, boardShake: true, matchDefaults: { ...DEFAULT_MATCH_CONFIG, humanColor: 'b', balancedOpening: true } };
    savePreferences({ ...preferences, obsoleteSetting: 'ignored' });
    assert.deepEqual(loadPreferences(), preferences);
    for (const patch of [{ motion: 'spinning' }, { volume: 9 }, { sound: 'yes' }, { boardTheme: 'unknown' }, { showCoordinates: 'no' }, { finishers: 'yes' }, { boardShake: 0 }, { matchDefaults: { ...DEFAULT_MATCH_CONFIG, balancedOpening: 1 } }, { matchDefaults: { ...DEFAULT_MATCH_CONFIG, opponentDifficulty: 'impossible' } }, { matchDefaults: { humanColor: 'w' } }]) {
      assert.throws(() => savePreferences({ ...preferences, ...patch }), error => error.code === 'preferences-invalid');
      assert.deepEqual(loadPreferences(), preferences);
    }
    records.set('squadchess.preferences.v1', JSON.stringify({ boardTheme: 'unknown' }));
    assert.throws(() => loadPreferences(), error => error.code === 'preferences-invalid' && /Default settings/.test(error.message));
    records.set('squadchess.preferences.v1', '{broken');
    assert.throws(() => loadPreferences(), error => error.code === 'preferences-invalid');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Blocked'); } });
    assert.throws(() => loadPreferences(), (error) => error.code === 'preferences-unavailable');
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});
