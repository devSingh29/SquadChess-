import { useRef } from 'react';
import { PieceArt } from './PieceArt';

import { BOARD_THEMES } from '../game/themes';


export function SettingsPanel({ preferences, onChange, onGallery, onSetup, onDone }) {
  const board = useRef(null);
  const animation = useRef(null);
  const sound = useRef(null);
  return <div className="settings-layout">
    <nav className="settings-navigation" aria-label="Settings sections">
      <button onClick={() => board.current?.scrollIntoView({ block: 'nearest' })}>Board & pieces</button>
      <button onClick={() => animation.current?.scrollIntoView({ block: 'nearest' })}>Animations</button>
      <button onClick={() => sound.current?.scrollIntoView({ block: 'nearest' })}>Sound</button>
      <button onClick={onSetup}>Match setup <span>↗</span></button>
    </nav>
    <div className="settings-content">
      <section ref={board} className="settings-section">
        <h3>Board & pieces</h3>
        <p className="field-help">A familiar board with your fantasy army.</p>
        <fieldset className="setting-field"><legend>Board color</legend><div className="board-theme-options">
          {Object.entries(BOARD_THEMES).map(([id, theme]) => <button key={id} aria-pressed={(preferences.boardTheme || 'green') === id} aria-label={`${theme.name} board`} onClick={() => onChange({ boardTheme: id })}>
            <span className="board-swatch" style={{ '--swatch-light': theme.light, '--swatch-dark': theme.dark }}><PieceArt type="n" color="w" size={45} /></span><span>{theme.name}</span>
          </button>)}
        </div></fieldset>
        <label className="toggle-setting"><span>Show coordinates <small>Letters and numbers around the board</small></span><input type="checkbox" checked={preferences.showCoordinates !== false} onChange={e => onChange({ showCoordinates: e.target.checked })} /></label>
      </section>
      <section ref={animation} className="settings-section">
        <h3>Animations</h3>
        <fieldset className="setting-field"><legend>Battle animation</legend><div className="segmented">{['full', 'reduced', 'off'].map(mode => <button key={mode} className={preferences.motion === mode ? 'chosen' : ''} aria-pressed={preferences.motion === mode} onClick={() => onChange({ motion: mode })}>{mode}</button>)}</div><p className="field-help">Full: walking pieces and capture battles. Reduced: gentle highlights. Off: immediate moves.</p></fieldset>
        <button className="secondary-button" onClick={onGallery}>Explore the capture battles</button>
      </section>
      <section ref={sound} className="settings-section">
        <h3>Sound</h3>
        <label className="toggle-setting"><span>Battle sounds</span><input type="checkbox" checked={preferences.sound} onChange={e => onChange({ sound: e.target.checked })} /></label>
        <label className="select-field">Volume<input type="range" min="0" max="1" step="0.05" value={preferences.volume} onChange={e => onChange({ volume: Number(e.target.value) })} /></label>
      </section>
      <p className="field-help settings-saved">Changes save automatically on this device. Your match stays paused while you adjust settings.</p>
      <button className="primary-button" onClick={onDone}>Done</button>
    </div>
  </div>;
}
