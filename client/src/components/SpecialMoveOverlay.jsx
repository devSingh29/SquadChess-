import { useEffect, useMemo, useRef } from 'react';
import PieceArt from './PieceArt.jsx';
import { actorAccent, presentationUnitGeometry, specialMoveDetails, squareCenter } from '../game/battles.js';
import './special-move.css';

export function SpecialMoveOverlay({ event, orientation = 'white', motion = 'full', onComplete, withMovement = Boolean(event?.movementVariant) }) {
  const spec = useMemo(() => specialMoveDetails(event), [event]);
  const completed = useRef(onComplete);
  useEffect(() => { completed.current = onComplete; }, [onComplete]);
  const eventId = event?.id;
  const hasEvent = Boolean(event);
  const fullDuration = spec ? Math.max(spec.duration, Math.min(1500, Number(event?.duration) || 0)) : 0;
  const duration = motion === 'off' ? 0 : motion === 'reduced' ? 200 : fullDuration;
  useEffect(() => {
    if (!hasEvent) return undefined;
    const timer = window.setTimeout(() => completed.current?.(eventId), duration);
    return () => window.clearTimeout(timer);
  }, [hasEvent, eventId, duration]);

  if (!spec || motion === 'off') return null;
  const target = squareCenter(spec.square, orientation);
  const from = squareCenter(event.from, orientation);
  const to = squareCenter(event.to, orientation);
  if (!target || !from || !to) return null;
  const x = target.x * 8;
  const y = target.y * 8;
  const unit = presentationUnitGeometry([target], 17, 1.12);
  const accent = spec.kind === 'check' ? '#ed8f83' : actorAccent(event.color, event.seat, event.humanColor || 'w');
  const rank = event.from[1];
  const rookFrom = squareCenter(`${event.castle === 'kingside' ? 'h' : 'a'}${rank}`, orientation);
  const rookTo = squareCenter(`${event.castle === 'kingside' ? 'f' : 'd'}${rank}`, orientation);
  return <div
    key={eventId}
    className={`special-move-overlay special-move-${spec.kind} special-move-motion-${motion}${withMovement ? ' special-move-with-travel' : ''}`}
    style={{ '--special-duration': `${duration}ms`, '--special-accent': accent }}
    role="status" aria-label={spec.kind === 'promotion' ? `Pawn promoted to ${event.promotion}. ${spec.title}.` : spec.kind === 'castle' ? 'Castling. Royal passage.' : 'Check. The other team must respond.'}
    data-special-move={spec.kind} data-testid="special-move-overlay"
  >
    <svg viewBox="0 0 800 800" className="special-move-effects" aria-hidden="true">
      <g className="special-move-sigil" style={{ transformOrigin: `${x}px ${y}px` }}>
        <circle className="special-move-halo" cx={x} cy={y} r={spec.kind === 'check' ? 39 : 57} />
        <circle className="special-move-outer" cx={x} cy={y} r={spec.kind === 'check' ? 49 : 74} />
        {spec.kind === 'check'
          ? <path className="special-move-warning" d={`M${x - 44} ${y - 20}v-24h24M${x + 20} ${y - 44}h24v24M${x + 44} ${y + 20}v24h-24M${x - 20} ${y + 44}h-24v-24`} />
          : <path className="special-move-star" d={`M${x} ${y - 87}L${x + 16} ${y - 16}L${x + 87} ${y}L${x + 16} ${y + 16}L${x} ${y + 87}L${x - 16} ${y + 16}L${x - 87} ${y}L${x - 16} ${y - 16}Z`} />}
      </g>
      {spec.kind === 'castle' && <>
        <path className="special-move-castle-path" pathLength="1" d={`M${from.x * 8} ${from.y * 8}Q${(from.x + to.x) * 4} ${from.y * 8 - 75} ${to.x * 8} ${to.y * 8}`} />
        <path className="special-move-castle-path special-move-rook-path" pathLength="1" d={`M${rookFrom.x * 8} ${rookFrom.y * 8}Q${(rookFrom.x + rookTo.x) * 4} ${rookFrom.y * 8 + 48} ${rookTo.x * 8} ${rookTo.y * 8}`} />
      </>}
      {spec.kind === 'promotion' && <g className="special-move-rays">{Array.from({ length: 10 }, (_, index) => {
        const angle = index / 10 * Math.PI * 2;
        return <path key={index} d={`M${x + Math.cos(angle) * 43} ${y + Math.sin(angle) * 43}L${x + Math.cos(angle) * 96} ${y + Math.sin(angle) * 96}`} />;
      })}</g>}
    </svg>
    {spec.kind === 'promotion' && <div className="special-move-character" style={{ left: `${target.x}%`, top: `${target.y}%`, width: `${unit.width}%`, height: `${unit.height}%`, marginLeft: `${-unit.width / 2}%`, marginTop: `${unit.topOffset}%` }} aria-hidden="true">{!withMovement && <PieceArt className="special-move-pawn" type="p" color={event.color} size="100%" accent={accent} />}<PieceArt className="special-move-promoted" type={event.promotion} color={event.color} size="100%" accent={accent} /></div>}
    <div className="special-move-caption" style={target.y < 25 ? { top: 'auto', bottom: '3%' } : undefined} aria-hidden="true"><span>{spec.kind === 'check' ? 'Check' : spec.kind === 'castle' ? 'King & bastion' : 'Promotion'}</span><strong>{spec.title}</strong></div>
  </div>;
}

export default SpecialMoveOverlay;
