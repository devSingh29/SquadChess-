import { createPosition, applyMove, RULESET } from './rules.js';
import { battleDetails, specialMoveDetails, hashSeed } from './battles.js';
import { saveMatch } from './storage.js';

export const DEFAULT_CONFIG = { humanColor: 'w', teammateDifficulty: 'medium', opponentDifficulty: 'easy', timeControl: 'untimed', balancedOpening: false };
export const DEFAULT_PREFERENCES = { motion: 'full', sound: true, volume: 0.35 };
const other = color => color === 'w' ? 'b' : 'w';
const copyMove = move => ({ from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) });
const clockConfig = control => control === '5+3' ? { w: 300000, b: 300000, increment: 3000, enabled: true } : control === '10+5' ? { w: 600000, b: 600000, increment: 5000, enabled: true } : { w: 0, b: 0, increment: 0, enabled: false };
const now = () => performance.now();

export function createMatch(config = {}) {
  const configuration = { ...DEFAULT_CONFIG, ...config };
  const settings = { balancedOpening: !!configuration.balancedOpening, fullTwoMoveOpening: !configuration.balancedOpening };
  const initialPosition = createPosition(undefined, { settings });
  return {
    id: crypto.randomUUID(), formatVersion: 1, rulesVersion: RULESET,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    config: configuration, settings, initialPosition, position: initialPosition, events: [], revision: 0,
    clocks: clockConfig(configuration.timeControl), assisted: { hints: 0, undos: 0 },
    phase: configuration.humanColor === 'w' ? 'planning' : 'thinking', preview: null, lockedMove: null,
  };
}

export function browserSearch(request, signal) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./engine.worker.js', import.meta.url), { type: 'module' });
    const timer = setTimeout(() => finish(new Error('The teammate took too long to respond. Your game is safe.')), 12000);
    function finish(error, result) {
      clearTimeout(timer); worker.terminate(); signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(result);
    }
    function abort() { const error = new Error('Search cancelled'); error.name = 'AbortError'; finish(error); }
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => {
      if (data.id !== request.id || data.revision !== request.revision) return;
      if (data.error) finish(new Error(typeof data.error === 'string' ? data.error : data.error.message));
      else finish(null, data.result);
    };
    worker.onerror = () => finish(new Error('The computer player could not start. Your game is safe; retry to continue.'));
    worker.postMessage(request);
  });
}

export class GameController {
  constructor({ search = browserSearch, save = saveMatch, tick = true } = {}) {
    this.search = search; this.save = save; this.listeners = new Set();
    this.state = { match: null, presentation: null, notice: '', hinting: false };
    this.preferences = DEFAULT_PREFERENCES; this.epoch = 0; this.lastTick = now(); this.saveChain = Promise.resolve();
    this.lastSaved = now();
    if (tick) this.clockTimer = setInterval(() => this.chargeClock(), 200);
  }
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = () => this.state;
  publish(patch) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  update(patch, persist = true) {
    if (!this.state.match) return;
    this.publish({ match: { ...this.state.match, ...patch, updatedAt: new Date().toISOString() } });
    if (persist) this.persist();
  }
  persist() {
    const snapshot = this.state.match;
    if (!snapshot) return;
    this.lastSaved = now();
    this.saveChain = this.saveChain.catch(() => {}).then(() => this.save(snapshot)).catch(error => {
      this.publish({ notice: error?.message || 'Saving is unavailable. Export your game to keep a copy.' });
    });
  }
  clearNotice = () => this.publish({ notice: '' });
  setPreferences = preferences => { this.preferences = { ...DEFAULT_PREFERENCES, ...preferences }; };
  cancel() {
    this.epoch++; this.abortController?.abort(); this.abortController = null;
    clearTimeout(this.presentationTimer); this.publish({ hinting: false });
  }
  destroy() { this.cancel(); clearInterval(this.clockTimer); this.listeners.clear(); }
  start = config => {
    this.cancel(); this.lastTick = now();
    this.publish({ match: createMatch(config), presentation: null, notice: '' });
    this.persist(); this.advance();
  };
  load = match => {
    this.cancel(); this.lastTick = now();
    const phase = match.position.result ? 'finished' : 'paused';
    this.publish({ match: { ...match, phase, error: null }, presentation: null, notice: '' });
    this.persist();
  };
  chargeClock() {
    const current = now(); const elapsed = Math.max(0, current - this.lastTick); this.lastTick = current;
    const match = this.state.match;
    if (!match || !match.clocks.enabled || match.position.result || !['planning', 'thinking'].includes(match.phase)) return;
    const color = match.position.team;
    const remaining = Math.max(0, match.clocks[color] - elapsed);
    if (!remaining) {
      this.cancel();
      const enemy = other(color);
      const letters = match.position.fen.split(' ')[0].replace(/[^a-zA-Z]/g, '');
      const enemyPieces = [...letters].filter(p => enemy === 'w' ? p === p.toUpperCase() : p === p.toLowerCase());
      const winner = enemyPieces.length === 1 ? null : enemy;
      this.publish({ presentation: null });
      this.update({ clocks: { ...match.clocks, [color]: 0 }, position: { ...match.position, result: { winner, reason: winner ? 'timeout' : 'timeout-bare-king' } }, phase: 'finished', preview: null, lockedMove: null });
      return;
    }
    this.update({ clocks: { ...match.clocks, [color]: remaining } }, false);
    if (current - this.lastSaved > 5000) this.persist();
  }
  isHumanPlanning() {
    const match = this.state.match;
    return match && !match.position.result && match.phase === 'planning' && match.position.team === match.config.humanColor && match.position.slot === 0;
  }
  async request(position, difficulty) {
    const match = this.state.match; const epoch = this.epoch;
    this.abortController = new AbortController();
    let result;
    try {
      result = await this.search({ id: crypto.randomUUID(), revision: match.revision, position, difficulty, seed: hashSeed(`${match.id}:${match.events.length}:${position.fen}`) }, this.abortController.signal);
    } catch (error) {
      if (epoch !== this.epoch || this.state.match?.id !== match.id || this.state.match?.revision !== match.revision) {
        const cancelled = new Error('Outdated search'); cancelled.name = 'AbortError'; throw cancelled;
      }
      throw error;
    }
    if (epoch !== this.epoch || this.state.match?.id !== match.id || this.state.match?.revision !== match.revision) {
      const error = new Error('Outdated search'); error.name = 'AbortError'; throw error;
    }
    return result;
  }
  fail(error) {
    if (error?.name === 'AbortError') return;
    this.chargeClock();
    if (this.state.match?.position.result) return;
    this.update({ phase: 'error', error: error?.message || 'The computer player stopped. Retry to continue.' });
    this.publish({ hinting: false });
  }
  propose = async first => {
    if (!this.isHumanPlanning()) return;
    this.chargeClock(); if (!this.isHumanPlanning()) return;
    this.cancel();
    const match = this.state.match;
    try {
      const firstMove = copyMove(first);
      const applied = applyMove(match.position, firstMove);
      const preview = { first: firstMove, second: null, afterFirst: applied.position, afterSecond: null, status: 'thinking', explanation: '' };
      if (applied.position.result || applied.position.team !== match.position.team || applied.position.slot !== 1) {
        preview.status = 'ready';
        preview.explanation = applied.move.givesCheck ? 'Check ends our turn. The opposing squad must answer immediately.' : match.position.settings?.balancedOpening && match.position.openingPending ? 'Balanced opening: White plays one move. I’ll join in from our next team turn.' : 'This move finishes the turn. No teammate follow-up is needed.';
        this.update({ preview }); return;
      }
      this.update({ preview });
      const result = await this.request(applied.position, match.config.teammateDifficulty);
      const second = copyMove(result.move);
      const afterSecond = applyMove(applied.position, second).position;
      this.update({ preview: { ...preview, second, afterSecond, status: 'ready', explanation: result.explanation || 'I’ll follow your lead with this move.' } });
    } catch (error) { this.fail(error); }
  };
  cancelPreview = () => {
    if (!this.isHumanPlanning()) return;
    this.cancel(); this.update({ preview: null });
  };
  hint = async () => {
    if (!this.isHumanPlanning()) return;
    this.chargeClock(); if (!this.isHumanPlanning()) return;
    this.cancel(); this.update({ preview: null }); this.publish({ hinting: true });
    try {
      const result = await this.request(this.state.match.position, this.state.match.config.teammateDifficulty);
      const assisted = this.state.match.assisted;
      this.update({ assisted: { ...assisted, hints: assisted.hints + 1 } });
      this.publish({ hinting: false }); await this.propose(result.move);
    } catch (error) { this.fail(error); }
  };
  confirm = () => {
    if (!this.isHumanPlanning() || this.state.match.preview?.status !== 'ready') return;
    this.chargeClock(); if (!this.isHumanPlanning()) return;
    const preview = this.state.match.preview;
    try {
      const first = applyMove(this.state.match.position, preview.first);
      if (preview.second) applyMove(first.position, preview.second);
      this.cancel(); this.commit(preview.first, preview.second);
    } catch (error) { this.fail(error); }
  };
  commit(move, lockedMove = this.state.match?.lockedMove) {
    this.chargeClock();
    const match = this.state.match; if (!match || match.position.result) return;
    const { position, move: details } = applyMove(match.position, move);
    const special = details.captured ? null : specialMoveDetails(details);
    const event = {
      ...details, id: `${match.id}:${match.events.length + 1}:${crypto.randomUUID().slice(0, 8)}`,
      index: match.events.length, positionAfter: position, clocksBefore: { ...match.clocks }, humanColor: match.config.humanColor,
      ...(details.captured ? battleDetails(details, match.events, match.config.humanColor, hashSeed(`${match.id}:${match.events.length}:${details.from}:${details.to}`)) : special ? { duration: special.duration, title: special.title } : {}),
    };
    const clocks = { ...match.clocks };
    if (details.endsTurn && clocks.enabled) clocks[match.position.team] += clocks.increment;
    const phase = 'animating';
    this.update({ position, events: [...match.events, event], revision: match.revision + 1, clocks, phase,
      lockedMove: position.slot === 1 && position.team === match.position.team && !position.result ? lockedMove : null,
      preview: null, error: null });
    this.publish({ presentation: event });
    const motion = this.preferences.motion;
    const duration = motion === 'off' ? 0 : motion === 'reduced' ? 220 : (event.duration || 270);
    this.presentationTimer = setTimeout(() => this.finishPresentation(event.id), duration + (motion === 'off' ? 0 : 60));
  }
  finishPresentation = id => {
    if (this.state.presentation?.id !== id) return;
    clearTimeout(this.presentationTimer); this.publish({ presentation: null });
    if (this.state.match.position.result) { this.update({ phase: 'finished' }); return; }
    this.advance();
  };
  skipAnimation = () => { if (this.state.presentation) this.finishPresentation(this.state.presentation.id); };
  async advance() {
    const match = this.state.match;
    if (!match || match.position.result) { if (match) this.update({ phase: 'finished' }); return; }
    this.lastTick = now();
    if (match.position.slot === 1 && match.lockedMove) {
      this.update({ phase: 'thinking' });
      try { this.commit(match.lockedMove); } catch (error) { this.fail(error); }
      return;
    }
    if (match.position.team === match.config.humanColor && match.position.slot === 0) {
      this.update({ phase: 'planning' });
      if (match.preview?.first && match.preview.status !== 'ready') this.propose(match.preview.first);
      return;
    }
    this.update({ phase: 'thinking' });
    try {
      const difficulty = match.position.team === match.config.humanColor ? match.config.teammateDifficulty : match.config.opponentDifficulty;
      const result = await this.request(match.position, difficulty);
      const first = applyMove(match.position, result.move);
      let continuation = null;
      if (!first.position.result && first.position.team === match.position.team && first.position.slot === 1) {
        if (!result.continuation) throw new Error('The computer’s combination was incomplete. Retry to make a fresh plan.');
        applyMove(first.position, result.continuation);
        continuation = result.continuation;
      }
      this.commit(result.move, continuation);
    } catch (error) { this.fail(error); }
  }
  pause = () => {
    const match = this.state.match;
    if (!match || match.position.result || match.phase === 'paused') return;
    this.chargeClock(); if (this.state.match.position.result) return;
    this.cancel(); this.publish({ presentation: null }); this.update({ phase: 'paused' });
  };
  resume = () => {
    if (!this.state.match || !['paused', 'error'].includes(this.state.match.phase)) return;
    this.cancel(); this.update({ error: null }); this.advance();
  };
  undo = () => {
    const match = this.state.match; if (!match || match.position.result) return;
    let index = -1;
    for (let i = match.events.length - 1; i >= 0; i--) {
      if (match.events[i].color === match.config.humanColor && match.events[i].seat.endsWith('1')) { index = i; break; }
    }
    if (index < 0) return;
    this.cancel(); const first = match.events[index];
    const position = index === 0 ? match.initialPosition : match.events[index - 1].positionAfter;
    this.publish({ presentation: null });
    this.update({ position, events: match.events.slice(0, index), revision: match.revision + 1, clocks: first.clocksBefore || match.clocks,
      phase: 'planning', preview: null, lockedMove: null, error: null, assisted: { ...match.assisted, undos: match.assisted.undos + 1 } });
    this.lastTick = now();
  };
  resign = () => {
    const match = this.state.match; if (!match || match.position.result) return;
    this.cancel(); this.publish({ presentation: null });
    this.update({ position: { ...match.position, result: { winner: other(match.config.humanColor), reason: 'resignation' } }, phase: 'finished', preview: null, lockedMove: null });
  };
}
