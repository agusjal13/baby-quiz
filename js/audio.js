(function (BQ) {
  'use strict';

  const synth = window.speechSynthesis;

  // Prioridad de voces: instaladas en el dispositivo (funcionan sin internet) y acento rioplatense/latino.
  function score(v) {
    let s = 0;
    if (v.localService) s += 10;
    const lang = v.lang.toLowerCase().replace('_', '-');
    if (lang === 'es-ar') s += 6;
    else if (['es-419', 'es-us', 'es-mx', 'es-uy', 'es-cl', 'es-co'].includes(lang)) s += 4;
    else if (lang === 'es-es') s += 3;
    return s;
  }

  // ---------- Voz (síntesis del sistema) ----------
  BQ.voice = {
    supported: !!synth && typeof SpeechSynthesisUtterance !== 'undefined',
    voices: [],
    current: null,
    _utterance: null, // referencia para que Chrome no la descarte antes de terminar

    init() {
      if (!this.supported) return;
      const load = () => {
        this.voices = synth.getVoices();
        this.choose();
      };
      load();
      synth.onvoiceschanged = load;
    },

    spanishVoices() {
      return this.voices.filter((v) => /^es([-_]|$)/i.test(v.lang));
    },

    choose() {
      const list = this.spanishVoices();
      const saved = BQ.store.data.settings.voiceURI;
      this.current = list.find((v) => v.voiceURI === saved)
        || list.slice().sort((a, b) => score(b) - score(a))[0]
        || null;
    },

    // En iOS/Android la primera locución tiene que salir de un toque del usuario.
    unlock() {
      if (!this.supported) return;
      synth.speak(new SpeechSynthesisUtterance(' '));
    },

    stop() {
      if (this.supported) synth.cancel();
    },

    // Devuelve una promesa que se resuelve al terminar de hablar (o por tiempo, si no hay voz).
    say(text) {
      return new Promise((resolve) => {
        if (!this.supported) return setTimeout(resolve, 400);
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        if (this.current) u.voice = this.current;
        u.lang = this.current ? this.current.lang : 'es-AR';
        u.rate = BQ.store.data.settings.rate;
        u.pitch = 1.15;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(finish, 1500 + text.length * 90);
        u.onend = finish;
        u.onerror = finish;
        this._utterance = u;
        synth.speak(u);
      });
    },
  };

  // ---------- Efectos de sonido (sintetizados, sin archivos) ----------
  BQ.sfx = {
    ctx: null,

    init() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    notes(list) {
      if (!this.ctx || !BQ.store.data.settings.sfx) return;
      const now = this.ctx.currentTime;
      for (const [freq, start, dur, type = 'triangle', vol = 0.18] of list) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        const t = now + start;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(this.ctx.destination);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    },

    tap() { this.notes([[660, 0, 0.08, 'sine', 0.12]]); },
    correct() { this.notes([[523, 0, 0.15], [659, 0.09, 0.15], [784, 0.18, 0.15], [1047, 0.27, 0.35]]); },
    wrong() { this.notes([[330, 0, 0.18, 'sine', 0.15], [262, 0.14, 0.28, 'sine', 0.15]]); },
    step() { this.notes([[392, 0, 0.1], [523, 0.12, 0.1], [392, 0.24, 0.1], [523, 0.36, 0.1]]); },
    win() {
      this.notes([
        [523, 0, 0.18], [523, 0.18, 0.18], [523, 0.36, 0.18], [659, 0.54, 0.5],
        [587, 0.9, 0.18], [659, 1.08, 0.18], [784, 1.26, 0.7],
        [1047, 1.26, 0.7, 'sine', 0.1],
      ]);
    },
  };
})(window.BQ);
