/** Shared contracts for contributors. These describe existing JavaScript objects;
 * they do not introduce a second rules implementation or runtime conversion.
 *
 * @typedef {'w'|'b'} Team
 * @typedef {'p'|'n'|'b'|'r'|'q'|'k'} PieceType
 * @typedef {'w1'|'w2'|'b1'|'b2'} PlayerSeat
 * @typedef {'easy'|'medium'|'hard'} Difficulty
 * @typedef {{from:string,to:string,promotion?:'q'|'r'|'b'|'n'}} MoveInput
 * @typedef {{winner:Team|null,reason:string}} MatchResult
 * @typedef {{balancedOpening:boolean,fullTwoMoveOpening:boolean}} RulesSettings
 * @typedef {{humanColor:Team,teammateDifficulty:Difficulty,opponentDifficulty:Difficulty,timeControl:'untimed'|'5+3'|'10+5',balancedOpening:boolean}} MatchConfig
 * @typedef {{w:number,b:number,increment:number,enabled:boolean}} TeamClocks
 *
 * @typedef {object} Position
 * @property {string} fen Board, active color, castling and en-passant state.
 * @property {Team} team Team whose action is next.
 * @property {0|1} slot First or second player in the current team turn.
 * @property {number} halfmove Individual actions since a pawn move or capture.
 * @property {number} turnNumber One-based team turn number.
 * @property {Record<string,number>} repetition Counts only at team-turn boundaries.
 * @property {RulesSettings} settings
 * @property {boolean} openingPending Whether White's initial turn is unfinished.
 * @property {MatchResult|null} result
 *
 * @typedef {object} MoveEvent
 * @property {string} id Unique accepted-action identity; also guards animation completion.
 * @property {number} index Zero-based action number.
 * @property {Team} color
 * @property {PlayerSeat} seat Acting player, independent of the next position's player.
 * @property {PieceType} piece Original attacker, including a pawn that promotes.
 * @property {string} from
 * @property {string} to
 * @property {PieceType} [captured]
 * @property {string} [captureSquare] Actual victim square, including en passant.
 * @property {'q'|'r'|'b'|'n'} [promotion]
 * @property {'kingside'|'queenside'} [castle]
 * @property {boolean} givesCheck
 * @property {boolean} endsTurn
 * @property {string} san Individual-move label only; never exported as ordinary PGN.
 * @property {string} beforeFen
 * @property {string} afterFen
 * @property {Position} positionAfter Rebuilt when loading portable saves.
 * @property {TeamClocks} clocksBefore Undo checkpoint.
 * @property {number} seed Saved, repeatable visual variation.
 * @property {number} duration
 * @property {string} [variant] Capture attack name.
 * @property {string} [movementVariant] Ordinary travel name.
 * @property {string} accent Acting player's effect color.
 * @property {Team} humanColor
 * @property {boolean} [combo]
 * @property {boolean} [underdog]
 * @property {string} [title]
 * @property {2} [presentationVersion] Absent on original capture records.
 * @property {string} [reactionVariant] Permanent victim-reaction identity.
 * @property {CaptureFinisher} [finisher] Saved special finish; preferences never alter this record.
 *
 * @typedef {object} CaptureFinisher
 * @property {string} id Permanent finisher identity.
 * @property {number} baseDuration Ordinary capture duration used when finishers are disabled.
 * @property {{from:string,to:string,piece:PieceType,color:Team,seat:PlayerSeat,captureSquare:string}} [echo] The actual preceding allied capture.
 *
 * @typedef {object} Preferences
 * @property {'full'|'reduced'|'off'} motion
 * @property {boolean} sound
 * @property {number} volume
 * @property {'green'|'walnut'|'slate'} boardTheme
 * @property {boolean} showCoordinates
 * @property {boolean} finishers
 * @property {boolean} boardShake
 * @property {MatchConfig} matchDefaults Last selected new-match choices.
 *
 * @typedef {object} CombinationPreview
 * @property {MoveInput} first
 * @property {MoveInput|null} second
 * @property {Position} afterFirst
 * @property {Position|null} afterSecond
 * @property {'thinking'|'ready'} status
 * @property {string} explanation
 *
 * @typedef {object} MatchState
 * @property {string} id
 * @property {1} formatVersion
 * @property {string} rulesVersion
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {MatchConfig} config
 * @property {RulesSettings} settings
 * @property {Position} initialPosition
 * @property {Position} position Authoritative board and turn state.
 * @property {MoveEvent[]} events
 * @property {number} revision Incremented after accepted board changes.
 * @property {TeamClocks} clocks
 * @property {{hints:number,undos:number}} assisted
 * @property {'planning'|'thinking'|'animating'|'paused'|'error'|'finished'} phase
 * @property {CombinationPreview|null} preview
 * @property {MoveInput|null} lockedMove Exact confirmed follow-up, never searched again.
 * @property {string|null} [error]
 *
 * @typedef {object} SearchRequest
 * @property {string} id
 * @property {number} revision
 * @property {Position} position For a proposal, this is the state after the proposed first move.
 * @property {Difficulty} difficulty
 * @property {number} [budgetMs] Test override; normal settings use their full difficulty budgets.
 * @property {number} [seed]
 *
 * @typedef {object} SearchResult
 * @property {MoveInput|null} move
 * @property {MoveInput|null} continuation
 * @property {string} explanation Text derived from verified facts about the chosen line.
 * @property {number} score
 * @property {number} depth
 * @property {number} nodes
 *
 * @typedef {MatchState} SavedMatch
 * Browser saves contain the full match. Portable exports omit derived board
 * snapshots; storage validates and reconstructs them before returning SavedMatch.
 */
/** Shared value so settings validation does not depend on the game controller. */
export const DEFAULT_MATCH_CONFIG = Object.freeze({ humanColor: 'w', teammateDifficulty: 'medium', opponentDifficulty: 'easy', timeControl: 'untimed', balancedOpening: false });
