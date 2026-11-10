import { BATTLE_REGISTRY, MOVEMENT_REGISTRY, REACTION_REGISTRY, resolveAttack, resolveMovement } from './choreography.js';
import { FINISHER_REGISTRY, REACTION_VARIANTS, alliedCapturePredecessor, selectFinisher, selectReactionVariant } from './finishers.js';
export { BATTLE_REGISTRY, MOVEMENT_REGISTRY, REACTION_REGISTRY, phaseTimings } from './choreography.js';
export { FINISHER_REGISTRY, REACTION_VARIANTS } from './finishers.js';

export const BATTLE_VARIANTS = Object.freeze(Object.fromEntries(Object.entries(BATTLE_REGISTRY).map(([piece, entries]) => [piece, Object.freeze(entries.map(entry => entry.id))])));

export const PIECE_NAMES = Object.freeze({
  p: 'Sentinel', n: 'Rider', b: 'Oracle', r: 'Bastion', q: 'Empress', k: 'Sovereign',
});

export function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function randomFromSeed(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function actorAccent(color, seat, humanColor = 'w') {
  const firstSeat = !seat || String(seat).endsWith('1') || seat === 'human';
  return color === humanColor
    ? (firstSeat ? '#f5c76e' : '#67dfc7')
    : (firstSeat ? '#fb7e8b' : '#bd9bff');
}

/** Keep the original attack selection unchanged for existing saved battles. */
function baseBattleDetails(move, previousEvents = [], humanColor = 'w', explicitSeed) {
  if (!move?.captured || move.captured === 'k' || !BATTLE_VARIANTS[move.piece]) return null;
  const color = move.color || String(move.seat || 'W1')[0].toLowerCase();
  const seed = typeof explicitSeed === 'number'
    ? explicitSeed >>> 0
    : hashSeed(explicitSeed ?? `${move.id ?? ''}:${move.from}:${move.to}:${move.piece}:${color}:${move.ply ?? previousEvents.length}`);
  const random = randomFromSeed(seed);
  const variants = BATTLE_VARIANTS[move.piece];
  const previousSamePiece = [...previousEvents].reverse().find((entry) =>
    entry.captured && entry.piece === move.piece && entry.variant);
  let index = Math.floor(random() * variants.length);
  const underdog = move.piece === 'p' && ['q', 'r'].includes(move.captured);
  if (underdog) index = 3;
  if (variants[index] === previousSamePiece?.variant) {
    index = (index + 1 + Math.floor(random() * (variants.length - 1))) % variants.length;
  }
  const previous = previousEvents.at(-1);
  const previousColor = previous?.color || String(previous?.seat || '')[0]?.toLowerCase();
  const combo = Boolean(previous?.captured && previousColor === color);
  const variant = variants[index];
  const choreography = resolveAttack(move.piece, variant);
  return {
    seed, variant, combo, underdog,
    title: choreography.title,
    accent: actorAccent(color, move.seat, humanColor),
    duration: Math.max(900, Math.min(1100, Math.round((920 + random() * 170) * choreography.durationScale))) + (combo || underdog || move.promotion ? 250 : 0),
  };
}

/** Pass all preceding accepted moves, including quiet moves, for cooldown and combos. */
export function battleDetails(move, previousEvents = [], humanColor = 'w', explicitSeed, options = {}) {
  const base = baseBattleDetails(move, previousEvents, humanColor, explicitSeed);
  if (!base) return null;
  const combo = Boolean(alliedCapturePredecessor(move, previousEvents));
  // Separate random streams preserve the original attack and duration choices.
  const reactionVariant = selectReactionVariant(move.captured, previousEvents, randomFromSeed(base.seed ^ 0x3c6ef372));
  const finisher = selectFinisher(move, previousEvents, {
    ...options, index: move.index ?? previousEvents.length,
    baseDuration: base.duration, random: randomFromSeed(base.seed ^ 0xa54ff53a),
  });
  return {
    ...base, combo, presentationVersion: 2, reactionVariant,
    ...(finisher ? { finisher, duration: FINISHER_REGISTRY[finisher.id].duration } : {}),
  };
}

export function battleSpec(event, preferences = {}) {
  if (!event?.captured || event.captured === 'k') return null;
  const defaults = baseBattleDetails(event, [], event.humanColor || 'w', event.seed);
  if (!defaults) return null;
  const variants = BATTLE_VARIANTS[event.piece];
  const variant = variants.includes(event.variant) ? event.variant : defaults.variant;
  const choreography = resolveAttack(event.piece, variant);
  const selectedReaction = event.presentationVersion === 2
    ? REACTION_VARIANTS[event.captured]?.find(entry => entry.id === event.reactionVariant) : null;
  const selectedFinisher = event.presentationVersion === 2 && selectedReaction && preferences.finishers !== false
    ? FINISHER_REGISTRY[event.finisher?.id] : null;
  const finisher = selectedFinisher?.piece === event.piece
    ? { ...selectedFinisher, ...event.finisher } : null;
  const ordinaryDuration = event.finisher ? event.finisher.baseDuration : event.duration;
  const duration = finisher
    ? (Number.isFinite(event.duration) ? Math.max(2300, Math.min(2800, event.duration)) : finisher.duration)
    : (Number.isFinite(ordinaryDuration) ? Math.max(200, Math.min(2400, ordinaryDuration)) : defaults.duration);
  return {
    ...defaults,
    ...event,
    variant,
    title: finisher?.title || choreography.title,
    choreography,
    finisher,
    reaction: selectedReaction || REACTION_REGISTRY[event.captured] || REACTION_REGISTRY.p,
    color: event.color || String(event.seat || 'W1')[0].toLowerCase(),
    captureSquare: event.captureSquare || event.to,
    duration,
  };
}

/** One playback clock for live turns, replay, audio, and reduced-motion modes. */
export function presentationDuration(event, preferences = {}) {
  if (!event || preferences.motion === 'off') return 0;
  if (preferences.motion === 'reduced') return 220;
  const captureDuration = battleSpec(event, preferences)?.duration;
  if (captureDuration) return captureDuration;
  return Math.max(movementSpec(event)?.duration || 270, specialMoveDetails(event)?.duration || 0);
}

export function movementDetails(move, previousEvents = [], humanColor = 'w', explicitSeed) {
  if (!move || move.captured || !MOVEMENT_REGISTRY[move.piece]) return null;
  const seed = typeof explicitSeed === 'number' ? explicitSeed >>> 0 : hashSeed(explicitSeed ?? `move:${move.id ?? ''}:${move.from}:${move.to}:${move.piece}:${move.ply ?? previousEvents.length}`);
  const random = randomFromSeed(seed);
  const options = MOVEMENT_REGISTRY[move.piece];
  const previous = [...previousEvents].reverse().find(entry => entry.piece === move.piece && entry.movementVariant);
  let index = Math.floor(random() * options.length);
  if (options[index].id === previous?.movementVariant) index = (index + 1) % options.length;
  const choreography = options[index];
  const from = squareCenter(move.from);
  const to = squareCenter(move.to);
  const distance = from && to ? Math.hypot(to.x - from.x, to.y - from.y) / 12.5 : 1;
  return {
    seed, movementVariant: choreography.id,
    duration: Math.max(350, Math.min(650, Math.round((330 + distance * 37 + random() * 25) * choreography.durationScale))),
    accent: actorAccent(move.color || 'w', move.seat, humanColor),
  };
}

export function movementSpec(event) {
  const defaults = movementDetails(event, [], event?.humanColor || 'w', event?.seed);
  if (!defaults) return null;
  const choreography = resolveMovement(event.piece, event.movementVariant || defaults.movementVariant);
  return {
    ...defaults, ...event,
    movementVariant: choreography.id,
    choreography,
    companion: castlingRookSquares(event),
    duration: Number.isFinite(event.duration) ? Math.max(200, Math.min(1500, event.duration)) : defaults.duration,
  };
}

export function castlingRookSquares(event) {
  if (event?.piece !== 'k' || !['kingside', 'queenside'].includes(event.castle) || !/^[a-h][18]$/.test(event.from || '')) return null;
  const rank = event.from[1];
  return { from: `${event.castle === 'kingside' ? 'h' : 'a'}${rank}`, to: `${event.castle === 'kingside' ? 'f' : 'd'}${rank}` };
}

export function squareCenter(square, orientation = 'white') {
  if (!/^[a-h][1-8]$/.test(square || '')) return null;
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return orientation === 'black'
    ? { x: (7 - file + 0.5) * 12.5, y: (rank + 0.5) * 12.5 }
    : { x: (file + 0.5) * 12.5, y: (7 - rank + 0.5) * 12.5 };
}

/** Keep enlarged characters inside the board, including their largest authored pose. */
export function presentationUnitGeometry(centers, preferredWidth = 18, maximumScale = 1.2) {
  const width = Math.min(preferredWidth, ...centers.map(center => Math.min(
    2 * Math.min(center.x, 100 - center.x) / maximumScale,
    (center.y + 6.25) / (1.2 * maximumScale),
  )));
  const height = width * 1.2;
  return { width, height, topOffset: -(height - 6.25) };
}

export function specialMoveDetails(event) {
  if (!event || event.captured) return null;
  if (event.promotion) return { kind: 'promotion', title: `${PIECE_NAMES[event.promotion]} awakened`, duration: 900, square: event.to };
  if (event.castle) return { kind: 'castle', title: 'Royal passage', duration: 720, square: event.to };
  if (!event.givesCheck) return null;
  let kingSquare = event.checkSquare;
  if (!kingSquare && event.afterFen) {
    const enemyKing = event.color === 'w' ? 'k' : 'K';
    const rows = event.afterFen.split(' ')[0].split('/');
    for (let rank = 0; rank < rows.length; rank += 1) {
      let file = 0;
      for (const character of rows[rank]) {
        if (/\d/.test(character)) file += Number(character);
        else {
          if (character === enemyKing) kingSquare = `${String.fromCharCode(97 + file)}${8 - rank}`;
          file += 1;
        }
      }
    }
  }
  return { kind: 'check', title: 'The crown is threatened', duration: 640, square: kingSquare || event.to };
}
