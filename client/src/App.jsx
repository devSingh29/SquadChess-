import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { GameController, DEFAULT_CONFIG, DEFAULT_PREFERENCES } from './game/controller';
import { createPosition, legalMoves, isInCheck } from './game/rules';
import { getSavedMatch, listMatches, loadMatch, importMatch, exportMatch, exportMoveList, deleteMatch, loadPreferences, savePreferences } from './game/storage';
import { PieceArt } from './components/PieceArt';
import { BattleOverlay } from './components/BattleOverlay';
import { BattleGallery } from './components/BattleGallery';
import { MovementOverlay } from './components/MovementOverlay';
import { SettingsPanel } from './components/SettingsPanel';
import { BOARD_THEMES } from './game/themes';
import { SpecialMoveOverlay } from './components/SpecialMoveOverlay';
import { specialMoveDetails, battleSpec } from './game/battles';
import { Icon } from './components/Icon';
import { HomeScreen } from './components/HomeScreen';
import { MatchPanel } from './components/MatchPanel';
import { PIECE_NAMES, formatClock, getPlayer } from './game/viewLabels';
import { PlannerOverlay } from './components/PlannerOverlay';
import { playMoveSound, unlockAudio } from './game/audio';
import './App.css';
import './chess-layout.css';

function preferencesAtStart() {
  const defaults = { ...DEFAULT_PREFERENCES, ...(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? { motion: 'reduced' } : {}) };
  try { return { preferences: { ...defaults, ...loadPreferences() }, error: '' }; }
  catch (error) { return { preferences: defaults, error: error.message }; }
}
function download(text, name, type = 'application/json') { const url = URL.createObjectURL(new Blob([text], { type })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function Modal({ title, children, onClose, className = '' }) {
  const ref = useRef(null);
  useEffect(() => { const element = ref.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog ref={ref} className={`modal ${className}`} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>{title && <header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button></header>}{children}</dialog>;
}

function App() {
  const [controller] = useState(() => new GameController({ tick: false }));
  const { match, presentation, notice, hinting } = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [screen, setScreen] = useState('home');
  const [modal, setModal] = useState(null);
  const [initialPreferences] = useState(preferencesAtStart);
  const [config, setConfig] = useState(() => ({ ...DEFAULT_CONFIG, ...initialPreferences.preferences.matchDefaults }));
  const [preferences, setPreferences] = useState(initialPreferences.preferences);
  const [saved, setSaved] = useState(null);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [keyboardSquare, setKeyboardSquare] = useState(null);
  const [promotion, setPromotion] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [previewStep, setPreviewStep] = useState(1);
  const [matchTab, setMatchTab] = useState('plan');
  const [replay, setReplay] = useState(null);
  const [message, setMessage] = useState(initialPreferences.error);
  const importRef = useRef(null);
  const sounded = useRef(null);
  const soundEvent = screen === 'replay' ? replay?.event : presentation;

  useEffect(() => {
    let live = true;
    Promise.all([getSavedMatch(), listMatches()]).then(([game, matches]) => { if (live) { setSaved(game); setHistory(matches); } }).catch(error => { if (live) setMessage(error.message); });
    const timer = setInterval(() => controller.chargeClock(), 200);
    const hidden = () => { if (document.hidden) { controller.pause(); setReplay(current => current ? { ...current, playing: false, event: null } : current); } };
    const leaving = () => { controller.pause(); controller.persist(); };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', leaving);
    return () => { live = false; clearInterval(timer); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', leaving); };
  }, [controller]);
  useEffect(() => { controller.setPreferences(preferences); }, [preferences, controller]);
  useEffect(() => {
    if (!soundEvent) { sounded.current = null; return; }
    const identity = `${screen}:${soundEvent.id}`;
    if (identity !== sounded.current) {
      sounded.current = identity;
      if (preferences.sound) {
        const cancelSound = playMoveSound(soundEvent, preferences.volume, preferences.motion, preferences);
        // With motion off, the board settles immediately; let its tiny sound cue finish.
        return preferences.motion === 'off' ? undefined : cancelSound;
      }
    }
  }, [soundEvent, screen, preferences.sound, preferences.volume, preferences.motion, preferences]);
  useEffect(() => {
    if (screen !== 'replay' || modal || !replay?.playing || replay.event) return;
    const timer = setTimeout(() => {
      setReplay(current => {
        if (!current?.playing) return current;
        const index = Math.min(current.index + 1, current.match.events.length);
        const event = current.match.events[index - 1];
        return { ...current, index, event, playing: index < current.match.events.length };
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [replay, screen, modal]);

  async function refreshHistory() { try { const games = await listMatches(); setHistory(games); setSaved(await getSavedMatch()); } catch (error) { setMessage(error.message); } }
  function navigate(next) { window.scrollTo(0, 0); if (next !== 'game') controller.pause(); if (next !== 'replay') setReplay(current => current ? { ...current, playing: false, event: null } : current); setScreen(next); setSelected(null); if (next === 'history') refreshHistory(); }
  function startGame() { setMatchTab('plan'); window.scrollTo(0, 0); unlockAudio(); setSelected(null); setPromotion(null); setFlipped(false); setPreviewStep(1); controller.start(config); setScreen('game'); }
  function continueGame(game = match || saved) { setMatchTab('plan'); window.scrollTo(0, 0); if (!game) return; if (game !== match) controller.load(game); setScreen('game'); setSelected(null); setFlipped(false); }
  function changeConfig(next) { setConfig(next); changePreferences({ matchDefaults: next }); }
  function changePreferences(patch) { const next = { ...preferences, ...patch }; setPreferences(next); try { savePreferences(next); } catch (error) { setMessage(error.message); } }
  function finishReplayEvent(id) { setReplay(current => current?.event?.id === id ? { ...current, event: null } : current); }
  function openModal(name) { if (['settings', 'help', 'resign'].includes(name)) controller.pause(); setReplay(current => current ? { ...current, playing: false, event: null } : current); setModal(name); }
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
  const movement = screen === 'game' ? presentation && !presentation.captured ? presentation : null : screen === 'replay' && replay?.event && !replay.event.captured ? replay.event : null;
  const boardTheme = BOARD_THEMES[preferences.boardTheme] || BOARD_THEMES.green;
  const specialEvent = screen === 'game' ? presentation && !presentation.captured && specialMoveDetails(presentation) ? presentation : null : screen === 'replay' && replay?.event && !replay.event.captured && specialMoveDetails(replay.event) ? replay.event : null;
  const canMove = screen === 'game' && controller.isHumanPlanning() && !preview && !hinting;
  const actingSeat = screen === 'game' && presentation ? presentation.seat : `${livePosition.team}${livePosition.slot + 1}`;
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
  const pieces = Object.fromEntries(['w', 'b'].flatMap(color => Object.keys(PIECE_NAMES).map(type => [`${color}${type.toUpperCase()}`, () => <div className="board-character"><PieceArt type={type} color={color} size="100%" /></div>])));
  function proposeMove(from, to) {
    if (!canMove || !to) return;
    const candidates = legalMoves(livePosition, from).filter(move => move.to === to);
    if (!candidates.length) { setSelected(null); return; }
    setMatchTab('plan');
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
        <div className="board-scene"><Chessboard options={{ id: decorative ? 'welcome-board' : 'squad-board', position: decorative ? initial.fen : shownFen, pieces,
          boardOrientation: decorative ? 'white' : orientation, allowDragging: !decorative && canMove, animationDurationInMs: 0, showNotation: preferences.showCoordinates !== false,
          allowDrawingArrows: false, arrows: [], squareStyles: decorative ? {} : squareStyles,
          darkSquareStyle: { backgroundColor: boardTheme.dark }, lightSquareStyle: { backgroundColor: boardTheme.light },
          darkSquareNotationStyle: { color: boardTheme.light, fontSize: '13px', fontWeight: 700 }, lightSquareNotationStyle: { color: boardTheme.dark, fontSize: '13px', fontWeight: 700 },
          canDragPiece: ({ piece }) => canMove && piece.pieceType[0] === humanColor,
          onPieceDrop: ({ sourceSquare, targetSquare }) => { proposeMove(sourceSquare, targetSquare); return false; },
          onSquareClick: ({ square }) => selectSquare(square),
          squareRenderer: ({ square, children }) => <div style={{ width: '100%', height: '100%', opacity: !decorative && battle && preferences.motion === 'full' && (square === battle.from || square === battle.to || square === battle.captureSquare) || !decorative && movement && preferences.motion === 'full' && (square === movement.from || square === movement.to || movement.castle && [`${movement.castle === 'kingside' ? 'f' : 'd'}${movement.from[1]}`, `${movement.castle === 'kingside' ? 'h' : 'a'}${movement.from[1]}`].includes(square)) ? 0 : 1 }}>{children}</div>,
        }} />
        {!decorative && preview && <PlannerOverlay preview={preview} orientation={orientation} />}
        {!decorative && movement && <MovementOverlay key={`movement:${movement.id}`} event={movement} orientation={orientation} motion={preferences.motion} prefs={preferences} boardShake={preferences.boardShake} onComplete={specialEvent ? undefined : () => screen === 'game' ? controller.finishPresentation(movement.id) : finishReplayEvent(movement.id)} />}
        {!decorative && specialEvent && <SpecialMoveOverlay key={`special:${specialEvent.id}`} event={specialEvent} withMovement orientation={orientation} motion={preferences.motion} prefs={preferences} boardShake={preferences.boardShake} onComplete={() => screen === 'game' ? controller.finishPresentation(specialEvent.id) : finishReplayEvent(specialEvent.id)} />}
        {!decorative && battle && <BattleOverlay key={`battle:${battle.id}`} event={battle} orientation={orientation} motion={preferences.motion} prefs={preferences} boardShake={preferences.boardShake} onComplete={() => screen === 'game' ? controller.finishPresentation(battle.id) : finishReplayEvent(battle.id)} />}
      </div></div>
      {!decorative && preview && <span className="preview-badge"><span /> Combination preview · move {previewStep}</span>}
    </div>;
  }
  function playerCard(seat) {
    const player = getPlayer(seat, humanColor); const active = screen === 'game' && actingSeat === seat && !livePosition.result;
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
  const result = match?.position.result;

  return <div className={`app-shell screen-${screen}`}>
    <aside className="navigation-rail"><button className="brand-mark" onClick={() => navigate('home')} aria-label="SquadChess home"><Icon name="shield" size={28} /><span>Squad<span>Chess</span></span></button><div className="rail-links">
      <button className={['home', 'game'].includes(screen) ? 'active' : ''} aria-label="Play home" onClick={() => navigate('home')}><Icon name="arena" /><span>Play</span></button>
      <button className={['history', 'replay'].includes(screen) ? 'active' : ''} onClick={() => navigate('history')}><Icon name="history" /><span>Match History</span></button>
      <button onClick={() => openModal('help')}><Icon name="guide" /><span>How to Play</span></button>
    </div><button className="rail-settings" onClick={() => openModal('settings')}><Icon name="settings" /><span>Settings</span></button></aside>
    <div className="app-main"><header className="topbar"><button className="wordmark" onClick={() => navigate('home')}>SQUAD<span>CHESS</span><small>STRATEGY IS BETTER TOGETHER</small></button><div className="topbar-right"><span className="local-badge"><span /> LOCAL PLAY</span><button className="icon-button" title="Sound settings" aria-label={preferences.sound ? 'Mute sound' : 'Enable sound'} onClick={() => { unlockAudio(); changePreferences({ sound: !preferences.sound }); }}><Icon name="sound" /><span className={preferences.sound ? 'sr-only' : 'mute-slash'} /></button></div></header>
    {(notice || message) && <div role="status" className="notice">{message || notice}<button className="icon-button" aria-label="Dismiss notice" onClick={() => { setMessage(''); controller.clearNotice(); }}><Icon name="close" size={16} /></button></div>}
    {screen === 'home' && <HomeScreen config={config} onConfig={changeConfig} onStart={startGame} onContinue={() => continueGame()} hasSaved={!!(match || saved)} onGallery={() => setModal('gallery')} renderBoard={renderBoard} />}
    {(screen === 'game' && match || screen === 'replay' && replay) && <main className="arena-screen"><div className="arena-heading"><div><div className="eyebrow">{screen === 'replay' ? 'REPLAY' : 'LOCAL PLAY'} <span className="divider-dot">·</span> {activeMatch.config.timeControl === 'untimed' ? 'UNHURRIED' : activeMatch.config.timeControl}</div><h1>{screen === 'replay' ? 'Match replay' : 'Squad match'}</h1></div><button className="secondary-button compact" onClick={() => navigate('home')}>New match <Icon name="arrow" size={16} /></button></div>
      <div className="arena-grid"><section className="battlefield">{teamRow(humanColor === 'w' ? 'b' : 'w')}{renderBoard()}{teamRow(humanColor)}
        <div className="board-toolbar"><div className="toolbar-actions"><button title="Flip board" aria-label="Flip board" onClick={() => setFlipped(!flipped)}><Icon name="flip" /></button>{screen === 'game' && <><button title={match.phase === 'paused' ? 'Resume game' : 'Pause game'} aria-label={match.phase === 'paused' ? 'Resume game' : 'Pause game'} onClick={() => match.phase === 'paused' ? controller.resume() : controller.pause()} disabled={!!result}><Icon name={match.phase === 'paused' ? 'play' : 'pause'} /></button><button title="Undo your last team turn" aria-label="Undo your last team turn" onClick={controller.undo} disabled={!!result || !match.events.some(e => e.color === humanColor && e.seat.endsWith('1'))}><Icon name="undo" /></button><button title="Resign" aria-label="Resign" onClick={() => openModal('resign')} disabled={!!result}><Icon name="flag" /></button></>}</div><span>{screen === 'replay' ? `Move ${replay.index} of ${replay.match.events.length}` : `${match.events.length} ${match.events.length === 1 ? 'move' : 'moves'} · turn ${livePosition.turnNumber}`}</span><button className="text-button" onClick={() => openModal('help')}>Rules <Icon name="guide" size={15} /></button></div>
        {battle && <div className="capture-status"><Icon name="spark" size={15} /><span>{battleSpec(battle, preferences)?.title}</span><button onClick={() => screen === 'game' ? controller.skipAnimation() : setReplay({ ...replay, event: null })}>Skip</button></div>}
      </section><MatchPanel tab={matchTab} setTab={setMatchTab}
        screen={screen} match={match} activeMatch={activeMatch} replay={replay} setReplay={setReplay}
        preview={preview} previewStep={previewStep} setPreviewStep={setPreviewStep}
        humanColor={humanColor} actingSeat={actingSeat} canMove={canMove} hinting={hinting}
        controller={controller} onClearSelection={() => setSelected(null)} onScreen={setScreen}
        onReturn={() => { const target = match || replay.match; setReplay(null); continueGame(target); }}
        onExportHistory={() => download(exportMoveList(activeMatch), 'squadchess-history.txt', 'text/plain')}
        onExport={() => download(exportMatch(activeMatch), `squadchess-${activeMatch.id.slice(0, 8)}.json`)}
      /></div></main>}
    {screen === 'history' && <main className="history-screen"><div className="arena-heading"><div><div className="eyebrow">YOUR GAMES</div><h1>Match History</h1></div><button className="secondary-button" onClick={() => importRef.current.click()}><Icon name="upload" size={17} /> Import game</button></div><p className="page-description">Your matches stay on this device. Resume an unfinished battle or revisit a memorable combination.</p><div className="history-grid">{history.length ? history.map(game => <article className="history-card" key={game.id}><div className="history-card-top"><span className="history-emblem"><Icon name="shield" size={26} /></span><span className="game-tag">{game.position?.result ? 'COMPLETE' : 'IN PROGRESS'}</span></div><h2>{game.position?.result ? game.position.result.winner === null ? 'An even battlefield' : game.position.result.winner === game.config.humanColor ? 'A shared victory' : 'Lessons from the arena' : 'Your squad awaits'}</h2><p>{new Date(game.updatedAt || game.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {game.events?.length || 0} moves</p><div className="history-meta">{(game.assisted?.hints || game.assisted?.undos) ? <span>Assisted</span> : null}<span>{game.config?.opponentDifficulty} rivals</span><span>{game.config?.timeControl === 'untimed' ? 'Unhurried' : game.config?.timeControl}</span></div><div className="history-actions"><button className="primary-button" onClick={() => openSaved(game.id)}>{game.position?.result ? 'Watch replay' : 'Resume battle'}<Icon name="arrow" size={17} /></button><button className="icon-button" title="Delete saved game" aria-label="Delete saved game" onClick={async () => { if (window.confirm('Delete this saved battle? This cannot be undone.')) { try { await deleteMatch(game.id); await refreshHistory(); } catch (error) { setMessage(error.message); } } }}><Icon name="close" size={16} /></button></div></article>) : <div className="empty-history"><Icon name="history" size={44} /><h2>A story waiting to be written.</h2><p>Your saved battles will appear here.</p><button className="primary-button" onClick={() => navigate('home')}>Start your first match <Icon name="arrow" /></button></div>}</div></main>}
    <footer className="app-footer"><span>SQUADCHESS <i>✧</i> A different kind of strategy.</span><button onClick={() => openModal('help')}>Learn the two-move rules <Icon name="arrow" size={14} /></button></footer>
    </div>
    <input ref={importRef} className="sr-only" type="file" accept=".json,application/json" aria-label="Import SquadChess game" onChange={importFile} />
    {promotion && <Modal title="Choose your promotion" onClose={() => setPromotion(null)}><p className="dialog-copy">Your pawn has earned a new role. It can act again if your team has a move left.</p><div className="promotion-choices">{['q', 'r', 'b', 'n'].map(type => <button key={type} onClick={() => { controller.propose({ ...promotion, promotion: type }); setPromotion(null); setSelected(null); setPreviewStep(1); }}><PieceArt type={type} color={humanColor} size={72} /><span>{PIECE_NAMES[type]}</span></button>)}</div></Modal>}
    {modal === 'gallery' && <Modal className="atelier-modal" onClose={() => setModal(null)}><BattleGallery motion={preferences.motion} prefs={preferences} onClose={() => setModal(null)} /></Modal>}
    {modal === 'settings' && <Modal title="Settings" className="settings-modal" onClose={() => setModal(null)}><SettingsPanel preferences={preferences} onChange={patch => { unlockAudio(); changePreferences(patch); }} onGallery={() => setModal('gallery')} onSetup={() => { setModal(null); navigate('home'); }} onDone={() => setModal(null)} /></Modal>}
    {modal === 'help' && <Modal title="Two minds. Two moves." className="guide-modal" onClose={() => setModal(null)}><p className="guide-lead">You set up the combination. Your teammate completes it.</p><div className="guide-order"><span>You</span><Icon name="arrow" size={16} /><span>Lyra</span><Icon name="arrow" size={16} /><span>Vex</span><Icon name="arrow" size={16} /><span>Mordren</span></div><div className="guide-sections"><section><h3>A shared army</h3><p>Both players control all their team’s pieces. Move two different pieces, or move the same piece twice. White opens with a full pair by default. Balanced opening gives White just one opening move, then normal pairs for both teams. If you choose Black, the rival squad opens.</p></section><section><h3>Plan before you commit</h3><p>Choose your first move, inspect Lyra’s follow-up, and confirm the combination. Her displayed move is the one she will play. Use Change my move to try another idea.</p></section><section className="guide-highlight"><h3>Check changes the rhythm</h3><p>Any move that gives check ends that team’s turn immediately. The other team must escape check on its first move. Every move must keep your own king safe; kings are never captured.</p></section><section><h3>Special moves</h3><p>Castling takes one move. Choose any normal promotion piece; it may move again if your team has a second move. En passant is available only after a two-square pawn move that ends the opposing turn, and only on your first move.</p></section><section><h3>How battles end</h3><p>Checkmate wins. No legal move at the start of a turn is stalemate. No legal second move simply passes the turn. Three repeated team-turn positions, bare kings, or 100 individual moves without a pawn move or capture draw the game. Checkmate takes priority.</p></section><section><h3>Clocks & controls</h3><p>The team clock includes planning and thinking. Animations and pauses are free; switching away pauses the game. Time is added once per completed team turn. Arrow keys move your board focus, Enter selects, and Escape cancels. Undo returns to the start of your last team turn.</p></section><section><h3>A note on the words</h3><p>Check: a king is threatened. Checkmate: it cannot escape. Stalemate: no move is legal but the king is safe. Castling: moving king and rook together. En passant: an immediate special pawn capture. Promotion: a pawn becomes a stronger piece.</p></section></div><button className="primary-button" onClick={() => setModal(null)}>I’m ready <Icon name="arrow" /></button></Modal>}
    {modal === 'resign' && <Modal title="Leave this battle?" onClose={() => setModal(null)}><p className="dialog-copy">Resigning awards the match to the rival squad. The full battle remains in your chronicle to replay.</p><div className="dialog-actions"><button className="secondary-button" onClick={() => { setModal(null); controller.resume(); }}>Keep playing</button><button className="danger-button" onClick={() => { controller.resign(); setModal(null); }}>Resign match</button></div></Modal>}
  </div>;
}
export default App;
