import test from 'node:test';
import assert from 'node:assert/strict';
import { playMoveSound, unlockAudio } from './audio.js';

test('skipping sound cancels every scheduled source and shorter motion uses earlier contact', async () => {
  const previousWindow = globalThis.window;
  const created = [];
  const parameter = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  const node = () => ({ connect(target) { return target; }, disconnect() { this.disconnected = true; } });
  const source = kind => {
    const value = { ...node(), kind, frequency: parameter(), starts: [], stops: [], start(time) { this.starts.push(time); }, stop(time) { this.stops.push(time); } };
    created.push(value);
    return value;
  };
  class AudioContext {
    constructor() { this.state = 'running'; this.currentTime = 10; this.sampleRate = 8000; this.destination = {}; }
    createOscillator() { return source('oscillator'); }
    createGain() { return { ...node(), gain: parameter() }; }
    createBuffer(_channels, size) { return { getChannelData: () => new Float32Array(size) }; }
    createBufferSource() { return source('noise'); }
    createBiquadFilter() { return { ...node(), frequency: parameter(), Q: { value: 0 } }; }
  }
  globalThis.window = { AudioContext };
  try {
    assert.equal(await unlockAudio(), true);
    const event = { id: 'audio-capture', from: 'e4', to: 'd5', piece: 'p', captured: 'p', color: 'w', seat: 'w1', seed: 7, duration: 1000 };
    const cancel = playMoveSound(event, .4);
    assert.equal(typeof cancel, 'function');
    assert.ok(created.find(value => value.kind === 'oscillator').starts[0] > 10.25);
    cancel();
    for (const value of created) {
      assert.equal(value.stops.at(-1), undefined, 'Cancel should stop immediately, including future notes');
      assert.equal(value.disconnected, true);
    }
    const stopCounts = created.map(value => value.stops.length);
    cancel();
    assert.deepEqual(created.map(value => value.stops.length), stopCounts);
    created.length = 0;
    const cancelReduced = playMoveSound(event, .4, 'reduced');
    assert.ok(created.find(value => value.kind === 'oscillator').starts[0] < 10.1);
    assert.equal(created.some(value => value.kind === 'noise'), false);
    cancelReduced();
    created.length = 0;
    const cancelOff = playMoveSound(event, .4, 'off');
    assert.ok(created.find(value => value.kind === 'oscillator').starts[0] < 10.02);
    assert.ok(created.every(value => value.stops[0] <= 10.08), 'Off-motion cues should end naturally without a delayed tail');
    cancelOff();
    created.length = 0;
    assert.equal(playMoveSound(event, 0), undefined);
    assert.equal(created.length, 0);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
