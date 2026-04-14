// ── Audio Manager ─────────────────────────────────────────────────────────────
// All sounds are synthesized via Web Audio API — no audio files required.
// The AudioContext is created lazily on the first user interaction to satisfy
// browser autoplay policies.

export class AudioManager {
  constructor() {
    this._ctx        = null;
    this._master     = null;   // GainNode for master volume
    this._volume     = 0.4;    // 0–1
    this._laserNode  = null;   // persistent laser drone (started/stopped)
    this._bossNode   = null;   // persistent boss arrival pulse (stopped after 1s)
  }

  // ── Bootstrap ───────────────────────────────────────────────────────────────

  // Call once on first user gesture (click / keypress).
  // Safe to call multiple times.
  init() {
    if (!this._ctx) {
      this._ctx    = new (window.AudioContext || window.webkitAudioContext)();
      this._master = this._ctx.createGain();
      this._master.gain.value = this._volume;
      this._master.connect(this._ctx.destination);
    }
    // Resume if the browser suspended the context (common after page reload)
    if (this._ctx.state === 'suspended') this._ctx.resume();
  }

  setVolume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this._master) this._master.gain.value = this._volume;
    if (this._ctx && this._ctx.state === 'suspended') this._ctx.resume();
  }

  get volume() { return this._volume; }

  // ── Low-level helpers ────────────────────────────────────────────────────────

  _ac() { return this._ctx; }

  // Create an OscillatorNode + GainNode pair, connect to master, return {osc, gain}.
  _osc(type, freq) {
    const ac   = this._ac();
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.type      = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(this._master);
    return { osc, gain };
  }

  // Create a BufferSourceNode filled with white noise, connect to master.
  _noise(duration) {
    const ac      = this._ac();
    const samples = Math.ceil(ac.sampleRate * duration);
    const buf     = ac.createBuffer(1, samples, ac.sampleRate);
    const data    = buf.getChannelData(0);
    for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const gain = ac.createGain();
    src.connect(gain);
    gain.connect(this._master);
    return { src, gain };
  }

  // Schedule a gain envelope: attack to peak, then exponential decay to silence.
  _env(gainNode, peak, attackTime, decayTime, now) {
    const g = gainNode.gain;
    g.setValueAtTime(0, now);
    g.linearRampToValueAtTime(peak, now + attackTime);
    g.exponentialRampToValueAtTime(0.0001, now + attackTime + decayTime);
  }

  // ── Fire sounds ──────────────────────────────────────────────────────────────

  // Single / multi-shot: a short percussive blip.
  // pitchMult lets multi-shot fire slightly higher.
  fireSingle(pitchMult = 1) {
    if (!this._ctx) return;
    const ac  = this._ac();
    const now = ac.currentTime;
    const { osc, gain } = this._osc('square', 420 * pitchMult);
    osc.frequency.exponentialRampToValueAtTime(180 * pitchMult, now + 0.05);
    this._env(gain, 0.12, 0.002, 0.07, now);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  fireMulti() { this.fireSingle(1.25); }

  // Spread shot: a short noise whoosh.
  fireSpread() {
    if (!this._ctx) return;
    const ac  = this._ac();
    const now = ac.currentTime;
    const { src, gain } = this._noise(0.12);
    // High-pass the noise for a crisp 'shhhk'
    const hpf = ac.createBiquadFilter();
    hpf.type            = 'highpass';
    hpf.frequency.value = 2200;
    src.disconnect();
    src.connect(hpf);
    hpf.connect(gain);
    this._env(gain, 0.18, 0.003, 0.10, now);
    src.start(now);
  }

  // Explosive impact: low thud + noise crunch.
  fireExplosive() {
    if (!this._ctx) return;
    const ac  = this._ac();
    const now = ac.currentTime;

    // Thud — low sine
    const { osc: o1, gain: g1 } = this._osc('sine', 80);
    o1.frequency.exponentialRampToValueAtTime(25, now + 0.18);
    this._env(g1, 0.5, 0.002, 0.22, now);
    o1.start(now); o1.stop(now + 0.25);

    // Crunch — filtered noise
    const { src, gain: gn } = this._noise(0.18);
    const bpf = ac.createBiquadFilter();
    bpf.type            = 'bandpass';
    bpf.frequency.value = 600;
    bpf.Q.value         = 0.8;
    src.disconnect();
    src.connect(bpf);
    bpf.connect(gn);
    this._env(gn, 0.3, 0.001, 0.15, now);
    src.start(now);
  }

  // Chain lightning: sharp electrical crackle.
  fireChain() {
    if (!this._ctx) return;
    const ac  = this._ac();
    const now = ac.currentTime;

    // Quick noise burst — high-passed
    const { src, gain } = this._noise(0.08);
    const hpf = ac.createBiquadFilter();
    hpf.type            = 'highpass';
    hpf.frequency.value = 3500;
    src.disconnect();
    src.connect(hpf);
    hpf.connect(gain);
    this._env(gain, 0.22, 0.001, 0.06, now);
    src.start(now);

    // Add a brief high-freq square blip for 'zap' feel
    const { osc, gain: go } = this._osc('square', 1200);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.06);
    this._env(go, 0.08, 0.001, 0.05, now);
    osc.start(now); osc.stop(now + 0.08);
  }

  // ── Laser sounds ─────────────────────────────────────────────────────────────

  // Called when laser burst starts — drones a rising tone.
  laserStart(tier = 1) {
    if (!this._ctx) return;
    this.laserStop(); // clean up any previous
    const ac   = this._ac();
    const now  = ac.currentTime;
    const freq = 600 + tier * 120;

    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * 0.5, now);
    osc.frequency.linearRampToValueAtTime(freq, now + 0.3);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.08);
    osc.connect(gain);
    gain.connect(this._master);
    osc.start(now);
    this._laserOsc  = osc;
    this._laserGain = gain;
  }

  // Called when laser burst ends.
  laserStop() {
    if (!this._laserOsc) return;
    const ac  = this._ac();
    const now = ac.currentTime;
    this._laserGain.gain.setValueAtTime(this._laserGain.gain.value, now);
    this._laserGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    this._laserOsc.stop(now + 0.15);
    this._laserOsc  = null;
    this._laserGain = null;
  }

  // ── Death sounds ─────────────────────────────────────────────────────────────

  // Small (Drone / Swarm): tiny high pop.
  deathSmall() {
    if (!this._ctx) return;
    const ac  = this._ac();
    const now = ac.currentTime;
    const { osc, gain } = this._osc('sine', 900);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.06);
    this._env(gain, 0.09, 0.001, 0.06, now);
    osc.start(now); osc.stop(now + 0.08);
  }

  // Medium (Elite): mid crack.
  deathMedium() {
    if (!this._ctx) return;
    const ac  = this._ac();
    const now = ac.currentTime;

    const { osc, gain } = this._osc('sawtooth', 320);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
    this._env(gain, 0.15, 0.001, 0.09, now);
    osc.start(now); osc.stop(now + 0.12);
  }

  // Large (Brute): low boom.
  deathLarge() {
    if (!this._ctx) return;
    const ac  = this._ac();
    const now = ac.currentTime;

    const { osc, gain } = this._osc('sine', 120);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.25);
    this._env(gain, 0.4, 0.003, 0.25, now);
    osc.start(now); osc.stop(now + 0.30);

    // Layer noise thud
    const { src, gain: gn } = this._noise(0.15);
    const lpf = ac.createBiquadFilter();
    lpf.type            = 'lowpass';
    lpf.frequency.value = 350;
    src.disconnect();
    src.connect(lpf);
    lpf.connect(gn);
    this._env(gn, 0.2, 0.001, 0.12, now);
    src.start(now);
  }

  // Boss death: deep cinematic boom (deathLarge × 2 + long reverb tail).
  deathBoss() {
    if (!this._ctx) return;
    this.deathLarge();
    const ac  = this._ac();
    const now = ac.currentTime;
    // Extra sub rumble
    const { osc, gain } = this._osc('sine', 55);
    osc.frequency.exponentialRampToValueAtTime(18, now + 0.6);
    this._env(gain, 0.55, 0.005, 0.55, now);
    osc.start(now); osc.stop(now + 0.65);
  }

  // ── Tower hit ────────────────────────────────────────────────────────────────

  towerHit() {
    if (!this._ctx) return;
    const ac  = this._ac();
    const now = ac.currentTime;

    // Low distorted thud
    const { osc, gain } = this._osc('sawtooth', 150);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
    this._env(gain, 0.35, 0.001, 0.12, now);
    osc.start(now); osc.stop(now + 0.15);

    // Short noise buzz
    const { src, gain: gn } = this._noise(0.08);
    const bpf = ac.createBiquadFilter();
    bpf.type            = 'bandpass';
    bpf.frequency.value = 800;
    bpf.Q.value         = 1.5;
    src.disconnect();
    src.connect(bpf);
    bpf.connect(gn);
    this._env(gn, 0.18, 0.001, 0.07, now);
    src.start(now);
  }

  // ── Wave complete ────────────────────────────────────────────────────────────

  // Ascending 3-note chime: root → major third → perfect fifth.
  waveComplete() {
    if (!this._ctx) return;
    const ac    = this._ac();
    const now   = ac.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const t = now + i * 0.13;
      const { osc, gain } = this._osc('sine', freq);
      // Layer a triangle for warmth
      const { osc: osc2, gain: gain2 } = this._osc('triangle', freq * 2);
      this._env(gain,  0.18, 0.005, 0.25, t);
      this._env(gain2, 0.06, 0.005, 0.20, t);
      osc.start(t);  osc.stop(t + 0.35);
      osc2.start(t); osc2.stop(t + 0.30);
    });
  }

  // ── Defeated ─────────────────────────────────────────────────────────────────

  // Descending minor sting: root → minor third → tritone.
  defeated() {
    if (!this._ctx) return;
    const ac    = this._ac();
    const now   = ac.currentTime;
    const notes = [440, 349.23, 293.66]; // A4, F4, D4  (descending minor feel)
    notes.forEach((freq, i) => {
      const t = now + i * 0.18;
      const { osc, gain } = this._osc('sawtooth', freq);
      this._env(gain, 0.20, 0.01, 0.30, t);
      osc.start(t); osc.stop(t + 0.45);
    });
    // Low rumble at end
    const t2 = now + 0.45;
    const { osc: low, gain: gl } = this._osc('sine', 55);
    this._env(gl, 0.25, 0.02, 0.5, t2);
    low.start(t2); low.stop(t2 + 0.6);
  }

  // ── Boss arrival ─────────────────────────────────────────────────────────────

  // Deep LFO-modulated warning pulse — 3 quick throbs.
  bossArrival() {
    if (!this._ctx) return;
    const ac  = this._ac();
    const now = ac.currentTime;

    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.22;

      // Sub pulse
      const { osc, gain } = this._osc('sine', 55);
      osc.frequency.exponentialRampToValueAtTime(35, t + 0.18);
      this._env(gain, 0.5, 0.01, 0.18, t);
      osc.start(t); osc.stop(t + 0.22);

      // High metallic click accent
      const { osc: hi, gain: gh } = this._osc('square', 1800);
      hi.frequency.exponentialRampToValueAtTime(600, t + 0.04);
      this._env(gh, 0.10, 0.001, 0.04, t);
      hi.start(t); hi.stop(t + 0.06);
    }
  }
}

// Singleton exported for easy import anywhere
export const audio = new AudioManager();
