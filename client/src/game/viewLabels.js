export const PIECE_NAMES = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
export const RESULT_NAMES = { checkmate: 'Checkmate', stalemate: 'Stalemate', repetition: 'Threefold repetition', 'fifty-move': '100 quiet moves', 'bare-kings': 'Only kings remain', timeout: 'Time expired', 'timeout-bare-king': 'Time expired · no mating pieces', resignation: 'Resignation' };
export function formatClock(ms) { const seconds = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
export function moveLabel(move) { return move ? `${move.from.toUpperCase()} → ${move.to.toUpperCase()}${move.promotion ? ` · ${PIECE_NAMES[move.promotion]}` : ''}` : 'Choose a move'; }
/** Clock snapshots belong to accepted moves, never to later thinking or resignation. */
export function clocksAtReplayMove(match, index) {
  if (!match?.clocks.enabled || !match.events.length) return match?.clocks || null;
  const event = match.events[Math.max(0, index - 1)];
  if (!event?.clocksBefore) return null;
  const clocks = { ...event.clocksBefore };
  if (index > 0 && event.endsTurn) clocks[event.color] += clocks.increment;
  return clocks;
}
export function getPlayer(seat, humanColor) {
  const friendly = seat[0] === humanColor;
  return { name: friendly ? seat[1] === '1' ? 'You' : 'Lyra' : seat[1] === '1' ? 'Vex' : 'Mordren', role: friendly ? seat[1] === '1' ? 'Squad captain' : 'Your teammate' : seat[1] === '1' ? 'Rival captain' : 'Rival teammate', type: seat[1] === '1' ? 'n' : 'b', accent: friendly ? seat[1] === '1' ? '#e7bc72' : '#67c4b0' : seat[1] === '1' ? '#e37c7c' : '#af98df' };
}
