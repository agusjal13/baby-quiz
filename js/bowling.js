(function (BQ) {
  'use strict';

  /*
   * Bowling en 3D: se juega arrastrando el dedo hacia arriba sobre la bola (sin preguntas).
   * 3 cuadros de hasta 2 tiros. Gana si voltea 15 pinos o más (de 30); ganar da una moneda
   * y suma para los trofeos, como los otros juegos.
   *
   * La física es en un plano visto desde arriba (200 x 400): canaletas a los costados
   * (x < 26 y x > 174), la bola arranca en y=355 y los 10 pinos están al fondo (primer pino en y=120).
   * Para dibujar se pasa a una vista en perspectiva desde atrás de la bola: la profundidad es
   * z = 360 - y, y la cámara acompaña a la bola cuando rueda para ver el choque de cerca.
   * Velocidades en unidades por cuadro (16 ms).
   */

  const U = BQ.util;
  const h = U.h;
  const store = BQ.store;
  const voice = BQ.voice;
  const sfx = BQ.sfx;
  const ui = () => BQ.ui;
  const wait = BQ.sport.wait;

  const FRAMES = 3;
  const TO_WIN = 15;
  const BALL_R = 12;
  const PIN_R = 6;
  const PIN_H = 38; // alto de los pinos (misma unidad que la pista)
  const LANE = [26, 174]; // bordes de la pista; afuera son las canaletas
  const BALL_START = [100, 355];
  const LANE_END = 335; // profundidad donde termina la pista (después está el foso)
  const CAM_START = -60;
  const CAM_MAX = 165; // hasta dónde se acerca la cámara (se ven de frente la caja, la pantalla y los pinos)
  // Caja del final de la pista: frente un poco antes del primer pino, boca hasta BOX_OPEN de alto
  const BOX_FRONT = 222;
  const BOX_BACK = LANE_END + 30;
  const BOX_OPEN = 52;
  const BOX_TOP = 112;
  const PIN_SPOTS = [
    [100, 120],
    [90, 104], [110, 104],
    [80, 88], [100, 88], [120, 88],
    [70, 72], [90, 72], [110, 72], [130, 72],
  ];
  const OUT = '#2b2140';
  const THEME = { sky1: '#2b2d5c', sky2: '#6a4c9c', ground: '#1f1b3a', decor: ['🎳', '⭐', '✨', '🎉', '🏆'] };

  const depth = (y) => 360 - y;

  let S = null;
  const alive = (s) => S === s && s.screen.isConnected;

  // ---------- Pantalla ----------

  function open() {
    if (!store.data.character) {
      store.data.character = 'futbolista';
      store.save();
    }
    startGame();
  }

  function startGame() {
    const canvas = h('canvas', { class: 'bw-canvas' });
    const lane = h('div', { class: 'bw-lane-box' }, canvas);
    const hand = h('span', { class: 'hand emoji bw-hand', hidden: true }, '👆');
    lane.append(hand);
    const board = h('div', { class: 'bw-board' },
      Array.from({ length: FRAMES }, (_, i) => h('div', { class: 'bw-frame' },
        h('span', { class: 'bw-frame-n' }, String(i + 1)),
        h('div', { class: 'bw-throws' }, h('span', { class: 'bw-t' }), h('span', { class: 'bw-t' })),
        h('span', { class: 'bw-frame-total' }))),
      h('div', { class: 'bw-frame bw-total' }, h('span', { class: 'bw-frame-n' }, 'Total'), h('span', { class: 'bw-frame-total big' }, '0')));
    const hero = ui().playable(h('div', { class: 'bw-hero' }, BQ.puppet.el(store.data.character)));
    const tip = h('p', { class: 'bw-tip' }, '¡Arrastrá la bola hacia arriba!');

    const screen = h('div', { class: 'screen bowling' },
      ui().topbar(ui().backBtn(() => { S = null; ui().showWorlds(); }), board, h('span', { class: 'spacer' })),
      h('div', { class: 'bw-body' }, h('div', { class: 'bw-side' }, hero, tip), lane));
    ui().show(screen, THEME);

    const s = {
      screen, lane, canvas, ctx: canvas.getContext('2d'), hand, board, hero, tip,
      ball: { x: BALL_START[0], y: BALL_START[1], vx: 0, vy: 0, gutter: false, spin: 0 },
      pins: PIN_SPOTS.map(([x, y], i) => ({ i, x, y, vx: 0, vy: 0, down: false, gone: false, tilt: 0, side: 1 })),
      camZ: CAM_START, camTarget: CAM_START,
      frame: 0, throwN: 0, scores: [], ready: false, drag: null, shownHint: false,
    };
    S = s;
    resize(s);
    const ro = new ResizeObserver(() => { if (alive(s)) { resize(s); render(s); } else ro.disconnect(); });
    ro.observe(lane);
    render(s);
    listen(s);

    sfx.whistle();
    // Corto, para arrancar rápido: cómo se tira lo muestra la manito
    voice.say('¡Golpeá quince pinos!')
      .then(() => { if (alive(s)) readyToThrow(s); });
  }

  // ---------- Vista en perspectiva ----------

  function resize(s) {
    const r = s.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    s.W = Math.max(1, r.width);
    s.H = Math.max(1, r.height);
    s.canvas.width = Math.round(s.W * dpr);
    s.canvas.height = Math.round(s.H * dpr);
    s.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Lente y altura de la cámara: la bola, al principio, queda abajo en la pantalla
    s.F = 0.34 * Math.min(s.W, s.H * 1.3);
    s.horizonHigh = s.H * 0.2;
    s.camHigh = ((0.8 - 0.2) * s.H * 65) / s.F;
    aimCamera(s);
  }

  // La cámara arranca alta (para apuntar) y, mientras sigue a la bola, baja casi a la altura de
  // los pinos, así se ven enteros por debajo de la caja y se nota cuántos caen.
  const CAM_LOW = 24; // altura final de la cámara (los pinos miden 38)
  function aimCamera(s) {
    const t = Math.max(0, Math.min(1, (s.camZ - CAM_START) / (CAM_MAX - CAM_START)));
    const e = t * t * (3 - 2 * t); // suave al empezar y al terminar
    s.camH = s.camHigh + (CAM_LOW - s.camHigh) * e;
    s.horizon = s.horizonHigh + (s.H * 0.5 - s.horizonHigh) * e;
  }

  // Punto de la pista (x, altura, profundidad) en la pantalla; k es la escala a esa distancia
  function project(s, x, alt, z) {
    const dz = z - s.camZ;
    if (dz < 4) return null;
    const k = s.F / dz;
    return { x: s.W / 2 + (x - 100) * k, y: s.horizon + (s.camH - alt) * k, k };
  }

  function quad(s, x1, x2, z1, z2, alt, fill) {
    const a = project(s, x1, alt, z1);
    const b = project(s, x2, alt, z1);
    const c = project(s, x2, alt, z2);
    const d = project(s, x1, alt, z2);
    if (!a || !b || !c || !d) return;
    const g = s.ctx;
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.lineTo(c.x, c.y);
    g.lineTo(d.x, d.y);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  }

  function render(s) {
    const g = s.ctx;
    const { W, H } = s;
    aimCamera(s);
    const near = s.camZ + 6;

    // Fondo del salón
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#120f26');
    bg.addColorStop(1, '#2b2250');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // Interior de la caja del final: foso, pared del fondo y paredes de adentro (oscuros)
    quad(s, 8, 192, LANE_END, BOX_BACK, -6, '#08060f');
    poly(s, [[8, -8, BOX_BACK], [192, -8, BOX_BACK], [192, BOX_OPEN, BOX_BACK], [8, BOX_OPEN, BOX_BACK]], '#07050d');

    // Laterales, canaletas y pista de madera
    quad(s, -40, 8, near, LANE_END, 6, '#3d3563');
    quad(s, 192, 240, near, LANE_END, 6, '#3d3563');
    quad(s, 8, 26, near, LANE_END, -3, '#5b5577');
    quad(s, 174, 192, near, LANE_END, -3, '#5b5577');
    const a = project(s, 100, 0, near);
    const b = project(s, 100, 0, LANE_END);
    if (a && b) {
      const wood = g.createLinearGradient(0, b.y, 0, a.y);
      wood.addColorStop(0, '#c98c4a');
      wood.addColorStop(1, '#f0c287');
      quad(s, 26, 174, near, LANE_END, 0, wood);
    }
    // Tablas
    g.strokeStyle = 'rgba(120, 70, 20, .22)';
    g.lineWidth = 1;
    for (let i = 1; i < 12; i++) {
      const x = 26 + i * 12.33;
      const p1 = project(s, x, 0, near);
      const p2 = project(s, x, 0, LANE_END);
      if (!p1 || !p2) continue;
      g.beginPath();
      g.moveTo(p1.x, p1.y);
      g.lineTo(p2.x, p2.y);
      g.stroke();
    }
    // Zona de los pinos, flechas y línea de tiro
    quad(s, 26, 174, depth(140), LANE_END, 0.1, 'rgba(255, 240, 210, .25)');
    for (const x of [70, 85, 100, 115, 130]) {
      const t = project(s, x, 0.1, depth(250));
      const l = project(s, x - 4, 0.1, depth(262));
      const r = project(s, x + 4, 0.1, depth(262));
      if (!t || !l || !r) continue;
      g.beginPath();
      g.moveTo(t.x, t.y);
      g.lineTo(l.x, l.y);
      g.lineTo(r.x, r.y);
      g.closePath();
      g.fillStyle = '#8a5a25';
      g.fill();
    }
    quad(s, 26, 174, depth(331), depth(329), 0.1, '#e53935');

    // Paredes de adentro de la caja y luz sobre los pinos
    poly(s, [[8, 0, BOX_FRONT], [8, 0, BOX_BACK], [8, BOX_OPEN, BOX_BACK], [8, BOX_OPEN, BOX_FRONT]], '#14102a');
    poly(s, [[192, 0, BOX_FRONT], [192, 0, BOX_BACK], [192, BOX_OPEN, BOX_BACK], [192, BOX_OPEN, BOX_FRONT]], '#14102a');
    const lamp = project(s, 100, 25, 262);
    if (lamp) {
      const glow = g.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 90 * lamp.k);
      glow.addColorStop(0, 'rgba(255, 225, 160, .45)');
      glow.addColorStop(1, 'rgba(255, 225, 160, 0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, W, H);
    }

    // Pinos y bola, de atrás hacia adelante: primero lo que está adentro de la caja,
    // después el frente de la caja (con la pantalla) y por último lo que está delante
    const things = s.pins.filter((p) => !p.gone).map((p) => ({ z: depth(p.y), draw: () => drawPin(s, p) }));
    if (s.ball.y > -40) things.push({ z: depth(s.ball.y), draw: () => drawBall(s) });
    things.sort((p, q) => q.z - p.z);
    things.filter((t) => t.z >= BOX_FRONT).forEach((t) => t.draw());
    drawBox(s);
    things.filter((t) => t.z < BOX_FRONT).forEach((t) => t.draw());
  }

  // Polígono con puntos [x, altura, profundidad]
  function poly(s, pts, fill) {
    const P = pts.map(([x, alt, z]) => project(s, x, alt, z));
    if (P.some((p) => !p)) return;
    const g = s.ctx;
    g.beginPath();
    P.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  }

  // Caja del final de la pista (como la de los bowlings): tapa la parte de arriba de los pinos,
  // la bola entra y desaparece adentro. En el frente, arriba de los pinos, está la pantalla.
  function drawBox(s) {
    const g = s.ctx;
    // Techo y costados de afuera
    poly(s, [[-12, BOX_TOP, BOX_FRONT], [212, BOX_TOP, BOX_FRONT], [212, BOX_TOP, BOX_BACK], [-12, BOX_TOP, BOX_BACK]], '#231e40');
    poly(s, [[-12, 0, BOX_FRONT], [8, 0, BOX_FRONT], [8, BOX_OPEN, BOX_FRONT], [-12, BOX_OPEN, BOX_FRONT]], '#2d2752');
    poly(s, [[192, 0, BOX_FRONT], [212, 0, BOX_FRONT], [212, BOX_OPEN, BOX_FRONT], [192, BOX_OPEN, BOX_FRONT]], '#2d2752');
    // Frente
    const tl = project(s, -12, BOX_TOP, BOX_FRONT);
    const br = project(s, 212, BOX_OPEN, BOX_FRONT);
    if (tl && br) {
      const front = g.createLinearGradient(0, tl.y, 0, br.y);
      front.addColorStop(0, '#3a3370');
      front.addColorStop(1, '#231e48');
      g.fillStyle = front;
      g.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      // Borde de luces abajo, sobre la boca de la caja
      g.fillStyle = '#ffd23f';
      const lights = 14;
      for (let i = 0; i < lights; i++) {
        const lx = tl.x + ((i + 0.5) / lights) * (br.x - tl.x);
        g.beginPath();
        g.arc(lx, br.y - (br.y - tl.y) * 0.05, Math.max(1.2, (br.y - tl.y) * 0.035), 0, Math.PI * 2);
        g.fill();
      }
    }
    drawScreen(s);
  }

  // Pantalla en el frente de la caja, arriba de los pinos: muestra el cuadro y el resultado del tiro
  function drawScreen(s) {
    const z = BOX_FRONT - 0.5;
    const tl = project(s, 42, BOX_TOP - 7, z);
    const br = project(s, 158, BOX_OPEN + 10, z);
    if (!tl || !br) return;
    const g = s.ctx;
    const w = br.x - tl.x;
    const hgt = br.y - tl.y;
    // Marco, soportes y vidrio
    g.fillStyle = '#1b1830';
    g.fillRect(tl.x - w * 0.03, tl.y - hgt * 0.06, w * 1.06, hgt * 1.12);
    g.fillStyle = '#2d2850';
    g.fillRect(tl.x + w * 0.2, br.y + hgt * 0.06, w * 0.04, hgt * 0.35);
    g.fillRect(tl.x + w * 0.76, br.y + hgt * 0.06, w * 0.04, hgt * 0.35);
    const glass = g.createLinearGradient(0, tl.y, 0, br.y);
    glass.addColorStop(0, '#0b1a3a');
    glass.addColorStop(1, '#050b1c');
    g.fillStyle = glass;
    g.fillRect(tl.x, tl.y, w, hgt);
    // Texto de neón
    const msg = s.screenMsg || { text: '¡A JUGAR!', color: '#4dd0e1' };
    const color = msg.colors ? msg.colors[Math.floor(performance.now() / 180) % msg.colors.length] : msg.color;
    let size = hgt * 0.42;
    g.font = `900 ${size}px ${getComputedStyle(document.body).fontFamily}`;
    const tw = g.measureText(msg.text).width;
    if (tw > w * 0.9) {
      size *= (w * 0.9) / tw;
      g.font = `900 ${size}px ${getComputedStyle(document.body).fontFamily}`;
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = size * 0.5;
    g.fillStyle = color;
    g.fillText(msg.text, tl.x + w / 2, tl.y + hgt / 2);
    g.shadowBlur = 0;
    // Brillo del vidrio
    g.fillStyle = 'rgba(255, 255, 255, .06)';
    g.fillRect(tl.x, tl.y, w, hgt * 0.35);
  }

  // Cambia el mensaje de la pantalla; con varios colores, titila un rato
  function screenShow(s, text, color, colors) {
    s.screenMsg = { text, color, colors };
    render(s);
    if (!colors) return;
    const until = Date.now() + 1800;
    const blink = () => {
      if (!alive(s) || s.screenMsg.text !== text) return;
      render(s);
      if (Date.now() < until) setTimeout(blink, 90);
    };
    blink();
  }

  function pinPath(g, w, H) {
    g.beginPath();
    g.moveTo(-w * 0.5, 0);
    g.bezierCurveTo(-w * 1.15, -H * 0.2, -w * 1.1, -H * 0.45, -w * 0.42, -H * 0.62);
    g.bezierCurveTo(-w * 0.25, -H * 0.72, -w * 0.72, -H * 0.84, -w * 0.52, -H * 0.95);
    g.quadraticCurveTo(0, -H * 1.07, w * 0.52, -H * 0.95);
    g.bezierCurveTo(w * 0.72, -H * 0.84, w * 0.25, -H * 0.72, w * 0.42, -H * 0.62);
    g.bezierCurveTo(w * 1.1, -H * 0.45, w * 1.15, -H * 0.2, w * 0.5, 0);
    g.closePath();
  }

  function drawPin(s, p) {
    const base = project(s, p.x, 0, depth(p.y));
    if (!base) return;
    const g = s.ctx;
    const w = PIN_R * base.k;
    const Hh = PIN_H * base.k;
    // Sombra
    g.fillStyle = 'rgba(0, 0, 0, .22)';
    g.beginPath();
    g.ellipse(base.x, base.y, w * 1.2, w * 0.4, 0, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.translate(base.x, base.y);
    g.rotate(p.tilt * p.side);
    const body = g.createLinearGradient(-w, 0, w, 0);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.55, '#f4f1ea');
    body.addColorStop(1, '#c9c3b8');
    pinPath(g, w, Hh);
    g.fillStyle = body;
    g.fill();
    g.lineWidth = Math.max(0.8, w * 0.12);
    g.strokeStyle = OUT;
    g.stroke();
    // Rayas rojas del cuello
    g.strokeStyle = '#e53935';
    g.lineWidth = Math.max(1, Hh * 0.035);
    for (const f of [0.7, 0.76]) {
      g.beginPath();
      g.moveTo(-w * 0.36, -Hh * f);
      g.quadraticCurveTo(0, -Hh * (f - 0.015), w * 0.36, -Hh * f);
      g.stroke();
    }
    g.restore();
  }

  // Bola con brillo y los agujeros de los dedos girando a medida que rueda
  function drawBall(s) {
    const b = s.ball;
    // Pasado el final de la pista, la bola cae al foso: baja y se va apagando
    const past = Math.max(0, depth(b.y) - LANE_END);
    const alt = (b.gutter ? BALL_R - 5 : BALL_R) - past * 1.4;
    const c = project(s, b.x, alt, depth(b.y));
    const floor = project(s, b.x, b.gutter ? -3 : 0, depth(b.y));
    if (!c || !floor) return;
    const g = s.ctx;
    const r = BALL_R * c.k;
    g.save();
    g.globalAlpha = Math.max(0, 1 - past / 28);
    if (!past) {
      g.fillStyle = 'rgba(0, 0, 0, .3)';
      g.beginPath();
      g.ellipse(floor.x, floor.y, r * 1.05, r * 0.32, 0, 0, Math.PI * 2);
      g.fill();
    }

    const shine = g.createRadialGradient(c.x - r * 0.35, c.y - r * 0.4, r * 0.08, c.x, c.y, r);
    shine.addColorStop(0, '#d9c8ff');
    shine.addColorStop(0.35, '#7b4dff');
    shine.addColorStop(1, '#2a0f78');
    g.fillStyle = shine;
    g.beginPath();
    g.arc(c.x, c.y, r, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = Math.max(1, r * 0.08);
    g.strokeStyle = OUT;
    g.stroke();

    // Agujeros: giran alrededor del eje horizontal (la bola rueda alejándose)
    const holes = [[0, 0.1], [-0.24, -0.42], [0.24, -0.42]];
    g.save();
    g.beginPath();
    g.arc(c.x, c.y, r * 0.98, 0, Math.PI * 2);
    g.clip();
    for (const [lat, phi] of holes) {
      const t = phi + b.spin;
      const facing = Math.cos(t);
      if (facing < 0.05) continue;
      const hx = c.x + lat * r * 1.1 * Math.sqrt(facing);
      const hy = c.y - Math.sin(t) * r * 0.78;
      g.fillStyle = '#12052e';
      g.beginPath();
      g.ellipse(hx, hy, r * 0.13, r * 0.13 * facing, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    g.restore(); // transparencia de la caída al foso
  }

  // ---------- Arrastrar para tirar ----------

  function point(s, e) {
    const r = s.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  }

  function listen(s) {
    const box = s.lane;
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
      const p = point(s, e);
      s.drag.pts.push(p);
      if (s.drag.pts.length > 40) s.drag.pts.shift();
      // Antes de soltar, la bola acompaña el dedo de costado para apuntar (sin acercarse a la canaleta)
      const k = s.F / (depth(s.ball.y) - s.camZ);
      s.ball.x = Math.max(62, Math.min(138, 100 + (p.x - s.W / 2) / k));
      render(s);
    });
    const release = (e) => {
      if (!s.drag || e.pointerId !== s.drag.id) return;
      const pts = s.drag.pts;
      s.drag = null;
      const end = pts[pts.length - 1];
      const start = pts.find((p) => end.t - p.t <= 160) || pts[0];
      const dt = Math.max(16, end.t - start.t);
      const dy = end.y - start.y;
      const dx = end.x - start.x;
      if (dy > -s.H * 0.04) { // no fue hacia arriba
        voice.say('¡Arrastrá hacia arriba, bien rápido!');
        showHint(s);
        return;
      }
      // Fuerza según la velocidad del dedo; de costado, con ayudita para no ir a la canaleta
      // (más lenta que la velocidad real del dedo, para que se la vea rodar por la pista)
      const speed = Math.max(3.2, Math.min(6.5, (-dy / dt) * 16 * (400 / s.H) * 0.45));
      const side = Math.max(-0.12, Math.min(0.12, (dx / -dy) * 0.35));
      roll(s, side * speed, -speed);
    };
    box.addEventListener('pointerup', release);
    box.addEventListener('pointercancel', release);
  }

  function readyToThrow(s) {
    s.ready = true;
    s.tip.textContent = `Cuadro ${s.frame + 1} · tiro ${s.throwN + 1}: ¡arrastrá la bola hacia arriba!`;
    screenShow(s, `CUADRO ${s.frame + 1} · TIRO ${s.throwN + 1}`, '#4dd0e1');
    if (!s.shownHint) {
      s.shownHint = true;
      showHint(s);
    }
  }

  // Manito que muestra el movimiento: desde la bola hacia arriba
  function showHint(s) {
    stopHint(s);
    const c = project(s, s.ball.x, BALL_R, depth(s.ball.y));
    if (!c) return;
    s.hand.hidden = false;
    s.hand.style.left = c.x + 'px';
    s.hand.style.top = c.y + 'px';
    s.handAnim = s.hand.animate([
      { transform: 'translate(0, 0)', opacity: 0 },
      { transform: 'translate(0, 0)', opacity: 1, offset: 0.2 },
      { transform: `translate(0, ${-s.H * 0.3}px)`, opacity: 1, offset: 0.8 },
      { transform: `translate(0, ${-s.H * 0.3}px)`, opacity: 0 },
    ], { duration: 1400, iterations: 3 });
    s.handAnim.onfinish = () => stopHint(s);
  }

  function stopHint(s) {
    if (s.handAnim) s.handAnim.cancel();
    s.handAnim = null;
    s.hand.hidden = true;
  }

  // ---------- Física ----------

  function roll(s, vx, vy) {
    s.ready = false;
    const b = s.ball;
    b.vx = vx;
    b.vy = vy;
    b.gutter = false;
    BQ.puppet.use(s.hero.querySelector('.avatar'), 'wave');
    sfx.noise(1.6, 'lowpass', 180, 0.25, 0.1); // la bola rodando
    simulate(s).then(() => afterThrow(s));
  }

  function simulate(s) {
    return new Promise((resolve) => {
      const b = s.ball;
      const started = Date.now();
      let lastHit = 0;
      const hit = (f) => {
        if (Date.now() - lastHit > 50) {
          lastHit = Date.now();
          sfx.notes([[f + Math.random() * 500, 0, 0.05, 'square', 0.08]]);
        }
      };
      const step = () => {
        if (!alive(s)) return resolve();
        for (let sub = 0; sub < 3; sub++) {
          // Bola
          if (b.y > -40) {
            b.x += b.vx / 3;
            b.y += b.vy / 3;
            b.spin += Math.hypot(b.vx, b.vy) / 3 / BALL_R; // rueda: gira según lo que avanza
            if (!b.inPit && depth(b.y) > LANE_END) { // cae al foso: golpe seco
              b.inPit = true;
              sfx.noise(0.3, 'lowpass', 140, 0.6, 0.01);
              sfx.notes([[70, 0, 0.25, 'sine', 0.3]]);
            }
            if (!b.gutter && (b.x - BALL_R < LANE[0] || b.x + BALL_R > LANE[1])) {
              // A la canaleta: sigue derecho por el costado sin tocar pinos
              b.gutter = true;
              b.x = b.x < 100 ? 17 : 183;
              b.vx = 0;
            }
            if (!b.gutter) {
              for (const p of s.pins) {
                if (p.gone) continue;
                const dx = p.x - b.x;
                const dy = p.y - b.y;
                const d = Math.hypot(dx, dy);
                if (d < BALL_R + PIN_R && d > 0) {
                  const sp = Math.hypot(b.vx, b.vy);
                  const nx = dx / d;
                  const ny = dy / d;
                  // La bola es más lenta que antes: el golpe al pino se amplifica para que salgan volando igual
                  p.vx += nx * sp * 1.5 + (Math.random() - 0.5) * 1.5;
                  p.vy += ny * sp * 1.5 - Math.random();
                  knock(p);
                  b.vx *= 0.96;
                  b.vy *= 0.94;
                  b.vx += -nx * 0.15;
                  hit(900);
                }
              }
            }
          }
          // Pinos que vuelan tiran a otros
          for (const p of s.pins) {
            if (p.gone || (!p.vx && !p.vy)) continue;
            p.x += p.vx / 3;
            p.y += p.vy / 3;
            for (const q of s.pins) {
              if (q === p || q.gone) continue;
              const dx = q.x - p.x;
              const dy = q.y - p.y;
              const d = Math.hypot(dx, dy);
              if (d < PIN_R * 2 && d > 0) {
                const sp = Math.hypot(p.vx, p.vy);
                q.vx += (dx / d) * sp * 0.75 + (Math.random() - 0.5);
                q.vy += (dy / d) * sp * 0.75;
                p.vx *= 0.6;
                p.vy *= 0.6;
                knock(q);
                hit(1200);
              }
            }
            // Los que salen por los costados quedan acostados en la canaleta; los de atrás caen al foso
            if (p.x < LANE[0] || p.x > LANE[1]) {
              p.x = p.x < 100 ? 17 : 183;
              p.vx = 0;
              p.vy *= 0.5;
              knock(p);
            }
            if (p.y < 20) p.gone = true;
          }
        }
        for (const p of s.pins) {
          p.vx *= 0.93;
          p.vy *= 0.93;
          if (Math.abs(p.vx) < 0.05 && Math.abs(p.vy) < 0.05) { p.vx = 0; p.vy = 0; }
          if (p.down && p.tilt < 1.45) p.tilt = Math.min(1.45, p.tilt + 0.13); // cae de costado
        }
        // La cámara sigue a la bola hasta cerca de los pinos
        s.camTarget = b.y > -40 ? Math.max(CAM_START, Math.min(CAM_MAX, depth(b.y) - 85)) : s.camTarget;
        s.camZ += (s.camTarget - s.camZ) * 0.14;
        render(s);
        const pinsMoving = s.pins.some((p) => !p.gone && (p.vx || p.vy || (p.down && p.tilt < 1.45)));
        if ((b.y > -40 || pinsMoving) && Date.now() - started < 6000) setTimeout(step, 16);
        else resolve();
      };
      step();
    });
  }

  function knock(p) {
    if (p.down) return;
    p.down = true;
    p.side = p.vx === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(p.vx);
  }

  // La cámara vuelve atrás, a la posición de tiro
  function cameraBack(s) {
    return new Promise((resolve) => {
      const step = () => {
        if (!alive(s)) return resolve();
        s.camZ += (CAM_START - s.camZ) * 0.15;
        render(s);
        if (Math.abs(s.camZ - CAM_START) > 0.5) setTimeout(step, 16);
        else {
          s.camZ = CAM_START;
          render(s);
          resolve();
        }
      };
      step();
    });
  }

  // ---------- Puntaje ----------

  async function afterThrow(s) {
    if (!alive(s)) return;
    await wait(500);
    if (!alive(s)) return;
    const standingBefore = s.pinsStanding === undefined ? 10 : s.pinsStanding;
    const standing = s.pins.filter((p) => !p.down).length;
    const knocked = standingBefore - standing;
    s.pinsStanding = standing;
    const frame = s.scores[s.frame] || (s.scores[s.frame] = []);
    frame.push(knocked);
    paintBoard(s);

    let say;
    let done = false;
    const party = ['#ff5a8a', '#ffd23f', '#35c46a', '#2f9bff', '#b36bff'];
    if (s.throwN === 0 && knocked === 10) {
      screenShow(s, '¡STRIKE!', null, party);
      sfx.cheer();
      sfx.win();
      ui().burst(s.lane);
      BQ.puppet.use(s.hero.querySelector('.avatar'), 'shine');
      say = '¡Strike! ¡Tiraste todos los pinos!';
      done = true;
    } else if (s.throwN === 1 && standing === 0) {
      screenShow(s, '¡SPARE!', null, party);
      sfx.cheer();
      ui().burst(s.lane);
      say = '¡Spare! ¡Los tiraste todos!';
      done = true;
    } else {
      if (knocked > 0) sfx.correct(); else sfx.aww();
      if (s.ball.gutter && knocked === 0) screenShow(s, 'CANALETA', '#ff9800');
      else screenShow(s, knocked === 1 ? '1 PINO' : `${knocked} PINOS`, knocked ? '#ffd23f' : '#ff9800');
      say = knocked === 0 ? '¡Uy! No tiraste ninguno.' : `¡Tiraste ${knocked === 1 ? 'un pino' : `${knocked} pinos`}!`;
      done = s.throwN === 1;
    }
    await Promise.all([voice.say(say), wait(1600)]);
    if (!alive(s)) return;

    if (done) {
      s.frame++;
      s.throwN = 0;
      if (s.frame >= FRAMES) return finish(s);
      resetPins(s, true);
    } else {
      s.throwN = 1;
      resetPins(s, false);
    }
    resetBall(s);
    await cameraBack(s);
    if (alive(s)) readyToThrow(s);
  }

  // Los pinos caídos se sacan; en un cuadro nuevo se vuelven a parar los 10
  function resetPins(s, all) {
    for (const p of s.pins) {
      if (all) {
        Object.assign(p, { x: PIN_SPOTS[p.i][0], y: PIN_SPOTS[p.i][1], vx: 0, vy: 0, down: false, gone: false, tilt: 0 });
      } else if (p.down) {
        p.gone = true;
      }
    }
    if (all) s.pinsStanding = 10;
  }

  function resetBall(s) {
    Object.assign(s.ball, { x: BALL_START[0], y: BALL_START[1], vx: 0, vy: 0, gutter: false, spin: 0, inPit: false });
  }

  const total = (s) => s.scores.flat().reduce((a, b) => a + b, 0);

  function paintBoard(s) {
    const frames = s.board.querySelectorAll('.bw-frame:not(.bw-total)');
    s.scores.forEach((f, i) => {
      const t = frames[i].querySelectorAll('.bw-t');
      t[0].textContent = f[0] === 10 ? 'X' : f[0] === 0 ? '-' : String(f[0]);
      if (f.length > 1) t[1].textContent = f[0] + f[1] === 10 ? '/' : f[1] === 0 ? '-' : String(f[1]);
      frames[i].querySelector('.bw-frame-total').textContent = String(f.reduce((a, b) => a + b, 0));
    });
    s.board.querySelector('.bw-total .bw-frame-total').textContent = String(total(s));
  }

  function finish(s) {
    const pins = total(s);
    const won = pins >= TO_WIN;
    BQ.sport.result({
      screen: s.screen,
      won,
      detail: h('div', { class: 'mt-final' }, `${pins} pinos`),
      onAgain: startGame,
      winSay: `¡Ganaste! Tiraste ${pins} pinos. ¡Te ganaste una moneda!`,
      loseSay: `¡Casi! Tiraste ${pins} pinos y tenías que tirar quince. ¡Probá otra vez!`,
      isAlive: () => alive(s),
    });
  }

  BQ.bowling = { open };
})(window.BQ);
