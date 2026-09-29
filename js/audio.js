(function (BQ) {
  'use strict';

  const synth = window.speechSynthesis;

  // Voces "naturales" (neuronales): suenan mucho más reales, pero casi siempre necesitan internet.
  // Por ejemplo, en Edge: "Microsoft Elena Online (Natural) - Spanish (Argentina)".
  const isNatural = (v) => /natural|neural|premium|enhanced|wavenet|online/i.test(v.name);
  const quality = (v) => (isNatural(v) ? 3 : /google/i.test(v.name) ? 2 : 0);
  const usable = (v) => v.localService || navigator.onLine; // sin internet, solo las instaladas

  // Prioridad: con internet, la voz más natural; sin internet, las instaladas. Después, el acento
  // (rioplatense primero, después latino, después de España).
  function score(v) {
    let s = usable(v) ? 0 : -100;
    s += navigator.onLine ? quality(v) * 10 : v.localService ? 10 : 0;
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
      // Si se corta o vuelve internet, se vuelve a elegir la voz
      window.addEventListener('online', () => this.choose());
      window.addEventListener('offline', () => this.choose());
    },

    spanishVoices() {
      return this.voices.filter((v) => /^es([-_]|$)/i.test(v.lang));
    },

    best() {
      return this.spanishVoices().sort((a, b) => score(b) - score(a))[0] || null;
    },

    choose() {
      const saved = this.spanishVoices().find((v) => v.voiceURI === BQ.store.data.settings.voiceURI);
      // La elegida en las opciones, salvo que necesite internet y no haya
      this.current = (saved && usable(saved) ? saved : null) || this.best();
    },

    // Plan B si la voz natural no arranca (por ejemplo, se cortó internet): la mejor instalada
    fallbackToLocal() {
      const local = this.spanishVoices().filter((v) => v.localService).sort((a, b) => score(b) - score(a))[0];
      if (local && local !== this.current) {
        this.current = local;
        return true;
      }
      return false;
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
          // A las voces robóticas les queda bien un tono un poco más agudo; a las naturales no
          u.pitch = this.current && isNatural(this.current) ? 1 : 1.15;
          u.onstart = () => {
            started = true;
            clearTimeout(fallback);
            // Tope por si Chrome nunca avisa que terminó
            fallback = setTimeout(finish, (2000 + text.length * 110) / rate);
          };
          u.onend = finish;
          u.onerror = () => {
            if (started) return finish();
            // La voz natural falló (sin internet): reintentar enseguida con una instalada
            if (retry && this.current && !this.current.localService && this.fallbackToLocal()) {
              clearTimeout(watchdog);
              setTimeout(() => speak(false), 60);
              return;
            }
            if (!retry) finish();
          };
          this._utterance = u;
          synth.resume(); // Chrome a veces queda "pausado" y no habla
          synth.speak(u);
          // Si no arrancó en 1,5 s, el motor se trabó: reiniciar y reintentar una vez
          watchdog = setTimeout(() => {
            if (started || done) return;
            if (retry) {
              synth.cancel();
              if (this.current && !this.current.localService) this.fallbackToLocal();
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

    // Ruido filtrado con volumen que sube y baja (tribuna, patada)
    noise(duration, type, freq, vol, attack) {
      if (!this.ctx || !BQ.store.data.settings.sfx) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * duration);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      src.buffer = buf;
      filter.type = type;
      filter.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      src.connect(filter).connect(g).connect(this.ctx.destination);
      src.start(t);
    },

    // Fútbol
    whistle() { this.notes([[2800, 0, 0.18, 'sine', 0.07], [2600, 0.22, 0.45, 'sine', 0.07]]); },
    kick() {
      this.noise(0.12, 'lowpass', 600, 0.5, 0.005);
      this.notes([[110, 0, 0.12, 'sine', 0.3]]);
    },
    cheer() { this.noise(2.2, 'bandpass', 1200, 0.25, 0.4); },
    aww() { this.notes([[392, 0, 0.35, 'sine', 0.1], [330, 0.3, 0.6, 'sine', 0.1]]); },

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

    // "¡Cling!" de moneda
    coin() { this.notes([[988, 0, 0.1, 'square', 0.08], [1319, 0.08, 0.55, 'square', 0.08], [2637, 0.08, 0.4, 'sine', 0.05]]); },

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
