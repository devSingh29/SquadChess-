import { useEffect, useRef, useState } from 'react';
import { PieceArt } from './PieceArt';
import { MovementOverlay } from './MovementOverlay';
import { BOARD_THEMES } from '../game/themes';
import { movementDetails } from '../game/battles';
import { playMoveSound, unlockAudio } from '../game/audio';

export function SettingsPanel({ preferences, onChange, onGallery, onSetup, onDone }) {
  const [section, setSection] = useState('board');
  const [preview, setPreview] = useState(null);
  const cancelSound = useRef(null);
  useEffect(() => () => cancelSound.current?.(), []);
  const theme = BOARD_THEMES[preferences.boardTheme] || BOARD_THEMES.green;
  function sample() {
    cancelSound.current?.();
    unlockAudio();
    const move = { id: `settings-${Date.now()}`, piece: 'n', color: 'w', seat: 'w1', humanColor: 'w', from: 'c3', to: 'd5' };
    const event = { ...move, ...movementDetails(move, [], 'w', 24) };
    setPreview(event);
    if (preferences.sound) cancelSound.current = playMoveSound(event, preferences.volume, preferences.motion, preferences);
  }
  function chooseSection(id) { cancelSound.current?.(); setPreview(null); setSection(id); }
  return <div className="settings-layout">
    <nav className="settings-navigation" aria-label="Settings sections">
      <div role="tablist" aria-label="Setting categories">{[['board', 'Board & pieces'], ['animation', 'Animations'], ['sound', 'Sound']].map(([id, label]) => <button key={id} role="tab" id={`settings-${id}-tab`} aria-controls={`settings-${id}`} aria-selected={section === id} onClick={() => chooseSection(id)}>{label}</button>)}</div>
      <button onClick={onSetup}>Match setup <span>↗</span></button>
    </nav>
    <div className="settings-content">
      <div className="settings-preview" aria-label="Settings preview">
        <div className="settings-preview-board" style={{ '--preview-dark': theme.dark, '--preview-light': theme.light }}>
          <span className="preview-standing-piece"><PieceArt type={section === 'sound' ? 'b' : 'n'} color="w" size="100%" /></span>
          {preview && <MovementOverlay event={preview} orientation="white" motion={preferences.motion} onComplete={() => setPreview(null)} />}
          {preferences.showCoordinates !== false && <><span className="preview-file">c</span><span className="preview-rank">3</span></>}
        </div>
        <div><strong>{section === 'board' ? 'Your battlefield' : section === 'animation' ? 'Every move has character' : preferences.sound ? 'Sound is on' : 'Sound is off'}</strong><p>{section === 'board' ? 'Original fantasy pieces, familiar squares.' : section === 'animation' ? 'Try a knight’s next move.' : 'Try a short movement sound at your chosen volume.'}</p>{section !== 'board' && <button className="secondary-button compact" onClick={sample}>{section === 'sound' ? 'Test sound' : 'Preview movement'}</button>}</div>
      </div>
      <section id="settings-board" role="tabpanel" aria-labelledby="settings-board-tab" hidden={section !== 'board'} className="settings-section">
        <h3>Board & pieces</h3>
        <fieldset className="setting-field"><legend>Board color</legend><div className="board-theme-options">{Object.entries(BOARD_THEMES).map(([id, board]) => <button key={id} aria-pressed={(preferences.boardTheme || 'green') === id} aria-label={`${board.name} board`} onClick={() => onChange({ boardTheme: id })}><span className="board-swatch" style={{ '--swatch-light': board.light, '--swatch-dark': board.dark }}><PieceArt type="n" color="w" size={45} /></span><span>{board.name}</span></button>)}</div></fieldset>
        <label className="toggle-setting"><span>Show coordinates <small>Letters and numbers around the board</small></span><input type="checkbox" checked={preferences.showCoordinates !== false} onChange={e => onChange({ showCoordinates: e.target.checked })} /></label>
      </section>
      <section id="settings-animation" role="tabpanel" aria-labelledby="settings-animation-tab" hidden={section !== 'animation'} className="settings-section">
        <h3>Animations</h3>
        <fieldset className="setting-field"><legend>Battle animation</legend><div className="segmented">{['full', 'reduced', 'off'].map(mode => <button key={mode} className={preferences.motion === mode ? 'chosen' : ''} aria-pressed={preferences.motion === mode} onClick={() => { setPreview(null); cancelSound.current?.(); onChange({ motion: mode }); }}>{mode}</button>)}</div><p className="field-help">Full: walking pieces and battles. Reduced: gentle highlights. Off: immediate moves.</p></fieldset>
        <label className="toggle-setting"><span>Finishers <small>Rare, dramatic captures lasting 2–3 seconds</small></span><input type="checkbox" checked={preferences.finishers !== false} onChange={e => onChange({ finishers: e.target.checked })} /></label>
        <label className="toggle-setting"><span>Board shake <small>Only during finishers with full motion</small></span><input type="checkbox" checked={preferences.boardShake !== false} onChange={e => onChange({ boardShake: e.target.checked })} /></label>
        <button className="secondary-button gallery-link" onClick={onGallery}>Explore the capture battles</button>
      </section>
      <section id="settings-sound" role="tabpanel" aria-labelledby="settings-sound-tab" hidden={section !== 'sound'} className="settings-section">
        <h3>Sound</h3>
        <label className="toggle-setting"><span>Battle sounds</span><input type="checkbox" checked={preferences.sound} onChange={e => { cancelSound.current?.(); onChange({ sound: e.target.checked }); }} /></label>
        <label className="select-field">Volume<input type="range" min="0" max="1" step="0.05" value={preferences.volume} onChange={e => onChange({ volume: Number(e.target.value) })} /></label>
      </section>
      <p className="field-help settings-saved">Saved automatically on this device. Your match stays paused.</p>
      <button className="primary-button" onClick={onDone}>Done</button>
    </div>
  </div>;
}
