import { useEffect, useId, useMemo, useRef } from 'react';
import PieceArt from './PieceArt.jsx';
import FinisherEffects from './FinisherEffects.jsx';
import { actorAccent, battleSpec, phaseTimings, PIECE_NAMES, presentationDuration, presentationUnitGeometry, randomFromSeed, squareCenter } from '../game/battles.js';
import './battle.css';

function AttackSignature({ variant, x, y, from }) {
  const around = (radius, angle) => `${x + Math.cos(angle) * radius} ${y + Math.sin(angle) * radius}`;
  const rays = (count, inner, outer) => Array.from({ length: count }, (_, index) => {
    const angle = index / count * Math.PI * 2;
    return <path key={index} d={`M${around(inner, angle)}L${around(outer, angle)}`} />;
  });
  switch (variant) {
    case 'pawn-thrust': return <path d={`M${x - 90} ${y + 22}L${x + 67} ${y - 21}l-28 24 7-17-17-5Z`} />;
    case 'pawn-rush': return <>{[-24, 0, 24].map(offset => <path key={offset} d={`M${x - 120} ${y + offset}h${135 - Math.abs(offset)}`} />)}<path d={`M${x - 27} ${y - 43}l38 43-38 43`} /></>;
    case 'pawn-strike': return <path d={`M${x - 80} ${y + 70}Q${x + 29} ${y + 22} ${x + 54} ${y - 85}Q${x + 65} ${y + 8} ${x - 80} ${y + 70}Z`} />;
    case 'pawn-underdog': return <><path d={`M${x - 80} ${y + 38}L${x} ${y - 55}l80 93M${x - 53} ${y + 38}L${x} ${y - 24}l53 62`} /><circle cx={x} cy={y - 45} r="13" /></>;
    case 'knight-charge': return <>{[-70, -30, 10].map((offset, index) => <path key={offset} d={`M${x + offset} ${y + 48}q-22 -${28 + index * 8} 11 -${35 + index * 8}`} />)}<path d={`M${x - 90} ${y - 28}l125 28-125 25`} /></>;
    case 'knight-vault': return <><path d={`M${x - 100} ${y + 35}Q${x - 45} ${y - 170} ${x + 35} ${y - 10}`} /><path d={`M${x + 17} ${y - 39}l18 29 3-37`} /></>;
    case 'knight-slash': return <path d={`M${x - 105} ${y + 50}Q${x - 20} ${y - 120} ${x + 105} ${y - 34}Q${x - 8} ${y - 67} ${x - 105} ${y + 50}Z`} />;
    case 'knight-bash': return <><path d={`M${x - 50} ${y - 47}L${x + 25} ${y - 57}l28 48-52 68-53-47Z`} />{rays(6, 65, 93)}</>;
    case 'bishop-blade': return <path d={`M${x - 90} ${y + 92}L${x + 74} ${y - 93}l-21 58-133 132Z`} />;
    case 'bishop-beam': return <><path d={`M${from.x} ${from.y}L${x} ${y}`} strokeWidth="12" /><path d={`M${from.x} ${from.y}L${x} ${y}`} stroke="#fff8da" strokeWidth="3" /><circle cx={x} cy={y} r="26" /></>;
    case 'bishop-eruption': return <>{[-50, -25, 0, 25, 50].map(offset => <path key={offset} d={`M${x + offset} ${y + 55}l${offset / 3} ${-100 + Math.abs(offset)}l${-offset / 3 + 7} ${54 - Math.abs(offset) / 2}`} />)}<ellipse cx={x} cy={y + 44} rx="74" ry="20" /></>;
    case 'bishop-bind': return <>{[-28, 0, 28].map(offset => <ellipse key={offset} cx={x} cy={y + offset} rx="56" ry="17" transform={`rotate(-18 ${x} ${y})`} />)}<path d={`M${x} ${y - 78}v156`} strokeDasharray="5 11" /></>;
    case 'rook-slam': return <><path d={`M${x - 39} ${y - 84}h78v35h-78ZM${x} ${y - 49}v66`} />{[-52, -24, 24, 52].map(offset => <path key={offset} d={`M${x + offset} ${y + 31}l${offset / 3} 30 20-8-8-22Z`} />)}</>;
    case 'rook-charge': return <><path d={`M${x - 93} ${y - 47}h72l53 47-53 47h-72l48-47Z`} /><path d={`M${x - 113} ${y - 28}h37M${x - 125} ${y}h44M${x - 113} ${y + 28}h37`} /></>;
    case 'rook-shock': return <>{[35, 65, 100].map(radius => <ellipse key={radius} cx={x} cy={y + 24} rx={radius} ry={radius * .45} />)}<path d={`M${x - 68} ${y + 70}l27-31-9-9M${x + 64} ${y + 68}l-28-30 8-10`} /></>;
    case 'rook-blast': return <><circle cx={x} cy={y} r="27" fill="currentColor" />{rays(8, 44, 98)}</>;
    case 'queen-chains': return <>{[0, 1, 2, 3, 4].map(index => <ellipse key={index} cx={from.x + (x - from.x) * (index + 1) / 5} cy={from.y + (y - from.y) * (index + 1) / 5} rx="17" ry="10" transform={`rotate(-35 ${from.x + (x - from.x) * (index + 1) / 5} ${from.y + (y - from.y) * (index + 1) / 5})`} />)}<circle cx={x} cy={y} r="47" strokeDasharray="8 5" /></>;
    case 'queen-blades': return <>{Array.from({ length: 5 }, (_, index) => <path key={index} d={`M${x} ${y - 110}l8 40-8 14-8-14ZM${x - 13} ${y - 66}h26`} transform={`rotate(${index * 72} ${x} ${y})`} />)}</>;
    case 'queen-orbit': return <>{[0, 60, -60].map(angle => <g key={angle} transform={`rotate(${angle} ${x} ${y})`}><ellipse cx={x} cy={y} rx="95" ry="34" /><circle cx={x + 82} cy={y - 16} r="7" fill="currentColor" /></g>)}</>;
    case 'queen-burst': return <>{rays(12, 27, 110)}<path d={`M${x} ${y - 57}l13 44 44 13-44 13-13 44-13-44-44-13 44-13Z`} fill="currentColor" /></>;
    case 'king-sword': return <><path d={`M${x - 76} ${y + 83}L${x + 77} ${y - 91}l-22 60-126 123Z`} /><path d={`M${x - 39} ${y + 23}l41 36`} strokeWidth="6" /></>;
    case 'king-shield': return <><path d={`M${x - 50} ${y - 52}L${x} ${y - 71}l50 19-7 62-43 54-43-54Z`} /><path d={`M${x} ${y - 42}v76M${x - 28} ${y - 13}h56`} strokeWidth="5" /></>;
    case 'king-command': return <><path d={`M${x - 65} ${y + 30}l-9-77 42 34 32-53 31 53 43-34-10 77ZM${x - 63} ${y + 43}h126`} /><circle cx={x} cy={y - 48} r="7" fill="currentColor" /></>;
    case 'king-shock': return <><path d={`M${x} ${y - 95}l18 55 43-29-20 48 54 21-54 17 24 46-47-26-18 58-19-58-48 26 26-47-54-16 54-20-25-49 46 29Z`} /><circle cx={x} cy={y} r="31" /></>;
    default: return null;
  }
}

function makeScene(event, orientation, prefs) {
  const spec = battleSpec(event, prefs);
  if (!spec) return null;
  const from = squareCenter(spec.from, orientation);
  const to = squareCenter(spec.to, orientation);
  const hit = squareCenter(spec.captureSquare, orientation);
  if (!from || !to || !hit) return null;
  const random = randomFromSeed(spec.seed);
  const start = { x: from.x * 8, y: from.y * 8 };
  const target = { x: hit.x * 8, y: hit.y * 8 };
  const bend = (random() - 0.5) * 130;
  const center = { x: (start.x + target.x) / 2 + bend, y: (start.y + target.y) / 2 - 85 - random() * 65 };
  let trail = `M${start.x} ${start.y}Q${center.x} ${center.y} ${target.x} ${target.y}`;
  if (spec.choreography.effect.includes('beam') || spec.choreography.effect.includes('charge')) trail = `M${start.x} ${start.y}L${target.x} ${target.y}`;
  if (spec.choreography.effect.includes('chains')) {
    trail = `M${start.x} ${start.y}`;
    for (let i = 1; i <= 8; i += 1) {
      const t = i / 8;
      trail += `L${start.x + (target.x - start.x) * t + (i % 2 ? 22 : -22) * (1 - t)} ${start.y + (target.y - start.y) * t}`;
    }
  }
  const shards = Array.from({ length: spec.combo ? 24 : 16 }, (_, index) => {
    const angle = (index / (spec.combo ? 24 : 16)) * Math.PI * 2 + random() * 0.35;
    const distance = 45 + random() * (spec.underdog ? 125 : 90);
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      size: 2 + random() * (spec.reaction.fragments === 'stone' ? 9 : 4),
      angle: random() * 360,
      delay: random() * 0.045,
    };
  });
  return { spec, from, to, hit, start, target, trail, shards, direction: to.x >= from.x ? 1 : -1 };
}

/** Sits inside the board's square wrapper. Effects never intercept board input. */
export function BattleOverlay({ event, orientation = 'white', motion = 'full', prefs, boardShake = true, onComplete }) {
  const scene = useMemo(() => makeScene(event, orientation, prefs), [event, orientation, prefs]);
  const unique = useId().replace(/:/g, '');
  const overlay = useRef(null);
  const complete = useRef(onComplete);
  useEffect(() => { complete.current = onComplete; }, [onComplete]);
  const duration = presentationDuration(event, { ...prefs, motion });
  const eventId = event?.id ?? event?.seed;
  const hasEvent = Boolean(event);
  const timing = scene ? phaseTimings(scene.spec.finisher || scene.spec.choreography, duration) : null;
  const attackAt = timing?.attackAt || 0;
  const impactAt = timing?.impactAt || 0;
  const settleAt = timing?.settleAt || 0;
  useEffect(() => {
    if (!hasEvent) return undefined;
    const element = overlay.current;
    if (element) element.dataset.phase = 'anticipation';
    const timers = [
      window.setTimeout(() => { if (element) element.dataset.phase = 'attack'; }, attackAt),
      window.setTimeout(() => { if (element) element.dataset.phase = 'impact'; }, impactAt),
      window.setTimeout(() => { if (element) element.dataset.phase = 'settle'; }, settleAt),
      window.setTimeout(() => complete.current?.(eventId), duration),
    ];
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [hasEvent, eventId, duration, attackAt, impactAt, settleAt]);

  if (!scene || motion === 'off') return null;
  const { spec, from, to, hit, start, target, trail, shards, direction } = scene;
  const isV2 = spec.presentationVersion === 2;
  const finisher = motion === 'full' && spec.finisher;
  const fragments = isV2 && ['bishop-shatter', 'rook-fracture', 'queen-disperse'].includes(spec.reaction.id);
  const echo = finisher?.echo;
  const echoTarget = echo && squareCenter(echo.to, orientation);
  const victimColor = spec.color === 'w' ? 'b' : 'w';
  const victimAccent = actorAccent(victimColor, victimColor.toUpperCase() + '1', spec.humanColor || 'w');
  const unit = presentationUnitGeometry([from, to, hit]);
  const crownBaseY = Math.max(45, to.y * 8 - 74);
  const style = {
    '--battle-duration': `${duration}ms`,
    '--battle-motion-duration': `${timing.motion}ms`,
    '--battle-anticipation-duration': `${timing.anticipation}ms`,
    '--battle-attack-duration': `${timing.attack}ms`,
    '--battle-impact-duration': `${timing.impact}ms`,
    '--battle-settle-duration': `${timing.settle}ms`,
    '--battle-attack-delay': `${timing.attackAt}ms`,
    '--battle-impact-delay': `${timing.impactAt}ms`,
    '--battle-settle-delay': `${timing.settleAt}ms`,
    '--battle-hit-effect-duration': `${timing.impact + timing.settle * .65}ms`,
    '--battle-release-duration': `${duration - timing.impactAt}ms`,
    '--battle-reaction-duration': `${duration - timing.impactAt}ms`,
    '--battle-accent': spec.accent,
    '--battle-unit-width': `${unit.width}%`,
    '--battle-unit-height': `${unit.height}%`,
    '--battle-unit-top': `${unit.topOffset}%`,
    '--battle-start-x': `${(from.x - to.x) / unit.width * 100}%`,
    '--battle-start-y': `${(from.y - to.y) / unit.height * 100}%`,
    '--battle-hit-x': `${(hit.x - to.x) / unit.width * 100}%`,
    '--battle-hit-y': `${(hit.y - to.y) / unit.height * 100}%`,
    '--battle-direction': direction,
    '--battle-tilt': `${direction * 13}deg`,
    '--battle-counter-tilt': `${direction * -16}deg`,
  };

  return <div
    key={eventId} ref={overlay}
    className={`battle-overlay battle-motion-${motion}${isV2 ? ' battle-version-two' : ''}${finisher ? ' battle-has-finisher' : ''}${spec.combo ? ' battle-combo' : ''}${spec.underdog ? ' battle-underdog' : ''}`}
    style={style} data-variant={spec.variant} data-attacker={spec.piece} data-victim={spec.captured}
    data-phase="anticipation" data-effect={spec.choreography.effect} data-reaction={spec.reaction.id} data-articulation={spec.reaction.articulation} data-fragments={spec.reaction.fragments}
    data-promotes-to={spec.promotion || undefined} data-finisher={finisher?.id || undefined} data-presentation-version={spec.presentationVersion || 1}
    data-testid="battle-overlay" data-capture-square={spec.captureSquare}
    role="status" aria-label={`${spec.title}. ${PIECE_NAMES[spec.piece]} captures ${PIECE_NAMES[spec.captured]}.${spec.promotion ? ` Promotes to ${PIECE_NAMES[spec.promotion]}.` : ''}`}
  >
    <div className="battle-vignette" />
    <svg className="battle-effects" viewBox="0 0 800 800" aria-hidden="true">
      <defs>
        <radialGradient id={`${unique}-impact`}>
          <stop offset="0" stopColor="#fff5d9" stopOpacity="0.9" />
          <stop offset="0.25" stopColor={spec.accent} stopOpacity="0.7" />
          <stop offset="1" stopColor={spec.accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path className="battle-trail battle-trail-glow" d={trail} pathLength="1" />
      <path className="battle-trail" d={trail} pathLength="1" />
      <g className="battle-impact" style={{ transformOrigin: `${target.x}px ${target.y}px` }}>
        <circle className="battle-impact-glow" cx={target.x} cy={target.y} r="112" fill={`url(#${unique}-impact)`} />
        <circle className="battle-ring" cx={target.x} cy={target.y} r="42" />
        <circle className="battle-ring battle-ring-outer" cx={target.x} cy={target.y} r="65" />
        <path className="battle-impact-cross" d={`M${target.x - 95} ${target.y + 70}L${target.x + 85} ${target.y - 75}M${target.x - 60} ${target.y - 75}L${target.x + 70} ${target.y + 70}`} />
        <path className="battle-rune" d={`M${target.x} ${target.y - 77}L${target.x + 67} ${target.y + 38}L${target.x - 67} ${target.y + 38}ZM${target.x} ${target.y + 77}L${target.x - 67} ${target.y - 38}L${target.x + 67} ${target.y - 38}Z`} />
      </g>
      <g className="battle-debris" style={finisher ? { display: 'none' } : undefined}>
        {shards.map((shard, index) => <path
          key={index} className="battle-shard"
          d={`M${target.x - shard.size} ${target.y}l${shard.size} ${-shard.size * 1.7}l${shard.size} ${shard.size * 1.7}l${-shard.size} ${shard.size}Z`}
          style={{
            '--shard-x': `${shard.x}px`, '--shard-y': `${shard.y}px`, '--shard-spin': `${shard.angle}deg`,
            transformOrigin: `${target.x}px ${target.y}px`, animationDelay: `calc(var(--battle-impact-delay) + ${shard.delay * duration}ms)`,
          }}
        />)}
      </g>
      <g className={`battle-signature battle-signature-${spec.choreography.effect}`} style={{ transformOrigin: `${target.x}px ${target.y}px` }}>
        <AttackSignature variant={spec.choreography.effect} x={target.x} y={target.y} from={start} />
      </g>
      {spec.combo && <circle className="battle-combo-ring" cx={target.x} cy={target.y} r="102" />}
      {spec.promotion && <g className="battle-promotion-finish" data-testid="capture-promotion-finish" style={{ transformOrigin: `${to.x * 8}px ${to.y * 8}px` }}>
        <circle cx={to.x * 8} cy={to.y * 8} r="66" />
        {Array.from({ length: 10 }, (_, index) => {
          const angle = index / 10 * Math.PI * 2;
          return <path key={index} d={`M${to.x * 8 + Math.cos(angle) * 45} ${to.y * 8 + Math.sin(angle) * 45}L${to.x * 8 + Math.cos(angle) * 104} ${to.y * 8 + Math.sin(angle) * 104}`} />;
        })}
        <path className="battle-promotion-crown" d={`M${to.x * 8 - 34} ${crownBaseY}l-5-30 23 13 16-24 16 24 23-13-5 30Z`} />
      </g>}
    </svg>
    {finisher && <FinisherEffects spec={spec} target={target} start={start} orientation={orientation} duration={duration} impactAt={timing.impactAt} boardShake={boardShake && prefs?.boardShake !== false} />}
    <div className={`battle-unit battle-victim${fragments ? ' battle-victim-breakable' : ''}`} style={{ left: `${hit.x}%`, top: `${hit.y}%`, animationName: spec.reaction.motionName, ...(isV2 ? { animationDelay: `${timing.impactAt}ms`, animationDuration: `${duration - timing.impactAt}ms` } : {}) }} aria-hidden="true">
      <PieceArt type={spec.captured} color={victimColor} size="100%" accent={victimAccent} />
    </div>
    {fragments && <div className="battle-unit battle-victim-fragments" data-testid="victim-fragments" style={{ left: `${hit.x}%`, top: `${hit.y}%` }} aria-hidden="true">{[0, 1, 2].map(index => <div key={index} className={`battle-victim-fragment battle-victim-fragment-${index}`} style={{ '--reaction-side': index - 1, '--reaction-lift': index === 1 ? '-35%' : '18%' }}><PieceArt type={spec.captured} color={victimColor} size="100%" accent={victimAccent} /></div>)}</div>}
    {echoTarget && <div className="battle-unit battle-ally-echo" data-testid="battle-ally-echo" style={{ left: `${echoTarget.x}%`, top: `${echoTarget.y}%`, '--echo-accent': actorAccent(echo.color, echo.seat, spec.humanColor || 'w') }} aria-hidden="true"><PieceArt type={echo.piece} color={echo.color} size="100%" accent={actorAccent(echo.color, echo.seat, spec.humanColor || 'w')} /></div>}
    <div className="battle-unit battle-attacker" style={{ left: `${to.x}%`, top: `${to.y}%`, animationName: `battle-lifetime, ${spec.choreography.motionName}` }} aria-hidden="true">
      <PieceArt className={spec.promotion ? 'battle-attacker-original' : ''} type={spec.piece} color={spec.color} size="100%" accent={spec.accent} />
      {spec.promotion && <PieceArt className="battle-attacker-promoted" type={spec.promotion} color={spec.color} size="100%" accent={spec.accent} />}
    </div>
    <div className="battle-caption" style={hit.y < 25 ? { top: 'auto', bottom: '3%' } : undefined} aria-hidden="true">
      <span className="battle-caption-kicker">{finisher ? (spec.combo ? 'Allied finishing strike' : 'Legendary finish') : spec.combo ? 'Squad combination' : spec.underdog ? 'Giant slayer' : `${PIECE_NAMES[spec.piece]} takes ${PIECE_NAMES[spec.captured]}`}</span>
      <strong>{spec.title}</strong>
    </div>
  </div>;
}

export default BattleOverlay;
