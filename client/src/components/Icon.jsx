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
export function Icon({ name, size = 20, ...props }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={ICON_PATHS[name] || ICON_PATHS.spark} /></svg>; }
