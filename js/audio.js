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
      this._id++;
      if (this.supported) synth.cancel();
    },

    _id: 0,

    // Devuelve una promesa que se resuelve al terminar de hablar (o por tiempo, si no hay voz).
    // Cada frase nueva corta la anterior.
    say(text) {
      const id = ++this._id;
      return new Promise((resolve) => {
        if (!this.supported) return setTimeout(resolve, 400);

        const rate = BQ.store.data.settings.rate;
        let done = false;
        let started = false;
        let fallback;
        let watchdog;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(fallback);
          clearTimeout(watchdog);
          resolve();
        };

        const speak = (retry) => {
          if (id !== this._id) return finish(); // ya la reemplazó otra frase
          const u = new SpeechSynthesisUtterance(text);
          if (this.current) u.voice = this.current;
          u.lang = this.current ? this.current.lang : 'es-AR';
          u.rate = rate;
          u.pitch = 1.15;
          u.onstart = () => {
            started = true;
            clearTimeout(fallback);
            // Tope por si Chrome nunca avisa que terminó
            fallback = setTimeout(finish, (2000 + text.length * 110) / rate);
          };
          u.onend = finish;
          u.onerror = () => { if (started || !retry) finish(); };
          this._utterance = u;
          synth.resume(); // Chrome a veces queda "pausado" y no habla
          synth.speak(u);
          // Si no arrancó en 1,5 s, el motor se trabó: reiniciar y reintentar una vez
          watchdog = setTimeout(() => {
            if (started || done) return;
            if (retry) {
              synth.cancel();
              setTimeout(() => speak(false), 120);
            } else {
              finish();
            }
          }, 1500);
        };

        // Chrome descarta frases pedidas justo después de cancel(): esperar un instante.
        const wasBusy = synth.speaking || synth.pending;
        synth.cancel();
        setTimeout(() => speak(true), wasBusy ? 120 : 0);
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

    // Silbido que sube: el personaje salta
    whee() {
      if (!this.ctx || !BQ.store.data.settings.sfx) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(300, t);
      o.frequency.exponentialRampToValueAtTime(1400, t + 0.6);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.15, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o.connect(g).connect(this.ctx.destination);
      o.start(t);
      o.stop(t + 0.75);
    },

    // Explosión suave de fuego artificial (ruido filtrado)
    pop() {
      if (!this.ctx || !BQ.store.data.settings.sfx) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * 0.5);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const src = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      src.buffer = buf;
      filter.type = 'lowpass';
      filter.frequency.value = 900 + Math.random() * 900;
      g.gain.value = 0.35;
      src.connect(filter).connect(g).connect(this.ctx.destination);
      src.start(t);
      this.notes([[1200 + Math.random() * 800, 0.05, 0.25, 'sine', 0.05]]); // chispita
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
