// LIGHT LAG — WebAudio synth. Everything here has a visual twin; failure is silent.
const AU = (() => {
  let ctx = null, master = null, on = true, wind = null;
  function init() {
    if (ctx || !on) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    } catch (e) { ctx = null; }
  }
  function resume() { try { if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) {} }
  const ok = () => on && ctx && ctx.state !== 'closed';
  function tone(freq, dur, type, gain, when = 0, slideTo = null) {
    if (!ok()) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.03, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  let noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    const len = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = b * 3.5 + w * 0.15; }
    return noiseBuf;
  }
  const api = {
    get on() { return on; },
    set on(v) { on = v; if (!v) api.stopWind(); if (v) init(); },
    init() { init(); resume(); },
    thoom() { tone(70, 0.6, 'sine', 0.5, 0, 45); tone(140, 0.25, 'triangle', 0.08); },
    tick() { tone(1800, 0.05, 'square', 0.04); },
    chime() { tone(2600 + Math.random() * 400, 0.5, 'sine', 0.035); },
    step() { tone(420, 0.08, 'sine', 0.05); },
    chord() { tone(392, 1.6, 'sine', 0.14); tone(587, 1.8, 'sine', 0.1, 0.14); tone(784, 1.6, 'sine', 0.04, 0.28); },
    sign() { tone(660, 0.4, 'triangle', 0.08); tone(990, 0.5, 'sine', 0.05, 0.08); },
    object() { tone(180, 0.5, 'sawtooth', 0.05, 0, 120); },
    call() { if (!ok()) return; [2, 3, 5, 7].reduce((w, n) => { for (let i = 0; i < n; i++) tone(1320, 0.05, 'sine', 0.05, w + i * 0.07); return w + n * 0.07 + 0.18; }, 0); },
    notyet() { tone(330, 0.5, 'triangle', 0.06); tone(294, 0.7, 'triangle', 0.05, 0.4); },
    stamp() { tone(90, 0.25, 'square', 0.12, 0, 50); },
    // the finale forest: filtered noise wind, breathing, synthesized birds
    startWind() {
      if (!ok() || wind) return null;
      resume();
      const src = ctx.createBufferSource(); src.buffer = noise(); src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6;
      const g = ctx.createGain(); g.gain.value = 0.0001;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 0.18;
      lfo.connect(lg); lg.connect(g.gain);
      const lfo2 = ctx.createOscillator(), lg2 = ctx.createGain(); lfo2.frequency.value = 0.07; lg2.gain.value = 400;
      lfo2.connect(lg2); lg2.connect(bp.frequency);
      // breathing: low noise with a 4 s envelope
      const bsrc = ctx.createBufferSource(); bsrc.buffer = noise(); bsrc.loop = true;
      const blp = ctx.createBiquadFilter(); blp.type = 'lowpass'; blp.frequency.value = 380;
      const bg = ctx.createGain(); bg.gain.value = 0.0;
      const blfo = ctx.createOscillator(), blg = ctx.createGain(); blfo.frequency.value = 0.25; blg.gain.value = 0.07;
      blfo.connect(blg); blg.connect(bg.gain);
      const an = ctx.createAnalyser(); an.fftSize = 1024;
      src.connect(bp); bp.connect(g); bsrc.connect(blp); blp.connect(bg);
      g.connect(an); bg.connect(an); an.connect(master);
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 3);
      [src, lfo, lfo2, bsrc, blfo].forEach((n) => n.start());
      const birds = setInterval(() => {
        if (Math.random() < 0.5) return;
        const f = 2400 + Math.random() * 1600, w = Math.random() * 0.2;
        for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) tone(f * (1 + i * 0.05), 0.09, 'sine', 0.03, w + i * 0.11, f * 1.35);
      }, 1700);
      wind = { stop() { clearInterval(birds); const t1 = ctx.currentTime; g.gain.cancelScheduledValues(t1); g.gain.setValueAtTime(g.gain.value || 0.2, t1); g.gain.exponentialRampToValueAtTime(0.0001, t1 + 1.5); bg.gain.value = 0; setTimeout(() => { [src, lfo, lfo2, bsrc, blfo].forEach((n) => { try { n.stop(); } catch (e) {} }); }, 1700); }, analyser: an };
      return wind;
    },
    stopWind() { if (wind) { wind.stop(); wind = null; } },
    get analyser() { return wind && wind.analyser; },
  };
  return api;
})();
