import { useId } from 'react';
import { plannerArrow } from '../game/planner';

/** Inspired by Chessground's normalized SVG overlays; independently implemented. */
export function PlannerOverlay({ preview, orientation = 'white' }) {
  const id = useId().replace(/:/g, '');
  if (!preview) return null;
  return <svg className="planner-overlay" viewBox="0 0 8 8" aria-label="Your proposed two-move combination" role="img" data-testid="planner-overlay">
    {[preview.first, preview.second].filter(Boolean).map((move, index) => {
      const arrow = plannerArrow(move, orientation);
      if (!arrow) return null;
      const color = index ? '#54c5c4' : '#ffb52e';
      return <g key={index} data-step={index + 1} data-from={move.from} data-to={move.to}>
        <defs><marker id={`${id}-${index}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="0.33" markerHeight="0.33" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 10 5 0 10 2.5 5Z" fill={color} /></marker></defs>
        <path d={arrow.path} fill="none" stroke="#242522" strokeWidth="0.12" strokeLinecap="round" strokeLinejoin="round" opacity=".23" />
        <path d={arrow.path} fill="none" stroke={color} strokeWidth="0.082" strokeLinecap="round" strokeLinejoin="round" markerEnd={`url(#${id}-${index})`} opacity=".86" />
        <circle cx={arrow.badge.x} cy={arrow.badge.y} r="0.155" fill={color} stroke="#282723" strokeWidth="0.025" />
        <text x={arrow.badge.x} y={arrow.badge.y + 0.006} fill="#242522" textAnchor="middle" dominantBaseline="central" fontSize="0.19" fontWeight="800" fontFamily="system-ui,sans-serif">{index + 1}</text>
      </g>;
    })}
  </svg>;
}
