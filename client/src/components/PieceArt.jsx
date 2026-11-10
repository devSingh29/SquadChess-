import { useId } from 'react';
import { PIECE_NAMES } from '../game/battles.js';

const CHESS_NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

function Gem({ x, y, size = 4, color }) {
  return <path d={`M${x} ${y - size}l${size * 0.7} ${size}l${-size * 0.7} ${size}l${-size * 0.7} ${-size}Z`} fill={color} stroke="none" />;
}

function Pawn({ paint: p }) {
  return <>
    <path className="piece-art__cape" d="M43 61Q31 76 31 117L52 110 79 118Q78 79 69 61Z" fill={p.cloth} />
    <g className="piece-art__body">
      <g className="piece-art__leg piece-art__leg--left" style={{ transformOrigin: '51px 99px' }}><path d="M46 96L41 119 38 124 53 124 58 99" fill={p.dark} /><path d="M42 115L54 117M40 122L52 122" stroke={p.trim} strokeWidth="2" /></g>
      <g className="piece-art__leg piece-art__leg--right" style={{ transformOrigin: '69px 99px' }}><path d="M65 98L66 121 68 125 81 124 77 119 75 95" fill={p.dark} /><path d="M67 115L77 114M69 122L79 122" stroke={p.trim} strokeWidth="2" /></g>
      <path d="M39 69Q55 58 73 67L78 94Q62 104 42 94Z" fill={p.metal} />
      <path d="M47 65L58 82 69 64M45 89L75 89" fill="none" stroke={p.trim} strokeWidth="3" />
      <path d="M48 47L48 65Q59 76 70 63L70 46Z" fill={p.skin} />
      <path d="M40 48Q39 24 58 23Q77 24 78 47L68 52 67 38 50 39 49 53Z" fill={p.metal} />
      <path d="M57 24L58 48M42 45L76 44" stroke={p.trim} fill="none" strokeWidth="3" />
      <path d="M52 49L56 49M63 49L67 49" stroke={p.dark} strokeWidth="2" />
      <path d="M49 59Q59 65 69 58" fill="none" stroke={p.dark} strokeWidth="2" />
      <path className="piece-art__arm piece-art__arm--left" style={{ transformOrigin: '44px 70px' }} d="M43 70L31 76 33 90 46 83" fill={p.metal} />
      <path className="piece-art__arm piece-art__arm--right" style={{ transformOrigin: '73px 70px' }} d="M72 69L85 77 92 70 96 78 84 90 72 84" fill={p.metal} />
      <Gem x={59} y={82} color={p.accent} />
    </g>
    <g className="piece-art__weapon" style={{ transformOrigin: '89px 77px' }}>
      <path d="M91 27L88 120" stroke={p.dark} strokeWidth="6" />
      <path d="M91 27L88 120" stroke={p.trim} strokeWidth="2" />
      <path d="M91 9L99 31 90 41 83 30Z" fill={p.metal} />
      <path d="M91 11L90 38" stroke={p.accent} strokeWidth="2" />
      <path d="M84 46L96 46" stroke={p.trim} strokeWidth="4" />
    </g>
    <g className="piece-art__shield">
      <path d="M28 73L48 68 54 86Q47 103 37 108Q25 98 23 85Z" fill={p.dark} stroke={p.trim} strokeWidth="3" />
      <path d="M30 79L46 75 48 86Q43 96 37 100Q31 94 29 85Z" fill={p.cloth} strokeWidth="1.5" />
      <path d="M37 78L41 88 37 95 34 87Z" fill={p.accent} stroke="none" />
    </g>
  </>;
}

function Knight({ paint: p }) {
  return <>
    <g className="piece-art__rider">
      <path className="piece-art__cape" d="M45 43Q20 55 17 90L43 86 66 68Z" fill={p.cloth} />
      <path d="M41 40L60 40 69 65 47 82 33 67Z" fill={p.metal} />
      <path d="M38 32Q32 12 50 11Q67 12 65 31L54 43 40 40Z" fill={p.metal} />
      <path d="M38 27L63 24 63 32 43 36Z" fill={p.dark} />
      <path d="M45 30L59 28" stroke={p.accent} strokeWidth="2" />
      <path d="M44 12Q46 3 63 8L57 18" fill={p.accent} />
      <path className="piece-art__arm piece-art__arm--right" style={{ transformOrigin: '60px 46px' }} d="M58 45L76 52 87 43" fill="none" stroke={p.trim} strokeWidth="9" />
      <path d="M42 68L57 77 51 100 39 99 42 82 29 74" fill={p.metal} />
    </g>
    <g className="piece-art__mount">
      <path d="M31 113Q20 94 39 81L58 70 63 45 73 51 80 47 96 70 107 77 104 89 86 93 80 88 73 115Z" fill={p.metal} />
      <path d="M63 48Q52 67 53 82L36 88 31 103 40 111 53 104 59 88" fill={p.cloth} />
      <path d="M66 55L74 61 70 75 59 83M79 72L97 81M88 90L78 81 63 86" fill="none" stroke={p.trim} strokeWidth="3" />
      <path d="M69 51L70 35 80 49M82 50L89 43 91 62" fill={p.dark} />
      <path d="M82 66L90 70" stroke={p.accent} strokeWidth="3" />
      <path d="M97 81L100 82" stroke={p.dark} strokeWidth="3" />
      <g className="piece-art__leg piece-art__leg--left" style={{ transformOrigin: '48px 104px' }}><path d="M43 103L34 122 48 122 59 104" fill={p.dark} /><path d="M35 119L48 119" stroke={p.trim} strokeWidth="2" /></g>
      <g className="piece-art__leg piece-art__leg--right" style={{ transformOrigin: '76px 105px' }}><path d="M70 105L69 122 83 122 81 103" fill={p.dark} /><path d="M70 119L82 119" stroke={p.trim} strokeWidth="2" /></g>
      <Gem x={58} y={94} size={6} color={p.accent} />
    </g>
    <g className="piece-art__weapon" style={{ transformOrigin: '86px 45px' }}>
      <path d="M86 55L101 20" stroke={p.trim} strokeWidth="5" />
      <path d="M96 28L105 4 111 30 102 41Z" fill={p.metal} />
      <path d="M105 7L102 36" stroke={p.accent} strokeWidth="2" />
      <path d="M92 42L106 48" stroke={p.trim} strokeWidth="4" />
    </g>
  </>;
}

function Bishop({ paint: p }) {
  return <>
    <path className="piece-art__cape" d="M42 55Q21 77 25 124L59 114 91 124Q94 81 73 55Z" fill={p.cloth} />
    <g className="piece-art__body">
      <g className="piece-art__leg piece-art__leg--left" style={{ transformOrigin: '47px 111px' }}><path d="M42 109L40 122 35 125 50 125 52 111" fill={p.dark} /></g>
      <g className="piece-art__leg piece-art__leg--right" style={{ transformOrigin: '70px 111px' }}><path d="M65 111L67 125 83 125 77 121 76 109" fill={p.dark} /></g>
      <path d="M43 67L75 67 87 120 31 120Z" fill={p.dark} />
      <path d="M48 67L59 88 70 66 76 114 59 124 41 114Z" fill={p.metal} />
      <path d="M59 87L59 119M45 107L73 107" stroke={p.trim} fill="none" strokeWidth="2" />
      <path d="M39 59L36 69 58 80 80 68 76 57Z" fill={p.metal} />
      <path d="M44 46Q42 22 59 8Q80 30 74 52L67 64 49 61Z" fill={p.metal} />
      <path d="M59 10L59 31 67 37" fill="none" stroke={p.accent} strokeWidth="3" />
      <path d="M46 44L71 43 68 57 52 57Z" fill={p.dark} />
      <path d="M52 48L56 49M62 49L66 48" stroke={p.accent} strokeWidth="2" />
      <path className="piece-art__arm piece-art__arm--left" style={{ transformOrigin: '43px 74px' }} d="M43 73L32 86 24 77 18 83 29 99 46 88" fill={p.cloth} />
      <path className="piece-art__arm piece-art__arm--right" style={{ transformOrigin: '74px 74px' }} d="M75 73L84 90 96 84 101 91 82 103 70 87" fill={p.cloth} />
      <Gem x={59} y={75} size={5} color={p.accent} />
    </g>
    <g className="piece-art__weapon" style={{ transformOrigin: '22px 81px' }}>
      <path d="M22 37L22 124" stroke={p.trim} strokeWidth="5" />
      <path d="M22 13Q2 28 15 42L22 47 30 41Q40 27 22 13Z" fill={p.dark} stroke={p.trim} strokeWidth="3" />
      <path d="M22 18L29 30 22 41 15 30Z" fill={p.accent} stroke="none" />
      <path d="M14 52L30 52" stroke={p.trim} strokeWidth="3" />
    </g>
    <path className="piece-art__magic" d="M96 65L98 72 105 74 98 77 96 84 93 77 86 74 93 72Z" fill={p.accent} stroke="none" />
  </>;
}

function Rook({ paint: p }) {
  return <>
    <path className="piece-art__cape" d="M35 53L23 119 89 119 79 52Z" fill={p.cloth} />
    <g className="piece-art__body">
      <g className="piece-art__leg piece-art__leg--left" style={{ transformOrigin: '45px 97px' }}><path d="M38 93L34 120 30 125 51 125 56 99" fill={p.dark} /><path d="M35 115L51 116M32 122L49 122" stroke={p.trim} strokeWidth="2" /></g>
      <g className="piece-art__leg piece-art__leg--right" style={{ transformOrigin: '72px 97px' }}><path d="M65 98L68 125 88 125 83 120 79 91" fill={p.dark} /><path d="M68 115L82 114M70 122L85 122" stroke={p.trim} strokeWidth="2" /></g>
      <path d="M33 57L26 76 39 97 80 97 89 75 78 57Z" fill={p.metal} />
      <path d="M38 63L59 73 78 63 74 89 44 89Z" fill={p.dark} stroke={p.trim} strokeWidth="2" />
      <path d="M45 83L45 72 51 72 51 76 56 76 56 70 62 70 62 76 67 76 67 72 73 72 73 84Z" fill={p.accent} stroke="none" />
      <path d="M39 29L39 16 49 16 49 25 55 25 55 14 65 14 65 25 71 25 71 16 81 16 81 32 77 51 66 60 49 57 40 48Z" fill={p.metal} />
      <path d="M42 33L77 33 75 48 45 48Z" fill={p.dark} />
      <path d="M48 40L55 40M64 40L71 40" stroke={p.accent} strokeWidth="3" />
      <path d="M59 33L59 55" stroke={p.trim} strokeWidth="4" />
      <path className="piece-art__arm piece-art__arm--left" style={{ transformOrigin: '32px 61px' }} d="M30 59L19 59 13 73 20 91 32 90 40 74" fill={p.metal} />
      <path className="piece-art__arm piece-art__arm--right" style={{ transformOrigin: '82px 61px' }} d="M83 58L95 60 100 77 88 92 78 84 80 72" fill={p.metal} />
      <path d="M18 75L34 75M83 76L98 76" stroke={p.trim} strokeWidth="3" />
    </g>
    <g className="piece-art__weapon" style={{ transformOrigin: '92px 85px' }}>
      <path d="M94 52L94 123" stroke={p.dark} strokeWidth="8" />
      <path d="M94 52L94 123" stroke={p.trim} strokeWidth="3" />
      <path d="M78 31L111 31 116 55 111 64 78 64 74 55Z" fill={p.metal} />
      <path d="M83 33L83 62M106 33L106 62" stroke={p.trim} strokeWidth="4" />
      <Gem x={94} y={48} size={7} color={p.accent} />
    </g>
  </>;
}

function Queen({ paint: p }) {
  return <>
    <path className="piece-art__cape" d="M42 51Q15 76 19 123L59 111 101 123Q103 77 74 51Z" fill={p.cloth} />
    <g className="piece-art__body">
      <g className="piece-art__leg piece-art__leg--left" style={{ transformOrigin: '49px 109px' }}><path d="M45 106L42 120 37 125 51 125 55 109" fill={p.dark} /><path d="M40 122L51 122" stroke={p.trim} strokeWidth="2" /></g>
      <g className="piece-art__leg piece-art__leg--right" style={{ transformOrigin: '68px 109px' }}><path d="M63 109L66 125 80 125 74 120 73 106" fill={p.dark} /><path d="M68 122L77 122" stroke={p.trim} strokeWidth="2" /></g>
      <path d="M45 70L72 70 83 114 60 119 36 115Z" fill={p.dark} />
      <path d="M47 79L59 90 71 78 75 111 60 117 43 111Z" fill={p.metal} />
      <path d="M47 58L72 58 76 72 60 89 42 72Z" fill={p.metal} />
      <path d="M47 60L59 72 72 59M59 90L59 119" fill="none" stroke={p.trim} strokeWidth="3" />
      <path d="M44 35Q42 20 59 21Q78 23 75 43L68 57 52 57Z" fill={p.skin} />
      <path d="M43 34Q39 51 42 61L50 51 48 37 59 31 72 40 72 55 79 62Q85 41 73 28Z" fill={p.dark} />
      <path d="M50 43L54 43M64 43L68 43" stroke={p.dark} strokeWidth="2" />
      <path d="M55 51Q59 54 64 50" fill="none" stroke={p.dark} strokeWidth="1.5" />
      <path className="piece-art__arm piece-art__arm--left" style={{ transformOrigin: '44px 65px' }} d="M44 63L31 82 20 72 15 78 31 94 48 80" fill={p.metal} />
      <path className="piece-art__arm piece-art__arm--right" style={{ transformOrigin: '73px 65px' }} d="M74 63L86 79 96 76 99 84 85 92 70 78" fill={p.metal} />
      <Gem x={59} y={74} size={5} color={p.accent} />
      <path d="M47 102L59 107 72 102M45 109L59 114 74 108" fill="none" stroke={p.trim} strokeWidth="2" />
    </g>
    <g className="piece-art__crown">
      <path d="M43 31L37 14 49 23 51 10 59 20 67 8 70 23 83 14 76 33Z" fill={p.gold} />
      <path d="M44 29L75 29" stroke={p.trim} strokeWidth="2" />
      <Gem x={60} y={26} size={4} color={p.accent} />
    </g>
    <g className="piece-art__weapon" style={{ transformOrigin: '97px 79px' }}>
      <path d="M97 48L97 122" stroke={p.trim} strokeWidth="4" />
      <path d="M97 25Q82 31 87 43L97 51 108 43Q113 31 97 25Z" fill={p.dark} stroke={p.trim} strokeWidth="2.5" />
      <circle cx="97" cy="37" r="8" fill={p.accent} stroke="none" />
      <path d="M91 38Q97 30 104 38" fill="none" stroke={p.paper} strokeWidth="2" />
    </g>
    <g className="piece-art__magic" fill={p.accent} stroke="none">
      <path d="M17 53L20 62 29 65 20 68 17 77 14 68 5 65 14 62Z" />
      <circle cx="28" cy="50" r="2" /><circle cx="7" cy="45" r="1.5" />
    </g>
  </>;
}

function King({ paint: p }) {
  return <>
    <path className="piece-art__cape" d="M36 52Q17 84 23 123L59 114 97 123Q99 83 80 51Z" fill={p.cloth} />
    <g className="piece-art__body">
      <g className="piece-art__leg piece-art__leg--left" style={{ transformOrigin: '51px 98px' }}><path d="M44 94L38 121 33 126 54 126 61 98" fill={p.dark} /><path d="M40 115L55 117M36 123L53 123" stroke={p.trim} strokeWidth="2" /></g>
      <g className="piece-art__leg piece-art__leg--right" style={{ transformOrigin: '70px 98px' }}><path d="M64 97L66 126 87 126 82 121 77 92" fill={p.dark} /><path d="M67 116L80 115M69 123L85 123" stroke={p.trim} strokeWidth="2" /></g>
      <path d="M36 60L45 91 42 108 60 114 79 108 76 90 84 61 70 54 48 54Z" fill={p.metal} />
      <path d="M43 64L59 81 78 63M44 94L77 94" fill="none" stroke={p.trim} strokeWidth="3" />
      <path d="M44 34L46 50 52 61 68 61 76 48 75 32Z" fill={p.skin} />
      <path d="M47 47L53 49 59 46 67 49 73 45 70 61 60 69 50 60Z" fill={p.dark} />
      <path d="M50 41L55 41M65 41L70 41" stroke={p.dark} strokeWidth="2.5" />
      <path className="piece-art__arm piece-art__arm--left" style={{ transformOrigin: '38px 61px' }} d="M37 58L25 64 23 83 38 92 47 79" fill={p.metal} />
      <path className="piece-art__arm piece-art__arm--right" style={{ transformOrigin: '81px 61px' }} d="M82 59L95 64 97 87 83 91 76 77" fill={p.metal} />
      <Gem x={60} y={83} size={6} color={p.accent} />
      <path d="M44 99L60 104 76 99" fill="none" stroke={p.trim} strokeWidth="2" />
    </g>
    <g className="piece-art__crown">
      <path d="M44 32L38 15 49 21 59 12 70 21 81 15 76 32Z" fill={p.gold} />
      <path d="M60 3L60 18M55 8L65 8" stroke={p.trim} strokeWidth="4" />
      <path d="M45 28L75 28" stroke={p.trim} strokeWidth="2" />
      <Gem x={60} y={25} size={4} color={p.accent} />
    </g>
    <g className="piece-art__weapon" style={{ transformOrigin: '94px 87px' }}>
      <path d="M94 73L94 113" stroke={p.dark} strokeWidth="6" />
      <path d="M94 19L103 38 100 76 88 76 85 38Z" fill={p.metal} />
      <path d="M94 22L94 76" stroke={p.accent} strokeWidth="2" />
      <path d="M83 79Q94 84 106 79" fill="none" stroke={p.trim} strokeWidth="5" />
      <circle cx="94" cy="111" r="4" fill={p.trim} />
    </g>
    <g className="piece-art__shield">
      <path d="M19 76L36 69 51 77 48 102 35 116 20 102Z" fill={p.dark} stroke={p.trim} strokeWidth="3" />
      <path d="M25 81L35 77 45 82 42 99 35 107 27 98Z" fill={p.cloth} />
      <path d="M35 84L35 100M29 90L41 90" stroke={p.accent} strokeWidth="3" />
    </g>
  </>;
}

const ROLES = { p: Pawn, n: Knight, b: Bishop, r: Rook, q: Queen, k: King };

/** Original, articulated vector characters; the same art is used on-board and in battles. */
export function PieceArt({ type = 'p', color = 'w', size = 64, className = '', accent }) {
  const unique = useId().replace(/:/g, '');
  const role = ROLES[type] ? type : 'p';
  const Character = ROLES[role];
  const light = color === 'w';
  const trim = light ? '#b98841' : '#a393c8';
  const highlight = light ? '#fff8df' : '#b6add0';
  const ink = light ? '#3c302b' : '#171825';
  const paint = {
    metal: `url(#${unique}-metal)`, cloth: `url(#${unique}-cloth)`, gold: `url(#${unique}-gold)`,
    dark: light ? '#4e5f68' : '#292b43', skin: light ? '#e4be91' : '#ba9aa8',
    accent: accent || (light ? '#f2ca7b' : '#c5a7fa'), trim,
    paper: light ? '#fff6df' : '#ede4ff',
  };
  return <svg
    xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 144"
    width={size} height={size} className={`piece-art piece-art--${role} ${className}`}
    role="img" aria-label={`${light ? 'Ivory' : 'Obsidian'} ${CHESS_NAMES[role]}, ${PIECE_NAMES[role]}`}
    style={{ overflow: 'visible' }}
  >
    <defs>
      <linearGradient id={`${unique}-metal`} x1="0" y1="0" x2="1" y2="0.9">
        <stop offset="0" stopColor={highlight} /><stop offset="0.38" stopColor={light ? '#e4d5b1' : '#686881'} />
        <stop offset="0.65" stopColor={light ? '#fff2ce' : '#88859f'} /><stop offset="1" stopColor={light ? '#b5aa92' : '#3e425d'} />
      </linearGradient>
      <linearGradient id={`${unique}-cloth`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={light ? '#536f79' : '#675072'} /><stop offset="1" stopColor={light ? '#233c49' : '#2a233c'} />
      </linearGradient>
      <linearGradient id={`${unique}-gold`} x1="0" y1="0" x2="0.9" y2="1">
        <stop offset="0" stopColor={light ? '#fff0b1' : '#ded0fa'} /><stop offset="1" stopColor={trim} />
      </linearGradient>
    </defs>
    <ellipse cx="60" cy="132" rx="41" ry="7" fill="#070b12" opacity="0.3" />
    <g className="piece-art__figure" stroke={ink} strokeWidth="2.3" strokeLinejoin="round" strokeLinecap="round">
      <Character paint={paint} />
    </g>
    <g className="piece-art__base" stroke={ink} strokeWidth="2">
      <path d="M28 121L91 121 98 130Q60 142 21 130Z" fill={paint.dark} />
      <ellipse cx="59.5" cy="122" rx="32" ry="5" fill={paint.metal} />
      <path d="M27 130Q60 138 92 130" fill="none" stroke={trim} strokeWidth="2" />
      <Gem x={60} y={131} size={3.5} color={paint.accent} />
    </g>
  </svg>;
}

export default PieceArt;
