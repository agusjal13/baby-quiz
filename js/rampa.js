(function (BQ) {
  'use strict';

  /*
   * Rampa de puntos (el "skee-ball" de los arcades): se tira la pelota arrastrando el dedo hacia
   * arriba, sube por la pista, salta en la rampa y cae en un tablero lleno de huecos con puntos.
   * 5 pelotas; con 10.000 puntos o más se gana (moneda y trofeos, como los otros juegos).
   * Premios mayores: 30.000 o más da 5 monedas y 2 partidos; 50.000 (las 5 en las esquinas), 10 y 3.
   *
   * El dedo decide dos cosas:
   *   - la fuerza (qué tan rápido se arrastra): qué tan arriba cae la pelota en el tablero.
   *     Muy flojito no llega a subir la rampa (0 puntos).
   *   - la dirección: hacia qué costado va.
   * Huecos: en fila por el medio, de abajo hacia arriba, 1.000, 2.000, 3.000, 4.000 y 5.000; y en las
   * dos esquinas de arriba, 10.000. Si la pelota no cae en un hueco, rueda hasta la canaleta de abajo
   * de todo, que vale 1.000.
   *
   * Posiciones en el tablero: u de -1 (borde izquierdo) a 1 (derecho); v de 0 (abajo) a 1 (arriba).
   */

  const U = BQ.util;
  const h = U.h;
  const store = BQ.store;
  const voice = BQ.voice;
  const sfx = BQ.sfx;
  const ui = () => BQ.ui;
  const wait = BQ.sport.wait;

  const BALLS = 5;
  const TO_WIN = 10000;
  // Premios según el total (de mayor a menor): monedas y partidos para los trofeos
  const PRIZES = [
    { from: 50000, coins: 10, wins: 3, title: '¡Increíble!' },
    { from: 30000, coins: 5, wins: 2, title: '¡Campeón!' },
    { from: TO_WIN, coins: 1, wins: 1 },
  ];
  // Huecos: dónde están, qué tan grandes son (r, en medios anchos del tablero) y cuánto valen
  const HOLES = [
    { u: 0, v: 0.2, r: 0.2, points: 1000, color: '#42a5f5' },
    { u: 0, v: 0.37, r: 0.17, points: 2000, color: '#66bb6a' },
    { u: 0, v: 0.53, r: 0.16, points: 3000, color: '#ffca28' },
    { u: 0, v: 0.68, r: 0.15, points: 4000, color: '#ff8a65' },
    { u: 0, v: 0.83, r: 0.15, points: 5000, color: '#ef5350' },
    { u: -0.72, v: 0.9, r: 0.17, points: 10000, color: '#ab47bc' },
    { u: 0.72, v: 0.9, r: 0.17, points: 10000, color: '#ab47bc' },
  ];
  const GUTTER = 1000; // la canaleta de abajo: lo que vale no embocar ningún hueco
  const WEAK = 0.1; // con menos fuerza que esto, la pelota no sube la rampa
  const THEME = { sky1: '#1a237e', sky2: '#5c6bc0', ground: '#0d1452', decor: ['⭐', '🎟️', '✨', '🎉', '🏆'] };

  let S = null;
  const alive = (s) => S === s && s.screen.isConnected;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmt = (n) => n.toLocaleString('es-AR');

  function open() {
    if (!store.data.character) {
      store.data.character = 'futbolista';
      store.save();
    }
    startGame();
  }

  function startGame() {
    const canvas = h('canvas', { class: 'rp-canvas' });
    const trail = h('canvas', { class: 'rp-canvas rp-trail' });
    const hero = h('div', { class: 'rp-hero' }, BQ.puppet.el(store.data.character));
    const hand = h('span', { class: 'hand emoji rp-hand', hidden: true }, '👆');
    const flash = h('div', { class: 'sport-flash', hidden: true });
    const court = h('div', { class: 'rp-court' }, canvas, hero, trail, hand, flash);
    const total = h('span', { class: 'rp-total' }, '0');
    const left = h('div', { class: 'rp-balls' }, Array.from({ length: BALLS }, () => h('span', { class: 'rp-ball' })));

    const screen = h('div', { class: 'screen rampa' },
      ui().topbar(ui().backBtn(() => { S = null; ui().showWorlds(); }),
        h('div', { class: 'rp-top' }, h('span', { class: 'rp-total-box' }, h('span', { class: 'emoji' }, '⭐'), total), left),
        h('span', { class: 'spacer' })),
      court);
    ui().show(screen, THEME);

    const s = {
      screen, court, canvas, ctx: canvas.getContext('2d'), trail, tctx: trail.getContext('2d'), hero, hand, flash, total, left,
      thrown: 0, score: 0, ready: false, flying: false, drag: null, shownHint: false, ball: null, lit: null, onBoard: false,
    };
    S = s;
    resize(s);
    const ro = new ResizeObserver(() => { if (alive(s)) resize(s); else ro.disconnect(); });
    ro.observe(court);
    listen(s);
    s.ball = home(s);
    loop(s);

    sfx.whistle();
    voice.say(`¡Tirá la pelota! Sumá ${fmt(TO_WIN)} puntos.`).then(() => { if (alive(s)) ready(s); });
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
    // Tablero arriba (más angosto arriba: está inclinado hacia atrás) y pista abajo
    s.bw = Math.min(s.W * 0.86, s.H * 0.62); // ancho del tablero abajo
    s.bTop = s.H * 0.05;
    s.bBottom = s.H * 0.5;
    s.startY = s.H * 0.87;
    s.ballR = s.bw * 0.075;
    if (s.ball && !s.flying) Object.assign(s.ball, home(s));
  }

  const home = (s) => ({ x: s.W / 2, y: s.startY, k: 1, spin: 0, alpha: 1 });

  // Punto del tablero (u, v) en la pantalla; "w" es el medio ancho del tablero a esa altura
  function boardPoint(s, u, v) {
    const w = (s.bw / 2) * lerp(1, 0.84, v);
    return { x: s.W / 2 + u * w, y: lerp(s.bBottom, s.bTop, v), w };
  }

  function draw(s) {
    const g = s.ctx;
    const { W, H } = s;
    const cx = W / 2;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#283593';
    g.fillRect(0, 0, W, H);

    // Pista: tabla de madera que se angosta hacia la rampa
    const lw0 = s.bw * 0.5; // medio ancho abajo
    const lw1 = s.bw * 0.36; // medio ancho en la rampa
    const rampY = s.bBottom + H * 0.045;
    const wood = g.createLinearGradient(0, rampY, 0, H);
    wood.addColorStop(0, '#b9783f');
    wood.addColorStop(1, '#e0a565');
    g.fillStyle = wood;
    g.beginPath();
    g.moveTo(cx - lw1, rampY);
    g.lineTo(cx + lw1, rampY);
    g.lineTo(cx + lw0, H);
    g.lineTo(cx - lw0, H);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.12)';
    g.lineWidth = 2;
    for (const t of [-0.5, 0, 0.5]) {
      g.beginPath();
      g.moveTo(cx + t * lw1, rampY);
      g.lineTo(cx + t * lw0, H);
      g.stroke();
    }
    // Rampa: el lomo donde salta la pelota
    g.fillStyle = '#8d5524';
    g.beginPath();
    g.ellipse(cx, rampY, lw1 * 1.02, H * 0.02, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffd54f';
    g.beginPath();
    g.ellipse(cx, rampY - H * 0.006, lw1 * 0.96, H * 0.012, 0, Math.PI, 0);
    g.fill();

    // Tablero de huecos
    const b0 = boardPoint(s, 0, 0);
    const b1 = boardPoint(s, 0, 1);
    g.fillStyle = '#0d1452';
    g.strokeStyle = '#ffd54f';
    g.lineWidth = Math.max(3, s.bw * 0.018);
    g.beginPath();
    g.moveTo(cx - b0.w * 1.04, b0.y);
    g.lineTo(cx + b0.w * 1.04, b0.y);
    g.lineTo(cx + b1.w * 1.04, b1.y);
    g.lineTo(cx - b1.w * 1.04, b1.y);
    g.closePath();
    g.fill();
    g.stroke();
    // Canaleta de abajo (vale lo mínimo)
    g.fillStyle = '#060a33';
    g.fillRect(cx - b0.w * 0.98, b0.y - H * 0.03, b0.w * 1.96, H * 0.024);
    g.fillStyle = 'rgba(255,255,255,.75)';
    g.font = `900 ${Math.max(9, s.bw * 0.04)}px Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(fmt(GUTTER), cx - b0.w * 0.72, b0.y - H * 0.018);
    g.fillText(fmt(GUTTER), cx + b0.w * 0.72, b0.y - H * 0.018);

    for (const hole of HOLES) {
      const p = boardPoint(s, hole.u, hole.v);
      const r = hole.r * p.w;
      const lit = s.lit === hole;
      // Aro de color que rodea el hueco, y el hueco
      g.fillStyle = lit ? '#fff59d' : hole.color;
      g.beginPath();
      g.ellipse(p.x, p.y, r, r * 0.86, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#05072a';
      g.beginPath();
      g.ellipse(p.x, p.y, r * 0.7, r * 0.6, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = lit ? '#fff59d' : '#fff';
      g.font = `900 ${Math.max(9, r * (hole.points >= 10000 ? 0.42 : 0.5))}px Arial, sans-serif`;
      g.fillText(fmt(hole.points), p.x, p.y);
    }
    drawBall(s);
  }

  function drawBall(s) {
    const b = s.ball;
    if (!b || b.alpha <= 0) return;
    const g = s.ctx;
    const r = s.ballR * b.k;
    g.save();
    g.globalAlpha = b.alpha;
    g.fillStyle = 'rgba(0,0,0,.25)';
    g.beginPath();
    g.ellipse(b.x + r * 0.15, b.y + r * (0.9 + (b.lift || 0)), r * 0.9, r * 0.3, 0, 0, Math.PI * 2);
    g.fill();
    g.translate(b.x, b.y);
    g.rotate(b.spin);
    const grad = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    grad.addColorStop(0, '#fff3e0');
    grad.addColorStop(1, '#d7a86e');
    g.fillStyle = grad;
    g.strokeStyle = '#6d4c2f';
    g.lineWidth = Math.max(1.5, r * 0.09);
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.strokeStyle = 'rgba(109,76,47,.55)';
    g.beginPath();
    g.arc(0, 0, r * 0.55, 0.3, 2.2);
    g.stroke();
    g.restore();
  }

  function loop(s) {
    if (!alive(s)) return;
    draw(s);
    setTimeout(() => loop(s), 16);
  }

  // ---------- Cada pelota ----------

  function ready(s) {
    s.ball = home(s);
    s.lit = null;
    s.flash.hidden = true;
    s.ready = true;
    [...s.left.children].forEach((b, i) => b.classList.toggle('used', i < s.thrown));
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
    const up = -(s.startY - s.bBottom) * 0.8;
    s.handAnim = s.hand.animate([
      { transform: 'translate(0, 0)', opacity: 0 },
      { transform: 'translate(0, 0)', opacity: 1, offset: 0.2 },
      { transform: `translate(0, ${up}px)`, opacity: 1, offset: 0.75 },
      { transform: `translate(0, ${up}px)`, opacity: 0 },
    ], { duration: 1300, iterations: 3 });
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
      if (pts.length < 3 || dy > -s.H * 0.06) { // muy cortito o no fue hacia arriba
        s.tctx.clearRect(0, 0, s.W, s.H);
        voice.say('¡Arrastrá el dedo hacia arriba!');
        showHint(s);
        return;
      }
      setTimeout(() => s.tctx.clearRect(0, 0, s.W, s.H), 500);
      // Fuerza: velocidad del dedo en el último tramo, en "pantallas por segundo"
      const last = pts.find((p) => end.t - p.t <= 220) || first;
      const dt = Math.max(16, end.t - last.t);
      const speed = ((last.y - end.y) / dt) * 1000 / s.H;
      const power = clamp((speed - 0.35) / 3, 0, 1.2);
      // Dirección: cuánto se va de costado (1 = hasta el borde del tablero)
      // (con una ayudita: hay que desviarse bastante para irse del medio)
      const side = clamp((dx / -dy) * 1.7, -1.1, 1.1);
      shoot(s, plan(side, power));
    };
    box.addEventListener('pointerup', release);
    box.addEventListener('pointercancel', release);
  }

  // Dónde cae y qué hueco emboca: side = costado (-1 a 1), power = fuerza (0 a 1,2)
  function plan(side, power) {
    if (power < WEAK) return { weak: true, u: side * 0.5, v: 0, hole: null, points: 0 };
    // Más fuerza, más arriba: con fuerza "normal" cae por el medio del tablero
    const v = clamp(0.12 + (power - WEAK) * 0.95, 0.08, 0.99);
    const u = clamp(side, -0.95, 0.95);
    // Emboca el hueco más cercano si cae dentro de su aro
    let best = null;
    for (const hole of HOLES) {
      // (distancias en medios anchos; el tablero es más alto que ancho: v pesa un poco más)
      const d = Math.hypot(u - hole.u, (v - hole.v) * 1.15);
      if (d <= hole.r && (!best || d < best.d)) best = { hole, d };
    }
    return { weak: false, u, v, hole: best ? best.hole : null, points: best ? best.hole.points : GUTTER };
  }

  // Mueve la pelota hasta "to" en "ms" con un salto de alto "arc" (px)
  function fly(s, to, ms, arc) {
    const from = { ...s.ball };
    const start = performance.now();
    return new Promise((done) => {
      const step = () => {
        if (!alive(s)) return done();
        const t = Math.min(1, (performance.now() - start) / ms);
        const b = s.ball;
        const up = (arc || 0) * 4 * t * (1 - t);
        b.x = lerp(from.x, to.x ?? from.x, t);
        b.y = lerp(from.y, to.y ?? from.y, t) - up;
        b.lift = up / (s.ballR * b.k || 1); // la sombra se separa cuando salta
        b.k = lerp(from.k, to.k ?? from.k, t);
        b.alpha = lerp(from.alpha, to.alpha ?? from.alpha, t);
        b.spin += 0.25;
        if (t >= 1) return done();
        setTimeout(step, 16);
      };
      step();
      setTimeout(done, ms + 500); // tope por si algo se traba
    });
  }

  async function shoot(s, shot) {
    s.ready = false;
    s.flying = true;
    s.last = shot; // para revisar los tiros desde la consola
    s.thrown++;
    [...s.left.children].forEach((b, i) => b.classList.toggle('used', i < s.thrown));
    BQ.puppet.use(s.hero.querySelector('.avatar'));
    sfx.notes([[160, 0, 0.5, 'sawtooth', 0.04]]); // la pelota rodando

    const rampY = s.bBottom + s.H * 0.045;
    const rampX = s.W / 2 + shot.u * s.bw * 0.2;
    if (shot.weak) {
      // No llega a subir la rampa: vuelve rodando
      await fly(s, { x: rampX, y: rampY + s.H * 0.08, k: 0.75 }, 900);
      await fly(s, { x: s.W / 2 + shot.u * s.bw * 0.3, y: s.H * 1.05, k: 1, alpha: 0 }, 900);
    } else {
      // Sube por la pista, salta en la rampa y cae en el tablero
      await fly(s, { x: rampX, y: rampY, k: 0.7 }, 520);
      sfx.whee();
      const land = boardPoint(s, shot.u, shot.v);
      await fly(s, { x: land.x, y: land.y, k: 0.6 }, 420 + shot.v * 260, s.H * (0.06 + shot.v * 0.1));
      sfx.notes([[200, 0, 0.07, 'square', 0.1]]);
      if (shot.hole) {
        // Cae en el hueco
        const p = boardPoint(s, shot.hole.u, shot.hole.v);
        s.lit = shot.hole;
        await fly(s, { x: p.x, y: p.y, k: 0.5 }, 220);
        await fly(s, { k: 0.2, alpha: 0 }, 260);
      } else {
        // No embocó: rueda tablero abajo hasta la canaleta
        const low = boardPoint(s, shot.u * 0.9, 0.03);
        await fly(s, { x: low.x, y: low.y, k: 0.66 }, 500 + shot.v * 500);
        await fly(s, { k: 0.3, alpha: 0 }, 220);
      }
    }
    if (!alive(s)) return;
    await afterShot(s, shot);
  }

  async function afterShot(s, shot) {
    s.score += shot.points;
    s.total.textContent = fmt(s.score);
    s.total.parentElement.classList.remove('bump');
    void s.total.offsetWidth;
    if (shot.points) s.total.parentElement.classList.add('bump');
    const big = shot.points >= 5000;
    BQ.sport.flash(s.flash, shot.points ? '+' + fmt(shot.points) : '¡UY!', shot.points >= 3000 ? 'goal' : 'saved');
    if (big) {
      sfx.cheer();
      sfx.win();
      ui().burst(s.court);
    } else if (shot.points) sfx.coin();
    else sfx.aww();
    const say = shot.weak ? '¡Más fuerte!'
      : shot.points >= 10000 ? '¡Diez mil! ¡Increíble!'
        : `¡${shot.points}!`;
    await Promise.all([voice.say(say), wait(1300)]);
    if (!alive(s)) return;

    s.flying = false;
    if (s.thrown >= BALLS) return finish(s);
    ready(s);
  }

  function finish(s) {
    const prize = PRIZES.find((p) => s.score >= p.from) || null;
    const won = !!prize;
    s.flash.hidden = true;
    s.ready = false;
    BQ.sport.result({
      screen: s.screen,
      won,
      coins: prize ? prize.coins : 0,
      wins: prize ? prize.wins : 0,
      title: prize ? prize.title : undefined,
      detail: h('div', { class: 'mt-final' }, h('span', { class: 'emoji' }, '⭐'), ' ' + fmt(s.score)),
      onAgain: startGame,
      winSay: !prize || prize.coins === 1 ? `¡Ganaste! ¡Hiciste ${s.score} puntos! ¡Te ganaste una moneda!`
        : `¡Hiciste ${s.score} puntos! ¡Premio grande: te ganaste ${prize.coins} monedas!`,
      loseSay: `¡Casi! Hiciste ${s.score} puntos y necesitás ${TO_WIN}. ¡Jugá otra vez!`,
      isAlive: () => alive(s),
    });
  }

  // state y plan: para revisar los tiros desde la consola
  BQ.rampa = { open, state: () => S, plan, holes: HOLES, prizes: PRIZES, finish: () => finish(S) };
})(window.BQ);
