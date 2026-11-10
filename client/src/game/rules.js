import { Chess } from 'chess.js';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const RULESET = 'squad-double-v1';

const other = (color) => color === 'w' ? 'b' : 'w';
const squarePattern = /^[a-h][1-8]$/;

function positionSettings(settings = {}) {
  if (settings.balancedOpening !== undefined && typeof settings.balancedOpening !== 'boolean') {
    throw new Error('The opening setting must be on or off.');
  }
  const balancedOpening = settings.balancedOpening ?? false;
  return { balancedOpening, fullTwoMoveOpening: !balancedOpening };
}

export function turnCapacity(position) {
  return position?.settings?.balancedOpening && position.openingPending && position.team === 'w' ? 1 : 2;
}

export function movesRemaining(position) {
  return position?.result ? 0 : Math.max(0, turnCapacity(position) - (position?.slot ?? 0));
}

function boardFor(position) {
  if (!position || typeof position.fen !== 'string' ||
      !['w', 'b'].includes(position.team) || ![0, 1].includes(position.slot)) {
    throw new Error('This saved position is not a valid SquadChess position.');
  }
  let game;
  try { game = new Chess(position.fen); }
  catch { throw new Error('This board position is not valid.'); }
  if (game.turn() !== position.team) {
    throw new Error('The board and active team do not match.');
  }
  return game;
}

function movesFor(game, square) {
  return game.moves({ verbose: true, ...(square ? { square } : {}) })
    .filter((move) => move.captured !== 'k');
}

// FEN's normal output includes en passant only if a legal capture exists.
// Only handoff positions enter the repetition ledger; the second slot does not.
function boundaryKey(game, position) {
  const key = game.fen().split(' ').slice(0, 4).join(' ');
  return position?.settings?.balancedOpening && position.openingPending ? `${key} opening:single` : key;
}

function bareKings(game) {
  return game.board().flat().filter(Boolean).every((piece) => piece.type === 'k');
}

function resultFor(game, position, handoff) {
  if (handoff && game.isCheckmate()) return { winner: other(position.team), reason: 'checkmate' };
  if (handoff && game.isStalemate()) return { winner: null, reason: 'stalemate' };
  if (bareKings(game)) return { winner: null, reason: 'bare-kings' };
  if (position.halfmove >= 100) return { winner: null, reason: 'fifty-move' };
  if (handoff && (position.repetition[boundaryKey(game, position)] || 0) >= 3) {
    return { winner: null, reason: 'repetition' };
  }
  return null;
}

export function createPosition(fen = START_FEN, options = {}) {
  let game;
  try { game = new Chess(fen); }
  catch { throw new Error('This board position is not valid.'); }
  const fields = game.fen({ forceEnpassantSquare: true }).split(' ');
  const team = options.team ?? fields[1];
  const slot = options.slot ?? 0;
  const halfmove = options.halfmove ?? Number(fields[4]);
  const turnNumber = options.turnNumber ?? Number(fields[5]);
  const settings = positionSettings(options.settings);
  const openingPending = options.openingPending ?? (fen === START_FEN && team === 'w' && slot === 0 && turnNumber === 1);
  if (team !== fields[1] || ![0, 1].includes(slot) ||
      !Number.isInteger(halfmove) || halfmove < 0 ||
      !Number.isInteger(turnNumber) || turnNumber < 1 || typeof openingPending !== 'boolean' ||
      (openingPending && (team !== 'w' || turnNumber !== 1 || (settings.balancedOpening && slot !== 0)))) {
    throw new Error('This saved turn is not valid.');
  }
  // A check ends the pair, so a checked non-acting king is never a valid state.
  const passiveKing = game.board().flat().find((piece) =>
    piece?.type === 'k' && piece.color !== team);
  if (passiveKing && game.isAttacked(passiveKing.square, team)) {
    throw new Error('A checking move must hand the turn to the checked team.');
  }
  fields[3] = slot === 1 ? '-' : fields[3];
  fields[4] = String(halfmove);
  fields[5] = String(turnNumber);
  game = new Chess(fields.join(' '));
  const repetition = {};
  if (options.repetition != null) {
    for (const [key, count] of Object.entries(options.repetition)) {
      if (!Number.isInteger(count) || count < 1) {
        throw new Error('This saved repetition history is not valid.');
      }
      Object.defineProperty(repetition, key, {
        value: count, enumerable: true, configurable: true, writable: true,
      });
    }
  } else if (slot === 0) {
    repetition[boundaryKey(game, { settings, openingPending })] = 1;
  }
  const position = {
    fen: game.fen({ forceEnpassantSquare: true }), team, slot,
    halfmove, turnNumber, repetition, settings, openingPending, result: null,
  };
  position.result = resultFor(game, position, slot === 0);
  return position;
}

export function legalMoves(position, square) {
  if (position?.result) return [];
  if (square !== undefined && !squarePattern.test(square)) return [];
  return movesFor(boardFor(position), square);
}

export function isInCheck(position) {
  return boardFor(position).isCheck();
}

export function applyMove(position, payload) {
  if (position?.result) throw new Error('This game has already ended.');
  if (!payload || !squarePattern.test(payload.from) || !squarePattern.test(payload.to) ||
      (payload.promotion !== undefined && !['q', 'r', 'b', 'n'].includes(payload.promotion))) {
    throw new Error('Choose a valid starting and ending square.');
  }
  const game = boardFor(position);
  const target = game.get(payload.to);
  if (target?.type === 'k') throw new Error('Kings are checkmated, never captured.');
  let played;
  try { played = game.move({ from: payload.from, to: payload.to, promotion: payload.promotion }); }
  catch { throw new Error('That move is not legal in this position.'); }
  const givesCheck = game.isCheck();
  const afterFields = game.fen({ forceEnpassantSquare: true }).split(' ');
  const halfmove = played.piece === 'p' || played.captured ? 0 : position.halfmove + 1;
  let endsTurn = position.slot + 1 >= turnCapacity(position) || givesCheck;
  // A team unable to make its second move simply hands over its unused slot.
  if (!endsTurn) {
    const sameTeamFields = [...afterFields];
    sameTeamFields[1] = position.team;
    sameTeamFields[3] = '-';
    endsTurn = new Chess(sameTeamFields.join(' ')).isStalemate();
  }
  const team = endsTurn ? other(position.team) : position.team;
  const slot = endsTurn ? 0 : 1;
  const turnNumber = position.turnNumber + (endsTurn && position.team === 'b' ? 1 : 0);
  const settings = position.settings ?? positionSettings();
  const openingPending = Boolean(position.openingPending && !(position.team === 'w' && endsTurn));
  afterFields[1] = team;
  if (!endsTurn) afterFields[3] = '-';
  afterFields[4] = String(halfmove);
  afterFields[5] = String(turnNumber);
  const nextBoard = new Chess(afterFields.join(' '));
  const repetition = { ...position.repetition };
  if (endsTurn) {
    const key = boundaryKey(nextBoard, { settings, openingPending });
    repetition[key] = (repetition[key] || 0) + 1;
  }
  const next = {
    fen: nextBoard.fen({ forceEnpassantSquare: true }), team, slot,
    halfmove, turnNumber, repetition, settings, openingPending, result: null,
  };
  next.result = resultFor(nextBoard, next, endsTurn);
  const move = {
    from: played.from, to: played.to, piece: played.piece, color: played.color,
    seat: `${position.team}${position.slot + 1}`,
    san: played.san, givesCheck, endsTurn,
    beforeFen: position.fen, afterFen: next.fen,
  };
  if (played.captured) {
    move.captured = played.captured;
    move.captureSquare = played.isEnPassant()
      ? `${played.to[0]}${played.from[1]}` : played.to;
  }
  if (played.promotion) move.promotion = played.promotion;
  if (played.isKingsideCastle()) move.castle = 'kingside';
  if (played.isQueensideCastle()) move.castle = 'queenside';
  return { position: next, move };
}
