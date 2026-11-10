// Shared protocol constants and JSDoc typedefs for client/server alignment.

export const SEATS = Object.freeze({
  W1: 'W1',
  B1: 'B1',
  W2: 'W2',
  B2: 'B2'
});

export const TURN_ORDER = [SEATS.W1, SEATS.B1, SEATS.W2, SEATS.B2];

export const GAME_STATUS = Object.freeze({
  WAITING: 'waiting',
  ACTIVE: 'active',
  FINISHED: 'finished'
});

export const SOCKET_EVENTS = Object.freeze({
  CLIENT_JOIN: 'client:join',
  CLIENT_START: 'client:start',
  CLIENT_CONTINUE: 'client:continue',
  CLIENT_MOVE: 'client:move',
  SERVER_STATE: 'server:state',
  SERVER_ERROR: 'server:error'
});

/**
 * @typedef {Object} JoinPayload
 * @property {string} roomId
 * @property {string} seat
 */

/**
 * @typedef {Object} StartPayload
 * @property {string} roomId
 * @property {string} tier
 */

/**
 * @typedef {Object} MovePayload
 * @property {string} roomId
 * @property {string} from
 * @property {string} to
 * @property {string} [promotion]
 */

/**
 * @typedef {Object} ContinuePayload
 * @property {string} roomId
 * @property {Array<string>} premoves
 */

/**
 * @typedef {Object} MoveRecord
 * @property {string} san
 * @property {string} uci
 * @property {string} seat
 * @property {number} ply
 */

/**
 * @typedef {Object} GameState
 * @property {string} roomId
 * @property {string} fen
 * @property {string} turnSeat
 * @property {string} status
 * @property {boolean} awaitingPremoves
 * @property {Array<MoveRecord>} moves
 */
