import { battleSpec, phaseTimings, randomFromSeed } from './battles.js';

let context;

export async function unlockAudio() {
  if (typeof window === 'undefined') return false;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return false;
  try {
    context ||= new AudioContext();
    if (context.state === 'suspended') await context.resume();
    return context.state === 'running';
  } catch {
    return false;
  }
}

function tone(frequency, endFrequency, start, duration, volume, type = 'sine') {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
  oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
}

function rush(start, duration, volume, seed) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const channel = buffer.getChannelData(0);
  const random = randomFromSeed(seed);
  for (let i = 0; i < channel.length; i += 1) channel[i] = random() * 2 - 1;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const envelope = context.createGain();
  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1300, start);
  filter.frequency.exponentialRampToValueAtTime(220, start + duration);
  filter.Q.value = 0.7;
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.linearRampToValueAtTime(volume, start + duration * 0.22);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(envelope).connect(context.destination);
  source.start(start);
  source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
}

/** Does not unlock audio itself: call unlockAudio from a player gesture. */
export function playMoveSound(event, volume = 0.5) {
  if (!context || context.state !== 'running') return;
  const gain = Math.max(0, Math.min(1, Number(volume) || 0));
  if (!gain) return;
  const start = context.currentTime + 0.008;
  if (!event?.captured) {
    tone(320, 180, start, 0.075, gain * 0.11, 'triangle');
    tone(780, 500, start + 0.015, 0.055, gain * 0.025);
  } else {
    const seed = event.seed ?? 1;
    const random = randomFromSeed(seed);
    const battle = battleSpec(event);
    const impactDelay = battle ? phaseTimings(battle.choreography, battle.duration).impactAt / 1000 : .4;
    const impact = start + Math.min(0.65, impactDelay);
    const magical = ['b', 'q'].includes(event.piece);
    rush(start + 0.06, Math.max(0.12, impact - start), gain * 0.075, seed);
    tone(magical ? 360 : 145, magical ? 680 : 48, impact, 0.25, gain * 0.14, magical ? 'sine' : 'triangle');
    tone(940 + random() * 400, 310, impact + 0.015, 0.19, gain * 0.035, 'triangle');
    if (magical || event.combo || event.underdog) {
      [1, 1.25, 1.5].forEach((ratio, index) =>
        tone(440 * ratio, 440 * ratio, impact + index * 0.045, 0.3, gain * 0.035));
    }
  }
  if (event?.promotion) {
    [523, 659, 784].forEach((frequency, index) => tone(frequency, frequency, start + 0.1 + index * 0.07, 0.25, gain * 0.045));
  }
}
