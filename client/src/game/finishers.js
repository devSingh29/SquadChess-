import { REACTION_REGISTRY } from './choreography.js';

const FINISHER_PHASES = Object.freeze({ anticipation: .16, attack: .2485, impact: .05, settle: .5415 });
const finisher = (id, piece, title, duration) => Object.freeze({ id, piece, title, duration, motionName: id, phases: FINISHER_PHASES });

/** These IDs are saved in matches. Keep them stable when artwork changes. */
export const FINISHER_REGISTRY = Object.freeze(Object.fromEntries([
  finisher('pawn-giants-fall', 'p', 'Giant’s Fall', 2500),
  finisher('pawn-spearline', 'p', 'Spearline', 2300),
  finisher('knight-thunderhoof', 'n', 'Thunderhoof', 2500),
  finisher('knight-skybreaker', 'n', 'Skybreaker', 2700),
  finisher('bishop-astral-gate', 'b', 'Astral Gate', 2600),
  finisher('bishop-runic-fault', 'b', 'Runic Fault', 2500),
  finisher('rook-earthbreaker', 'r', 'Earthbreaker', 2700),
  finisher('rook-citadel-crush', 'r', 'Citadel Crush', 2800),
  finisher('queen-gravity-crown', 'q', 'Gravity Crown', 2700),
  finisher('queen-starfall', 'q', 'Starfall', 2800),
  finisher('king-royal-judgment', 'k', 'Royal Judgment', 2500),
  finisher('king-crowns-wrath', 'k', 'Crown’s Wrath', 2700),
].map(entry => [entry.id, entry])));

const reaction = (piece, id, title) => Object.freeze({ ...REACTION_REGISTRY[piece], id, motionName: id, title });
export const REACTION_VARIANTS = Object.freeze({
  p: Object.freeze([reaction('p', 'pawn-shield-break', 'Shield break'), reaction('p', 'pawn-launch', 'Sentinel launched'), reaction('p', 'pawn-dissolve', 'Sentinel dissolves')]),
  n: Object.freeze([reaction('n', 'knight-unseat', 'Rider unseated'), reaction('n', 'knight-collapse', 'Rider collapses'), reaction('n', 'knight-scatter', 'Rider scatters')]),
  b: Object.freeze([reaction('b', 'bishop-unravel', 'Oracle unravels'), reaction('b', 'bishop-shatter', 'Oracle shatters'), reaction('b', 'bishop-vanish', 'Oracle vanishes')]),
  r: Object.freeze([reaction('r', 'rook-fracture', 'Bastion fractures'), reaction('r', 'rook-topple', 'Bastion topples'), reaction('r', 'rook-crumble', 'Bastion crumbles')]),
  q: Object.freeze([reaction('q', 'queen-crownfall', 'Crown falls'), reaction('q', 'queen-disperse', 'Empress disperses'), reaction('q', 'queen-collapse', 'Empress collapses')]),
});

const colorOf = move => move?.color || String(move?.seat || '')[0]?.toLowerCase();

export function alliedCapturePredecessor(move, history) {
  const previous = history.at(-1);
  if (!previous?.captured || previous.endsTurn || colorOf(previous) !== colorOf(move)) return null;
  if (!String(move.seat || '').endsWith('2') || !String(previous.seat || '').endsWith('1')) return null;
  return previous;
}

function variedChoice(entries, previousId, random) {
  const choices = entries.filter(entry => entry.id !== previousId);
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}

export function selectReactionVariant(captured, history, random) {
  const entries = REACTION_VARIANTS[captured];
  if (!entries) return null;
  const previous = [...history].reverse().find(event => event.captured === captured && event.reactionVariant);
  return variedChoice(entries, previous?.reactionVariant, random).id;
}

/** Select only from accepted move facts. Preferences affect playback, never history. */
export function selectFinisher(move, history, { random, baseDuration, index = history.length, deferFinisher = false, result = null } = {}) {
  if (!move.captured || move.captured === 'k' || deferFinisher) return null;
  const previous = alliedCapturePredecessor(move, history);
  const eligible = move.promotion || ['q', 'r'].includes(move.captured) || previous || result?.reason === 'checkmate';
  if (!eligible) return null;
  const previousFinishIndex = history.findLastIndex(event => event.finisher);
  if (previousFinishIndex >= 0) {
    const recordedIndex = history[previousFinishIndex].index;
    const lastIndex = Number.isInteger(recordedIndex) ? recordedIndex : previousFinishIndex;
    if (index - lastIndex < 8) return null;
  }
  const entries = Object.values(FINISHER_REGISTRY).filter(entry => entry.piece === move.piece);
  if (!entries.length) return null;
  const lastOfRole = [...history].reverse().find(event => event.piece === move.piece && event.finisher)?.finisher.id;
  const selected = variedChoice(entries, lastOfRole, random);
  const echo = previous ? {
    from: previous.from, to: previous.to, piece: previous.piece, color: colorOf(previous),
    seat: previous.seat.toLowerCase(), captureSquare: previous.captureSquare || previous.to,
  } : null;
  return { id: selected.id, baseDuration, ...(echo ? { echo } : {}) };
}
