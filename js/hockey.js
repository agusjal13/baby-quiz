(function (BQ) {
  'use strict';

  /*
   * Air hockey (hockey de mesa) a 5 goles, sin preguntas. El chico mueve su disco con el dedo en su
   * mitad de la mesa y un rival (dificultad media) juega del otro lado. En el círculo central está
   * la carita del personaje elegido. Ganar da una moneda y suma para los trofeos; 5 a 0 vale doble.
   *
   * La mesa mide 300 x 500 (unidades propias): el rival arriba (y chica) y el jugador abajo.
   * Con la pantalla acostada la mesa se dibuja girada, con el jugador a la izquierda.
   * Velocidades en unidades por cuadro (16 ms).
   */

  const U = BQ.util;
  const h = U.h;
  const store = BQ.store;
  const voice = BQ.voice;
  const sfx = BQ.sfx;
  const ui = () => BQ.ui;
  const wait = BQ.sport.wait;

  const TO_WIN = 5;
  const TW = 300;
  const TH = 500;
  const PUCK_R = 15;
  const MALLET_R = 27;
  const GOAL_W = 120; // ancho de cada arco
  const MAX_SPEED = 12; // tope de velocidad del disco
  const FRICTION = 0.9975; // el disco casi no se frena, como en la mesa de verdad
  // Dificultad media del rival: velocidad para acomodarse y defender (speed), velocidad del golpe
  // (strike), cada cuántos cuadros vuelve a apuntar (react) y cuánto le erra al apuntar (error)
  // (Probado con partidos simulados: un nene que reacciona lento le gana 1 de cada 4; uno que ya le
  // agarró la mano, casi siempre. Para hacerlo más difícil: subir speed y strike y bajar error.)
  const AI = { speed: 2.2, strike: 4.2, react: 26, error: 140 };
  const THEME = { sky1: '#0d47a1', sky2: '#42a5f5', ground: '#0b3c8a', decor: ['🏒', '⭐', '❄️', '✨', '🏆'] };

  let S = null;
  const alive = (s) => S === s && s.screen.isConnected;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function open() {
    if (!store.data.character) {
      store.data.character = 'futbolista';
      store.save();
    }
    startGame();
  }

  function startGame() {
    const mine = store.data.character;
    const rival = U.pick(BQ.characters.filter((c) => c.id !== mine)).id;
    const scoreMe = h('span', { class: 'mt-goals' }, '0');
    const scoreRival = h('span', { class: 'mt-goals' }, '0');
    const score = h('div', { class: 'mt-score' },
      h('span', { class: 'mt-team' }, BQ.puppet.el(mine)), scoreMe,
      h('span', { class: 'mt-dash' }, '-'),
      scoreRival, h('span', { class: 'mt-team' }, BQ.puppet.el(rival, [])));

    const table = h('canvas', { class: 'ah-layer' }); // mesa y líneas
    const face = h('div', { class: 'ah-face' }, BQ.puppet.el(mine)); // carita en el círculo central
    const top = h('canvas', { class: 'ah-layer' }); // disco y paletas (por encima de la carita)
    const flash = h('div', { class: 'sport-flash', hidden: true });
    const hand = h('span', { class: 'hand emoji ah-hand', hidden: true }, '👆');
    const stage = h('div', { class: 'ah-stage' }, table, face, top, hand, flash);

    const screen = h('div', { class: 'screen hockey' },
      ui().topbar(ui().backBtn(() => { S = null; ui().showWorlds(); }), score, h('span', { class: 'spacer' })),
      stage);
    ui().show(screen, THEME);

    const s = {
      screen, stage, table, top, face, flash, hand, scoreMe, scoreRival,
      tctx: table.getContext('2d'), ctx: top.getContext('2d'),
      puck: { x: TW / 2, y: TH / 2 + 70, vx: 0, vy: 0 },
      me: { x: TW / 2, y: TH - 70, vx: 0, vy: 0, tx: TW / 2, ty: TH - 70 },
      ai: { x: TW / 2, y: 72, vx: 0, vy: 0, aimX: TW / 2, think: 0 },
      goals: { me: 0, rival: 0 }, playing: false, pointer: null, spot: null, lastHit: 0,
    };
    S = s;
    resize(s);
    const ro = new ResizeObserver(() => { if (alive(s)) resize(s); else ro.disconnect(); });
    ro.observe(stage);
    listen(s);
    loop(s);

    sfx.whistle();
    voice.say('¡Mové tu disco con el dedo y hacé cinco goles!').then(() => {
      if (!alive(s)) return;
      s.playing = true;
      showHint(s);
    });
  }

  // ---------- Pantalla ----------

  function resize(s) {
    const r = s.stage.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    s.W = Math.max(1, r.width);
    s.H = Math.max(1, r.height);
    s.wide = s.W > s.H; // pantalla acostada: mesa girada, el jugador a la izquierda
    const [w, hgt] = s.wide ? [TH, TW] : [TW, TH];
    s.k = Math.min(s.W / w, s.H / hgt);
    s.ox = (s.W - w * s.k) / 2;
    s.oy = (s.H - hgt * s.k) / 2;
    for (const c of [s.table, s.top]) {
      c.width = Math.round(s.W * dpr);
      c.height = Math.round(s.H * dpr);
      c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // Carita: el círculo central mide 2·R; la cabeza del muñequito lo llena
    const R = 62 * s.k;
    const c = toScreen(s, TW / 2, TH / 2);
    Object.assign(s.face.style, { left: c.x + 'px', top: c.y + 'px', width: R * 2 + 'px', height: R * 2 + 'px', fontSize: R * 3.3 + 'px' });
    drawTable(s);
    draw(s);
  }

  function toScreen(s, x, y) {
    return s.wide ? { x: s.ox + (TH - y) * s.k, y: s.oy + x * s.k } : { x: s.ox + x * s.k, y: s.oy + y * s.k };
  }

  function toTable(s, sx, sy) {
    return s.wide ? { x: (sy - s.oy) / s.k, y: TH - (sx - s.ox) / s.k } : { x: (sx - s.ox) / s.k, y: (sy - s.oy) / s.k };
  }

  function drawTable(s) {
    const g = s.tctx;
    g.clearRect(0, 0, s.W, s.H);
    const a = toScreen(s, 0, 0);
    const b = toScreen(s, TW, TH);
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x);
    const hgt = Math.abs(b.y - a.y);
    const k = s.k;
    // Borde y hielo
    g.fillStyle = '#1565c0';
    roundRect(g, x - 7 * k, y - 7 * k, w + 14 * k, hgt + 14 * k, 22 * k);
    g.fill();
    g.fillStyle = '#f3faff';
    roundRect(g, x, y, w, hgt, 16 * k);
    g.fill();
    // Línea del medio y círculo central
    g.strokeStyle = '#e53935';
    g.lineWidth = 3 * k;
    const m1 = toScreen(s, 0, TH / 2);
    const m2 = toScreen(s, TW, TH / 2);
    g.beginPath();
    g.moveTo(m1.x, m1.y);
    g.lineTo(m2.x, m2.y);
    g.stroke();
    const c = toScreen(s, TW / 2, TH / 2);
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(c.x, c.y, 62 * k, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // Arcos y sus áreas
    for (const [gy, color] of [[0, '#ff7043'], [TH, '#43a047']]) {
      const p1 = toScreen(s, (TW - GOAL_W) / 2, gy);
      const p2 = toScreen(s, (TW + GOAL_W) / 2, gy);
      g.strokeStyle = color;
      g.lineWidth = 12 * k;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(p1.x, p1.y);
      g.lineTo(p2.x, p2.y);
      g.stroke();
      const cc = toScreen(s, TW / 2, gy);
      g.strokeStyle = '#90caf9';
      g.lineWidth = 3 * k;
      g.beginPath();
      // media luna hacia adentro de la mesa
      const start = s.wide ? (gy === 0 ? Math.PI / 2 : -Math.PI / 2) : (gy === 0 ? 0 : Math.PI);
      g.arc(cc.x, cc.y, 78 * k, start, start + Math.PI);
      g.stroke();
    }
  }

  function roundRect(g, x, y, w, hgt, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + hgt, r);
    g.arcTo(x + w, y + hgt, x, y + hgt, r);
    g.arcTo(x, y + hgt, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function disc(s, o, r, fill, edge, knob) {
    const g = s.ctx;
    const p = toScreen(s, o.x, o.y);
    const R = r * s.k;
    g.fillStyle = 'rgba(0,0,0,.2)';
    g.beginPath();
    g.arc(p.x + R * 0.12, p.y + R * 0.18, R, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = fill;
    g.strokeStyle = edge;
    g.lineWidth = Math.max(2, R * 0.14);
    g.beginPath();
    g.arc(p.x, p.y, R - g.lineWidth / 2, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    if (knob) {
      g.fillStyle = edge;
      g.beginPath();
      g.arc(p.x, p.y, R * 0.42, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)';
      g.beginPath();
      g.arc(p.x - R * 0.12, p.y - R * 0.14, R * 0.16, 0, Math.PI * 2);
      g.fill();
    }
  }

  function draw(s) {
    s.ctx.clearRect(0, 0, s.W, s.H);
    disc(s, s.ai, MALLET_R, '#ff8a65', '#d84315', true);
    disc(s, s.me, MALLET_R, '#66bb6a', '#2e7d32', true);
    disc(s, s.puck, PUCK_R, '#263238', '#000', false);
  }

  // ---------- Controles ----------

  function listen(s) {
    const set = (e) => {
      const r = s.stage.getBoundingClientRect();
      const p = toTable(s, e.clientX - r.left, e.clientY - r.top);
      s.me.tx = p.x;
      s.me.ty = p.y;
    };
    s.stage.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sfx.init();
      try { s.stage.setPointerCapture(e.pointerId); } catch (err) { /* sigue sin captura */ }
      s.pointer = e.pointerId;
      set(e);
      stopHint(s);
    });
    s.stage.addEventListener('pointermove', (e) => { if (e.pointerId === s.pointer) set(e); });
    const up = (e) => { if (e.pointerId === s.pointer) s.pointer = null; };
    s.stage.addEventListener('pointerup', up);
    s.stage.addEventListener('pointercancel', up);
  }

  function showHint(s) {
    stopHint(s);
    const p = toScreen(s, s.me.x, s.me.y);
    const to = toScreen(s, s.me.x - 60, s.me.y - 90);
    s.hand.hidden = false;
    s.hand.style.left = p.x + 'px';
    s.hand.style.top = p.y + 'px';
    s.handAnim = s.hand.animate([
      { transform: 'translate(0, 0)', opacity: 0 },
      { transform: 'translate(0, 0)', opacity: 1, offset: 0.15 },
      { transform: `translate(${to.x - p.x}px, ${to.y - p.y}px)`, opacity: 1, offset: 0.55 },
      { transform: 'translate(0, 0)', opacity: 1, offset: 0.9 },
      { transform: 'translate(0, 0)', opacity: 0 },
    ], { duration: 1700, iterations: 3 });
    s.handAnim.onfinish = () => stopHint(s);
  }

  function stopHint(s) {
    if (s.handAnim) s.handAnim.cancel();
    s.handAnim = null;
    s.hand.hidden = true;
  }

  // ---------- Juego ----------

  function loop(s) {
    if (!alive(s)) return;
    if (s.playing) step(s);
    draw(s);
    setTimeout(() => loop(s), 16);
  }

  // Mueve una paleta hacia (tx, ty) sin pasar "max" por cuadro, dentro de su mitad
  function moveMallet(m, tx, ty, max, top) {
    const minY = top ? MALLET_R : TH / 2 + MALLET_R;
    const maxY = top ? TH / 2 - MALLET_R : TH - MALLET_R;
    tx = clamp(tx, MALLET_R, TW - MALLET_R);
    ty = clamp(ty, minY, maxY);
    let dx = tx - m.x;
    let dy = ty - m.y;
    const d = Math.hypot(dx, dy);
    if (d > max) {
      dx *= max / d;
      dy *= max / d;
    }
    m.vx = dx;
    m.vy = dy;
    m.x += dx;
    m.y += dy;
  }

  // El rival: si el disco está de su lado, se pone detrás (respecto del arco del chico) y le pega
  // hacia ese arco, apuntando con algo de error; si no, espera cerca de su arco acompañando al disco.
  function rivalThink(s) {
    const { ai, puck } = s;
    if (--ai.think <= 0) {
      ai.think = AI.react;
      ai.aimX = TW / 2 + (Math.random() - 0.5) * AI.error * 2; // a qué punto del fondo apunta
    }
    if (puck.y >= TH / 2 + 10) {
      return moveMallet(ai, TW / 2 + (puck.x - TW / 2) * 0.6, 72, AI.speed, true);
    }
    // Dirección del tiro: del disco hacia el arco del chico
    let ax = ai.aimX - puck.x;
    let ay = TH - puck.y;
    const al = Math.hypot(ax, ay);
    ax /= al;
    ay /= al;
    // ¿Está detrás del disco y alineado con el tiro?
    const dx = puck.x - ai.x;
    const dy = puck.y - ai.y;
    const along = dx * ax + dy * ay;
    const side = Math.abs(dx * ay - dy * ax);
    if (along > 0 && side < PUCK_R + 6) {
      // Golpe: pasa de largo por el disco
      moveMallet(ai, puck.x + ax * 40, puck.y + ay * 40, AI.strike, true);
    } else {
      // Se acomoda detrás del disco (si el disco quedó contra su fondo, lo saca de costado)
      const back = PUCK_R + MALLET_R + 8;
      const ty = puck.y - ay * back;
      moveMallet(ai, puck.x - ax * back + (ty < MALLET_R ? (puck.x < TW / 2 ? 1 : -1) * back : 0), ty, AI.speed * 1.5, true);
    }
  }

  function hit(s, m) {
    const p = s.puck;
    const dx = p.x - m.x;
    const dy = p.y - m.y;
    const d = Math.hypot(dx, dy) || 0.001;
    const min = PUCK_R + MALLET_R;
    if (d >= min) return;
    const nx = dx / d;
    const ny = dy / d;
    // Separarlos y rebotar según la velocidad relativa (la paleta "empuja")
    p.x = m.x + nx * min;
    p.y = m.y + ny * min;
    const rel = (p.vx - m.vx) * nx + (p.vy - m.vy) * ny;
    if (rel < 0) {
      // (con un mínimo de fuerza, para que el disco siempre salga con ganas)
      const push = Math.max(1.9 * -rel, 3.2);
      p.vx += push * nx;
      p.vy += push * ny;
    }
    const now = Date.now();
    if (now - s.lastHit > 90) sfx.notes([[620, 0, 0.05, 'square', 0.07]]);
    s.lastHit = now;
  }

  function step(s) {
    const { puck: p, me } = s;
    // Paletas: la del chico sigue el dedo (rápido, pero no de golpe: así el choque empuja bien)
    moveMallet(me, me.tx, me.ty, 16, false);
    rivalThink(s);

    p.x += p.vx;
    p.y += p.vy;
    p.vx *= FRICTION;
    p.vy *= FRICTION;
    hit(s, me);
    hit(s, s.ai);
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > MAX_SPEED) {
      p.vx *= MAX_SPEED / sp;
      p.vy *= MAX_SPEED / sp;
    }

    // Bandas de los costados
    const wall = () => { if (sp > 1) sfx.notes([[260, 0, 0.04, 'triangle', 0.06]]); };
    if (p.x < PUCK_R) { p.x = PUCK_R; p.vx = Math.abs(p.vx) * 0.92; wall(); }
    if (p.x > TW - PUCK_R) { p.x = TW - PUCK_R; p.vx = -Math.abs(p.vx) * 0.92; wall(); }
    // Fondos: gol si entra por el arco; si no, rebota
    const inGoal = Math.abs(p.x - TW / 2) < GOAL_W / 2 - PUCK_R * 0.4;
    if (p.y < PUCK_R) {
      if (inGoal) return goal(s, 'me');
      p.y = PUCK_R;
      p.vy = Math.abs(p.vy) * 0.92;
      wall();
    }
    if (p.y > TH - PUCK_R) {
      if (inGoal) return goal(s, 'rival');
      p.y = TH - PUCK_R;
      p.vy = -Math.abs(p.vy) * 0.92;
      wall();
    }

    // Una paleta no puede aplastar al disco contra la pared: si después de rebotar siguen encimados,
    // la que se corre es la paleta, y el disco queda quieto ahí (no sale disparado ni atraviesa la pared)
    for (const m of [me, s.ai]) {
      const dx = m.x - p.x;
      const dy = m.y - p.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const min = PUCK_R + MALLET_R;
      if (d >= min - 0.01) continue;
      m.x = p.x + (dx / d) * min;
      m.y = p.y + (dy / d) * min;
      p.vx *= 0.5;
      p.vy *= 0.5;
    }

    // Si el disco no se mueve de su lugar durante 3 segundos (quieto, o trabado en un rincón contra
    // una paleta), vuelve cerca del medio, del lado en que estaba
    if (!s.spot || Math.hypot(p.x - s.spot.x, p.y - s.spot.y) > 8) s.spot = { x: p.x, y: p.y, frames: 0 };
    else if (++s.spot.frames > 190) {
      s.spot = null;
      Object.assign(p, { x: TW / 2, y: TH / 2 + (p.y < TH / 2 ? -70 : 70), vx: 0, vy: 0 });
    }
  }

  async function goal(s, who) {
    s.playing = false;
    s.goals[who]++;
    s.scoreMe.textContent = String(s.goals.me);
    s.scoreRival.textContent = String(s.goals.rival);
    const mine = who === 'me';
    BQ.sport.flash(s.flash, mine ? '¡GOOOL!' : 'GOL DEL OTRO', mine ? 'goal' : 'saved');
    if (mine) {
      sfx.cheer();
      sfx.correct();
      ui().burst(s.stage);
      BQ.puppet.use(s.face.querySelector('.avatar'));
    } else sfx.aww();
    // El disco se va por el arco
    s.puck.y = mine ? -60 : TH + 60;
    const over = s.goals.me >= TO_WIN || s.goals.rival >= TO_WIN;
    await Promise.all([voice.say(mine ? '¡Gol!' : '¡Gol del otro!'), wait(over ? 1100 : 1300)]);
    if (!alive(s)) return;
    if (over) return finish(s);

    // Saca el que recibió el gol
    s.flash.hidden = true;
    Object.assign(s.puck, { x: TW / 2, y: mine ? TH / 2 - 80 : TH / 2 + 80, vx: 0, vy: 0 });
    Object.assign(s.ai, { x: TW / 2, y: 70 });
    s.spot = null;
    s.playing = true;
  }

  function finish(s) {
    const { me, rival } = s.goals;
    const won = me > rival;
    s.flash.hidden = true;
    BQ.sport.result({
      screen: s.screen,
      won,
      perfect: won && rival === 0,
      detail: h('div', { class: 'mt-final' }, `${me} - ${rival}`),
      onAgain: startGame,
      winSay: `¡Ganaste ${me} a ${rival}! ¡Te ganaste una moneda!`,
      loseSay: `¡Casi! Terminó ${me} a ${rival}. ¡Jugá otra vez!`,
      isAlive: () => alive(s),
    });
  }

  // state y advance: para revisar un partido desde la consola (advance adelanta n cuadros de golpe)
  BQ.hockey = { open, ai: AI, state: () => S, advance: (n) => { for (let i = 0; i < n && S && S.playing; i++) step(S); } };
})(window.BQ);
