import { applyMove, createPosition, RULESET } from './rules.js';
import { FINISHER_REGISTRY, REACTION_VARIANTS } from './finishers.js';
import { DEFAULT_MATCH_CONFIG } from './types.js';

const DATABASE_NAME = 'squadchess-local';
const DATABASE_VERSION = 1;
const PREFERENCES_KEY = 'squadchess.preferences.v1';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_EVENTS = 10000;
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const PHASES = new Set(['planning', 'thinking', 'animating', 'paused', 'error', 'finished']);
const CONTROLS = { untimed: { increment: 0 }, '5+3': { increment: 3000 }, '10+5': { increment: 5000 } };
const SQUARE = /^[a-h][1-8]$/;
let databasePromise;

export class StorageError extends Error {
  constructor(message, code = 'storage-unavailable', options) {
    super(message, options);
    this.name = 'StorageError';
    this.code = code;
  }
}

function invalid(message) {
  throw new StorageError(`This save cannot be opened: ${message}`, 'invalid-save');
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function boundedText(value, max, name, required = true) {
  if (!required && value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > max || (required && !value.length)) invalid(`${name} is invalid.`);
  return value;
}

function boundedNumber(value, min, max, name, integer = false) {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) invalid(`${name} is invalid.`);
  return value;
}

function clone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function movePayload(value, name) {
  if (!isObject(value) || !SQUARE.test(value.from) || !SQUARE.test(value.to)) invalid(`${name} has invalid squares.`);
  if (value.promotion != null && !['q', 'r', 'b', 'n'].includes(value.promotion)) invalid(`${name} has an invalid promotion.`);
  return { from: value.from, to: value.to, ...(value.promotion ? { promotion: value.promotion } : {}) };
}

function validatedApply(position, value, label) {
  const move = movePayload(value, label);
  try {
    return applyMove(position, move);
  } catch {
    invalid(`${label} is not legal under the SquadChess rules.`);
  }
}

function copyBattleData(event, move, previous) {
  const result = {};
  if (event.seed != null) result.seed = boundedNumber(event.seed, 0, 0xffffffff, 'battle variation', true);
  if (event.variant != null) result.variant = boundedText(event.variant, 64, 'battle style');
  if (event.movementVariant != null) result.movementVariant = boundedText(event.movementVariant, 64, 'movement style');
  if (event.duration != null) result.duration = boundedNumber(event.duration, 0, 10000, 'battle duration');
  for (const key of ['combo', 'underdog']) {
    if (event[key] != null) {
      if (typeof event[key] !== 'boolean') invalid(`battle ${key} is invalid.`);
      result[key] = event[key];
    }
  }
  for (const key of ['title', 'accent', 'attack', 'reaction', 'special']) {
    if (event[key] != null) result[key] = boundedText(event[key], 200, `battle ${key}`);
  }
  if (event.humanColor != null) {
    if (!['w', 'b'].includes(event.humanColor)) invalid('battle team is invalid.');
    result.humanColor = event.humanColor;
  }
  if (event.presentationVersion !== undefined || event.reactionVariant !== undefined || event.finisher !== undefined) {
    if (!move.captured) invalid('capture presentation data is attached to a quiet move.');
    result.presentationVersion = boundedNumber(event.presentationVersion, 2, 100, 'presentation version', true);
    result.reactionVariant = boundedText(event.reactionVariant, 64, 'victim reaction');
    const knownReaction = Object.entries(REACTION_VARIANTS).find(([, entries]) => entries.some(entry => entry.id === event.reactionVariant));
    if (knownReaction && knownReaction[0] !== move.captured) invalid('the victim reaction belongs to a different piece.');
    if (event.finisher !== undefined) {
      if (!isObject(event.finisher) || Object.keys(event.finisher).some(key => !['id', 'baseDuration', 'echo'].includes(key))) invalid('the capture finisher is invalid.');
      const id = boundedText(event.finisher.id, 64, 'finisher identity');
      const baseDuration = boundedNumber(event.finisher.baseDuration, 200, 2400, 'ordinary capture duration');
      boundedNumber(event.duration, 2300, 2800, 'finisher duration');
      const known = Object.hasOwn(FINISHER_REGISTRY, id) ? FINISHER_REGISTRY[id] : null;
      if (known && known.piece !== move.piece) invalid('the finisher belongs to a different attacker.');
      result.finisher = { id, baseDuration };
      if (event.finisher.echo !== undefined) {
        const echo = event.finisher.echo;
        const keys = ['from', 'to', 'piece', 'color', 'seat', 'captureSquare'];
        if (!isObject(echo) || Object.keys(echo).some(key => !keys.includes(key)) ||
          !previous?.captured || previous.endsTurn || previous.color !== move.color || previous.seat !== `${move.color}1` || move.seat !== `${move.color}2`) invalid('the allied capture echo is invalid.');
        for (const key of keys) {
          const expected = key === 'captureSquare' ? previous.captureSquare || previous.to : previous[key];
          if (echo[key] !== expected) invalid('the allied capture echo does not match the previous move.');
        }
        result.finisher.echo = Object.fromEntries(keys.map(key => [key, echo[key]]));
      }
    }
  }
  return result;
}

function sameResult(a, b) {
  return (!a && !b) || (a && b && a.reason === b.reason && a.winner === b.winner);
}

function validateClocks(clocks, timeControl) {
  if (!isObject(clocks) || typeof clocks.enabled !== 'boolean' || clocks.enabled !== (timeControl !== 'untimed')) invalid('clock settings do not match the match.');
  boundedNumber(clocks.w, 0, 86400000, 'White clock');
  boundedNumber(clocks.b, 0, 86400000, 'Black clock');
  if (clocks.increment !== CONTROLS[timeControl].increment) invalid('clock bonus is invalid.');
  return clone(clocks);
}

function ruleSettingsFor(value) {
  const modes = [];
  for (const [settings, label] of [
    [value.settings, 'match'],
    [value.initialPosition?.settings, 'starting position'],
    [value.position?.settings, 'saved position'],
  ]) {
    if (settings === undefined) continue;
    if (!isObject(settings)) invalid(`${label} rules are invalid.`);
    for (const key of ['balancedOpening', 'fullTwoMoveOpening']) {
      if (settings[key] !== undefined && typeof settings[key] !== 'boolean') invalid(`${label} opening rule is invalid.`);
    }
    if (settings.balancedOpening !== undefined) modes.push(settings.balancedOpening);
    if (settings.fullTwoMoveOpening !== undefined) modes.push(!settings.fullTwoMoveOpening);
  }
  if (value.config?.balancedOpening !== undefined) {
    if (typeof value.config.balancedOpening !== 'boolean') invalid('the configured opening rule is invalid.');
    modes.push(value.config.balancedOpening);
  }
  const balancedOpening = modes[0] ?? false;
  if (modes.some(mode => mode !== balancedOpening)) invalid('the saved opening rules contradict one another.');
  return { balancedOpening, fullTwoMoveOpening: !balancedOpening };
}

/** Rebuild every position from verified moves; imported computed snapshots are never trusted. */
export function validateSavedMatch(value) {
  if (!isObject(value)) invalid('the file does not contain a match.');
  if (value.formatVersion !== 1 || value.rulesVersion !== RULESET) invalid('this file uses an unsupported rules or save version.');
  boundedText(value.id, 128, 'match identity');
  if (!isObject(value.config) || !['w', 'b'].includes(value.config.humanColor)) invalid('your team is invalid.');
  if (!DIFFICULTIES.has(value.config.teammateDifficulty) || !DIFFICULTIES.has(value.config.opponentDifficulty)) invalid('difficulty settings are invalid.');
  if (!Object.hasOwn(CONTROLS, value.config.timeControl)) invalid('time control is invalid.');
  if (!PHASES.has(value.phase)) invalid('the saved game phase is invalid.');
  if (value.resumePhase != null && !PHASES.has(value.resumePhase)) invalid('the saved resume phase is invalid.');
  if (!Array.isArray(value.events) || value.events.length > MAX_EVENTS) invalid('the move list is too large or missing.');
  if (!isObject(value.initialPosition) || !isObject(value.position)) invalid('the board position is missing.');
  const settings = ruleSettingsFor(value);
  boundedText(value.initialPosition.fen, 160, 'starting board');
  boundedText(value.position.fen, 160, 'saved board');
  if (value.revision != null) boundedNumber(value.revision, 0, Number.MAX_SAFE_INTEGER, 'match revision', true);
  for (const key of ['createdAt', 'updatedAt']) {
    if (value[key] != null && (typeof value[key] !== 'string' || value[key].length > 40 || !Number.isFinite(Date.parse(value[key])))) invalid(`${key} is invalid.`);
  }
  const clocks = validateClocks(value.clocks, value.config.timeControl);
  const original = value.initialPosition;
  if (!['w', 'b'].includes(original.team) || ![0, 1].includes(original.slot)) invalid('the starting turn is invalid.');
  boundedNumber(original.halfmove, 0, 100, 'starting draw counter', true);
  boundedNumber(original.turnNumber, 1, 10000, 'starting turn number', true);
  for (const position of [original, value.position]) {
    if (position.openingPending !== undefined && typeof position.openingPending !== 'boolean') invalid('the opening progress is invalid.');
  }
  let initialPosition;
  try {
    initialPosition = createPosition(original.fen, {
      team: original.team,
      slot: original.slot,
      halfmove: original.halfmove,
      turnNumber: original.turnNumber,
      settings,
      ...(original.openingPending === undefined ? {} : { openingPending: original.openingPending }),
    });
  } catch {
    invalid('the starting position is invalid.');
  }
  let position = initialPosition;
  let previousEvent = null;
  const ids = new Set();
  const events = value.events.map((event, index) => {
    if (!isObject(event)) invalid(`move ${index + 1} is invalid.`);
    boundedText(event.id, 160, `move ${index + 1} identity`);
    if (ids.has(event.id)) invalid('the move list contains duplicate moves.');
    ids.add(event.id);
    const before = position;
    const applied = validatedApply(position, event, `Move ${index + 1}`);
    for (const key of ['beforeFen', 'afterFen', 'piece', 'color', 'seat', 'captured', 'captureSquare']) {
      if (event[key] != null && event[key] !== applied.move[key]) invalid(`move ${index + 1} does not match its recorded ${key}.`);
    }
    position = applied.position;
    const acceptedEvent = {
      ...applied.move,
      ...copyBattleData(event, applied.move, previousEvent),
      id: event.id,
      index,
      ...(event.clocksBefore ? { clocksBefore: validateClocks(event.clocksBefore, value.config.timeControl) } : {}),
      positionBefore: before,
      positionAfter: position,
    };
    previousEvent = acceptedEvent;
    return acceptedEvent;
  });
  for (const key of ['fen', 'team', 'slot', 'halfmove', 'turnNumber']) {
    if (value.position[key] !== position[key]) invalid(`the final ${key} does not match the move history.`);
  }
  // Legacy full-opening games did not track this flag. It cannot affect their
  // legal moves, so rebuild it without rejecting a mid-upgrade saved snapshot.
  if (settings.balancedOpening && value.position.openingPending !== undefined && value.position.openingPending !== position.openingPending) invalid('the final opening progress does not match the move history.');
  const suppliedResult = value.position.result;
  if (!sameResult(position.result, suppliedResult)) {
    if (position.result || !isObject(suppliedResult) || !['resignation', 'timeout', 'timeout-bare-king'].includes(suppliedResult.reason)) invalid('the result does not match the moves.');
    if (!['w', 'b', null].includes(suppliedResult.winner)) invalid('the winner is invalid.');
    if (suppliedResult.reason === 'resignation') {
      const opponent = value.config.humanColor === 'w' ? 'b' : 'w';
      if (suppliedResult.winner !== opponent) invalid('the resignation result is invalid.');
    } else {
      if (!clocks.enabled || clocks[position.team] !== 0) invalid('the timeout does not match the clock.');
      const opponent = position.team === 'w' ? 'b' : 'w';
      const board = position.fen.split(' ')[0];
      const opponentPieces = [...board].filter((piece) => opponent === 'w' ? /[PRNBQK]/.test(piece) : /[prnbqk]/.test(piece));
      const expectedWinner = opponentPieces.length === 1 ? null : opponent;
      if (suppliedResult.winner !== expectedWinner) invalid('the timeout winner is invalid.');
      if (suppliedResult.reason === 'timeout-bare-king' && expectedWinner !== null) invalid('the timeout draw is invalid.');
    }
    position = { ...position, result: { winner: suppliedResult.winner, reason: suppliedResult.reason } };
  }
  let lockedMove = null;
  let preview = null;
  if (!position.result && value.lockedMove != null) {
    if (position.slot !== 1) invalid('the locked teammate move belongs to the wrong turn.');
    validatedApply(position, value.lockedMove, 'The promised teammate move');
    lockedMove = movePayload(value.lockedMove, 'The promised teammate move');
  }
  if (!position.result && value.preview != null) {
    if (!isObject(value.preview) || position.slot !== 0 || position.team !== value.config.humanColor) invalid('the planned combination belongs to the wrong turn.');
    if (!['ready', 'thinking'].includes(value.preview.status)) invalid('the planned combination state is invalid.');
    const first = movePayload(value.preview.first, 'The planned first move');
    const afterFirst = validatedApply(position, first, 'The planned first move').position;
    let second = null;
    let afterSecond = null;
    if (value.preview.second != null) {
      if (afterFirst.result || afterFirst.team !== position.team || afterFirst.slot !== 1) invalid('the planned follow-up comes after the team turn ended.');
      second = movePayload(value.preview.second, 'The planned follow-up');
      afterSecond = validatedApply(afterFirst, second, 'The planned follow-up').position;
    }
    if (value.preview.status === 'ready' && !afterFirst.result && afterFirst.team === position.team && afterFirst.slot === 1 && !second) invalid('the promised follow-up is missing.');
    preview = {
      ...value.preview,
      first, second, afterFirst, afterSecond,
      explanation: typeof value.preview.explanation === 'string' ? value.preview.explanation.slice(0, 2000) : '',
    };
  }
  const assisted = { hints: 0, undos: 0, ...value.assisted };
  boundedNumber(assisted.hints, 0, 100000, 'hint count', true);
  boundedNumber(assisted.undos, 0, 100000, 'undo count', true);
  return {
    ...clone(value),
    settings,
    config: { ...value.config, balancedOpening: settings.balancedOpening },
    initialPosition,
    position,
    events,
    clocks,
    preview,
    lockedMove,
    assisted,
    phase: position.result ? 'finished' : value.phase,
  };
}

function storageFailure(error) {
  if (error instanceof StorageError) return error;
  const full = error?.name === 'QuotaExceededError';
  return new StorageError(full
    ? 'Your browser storage is full. Export this match, then remove an older match to make room.'
    : 'The browser could not save your game. You can keep playing and export a backup file.', full ? 'storage-full' : 'storage-unavailable', { cause: error });
}

async function openDatabase() {
  if (!globalThis.indexedDB) throw new StorageError('Game storage is unavailable in this browser. You can still play and export a backup.');
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('matches')) db.createObjectStore('matches', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      request.onerror = () => reject(storageFailure(request.error));
      request.onblocked = () => reject(new StorageError('Close another SquadChess tab and try saving again.'));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); databasePromise = undefined; };
        resolve(db);
      };
    }).catch((error) => { databasePromise = undefined; throw storageFailure(error); });
  }
  return databasePromise;
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(storageFailure(transaction.error));
    transaction.onabort = () => reject(storageFailure(transaction.error));
  });
}

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(storageFailure(request.error));
  });
}

export async function saveMatch(match) {
  if (!isObject(match) || typeof match.id !== 'string' || !match.id || match.id.length > 128) invalid('match identity is missing.');
  try {
    const saved = clone({ ...match, formatVersion: 1, rulesVersion: RULESET, updatedAt: new Date().toISOString() });
    const db = await openDatabase();
    const transaction = db.transaction(['matches', 'meta'], 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore('matches').put(saved);
    transaction.objectStore('meta').put({ key: 'active', id: saved.id });
    await done;
    return saved;
  } catch (error) {
    throw storageFailure(error);
  }
}

export async function loadMatch(id) {
  boundedText(id, 128, 'match identity');
  const db = await openDatabase();
  const value = await requestValue(db.transaction('matches', 'readonly').objectStore('matches').get(id));
  return value ? validateSavedMatch(value) : null;
}

export async function getSavedMatch() {
  const db = await openDatabase();
  const active = await requestValue(db.transaction('meta', 'readonly').objectStore('meta').get('active'));
  if (!active?.id) return null;
  return loadMatch(active.id);
}

export async function listMatches() {
  const db = await openDatabase();
  const matches = await requestValue(db.transaction('matches', 'readonly').objectStore('matches').getAll());
  return matches.sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
}

export async function deleteMatch(id) {
  boundedText(id, 128, 'match identity');
  const db = await openDatabase();
  const transaction = db.transaction(['matches', 'meta'], 'readwrite');
  const done = transactionDone(transaction);
  transaction.objectStore('matches').delete(id);
  const meta = transaction.objectStore('meta');
  const request = meta.get('active');
  request.onsuccess = () => { if (request.result?.id === id) meta.delete('active'); };
  await done;
}

export function exportMatch(match) {
  const valid = validateSavedMatch(match);
  // Checkpoints are rebuilt on import. Omitting them keeps long games compact.
  const events = valid.events.map((event) => {
    const compact = { ...event };
    delete compact.positionBefore;
    delete compact.positionAfter;
    return compact;
  });
  const preview = valid.preview ? { ...valid.preview } : null;
  if (preview) { delete preview.afterFirst; delete preview.afterSecond; }
  return JSON.stringify({ ...valid, events, preview }, null, 2);
}

export async function importMatch(text) {
  if (typeof text !== 'string' || text.length > MAX_FILE_SIZE || new Blob([text]).size > MAX_FILE_SIZE) invalid('files must be smaller than 5 MB.');
  let parsed;
  try { parsed = JSON.parse(text); } catch { invalid('the file is not readable SquadChess save data.'); }
  const valid = validateSavedMatch(parsed);
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const imported = { ...valid, id: `import-${suffix}`, importedFrom: valid.id, updatedAt: new Date().toISOString() };
  await saveMatch(imported);
  return imported;
}

export function exportMoveList(match) {
  const names = (seat) => seat[0] === match.config.humanColor
    ? (seat[1] === '1' ? 'You' : 'Your teammate')
    : (seat[1] === '1' ? 'Opponent' : "Opponent's teammate");
  const result = match.position.result;
  const winner = result?.winner ? `${result.winner === 'w' ? 'White' : 'Black'} wins` : 'Draw';
  const lines = [
    'SQUADCHESS — TWO MOVES, ONE PLAN',
    'Custom team-turn record. Each team normally moves twice; check ends the team turn.',
    `You: ${match.config.humanColor === 'w' ? 'White' : 'Black'}`,
    `Teammate: ${match.config.teammateDifficulty} · Opponents: ${match.config.opponentDifficulty}`,
    `Time control: ${match.config.timeControl}`,
    `Opening: ${match.settings?.balancedOpening || match.config.balancedOpening ? 'Balanced — White has one opening move, then both teams take pairs' : 'Full — White opens with two moves'}`,
    `Result: ${result ? `${winner} (${result.reason})` : 'In progress'}`,
    '',
  ];
  let turn = match.initialPosition.turnNumber;
  for (const event of match.events) {
    lines.push(`${turn}.${event.seat[1]}  ${names(event.seat)} (${event.color === 'w' ? 'White' : 'Black'}): ${event.san || `${event.from}-${event.to}`}${event.givesCheck ? ' — check ends team turn' : ''}`);
    if (event.endsTurn) turn += 1;
  }
  lines.push('', 'Definitions: check = a direct threat to the king; team turn = up to two consecutive moves by allied players.');
  return lines.join('\n');
}

function sanitizedPreferences(value) {
  if (!isObject(value)) throw new Error('Settings must be an object.');
  const preferences = {};
  for (const key of ['sound', 'showCoordinates', 'finishers', 'boardShake']) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== 'boolean') throw new Error(`${key} must be true or false.`);
    preferences[key] = value[key];
  }
  for (const [key, choices] of [['motion', ['full', 'reduced', 'off']], ['boardTheme', ['green', 'walnut', 'slate']]]) {
    if (value[key] === undefined) continue;
    if (!choices.includes(value[key])) throw new Error(`${key} is not a supported choice.`);
    preferences[key] = value[key];
  }
  if (value.volume !== undefined) {
    if (!Number.isFinite(value.volume) || value.volume < 0 || value.volume > 1) throw new Error('Volume must be between zero and one.');
    preferences.volume = value.volume;
  }
  if (value.matchDefaults !== undefined) {
    const defaults = value.matchDefaults;
    if (!isObject(defaults) || Object.keys(defaults).some(key => !Object.hasOwn(DEFAULT_MATCH_CONFIG, key)) ||
      !['w', 'b'].includes(defaults.humanColor) || !DIFFICULTIES.has(defaults.teammateDifficulty) ||
      !DIFFICULTIES.has(defaults.opponentDifficulty) || !Object.hasOwn(CONTROLS, defaults.timeControl) ||
      typeof defaults.balancedOpening !== 'boolean') throw new Error('New-match settings are invalid.');
    preferences.matchDefaults = { ...defaults };
  }
  return preferences;
}

export function loadPreferences() {
  let text;
  try {
    if (!globalThis.localStorage) throw new Error('Unavailable');
    text = globalThis.localStorage.getItem(PREFERENCES_KEY);
  } catch (error) {
    throw new StorageError('Your settings could not be loaded. Default settings will be used.', 'preferences-unavailable', { cause: error });
  }
  if (!text) return {};
  try {
    return sanitizedPreferences(JSON.parse(text));
  } catch (error) {
    throw new StorageError('Your saved settings are damaged or invalid. Default settings will be used.', 'preferences-invalid', { cause: error });
  }
}

export function savePreferences(preferences) {
  let clean;
  try { clean = sanitizedPreferences(preferences); }
  catch (error) {
    throw new StorageError('These settings contain an invalid value. Your previous settings have been kept.', 'preferences-invalid', { cause: error });
  }
  try {
    if (!globalThis.localStorage) throw new Error('Unavailable');
    globalThis.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(clean));
    return clean;
  } catch (error) {
    throw new StorageError('Your settings could not be saved in this browser. They will work for this visit.', 'preferences-unavailable', { cause: error });
  }
}
