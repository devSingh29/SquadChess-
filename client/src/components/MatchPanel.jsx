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

function ReplayControls({ replay, setReplay, humanColor, onReturn }) {
  const last = replay.match.events[replay.index - 1];
  const jump = index => setReplay({ ...replay, index, event: null, playing: false });
  return <section className="replay-panel">
    <button className="secondary-button return-match" onClick={onReturn}><Icon name="undo" size={17} />Return to Match</button>
    <div className="replay-position"><strong>Move {replay.index}</strong><span>of {replay.match.events.length}</span></div>
    <input aria-label="Replay move" className="replay-range" type="range" min="0" max={replay.match.events.length} value={replay.index} onChange={event => jump(Number(event.target.value))} />
    <div className="replay-controls">
      <button aria-label="First move" onClick={() => jump(0)}>|‹</button>
      <button aria-label="Previous move" onClick={() => jump(Math.max(0, replay.index - 1))}>‹</button>
      <button className="play-replay" aria-label={replay.playing ? 'Pause replay' : 'Play replay'} onClick={() => { unlockAudio(); setReplay({ ...replay, index: replay.index === replay.match.events.length ? 0 : replay.index, playing: !replay.playing, event: null }); }}><Icon name={replay.playing ? 'pause' : 'play'} size={17} /></button>
      <button aria-label="Next move" onClick={() => setReplay({ ...replay, index: Math.min(replay.match.events.length, replay.index + 1), event: replay.match.events[replay.index] || null, playing: false })}>›</button>
      <button aria-label="Last move" onClick={() => jump(replay.match.events.length)}>›|</button>
    </div>
    <p className="replay-move-label">{last ? `${getPlayer(last.seat, humanColor).name} · ${moveLabel(last)}${last.givesCheck ? ' · Check' : ''}` : `Starting position · White opens with ${replay.match.settings?.balancedOpening ? 'one move' : 'two moves'}`}</p>
  </section>;
}

export function MatchPanel({ tab, setTab, screen, match, activeMatch, replay, setReplay, preview, previewStep, setPreviewStep, humanColor, actingSeat, canMove, hinting, controller, onClearSelection, onScreen, onReturn, onExport, onExportHistory }) {
  const isReplay = screen === 'replay';
  const result = match?.position.result;
  const paused = match?.phase === 'paused' || match?.phase === 'error';
  const player = getPlayer(actingSeat, humanColor);
  const displayedEvents = isReplay ? activeMatch.events.slice(0, replay.index) : activeMatch.events;
  const turnEnds = preview?.status === 'ready' && !preview.second;
  const endReason = turnEnds ? isInCheck(preview.afterFirst) ? 'Check ends our turn' : match.settings?.balancedOpening && match.position.openingPending ? 'Balanced opening: White gets one move' : 'No legal follow-up: our turn ends' : '';
  const showRecord = isReplay || tab === 'moves';
  const confirm = () => { unlockAudio(); controller.confirm(); setPreviewStep(1); setTab('plan'); };
  return <aside className={`command-panel ${preview ? 'has-plan' : ''}`}>
    {!isReplay && <div className="match-tabs" role="tablist" aria-label="Match panel">
      <button role="tab" id="plan-tab" aria-controls="plan-view" aria-selected={tab === 'plan'} onClick={() => setTab('plan')}>Plan</button>
      <button role="tab" id="moves-tab" aria-controls="moves-view" aria-selected={tab === 'moves'} onClick={() => setTab('moves')}>Moves <span>{activeMatch.events.length}</span></button>
    </div>}
    {isReplay && <ReplayControls replay={replay} setReplay={setReplay} humanColor={humanColor} onReturn={onReturn} />}
    {!isReplay && <div id="plan-view" role="tabpanel" aria-labelledby="plan-tab" hidden={tab !== 'plan'} className="plan-view">
      <div className="panel-eyebrow"><span className={match.phase === 'thinking' || preview?.status === 'thinking' ? 'pulse-dot' : 'static-dot'} />{result ? 'MATCH COMPLETE' : paused ? match.phase === 'error' ? 'GAME PRESERVED' : 'PAUSED' : canMove || preview ? 'YOUR TEAM’S TURN' : `${player.name.toUpperCase()} IS MOVING`}</div>
      {result ? <div className="result-panel"><div className="result-emblem"><Icon name={result.winner === humanColor ? 'shield' : 'flag'} size={35} /></div><h2>{result.winner === null ? 'An even battlefield.' : result.winner === humanColor ? 'Victory, together.' : 'A battle to learn from.'}</h2><p>{RESULT_NAMES[result.reason] || result.reason}</p></div>
        : paused ? <div className="pause-panel"><Icon name={match.phase === 'error' ? 'shield' : 'pause'} size={28} /><h2>{match.phase === 'error' ? 'Your battle is safe.' : 'Match paused'}</h2><p>{match.error || 'Your position, promised moves, and clocks are saved.'}</p></div>
          : <>
            <div className="team-progress" aria-label="Team move order"><span className={canMove || previewStep === 1 && preview ? 'current' : ''}><b>1</b>You</span><Icon name="arrow" size={16} /><span className={previewStep === 2 && preview ? 'current' : ''}><b>2</b>Lyra</span><small>then rivals ×2</small></div>
            <h2 className="plan-title">{preview ? 'Your combination' : canMove ? 'Make the first move.' : `${player.name} is thinking…`}</h2>
            <p className="plan-description">{preview ? 'Confirm both moves when you’re ready.' : canMove ? 'Choose a piece and a destination.' : 'Your plan begins after the rival squad finishes.'}</p>
            <div className="plan-steps">
              <button className={`plan-step ${previewStep === 1 && preview ? 'focused' : ''}`} onClick={() => setPreviewStep(1)} disabled={!preview}><span className="step-number gold">1</span><span><small>YOU</small><strong>{preview ? moveLabel(preview.first) : 'Choose your move'}</strong></span></button>
              <button className={`plan-step ${previewStep === 2 && preview ? 'focused' : ''} ${turnEnds ? 'skipped-step' : ''}`} onClick={() => setPreviewStep(2)} disabled={!preview?.second}><span className="step-number teal">2</span><span><small>LYRA</small><strong>{preview?.status === 'thinking' ? 'Finding our next move…' : preview?.second ? moveLabel(preview.second) : turnEnds ? 'No follow-up' : 'Plans after your move'}</strong></span></button>
            </div>
            {turnEnds && <p className="turn-end-note" role="status"><Icon name="shield" size={16} />{endReason}</p>}
            <div className="teammate-note"><div className="note-header"><span className="small-avatar"><PieceArt type="b" color={humanColor} size={30} /></span><strong>Lyra</strong><span>YOUR TEAMMATE</span></div><p>{preview?.explanation || (hinting ? 'Finding a combination we can play together…' : '“Let’s make our two moves work together.”')}</p></div>
          </>}
    </div>}
    <div className="moves-view" id="moves-view" role={isReplay ? undefined : 'tabpanel'} aria-labelledby={isReplay ? undefined : 'moves-tab'} hidden={!showRecord}>
      <div className="move-log"><div className="section-heading"><h3>Battle record</h3><button className="icon-button" aria-label="Export readable move history" onClick={onExportHistory}><Icon name="download" size={16} /></button></div><div className="move-log-scroll">{activeMatch.events.length ? activeMatch.events.map((event, index) => <button key={event.id} className={`move-log-row ${isReplay && replay.index === index + 1 ? 'current' : ''}`} onClick={() => { if (!isReplay) controller.pause(); setReplay({ match: activeMatch, index: index + 1, playing: false, event: null }); onScreen('replay'); }}><span>{index + 1}</span><i style={{ background: getPlayer(event.seat, humanColor).accent }} /><span>{getPlayer(event.seat, humanColor).name}</span><strong>{event.san || `${event.from}–${event.to}`}</strong>{event.captured && <Icon name="spark" size={12} />}</button>) : <p className="empty-record">Your moves will appear here.</p>}</div></div>
      <Captures events={displayedEvents} humanColor={humanColor} />
      <button className="text-button export-button" onClick={onExport}><Icon name="download" size={15} />Save a portable copy</button>
    </div>
    {!isReplay && <div className={`match-actions ${preview || paused ? 'has-confirmation' : ''}`}>
      {result ? <><button className="primary-button" onClick={() => { controller.start(match.config); onClearSelection(); setTab('plan'); }}>Rematch <Icon name="arrow" /></button><button className="secondary-button" onClick={() => { setReplay({ match, index: 0, playing: false, event: null }); onScreen('replay'); }}>Watch the replay</button></>
        : paused ? <button className="primary-button" onClick={() => { controller.resume(); setTab('plan'); }}>{match.phase === 'error' ? 'Retry computer player' : 'Return to battle'}<Icon name="play" size={16} /></button>
          : preview ? <><button className="primary-button" disabled={preview.status !== 'ready'} onClick={confirm}>{preview.status === 'ready' ? 'Play team turn' : 'Planning our combination…'}<Icon name="arrow" /></button><button className="text-button change-plan" onClick={() => { controller.cancelPreview(); onClearSelection(); }}>Change my move</button></>
            : <button className="secondary-button hint-button" onClick={() => { setTab('plan'); controller.hint(); }} disabled={!canMove || hinting}><Icon name="spark" size={17} />{hinting ? 'Looking for a combination…' : 'Ask Lyra for a hint'}</button>}
    </div>}
  </aside>;
}
