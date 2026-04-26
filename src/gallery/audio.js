export class GalleryAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.reverb = null;
    this.stepBus = null;
    this.muted = true;
    this.lastStepAt = 0;
  }

  ensureContext() {
    if (this.ctx) return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);

    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this.makeReverbImpulse(2.6, 1.9);
    this.reverb.connect(this.master);

    const dryAmbient = this.ctx.createGain();
    dryAmbient.gain.value = 0.45;
    dryAmbient.connect(this.master);

    const wetAmbient = this.ctx.createGain();
    wetAmbient.gain.value = 0.55;
    wetAmbient.connect(this.reverb);

    this.startAmbient(dryAmbient, wetAmbient);

    this.stepDry = this.ctx.createGain();
    this.stepDry.gain.value = 2.4;
    this.stepDry.connect(this.master);

    this.stepWet = this.ctx.createGain();
    this.stepWet.gain.value = 0.85;
    this.stepWet.connect(this.reverb);
  }

  setMuted(muted) {
    this.muted = muted;
    this.ensureContext();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const target = muted ? 0 : 0.55;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(target, now + 0.4);
  }

  playStep() {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const now = this.ctx.currentTime;
    if (now - this.lastStepAt < 0.13) return;
    this.lastStepAt = now;

    const sampleCount = Math.floor(this.ctx.sampleRate * 0.16);
    const buffer = this.ctx.createBuffer(1, sampleCount, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i += 1) {
      const t = i / sampleCount;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2);
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 180 + Math.random() * 140;
    bandpass.Q.value = 3.2;

    const lowshelf = this.ctx.createBiquadFilter();
    lowshelf.type = 'lowshelf';
    lowshelf.frequency.value = 140;
    lowshelf.gain.value = 9;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1.2, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    src.connect(bandpass);
    bandpass.connect(lowshelf);
    lowshelf.connect(gain);
    gain.connect(this.stepDry);
    gain.connect(this.stepWet);
    src.start(now);
    src.stop(now + 0.5);
  }

  playMeow(volume = 0.18) {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const now = this.ctx.currentTime;
    const duration = 0.55 + Math.random() * 0.25;

    const carrier = this.ctx.createOscillator();
    carrier.type = 'sawtooth';
    const baseFreq = 380 + Math.random() * 110;
    carrier.frequency.setValueAtTime(baseFreq * 0.9, now);
    carrier.frequency.exponentialRampToValueAtTime(baseFreq * 1.18, now + duration * 0.32);
    carrier.frequency.exponentialRampToValueAtTime(baseFreq * 0.78, now + duration);

    const formant = this.ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(900, now);
    formant.frequency.exponentialRampToValueAtTime(1500, now + duration * 0.45);
    formant.frequency.exponentialRampToValueAtTime(700, now + duration);
    formant.Q.value = 4.5;

    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3200;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.05);
    gain.gain.linearRampToValueAtTime(volume * 0.9, now + duration * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    carrier.connect(formant);
    formant.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.master);
    gain.connect(this.reverb);
    carrier.start(now);
    carrier.stop(now + duration + 0.05);
  }

  startAmbient(dryDest, wetDest) {
    const bufferSize = 4 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const out = noiseBuffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < bufferSize; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 320;
    lowpass.Q.value = 0.6;

    const tilt = this.ctx.createBiquadFilter();
    tilt.type = 'highpass';
    tilt.frequency.value = 60;

    const gain = this.ctx.createGain();
    gain.gain.value = 1.5;

    noise.connect(lowpass);
    lowpass.connect(tilt);
    tilt.connect(gain);
    gain.connect(dryDest);
    gain.connect(wetDest);

    noise.start();
  }

  makeReverbImpulse(duration, decay) {
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const ir = this.ctx.createBuffer(2, length, sampleRate);
    for (let c = 0; c < 2; c += 1) {
      const data = ir.getChannelData(c);
      for (let i = 0; i < length; i += 1) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return ir;
  }
}
