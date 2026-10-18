(function (BQ) {
  'use strict';

  /*
   * Corta frutas (estilo "Fruit Ninja"): las frutas saltan desde abajo y se cortan pasando el dedo
   * por encima. También salen bombas, que no hay que tocar. Dos formas de jugar, que se eligen al
   * empezar:
   *   - Hasta la bomba ♾️: se juega sin tiempo hasta que se corta una bomba. Cada vez sale todo un
   *     poco más rápido y con más bombas. Más de 20 frutas da 1 moneda, más de 40 da 2, más de 60
   *     da 3, y así (una más cada 20).
   *   - 30 segundos ⏱️: se cortan todas las que se pueda en 30 segundos. Cortar una bomba resta
   *     2 frutas. Más de 10 frutas da 1 moneda; más de 20, 2.
   * Ganar (al menos una moneda) también suma un partido para los trofeos.
   */

  const U = BQ.util;
  const h = U.h;
  const store = BQ.store;
  const voice = BQ.voice;
  const sfx = BQ.sfx;
  const ui = () => BQ.ui;
  const wait = BQ.sport.wait;

  const FRUITS = ['🍎', '🍌', '🍉', '🍊', '🍓', '🍍', '🥝', '🍇', '🍑', '🍐', '🍒', '🥭'];
  // Color del jugo de cada fruta (para las gotitas al cortarla)
  const JUICE = { '🍎': '#e53935', '🍌': '#ffe082', '🍉': '#ff5a6a', '🍊': '#ff9800', '🍓': '#e91e63', '🍍': '#ffd54f', '🥝': '#9ccc65', '🍇': '#8e24aa', '🍑': '#ffab91', '🍐': '#c5e1a5', '🍒': '#c62828', '🥭': '#ffb300' };
  const MODES = [
    {
      id: 'infinito', icon: '♾️', say: 'Hasta la bomba', label: 'Hasta la bomba',
      // Monedas: una por cada 20 frutas, contando desde 21 (21 a 40: 1; 41 a 60: 2; ...)
      coins: (n) => (n > 20 ? Math.floor((n - 1) / 20) : 0),
      bomb: 0.14, // probabilidad de que salga una bomba (sube con el tiempo)
    },
    {
      id: 'tiempo', icon: '⏱️', say: 'Treinta segundos', label: '30 segundos', time: 30, bombCost: 2,
      coins: (n) => (n > 20 ? 2 : n > 10 ? 1 : 0),
      bomb: 0.2,
    },
  ];
  const THEME = { sky1: '#4e342e', sky2: '#8d6e63', ground: '#3e2723', decor: ['🍉', '🍓', '🍌', '🍍', '✨'] };

  let S = null;
  const alive = (s) => S === s && s.screen.isConnected;
  const rnd = (a, b) => a + Math.random() * (b - a);

  function open() {
    if (!store.data.character) {
      store.data.character = 'futbolista';
      store.save();
    }
    startGame();
  }

  function startGame() {
    const canvas = h('canvas', { class: 'fr-canvas' });
    const flash = h('div', { class: 'sport-flash', hidden: true });
    const stage = h('div', { class: 'fr-stage' }, canvas, flash);
    const count = h('span', { class: 'fr-count' }, '0');
    const clock = h('span', { class: 'fr-clock' }, '');
    const screen = h('div', { class: 'screen frutas' },
      ui().topbar(ui().backBtn(() => { S = null; ui().showWorlds(); }),
        h('div', { class: 'fr-top' }, h('span', { class: 'fr-box' }, h('span', { class: 'emoji' }, '🍉'), count), h('span', { class: 'fr-box fr-clock-box' }, clock)),
        h('span', { class: 'spacer' })),
      stage);
    ui().show(screen, THEME);

    const s = {
      screen, stage, canvas, ctx: canvas.getContext('2d'), flash, count, clock,
      mode: null, playing: false, over: false, score: 0, cut: 0, t: 0, left: 0, spawn: 0.6,
      things: [], halves: [], drops: [], trail: [], pointer: null, last: performance.now(), shake: 0, swoosh: 0,
    };
    S = s;
    resize(s);
    const ro = new ResizeObserver(() => { if (alive(s)) resize(s); else ro.disconnect(); });
    ro.observe(stage);
    listen(s);
    loop(s);
    chooseMode(s);
  }

  // Elegir la forma de jugar (dos botones grandes con dibujito)
  function chooseMode(s) {
    const begin = (mode) => {
      if (!alive(s) || s.mode) return;
      s.mode = mode;
      chooser.remove();
      s.left = mode.time || 0;
      s.clock.textContent = mode.time ? '⏱️ ' + mode.time : '♾️';
      sfx.whistle();
      voice.say(mode.time ? '¡Cortá todas las frutas que puedas! ¡Cuidado con las bombas!' : '¡Cortá las frutas! ¡Si tocás una bomba, se termina!')
        .then(() => {
          if (!alive(s)) return;
          s.playing = true;
          s.last = performance.now();
        });
    };
    const chooser = h('div', { class: 'fr-modes' }, MODES.map((m) => h('button', {
      class: 'fr-mode', 'aria-label': m.say,
      onpointerdown: ui().tap((e) => { e.stopPropagation(); begin(m); }),
    }, h('span', { class: 'emoji' }, m.icon), h('span', { class: 'fr-mode-name' }, m.label))));
    s.stage.append(chooser);
    voice.say('¡Elegí! Hasta la bomba, o treinta segundos.');
  }

  // ---------- Pantalla ----------

  function resize(s) {
    const r = s.stage.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    s.W = Math.max(1, r.width);
    s.H = Math.max(1, r.height);
    s.canvas.width = Math.round(s.W * dpr);
    s.canvas.height = Math.round(s.H * dpr);
    s.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    s.r = Math.min(s.W, s.H) * 0.085; // radio de una fruta
    s.g = s.H * 1.15; // gravedad (px/s²)
  }

  function draw(s) {
    const g = s.ctx;
    const { W, H } = s;
    g.save();
    if (s.shake > 0) g.translate((Math.random() - 0.5) * s.shake * 16, (Math.random() - 0.5) * s.shake * 16);
    // Tabla de madera
    const wood = g.createLinearGradient(0, 0, 0, H);
    wood.addColorStop(0, '#8d5a3b');
    wood.addColorStop(1, '#5d3a22');
    g.fillStyle = wood;
    g.fillRect(-20, -20, W + 40, H + 40);
    g.strokeStyle = 'rgba(0,0,0,.18)';
    g.lineWidth = 3;
    for (let x = W / 5; x < W; x += W / 5) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    // Gotitas de jugo
    for (const d of s.drops) {
      g.globalAlpha = Math.max(0, d.life);
      g.fillStyle = d.color;
      g.beginPath();
      g.arc(d.x, d.y, d.size, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // Mitades de las frutas cortadas: la misma fruta, recortada a la mitad, separándose
    for (const p of s.halves) {
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.beginPath();
      g.rect(p.side < 0 ? -p.r * 1.4 : 0, -p.r * 1.4, p.r * 1.4, p.r * 2.8);
      g.clip();
      g.font = `${p.r * 2}px ${EMOJI}`;
      g.fillText(p.emoji, 0, p.r * 0.08);
      g.restore();
    }
    // Frutas y bombas enteras
    for (const o of s.things) {
      g.save();
      g.translate(o.x, o.y);
      g.rotate(o.rot);
      g.font = `${o.r * 2}px ${EMOJI}`;
      g.fillText(o.emoji, 0, o.r * 0.08);
      if (o.bomb) {
        // Chispa de la mecha
        g.fillStyle = Math.random() < 0.5 ? '#ffeb3b' : '#ff5722';
        g.beginPath();
        g.arc(o.r * 0.55, -o.r * 0.75, o.r * (0.12 + Math.random() * 0.1), 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
    // Estela del dedo
    const now = performance.now();
    const pts = s.trail.filter((p) => now - p.t < 140);
    if (pts.length > 1) {
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (const [w, c] of [[s.r * 0.42, 'rgba(255,255,255,.35)'], [s.r * 0.16, '#fff']]) {
        g.strokeStyle = c;
        g.lineWidth = w;
        g.beginPath();
        pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
        g.stroke();
      }
    }
    g.restore();
  }

  const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

  // ---------- Controles: pasar el dedo corta ----------

  function listen(s) {
    const point = (e) => {
      const r = s.stage.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
    };
    s.stage.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sfx.init();
      try { s.stage.setPointerCapture(e.pointerId); } catch (err) { /* sigue sin captura */ }
      s.pointer = { id: e.pointerId, ...point(e) };
      s.trail = [point(e)];
    });
    s.stage.addEventListener('pointermove', (e) => {
      if (!s.pointer || e.pointerId !== s.pointer.id) return;
      const p = point(e);
      slash(s, s.pointer.x, s.pointer.y, p.x, p.y);
      s.pointer = { id: e.pointerId, ...p };
      s.trail.push(p);
      if (s.trail.length > 30) s.trail.shift();
    });
    const up = (e) => { if (s.pointer && e.pointerId === s.pointer.id) s.pointer = null; };
    s.stage.addEventListener('pointerup', up);
    s.stage.addEventListener('pointercancel', up);
  }

  // Un tramo del dedo, de (x1, y1) a (x2, y2): corta todo lo que toque
  function slash(s, x1, y1, x2, y2) {
    if (!s.playing || s.over) return;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 2) return;
    s.swoosh += len;
    if (s.swoosh > s.H * 0.3) {
      s.swoosh = 0;
      sfx.noise(0.12, 'highpass', 2500, 0.08, 0.01);
    }
    for (const o of s.things.slice()) {
      // Distancia del centro de la fruta al tramo del dedo
      const t = Math.max(0, Math.min(1, ((o.x - x1) * (x2 - x1) + (o.y - y1) * (y2 - y1)) / (len * len)));
      const d = Math.hypot(o.x - (x1 + t * (x2 - x1)), o.y - (y1 + t * (y2 - y1)));
      if (d > o.r * 0.95) continue;
      if (o.bomb) boom(s, o);
      else cutFruit(s, o, Math.atan2(y2 - y1, x2 - x1));
      if (s.over) return;
    }
  }

  function cutFruit(s, o, angle) {
    s.things.splice(s.things.indexOf(o), 1);
    s.score++;
    s.cut++;
    s.count.textContent = String(s.score);
    s.count.parentElement.classList.remove('bump');
    void s.count.offsetWidth;
    s.count.parentElement.classList.add('bump');
    sfx.notes([[500 + Math.random() * 300, 0, 0.08, 'triangle', 0.12]]);
    // Las dos mitades salen para los costados del corte
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    for (const side of [-1, 1]) {
      s.halves.push({ x: o.x, y: o.y, vx: o.vx * 0.6 + side * nx * s.r * 3, vy: o.vy * 0.4 + side * ny * s.r * 3 - s.r * 2, rot: angle + Math.PI / 2, vr: side * 4, r: o.r, emoji: o.emoji, side, life: 2 });
    }
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rnd(0.5, 2.2) * s.r * 3;
      s.drops.push({ x: o.x, y: o.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: rnd(0.08, 0.18) * s.r, color: JUICE[o.emoji] || '#ff5a6a', life: 1 });
    }
    if (s.cut % 10 === 0) voice.say(String(s.score));
  }

  async function boom(s, o) {
    s.things.splice(s.things.indexOf(o), 1);
    s.shake = 1;
    sfx.noise(0.6, 'lowpass', 220, 0.6, 0.005);
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rnd(1, 3) * s.r * 3;
      s.drops.push({ x: o.x, y: o.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: rnd(0.1, 0.25) * s.r, color: i % 2 ? '#ff9800' : '#424242', life: 1 });
    }
    if (!s.mode.time) {
      // Hasta la bomba: se terminó
      BQ.sport.flash(s.flash, '¡BUM!', 'saved');
      return finish(s);
    }
    // 30 segundos: resta frutas
    s.score = Math.max(0, s.score - s.mode.bombCost);
    s.count.textContent = String(s.score);
    BQ.sport.flash(s.flash, '¡BUM! −' + s.mode.bombCost, 'saved');
    sfx.wrong();
    await wait(800);
    if (alive(s) && !s.over) s.flash.hidden = true;
  }

  // ---------- Juego ----------

  function loop(s) {
    if (!alive(s)) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - s.last) / 1000);
    s.last = now;
    step(s, dt);
    draw(s);
    setTimeout(() => loop(s), 16);
  }

  function step(s, dt) {
    s.shake = Math.max(0, s.shake - dt * 2.5);
    // Lo que vuela (siempre, aunque el juego haya terminado: así terminan de caer)
    for (const o of s.things) {
      o.vy += s.g * dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.rot += o.vr * dt;
    }
    s.things = s.things.filter((o) => o.y < s.H + o.r * 2 || o.vy < 0);
    for (const p of s.halves) {
      p.vy += s.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.life -= dt;
    }
    s.halves = s.halves.filter((p) => p.life > 0 && p.y < s.H + p.r * 2);
    for (const d of s.drops) {
      d.vy += s.g * 0.6 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.life -= dt * 1.2;
    }
    s.drops = s.drops.filter((d) => d.life > 0);
    if (!s.playing || s.over) return;

    s.t += dt;
    if (s.mode.time) {
      const before = Math.ceil(s.left);
      s.left = Math.max(0, s.left - dt);
      const now = Math.ceil(s.left);
      if (now !== before) {
        s.clock.textContent = '⏱️ ' + now;
        s.clock.parentElement.classList.toggle('hurry', now <= 5);
        if (now <= 5 && now > 0) sfx.notes([[880, 0, 0.05, 'sine', 0.05]]);
      }
      if (s.left <= 0) return finish(s);
    }
    // Tandas de frutas (en "hasta la bomba", cada vez más seguido)
    s.spawn -= dt;
    if (s.spawn <= 0) {
      const level = s.mode.time ? 0.5 : Math.min(1, s.t / 60);
      s.spawn = rnd(1.0, 1.5) - level * 0.45;
      const n = 1 + Math.floor(Math.random() * (2 + level * 2));
      for (let i = 0; i < n; i++) launch(s, s.mode.bomb + level * 0.08);
    }
  }

  // Tira una fruta (o una bomba) desde abajo, en arco hacia el medio
  function launch(s, bombChance) {
    const bomb = Math.random() < bombChance;
    const x = rnd(s.W * 0.15, s.W * 0.85);
    const peak = rnd(0.45, 0.8) * s.H; // qué tan alto llega
    const vy = -Math.sqrt(2 * s.g * peak);
    const flight = (2 * -vy) / s.g;
    const vx = (rnd(s.W * 0.3, s.W * 0.7) - x) / flight;
    s.things.push({
      x, y: s.H + s.r, vx, vy, rot: 0, vr: rnd(-3, 3),
      r: s.r * (bomb ? 0.95 : rnd(0.9, 1.15)), bomb, emoji: bomb ? '💣' : U.pick(FRUITS),
    });
  }

  async function finish(s) {
    s.over = true;
    s.playing = false;
    const n = s.score;
    const coins = s.mode.coins(n);
    if (s.mode.time) BQ.sport.flash(s.flash, '¡TIEMPO!', coins ? 'goal' : 'saved');
    sfx.whistle();
    await wait(1600);
    if (!alive(s)) return;
    s.flash.hidden = true;
    const next = s.mode.time ? 11 : 21; // cuántas hacen falta para la primera moneda
    BQ.sport.result({
      screen: s.screen,
      won: coins > 0,
      coins,
      wins: coins ? 1 : 0,
      title: coins > 1 ? '¡Ninja!' : undefined,
      detail: h('div', { class: 'mt-final' }, h('span', { class: 'emoji' }, '🍉'), ' ' + n),
      onAgain: startGame,
      winSay: `¡Cortaste ${n} frutas! ¡Te ganaste ${coins === 1 ? 'una moneda' : coins + ' monedas'}!`,
      loseSay: `¡Cortaste ${n} ${n === 1 ? 'fruta' : 'frutas'}! Necesitás ${next} para ganar. ¡Jugá otra vez!`,
      isAlive: () => alive(s),
    });
  }

  // state, advance y slash: para revisar el juego desde la consola
  BQ.frutas = {
    open, modes: MODES, state: () => S,
    advance: (n, dt = 0.016) => { for (let i = 0; i < n && S; i++) step(S, dt); },
    slash: (x1, y1, x2, y2) => slash(S, x1, y1, x2, y2),
  };
})(window.BQ);
