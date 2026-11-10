import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { Chess } from 'chess.js';
import {
  GAME_STATUS,
  SEATS,
  SOCKET_EVENTS,
  TURN_ORDER
} from '../../shared/src/index.js';

const PORT = process.env.PORT || 4000;
const HUMAN_SEAT = SEATS.W1;
const AI_SEATS = new Set([SEATS.B1, SEATS.W2, SEATS.B2]);
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5005';
const AI_TIERS = new Set(['easy', 'medium', 'hard']);

const app = express();
app.use(cors());

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

const rooms = new Map();

function createRoom(roomId) {
  const game = new Chess();
  const room = {
    roomId,
    game,
    turnIndex: 0,
    status: GAME_STATUS.WAITING,
    moves: [],
    aiTier: 'easy',
    openingMoveDone: false,
    premoveQueue: [],
    awaitingPremoves: false
  };
  rooms.set(roomId, room);
  return room;
}

function getTurnSeat(room) {
  return TURN_ORDER[room.turnIndex % TURN_ORDER.length];
}

function emitState(room) {
  const state = {
    roomId: room.roomId,
    fen: room.game.fen(),
    turnSeat: getTurnSeat(room),
    status: room.status,
    awaitingPremoves: room.awaitingPremoves,
    moves: room.moves
  };
  console.log('[state]', room.roomId, state.turnSeat, state.status, state.fen);
  io.to(room.roomId).emit(SOCKET_EVENTS.SERVER_STATE, state);
}

function recordMove(room, move, seat) {
  const uci = `${move.from}${move.to}${move.promotion || ''}`;
  room.moves.push({
    uci,
    san: move.san,
    seat,
    ply: room.moves.length + 1
  });
}

function uciToMovePayload(uci) {
  if (!uci || uci.length < 4) return null;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined
  };
}

function applyMove(room, movePayload, seat) {
  if (room.status !== GAME_STATUS.ACTIVE) {
    return { ok: false, error: 'Game is not active.' };
  }

  const turnSeat = getTurnSeat(room);
  if (seat !== turnSeat) {
    return { ok: false, error: 'Not your turn.' };
  }

  const color = seat.startsWith('W') ? 'w' : 'b';
  if (color !== room.game.turn()) {
    return { ok: false, error: 'Seat turn mismatch.' };
  }

  const move = room.game.move({
    from: movePayload.from,
    to: movePayload.to,
    promotion: movePayload.promotion
  });

  if (!move) {
    return { ok: false, error: 'Illegal move.' };
  }

  recordMove(room, move, seat);
  if (seat === SEATS.W1) {
    room.premoveQueue = [];
    room.awaitingPremoves = false;
  }
  room.turnIndex += 1;

  if (room.game.isGameOver()) {
    room.status = GAME_STATUS.FINISHED;
  }

  return { ok: true };
}

function pickRandomMove(game) {
  const moves = game.moves({ verbose: true });
  if (!moves.length) return null;
  return moves[Math.floor(Math.random() * moves.length)];
}

function evaluateMaterial(game) {
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let score = 0;
  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue;
      const value = values[piece.type] || 0;
      score += piece.color === 'w' ? value : -value;
    }
  }
  return score;
}

function pickMaterialMove(game, seat) {
  const moves = game.moves({ verbose: true });
  if (!moves.length) return null;

  const color = seat.startsWith('W') ? 'w' : 'b';
  let bestScore = color === 'w' ? -Infinity : Infinity;
  let bestMoves = [];

  for (const move of moves) {
    const clone = new Chess(game.fen());
    clone.move(move);
    const score = evaluateMaterial(clone);
    const isBetter =
      color === 'w' ? score > bestScore : score < bestScore;

    if (isBetter) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

async function pickAiMove(game, seat, tier) {
  const moves = game.moves({ verbose: true });
  if (!moves.length) return null;

  const legalMoves = moves.map((move) => ({
    uci: `${move.from}${move.to}${move.promotion || ''}`,
    san: move.san
  }));

  try {
    console.log('[ai:request]', seat, tier, game.fen());
    const response = await fetch(`${AI_SERVICE_URL}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fen: game.fen(),
        seat,
        tier,
        legal_moves: legalMoves
      })
    });

    if (!response.ok) {
      throw new Error('AI service error');
    }

    const data = await response.json();
    const choice = data?.uci;
    console.log('[ai:response]', seat, choice);
    const match = legalMoves.find((move) => move.uci === choice);
    if (!match) {
      throw new Error('Invalid AI move');
    }

    return moves.find(
      (move) => `${move.from}${move.to}${move.promotion || ''}` === match.uci
    );
  } catch (error) {
    if (tier === 'medium') {
      return pickMaterialMove(game, seat);
    }
    return pickRandomMove(game);
  }
}

function getSeatTier(room, seat) {
  if (seat === SEATS.W2) {
    return room.aiTier === 'hard' ? 'hard' : 'medium';
  }
  return room.aiTier || 'easy';
}

function applyPremovesIfPossible(room) {
  if (!room.premoveQueue.length) {
    return false;
  }

  const turnSeat = getTurnSeat(room);
  if (turnSeat !== SEATS.W1) {
    return false;
  }

  for (const uci of room.premoveQueue) {
    const payload = uciToMovePayload(uci);
    if (!payload) {
      continue;
    }

    const move = room.game.move(payload);
    if (!move) {
      continue;
    }

    recordMove(room, move, SEATS.W1);
    room.turnIndex += 1;
    room.premoveQueue = [];
    room.awaitingPremoves = false;

    if (room.game.isGameOver()) {
      room.status = GAME_STATUS.FINISHED;
      room.awaitingPremoves = false;
    }

    emitState(room);
    return true;
  }

  room.premoveQueue = [];
  room.awaitingPremoves = false;
  return false;
}

async function applyOpeningMove(room) {
  if (room.openingMoveDone || room.game.turn() !== 'w') {
    return;
  }

  const tier = getSeatTier(room, SEATS.W2);
  const move = await pickAiMove(room.game, SEATS.W2, tier);
  if (!move) {
    room.status = GAME_STATUS.FINISHED;
    return;
  }

  room.game.move(move);
  recordMove(room, move, SEATS.W2);
  room.openingMoveDone = true;
  room.turnIndex = 1;
  room.awaitingPremoves = true;

  if (room.game.isGameOver()) {
    room.status = GAME_STATUS.FINISHED;
  }
}

async function runAiTurns(room) {
  while (room.status === GAME_STATUS.ACTIVE) {
    if (room.awaitingPremoves) {
      return;
    }

    const turnSeat = getTurnSeat(room);
    if (!AI_SEATS.has(turnSeat)) {
      return;
    }

    const tier = getSeatTier(room, turnSeat);
    const aiMove = await pickAiMove(room.game, turnSeat, tier);
    if (!aiMove) {
      room.status = GAME_STATUS.FINISHED;
      return;
    }

    room.game.move(aiMove);
    recordMove(room, aiMove, turnSeat);
    room.turnIndex += 1;
    emitState(room);

    if (room.game.isGameOver()) {
      room.status = GAME_STATUS.FINISHED;
      room.awaitingPremoves = false;
      return;
    }

    if (applyPremovesIfPossible(room)) {
      if (room.status !== GAME_STATUS.ACTIVE) {
        return;
      }
    }

    if (turnSeat === SEATS.W2) {
      room.awaitingPremoves = true;
      return;
    }
  }
}

io.on('connection', (socket) => {
  socket.on(SOCKET_EVENTS.CLIENT_JOIN, (payload) => {
    const roomId = payload?.roomId || 'ladder';
    const seat = payload?.seat || HUMAN_SEAT;

    if (seat !== HUMAN_SEAT) {
      socket.emit(SOCKET_EVENTS.SERVER_ERROR, {
        message: 'Only W1 is available in MVP.'
      });
      return;
    }

    const room = rooms.get(roomId) || createRoom(roomId);
    socket.join(roomId);
    emitState(room);
  });

  socket.on(SOCKET_EVENTS.CLIENT_START, async (payload) => {
    const roomId = payload?.roomId || 'ladder';
    const room = rooms.get(roomId) || createRoom(roomId);
    const tier = payload?.tier;

    if (room.status !== GAME_STATUS.WAITING) {
      socket.emit(SOCKET_EVENTS.SERVER_ERROR, {
        message: 'Game already started.'
      });
      return;
    }

    if (tier && !AI_TIERS.has(tier)) {
      socket.emit(SOCKET_EVENTS.SERVER_ERROR, {
        message: 'Invalid AI tier.'
      });
      return;
    }

    socket.join(roomId);
    room.aiTier = tier || 'easy';
    room.status = GAME_STATUS.ACTIVE;
    await applyOpeningMove(room);
    emitState(room);
    await runAiTurns(room);
    emitState(room);
  });

  socket.on(SOCKET_EVENTS.CLIENT_CONTINUE, async (payload) => {
    const roomId = payload?.roomId || 'ladder';
    const room = rooms.get(roomId);
    const premoves = Array.isArray(payload?.premoves) ? payload.premoves : [];

    if (!room) {
      socket.emit(SOCKET_EVENTS.SERVER_ERROR, {
        message: 'Room not found.'
      });
      return;
    }

    if (room.status !== GAME_STATUS.ACTIVE) {
      socket.emit(SOCKET_EVENTS.SERVER_ERROR, {
        message: 'Game is not active.'
      });
      return;
    }

    if (!room.awaitingPremoves) {
      socket.emit(SOCKET_EVENTS.SERVER_ERROR, {
        message: 'Premoves are not ready yet.'
      });
      return;
    }

    if (premoves.length > 3) {
      socket.emit(SOCKET_EVENTS.SERVER_ERROR, {
        message: 'Premoves limit is 3.'
      });
      return;
    }

    room.premoveQueue = premoves
      .filter((move) => typeof move === 'string' && move.length >= 4)
      .slice(0, 3);
    room.awaitingPremoves = false;
    emitState(room);
    await runAiTurns(room);
    emitState(room);
  });

  socket.on(SOCKET_EVENTS.CLIENT_MOVE, async (payload) => {
    const roomId = payload?.roomId || 'ladder';
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit(SOCKET_EVENTS.SERVER_ERROR, {
        message: 'Room not found.'
      });
      return;
    }

    const result = applyMove(room, payload, HUMAN_SEAT);
    if (!result.ok) {
      socket.emit(SOCKET_EVENTS.SERVER_ERROR, { message: result.error });
      return;
    }

    emitState(room);
    await runAiTurns(room);
    emitState(room);
  });
});

httpServer.listen(PORT, () => {
  console.log(`SquadChess server listening on ${PORT}`);
});
