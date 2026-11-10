import { useEffect, useId, useMemo, useRef } from 'react';
import { actorAccent, randomFromSeed, squareCenter } from '../game/battles.js';
import './finisher-effects.css';

const TERRAIN = new Set(['pawn-giants-fall', 'knight-thunderhoof', 'knight-skybreaker', 'bishop-runic-fault', 'rook-earthbreaker', 'rook-citadel-crush', 'king-crowns-wrath']);

function Environment({ id, target, start, seed }) {
  const { x, y } = target;
  const crack = index => {
    const random = randomFromSeed((seed ^ (index + 1) * 0x45d9f3b) >>> 0);
    const angle = index / 8 * Math.PI * 2 + (random() - .5) * .35;
    const length = 165 + random() * 85;
    const points = Array.from({ length: 7 }, (_, step) => {
      const radius = 18 + length * step / 6;
      const offset = step ? (random() * 19 + 5) * (step % 2 ? 1 : -1) : 0;
      return { x: x + Math.cos(angle) * radius + Math.sin(angle) * offset, y: y + 24 + Math.sin(angle) * radius - Math.cos(angle) * offset };
    });
    const main = points.map((point, step) => `${step ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join('');
    const branches = [2, 4].map((step, branch) => {
      const origin = points[step];
      const branchAngle = angle + (branch ? -.7 : .65);
      const bend = 24 + random() * 18;
      return `M${origin.x} ${origin.y}l${Math.cos(branchAngle) * bend} ${Math.sin(branchAngle) * bend}l${Math.cos(branchAngle + .5) * 21} ${Math.sin(branchAngle + .5) * 21}`;
    });
    return { main, branches };
  };
  const pose = { transformOrigin: `${x}px ${y}px` };
  switch (id) {
    case 'pawn-giants-fall': return <>
      <path className="finisher-snare" pathLength="1" d={`M${start.x} ${start.y}Q${x - 105} ${y + 85} ${x + 48} ${y + 27}Q${x + 86} ${y - 30} ${x - 34} ${y - 12}`} />
      <path className="finisher-trip-line" pathLength="1" d={`M${x - 55} ${y + 26}q57 39 104-2M${x - 26} ${y + 45}l-40 25M${x + 21} ${y + 48}l40 27`} />
      <ellipse className="finisher-dust-ring" cx={x} cy={y + 36} rx="125" ry="28" style={pose} />
    </>;
    case 'pawn-spearline': return <>
      <path className="finisher-planted-spear" d={`M${start.x} ${start.y + 35}v-125l-8 23 8-31 8 31-8-23`} />
      {Array.from({ length: 7 }, (_, i) => <g key={i} className="finisher-spear" style={{ '--effect-order': i, transformOrigin: `${x}px ${y}px` }} transform={`translate(${x - 108 + i * 36} ${y + Math.abs(i - 3) * 13}) rotate(${(i - 3) * 11})`}><path className="finisher-stone-spire" d="M-15 44 -11-20 0-59 12-19 16 44Z" /><path d="M0-46 4-17-4 8 6 32" /></g>)}
      <path className="finisher-spear-scar" d={`M${x - 147} ${y + 34}Q${x} ${y - 13} ${x + 147} ${y + 34}`} />
    </>;
    case 'knight-thunderhoof': return <>
      {Array.from({ length: 6 }, (_, i) => { const t = (i + 1) / 6; return <g key={i} className="finisher-hoof" style={{ '--effect-order': i, transformOrigin: `${start.x + (x - start.x) * t}px ${start.y + (y - start.y) * t}px` }}><ellipse cx={start.x + (x - start.x) * t} cy={start.y + (y - start.y) * t + (i % 2 ? 11 : -11)} rx="22" ry="12" /><path d={`M${start.x + (x - start.x) * t - 20} ${start.y + (y - start.y) * t}l-12 21 22-8-7 24`} /></g>; })}
      {[70, 122, 184].map((r, i) => <ellipse key={r} className="finisher-thunder-ring" cx={x} cy={y + 20} rx={r} ry={r * .42} style={{ ...pose, '--effect-order': i }} />)}
    </>;
    case 'knight-skybreaker': return <>
      <path className="finisher-sky-arc" pathLength="1" d={`M${start.x} ${start.y}Q${x - 160} ${Math.max(20, y - 290)} ${x} ${y}`} />
      <g className="finisher-sky-lance" style={pose}><path d={`M${x} ${y - 260}V${y + 32}l-18-38 18 14 18-14-18 38`} /><path className="finisher-sky-wake" d={`M${x - 38} ${y - 205}L${x - 9} ${y + 3}M${x + 38} ${y - 205}L${x + 9} ${y + 3}`} /></g>
      <ellipse className="finisher-crater" cx={x} cy={y + 25} rx="106" ry="43" style={pose} />
    </>;
    case 'bishop-astral-gate': return <>
      {[-1, 1].map(side => <g key={side} className={`finisher-gate finisher-gate-${side < 0 ? 'left' : 'right'}`} style={{ transformOrigin: `${x + side * 74}px ${y - 25}px`, '--gate-side': side }}><ellipse cx={x + side * 74} cy={y - 25} rx="24" ry="113" /><ellipse cx={x + side * 74} cy={y - 25} rx="15" ry="96" /><path d={`M${x + side * 74} ${y - 143}v236`} strokeDasharray="4 12" /></g>)}
      {[-37, 0, 37].map((o, i) => <path key={o} className="finisher-gate-tether" style={{ '--effect-order': i }} d={`M${x - 75} ${y + o}Q${x} ${y + o - 45} ${x + 75} ${y + o}`} />)}
    </>;
    case 'bishop-runic-fault': return <>
      <path className="finisher-fault" style={pose} d={`M${x - 220} ${y + 166}l64-66 20 8 58-67-11-12 67-71 17 8 68-77-52 102-25-2-44 69-22-4-54 66-20-4Z`} />
      {Array.from({ length: 7 }, (_, i) => <g key={i} className="finisher-rune-pillar" style={{ '--effect-order': i, transformOrigin: `${x - 130 + i * 44}px ${y + 110 - i * 37}px` }}><path d={`M${x - 130 + i * 44} ${y + 110 - i * 37}v-67l9-14 9 14v67`} /><path d={`M${x - 127 + i * 44} ${y + 72 - i * 37}l6-8 6 8-6 8Z`} /></g>)}
    </>;
    case 'rook-earthbreaker': return <>
      {[70, 135, 215, 300].map((r, i) => <ellipse key={r} className="finisher-quake" cx={x} cy={y + 18} rx={r} ry={r * .52} style={{ ...pose, '--effect-order': i }} />)}
      {Array.from({ length: 8 }, (_, i) => { const fracture = crack(i); return <g key={i}><path className="finisher-earth-crack" pathLength="1" d={fracture.main} />{fracture.branches.map((path, index) => <path key={index} className="finisher-earth-crack finisher-earth-branch" pathLength="1" d={path} />)}</g>; })}
      <path className="finisher-hammerprint" d={`M${x - 43} ${y - 10}h86v43h-86Z`} />
    </>;
    case 'rook-citadel-crush': return <>
      {[-1, 1].map(side => <g key={side} className="finisher-citadel" style={{ '--citadel-side': side, ...pose }}><path d={`M${x + side * 24} ${y + 52}v-146h${side * 20}v-26h${side * 25}v26h${side * 22}v-26h${side * 25}v26h${side * 20}v146Z`} /><path className="finisher-citadel-mortar" d={`M${x + side * 24} ${y - 45}h${side * 112}M${x + side * 24} ${y + 5}h${side * 112}M${x + side * 68} ${y - 94}v49M${x + side * 99} ${y - 45}v50M${x + side * 59} ${y + 5}v47`} /></g>)}
      <path className="finisher-pressure" d={`M${x} ${y - 130}v208`} />
    </>;
    case 'queen-gravity-crown': return <>
      {[0, 60, 120].map((angle, i) => <g key={angle} className="finisher-gravity-orbit" style={{ ...pose, '--effect-order': i }}><ellipse cx={x} cy={y - 12} rx="133" ry="51" transform={`rotate(${angle} ${x} ${y - 12})`} /><path d={`M${x + 120} ${y - 17}l13-16 13 16-13 16Z`} transform={`rotate(${angle} ${x} ${y - 12})`} /></g>)}
      <path className="finisher-gravity-crown" style={pose} d={`M${x - 71} ${y + 35}l-14-124 48 44 37-63 37 63 48-44-14 124Z`} />
      <ellipse className="finisher-singularity" cx={x} cy={y - 4} rx="34" ry="48" style={pose} />
    </>;
    case 'queen-starfall': return <>
      {Array.from({ length: 7 }, (_, i) => { const spread = (i - 3) * 30; return <g key={i} className="finisher-meteor" style={{ '--effect-order': i, transformOrigin: `${x + spread}px ${y + Math.abs(i - 3) * 11}px` }}><path d={`M${x + spread - 66} ${y - 210}l79 208-13 19-18-13Z`} /><circle cx={x + spread} cy={y + Math.abs(i - 3) * 11} r="11" /></g>; })}
      {Array.from({ length: 5 }, (_, i) => <circle key={i} className="finisher-star-crater" cx={x + (i - 2) * 40} cy={y + (i % 2 ? 27 : 10)} r={26 + i % 2 * 9} style={{ ...pose, '--effect-order': i }} />)}
    </>;
    case 'king-royal-judgment': return <>
      {[-1, 1].map(side => <g key={side} className="finisher-judgment-shield" style={{ ...pose, '--shield-side': side }}><path d={`M${x + side * 28} ${y - 94}L${x + side * 95} ${y - 73}L${x + side * 91} ${y + 13}L${x + side * 28} ${y + 71}L${x + side * 10} ${y + 16}Z`} /><path d={`M${x + side * 42} ${y - 56}v77M${x + side * 25} ${y - 20}h${side * 42}`} /></g>)}
      <g className="finisher-judgment-seal" style={pose}><circle cx={x} cy={y + 22} r="90" /><path d={`M${x - 86} ${y + 22}h172M${x} ${y - 64}v172`} /><path d={`M${x - 37} ${y + 22}l9-29 28 18 28-18 9 29Z`} /></g>
      <path className="finisher-verdict-cut" d={`M${x} ${y - 190}v330`} />
    </>;
    case 'king-crowns-wrath': return <>
      <g className="finisher-wrath-crown" style={pose}><path d={`M${x - 82} ${y + 37}l-14-120 52 45 44-74 44 74 52-45-14 120Z`} /><path d={`M${x - 78} ${y + 48}h156`} /></g>
      {Array.from({ length: 8 }, (_, i) => <g key={i} className="finisher-wrath-blade" style={{ ...pose, '--effect-order': i }} transform={`rotate(${i * 45} ${x} ${y})`}><path d={`M${x} ${y - 50}l12-77-12-29-12 29ZM${x - 22} ${y - 78}h44`} /></g>)}
      <circle className="finisher-royal-wave" cx={x} cy={y} r="95" style={pose} />
    </>;
    default: return null;
  }
}

/** All geometry stays in the board; no camera cut, fixed overlay or global screen shake. */
export default function FinisherEffects({ spec, target, start, orientation = 'white', duration, impactAt, boardShake = true }) {
  const layer = useRef(null);
  const unique = useId().replace(/:/g, '');
  const id = spec.finisher.id;
  const seed = spec.seed || 1;
  const debris = useMemo(() => {
    const random = randomFromSeed(seed ^ 0x62efac);
    return Array.from({ length: 36 }, (_, i) => {
      const angle = i / 36 * Math.PI * 2 + random() * .2;
      const distance = 60 + random() * 150;
      return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, spin: random() * 480 - 240, size: 3 + random() * 8, delay: random() * 80 };
    });
  }, [seed]);
  useEffect(() => {
    if (!boardShake) return undefined;
    const board = layer.current?.closest('.board-scene');
    if (!board?.animate) return undefined;
    const strength = id.startsWith('rook-') || id === 'knight-skybreaker' ? 5 : 2.5;
    const animation = board.animate([
      { transform: 'translate(0,0)' }, { transform: `translate(${-strength}px,${strength * .5}px)` },
      { transform: `translate(${strength}px,${-strength * .5}px)` }, { transform: `translate(${-strength * .55}px,${-strength * .4}px)` },
      { transform: `translate(${strength * .35}px,0)` }, { transform: 'translate(0,0)' },
    ], { duration: 270, delay: impactAt, easing: 'ease-out', fill: 'none' });
    return () => animation.cancel();
  }, [boardShake, id, impactAt, spec.id]);
  const tileX = Math.floor(target.x / 100) * 100;
  const tileY = Math.floor(target.y / 100) * 100;
  const echo = spec.finisher.echo;
  const echoFrom = echo && squareCenter(echo.from, orientation);
  const echoTo = echo && squareCenter(echo.captureSquare || echo.to, orientation);
  return <svg ref={layer} className={`finisher-effects finisher-${id}`} viewBox="0 0 800 800" aria-hidden="true" data-testid="finisher-effects" data-finisher={id}
    style={{ '--finisher-duration': `${duration}ms`, '--finisher-impact-at': `${impactAt}ms`, '--finisher-release': `${duration - impactAt}ms`, '--finisher-echo-accent': echo ? actorAccent(echo.color, echo.seat, spec.humanColor || 'w') : spec.accent }}>
    <defs><radialGradient id={`${unique}-rift`}><stop stopColor="#06070d" /><stop offset=".7" stopColor="#101525" stopOpacity=".8" /><stop offset="1" stopColor="#101525" stopOpacity="0" /></radialGradient></defs>
    <ellipse className="finisher-ground-shadow" cx={target.x} cy={target.y + 30} rx="155" ry="58" fill={`url(#${unique}-rift)`} />
    {TERRAIN.has(id) && <g className="finisher-terrain" data-testid="finisher-terrain">{Array.from({ length: 16 }, (_, i) => {
      const col = i % 4, row = Math.floor(i / 4), dx = (col - 1.5) * 19, dy = (row - 1.5) * 17;
      return <path key={i} className="finisher-tile" data-tile-fragment={i} d={`M${tileX + col * 25} ${tileY + row * 25}l24 2-2 22-22-1Z`} style={{ '--tile-x': `${dx}px`, '--tile-y': `${dy - 35}px`, '--tile-spin': `${(col - row) * 13}deg`, '--effect-order': i, transformOrigin: `${tileX + col * 25 + 12}px ${tileY + row * 25 + 12}px` }} />;
    })}</g>}
    <g className="finisher-environment" data-environment={id}><Environment id={id} target={target} start={start} seed={seed} /></g>
    {echoFrom && echoTo && <g className="finisher-allied-echo" data-testid="finisher-allied-echo"><path pathLength="1" d={`M${echoFrom.x * 8} ${echoFrom.y * 8}Q${echoTo.x * 8} ${echoFrom.y * 8} ${target.x} ${target.y}`} /><path pathLength="1" d={`M${start.x} ${start.y}Q${target.x} ${start.y} ${target.x} ${target.y}`} /><circle cx={target.x} cy={target.y} r="117" /></g>}
    <g className="finisher-debris">{debris.map((bit, i) => <path key={i} data-debris={i} className="finisher-fragment" d={`M${target.x - bit.size} ${target.y}l${bit.size * .8} ${-bit.size * 1.5} ${bit.size * 1.3} ${bit.size * .7} ${-bit.size * .5} ${bit.size * 1.5}Z`} style={{ '--fragment-x': `${bit.x}px`, '--fragment-y': `${bit.y}px`, '--fragment-spin': `${bit.spin}deg`, animationDelay: `${impactAt + bit.delay}ms`, transformOrigin: `${target.x}px ${target.y}px` }} />)}</g>
  </svg>;
}
