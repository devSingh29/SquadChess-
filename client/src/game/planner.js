/** Board-space geometry: 1 unit is one square; no pixel or resize assumptions. */
export function boardPoint(square, orientation = 'white') {
  if (!/^[a-h][1-8]$/.test(square || '')) return null;
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return orientation === 'black' ? { x: 7.5 - file, y: rank + 0.5 } : { x: file + 0.5, y: 7.5 - rank };
}

export function plannerArrow(move, orientation = 'white') {
  const from = boardPoint(move?.from, orientation);
  const to = boardPoint(move?.to, orientation);
  if (!from || !to || move.from === move.to) return null;
  const dx = to.x - from.x, dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const knight = (Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1);
  const points = [from];
  if (knight) points.push(Math.abs(dx) > Math.abs(dy) ? { x: to.x, y: from.y } : { x: from.x, y: to.y });
  points.push(to);
  const first = points[1];
  const firstLength = Math.hypot(first.x - from.x, first.y - from.y);
  const beforeEnd = points[points.length - 2];
  const endLength = Math.hypot(to.x - beforeEnd.x, to.y - beforeEnd.y);
  const start = { x: from.x + (first.x - from.x) / firstLength * 0.24, y: from.y + (first.y - from.y) / firstLength * 0.24 };
  const tip = { x: to.x - (to.x - beforeEnd.x) / endLength * 0.44, y: to.y - (to.y - beforeEnd.y) / endLength * 0.44 };
  const pathPoints = [start, ...(knight ? [points[1]] : []), tip];
  return { from, to, tip, distance, path: pathPoints.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' '), badge: { x: to.x + 0.31, y: to.y - 0.31 } };
}
