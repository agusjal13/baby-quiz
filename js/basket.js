(function (BQ) {
  'use strict';

  /*
   * Básquet: 5 tiros al aro arrastrando el dedo (sin preguntas). Con 3 adentro se gana; los 5 es
   * resultado perfecto. Ganar da monedas y suma para los trofeos, como los otros juegos.
   *
   * El dedo decide dos cosas:
   *   - hacia dónde: la pelota va adonde apunta el arrastre (el aro cambia de lugar en cada tiro)
   *   - la fuerza: qué tan rápido se arrastra. Flojito queda corto; rapidísimo se pasa y pega en el
   *     tablero. En el medio hay un margen amplio para embocar.
   * Si pasa cerca, pega en el aro: a veces entra y a veces sale.
   *
   * Se dibuja en un canvas visto de frente: tablero y aro arriba, pelota abajo. La pelota vuela en
   * arco y se achica (se aleja); la parte de adelante del aro y la red se dibujan por encima de ella.
   */

  const U = BQ.util;
  const h = U.h;
  const store = BQ.store;
  const voice = BQ.voice;
  const sfx = BQ.sfx;
  const ui = () => BQ.ui;
  const wait = BQ.sport.wait;

  const SHOTS = 5;
  const TO_WIN = 3;
  // Fuerza (0 a 1,3): menos de SHORT queda corto, más de LONG se pasa; cerca de esos bordes pega en el aro
  const SHORT = 0.16;
  const LONG = 0.95;
  const EDGE = 0.08;
  const THEME = { sky1: '#ff8a50', sky2: '#ffd0a8', ground: '#bf5b17', decor: ['🏀', '⭐', '🏆', '✨', '🎉'] };

  let S = null;
  const alive = (s) => S === s && s.screen.isConnected;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function open() {
    if (!store.data.character) {
      store.data.character = 'futbolista';
      store.save();
    }
    startGame();
  }

  function startGame() {
    const canvas = h('canvas', { class: 'bk-canvas' });
    const trail = h('canvas', { class: 'bk-canvas bk-trail' });
    const hero = h('div', { class: 'bk-hero' }, BQ.puppet.el(store.data.character));
    const hand = h('span', { class: 'hand emoji bk-hand', hidden: true }, '👆');
    const flash = h('div', { class: 'sport-flash', hidden: true });
    const court = h('div', { class: 'bk-court' }, canvas, hero, trail, hand, flash);
    const score = h('div', { class: 'pen-score bk-score' }, Array.from({ length: SHOTS }, () => h('span', { class: 'pen-slot' })));

    const screen = h('div', { class: 'screen basket' },
      ui().topbar(ui().backBtn(() => { S = null; ui().showWorlds(); }), score, h('span', { class: 'spacer' })),
      court);
    ui().show(screen, THEME);

    const s = {
      screen, court, canvas, ctx: canvas.getContext('2d'), trail, tctx: trail.getContext('2d'), hero, hand, flash, score,
      shot: 0, made: 0, ready: false, flying: false, drag: null, shownHint: false,
      hoopPos: 0, ball: null, front: true, netSwing: 0, rimShake: 0,
    };
    S = s;
    resize(s);
    const ro = new ResizeObserver(() => { if (alive(s)) resize(s); else ro.disconnect(); });
    ro.observe(court);
    listen(s);
    setupShot(s);
    loop(s);

    sfx.whistle();
    voice.say('¡Embocá la pelota en el aro con el dedo!').then(() => { if (alive(s)) ready(s); });
  }

  // ---------- Pantalla ----------

  function resize(s) {
    const r = s.court.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    s.W = Math.max(1, r.width);
    s.H = Math.max(1, r.height);
    for (const c of [s.canvas, s.trail]) {
      c.width = Math.round(s.W * dpr);
      c.height = Math.round(s.H * dpr);
      c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    s.m = Math.min(s.W, s.H * 0.72); // medida base: todo se dibuja en proporción
    s.ballR = s.m * 0.09;
    s.rim = s.m * 0.136; // medio ancho del aro (lejos, pero no tan chico)
    s.hoopY = s.H * 0.25;
    s.startY = s.H * 0.84;
    if (s.ball && !s.flying) Object.assign(s.ball, home(s));
  }

  const hoopX = (s) => s.W / 2 + s.hoopPos * Math.min(s.W * 0.3, s.m * 0.55);
  const home = (s) => ({ x: s.W / 2, y: s.startY, k: 1, spin: 0, alpha: 1 });

  function draw(s) {
    const g = s.ctx;
    const { W, H, m } = s;
    const hx = hoopX(s);
    const hy = s.hoopY;
    g.clearRect(0, 0, W, H);
    // Pared del gimnasio y piso de madera
    const floorY = H * 0.62;
    g.fillStyle = '#ffe2b8';
    g.fillRect(0, 0, W, floorY);
    g.fillStyle = '#f7c98a';
    for (let x = -W; x < W * 2; x += m * 0.22) g.fillRect(x, floorY - m * 0.06, m * 0.11, m * 0.06); // zócalo
    const wood = g.createLinearGradient(0, floorY, 0, H);
    wood.addColorStop(0, '#e0a05a');
    wood.addColorStop(1, '#c97f3a');
    g.fillStyle = wood;
    g.fillRect(0, floorY, W, H - floorY);
    g.strokeStyle = 'rgba(255,255,255,.75)';
    g.lineWidth = m * 0.012;
    g.beginPath();
    g.ellipse(W / 2, floorY + (H - floorY) * 0.55, W * 0.36, (H - floorY) * 0.42, 0, Math.PI, 0); // zona
    g.stroke();

    // Poste y tablero
    const bw = m * 0.5;
    const bh = m * 0.32;
    const top = hy - bh * 0.78;
    g.fillStyle = '#78909c';
    g.fillRect(hx - m * 0.02, top + bh, m * 0.04, floorY - top - bh);
    g.fillStyle = '#fff';
    g.strokeStyle = '#37474f';
    g.lineWidth = m * 0.014;
    rounded(g, hx - bw / 2, top, bw, bh, m * 0.02);
    g.fill();
    g.stroke();
    g.strokeStyle = '#e53935';
    g.lineWidth = m * 0.012;
    g.strokeRect(hx - m * 0.089, hy - m * 0.152, m * 0.178, m * 0.122);

    // Aro: mitad de atrás, pelota (si está detrás), mitad de adelante y red
    const shake = Math.sin(performance.now() / 28) * s.rimShake * m * 0.012;
    const ry = s.rim * 0.3;
    const cy = hy + shake;
    g.strokeStyle = '#d84315';
    g.lineWidth = m * 0.017;
    g.beginPath();
    g.ellipse(hx, cy, s.rim, ry, 0, Math.PI, Math.PI * 2);
    g.stroke();
    if (!s.front) drawBall(s);
    // Red: se mueve cuando entra la pelota
    const sway = Math.sin(performance.now() / 70) * s.netSwing * m * 0.03;
    const netH = m * 0.152;
    g.strokeStyle = 'rgba(255,255,255,.95)';
    g.lineWidth = m * 0.008;
    g.beginPath();
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const x1 = hx - s.rim + t * s.rim * 2;
      const x2 = hx - s.rim * 0.55 + t * s.rim * 1.1 + sway;
      g.moveTo(x1, cy + Math.sin(t * Math.PI) * ry);
      g.lineTo(x2, cy + netH);
      if (i < 6) {
        g.moveTo(x1, cy + Math.sin(t * Math.PI) * ry);
        g.lineTo(hx - s.rim * 0.55 + (t + 1 / 6) * s.rim * 1.1 + sway, cy + netH);
      }
    }
    g.stroke();
    g.strokeStyle = '#ff5722';
    g.lineWidth = m * 0.02;
    g.beginPath();
    g.ellipse(hx, cy, s.rim, ry, 0, 0, Math.PI);
    g.stroke();
    if (s.front) drawBall(s);
  }

  function rounded(g, x, y, w, hgt, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + hgt, r);
    g.arcTo(x + w, y + hgt, x, y + hgt, r);
    g.arcTo(x, y + hgt, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawBall(s) {
    const b = s.ball;
    if (!b || b.alpha <= 0) return;
    const g = s.ctx;
    const r = s.ballR * b.k;
    g.save();
    g.globalAlpha = b.alpha;
    g.translate(b.x, b.y);
    g.rotate(b.spin);
    g.fillStyle = '#ff8f2b';
    g.strokeStyle = '#3e2109';
    g.lineWidth = Math.max(1.5, r * 0.09);
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // Gajos
    g.lineWidth = Math.max(1, r * 0.07);
    g.beginPath();
    g.moveTo(-r, 0);
    g.lineTo(r, 0);
    g.moveTo(0, -r);
    g.lineTo(0, r);
    g.moveTo(-r * 0.72, -r * 0.7);
    g.quadraticCurveTo(-r * 0.2, 0, -r * 0.72, r * 0.7);
    g.moveTo(r * 0.72, -r * 0.7);
    g.quadraticCurveTo(r * 0.2, 0, r * 0.72, r * 0.7);
    g.stroke();
    g.restore();
  }

  function loop(s) {
    if (!alive(s)) return;
    s.netSwing *= 0.95;
    s.rimShake *= 0.92;
    draw(s);
    setTimeout(() => loop(s), 16);
  }

  // ---------- Cada tiro ----------

  function setupShot(s) {
    // El aro cambia de lugar: el primero al medio y después a un costado u otro
    const spots = [-1, -0.5, 0, 0.5, 1].filter((p) => p !== s.hoopPos);
    s.hoopPos = s.shot === 0 ? 0 : U.pick(spots);
    s.ball = home(s);
    s.front = true;
    s.flash.hidden = true;
    s.tctx.clearRect(0, 0, s.W, s.H);
    [...s.score.children].forEach((sl, i) => sl.classList.toggle('now', i === s.shot));
  }

  function ready(s) {
    s.ready = true;
    if (!s.shownHint) {
      s.shownHint = true;
      showHint(s);
    }
  }

  function showHint(s) {
    stopHint(s);
    s.hand.hidden = false;
    s.hand.style.left = s.W / 2 + 'px';
    s.hand.style.top = s.startY + 'px';
    const dx = hoopX(s) - s.W / 2;
    const dy = (s.hoopY - s.startY) * 0.75;
    s.handAnim = s.hand.animate([
      { transform: 'translate(0, 0)', opacity: 0 },
      { transform: 'translate(0, 0)', opacity: 1, offset: 0.15 },
      { transform: `translate(${dx * 0.75}px, ${dy}px)`, opacity: 1, offset: 0.75 },
      { transform: `translate(${dx * 0.75}px, ${dy}px)`, opacity: 0 },
    ], { duration: 1400, iterations: 3 });
    s.handAnim.onfinish = () => stopHint(s);
  }

  function stopHint(s) {
    if (s.handAnim) s.handAnim.cancel();
    s.handAnim = null;
    s.hand.hidden = true;
  }

  // ---------- Arrastrar para tirar ----------

  function point(s, e) {
    const r = s.court.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  }

  function drawTrail(s) {
    const g = s.tctx;
    g.clearRect(0, 0, s.W, s.H);
    const pts = s.drag ? s.drag.pts : [];
    if (pts.length < 2) return;
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    pts.forEach((p) => g.lineTo(p.x, p.y));
    g.strokeStyle = 'rgba(255,255,255,.8)';
    g.lineWidth = Math.max(6, s.H * 0.018);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.stroke();
  }

  function listen(s) {
    const box = s.court;
    box.addEventListener('pointerdown', (e) => {
      if (!s.ready) return;
      e.preventDefault();
      sfx.init();
      try { box.setPointerCapture(e.pointerId); } catch (err) { /* sigue sin captura */ }
      s.drag = { id: e.pointerId, pts: [point(s, e)] };
      stopHint(s);
    });
    box.addEventListener('pointermove', (e) => {
      if (!s.drag || e.pointerId !== s.drag.id) return;
      s.drag.pts.push(point(s, e));
      drawTrail(s);
    });
    const release = (e) => {
      if (!s.drag || e.pointerId !== s.drag.id) return;
      const pts = s.drag.pts;
      s.drag = null;
      const first = pts[0];
      const end = pts[pts.length - 1];
      const dx = end.x - first.x;
      const dy = end.y - first.y;
      if (pts.length < 3 || dy > -s.H * 0.07) { // muy cortito o no fue hacia arriba
        s.tctx.clearRect(0, 0, s.W, s.H);
        voice.say('¡Arrastrá el dedo hacia el aro!');
        showHint(s);
        return;
      }
      setTimeout(() => s.tctx.clearRect(0, 0, s.W, s.H), 500);
      // Fuerza: velocidad del dedo en el último tramo, en "pantallas por segundo"
      const last = pts.find((p) => end.t - p.t <= 220) || first;
      const dt = Math.max(16, end.t - last.t);
      const speed = ((last.y - end.y) / dt) * 1000 / s.H;
      const power = clamp((speed - 0.4) / 3, 0, 1.3);
      // Puntería: adónde apunta el arrastre a la altura del aro (con una ayudita hacia el aro)
      const sx = s.W / 2 + dx * ((s.hoopY - s.startY) / dy);
      const off = (sx - hoopX(s)) * 0.7;
      shoot(s, plan(s, off, power));
    };
    box.addEventListener('pointerup', release);
    box.addEventListener('pointercancel', release);
  }

  // Qué pasa con el tiro: off = a cuánto del centro del aro va (px), power = fuerza
  function plan(s, off, power) {
    const a = Math.abs(off);
    const depth = power < SHORT ? 'short' : power > LONG ? 'long' : 'ok';
    const nearEdge = power < SHORT + EDGE || power > LONG - EDGE;
    let result;
    if (depth === 'short') result = 'short';
    else if (depth === 'long') result = 'long';
    else if (a > s.rim * 1.45) result = 'wide';
    else if (a > s.rim * 0.8 || nearEdge) {
      // Pega en el aro: entra si iba bastante bien; si no, sale
      result = a < s.rim * 1.1 && !(nearEdge && a > s.rim * 0.5) ? 'rimIn' : 'rimOut';
    } else result = 'in';
    return { off, power, result };
  }

  // Mueve la pelota hasta "to" en "ms" con un arco hacia arriba de alto "arc" (px)
  function fly(s, to, ms, arc) {
    const from = { ...s.ball };
    const start = performance.now();
    return new Promise((done) => {
      const step = () => {
        if (!alive(s)) return done();
        const t = Math.min(1, (performance.now() - start) / ms);
        const b = s.ball;
        b.x = lerp(from.x, to.x ?? from.x, t);
        b.y = lerp(from.y, to.y ?? from.y, t) - (arc || 0) * 4 * t * (1 - t);
        b.k = lerp(from.k, to.k ?? from.k, t);
        b.alpha = lerp(from.alpha, to.alpha ?? from.alpha, t);
        b.spin += 0.2;
        if (t >= 1) return done();
        setTimeout(step, 16);
      };
      step();
      setTimeout(done, ms + 500); // tope por si algo se traba
    });
  }

  async function shoot(s, { off, power, result }) {
    s.ready = false;
    s.flying = true;
    s.last = { off, power, result }; // para revisar los tiros desde la consola
    BQ.puppet.use(s.hero.querySelector('.avatar'));
    sfx.whee();

    const hx = hoopX(s);
    const hy = s.hoopY;
    const rise = s.startY - hy;
    const floor = s.H * 0.9;
    const K = 0.62; // tamaño de la pelota a la altura del aro
    const bounce = () => sfx.notes([[180, 0, 0.08, 'square', 0.1]]);

    if (result === 'short') {
      // Queda corto: cae delante del aro
      await fly(s, { x: hx + off * 0.6, y: hy + s.m * 0.34, k: 0.72 }, 900, rise * (0.25 + power));
      bounce();
      await fly(s, { y: floor, alpha: 0 }, 500, s.m * 0.1);
    } else if (result === 'long') {
      // Se pasa: pega arriba en el tablero y vuelve
      s.front = false;
      await fly(s, { x: hx + off, y: hy - s.m * 0.17, k: K }, 800, rise * 0.62);
      bounce();
      s.rimShake = 1;
      s.front = true;
      await fly(s, { x: hx + off * 1.6 + s.m * 0.1, y: floor, k: 0.85, alpha: 0 }, 800, s.m * 0.12);
    } else if (result === 'wide') {
      // Al costado: pasa por al lado del aro y cae atrás
      s.front = false;
      await fly(s, { x: hx + off, y: hy + s.m * 0.02, k: K }, 900, rise * 0.5);
      await fly(s, { y: hy + s.m * 0.4, alpha: 0 }, 450);
    } else {
      // Va al aro: llega desde arriba (la mitad de adelante del aro queda por encima de la pelota)
      const direct = result === 'in';
      const side = Math.sign(off) || 1;
      await fly(s, { x: hx + (direct ? off * 0.5 : side * s.rim * 0.85), y: hy - s.ballR * K * (direct ? 0.2 : 0.9), k: K }, 900, rise * 0.5);
      s.front = false;
      if (!direct) {
        // Pega en el aro y rebota para arriba
        bounce();
        s.rimShake = 1;
        await fly(s, { x: hx + side * s.rim * (result === 'rimIn' ? 0.25 : 1.5), y: hy - s.ballR * K * 0.4 }, 420, s.m * 0.16);
      }
      if (result === 'rimOut') {
        s.front = true;
        await fly(s, { x: hx + side * s.rim * 2.6, y: floor, k: 0.8, alpha: 0 }, 750, s.m * 0.05);
      } else {
        // Adentro: baja por la red
        s.netSwing = 1;
        sfx.noise(0.25, 'highpass', 2500, 0.25, 0.01);
        await fly(s, { x: hx, y: hy + s.m * 0.18 }, 260);
        await fly(s, { y: floor, k: 0.62, alpha: 0 }, 520);
      }
    }
    if (!alive(s)) return;
    await afterShot(s, result);
  }

  async function afterShot(s, result) {
    const slot = s.score.children[s.shot];
    slot.classList.remove('now');
    const made = result === 'in' || result === 'rimIn';
    if (made) {
      s.made++;
      slot.classList.add('goal');
      BQ.sport.flash(s.flash, '¡ADENTRO!', 'goal');
      sfx.cheer();
      sfx.correct();
      ui().burst(s.court);
      BQ.puppet.use(s.hero.querySelector('.avatar'));
    } else {
      slot.classList.add('saved');
      BQ.sport.flash(s.flash, { short: '¡CORTO!', long: '¡LARGO!', wide: '¡AFUERA!', rimOut: '¡UY, EL ARO!' }[result], 'saved');
      sfx.aww();
    }
    const say = made ? (result === 'rimIn' ? '¡Adentro, de rebote!' : '¡Adentro!')
      : { short: '¡Más fuerte!', long: '¡Más despacio!', wide: '¡Apuntá al aro!', rimOut: '¡Casi!' }[result];
    await Promise.all([voice.say(say), wait(1500)]);
    if (!alive(s)) return;

    s.shot++;
    s.flying = false;
    if (s.shot >= SHOTS) return finish(s);
    setupShot(s);
    ready(s);
  }

  function finish(s) {
    const won = s.made >= TO_WIN;
    s.flash.hidden = true;
    s.ready = false;
    BQ.sport.result({
      screen: s.screen,
      won,
      perfect: s.made === SHOTS,
      detail: h('div', { class: 'pen-final bk-score' },
        [...s.score.children].map((sl) => h('span', { class: 'pen-slot ' + (sl.classList.contains('goal') ? 'goal' : 'saved') }))),
      onAgain: startGame,
      winSay: `¡Ganaste! ¡Embocaste ${s.made}! ¡Te ganaste una moneda!`,
      loseSay: s.made === 0 ? '¡No importa! ¡Jugá otra vez, que vos podés!' : `¡Casi! Embocaste ${s.made === 1 ? 'una' : s.made}. ¡Jugá otra vez!`,
      isAlive: () => alive(s),
    });
  }

  // state y plan: para revisar los tiros desde la consola
  BQ.basket = { open, state: () => S, plan: (off, power) => plan(S, off, power) };
})(window.BQ);
