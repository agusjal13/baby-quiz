(function (BQ) {
  'use strict';

  /*
   * Rampa de puntos (el "skee-ball" de los arcades): se tira la pelota arrastrando el dedo hacia
   * arriba, rueda por la pista, salta en la rampa y cae en un tablero inclinado lleno de canastas.
   * 5 pelotas; con 10.000 puntos o más se gana (moneda y trofeos, como los otros juegos).
   * Premios mayores: 30.000 o más da 5 monedas y 2 partidos; 50.000 (las 5 en las esquinas), 10 y 3.
   *
   * El dedo decide dos cosas:
   *   - la fuerza (qué tan rápido se arrastra): qué tan arriba cae la pelota en el tablero.
   *     Muy flojito no sube la rampa (0 puntos); demasiado fuerte pega en el fondo y va a la canaleta.
   *   - la dirección: hacia qué costado va.
   * El tablero es como el de las máquinas clásicas: abajo, tres aros uno adentro del otro (el
   * grande vale 1.000, el del medio 2.000 y la copita de adentro 3.000); arriba de ellos, las copitas
   * de 4.000 y 5.000; y en las dos esquinas de arriba, las de 10.000. La pelota vale lo del aro más
   * chico en el que cae. Si cae arriba de todo y fuera de las copitas, rueda tablero abajo: entra en
   * la copita que tenga debajo o, si no, rodea el aro grande hasta la canaleta (1.000).
   *
   * Todo se dibuja en 3D con perspectiva, visto desde atrás de la pelota (como el bowling); la
   * cámara acompaña a la pelota y termina cerca del tablero.
   * Medidas en "anchos de pista": x de costado (0 = medio), alt = altura, z = profundidad (la
   * pelota sale de z = 0 y la pista termina en LANE). En el tablero se usan (a, b): a = de costado,
   * b = distancia subiendo por el tablero desde su borde de abajo.
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

  // --- La máquina ---
  const LANE = 6; // largo de la pista
  const RAMP = 0.75; // largo del lomo final
  const RAMP_H = 0.24; // alto del lomo
  const RAIL = 0.13; // alto de las barandas
  const BALL_R = 0.11;
  const BOARD_W = 0.68; // medio ancho del tablero
  const BOARD_H = 2.05; // largo del tablero (subiendo)
  const TILT = (52 * Math.PI) / 180; // inclinación del tablero
  const SIN = Math.sin(TILT);
  const COS = Math.cos(TILT);
  const BOARD_Z = LANE + 0.42; // dónde arranca el tablero
  const BOARD_ALT = 0.1;
  const LIP = 0.085; // alto del borde de las canastas
  const CAGE = 0.6; // alto de la jaula de los costados

  // Copitas (se emboca adentro): posición en el tablero (a, b), radio y puntos
  const HOLES = [
    { a: 0, b: 0.78, r: 0.15, points: 3000, color: '#ffca28', dark: '#b88600' },
    { a: 0, b: 1.45, r: 0.15, points: 4000, color: '#ff8a50', dark: '#b84e1c' },
    { a: 0, b: 1.81, r: 0.135, points: 5000, color: '#ef5350', dark: '#a02725' },
    { a: -0.5, b: 1.8, r: 0.13, points: 10000, color: '#ce6bdc', dark: '#7b2a88' },
    { a: 0.5, b: 1.8, r: 0.13, points: 10000, color: '#ce6bdc', dark: '#7b2a88' },
  ];
  // Aros grandes (paredes): lo que cae adentro rueda hasta su agujero ("drain"), abajo
  const RINGS = [
    { a: 0, b: 0.66, r: 0.6, points: 1000, color: '#29b6f6', dark: '#0b6fa3', drain: { a: 0, b: 0.2, r: 0.08 } },
    { a: 0, b: 0.7, r: 0.41, points: 2000, color: '#66bb6a', dark: '#2a7a30', drain: { a: 0, b: 0.42, r: 0.07 } },
  ];
  const WALL = 0.05; // grosor de la pared de los aros
  const GUTTER = 1000; // la canaleta de abajo: lo que vale no embocar ninguna canasta
  const WEAK = 0.1; // con menos fuerza que esto, la pelota no sube la rampa
  const TOO_STRONG = 1.04; // con más que esto, pega en el fondo
  const THEME = { sky1: '#1a0f3c', sky2: '#4a2a8a', ground: '#12082b', decor: ['⭐', '🎟️', '✨', '🎉', '🏆'] };

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
      thrown: 0, score: 0, ready: false, flying: false, drag: null, shownHint: false,
      ball: homeBall(), cam: 0, camTarget: 0, lit: null, sink: null, inside: null,
    };
    S = s;
    resize(s);
    const ro = new ResizeObserver(() => { if (alive(s)) resize(s); else ro.disconnect(); });
    ro.observe(court);
    listen(s);
    loop(s);

    sfx.whistle();
    voice.say(`¡Tirá la pelota! Sumá ${fmt(TO_WIN)} puntos.`).then(() => { if (alive(s)) ready(s); });
  }

  const homeBall = () => ({ x: 0, alt: BALL_R, z: 0, k: 1, spin: 0, alpha: 1, ground: 0 });

  // ---------- Cámara y perspectiva ----------

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
    // Lente: la pelota queda abajo al empezar, y el tablero entra a lo ancho cuando la cámara se acerca
    s.F = Math.min(s.H * 0.9, s.W * 1.55);
    s.horizon = s.H * 0.3;
  }

  // La cámara va de lejos (0: detrás de la pelota) a cerca (1: frente al tablero)
  function camera(s) {
    const e = s.cam * s.cam * (3 - 2 * s.cam); // suave al arrancar y al frenar
    return { z: lerp(-2.25, LANE - 2.35, e), h: lerp(1.3, 1.8, e) };
  }

  function proj(s, x, alt, z) {
    const c = s.camNow;
    const dz = Math.max(0.32, z - c.z); // lo que queda detrás de la cámara se aplasta en el borde
    const k = s.F / dz;
    return { x: s.W / 2 + x * k, y: s.horizon + (c.h - alt) * k, k };
  }

  // Punto del tablero (a, b), levantado "lift" hacia afuera, en el mundo
  const board = (a, b, lift = 0) => ({ x: a, alt: BOARD_ALT + b * SIN + lift * COS, z: BOARD_Z + b * COS - lift * SIN });
  const projBoard = (s, a, b, lift) => { const p = board(a, b, lift); return proj(s, p.x, p.alt, p.z); };

  function poly(s, pts, fill, stroke, width) {
    const g = s.ctx;
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath();
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = width || 1;
      g.lineJoin = 'round';
      g.stroke();
    }
  }

  // ---------- Dibujo ----------

  function draw(s) {
    const g = s.ctx;
    const { W, H } = s;
    s.camNow = camera(s);
    const near = s.camNow.z + 0.34;
    g.clearRect(0, 0, W, H);

    // Salón de juegos: pared oscura con luces desenfocadas
    const wall = g.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, '#1b0f3d');
    wall.addColorStop(0.55, '#3b1f7a');
    wall.addColorStop(1, '#150a30');
    g.fillStyle = wall;
    g.fillRect(0, 0, W, H);
    const lights = ['#ff5a8a', '#ffd23f', '#4dd0e1', '#b388ff', '#69f0ae'];
    for (let i = 0; i < 16; i++) {
      g.fillStyle = lights[i % lights.length];
      g.globalAlpha = 0.16 + 0.1 * Math.sin(performance.now() / 500 + i * 1.7);
      g.beginPath();
      g.arc((((i * 137) % 100) / 100) * W, (((i * 53) % 34) / 100) * H, Math.max(6, H * (0.012 + (i % 4) * 0.008)), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    drawLane(s, near);
    drawBoard(s);
    // De atrás para adelante: copitas de arriba; después los aros (mitad del fondo), la copita del
    // medio y las mitades de adelante de los aros, que tapan lo que tienen adentro
    const [big, mid] = RINGS;
    HOLES.filter((hole) => hole.b > 1).sort((p, q) => q.b - p.b).forEach((hole) => drawCup(s, hole, 'all'));
    drawRing(s, big, 'back');
    drawRing(s, mid, 'back');
    drawCup(s, HOLES[0], 'all');
    drawRing(s, mid, 'front');
    drawRing(s, big, 'front');
    drawCage(s);
    drawBall(s);
    // La pelota queda tapada por el borde de adelante de la copita donde cae, y por la pared de
    // adelante de los aros cuando rueda adentro
    if (s.sink) drawCup(s, s.sink, 'front');
    if (s.inside) {
      if (s.inside.includes(mid)) drawRing(s, mid, 'front');
      if (s.inside.includes(big)) drawRing(s, big, 'front');
    }
  }

  // Altura del lomo de la rampa en z (0 antes de que empiece)
  const rampAt = (z) => {
    const t = clamp((z - (LANE - RAMP)) / RAMP, 0, 1);
    return RAMP_H * t * t * (3 - 2 * t);
  };

  function drawLane(s, near) {
    const g = s.ctx;
    const z0 = Math.max(-1.6, near);
    const zR = LANE - RAMP;
    // Costados de la máquina (por fuera de las barandas)
    for (const sd of [-1, 1]) {
      poly(s, [proj(s, sd * 0.62, RAIL, z0), proj(s, sd * 0.62, RAIL + RAMP_H, LANE), proj(s, sd * 0.62, -0.9, LANE), proj(s, sd * 0.62, -0.9, z0)], '#2a1660');
    }
    // Tabla de madera
    const a = proj(s, -0.5, 0, z0);
    const b = proj(s, 0.5, 0, z0);
    const c = proj(s, 0.5, 0, zR);
    const d = proj(s, -0.5, 0, zR);
    const wood = g.createLinearGradient(0, d.y, 0, a.y);
    wood.addColorStop(0, '#a8672f');
    wood.addColorStop(1, '#e6b06e');
    poly(s, [a, b, c, d], wood);
    g.strokeStyle = 'rgba(80,40,10,.22)';
    for (const x of [-0.25, 0, 0.25]) {
      const p = proj(s, x, 0, z0);
      const q = proj(s, x, 0, zR);
      g.lineWidth = Math.max(1, q.k * 0.012);
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(q.x, q.y);
      g.stroke();
    }
    // Brillo de la pista encerada
    poly(s, [proj(s, -0.1, 0, z0), proj(s, 0.12, 0, z0), proj(s, 0.06, 0, zR), proj(s, -0.05, 0, zR)], 'rgba(255,255,255,.1)');

    // Lomo de la rampa: sube en curva; cada tramo un poco más claro (le da la luz)
    const N = 7;
    for (let i = 0; i < N; i++) {
      const zA = zR + (i / N) * RAMP;
      const zB = zR + ((i + 1) / N) * RAMP;
      const v = 150 + i * 13;
      poly(s, [proj(s, -0.5, rampAt(zA), zA), proj(s, 0.5, rampAt(zA), zA), proj(s, 0.5, rampAt(zB), zB), proj(s, -0.5, rampAt(zB), zB)],
        `rgb(${Math.min(255, v + 62)}, ${Math.round(v * 0.8 + 28)}, ${Math.round(v * 0.42)})`);
    }
    // Filo de la rampa: franja amarilla
    poly(s, [proj(s, -0.5, rampAt(LANE - 0.07), LANE - 0.07), proj(s, 0.5, rampAt(LANE - 0.07), LANE - 0.07), proj(s, 0.5, RAMP_H, LANE), proj(s, -0.5, RAMP_H, LANE)], '#ffd54f');

    // Barandas con relieve: cara de adentro (oscura) y cara de arriba (clara)
    const zs = [z0, zR, zR + RAMP * 0.35, zR + RAMP * 0.7, LANE];
    for (const sd of [-1, 1]) {
      for (let i = 0; i < zs.length - 1; i++) {
        const zA = zs[i];
        const zB = zs[i + 1];
        poly(s, [proj(s, sd * 0.5, rampAt(zA), zA), proj(s, sd * 0.5, rampAt(zB), zB), proj(s, sd * 0.5, rampAt(zB) + RAIL, zB), proj(s, sd * 0.5, rampAt(zA) + RAIL, zA)], '#5b3a9e');
        poly(s, [proj(s, sd * 0.5, rampAt(zA) + RAIL, zA), proj(s, sd * 0.5, rampAt(zB) + RAIL, zB), proj(s, sd * 0.62, rampAt(zB) + RAIL, zB), proj(s, sd * 0.62, rampAt(zA) + RAIL, zA)], '#9f84dd');
      }
    }
  }

  function drawBoard(s) {
    const g = s.ctx;
    // Hueco entre la rampa y el tablero, y canaleta donde caen las que no embocan
    poly(s, [proj(s, -0.62, RAMP_H, LANE), proj(s, 0.62, RAMP_H, LANE), projBoard(s, BOARD_W, -0.3), projBoard(s, -BOARD_W, -0.3)], '#0a0520');
    poly(s, [projBoard(s, -BOARD_W, -0.3), projBoard(s, BOARD_W, -0.3), projBoard(s, BOARD_W, 0.02), projBoard(s, -BOARD_W, 0.02)], '#12082b');

    // Tablero inclinado: paño azul con marco dorado
    const p0 = projBoard(s, -BOARD_W, 0);
    const p1 = projBoard(s, BOARD_W, 0);
    const p2 = projBoard(s, BOARD_W, BOARD_H);
    const p3 = projBoard(s, -BOARD_W, BOARD_H);
    const felt = g.createLinearGradient(0, p3.y, 0, p0.y);
    felt.addColorStop(0, '#16307e');
    felt.addColorStop(1, '#2a4fc4');
    poly(s, [p0, p1, p2, p3], felt, '#ffd54f', Math.max(2, p0.k * 0.035));
    // Lo que vale la canaleta
    const lab = projBoard(s, 0, -0.14);
    g.fillStyle = 'rgba(255,255,255,.8)';
    g.font = `900 ${Math.max(8, lab.k * 0.13)}px Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(fmt(GUTTER), projBoard(s, -BOARD_W * 0.6, -0.14).x, lab.y);
    g.fillText(fmt(GUTTER), projBoard(s, BOARD_W * 0.6, -0.14).x, lab.y);

    // Fondo de la máquina (detrás del tablero) y cartel con luces
    const t0 = projBoard(s, -BOARD_W, BOARD_H);
    const t1 = projBoard(s, BOARD_W, BOARD_H);
    const t2 = projBoard(s, BOARD_W, BOARD_H, CAGE);
    const t3 = projBoard(s, -BOARD_W, BOARD_H, CAGE);
    poly(s, [t0, t1, t2, t3], '#24124f', '#ffd54f', Math.max(2, t0.k * 0.03));
    const signH = t0.k * 0.42;
    const sx = t3.x;
    const sw = t2.x - t3.x;
    const sy = Math.min(t2.y, t3.y) - signH;
    g.fillStyle = '#d81b60';
    g.fillRect(sx, sy, sw, signH);
    g.strokeStyle = '#ffd54f';
    g.lineWidth = Math.max(2, t0.k * 0.025);
    g.strokeRect(sx, sy, sw, signH);
    g.fillStyle = '#fff';
    g.font = `900 ${signH * 0.5}px Arial, sans-serif`;
    g.fillText('★ RAMPA ★', sx + sw / 2, sy + signH * 0.54);
    const now = performance.now();
    for (let i = 0; i <= 10; i++) {
      g.fillStyle = (Math.floor(now / 260) + i) % 2 ? '#fff59d' : '#ff8a65';
      g.beginPath();
      g.arc(sx + (sw * i) / 10, sy, Math.max(2, signH * 0.09), 0, Math.PI * 2);
      g.fill();
    }
  }

  // Jaula de red a los costados del tablero
  function drawCage(s) {
    const g = s.ctx;
    for (const sd of [-1, 1]) {
      const a = projBoard(s, sd * BOARD_W, 0);
      const b = projBoard(s, sd * BOARD_W, BOARD_H);
      const c = projBoard(s, sd * BOARD_W, BOARD_H, CAGE);
      const d = projBoard(s, sd * BOARD_W, 0, CAGE);
      poly(s, [a, b, c, d], 'rgba(255,255,255,.07)', 'rgba(255,213,79,.9)', Math.max(1.5, a.k * 0.02));
      g.strokeStyle = 'rgba(255,255,255,.22)';
      g.lineWidth = 1;
      g.beginPath();
      for (let i = 1; i < 8; i++) {
        const p = projBoard(s, sd * BOARD_W, (BOARD_H * i) / 8);
        const q = projBoard(s, sd * BOARD_W, (BOARD_H * i) / 8, CAGE);
        g.moveTo(p.x, p.y);
        g.lineTo(q.x, q.y);
      }
      for (let i = 1; i < 3; i++) {
        const p = projBoard(s, sd * BOARD_W, 0, (CAGE * i) / 3);
        const q = projBoard(s, sd * BOARD_W, BOARD_H, (CAGE * i) / 3);
        g.moveTo(p.x, p.y);
        g.lineTo(q.x, q.y);
      }
      g.stroke();
    }
  }

  /*
   * Una canasta: un aro levantado del tablero. Se dibuja la pared de afuera, el hueco con su pared
   * de adentro (se ve la del fondo: da la profundidad) y el borde de arriba con brillo.
   * part = 'front' dibuja solo la mitad de adelante (para tapar la pelota que cae adentro).
   */
  function drawCup(s, hole, part) {
    const g = s.ctx;
    const N = 30;
    const ring = (r, lift) => Array.from({ length: N }, (_, i) => {
      const t = (i / N) * Math.PI * 2;
      return projBoard(s, hole.a + Math.cos(t) * r, hole.b + Math.sin(t) * r, lift);
    });
    const rIn = hole.r * 0.74;
    const outerBase = ring(hole.r, 0);
    const outerTop = ring(hole.r, LIP);
    const innerTop = ring(rIn, LIP);
    const lit = s.lit === hole;
    const top = lit ? '#fff59d' : hole.color;
    // La mitad de adelante (la más cercana) es la de b más chico: del punto N/2 al N
    const from = part === 'front' ? N / 2 : 0;

    if (part === 'all') {
      // Sombra de la canasta sobre el paño
      poly(s, ring(hole.r * 1.08, 0).map((p) => ({ x: p.x + p.k * 0.02, y: p.y + p.k * 0.035 })), 'rgba(0,0,0,.3)');
    }
    // Pared de afuera, entre el aro de abajo y el de arriba
    for (let i = from; i < N; i++) {
      const j = (i + 1) % N;
      poly(s, [outerBase[i], outerBase[j], outerTop[j], outerTop[i]], hole.dark, hole.dark, 0.6);
    }
    if (part === 'all') {
      // Hueco: la pared de adentro (se ve la del fondo) y, más abajo, el fondo negro
      g.save();
      g.beginPath();
      innerTop.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.closePath();
      g.clip();
      const c = projBoard(s, hole.a, hole.b, LIP);
      const R = hole.r * c.k;
      const inside = g.createLinearGradient(0, c.y - R, 0, c.y + R);
      inside.addColorStop(0, hole.dark);
      inside.addColorStop(0.7, '#000');
      g.fillStyle = inside;
      g.fillRect(c.x - R * 1.5, c.y - R * 1.5, R * 3, R * 3);
      poly(s, ring(rIn, -0.07), '#04030f');
      g.restore();
    }
    // Borde de arriba: corona entre el aro de afuera y el de adentro
    for (let i = from; i < N; i++) {
      const j = (i + 1) % N;
      poly(s, [outerTop[i], outerTop[j], innerTop[j], innerTop[i]], top, top, 0.6);
    }
    if (part !== 'all') return;
    // Brillo en el borde, del lado del fondo
    g.strokeStyle = 'rgba(255,255,255,.8)';
    g.lineWidth = Math.max(1, outerTop[0].k * 0.013);
    g.lineCap = 'round';
    g.beginPath();
    for (let i = 3; i <= N / 2 - 3; i++) {
      const t = (i / N) * Math.PI * 2;
      const p = projBoard(s, hole.a + Math.cos(t) * hole.r * 0.88, hole.b + Math.sin(t) * hole.r * 0.88, LIP);
      if (i === 3) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
    }
    g.stroke();
    // Los puntos, pintados en el paño: debajo de la copita, o al costado en las dos de arriba
    const corner = hole.a !== 0;
    const lp = corner || hole === HOLES[0] ? projBoard(s, hole.a, hole.b - hole.r - 0.085)
      : projBoard(s, hole.r + 0.14, hole.b - 0.02);
    g.fillStyle = lit ? '#fff59d' : '#fff';
    g.font = `900 ${Math.max(8, lp.k * 0.088)}px Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(fmt(hole.points), lp.x, lp.y);
  }

  /*
   * Un aro grande: una pared redonda levantada del tablero, abierta adentro. Se dibuja en dos
   * mitades para que tape bien: 'back' (la del fondo: se le ve la cara de adentro) y 'front' (la
   * de adelante: se le ve la cara de afuera). Con 'back' van también su agujero y sus puntos.
   */
  function drawRing(s, ring, part) {
    const g = s.ctx;
    const N = 44;
    const circle = (r, lift) => Array.from({ length: N + 1 }, (_, i) => {
      const t = (i / N) * Math.PI * 2;
      return projBoard(s, ring.a + Math.cos(t) * r, ring.b + Math.sin(t) * r, lift);
    });
    const outB = circle(ring.r, 0);
    const outT = circle(ring.r, LIP);
    const inB = circle(ring.r - WALL, 0);
    const inT = circle(ring.r - WALL, LIP);
    const lit = s.lit === ring;
    const top = lit ? '#fff59d' : ring.color;
    // Mitad del fondo: puntos 0 a N/2 (b más grande); mitad de adelante: N/2 a N
    const from = part === 'back' ? 0 : N / 2;
    const to = part === 'back' ? N / 2 : N;
    if (part === 'back') {
      // Sombra de la pared sobre el paño, agujero donde cae la pelota y los puntos
      const d = ring.drain;
      const hole = Array.from({ length: 20 }, (_, i) => projBoard(s, d.a + Math.cos((i / 20) * Math.PI * 2) * d.r, d.b + Math.sin((i / 20) * Math.PI * 2) * d.r));
      poly(s, hole.map((p) => ({ x: p.x, y: p.y - p.k * 0.012 })), ring.dark);
      poly(s, hole, '#04030f');
      const lp = projBoard(s, ring.a, ring.b + ring.r - WALL - 0.055);
      g.fillStyle = lit ? '#fff59d' : '#fff';
      g.font = `900 ${Math.max(8, lp.k * 0.085)}px Arial, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(fmt(ring.points), lp.x, lp.y);
      // Cara de adentro de la pared del fondo
      for (let i = from; i < to; i++) poly(s, [inB[i], inB[i + 1], inT[i + 1], inT[i]], ring.dark, ring.dark, 0.6);
    } else {
      // Sombra y cara de afuera de la pared de adelante
      poly(s, [...outB.slice(from, to + 1), ...outB.slice(from, to + 1).reverse().map((p) => ({ x: p.x + p.k * 0.015, y: p.y + p.k * 0.04 }))], 'rgba(0,0,0,.25)');
      for (let i = from; i < to; i++) poly(s, [outB[i], outB[i + 1], outT[i + 1], outT[i]], ring.dark, ring.dark, 0.6);
    }
    // Borde de arriba de la pared, con una línea de brillo
    for (let i = from; i < to; i++) poly(s, [outT[i], outT[i + 1], inT[i + 1], inT[i]], top, top, 0.6);
    g.strokeStyle = 'rgba(255,255,255,.7)';
    g.lineWidth = Math.max(1, outT[0].k * 0.01);
    g.beginPath();
    for (let i = from + 2; i <= to - 2; i++) {
      const t = (i / N) * Math.PI * 2;
      const p = projBoard(s, ring.a + Math.cos(t) * (ring.r - WALL / 2), ring.b + Math.sin(t) * (ring.r - WALL / 2), LIP);
      if (i === from + 2) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
    }
    g.stroke();
  }

  function drawBall(s) {
    const b = s.ball;
    if (!b || b.alpha <= 0) return;
    const g = s.ctx;
    const p = proj(s, b.x, b.alt, b.z);
    const r = BALL_R * p.k * b.k;
    g.save();
    g.globalAlpha = b.alpha;
    // Sombra en el piso (o en el tablero) debajo de la pelota
    const sh = proj(s, b.x, b.ground, b.z);
    g.fillStyle = 'rgba(0,0,0,.3)';
    g.beginPath();
    g.ellipse(sh.x, sh.y + r * 0.1, r * 0.95, r * 0.32, 0, 0, Math.PI * 2);
    g.fill();
    g.translate(p.x, p.y);
    const grad = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.08, 0, 0, r);
    grad.addColorStop(0, '#fff8e8');
    grad.addColorStop(0.55, '#e2b780');
    grad.addColorStop(1, '#9a6a36');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#5d3c1b';
    g.lineWidth = Math.max(1, r * 0.07);
    g.stroke();
    // Vetas que giran: se nota que rueda
    g.rotate(b.spin);
    g.strokeStyle = 'rgba(93,60,27,.5)';
    g.beginPath();
    g.arc(0, 0, r * 0.6, 0.2, 2.1);
    g.stroke();
    g.beginPath();
    g.arc(0, 0, r * 0.6, 3.4, 5.2);
    g.stroke();
    g.restore();
  }

  function loop(s) {
    if (!alive(s)) return;
    s.cam += (s.camTarget - s.cam) * 0.07;
    draw(s);
    setTimeout(() => loop(s), 16);
  }

  // ---------- Cada pelota ----------

  function ready(s) {
    s.ball = homeBall();
    s.lit = null;
    s.sink = null;
    s.inside = null;
    s.camTarget = 0;
    s.flash.hidden = true;
    s.ready = true;
    [...s.left.children].forEach((b, i) => b.classList.toggle('used', i < s.thrown));
    if (!s.shownHint) {
      s.shownHint = true;
      setTimeout(() => { if (alive(s) && s.ready) showHint(s); }, 500);
    }
  }

  function showHint(s) {
    stopHint(s);
    const p = proj(s, 0, BALL_R, 0);
    s.hand.hidden = false;
    s.hand.style.left = p.x + 'px';
    s.hand.style.top = p.y + 'px';
    const up = -s.H * 0.36;
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
      // Dirección: cuánto se va de costado (1 = hasta el borde del tablero).
      // Con una ayudita: hay que desviarse bastante para irse del medio.
      const side = clamp((dx / -dy) * 1.45, -1.1, 1.1);
      shoot(s, plan(side, power));
    };
    box.addEventListener('pointerup', release);
    box.addEventListener('pointercancel', release);
  }

  /*
   * Qué pasa con el tiro: side = costado (-1 a 1), power = fuerza (0 a 1,2).
   * Devuelve dónde cae en el tablero (a, b), los puntos, y por dónde rueda hasta desaparecer:
   *   cup = copita donde entra · ring = aro grande en el que queda (va a su agujero) ·
   *   via = puntos del tablero por los que pasa rodando antes · direct = cayó justo adentro
   */
  function plan(side, power) {
    const a = clamp(side, -0.93, 0.93) * (BOARD_W - 0.07);
    if (power < WEAK) return { weak: true, a, b: 0, points: 0 };
    if (power > TOO_STRONG) return { over: true, a, b: BOARD_H, points: GUTTER };
    // Más fuerza, más arriba
    const b = clamp(0.12 + (power - WEAK) * 2.02, 0.08, BOARD_H - 0.08);
    const dist = (o) => Math.hypot(a - o.a, b - o.b);
    const sideOf = a >= 0 ? 1 : -1;
    // Cae dentro de una copita: entra directo
    const cup = HOLES.find((hole) => dist(hole) <= hole.r);
    if (cup) return { a, b, cup, direct: true, via: [], points: cup.points };
    // Adentro de un aro grande (el más chico que la contenga): rueda hasta su agujero,
    // esquivando lo que tenga en el medio
    const [big, mid] = RINGS;
    if (dist(mid) <= mid.r - WALL) {
      const mini = HOLES[0];
      const via = b > mini.b - 0.05 ? [{ a: sideOf * (mini.r + 0.085), b: mini.b - 0.06 }] : [];
      return { a, b, ring: mid, via, points: mid.points };
    }
    if (dist(big) <= big.r - WALL) {
      const via = b > mid.b - 0.1 ? [{ a: sideOf * (mid.r + 0.085), b: mid.b - 0.08 }] : [];
      return { a, b, ring: big, via, points: big.points };
    }
    // Arriba de los aros: rueda tablero abajo. Entra en la copita que tenga debajo...
    const below = HOLES.filter((hole) => hole.b < b && hole.b > 1 && Math.abs(a - hole.a) <= hole.r * 1.15).sort((p, q) => q.b - p.b)[0];
    if (below) return { a, b, cup: below, direct: false, via: [], points: below.points };
    // ...o rodea el aro grande por afuera hasta la canaleta
    return { a, b, via: [{ a: sideOf * (BOARD_W - 0.06), b: Math.min(b, big.b + 0.1) }], points: GUTTER };
  }

  // Mueve la pelota hasta "to" en "ms"; "arc" la levanta en el medio del recorrido (salto)
  function fly(s, to, ms, arc) {
    const from = { ...s.ball };
    const start = performance.now();
    return new Promise((done) => {
      const step = () => {
        if (!alive(s)) return done();
        const t = Math.min(1, (performance.now() - start) / ms);
        const b = s.ball;
        for (const key of ['x', 'z', 'k', 'alpha', 'ground']) b[key] = lerp(from[key], to[key] ?? from[key], t);
        b.alt = lerp(from.alt, to.alt ?? from.alt, t) + (arc || 0) * 4 * t * (1 - t);
        b.spin += 0.3;
        if (t >= 1) return done();
        setTimeout(step, 16);
      };
      step();
      setTimeout(done, ms + 500); // tope por si algo se traba
    });
  }

  // Punto donde apoya la pelota sobre el tablero en (a, b)
  const onBoard = (a, b) => {
    const p = board(a, b, BALL_R);
    return { x: p.x, alt: p.alt, z: p.z, ground: board(a, b).alt };
  };

  async function shoot(s, shot) {
    s.ready = false;
    s.flying = true;
    s.last = shot; // para revisar los tiros desde la consola
    s.thrown++;
    [...s.left.children].forEach((b, i) => b.classList.toggle('used', i < s.thrown));
    BQ.puppet.use(s.hero.querySelector('.avatar'));
    sfx.notes([[150, 0, 0.6, 'sawtooth', 0.04]]); // la pelota rodando
    const laneX = (shot.a / BOARD_W) * 0.3; // en la pista se va apenas de costado

    if (shot.weak) {
      // No llega a subir la rampa: frena y vuelve rodando
      s.camTarget = 0.25;
      await fly(s, { x: laneX, z: LANE - RAMP * 0.7, alt: BALL_R + 0.04 }, 1100);
      s.camTarget = 0;
      await fly(s, { x: laneX * 1.3, z: -1.8, alt: BALL_R, alpha: 0 }, 1300);
    } else {
      // Rueda por la pista (la cámara la sigue), sube el lomo y salta al tablero
      s.camTarget = 1;
      await fly(s, { x: laneX * 0.8, z: LANE - RAMP }, 620);
      await fly(s, { x: laneX, z: LANE, alt: RAMP_H + BALL_R, ground: RAMP_H }, 170);
      sfx.whee();
      if (shot.over) {
        // Demasiado fuerte: pega en el fondo de la máquina y cae a la canaleta
        const back = board(shot.a, BOARD_H, CAGE * 0.6);
        await fly(s, { x: back.x, alt: back.alt, z: back.z, ground: BOARD_ALT + BOARD_H * SIN }, 520, 0.5);
        sfx.notes([[140, 0, 0.12, 'square', 0.12]]);
        const low = onBoard(shot.a * 0.6, -0.12);
        await fly(s, { ...low, k: 0.9 }, 700, 0.25);
        await fly(s, { alt: low.alt - 0.3, alpha: 0 }, 200);
      } else {
        const land = onBoard(shot.a, shot.b);
        await fly(s, land, 430 + shot.b * 130, 0.55 + shot.b * 0.18);
        sfx.notes([[200, 0, 0.07, 'square', 0.1]]);
        // Rueda por donde le toca (ver plan) hasta la copita, el agujero del aro o la canaleta
        s.inside = RINGS.filter((ring) => Math.hypot(shot.a - ring.a, shot.b - ring.b) <= ring.r - WALL);
        const target = shot.cup || (shot.ring && shot.ring.drain) || { a: (shot.a >= 0 ? 1 : -1) * (BOARD_W - 0.12), b: -0.12 };
        if (!shot.direct) sfx.notes([[150, 0, 0.35, 'sawtooth', 0.03]]);
        let at = { a: shot.a, b: shot.b };
        for (const stop of [...shot.via, target]) {
          const d = Math.hypot(stop.a - at.a, stop.b - at.b);
          await fly(s, onBoard(stop.a, stop.b), shot.direct ? 150 : 140 + d * 620);
          at = stop;
        }
        // Cae adentro: baja y queda tapada por el borde de adelante
        s.sink = shot.cup || null;
        s.lit = shot.cup || shot.ring || null;
        const drop = board(target.a, target.b, -0.16);
        await fly(s, { x: drop.x, alt: drop.alt, z: drop.z, k: 0.75, alpha: shot.cup ? 0.25 : 0 }, 240);
        s.ball.alpha = 0;
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
      : shot.over ? '¡Muy fuerte!'
        : shot.points >= 10000 ? '¡Diez mil! ¡Increíble!'
          : `¡${shot.points}!`;
    await Promise.all([voice.say(say), wait(1500)]);
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

  // state, plan y finish: para revisar los tiros desde la consola
  BQ.rampa = { open, state: () => S, plan, holes: HOLES, rings: RINGS, prizes: PRIZES, finish: () => finish(S) };
})(window.BQ);
