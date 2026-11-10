import { useEffect, useMemo, useRef } from 'react';
import PieceArt from './PieceArt.jsx';
import { MOVEMENT_REGISTRY, movementSpec, phaseTimings, PIECE_NAMES, squareCenter } from '../game/battles.js';
import './movement.css';

/** Short role-specific travel, independent of the authoritative board position. */
export function MovementOverlay({ event, orientation = 'white', motion = 'full', onComplete }) {
  const spec = useMemo(() => movementSpec(event), [event]);
  const overlay = useRef(null);
  const complete = useRef(onComplete);
  useEffect(() => { complete.current = onComplete; }, [onComplete]);
  const eventId = event?.id ?? event?.seed;
  const hasEvent = Boolean(event);
  const duration = motion === 'off' ? 0 : motion === 'reduced' ? 130 : spec?.duration || 0;
  const travelDuration = motion !== 'full' ? duration : spec?.promotion ? Math.min(580, duration * .6) : spec?.castle ? Math.min(650, duration * .8) : duration;
  const timing = spec ? phaseTimings(spec.choreography, travelDuration) : null;
  const attackAt = timing?.attackAt || 0;
  const settleAt = timing?.settleAt || 0;
  useEffect(() => {
    if (!hasEvent) return undefined;
    const element = overlay.current;
    if (element) element.dataset.phase = 'anticipation';
    const timers = [
      window.setTimeout(() => { if (element) element.dataset.phase = 'attack'; }, attackAt),
      window.setTimeout(() => { if (element) element.dataset.phase = 'settle'; }, settleAt),
      window.setTimeout(() => complete.current?.(eventId), duration),
    ];
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [hasEvent, eventId, duration, attackAt, settleAt]);

  if (!spec || motion === 'off') return null;
  const from = squareCenter(spec.from, orientation);
  const to = squareCenter(spec.to, orientation);
  if (!from || !to) return null;
  const direction = to.x >= from.x ? 1 : -1;
  const companionFrom = spec.companion && squareCenter(spec.companion.from, orientation);
  const companionTo = spec.companion && squareCenter(spec.companion.to, orientation);
  const rookMovement = MOVEMENT_REGISTRY.r[(spec.seed >>> 0) % MOVEMENT_REGISTRY.r.length];
  const style = {
    '--movement-duration': `${duration}ms`,
    '--movement-gait-duration': `${Math.max(100, timing.attack / (spec.piece === 'r' ? 2 : 3))}ms`,
    '--movement-anticipation-duration': `${timing.anticipation}ms`,
    '--movement-travel-duration': `${timing.attack}ms`,
    '--movement-settle-duration': `${timing.settle}ms`,
    '--movement-travel-at': `${timing.attackAt}ms`,
    '--movement-settle-at': `${timing.settleAt}ms`,
    '--movement-start-x': `${(from.x - to.x) * 8}%`,
    '--movement-start-y': `${(from.y - to.y) * 8}%`,
    '--movement-accent': spec.accent,
    '--movement-facing': direction,
  };
  return <div ref={overlay} key={eventId} className={`movement-overlay movement-motion-${motion}`} style={style}
    data-movement={spec.movementVariant} data-role={spec.piece} data-gait={spec.choreography.gait}
    data-effect={spec.choreography.effect} data-phase="anticipation" data-testid="movement-overlay"
    role="status" aria-label={`${PIECE_NAMES[spec.piece]} moves from ${spec.from} to ${spec.to}.`}
  >
    <svg className="movement-ground" viewBox="0 0 800 800" aria-hidden="true">
      <circle className="movement-arrival" cx={to.x * 8} cy={to.y * 8} r="32" />
      {Array.from({ length: 4 }, (_, index) => {
        const fraction = (index + 1) / 5;
        const x = (from.x + (to.x - from.x) * fraction) * 8;
        const y = (from.y + (to.y - from.y) * fraction) * 8 + (index % 2 ? 5 : -5);
        return <ellipse key={index} className="movement-footprint" cx={x} cy={y} rx={spec.choreography.effect === 'glimmer' ? 3 : 4} ry={spec.choreography.effect === 'glimmer' ? 3 : 2}
          style={{ animationDelay: `${timing.anticipation + timing.attack * fraction * .75}ms` }} />;
      })}
    </svg>
    <div className="movement-unit" style={{ left: `${to.x}%`, top: `${to.y}%`, animationName: `${spec.promotion ? 'movement-promotion-lifetime' : 'movement-lifetime'}, ${spec.choreography.motionName}`, animationDuration: `${duration}ms, ${travelDuration}ms` }} aria-hidden="true">
      <PieceArt type={spec.piece} color={spec.color} size="100%" accent={spec.accent} />
    </div>
    {companionFrom && companionTo && <div className="movement-unit movement-companion" data-companion="rook" data-from={spec.companion.from} data-to={spec.companion.to}
      style={{
        left: `${companionTo.x}%`, top: `${companionTo.y}%`,
        '--movement-start-x': `${(companionFrom.x - companionTo.x) * 8}%`,
        '--movement-start-y': `${(companionFrom.y - companionTo.y) * 8}%`,
        '--movement-facing': companionTo.x >= companionFrom.x ? 1 : -1,
        animationName: `movement-lifetime, ${rookMovement.motionName}`, animationDuration: `${duration}ms, ${travelDuration}ms`,
      }} aria-hidden="true"><PieceArt type="r" color={spec.color} size="100%" accent={spec.accent} /></div>}
  </div>;
}

export default MovementOverlay;
