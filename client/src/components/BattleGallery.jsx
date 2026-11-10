import { useEffect, useRef, useState } from 'react';
import PieceArt from './PieceArt.jsx';
import BattleOverlay from './BattleOverlay.jsx';
import { actorAccent, BATTLE_VARIANTS, battleDetails, battleSpec, hashSeed, PIECE_NAMES, squareCenter } from '../game/battles.js';
import { FINISHER_REGISTRY, REACTION_VARIANTS } from '../game/finishers.js';
import { playMoveSound, unlockAudio } from '../game/audio.js';
import './battle-gallery.css';

const TYPES = ['p', 'n', 'b', 'r', 'q', 'k'];
const VICTIMS = ['p', 'n', 'b', 'r', 'q'];
const ROLE_NAMES = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
const SEATS = [
  { value: 'w1', label: 'You', caption: 'Amber' },
  { value: 'w2', label: 'Lyra', caption: 'Jade' },
  { value: 'b1', label: 'Vex', caption: 'Crimson' },
  { value: 'b2', label: 'Mordren', caption: 'Amethyst' },
];
const LOCATIONS = { p: ['e4', 'd5'], n: ['c3', 'd5'], b: ['b3', 'e6'], r: ['b4', 'f4'], q: ['c3', 'f6'], k: ['d4', 'e5'] };
const DESCRIPTIONS = {
  'pawn-thrust': 'A measured advance. One decisive spear thrust.',
  'pawn-rush': 'A fearless sprint, driving through the enemy line.',
  'pawn-strike': 'A rising strike followed by a sharp diagonal finish.',
  'pawn-underdog': 'A leaping attack that turns courage into victory.',
  'knight-charge': 'The rider accelerates through a thunderous collision.',
  'knight-vault': 'A high mounted leap lands with the weight of steel.',
  'knight-slash': 'A sweeping ride carries a crescent strike past the enemy.',
  'knight-bash': 'The mount rears before a crushing forward impact.',
  'bishop-blade': 'A diagonal dash draws a blade of astral light.',
  'bishop-beam': 'The oracle holds position and channels a radiant beam.',
  'bishop-eruption': 'A descending staff awakens a burst of ancient runes.',
  'bishop-bind': 'A rotating seal binds the enemy before it dissolves.',
  'rook-slam': 'The bastion rises, then brings its siege hammer down.',
  'rook-charge': 'An armored charge breaks through without hesitation.',
  'rook-shock': 'A ground strike sends a heavy shockwave outward.',
  'rook-blast': 'A distant siege blast clears the path for an advance.',
  'queen-chains': 'Arcs of royal magic reach out and seize the target.',
  'queen-blades': 'Two crossing passes carve a crown of radiant blades.',
  'queen-orbit': 'The empress circles her enemy in a celestial dance.',
  'queen-burst': 'Gathered starlight expands into a brilliant final burst.',
  'king-sword': 'The sovereign steps forward with a sweeping sword stroke.',
  'king-shield': 'A resolute shield rush forces the enemy aside.',
  'king-command': 'A raised weapon invokes the force of a royal decree.',
  'king-shock': 'The sovereign lands a strike that awakens the crown.',
};

const FINISHER_DESCRIPTIONS = {
  'pawn-giants-fall': 'A low spear snare trips the defender. Armor strikes the tiles with a shattering fall.',
  'pawn-spearline': 'A planted spear sends a line of jagged stone rising beneath the defender.',
  'knight-thunderhoof': 'The mounted charge leaves thunderous hoofprints and rolling ground shocks.',
  'knight-skybreaker': 'A high vault drives a radiant lance into the square, opening a deep crater.',
  'bishop-astral-gate': 'Twin astral gates close around the defender and draw its shattered form into the void.',
  'bishop-runic-fault': 'A diagonal fault tears open the tiles as ancient rune pillars rise from below.',
  'rook-earthbreaker': 'The hammer splits the square. Fractured tiles rise through a spreading earthquake.',
  'rook-citadel-crush': 'Two fortress walls erupt from the board and close with crushing force.',
  'queen-gravity-crown': 'Orbiting stone and a spectral crown collapse into a single point of royal gravity.',
  'queen-starfall': 'A staggered rain of stars leaves a constellation of impacts across the square.',
  'king-royal-judgment': 'Spectral shields converge, break the defender’s guard, and seal the royal verdict.',
  'king-crowns-wrath': 'The crown releases a ring of royal blades and a sweeping shockwave.',
};
const roleFinishers = type => Object.values(FINISHER_REGISTRY).filter(entry => entry.piece === type);

function previewEvent({ type, variant, victim, seat, combo, sequence, mode, finisherId, reactionId, humanColor }) {
  const [from, to] = LOCATIONS[type];
  const move = { id: `atelier-${sequence}`, from, to, captureSquare: to, piece: type, color: seat[0], seat, captured: victim, humanColor };
  const detail = battleDetails(move, [], humanColor, hashSeed(`${type}:${variant}:${victim}:${seat}:${sequence}`));
  const selectedFinisher = FINISHER_REGISTRY[finisherId] || roleFinishers(type)[0];
  const baseDuration = detail.finisher?.baseDuration || detail.duration;
  const echo = { from: 'b2', to: 'c3', captureSquare: 'c3', piece: 'b', color: seat[0], seat: `${seat[0]}${seat[1] === '1' ? '2' : '1'}` };
  return { ...move, ...detail, variant, combo, presentationVersion: 2,
    reactionVariant: REACTION_VARIANTS[victim].some(entry => entry.id === reactionId) ? reactionId : REACTION_VARIANTS[victim][0].id,
    finisher: mode === 'finishers' ? { id: selectedFinisher.id, baseDuration, ...(combo ? { echo } : {}) } : undefined,
    duration: mode === 'finishers' ? selectedFinisher.duration : baseDuration,
  };
}

export function BattleGallery({ motion = 'full', prefs, onClose }) {
  const [type, setType] = useState('p');
  const [variant, setVariant] = useState('pawn-thrust');
  const [victim, setVictim] = useState('n');
  const [seat, setSeat] = useState('w1');
  const [humanColor, setHumanColor] = useState('w');
  const [mode, setMode] = useState('attacks');
  const [finisherId, setFinisherId] = useState('pawn-giants-fall');
  const [reactionId, setReactionId] = useState('knight-unseat');
  const [combo, setCombo] = useState(false);
  const [sound, setSound] = useState(false);
  const [event, setEvent] = useState(() => previewEvent({ type: 'p', variant: 'pawn-thrust', victim: 'n', seat: 'w1', combo: false, sequence: 0, mode: 'attacks', reactionId: 'knight-unseat', humanColor: 'w' }));
  const [playing, setPlaying] = useState(true);
  const sequence = useRef(0);
  const stage = useRef(null);
  const soundCleanup = useRef(null);
  const soundEnabled = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; soundCleanup.current?.(); }; }, []);
  useEffect(() => () => { soundCleanup.current?.(); }, [motion]);
  const accent = actorAccent(seat[0], seat, humanColor);
  const previewPrefs = { ...prefs, finishers: mode === 'finishers', motion };
  const resolved = battleSpec(event, previewPrefs);
  const actors = SEATS.map(actor => ({ ...actor, value: humanColor === 'w' ? actor.value : `${actor.value[0] === 'w' ? 'b' : 'w'}${actor.value[1]}` }));
  const destination = squareCenter(event.to);
  const showRestingPiece = !playing || motion !== 'full';

  function preview(next = {}) {
    if (window.matchMedia?.('(max-width: 650px)').matches) stage.current?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
    sequence.current += 1;
    const nextEvent = previewEvent({ type, variant, victim, seat, combo, mode, finisherId, reactionId, humanColor, ...next, sequence: sequence.current });
    setEvent(nextEvent);
    setPlaying(true);
    soundCleanup.current?.();
    const currentSequence = sequence.current;
    if (soundEnabled.current) unlockAudio().then(unlocked => {
      if (unlocked && mounted.current && soundEnabled.current && sequence.current === currentSequence) soundCleanup.current = playMoveSound(nextEvent, prefs?.volume ?? .35, motion, { ...prefs, finishers: (next.mode ?? mode) === 'finishers' });
    });
  }

  return <section className="battle-gallery" aria-label="Battle atelier">
    <header className="battle-gallery-header">
      <div><span className="battle-gallery-eyebrow">The art of the encounter</span><h2>Battle atelier</h2><p>24 attacks. 12 legendary finishes. 15 ways a defender falls.</p></div>
      {onClose && <button className="battle-gallery-close" type="button" aria-label="Close battle atelier" onClick={onClose}>×</button>}
    </header>
    <div className="battle-gallery-modes" role="group" aria-label="Preview collection">{[['attacks', 'Attacks'], ['finishers', 'Finishers'], ['reactions', 'Defeat reactions']].map(([value, label]) => <button type="button" key={value} aria-pressed={mode === value} className={mode === value ? 'is-active' : ''} onClick={() => { setMode(value); preview({ mode: value }); }}>{label}</button>)}</div>
    <div className="battle-gallery-layout">
      <div className="battle-gallery-stage-column">
        <div ref={stage} className="battle-gallery-stage board-scene" aria-label={`${ROLE_NAMES[type]} capture preview`} style={{ '--gallery-accent': accent }}>
          <div className="battle-gallery-squares" aria-hidden="true">{Array.from({ length: 64 }, (_, index) => <span key={index} className={(Math.floor(index / 8) + index % 8) % 2 ? 'battle-gallery-square-dark' : 'battle-gallery-square-light'} />)}</div>
          <span className="battle-gallery-stage-mark" aria-hidden="true">SQUAD / ATELIER</span>
          {showRestingPiece && <div className="battle-gallery-resting-piece" style={{ left: `${destination.x}%`, top: `${destination.y}%` }}><PieceArt type={type} color={seat[0]} accent={accent} size="100%" /></div>}
          {playing && <BattleOverlay key={event.id} event={event} motion={motion} prefs={previewPrefs} boardShake={prefs?.boardShake !== false} onComplete={() => setPlaying(false)} />}
        </div>
        <div className="battle-gallery-preview-description" aria-live="polite"><span>{mode === 'finishers' ? 'Legendary finish' : combo ? 'Squad combination' : mode === 'reactions' ? 'Defender study' : 'Signature encounter'}</span><h3>{mode === 'reactions' ? resolved.reaction.title : resolved.title}</h3><p>{mode === 'finishers' ? FINISHER_DESCRIPTIONS[finisherId] : mode === 'reactions' ? 'The defender raises its guard before the blow. Each reaction changes the body, armor, or weapon’s final movement.' : DESCRIPTIONS[variant]}</p></div>
        <div className="battle-gallery-playback">
          <button type="button" className="battle-gallery-play" onClick={() => preview()}><span aria-hidden="true">↻</span> {playing ? 'Play again' : 'Replay battle'}</button>
          <button type="button" className={`battle-gallery-sound${sound ? ' is-active' : ''}`} aria-pressed={sound} onClick={() => { soundEnabled.current = !sound; if (!sound) unlockAudio(); else soundCleanup.current?.(); setSound(!sound); }}>Sound {sound ? 'on' : 'off'}</button>
        </div>
        {motion !== 'full' && <p className="battle-gallery-motion-note">Your {motion === 'off' ? 'motion-off' : 'reduced-motion'} preference is active. Change it in Settings to see the full encounters.</p>}
      </div>
      <div className="battle-gallery-controls">
        <fieldset><legend>Choose your champion</legend><div className="battle-gallery-roles">{TYPES.map(piece => <button type="button" key={piece} aria-pressed={type === piece} aria-label={`${PIECE_NAMES[piece]}, ${ROLE_NAMES[piece]}`} className={type === piece ? 'is-active' : ''} onClick={() => { const nextVariant = BATTLE_VARIANTS[piece][0]; const nextFinisher = roleFinishers(piece)[0].id; setType(piece); setVariant(nextVariant); setFinisherId(nextFinisher); preview({ type: piece, variant: nextVariant, finisherId: nextFinisher }); }}><PieceArt type={piece} color={seat[0]} size={49} accent={accent} /><span>{PIECE_NAMES[piece]}</span></button>)}</div></fieldset>
        {mode === 'attacks' && <fieldset><legend>Choose the encounter <small>4 of 24</small></legend><div className="battle-gallery-attacks">{BATTLE_VARIANTS[type].map((attack, index) => <button type="button" key={attack} aria-pressed={variant === attack} className={variant === attack ? 'is-active' : ''} onClick={() => { setVariant(attack); preview({ variant: attack }); }}><span className="battle-gallery-attack-number">0{index + 1}</span><span>{attack.split('-')[1]}</span><span aria-hidden="true">↗</span></button>)}</div></fieldset>}
        {mode === 'finishers' && <fieldset><legend>Legendary finish <small>2 of 12</small></legend><div className="battle-gallery-attacks battle-gallery-finishers">{roleFinishers(type).map((entry, index) => <button type="button" key={entry.id} data-finisher-choice={entry.id} aria-pressed={finisherId === entry.id} className={finisherId === entry.id ? 'is-active' : ''} onClick={() => { setFinisherId(entry.id); preview({ finisherId: entry.id }); }}><span className="battle-gallery-attack-number">0{index + 1}</span><span>{entry.title}</span><span aria-hidden="true">✦</span></button>)}</div></fieldset>}
        <fieldset><legend>The opposing piece</legend><div className="battle-gallery-victims">{VICTIMS.map(piece => <button type="button" key={piece} aria-pressed={victim === piece} className={victim === piece ? 'is-active' : ''} onClick={() => { const nextReaction = REACTION_VARIANTS[piece][0].id; setVictim(piece); setReactionId(nextReaction); preview({ victim: piece, reactionId: nextReaction }); }}>{ROLE_NAMES[piece]}</button>)}</div></fieldset>
        {mode === 'reactions' && <fieldset><legend>Defeat reaction <small>3 of 15</small></legend><div className="battle-gallery-reactions">{REACTION_VARIANTS[victim].map(entry => <button type="button" key={entry.id} data-reaction-choice={entry.id} aria-pressed={reactionId === entry.id} className={reactionId === entry.id ? 'is-active' : ''} onClick={() => { setReactionId(entry.id); preview({ reactionId: entry.id }); }}>{entry.title}</button>)}</div></fieldset>}
        <fieldset><legend>Your army</legend><div className="battle-gallery-armies">{[['w', 'White army'], ['b', 'Black army']].map(([color, label]) => <button type="button" key={color} aria-pressed={humanColor === color} className={humanColor === color ? 'is-active' : ''} onClick={() => { const nextSeat = humanColor === color ? seat : `${seat[0] === 'w' ? 'b' : 'w'}${seat[1]}`; setHumanColor(color); setSeat(nextSeat); preview({ humanColor: color, seat: nextSeat }); }}>{label}</button>)}</div></fieldset>
        <fieldset><legend>Whose move?</legend><div className="battle-gallery-actors">{actors.map(actor => <button type="button" key={actor.value} style={{ '--actor-accent': actorAccent(actor.value[0], actor.value, humanColor) }} aria-pressed={seat === actor.value} className={seat === actor.value ? 'is-active' : ''} onClick={() => { setSeat(actor.value); preview({ seat: actor.value }); }}><span className="battle-gallery-actor-dot" /><span>{actor.label}<small>{actor.caption}</small></span></button>)}</div></fieldset>
        <button className={`battle-gallery-combo${combo ? ' is-active' : ''}`} type="button" aria-pressed={combo} onClick={() => { setCombo(!combo); preview({ combo: !combo }); }}><span aria-hidden="true">✦</span><span>Squad combination<small>Celebrate two captures in one team turn</small></span><span aria-hidden="true">{combo ? 'On' : 'Off'}</span></button>
      </div>
    </div>
    <footer className="battle-gallery-footer">Explicit previews bypass match cooldowns. Motion and board-shake preferences still apply. All characters and effects are original artwork.</footer>
  </section>;
}

export default BattleGallery;
