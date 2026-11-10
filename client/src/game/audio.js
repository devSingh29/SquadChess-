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
  let disconnected = false;
  const disconnect = () => { if (disconnected) return; disconnected = true; oscillator.disconnect(); envelope.disconnect(); };
  oscillator.onended = disconnect;
  return () => { try { oscillator.stop(); } catch { /* The source may already have ended. */ } disconnect(); };
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
  let disconnected = false;
  const disconnect = () => { if (disconnected) return; disconnected = true; source.disconnect(); filter.disconnect(); envelope.disconnect(); };
  source.onended = disconnect;
  return () => { try { source.stop(); } catch { /* The source may already have ended. */ } disconnect(); };
}

/** Does not unlock audio itself: call unlockAudio from a player gesture. */
export function playMoveSound(event, volume = 0.5, motion = 'full') {
  if (!context || context.state !== 'running') return;
  const gain = Math.max(0, Math.min(1, Number(volume) || 0));
  if (!gain) return;
  const sources = [];
  const note = (...args) => sources.push(tone(...args));
  const noise = (...args) => sources.push(rush(...args));
  const start = context.currentTime + (motion === 'off' ? 0 : .008);
  if (motion === 'off') {
    note(event?.captured ? 210 : 320, event?.captured ? 90 : 180, start, .055, gain * .1, 'triangle');
    if (event?.promotion) note(880, 660, start, .04, gain * .035);
    return () => sources.splice(0).forEach(cancel => cancel());
  }
  if (!event?.captured) {
    note(320, 180, start, 0.075, gain * 0.11, 'triangle');
    note(780, 500, start + 0.015, 0.055, gain * 0.025);
  } else {
    const seed = event.seed ?? 1;
    const random = randomFromSeed(seed);
    const battle = battleSpec(event);
    const impactDelay = motion === 'off' ? 0 : motion === 'reduced' ? .045 : battle ? phaseTimings(battle.choreography, battle.duration).impactAt / 1000 : .4;
    const impact = start + Math.min(0.65, impactDelay);
    const magical = ['b', 'q'].includes(event.piece);
    if (motion === 'full') noise(start + 0.04, Math.max(0.12, impact - start - 0.04), gain * 0.075, seed);
    note(magical ? 360 : 145, magical ? 680 : 48, impact, motion === 'full' ? .25 : .11, gain * 0.14, magical ? 'sine' : 'triangle');
    note(940 + random() * 400, 310, impact + 0.015, motion === 'full' ? .19 : .09, gain * 0.035, 'triangle');
    if (magical || event.combo || event.underdog) {
      [1, 1.25, 1.5].forEach((ratio, index) =>
        note(440 * ratio, 440 * ratio, impact + index * (motion === 'full' ? .045 : .015), motion === 'full' ? .3 : .09, gain * 0.035));
    }
  }
  if (event?.promotion) {
    const promotionAt = motion === 'off' ? 0 : motion === 'reduced' ? .04 : (event.duration || (event.captured ? 1250 : 900)) * .00066;
    [523, 659, 784].forEach((frequency, index) => note(frequency, frequency, start + promotionAt + index * .04, .16, gain * 0.045));
  }
  return () => sources.splice(0).forEach(cancel => cancel());
}
