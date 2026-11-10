import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { GameController, DEFAULT_CONFIG, DEFAULT_PREFERENCES } from './game/controller';
import { createPosition, legalMoves, isInCheck, turnCapacity } from './game/rules';
import { getSavedMatch, listMatches, loadMatch, importMatch, exportMatch, exportMoveList, deleteMatch, loadPreferences, savePreferences } from './game/storage';
import { PieceArt } from './components/PieceArt';
import { BattleOverlay } from './components/BattleOverlay';
import { BattleGallery } from './components/BattleGallery';
import { SpecialMoveOverlay } from './components/SpecialMoveOverlay';
import { specialMoveDetails } from './game/battles';
import { PlannerOverlay } from './components/PlannerOverlay';
import { playMoveSound, unlockAudio } from './game/audio';
import './App.css';
import './chess-layout.css';

const PIECE_NAMES = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
const RESULT_NAMES = { checkmate: 'Checkmate', stalemate: 'Stalemate', repetition: 'Threefold repetition', 'fifty-move': '100 quiet moves', 'bare-kings': 'Only kings remain', timeout: 'Time expired', 'timeout-bare-king': 'Time expired · no mating pieces', resignation: 'Resignation' };
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const ICON_PATHS = {
  arena: 'M12 3 3 8l9 5 9-5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
  history: 'M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2',
  guide: 'M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4V4Zm8 2v15',
  settings: 'M9 3h6l1 4 4 2v6l-4 2-1 4H9l-1-4-4-2V9l4-2 1-4Zm6 9a3 3 0 1 0-6 0 3 3 0 0 0 6 0',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  close: 'm6 6 12 12M6 18 18 6',
  sound: 'M4 9h4l5-4v14l-5-4H4V9Zm12-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  flip: 'M4 8h14l-4-4m6 12H6l4 4M18 8l-4 4M6 16l4-4',
  pause: 'M8 4v16M16 4v16',
  play: 'm7 4 13 8-13 8V4Z',
  undo: 'M8 5 3 10l5 5M3 10h10a7 7 0 0 1 7 7',
  flag: 'M5 21V3h13l-3 5 3 5H5',
  spark: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z',
};
function Icon({ name, size = 20, ...props }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={ICON_PATHS[name] || ICON_PATHS.spark} /></svg>; }
function formatClock(ms) { const seconds = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
function moveLabel(move) { return move ? `${move.from.toUpperCase()} → ${move.to.toUpperCase()}${move.promotion ? ` · ${PIECE_NAMES[move.promotion]}` : ''}` : 'Choose a move'; }
function getPlayer(seat, humanColor) {
  const friendly = seat[0] === humanColor;
  return { name: friendly ? seat[1] === '1' ? 'You' : 'Lyra' : seat[1] === '1' ? 'Vex' : 'Mordren', role: friendly ? seat[1] === '1' ? 'Squad captain' : 'Your teammate' : seat[1] === '1' ? 'Rival captain' : 'Rival teammate', type: seat[1] === '1' ? 'n' : 'b', accent: friendly ? seat[1] === '1' ? '#e7bc72' : '#67c4b0' : seat[1] === '1' ? '#e37c7c' : '#af98df' };
}
function preferencesAtStart() {
  try { return { ...DEFAULT_PREFERENCES, ...(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? { motion: 'reduced' } : {}), ...loadPreferences() }; } catch { return DEFAULT_PREFERENCES; }
}
function download(text, name, type = 'application/json') { const url = URL.createObjectURL(new Blob([text], { type })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function Modal({ title, children, onClose, className = '' }) {
  const ref = useRef(null);
  useEffect(() => { const element = ref.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog ref={ref} className={`modal ${className}`} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>{title && <header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button></header>}{children}</dialog>;
}
function Difficulty({ label, value, onChange }) { return <fieldset className="setting-field"><legend>{label}</legend><div className="segmented">{DIFFICULTIES.map(level => <button key={level} className={value === level ? 'chosen' : ''} onClick={() => onChange(level)} aria-pressed={value === level}>{level}</button>)}</div></fieldset>; }

function App() {
  const [controller] = useState(() => new GameController({ tick: false }));
  const { match, presentation, notice, hinting } = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [screen, setScreen] = useState('home');
  const [modal, setModal] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [preferences, setPreferences] = useState(preferencesAtStart);
  const [saved, setSaved] = useState(null);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [keyboardSquare, setKeyboardSquare] = useState(null);
  const [promotion, setPromotion] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [previewStep, setPreviewStep] = useState(1);
  const [replay, setReplay] = useState(null);
  const [message, setMessage] = useState('');
  const importRef = useRef(null);
  const sounded = useRef(null);

  useEffect(() => {
    let live = true;
    Promise.all([getSavedMatch(), listMatches()]).then(([game, matches]) => { if (live) { setSaved(game); setHistory(matches); } }).catch(error => { if (live) setMessage(error.message); });
    const timer = setInterval(() => controller.chargeClock(), 200);
    const hidden = () => { if (document.hidden) controller.pause(); };
    const leaving = () => { controller.pause(); controller.persist(); };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', leaving);
    return () => { live = false; clearInterval(timer); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', leaving); };
  }, [controller]);
  useEffect(() => { controller.setPreferences(preferences); }, [preferences, controller]);
  useEffect(() => {
    if (presentation && presentation.id !== sounded.current) {
      sounded.current = presentation.id;
      if (preferences.sound) playMoveSound(presentation, preferences.volume);
    }
  }, [presentation, preferences.sound, preferences.volume]);
  useEffect(() => {
    if (!replay?.playing) return;
    const timer = setTimeout(() => {
      setReplay(current => {
        if (!current?.playing) return current;
        const index = Math.min(current.index + 1, current.match.events.length);
        const event = current.match.events[index - 1];
        return { ...current, index, event, playing: index < current.match.events.length };
      });
    }, replay.event?.duration && preferences.motion === 'full' ? replay.event.duration + 120 : 650);
    return () => clearTimeout(timer);
  }, [replay, preferences.motion]);

  async function refreshHistory() { try { const games = await listMatches(); setHistory(games); setSaved(await getSavedMatch()); } catch (error) { setMessage(error.message); } }
  function navigate(next) { window.scrollTo(0, 0); if (next !== 'game') controller.pause(); setScreen(next); setSelected(null); if (next === 'history') refreshHistory(); }
  function startGame() { window.scrollTo(0, 0); unlockAudio(); setSelected(null); setPromotion(null); setFlipped(false); setPreviewStep(1); controller.start(config); setScreen('game'); }
  function continueGame(game = match || saved) { window.scrollTo(0, 0); if (!game) return; if (game !== match) controller.load(game); setScreen('game'); setSelected(null); setFlipped(false); }
  function changePreferences(patch) { const next = { ...preferences, ...patch }; setPreferences(next); try { savePreferences(next); } catch (error) { setMessage(error.message); } }
  function openModal(name) { if (['settings', 'help', 'resign'].includes(name)) controller.pause(); setModal(name); }
  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try { const game = await importMatch(await file.text()); controller.load(game); setSaved(game); setScreen('game'); setMessage('Game imported. Resume whenever you’re ready.'); } catch (error) { setMessage(error.message); }
  }
  async function openSaved(id, replayOnly = false) {
    try { const game = await loadMatch(id); if (!game) throw new Error('This saved game is no longer available.');
      if (replayOnly || game.position.result) { controller.pause(); setReplay({ match: game, index: 0, playing: false, event: null }); setScreen('replay'); }
      else continueGame(game);
    } catch (error) { setMessage(error.message); }
  }
  const activeMatch = screen === 'replay' ? replay?.match : match;
  const humanColor = activeMatch?.config.humanColor || config.humanColor;
  const orientation = (humanColor === 'b') !== flipped ? 'black' : 'white';
  const initial = createPosition();
  const livePosition = activeMatch?.position || initial;
  const preview = screen === 'game' ? match?.preview : null;
  const replayPosition = replay ? replay.index === 0 ? replay.match.initialPosition : replay.match.events[replay.index - 1].positionAfter : null;
  const shownPosition = screen === 'replay' ? replayPosition : preview ? previewStep === 2 && preview.afterSecond ? preview.afterSecond : preview.afterFirst : livePosition;
  const shownFen = shownPosition?.fen || initial.fen;
  const battle = screen === 'game' ? presentation?.captured ? presentation : null : screen === 'replay' ? replay?.event?.captured ? replay.event : null : null;
  const specialEvent = screen === 'game' ? presentation && !presentation.captured && specialMoveDetails(presentation) ? presentation : null : screen === 'replay' && replay?.event && !replay.event.captured && specialMoveDetails(replay.event) ? replay.event : null;
  const canMove = screen === 'game' && controller.isHumanPlanning() && !preview && !hinting;
  const currentPlayer = getPlayer(`${livePosition.team}${livePosition.slot + 1}`, humanColor);
  const lastMove = screen === 'replay' ? replay?.match.events[replay.index - 1] : match?.events.at(-1);
  const availableMoves = canMove && selected ? legalMoves(livePosition, selected) : [];
  let checkedSquare = null;
  try { if (shownPosition && isInCheck(shownPosition)) checkedSquare = new Chess(shownFen).board().flat().find(p => p?.type === 'k' && p.color === shownPosition.team)?.square; } catch { /* Invalid imports are rejected before display. */ }
  const squareStyles = {};
  if (lastMove) { squareStyles[lastMove.from] = { backgroundColor: 'rgba(224, 187, 112, .22)' }; squareStyles[lastMove.to] = { backgroundColor: 'rgba(224, 187, 112, .3)' }; }
  if (selected) squareStyles[selected] = { backgroundColor: 'rgba(104, 203, 176, .5)' };
  availableMoves.forEach(move => { squareStyles[move.to] = { background: move.captured ? 'radial-gradient(transparent 58%, rgba(202, 113, 100, .7) 61%, transparent 71%)' : 'radial-gradient(rgba(29, 67, 56, .48) 17%, transparent 19%)' }; });
  if (checkedSquare) squareStyles[checkedSquare] = { background: 'radial-gradient(rgba(227, 85, 85, .9), rgba(227, 85, 85, .12))' };
  if (keyboardSquare) squareStyles[keyboardSquare] = { ...squareStyles[keyboardSquare], boxShadow: 'inset 0 0 0 3px #7ee3c7' };
  const pieces = Object.fromEntries(['w', 'b'].flatMap(color => Object.keys(PIECE_NAMES).map(type => [`${color}${type.toUpperCase()}`, () => <PieceArt type={type} color={color} size="100%" />])));
  function proposeMove(from, to) {
    if (!canMove || !to) return;
    const candidates = legalMoves(livePosition, from).filter(move => move.to === to);
    if (!candidates.length) { setSelected(null); return; }
    if (candidates.some(move => move.promotion)) { setPromotion({ from, to }); return; }
    setSelected(null); setKeyboardSquare(null); setPreviewStep(1); controller.propose({ from, to });
  }
  function selectSquare(square) {
    if (!canMove) return;
    const piece = new Chess(livePosition.fen).get(square);
    if (selected && availableMoves.some(move => move.to === square)) { proposeMove(selected, square); return; }
    setSelected(piece?.color === humanColor ? selected === square ? null : square : null);
  }
  function boardKey(event) {
    if (event.key === 'Escape') { setSelected(null); setKeyboardSquare(null); controller.cancelPreview(); return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectSquare(keyboardSquare || (humanColor === 'w' ? 'e2' : 'e7')); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const square = keyboardSquare || (humanColor === 'w' ? 'e2' : 'e7');
    const sign = orientation === 'white' ? 1 : -1;
    const file = Math.max(0, Math.min(7, square.charCodeAt(0) - 97 + (event.key === 'ArrowRight' ? sign : event.key === 'ArrowLeft' ? -sign : 0)));
    const rank = Math.max(1, Math.min(8, Number(square[1]) + (event.key === 'ArrowUp' ? sign : event.key === 'ArrowDown' ? -sign : 0)));
    setKeyboardSquare(`${String.fromCharCode(97 + file)}${rank}`);
  }
  function renderBoard(decorative = false) {
    return <div className={`board-shell ${preview ? 'is-preview' : ''}`}><span className="sr-only" aria-live="polite">{!decorative && keyboardSquare ? `${keyboardSquare.toUpperCase()}${selected === keyboardSquare ? ' selected' : ''}` : ''}</span><div className="board-corner tl" /><div className="board-corner tr" /><div className="board-corner bl" /><div className="board-corner br" />
      <div className="board-surface" tabIndex={decorative ? -1 : 0} role="group" aria-label="Chessboard. Use arrow keys to select a square, Enter to select a piece or destination, Escape to cancel." onKeyDown={boardKey}>
        <Chessboard options={{ id: decorative ? 'welcome-board' : 'squad-board', position: decorative ? initial.fen : shownFen, pieces,
          boardOrientation: decorative ? 'white' : orientation, allowDragging: !decorative && canMove, animationDurationInMs: preferences.motion === 'off' ? 0 : 180,
          allowDrawingArrows: false, arrows: [], squareStyles: decorative ? {} : squareStyles,
          darkSquareStyle: { backgroundColor: '#739552' }, lightSquareStyle: { backgroundColor: '#eeeed2' },
          darkSquareNotationStyle: { color: '#eeeed2', fontSize: '13px', fontWeight: 700 }, lightSquareNotationStyle: { color: '#739552', fontSize: '13px', fontWeight: 700 },
          canDragPiece: ({ piece }) => canMove && piece.pieceType[0] === humanColor,
          onPieceDrop: ({ sourceSquare, targetSquare }) => { proposeMove(sourceSquare, targetSquare); return false; },
          onSquareClick: ({ square }) => selectSquare(square),
          squareRenderer: ({ square, children }) => <div style={{ width: '100%', height: '100%', opacity: !decorative && battle && preferences.motion === 'full' && (square === battle.to || square === battle.captureSquare) || !decorative && specialEvent?.promotion && preferences.motion === 'full' && square === specialEvent.to ? 0 : 1 }}>{children}</div>,
        }} />
        {!decorative && preview && <PlannerOverlay preview={preview} orientation={orientation} />}
        {!decorative && specialEvent && <SpecialMoveOverlay key={specialEvent.id} event={specialEvent} orientation={orientation} motion={preferences.motion} onComplete={() => screen === 'game' ? controller.finishPresentation(specialEvent.id) : setReplay(current => ({ ...current, event: null }))} />}
        {!decorative && battle && <BattleOverlay key={battle.id} event={battle} orientation={orientation} motion={preferences.motion} onComplete={() => screen === 'game' ? controller.finishPresentation(battle.id) : setReplay(current => ({ ...current, event: null }))} />}
      </div>
      {!decorative && preview && <span className="preview-badge"><span /> Combination preview · move {previewStep}</span>}
    </div>;
  }
  function playerCard(seat) {
    const player = getPlayer(seat, humanColor); const active = screen === 'game' && `${livePosition.team}${livePosition.slot + 1}` === seat && !livePosition.result;
    return <div key={seat} className={`player-card ${active ? 'active' : ''}`} style={{ '--player-accent': player.accent }}>
      <span className="avatar"><PieceArt type={player.type} color={seat[0]} size={46} accent={player.accent} /></span>
      <span><strong>{player.name}{player.name === 'You' && <small>CAPTAIN</small>}</strong><em>{player.role}</em></span>
      {active ? <span className="live-dot" aria-label="Active player" /> : <span className="seat-order">{seat[1]}</span>}
    </div>;
  }
  function teamRow(color) {
    const friendly = color === humanColor;
    return <div className={`team-row ${friendly ? 'friendly' : 'enemy'}`}><div className="team-members">{playerCard(`${color}1`)}{playerCard(`${color}2`)}</div>
      <div className={`team-clock ${activeMatch?.clocks.enabled && activeMatch.clocks[color] < 30000 ? 'clock-low' : ''}`}><small>{friendly ? 'YOUR SQUAD' : 'RIVAL SQUAD'}</small><strong>{activeMatch?.clocks.enabled ? formatClock(activeMatch.clocks[color]) : '∞'}</strong></div>
    </div>;
  }
  const friendlyCaptured = activeMatch?.events.filter(event => event.captured && event.color === humanColor) || [];
  const result = match?.position.result;
  const summary = result ? result.winner === null ? 'An even battlefield.' : result.winner === match.config.humanColor ? 'Victory, together.' : 'A battle to learn from.' : '';

  return <div className="app-shell">
    <aside className="navigation-rail"><button className="brand-mark" onClick={() => navigate('home')} aria-label="SquadChess home"><Icon name="shield" size={28} /><span>Squad<span>Chess</span></span></button><div className="rail-links">
      <button className={['home', 'game'].includes(screen) ? 'active' : ''} onClick={() => navigate(match ? 'game' : 'home')}><Icon name="arena" /><span>Arena</span></button>
      <button className={['history', 'replay'].includes(screen) ? 'active' : ''} onClick={() => navigate('history')}><Icon name="history" /><span>Chronicle</span></button>
      <button onClick={() => openModal('help')}><Icon name="guide" /><span>Field guide</span></button>
    </div><button className="rail-settings" onClick={() => openModal('settings')}><Icon name="settings" /><span>Settings</span></button></aside>
    <div className="app-main"><header className="topbar"><button className="wordmark" onClick={() => navigate('home')}>SQUAD<span>CHESS</span><small>STRATEGY IS BETTER TOGETHER</small></button><div className="topbar-right"><span className="local-badge"><span /> LOCAL PLAY</span><button className="icon-button" title="Sound settings" aria-label={preferences.sound ? 'Mute sound' : 'Enable sound'} onClick={() => { unlockAudio(); changePreferences({ sound: !preferences.sound }); }}><Icon name="sound" /><span className={preferences.sound ? 'sr-only' : 'mute-slash'} /></button></div></header>
    {(notice || message) && <div role="status" className="notice">{message || notice}<button className="icon-button" aria-label="Dismiss notice" onClick={() => { setMessage(''); controller.clearNotice(); }}><Icon name="close" size={16} /></button></div>}
    {screen === 'home' && <main className="home-screen"><div className="home-intro"><div className="eyebrow"><span /> TWO MINDS. ONE ARMY.</div><h1>Play Squad Chess</h1><p>Team up with Lyra. Plan two moves together, then take on a squad of computer opponents.</p><div className="rules-ribbon"><span><b>01</b> You</span><i>→</i><span><b>02</b> Lyra</span><i>→</i><span className="rivals">Rival squad <b>×2</b></span></div>
      <div className="setup-card"><div className="section-heading"><h2>Assemble your squad</h2><span>SOLO CAMPAIGN</span></div><fieldset className="setting-field"><legend>Your army</legend><div className="segmented"><button className={config.humanColor === 'w' ? 'chosen' : ''} onClick={() => setConfig({ ...config, humanColor: 'w' })}>◇ Ivory · move first</button><button className={config.humanColor === 'b' ? 'chosen' : ''} onClick={() => setConfig({ ...config, humanColor: 'b' })}>◆ Obsidian · reply</button></div></fieldset>
      <div className="difficulty-row"><Difficulty label="Your teammate" value={config.teammateDifficulty} onChange={value => setConfig({ ...config, teammateDifficulty: value })} /><Difficulty label="Rival squad" value={config.opponentDifficulty} onChange={value => setConfig({ ...config, opponentDifficulty: value })} /></div>
      <label className="select-field">Time control<select value={config.timeControl} onChange={e => setConfig({ ...config, timeControl: e.target.value })}><option value="untimed">Unhurried · no clock</option><option value="5+3">Quick battle · 5 min + 3 sec / team turn</option><option value="10+5">Tactical battle · 10 min + 5 sec / team turn</option></select></label>
      <label className="balanced-setting"><input type="checkbox" checked={!!config.balancedOpening} onChange={e => setConfig({ ...config, balancedOpening: e.target.checked })} aria-label="Balanced opening" /><span><strong>Balanced opening</strong><small>White starts with one move. Both squads then get two.</small></span></label>
      <button className="primary-button large" onClick={startGame}>Enter the arena <Icon name="arrow" /></button>
      {(match || saved) && <button className="text-button continue-button" onClick={() => continueGame()}>Continue your last battle <Icon name="history" size={16} /></button>}</div>
      <div className="home-footnote"><Icon name="shield" size={15} /> Private by design. Plays and saves on this device.</div>
    </div><div className="home-showcase"><div className="showcase-heading"><div className="welcome-player"><span><PieceArt type="n" color="b" size={43} /></span><div><strong>Vex & Mordren</strong><small>Computer opponents</small></div></div><span>RIVAL SQUAD</span></div>{renderBoard(true)}<div className="showcase-bottom"><div className="mini-avatars"><PieceArt type="n" color="w" size={49} /><PieceArt type="b" color="w" size={49} /></div><p><strong>You & Lyra</strong><span>One army. Two moves. A shared plan.</span></p><span className="ornament">✧</span></div><div className="feature-strip"><button onClick={() => setModal('gallery')}><Icon name="spark" size={16} /> Explore capture battles</button><span><Icon name="arena" size={16} /> Two-move combinations</span></div></div></main>}
    {(screen === 'game' && match || screen === 'replay' && replay) && <main className="arena-screen"><div className="arena-heading"><div><div className="eyebrow">{screen === 'replay' ? 'THE CHRONICLE' : 'THE ARENA'} <span className="divider-dot">·</span> {activeMatch.config.timeControl === 'untimed' ? 'UNHURRIED' : activeMatch.config.timeControl}</div><h1>{screen === 'replay' ? 'Every move, remembered.' : 'Two moves. One intention.'}</h1></div><button className="secondary-button compact" onClick={() => navigate('home')}>New match <Icon name="arrow" size={16} /></button></div>
      <div className="arena-grid"><section className="battlefield">{teamRow(humanColor === 'w' ? 'b' : 'w')}{renderBoard()}{teamRow(humanColor)}
        <div className="board-toolbar"><div className="toolbar-actions"><button title="Flip board" aria-label="Flip board" onClick={() => setFlipped(!flipped)}><Icon name="flip" /></button>{screen === 'game' && <><button title={match.phase === 'paused' ? 'Resume game' : 'Pause game'} aria-label={match.phase === 'paused' ? 'Resume game' : 'Pause game'} onClick={() => match.phase === 'paused' ? controller.resume() : controller.pause()} disabled={!!result}><Icon name={match.phase === 'paused' ? 'play' : 'pause'} /></button><button title="Undo your last team turn" aria-label="Undo your last team turn" onClick={controller.undo} disabled={!!result || !match.events.some(e => e.color === humanColor && e.seat.endsWith('1'))}><Icon name="undo" /></button><button title="Resign" aria-label="Resign" onClick={() => openModal('resign')} disabled={!!result}><Icon name="flag" /></button></>}</div><span>{screen === 'replay' ? `Move ${replay.index} of ${replay.match.events.length}` : `${match.events.length} ${match.events.length === 1 ? 'move' : 'moves'} · turn ${livePosition.turnNumber}`}</span><button className="text-button" onClick={() => openModal('help')}>Rules <Icon name="guide" size={15} /></button></div>
        {battle && <div className="capture-status"><Icon name="spark" size={15} /><span>{battle.title}</span><button onClick={() => screen === 'game' ? controller.skipAnimation() : setReplay({ ...replay, event: null })}>Skip</button></div>}
      </section><aside className="command-panel">
      {screen === 'game' && <><div className="panel-eyebrow"><span className={match.phase === 'thinking' || preview?.status === 'thinking' ? 'pulse-dot' : 'static-dot'} /> {result ? 'BATTLE COMPLETE' : match.phase === 'paused' ? 'TAKE A BREATH' : match.phase === 'error' ? 'GAME PRESERVED' : canMove || preview ? 'YOUR TEAM’S TURN' : 'WATCH THE BATTLE'}</div>
        {result ? <div className="result-panel"><div className="result-emblem"><Icon name={result.winner === humanColor ? 'shield' : 'flag'} size={40} /></div><h2>{summary}</h2><p>{RESULT_NAMES[result.reason] || result.reason}</p><button className="primary-button" onClick={() => { controller.start(match.config); setSelected(null); }}>Rematch <Icon name="arrow" /></button><button className="secondary-button" onClick={() => { setReplay({ match, index: 0, playing: false, event: null }); setScreen('replay'); }}>Watch the replay</button></div>
        : match.phase === 'paused' || match.phase === 'error' ? <div className="pause-panel"><Icon name={match.phase === 'error' ? 'shield' : 'pause'} size={35} /><h2>{match.phase === 'error' ? 'Your battle is safe.' : 'The arena can wait.'}</h2><p>{match.error || 'Your position, plan, and clocks are preserved. Pick up exactly where you left off.'}</p><button className="primary-button" onClick={controller.resume}>{match.phase === 'error' ? 'Retry computer player' : 'Return to battle'}<Icon name="play" size={16} /></button></div>
        : <><h2 className="plan-title">{preview ? 'See the combination.' : canMove ? 'Make the first move.' : `${currentPlayer.name} takes the lead.`}</h2><p className="plan-description">{preview ? preview.status === 'ready' && !preview.second ? 'This move ends your team’s turn. Confirm when you’re ready for the rival squad’s reply.' : 'Your move sets the stage. Lyra’s follow-up is locked in when you confirm.' : canMove ? 'Choose a piece and a destination. Lyra will show you how she plans to follow through.' : `${currentPlayer.role} · move ${livePosition.slot + 1} of ${turnCapacity(livePosition)}. Your next plan begins after the rival squad finishes.`}</p>
        <div className="plan-steps"><button className={`plan-step ${previewStep === 1 && preview ? 'focused' : ''}`} onClick={() => preview && setPreviewStep(1)} disabled={!preview}><span className="step-number gold">1</span><span><small>YOUR MOVE</small><strong>{preview ? moveLabel(preview.first) : 'Set the intention'}</strong></span>{preview && <span className="step-check">✓</span>}</button><div className="step-connector" /><button className={`plan-step ${previewStep === 2 && preview ? 'focused' : ''}`} onClick={() => preview?.second && setPreviewStep(2)} disabled={!preview?.second}><span className="step-number teal">2</span><span><small>LYRA’S FOLLOW-UP</small><strong>{preview?.status === 'thinking' ? 'Finding our next move…' : preview?.second ? moveLabel(preview.second) : preview ? livePosition.settings?.balancedOpening && livePosition.openingPending ? 'Skipped for balanced opening' : 'Turn ends after your move' : 'A shared plan takes shape'}</strong></span></button></div>
        <div className="teammate-note"><div className="note-header"><span className="small-avatar"><PieceArt type="b" color={humanColor} size={36} /></span><strong>Lyra</strong><span>YOUR TEAMMATE</span></div><p>{preview?.explanation || (hinting ? 'Let me look for a combination we can play together…' : '“A good first move makes the second one matter. Let’s find ours.”')}</p></div>
        {preview ? <><button className="primary-button" disabled={preview.status !== 'ready'} onClick={() => { unlockAudio(); controller.confirm(); setPreviewStep(1); }}>{preview.status === 'ready' ? 'Play team turn' : 'Planning our combination…'}<Icon name="arrow" /></button><button className="text-button change-plan" onClick={() => { controller.cancelPreview(); setSelected(null); }}>Change my move</button></> : <button className="secondary-button hint-button" onClick={controller.hint} disabled={!canMove || hinting}><Icon name="spark" size={17} />{hinting ? 'Looking for a combination…' : 'Ask Lyra for a hint'}</button>}
        <div className="rule-note"><Icon name="shield" size={16} /><span>Giving check ends your team’s turn.<br />Sometimes one move says enough.</span></div></>}
        <div className="captured-section"><div className="section-heading"><h3>Your squad’s captures</h3><span>{friendlyCaptured.length}</span></div><div className="captured-pieces">{friendlyCaptured.length ? friendlyCaptured.map(e => <span key={e.id} title={PIECE_NAMES[e.captured]}><PieceArt type={e.captured} color={humanColor === 'w' ? 'b' : 'w'} size={33} /></span>) : <p>The battlefield is still whole.</p>}</div></div></>}
      {screen === 'replay' && <><div className="panel-eyebrow">A BATTLE IN RETROSPECT</div><h2 className="plan-title">Read between the moves.</h2><p className="plan-description">Step through the decisions, or replay the battle with its original capture sequences.</p><input aria-label="Replay move" className="replay-range" type="range" min="0" max={replay.match.events.length} value={replay.index} onChange={e => setReplay({ ...replay, index: Number(e.target.value), event: null, playing: false })} /><div className="replay-controls"><button aria-label="First move" onClick={() => setReplay({ ...replay, index: 0, event: null, playing: false })}>|‹</button><button aria-label="Previous move" onClick={() => setReplay({ ...replay, index: Math.max(0, replay.index - 1), event: null, playing: false })}>‹</button><button className="play-replay" aria-label={replay.playing ? 'Pause replay' : 'Play replay'} onClick={() => setReplay({ ...replay, index: replay.index === replay.match.events.length ? 0 : replay.index, playing: !replay.playing, event: null })}><Icon name={replay.playing ? 'pause' : 'play'} size={17} /></button><button aria-label="Next move" onClick={() => setReplay({ ...replay, index: Math.min(replay.match.events.length, replay.index + 1), event: null, playing: false })}>›</button><button aria-label="Last move" onClick={() => setReplay({ ...replay, index: replay.match.events.length, event: null, playing: false })}>›|</button></div><div className="teammate-note"><p>{lastMove ? `${getPlayer(lastMove.seat, humanColor).name} · ${moveLabel(lastMove)}${lastMove.givesCheck ? ' · Check' : ''}` : 'The armies assemble. White makes the first two moves.'}</p></div></>}
      <div className="move-log"><div className="section-heading"><h3>Battle record</h3><button className="icon-button" aria-label="Export readable move history" onClick={() => download(exportMoveList(activeMatch), 'squadchess-history.txt', 'text/plain')}><Icon name="download" size={16} /></button></div><div className="move-log-scroll">{activeMatch.events.length ? activeMatch.events.map((event, index) => <button key={event.id} className={`move-log-row ${screen === 'replay' && replay.index === index + 1 ? 'current' : ''}`} onClick={() => { if (screen !== 'replay') controller.pause(); setReplay({ match: activeMatch, index: index + 1, playing: false, event: null }); setScreen('replay'); }}><span>{index + 1}</span><i style={{ background: getPlayer(event.seat, humanColor).accent }} /><span>{getPlayer(event.seat, humanColor).name}</span><strong>{event.san || `${event.from}–${event.to}`}</strong>{event.captured && <Icon name="spark" size={12} />}</button>) : <p className="empty-record">Every great combination starts<br />with a first move.</p>}</div></div>
      <button className="text-button export-button" onClick={() => download(exportMatch(activeMatch), `squadchess-${activeMatch.id.slice(0, 8)}.json`)}><Icon name="download" size={15} /> Save a portable copy</button>
      </aside></div></main>}
    {screen === 'history' && <main className="history-screen"><div className="arena-heading"><div><div className="eyebrow">YOUR CHRONICLE</div><h1>Every battle has a story.</h1></div><button className="secondary-button" onClick={() => importRef.current.click()}><Icon name="upload" size={17} /> Import game</button></div><p className="page-description">Your matches stay on this device. Resume an unfinished battle or revisit a memorable combination.</p><div className="history-grid">{history.length ? history.map(game => <article className="history-card" key={game.id}><div className="history-card-top"><span className="history-emblem"><Icon name="shield" size={26} /></span><span className="game-tag">{game.position?.result ? 'COMPLETE' : 'IN PROGRESS'}</span></div><h2>{game.position?.result ? game.position.result.winner === null ? 'An even battlefield' : game.position.result.winner === game.config.humanColor ? 'A shared victory' : 'Lessons from the arena' : 'Your squad awaits'}</h2><p>{new Date(game.updatedAt || game.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {game.events?.length || 0} moves</p><div className="history-meta">{(game.assisted?.hints || game.assisted?.undos) ? <span>Assisted</span> : null}<span>{game.config?.opponentDifficulty} rivals</span><span>{game.config?.timeControl === 'untimed' ? 'Unhurried' : game.config?.timeControl}</span></div><div className="history-actions"><button className="primary-button" onClick={() => openSaved(game.id)}>{game.position?.result ? 'Watch replay' : 'Resume battle'}<Icon name="arrow" size={17} /></button><button className="icon-button" title="Delete saved game" aria-label="Delete saved game" onClick={async () => { if (window.confirm('Delete this saved battle? This cannot be undone.')) { try { await deleteMatch(game.id); await refreshHistory(); } catch (error) { setMessage(error.message); } } }}><Icon name="close" size={16} /></button></div></article>) : <div className="empty-history"><Icon name="history" size={44} /><h2>A story waiting to be written.</h2><p>Your saved battles will appear here.</p><button className="primary-button" onClick={() => navigate('home')}>Start your first match <Icon name="arrow" /></button></div>}</div></main>}
    <footer className="app-footer"><span>SQUADCHESS <i>✧</i> A different kind of strategy.</span><button onClick={() => openModal('help')}>Learn the two-move rules <Icon name="arrow" size={14} /></button></footer>
    </div>
    <input ref={importRef} className="sr-only" type="file" accept=".json,application/json" aria-label="Import SquadChess game" onChange={importFile} />
    {promotion && <Modal title="Choose your promotion" onClose={() => setPromotion(null)}><p className="dialog-copy">Your pawn has earned a new role. It can act again if your team has a move left.</p><div className="promotion-choices">{['q', 'r', 'b', 'n'].map(type => <button key={type} onClick={() => { controller.propose({ ...promotion, promotion: type }); setPromotion(null); setSelected(null); setPreviewStep(1); }}><PieceArt type={type} color={humanColor} size={72} /><span>{PIECE_NAMES[type]}</span></button>)}</div></Modal>}
    {modal === 'gallery' && <Modal className="atelier-modal" onClose={() => setModal(null)}><BattleGallery motion={preferences.motion} onClose={() => setModal(null)} /></Modal>}
    {modal === 'settings' && <Modal title="Make the arena yours" onClose={() => setModal(null)}><fieldset className="setting-field"><legend>Battle animation</legend><div className="segmented">{['full', 'reduced', 'off'].map(mode => <button key={mode} className={preferences.motion === mode ? 'chosen' : ''} aria-pressed={preferences.motion === mode} onClick={() => changePreferences({ motion: mode })}>{mode}</button>)}</div><p className="field-help">Full battles bring every capture to life. Reduced motion uses short, gentle transitions.</p></fieldset><label className="toggle-setting"><span>Battle sounds</span><input type="checkbox" checked={preferences.sound} onChange={e => { unlockAudio(); changePreferences({ sound: e.target.checked }); }} /></label><label className="select-field">Volume<input type="range" min="0" max="1" step="0.05" value={preferences.volume} onChange={e => changePreferences({ volume: Number(e.target.value) })} /></label><button className="secondary-button" onClick={() => setModal('gallery')}><Icon name="spark" size={17} /> Explore the capture battles</button><p className="dialog-copy">Your preferences are remembered on this device. Closing this window leaves an active battle paused.</p><button className="primary-button" onClick={() => setModal(null)}>Done</button></Modal>}
    {modal === 'help' && <Modal title="Two minds. Two moves." className="guide-modal" onClose={() => setModal(null)}><p className="guide-lead">You set up the combination. Your teammate completes it.</p><div className="guide-order"><span>You</span><Icon name="arrow" size={16} /><span>Lyra</span><Icon name="arrow" size={16} /><span>Vex</span><Icon name="arrow" size={16} /><span>Mordren</span></div><div className="guide-sections"><section><h3>A shared army</h3><p>Both players control all their team’s pieces. Move two different pieces, or move the same piece twice. White opens with a full pair by default. Balanced opening gives White just one opening move, then normal pairs for both teams. If you choose Black, the rival squad opens.</p></section><section><h3>Plan before you commit</h3><p>Choose your first move, inspect Lyra’s follow-up, and confirm the combination. Her displayed move is the one she will play. Use Change my move to try another idea.</p></section><section className="guide-highlight"><h3>Check changes the rhythm</h3><p>Any move that gives check ends that team’s turn immediately. The other team must escape check on its first move. Every move must keep your own king safe; kings are never captured.</p></section><section><h3>Special moves</h3><p>Castling takes one move. Choose any normal promotion piece; it may move again if your team has a second move. En passant is available only after a two-square pawn move that ends the opposing turn, and only on your first move.</p></section><section><h3>How battles end</h3><p>Checkmate wins. No legal move at the start of a turn is stalemate. No legal second move simply passes the turn. Three repeated team-turn positions, bare kings, or 100 individual moves without a pawn move or capture draw the game. Checkmate takes priority.</p></section><section><h3>Clocks & controls</h3><p>The team clock includes planning and thinking. Animations and pauses are free; switching away pauses the game. Time is added once per completed team turn. Arrow keys move your board focus, Enter selects, and Escape cancels. Undo returns to the start of your last team turn.</p></section><section><h3>A note on the words</h3><p>Check: a king is threatened. Checkmate: it cannot escape. Stalemate: no move is legal but the king is safe. Castling: moving king and rook together. En passant: an immediate special pawn capture. Promotion: a pawn becomes a stronger piece.</p></section></div><button className="primary-button" onClick={() => setModal(null)}>I’m ready <Icon name="arrow" /></button></Modal>}
    {modal === 'resign' && <Modal title="Leave this battle?" onClose={() => setModal(null)}><p className="dialog-copy">Resigning awards the match to the rival squad. The full battle remains in your chronicle to replay.</p><div className="dialog-actions"><button className="secondary-button" onClick={() => { setModal(null); controller.resume(); }}>Keep playing</button><button className="danger-button" onClick={() => { controller.resign(); setModal(null); }}>Resign match</button></div></Modal>}
  </div>;
}
export default App;
