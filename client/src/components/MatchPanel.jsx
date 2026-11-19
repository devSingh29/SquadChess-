import { useLayoutEffect, useRef } from 'react';
import { TabList } from './TabList';
import './usability-controls.css';
import { Icon } from './Icon';
import { PieceArt } from './PieceArt';
import { getPlayer, moveLabel, PIECE_NAMES, RESULT_NAMES } from '../game/viewLabels';
import { unlockAudio } from '../game/audio';
import { isInCheck } from '../game/rules';

function Captures({ events, humanColor }) {
  const captures = events.filter(event => event.captured && event.color === humanColor);
  return <details className="captured-section" open={undefined}>
    <summary>Your squad’s captures <span>{captures.length}</span></summary>
    <div className="captured-pieces">{captures.length ? captures.map(event => <span key={event.id} title={PIECE_NAMES[event.captured]}><PieceArt type={event.captured} color={event.color === 'w' ? 'b' : 'w'} size={33} /></span>) : <p>No captures yet.</p>}</div>
  </details>;
}

function ReplayControls({ replay, setReplay, humanColor, onReturn, returnLabel = 'Return to Match' }) {
  const count = replay.match.events.length;
  const atStart = replay.index === 0;
  const atEnd = replay.index >= count;
  const last = replay.match.events[replay.index - 1];
  const jump = index => setReplay({ ...replay, index, event: null, playing: false });
  return <section className="replay-panel">
    <button className="secondary-button return-match" onClick={onReturn}><Icon name="undo" size={17} />{returnLabel}</button>
    <div className="replay-position"><strong>Move {replay.index}</strong><span>of {replay.match.events.length}</span></div>
    <input aria-label="Replay move" className="replay-range" type="range" disabled={count === 0} min="0" max={replay.match.events.length} value={replay.index} onChange={event => jump(Number(event.target.value))} />
    <div className="replay-controls">
      <button disabled={atStart} aria-label="First move" onClick={() => jump(0)}>|‹</button>
      <button disabled={atStart} aria-label="Previous move" onClick={() => jump(Math.max(0, replay.index - 1))}>‹</button>
      <button disabled={count === 0} className="play-replay" aria-label={replay.playing ? 'Pause replay' : 'Play replay'} onClick={() => { unlockAudio(); setReplay({ ...replay, index: replay.index === replay.match.events.length ? 0 : replay.index, playing: !replay.playing, event: null }); }}><Icon name={replay.playing ? 'pause' : 'play'} size={17} /></button>
      <button disabled={atEnd} aria-label="Next move" onClick={() => setReplay({ ...replay, index: Math.min(replay.match.events.length, replay.index + 1), event: replay.match.events[replay.index] || null, playing: false })}>›</button>
      <button disabled={atEnd} aria-label="Last move" onClick={() => jump(replay.match.events.length)}>›|</button>
    </div>
    <p className="replay-move-label">{last ? `${getPlayer(last.seat, humanColor).name} · ${moveLabel(last)}${last.givesCheck ? ' · Check' : ''}` : `Starting position · White opens with ${replay.match.settings?.balancedOpening ? 'one move' : 'two moves'}`}</p>
  </section>;
}

export function MatchPanel({ tab, setTab, screen, match, activeMatch, replay, setReplay, preview, previewStep, setPreviewStep, humanColor, actingSeat, canMove, hinting, controller, onClearSelection, onScreen, onReturn, returnLabel = 'Return to Match', onExport, onExportHistory }) {
  const panel = useRef(null);
  const actions = useRef(null);
  const isReplay = screen === 'replay';
  const result = match?.position.result;
  const paused = match?.phase === 'paused' || match?.phase === 'error';
  const player = getPlayer(actingSeat, humanColor);
  const displayedEvents = isReplay ? activeMatch.events.slice(0, replay.index) : activeMatch.events;
  const turnEnds = preview?.status === 'ready' && !preview.second;
  const endReason = turnEnds ? preview.afterFirst.result ? preview.afterFirst.result.reason === 'checkmate' ? 'Checkmate ends the match' : 'This move ends the match' : isInCheck(preview.afterFirst) ? 'Check ends our turn' : match.settings?.balancedOpening && match.position.openingPending ? 'Balanced opening: White gets one move' : 'No legal follow-up: our turn ends' : '';
  const showRecord = isReplay || tab === 'moves';
  const confirm = () => { unlockAudio(); controller.confirm(); setPreviewStep(1); setTab('plan'); };
  const hasConfirmation = Boolean(preview || paused);
  const animating = match?.phase === 'animating';
  const friendlyMove = actingSeat?.[0] === humanColor;
  const planTitle = preview ? turnEnds ? 'Your move' : 'Your combination' : hinting ? 'Finding a team plan…' : animating ? player.name === 'You' ? 'Your move is playing.' : `${player.name}’s move is playing.` : canMove ? 'Make the first move.' : `${player.name} is thinking…`;
  const planDescription = preview ? turnEnds ? 'Confirm this move when you’re ready.' : 'Review both promised moves, then play your team turn.' : hinting ? 'Lyra is suggesting a combination for you to review.' : animating ? friendlyMove ? 'Playing your confirmed combination.' : 'The rival squad is playing its move.' : canMove ? 'Choose a piece and a destination.' : friendlyMove ? 'Lyra is choosing your squad’s next move.' : 'Your plan begins after the rival squad finishes.';
  useLayoutEffect(() => {
    if (!hasConfirmation || isReplay) return undefined;
    const arena = panel.current?.closest('.arena-screen');
    const element = actions.current;
    if (!arena || !element) return undefined;
    const measure = () => arena.style.setProperty('--phone-plan-dock-height', `${Math.ceil(element.getBoundingClientRect().height)}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => { observer.disconnect(); arena.style.removeProperty('--phone-plan-dock-height'); };
  }, [hasConfirmation, isReplay]);
  function inspectStep(step) {
    setPreviewStep(step);
    if (window.matchMedia('(max-width: 600px)').matches) panel.current?.closest('.arena-screen')?.querySelector('.board-shell')?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
  function reviewPlan() {
    setTab('plan');
    panel.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
  return <aside ref={panel} className={`command-panel ${preview ? 'has-plan' : ''}`}>
    {!isReplay && <TabList className="match-tabs" label="Match panel" value={tab} onChange={setTab} tabs={[
      { id: 'plan', tabId: 'plan-tab', panelId: 'plan-view', label: 'Plan' },
      { id: 'moves', tabId: 'moves-tab', panelId: 'moves-view', label: <>Moves <span>{activeMatch.events.length}</span></> },
    ]} />}
    {isReplay && <ReplayControls replay={replay} setReplay={setReplay} humanColor={humanColor} onReturn={onReturn} returnLabel={returnLabel} />}
    {!isReplay && <div id="plan-view" role="tabpanel" aria-labelledby="plan-tab" hidden={tab !== 'plan'} className="plan-view">
      <div className="panel-eyebrow"><span className={match.phase === 'thinking' || preview?.status === 'thinking' ? 'pulse-dot' : 'static-dot'} />{result ? 'MATCH COMPLETE' : paused ? match.phase === 'error' ? 'GAME PRESERVED' : 'PAUSED' : hinting ? 'PLANNING WITH LYRA' : animating ? friendlyMove ? 'YOUR SQUAD IS MOVING' : 'RIVAL SQUAD IS MOVING' : canMove || preview ? 'YOUR TEAM’S TURN' : `${player.name.toUpperCase()} IS MOVING`}</div>
      {result ? <div className="result-panel"><div className="result-emblem"><Icon name={result.winner === humanColor ? 'shield' : 'flag'} size={35} /></div><h2>{result.winner === null ? 'An even battlefield.' : result.winner === humanColor ? 'Victory, together.' : 'A battle to learn from.'}</h2><p>{RESULT_NAMES[result.reason] || result.reason}</p></div>
        : paused ? <div className="pause-panel"><Icon name={match.phase === 'error' ? 'shield' : 'pause'} size={28} /><h2>{match.phase === 'error' ? 'Your battle is safe.' : 'Match paused'}</h2><p>{match.error || (match.preview ? 'Your position and clocks stay paused. Resume to review your plan.' : 'Your position and clocks stay paused.')}</p></div>
          : <>
            <div className="team-progress" aria-label="Team move order"><span className={canMove || previewStep === 1 && preview ? 'current' : ''}><b>1</b>You</span><Icon name="arrow" size={16} /><span className={previewStep === 2 && preview ? 'current' : ''}><b>2</b>Lyra</span><small>then rivals ×2</small></div>
            <h2 className="plan-title">{planTitle}</h2>
            <p className="plan-description">{planDescription}</p>
            <div className="plan-steps">
              <button className={`plan-step ${previewStep === 1 && preview ? 'focused' : ''}`} onClick={() => inspectStep(1)} disabled={!preview}><span className="step-number gold">1</span><span><small>YOU</small><strong>{preview ? moveLabel(preview.first) : 'Choose your move'}</strong></span></button>
              <button className={`plan-step ${previewStep === 2 && preview ? 'focused' : ''} ${turnEnds ? 'skipped-step' : ''}`} onClick={() => inspectStep(2)} disabled={!preview?.second}><span className="step-number teal">2</span><span><small>LYRA</small><strong>{preview?.status === 'thinking' ? 'Finding our next move…' : preview?.second ? moveLabel(preview.second) : turnEnds ? 'No follow-up' : 'Plans after your move'}</strong></span></button>
            </div>
            {turnEnds && <p className="turn-end-note" role="status"><Icon name="shield" size={16} />{endReason}</p>}
            <div className="teammate-note"><div className="note-header"><span className="small-avatar"><PieceArt type="b" color={humanColor} size={30} /></span><strong>Lyra</strong><span>YOUR TEAMMATE</span></div><p>{preview?.explanation || (hinting ? 'Finding a combination we can play together…' : '“Let’s make our two moves work together.”')}</p></div>
          </>}
    </div>}
    <div className="moves-view" id="moves-view" role={isReplay ? undefined : 'tabpanel'} aria-labelledby={isReplay ? undefined : 'moves-tab'} hidden={!showRecord}>
      <div className="move-log"><div className="section-heading"><h3>Battle record</h3><button className="icon-button" aria-label="Export readable move history" onClick={onExportHistory}><Icon name="download" size={16} /></button></div><div className="move-log-scroll">{activeMatch.events.length ? activeMatch.events.map((event, index) => <button key={event.id} className={`move-log-row ${isReplay && replay.index === index + 1 ? 'current' : ''}`} onClick={() => { if (!isReplay) controller.pause(); setReplay({ match: activeMatch, index: index + 1, playing: false, event: null, returnTo: isReplay ? replay.returnTo : 'game' }); onScreen('replay'); }}><span>{index + 1}</span><i style={{ background: getPlayer(event.seat, humanColor).accent }} /><span>{getPlayer(event.seat, humanColor).name}</span><strong>{event.san || `${event.from}–${event.to}`}</strong>{event.captured && <Icon name="spark" size={12} />}</button>) : <p className="empty-record">Your moves will appear here.</p>}</div></div>
      <Captures events={displayedEvents} humanColor={humanColor} />
      <button className="text-button export-button" onClick={onExport}><Icon name="download" size={15} />Save a portable copy</button>
    </div>
    {!isReplay && <div ref={actions} className={`match-actions ${preview || paused ? 'has-confirmation' : ''}`}>
      {preview && !paused && <div className="phone-plan-summary" aria-label="Promised team moves">
        <div className="phone-plan-summary-heading"><strong>{preview.status === 'ready' ? turnEnds ? 'One move this turn' : 'Your two-move plan' : 'Planning with Lyra…'}</strong><button type="button" onClick={reviewPlan}>Review full plan <span aria-hidden="true">↓</span></button></div>
        <div className="phone-plan-moves">
          <button type="button" aria-pressed={previewStep === 1} aria-label={`Preview your move: ${moveLabel(preview.first)}`} onClick={() => inspectStep(1)}><span className="phone-plan-number">1</span><span><small>You</small><strong>{moveLabel(preview.first)}</strong></span></button>
          {preview.second ? <button type="button" aria-pressed={previewStep === 2} aria-label={`Preview Lyra’s move: ${moveLabel(preview.second)}`} onClick={() => inspectStep(2)}><span className="phone-plan-number">2</span><span><small>Lyra</small><strong>{moveLabel(preview.second)}</strong></span></button> : <div className="phone-plan-pending"><span className="phone-plan-number">2</span><span><small>Lyra</small><strong>{turnEnds ? 'No follow-up' : 'Finding a move…'}</strong></span></div>}
        </div>
        {turnEnds && <p className="phone-plan-end-reason">{endReason}</p>}
      </div>}
      {result ? <><button className="primary-button" onClick={() => { controller.start(match.config); onClearSelection(); setPreviewStep(1); setTab('plan'); }}>Rematch <Icon name="arrow" /></button><button className="secondary-button" onClick={() => { setReplay({ match, index: 0, playing: false, event: null, returnTo: 'game' }); onScreen('replay'); }}>Watch the replay</button></>
        : paused ? <button className="primary-button" onClick={() => { controller.resume(); setTab('plan'); }}>{match.phase === 'error' ? 'Retry computer player' : 'Return to battle'}<Icon name="play" size={16} /></button>
          : preview ? <><button className="primary-button" disabled={preview.status !== 'ready'} onClick={confirm}>{preview.status === 'ready' ? 'Play team turn' : 'Planning our combination…'}<Icon name="arrow" /></button><button className="text-button change-plan" onClick={() => { controller.cancelPreview(); onClearSelection(); setPreviewStep(1); }}>Change my move</button></>
            : <button className="secondary-button hint-button" onClick={() => { setTab('plan'); setPreviewStep(1); onClearSelection(); controller.hint(); }} disabled={!canMove || hinting}><Icon name="spark" size={17} />{hinting ? 'Looking for a combination…' : 'Ask Lyra for a hint'}</button>}
    </div>}
  </aside>;
}
