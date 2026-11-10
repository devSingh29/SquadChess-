import { useRef, useState } from 'react';
import PieceArt from './PieceArt.jsx';
import BattleOverlay from './BattleOverlay.jsx';
import { actorAccent, BATTLE_VARIANTS, battleDetails, battleSpec, hashSeed, PIECE_NAMES, squareCenter } from '../game/battles.js';
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

function previewEvent(type, variant, victim, seat, combo, sequence) {
  const [from, to] = LOCATIONS[type];
  const move = { id: `atelier-${sequence}`, from, to, captureSquare: to, piece: type, color: seat[0], seat, captured: victim, humanColor: 'w' };
  const previous = combo ? [{ ...move, piece: 'p' }] : [];
  const detail = battleDetails(move, previous, 'w', hashSeed(`${type}:${variant}:${victim}:${seat}:${sequence}`));
  return battleSpec({ ...move, ...detail, variant });
}

export function BattleGallery({ motion = 'full', onClose }) {
  const [type, setType] = useState('p');
  const [variant, setVariant] = useState('pawn-thrust');
  const [victim, setVictim] = useState('n');
  const [seat, setSeat] = useState('w1');
  const [combo, setCombo] = useState(false);
  const [sound, setSound] = useState(false);
  const [event, setEvent] = useState(() => previewEvent('p', 'pawn-thrust', 'n', 'w1', false, 0));
  const [playing, setPlaying] = useState(true);
  const sequence = useRef(0);
  const accent = actorAccent(seat[0], seat, 'w');
  const destination = squareCenter(event.to);
  const showRestingPiece = !playing || motion !== 'full';

  function preview(next = {}) {
    sequence.current += 1;
    const nextEvent = previewEvent(next.type ?? type, next.variant ?? variant, next.victim ?? victim, next.seat ?? seat, next.combo ?? combo, sequence.current);
    setEvent(nextEvent);
    setPlaying(true);
    if (sound) unlockAudio().then(unlocked => { if (unlocked) playMoveSound(nextEvent, 0.35); });
  }

  return <section className="battle-gallery" aria-label="Battle atelier">
    <header className="battle-gallery-header">
      <div><span className="battle-gallery-eyebrow">The art of the encounter</span><h2>Battle atelier</h2><p>Six champions. Twenty-four ways to claim a square.</p></div>
      {onClose && <button className="battle-gallery-close" type="button" aria-label="Close battle atelier" onClick={onClose}>×</button>}
    </header>
    <div className="battle-gallery-layout">
      <div className="battle-gallery-stage-column">
        <div className="battle-gallery-stage" aria-label={`${ROLE_NAMES[type]} capture preview`} style={{ '--gallery-accent': accent }}>
          <div className="battle-gallery-squares" aria-hidden="true">
            {Array.from({ length: 64 }, (_, index) => <span key={index} className={(Math.floor(index / 8) + index % 8) % 2 ? 'battle-gallery-square-dark' : 'battle-gallery-square-light'} />)}
          </div>
          <span className="battle-gallery-stage-mark" aria-hidden="true">SQUAD / ATELIER</span>
          {showRestingPiece && <div className="battle-gallery-resting-piece" style={{ left: `${destination.x}%`, top: `${destination.y}%` }}><PieceArt type={type} color={seat[0]} accent={accent} size="100%" /></div>}
          {playing && <BattleOverlay event={event} motion={motion} onComplete={() => setPlaying(false)} />}
        </div>
        <div className="battle-gallery-preview-description" aria-live="polite"><span>{combo ? 'Squad combination' : event.underdog ? 'Giant slayer' : 'Signature encounter'}</span><h3>{event.title}</h3><p>{DESCRIPTIONS[variant]}</p></div>
        <div className="battle-gallery-playback">
          <button type="button" className="battle-gallery-play" onClick={() => preview()}><span aria-hidden="true">↻</span> {playing ? 'Play again' : 'Replay battle'}</button>
          <button type="button" className={`battle-gallery-sound${sound ? ' is-active' : ''}`} aria-pressed={sound} onClick={() => { if (!sound) unlockAudio(); setSound(!sound); }}>Sound {sound ? 'on' : 'off'}</button>
        </div>
        {motion !== 'full' && <p className="battle-gallery-motion-note">Your {motion === 'off' ? 'motion-off' : 'reduced-motion'} preference is active. Change it in Settings to see the full encounters.</p>}
      </div>
      <div className="battle-gallery-controls">
        <fieldset><legend>Choose your champion</legend><div className="battle-gallery-roles">{TYPES.map(piece => <button type="button" key={piece} aria-pressed={type === piece} aria-label={`${PIECE_NAMES[piece]}, ${ROLE_NAMES[piece]}`} className={type === piece ? 'is-active' : ''} onClick={() => { const nextVariant = BATTLE_VARIANTS[piece][0]; setType(piece); setVariant(nextVariant); preview({ type: piece, variant: nextVariant }); }}><PieceArt type={piece} color={seat[0]} size={49} accent={accent} /><span>{PIECE_NAMES[piece]}</span></button>)}</div></fieldset>
        <fieldset><legend>Choose the encounter <small>4 of 24</small></legend><div className="battle-gallery-attacks">{BATTLE_VARIANTS[type].map((attack, index) => <button type="button" key={attack} aria-pressed={variant === attack} className={variant === attack ? 'is-active' : ''} onClick={() => { setVariant(attack); preview({ variant: attack }); }}><span className="battle-gallery-attack-number">0{index + 1}</span><span>{attack.split('-')[1]}</span><span aria-hidden="true">↗</span></button>)}</div></fieldset>
        <fieldset><legend>The opposing piece</legend><div className="battle-gallery-victims">{VICTIMS.map(piece => <button type="button" key={piece} aria-pressed={victim === piece} className={victim === piece ? 'is-active' : ''} onClick={() => { setVictim(piece); preview({ victim: piece }); }}>{ROLE_NAMES[piece]}</button>)}</div></fieldset>
        <fieldset><legend>Whose move?</legend><div className="battle-gallery-actors">{SEATS.map(actor => <button type="button" key={actor.value} style={{ '--actor-accent': actorAccent(actor.value[0], actor.value, 'w') }} aria-pressed={seat === actor.value} className={seat === actor.value ? 'is-active' : ''} onClick={() => { setSeat(actor.value); preview({ seat: actor.value }); }}><span className="battle-gallery-actor-dot" /><span>{actor.label}<small>{actor.caption}</small></span></button>)}</div></fieldset>
        <button className={`battle-gallery-combo${combo ? ' is-active' : ''}`} type="button" aria-pressed={combo} onClick={() => { setCombo(!combo); preview({ combo: !combo }); }}><span aria-hidden="true">✦</span><span>Squad combination<small>Celebrate two captures in one team turn</small></span><span aria-hidden="true">{combo ? 'On' : 'Off'}</span></button>
      </div>
    </div>
    <footer className="battle-gallery-footer">Each encounter combines a signature attack, the defeated piece’s reaction, and a fresh flourish.</footer>
  </section>;
}

export default BattleGallery;
