/** Authored movement data. Fractions are normalized by phaseTimings at playback. */
function capture(id, title, anticipation = 0.12, impact = 0.14, durationScale = 1) {
  const impactStart = (1 - impact) * 0.43;
  return Object.freeze({
    id, title, motionName: `battle-${id}`, effect: id, durationScale,
    phases: Object.freeze({ anticipation, attack: impactStart - anticipation, impact, settle: 1 - impactStart - impact }),
  });
}

export const BATTLE_REGISTRY = Object.freeze({
  p: Object.freeze([
    capture('pawn-thrust', 'Sentinel’s thrust', .12, .12, .96),
    capture('pawn-rush', 'Brave advance', .08, .11, .96),
    capture('pawn-strike', 'Steel resolve', .13, .14, 1),
    capture('pawn-underdog', 'Against all odds', .14, .16, 1.04),
  ]),
  n: Object.freeze([
    capture('knight-charge', 'Thunder charge', .08, .14, .98),
    capture('knight-vault', 'Skyward strike', .12, .16, 1.04),
    capture('knight-slash', 'Crescent ride', .1, .12, 1),
    capture('knight-bash', 'Iron impact', .14, .16, 1.02),
  ]),
  b: Object.freeze([
    capture('bishop-blade', 'Astral edge', .1, .12, .97),
    capture('bishop-beam', 'Radiant judgment', .16, .14, 1.02),
    capture('bishop-eruption', 'Runic eruption', .14, .16, 1.04),
    capture('bishop-bind', 'Binding light', .15, .13, 1.02),
  ]),
  r: Object.freeze([
    capture('rook-slam', 'Citadel’s fall', .14, .17, 1.04),
    capture('rook-charge', 'Unstoppable force', .1, .16, 1),
    capture('rook-shock', 'Earthbreaker', .14, .17, 1.04),
    capture('rook-blast', 'Siege fire', .15, .14, 1.01),
  ]),
  q: Object.freeze([
    capture('queen-chains', 'Royal reckoning', .14, .13, 1.01),
    capture('queen-blades', 'Crown of blades', .1, .12, .98),
    capture('queen-orbit', 'Celestial dance', .11, .13, 1.03),
    capture('queen-burst', 'Starfall', .16, .16, 1.04),
  ]),
  k: Object.freeze([
    capture('king-sword', 'The sovereign’s edge', .12, .14, 1),
    capture('king-shield', 'Royal bulwark', .13, .16, 1.02),
    capture('king-command', 'By royal decree', .16, .14, 1.03),
    capture('king-shock', 'Crown’s awakening', .14, .17, 1.04),
  ]),
});

export const REACTION_REGISTRY = Object.freeze({
  p: Object.freeze({ id: 'sentinel-fall', motionName: 'battle-victim-fall', articulation: 'shield-fall', fragments: 'sparks' }),
  n: Object.freeze({ id: 'rider-unseated', motionName: 'battle-victim-fade', articulation: 'unseat', fragments: 'sparks' }),
  b: Object.freeze({ id: 'oracle-dissolve', motionName: 'battle-dissolve', articulation: 'dissolve', fragments: 'embers' }),
  r: Object.freeze({ id: 'bastion-fracture', motionName: 'battle-fracture', articulation: 'fracture', fragments: 'stone' }),
  q: Object.freeze({ id: 'empress-fall', motionName: 'battle-dissolve', articulation: 'crown-fall', fragments: 'embers' }),
});

function movement(id, title, gait, durationScale = 1) {
  return Object.freeze({
    id, title, motionName: `movement-${id}`, gait, effect: gait === 'float' ? 'glimmer' : 'footsteps', durationScale,
    phases: Object.freeze({ anticipation: .08, attack: .74, impact: 0, settle: .18 }),
  });
}

export const MOVEMENT_REGISTRY = Object.freeze({
  p: Object.freeze([movement('pawn-walk', 'Sentinel’s steps', 'walk'), movement('pawn-march', 'Sentinel’s march', 'walk', 1.03)]),
  n: Object.freeze([movement('knight-hop', 'Rider’s leap', 'gallop'), movement('knight-vault', 'Rider’s vault', 'gallop', 1.03)]),
  b: Object.freeze([movement('bishop-glide', 'Oracle’s glide', 'float', .97), movement('bishop-levitate', 'Oracle’s ascent', 'float', 1.02)]),
  r: Object.freeze([movement('rook-stomp', 'Bastion’s advance', 'stomp', 1.04), movement('rook-roll', 'Bastion’s stride', 'stomp')]),
  q: Object.freeze([movement('queen-sweep', 'Empress’s sweep', 'elegant', .98), movement('queen-stride', 'Empress’s stride', 'elegant')]),
  k: Object.freeze([movement('king-walk', 'Sovereign’s steps', 'stately', 1.02), movement('king-march', 'Sovereign’s march', 'stately', 1.04)]),
});

export function resolveAttack(piece, variant) {
  const candidates = BATTLE_REGISTRY[piece] || BATTLE_REGISTRY.p;
  return candidates.find(entry => entry.id === variant) || candidates[0];
}

export function resolveMovement(piece, variant) {
  const candidates = MOVEMENT_REGISTRY[piece] || MOVEMENT_REGISTRY.p;
  return candidates.find(entry => entry.id === variant) || candidates[0];
}

export function phaseTimings(choreography, duration) {
  const values = choreography.phases;
  const total = values.anticipation + values.attack + values.impact + values.settle;
  const anticipation = duration * values.anticipation / total;
  const attack = duration * values.attack / total;
  const impact = duration * values.impact / total;
  const settle = duration - anticipation - attack - impact;
  return { anticipation, attack, impact, settle, attackAt: anticipation, impactAt: anticipation + attack, settleAt: anticipation + attack + impact, motion: duration - impact };
}
