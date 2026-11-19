import { useEffect, useRef, useState } from 'react';
import './usability-controls.css';

/** Automatic activation keeps a single Tab stop while arrows move within the group. */
export function TabList({ label, tabs, value, onChange, className = '', orientation = 'horizontal' }) {
  const buttons = useRef([]);
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches);
  useEffect(() => {
    if (orientation !== 'responsive') return undefined;
    const query = window.matchMedia('(max-width: 600px)');
    const update = () => setPhone(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [orientation]);
  const direction = orientation === 'responsive' ? phone ? 'horizontal' : 'vertical' : orientation;
  function moveFocus(event, index) {
    let next;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (index + 1) % tabs.length;
    else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (index - 1 + tabs.length) % tabs.length;
    else return;
    event.preventDefault();
    onChange(tabs[next].id);
    buttons.current[next]?.focus();
  }
  return <div role="tablist" aria-label={label} aria-orientation={direction} className={className}>
    {tabs.map((tab, index) => <button key={tab.id} ref={element => { buttons.current[index] = element; }} type="button"
      role="tab" id={tab.tabId} aria-controls={tab.panelId} aria-selected={value === tab.id} tabIndex={value === tab.id ? 0 : -1}
      onClick={() => onChange(tab.id)} onKeyDown={event => moveFocus(event, index)}>{tab.label}</button>)}
  </div>;
}
