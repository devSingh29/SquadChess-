import { applyMove, isInCheck, legalMoves } from './rules.js';

const VALUES = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 };
const NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const PRESETS = {
  easy: { budget: 200, maxDepth: 2 },
  medium: { budget: 700, maxDepth: 4 },
  hard: { budget: 1800, maxDepth: 6 },
};
const MATE = 1_000_000;
const TIMEOUT = Symbol('search-timeout');
const TYPES = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };
const MATERIAL = [0, 100, 320, 335, 500, 900, 0];
const MOBILITY = [0, 1, 3, 2, 2, 1, 0];
const PRESSURE = [0, 3, 3, 3, 4, 5, 1];
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
const KNIGHT_STEPS = [[1, 2], [-1, 2], [1, -2], [-1, -2], [2, 1], [-2, 1], [2, -1], [-2, -1]];
const targets = (square, steps) => steps.map(([df, dr]) => [square % 8 + df, Math.floor(square / 8) + dr])
  .filter(([file, rank]) => file >= 0 && file < 8 && rank >= 0 && rank < 8)
  .map(([file, rank]) => rank * 8 + file);
const KING_TARGETS = Array.from({ length: 64 }, (_, square) => targets(square, DIRECTIONS));
const KNIGHT_TARGETS = Array.from({ length: 64 }, (_, square) => targets(square, KNIGHT_STEPS));
const RAYS = Array.from({ length: 64 }, (_, square) => DIRECTIONS.map(([df, dr]) => {
  const ray = [];
  for (let file = square % 8 + df, rank = Math.floor(square / 8) + dr;
    file >= 0 && file < 8 && rank >= 0 && rank < 8; file += df, rank += dr) ray.push(rank * 8 + file);
  return ray;
}));
const CENTRALITY = Array.from({ length: 64 }, (_, square) =>
  7 - Math.abs(3.5 - square % 8) - Math.abs(3.5 - Math.floor(square / 8)));

const compact = (move) => move ? {
  from: move.from, to: move.to,
  ...(move.promotion ? { promotion: move.promotion } : {}),
} : null;
const moveKey = (move) => `${move.from}${move.to}${move.promotion || ''}`;

// Fast positional scoring, shared by all levels. Mobility counts reachable
// squares before king-safety filtering; the actual search still uses legal moves.
export function evaluatePosition(position, distance = 0) {
  if (position.result) {
    return position.result.winner === 'w' ? MATE - distance
      : position.result.winner === 'b' ? -MATE + distance : 0;
  }
  const board = new Int8Array(64);
  const occupied = [];
  const kings = [0, 0];
  const majors = [false, false];
  let rank = 7;
  let file = 0;
  for (const token of position.fen.split(' ')[0]) {
    if (token === '/') { rank -= 1; file = 0; continue; }
    const code = token.charCodeAt(0);
    if (code >= 49 && code <= 56) { file += code - 48; continue; }
    const type = token.toLowerCase();
    const white = token !== type;
    const square = rank * 8 + file;
    const value = TYPES[type];
    board[square] = white ? value : -value;
    occupied.push(square);
    if (value === 6) kings[white ? 0 : 1] = square;
    if (value === 4 || value === 5) majors[white ? 0 : 1] = true;
    file += 1;
  }
  const rings = new Uint8Array(64);
  for (let color = 0; color < 2; color += 1) {
    const bit = 1 << color;
    rings[kings[color]] |= bit;
    for (const square of KING_TARGETS[kings[color]]) rings[square] |= bit;
  }
  let score = 0;
  for (const square of occupied) {
    const signedPiece = board[square];
    const type = Math.abs(signedPiece);
    const white = signedPiece > 0;
    const sign = white ? 1 : -1;
    const enemy = white ? 1 : 0;
    const enemyRing = 1 << enemy;
    const rank = Math.floor(square / 8);
    const file = square % 8;
    const advancement = white ? rank : 7 - rank;
    const centrality = CENTRALITY[square];
    let bonus = 0;
    let mobility = 0;
    let pressure = 0;
    const attacks = (target) => {
      if (board[target] * signedPiece <= 0) mobility += 1;
      if (rings[target] & enemyRing) pressure += PRESSURE[type] * (target === kings[enemy] ? 2 : 1);
    };
    if (type === 1) {
      bonus = advancement * 8 + centrality * 3;
      const forward = square + sign * 8;
      if (forward >= 0 && forward < 64 && !board[forward]) {
        mobility += 1;
        if (advancement === 1 && !board[square + sign * 16]) mobility += 1;
      }
      for (const df of [-1, 1]) {
        if (file + df < 0 || file + df > 7) continue;
        const target = forward + df;
        if (target < 0 || target > 63) continue;
        if (board[target] * signedPiece < 0) mobility += 1;
        if (rings[target] & enemyRing) pressure += PRESSURE[type] * (target === kings[enemy] ? 2 : 1);
      }
      if (advancement >= 5) bonus += (advancement === 5 ? 28 : 80) + (!board[forward] ? 20 : 0);
    } else if (type === 2) {
      bonus = centrality * 12;
      for (const target of KNIGHT_TARGETS[square]) attacks(target);
    } else if (type === 6) {
      bonus = majors[enemy]
        ? (advancement <= 1 && (file === 6 || file === 2) ? 28 : -centrality * 3)
        : centrality * 5;
      for (const target of KING_TARGETS[square]) attacks(target);
      if (majors[enemy]) {
        for (let df = -1; df <= 1; df += 1) {
          if (file + df < 0 || file + df > 7) continue;
          const one = square + sign * 8 + df;
          const two = square + sign * 16 + df;
          bonus += board[one] === sign ? 14 : board[two] === sign ? 5 : -8;
        }
      }
    } else {
      if (type === 3) bonus = centrality * 5;
      if (type === 4) bonus = advancement === 6 ? 18 : 0;
      if (type === 5) bonus = centrality * 2;
      const start = type === 3 ? 4 : 0;
      const end = type === 4 ? 4 : 8;
      for (let direction = start; direction < end; direction += 1) {
        for (const target of RAYS[square][direction]) {
          attacks(target);
          if (board[target]) break;
        }
      }
    }
    score += sign * (MATERIAL[type] + bonus + mobility * MOBILITY[type] + pressure * 3);
  }
  return score;
}

function seededIndex(seed, count) {
  let value = 2166136261;
  for (const character of String(seed ?? 0)) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return (value >>> 0) % count;
}

function orderScore(move, preferred) {
  return (preferred === moveKey(move) ? 100_000 : 0)
    + (move.san.includes('#') ? 90_000 : 0)
    + (move.promotion ? VALUES[move.promotion] + 700 : 0)
    + (move.captured ? 10 * VALUES[move.captured] - VALUES[move.piece] : 0)
    + (move.san.includes('+') ? 70 : 0)
    + (move.piece === 'p' ? 8 : 0);
}

export function explainMove(before, move, after) {
  if (after?.result?.reason === 'checkmate') return 'Checkmate. The opposing king has no legal escape.';
  if (move.givesCheck) {
    return `${move.captured ? `Captures a ${NAMES[move.captured]} and gives` : 'Gives'} check, ending the team’s turn immediately.`;
  }
  if (move.promotion) return `Promotes the pawn to a ${NAMES[move.promotion]}.`;
  if (move.castle) return 'Castles, moving the king and rook together.';
  if (move.captured) return `Captures a ${NAMES[move.captured]} on ${move.captureSquare}.`;
  if (before.slot === 0 && !move.endsTurn) return `Moves the ${NAMES[move.piece]} to ${move.to}, keeping the teammate’s second move.`;
  return `Moves the ${NAMES[move.piece]} to ${move.to} to complete the team’s turn.`;
}

export function searchPosition(position, options = {}) {
  const difficulty = Object.hasOwn(PRESETS, options.difficulty) ? options.difficulty : 'medium';
  const preset = PRESETS[difficulty];
  const requestedBudget = options.budgetMs ?? preset.budget;
  const budget = Number.isFinite(requestedBudget) ? Math.max(1, Math.min(10_000, requestedBudget)) : preset.budget;
  const started = performance.now();
  const deadline = started + budget;
  let nodes = 0;
  const cache = new Map();
  const evaluations = new Map();
  function score(state, distance = 0) {
    if (state.result) return evaluatePosition(state, distance);
    const boardKey = state.fen.split(' ')[0];
    if (evaluations.has(boardKey)) return evaluations.get(boardKey);
    const value = evaluatePosition(state);
    if (evaluations.size < 20_000) evaluations.set(boardKey, value);
    return value;
  }
  const rootMoves = legalMoves(position);
  if (!rootMoves.length) throw new Error('There are no legal moves to analyze.');
  rootMoves.sort((a, b) => orderScore(b) - orderScore(a) || moveKey(a).localeCompare(moveKey(b)));

  // A legal, evaluated result is always available, even on a very slow device.
  // A timeout never substitutes an unrelated random move for the chosen level.
  let fallback = applyMove(position, compact(rootMoves[0]));
  let fallbackLine = [compact(rootMoves[0])];
  if (!fallback.position.result && fallback.position.team === position.team) {
    const second = legalMoves(fallback.position).sort((a, b) => orderScore(b) - orderScore(a))[0];
    if (second) {
      fallbackLine.push(compact(second));
      fallback = applyMove(fallback.position, compact(second));
    }
  }
  let best = { score: score(fallback.position), line: fallbackLine };
  let completedDepth = 0;
  let completedRootChoices = [];
  let rootChoices = [];
  // Easy variation is reserved for quiet positions. Captures, promotions,
  // checks, and check evasions always keep the strongest completed choice.
  const varyEasy = difficulty === 'easy' && !isInCheck(position)
    && rootMoves.every((move) => !move.captured && !move.promotion && !/[+#]/.test(move.san));

  function checkTime() {
    if (performance.now() >= deadline) throw TIMEOUT;
  }

  function visit(state, depth, alpha, beta, distance) {
    nodes += 1;
    checkTime();
    if (state.result) return { score: score(state, distance), line: [] };
    // Never evaluate half of a cooperative pair as if the other team could move.
    if (depth <= 0 && state.slot === 0) return { score: score(state, distance), line: [] };
    const key = `${state.fen}|${state.slot}|${Boolean(state.settings?.balancedOpening && state.openingPending)}|${distance}|${JSON.stringify(state.repetition)}`;
    const entry = cache.get(key);
    if (entry && entry.depth >= depth && entry.exact) return entry.value;
    const moves = legalMoves(state);
    checkTime();
    moves.sort((a, b) => orderScore(b, entry?.preferred) - orderScore(a, entry?.preferred)
      || moveKey(a).localeCompare(moveKey(b)));
    const originalAlpha = alpha;
    const originalBeta = beta;
    const maximizing = state.team === 'w';
    let value = { score: maximizing ? -Infinity : Infinity, line: [] };
    let cut = false;
    for (const candidate of moves) {
      checkTime();
      const action = compact(candidate);
      const child = applyMove(state, action).position;
      // Quiet Easy candidates get exact independent scores before selection;
      // a pruning bound must not masquerade as a close alternative.
      const independent = varyEasy && distance === 0;
      const result = visit(child, depth - 1, independent ? -Infinity : alpha, independent ? Infinity : beta, distance + 1);
      if (independent) rootChoices.push({ score: result.score, line: [action, ...result.line] });
      if (maximizing ? result.score > value.score : result.score < value.score) {
        value = { score: result.score, line: [action, ...result.line] };
      }
      if (maximizing) alpha = Math.max(alpha, value.score);
      else beta = Math.min(beta, value.score);
      if (beta <= alpha) { cut = true; break; }
    }
    // Normally impossible: the rules skip an empty second slot before search.
    if (!moves.length) value = { score: score(state, distance), line: [] };
    if (cache.size < 20_000) cache.set(key, {
      depth, exact: !cut && value.score > originalAlpha && value.score < originalBeta,
      value, preferred: value.line[0] ? moveKey(value.line[0]) : undefined,
    });
    return value;
  }

  try {
    for (let depth = 1; depth <= preset.maxDepth; depth += 1) {
      rootChoices = [];
      const result = visit(position, depth, -Infinity, Infinity, 0);
      if (result.line.length) {
        best = result; completedDepth = depth;
        completedRootChoices = rootChoices;
      }
      if (Math.abs(best.score) >= MATE - 100) break;
    }
  } catch (error) {
    if (error !== TIMEOUT) throw error;
  }
  if (varyEasy && Math.abs(best.score) < MATE - 100 && completedRootChoices.length > 1) {
    const sign = position.team === 'w' ? 1 : -1;
    const close = completedRootChoices.filter((choice) => (best.score - choice.score) * sign <= 24)
      .sort((a, b) => moveKey(a.line[0]).localeCompare(moveKey(b.line[0])));
    if (close.length > 1) best = close[seededIndex(options.seed, close.length)];
  }
  const first = applyMove(position, best.line[0]);
  let continuation = null;
  if (!first.position.result && first.position.team === position.team) {
    continuation = best.line[1] || fallbackLine[1] || null;
    // The fallback's second move can belong to a different first move.
    if (!continuation || !legalMoves(first.position).some((candidate) => moveKey(candidate) === moveKey(continuation))) {
      continuation = compact(legalMoves(first.position)[0]);
    }
  }
  return {
    move: best.line[0], continuation,
    explanation: explainMove(position, first.move, first.position),
    score: best.score, depth: completedDepth, nodes,
  };
}
