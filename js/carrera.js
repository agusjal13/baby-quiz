(function (BQ) {
  'use strict';

  /*
   * Carrera a caballo: un vaquero va montado en su caballo, que corre solo por el desierto. Hay que
   * tocar la pantalla (en cualquier lado) para saltar los obstáculos, que salen al azar: cactus,
   * piedras, barriles y vallas. Hay 4 corazones: chocar un obstáculo cuesta uno (el caballo se
   * tropieza un poquito y sigue). Se gana llegando a la meta con al menos un corazón; sin chocar
   * nada es resultado perfecto. Ganar da moneda y suma para los trofeos, como los otros juegos.
   *
   * Se dibuja de costado en un canvas; el jinete es un muñequito encima del canvas.
   * Medidas en "pasos" (más o menos medio caballo): el caballo está quieto en la pantalla y el
   * mundo se mueve hacia la izquierda a SPEED pasos por segundo.
   */

  const U = BQ.util;
  const h = U.h;
  const store = BQ.store;
  const voice = BQ.voice;
  const sfx = BQ.sfx;
  const ui = () => BQ.ui;
  const wait = BQ.sport.wait;

  const LENGTH = 130; // largo de la carrera (pasos): alrededor de 30 segundos
  const SPEED = 4.2; // pasos por segundo
  const HEARTS = 4;
  const JUMP = 11; // velocidad hacia arriba al saltar (salto largo: queda más de un segundo en el aire)
  const GRAVITY = 17;
  // Obstáculos: ancho y alto (en pasos)
  const KINDS = {
    cactus: { w: 0.9, h: 1.3 },
    piedra: { w: 1.2, h: 0.8 },
    barril: { w: 0.95, h: 1.15 },
    valla: { w: 1.3, h: 1.1 },
  };
  const GAP = [11, 16]; // distancia entre obstáculos (al azar)
  const THEME = { sky1: '#ffb74d', sky2: '#ffe0b2', ground: '#c47a2c', decor: ['🐴', '🌵', '⭐', '🤠', '🏁'] };

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
    const canvas = h('canvas', { class: 'cr-canvas' });
    const rider = h('span', { class: 'cr-rider' }, BQ.puppet.el('vaquero', []));
    const hand = h('span', { class: 'hand emoji cr-hand', hidden: true }, '👆');
    const flash = h('div', { class: 'sport-flash', hidden: true });
    const stage = h('div', { class: 'cr-stage' }, canvas, rider, hand, flash);
    const hearts = h('div', { class: 'cr-hearts' }, Array.from({ length: HEARTS }, () => h('span', { class: 'cr-heart emoji' }, '❤️')));
    const marker = h('span', { class: 'cr-marker emoji' }, '🐴');
    const track = h('div', { class: 'cr-track' }, h('span', { class: 'cr-track-line' }), marker, h('span', { class: 'cr-goal emoji' }, '🏁'));

    const screen = h('div', { class: 'screen carrera' },
      ui().topbar(ui().backBtn(() => { S = null; ui().showWorlds(); }), h('div', { class: 'cr-top' }, hearts, track), h('span', { class: 'spacer' })),
      stage);
    ui().show(screen, THEME);

    // Obstáculos al azar a lo largo de la carrera (los primeros, más separados)
    const obstacles = [];
    for (let x = 16; x < LENGTH - 8; x += rnd(GAP[0], GAP[1])) {
      const kind = U.pick(Object.keys(KINDS));
      obstacles.push({ x, kind, ...KINDS[kind], hit: false, fly: 0 });
    }
    const s = {
      screen, stage, canvas, ctx: canvas.getContext('2d'), rider, hand, flash, hearts, marker,
      obstacles, dist: 0, y: 0, vy: 0, queued: 0, lives: HEARTS, hits: 0, slow: 0, safe: 0,
      running: false, done: false, t: 0, last: performance.now(), clop: 0, hinted: 0,
    };
    S = s;
    resize(s);
    const ro = new ResizeObserver(() => { if (alive(s)) resize(s); else ro.disconnect(); });
    ro.observe(stage);
    listen(s);
    loop(s);

    voice.say('¡Tocá la pantalla para saltar! ¡Llegá a la meta!').then(() => {
      if (!alive(s)) return;
      sfx.whistle();
      s.running = true;
      s.last = performance.now();
    });
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
    s.k = Math.min(s.W / 9.5, s.H / 6.5); // píxeles por paso
    s.groundY = s.H * (s.W < s.H ? 0.72 : 0.8); // con la pantalla parada, el piso más arriba
    s.horseX = Math.min(s.W * 0.26, s.k * 3.4); // dónde está el caballo en la pantalla
    s.rider.style.fontSize = s.k * 1.7 / 1.12 + 'px';
  }

  const sx = (s, worldX) => s.horseX + (worldX - s.dist) * s.k; // de pasos del mundo a pantalla

  function draw(s) {
    const g = s.ctx;
    const { W, H, k } = s;
    const gy = s.groundY;
    // Cielo del atardecer y sol
    const sky = g.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, '#ffb74d');
    sky.addColorStop(1, '#ffe9c4');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff3b0';
    g.beginPath();
    g.arc(W * 0.8, gy * 0.3, k * 0.9, 0, Math.PI * 2);
    g.fill();
    // Mesetas lejanas (se mueven despacio) y cactus del medio (un poco más rápido)
    const far = (s.dist * k * 0.15) % (W * 0.9);
    g.fillStyle = '#e59a5c';
    for (let i = -1; i < 3; i++) {
      const x = i * W * 0.9 - far;
      g.beginPath();
      g.moveTo(x, gy);
      g.lineTo(x + W * 0.08, gy - k * 1.8);
      g.lineTo(x + W * 0.3, gy - k * 1.8);
      g.lineTo(x + W * 0.36, gy - k * 0.9);
      g.lineTo(x + W * 0.5, gy - k * 0.9);
      g.lineTo(x + W * 0.56, gy);
      g.closePath();
      g.fill();
    }
    const mid = (s.dist * k * 0.45) % (W * 0.6);
    g.fillStyle = 'rgba(85, 139, 47, .45)';
    for (let i = -1; i < 3; i++) cactusShape(g, i * W * 0.6 + W * 0.3 - mid, gy - k * 0.15, k * 0.6);
    // Piso: arena con rayitas que pasan
    g.fillStyle = '#d9a35e';
    g.fillRect(0, gy, W, H - gy);
    g.fillStyle = '#c47a2c';
    g.fillRect(0, gy, W, k * 0.12);
    g.fillStyle = 'rgba(140, 80, 30, .35)';
    const dash = (s.dist * k) % (k * 1.6);
    for (let x = -dash; x < W; x += k * 1.6) g.fillRect(x, gy + k * 0.45, k * 0.5, k * 0.08);

    // Meta: arco a cuadros con bandera
    const fx = sx(s, LENGTH);
    if (fx < W + k * 3) {
      g.fillStyle = '#5d4037';
      g.fillRect(fx - k * 0.1, gy - k * 3.4, k * 0.2, k * 3.4);
      g.fillRect(fx + k * 2.3, gy - k * 3.4, k * 0.2, k * 3.4);
      const cell = k * 0.3;
      for (let row = 0; row < 2; row++) {
        for (let c = 0; c < 9; c++) {
          g.fillStyle = (row + c) % 2 ? '#fff' : '#222';
          g.fillRect(fx + c * cell - k * 0.1, gy - k * 3.4 + row * cell, cell, cell);
        }
      }
      g.fillStyle = '#e53935';
      g.font = `900 ${k * 0.45}px Arial, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('META', fx + k * 1.25, gy - k * 2.5);
      // Línea a cuadros en el piso
      for (let c = 0; c < 6; c++) {
        g.fillStyle = c % 2 ? '#fff' : '#222';
        g.fillRect(fx + k * 1.1, gy + c * k * 0.2, k * 0.3, k * 0.2);
      }
    }

    // Obstáculos
    for (const o of s.obstacles) {
      const x = sx(s, o.x);
      if (x < -k * 3 || x > W + k * 2) continue;
      g.save();
      // El que se chocó sale volando, dando vueltas
      if (o.hit) {
        g.translate(x + o.fly * k * 1.5, gy - o.fly * k * 2 + o.fly * o.fly * k * 1.2);
        g.rotate(o.fly * 4);
        g.globalAlpha = Math.max(0, 1 - o.fly);
        g.translate(-x, -gy);
      }
      drawObstacle(g, o, x, gy, k);
      g.restore();
    }

    drawHorse(s);
  }

  function cactusShape(g, x, base, k) {
    g.beginPath();
    g.roundRect(x - k * 0.22, base - k * 2.3, k * 0.44, k * 2.3, k * 0.22);
    g.roundRect(x - k * 0.75, base - k * 1.5, k * 0.32, k * 0.8, k * 0.16);
    g.roundRect(x - k * 0.75, base - k * 0.95, k * 0.7, k * 0.28, k * 0.14);
    g.roundRect(x + k * 0.43, base - k * 1.8, k * 0.32, k * 0.9, k * 0.16);
    g.roundRect(x + k * 0.05, base - k * 1.15, k * 0.7, k * 0.28, k * 0.14);
    g.fill();
  }

  function drawObstacle(g, o, x, gy, k) {
    const w = o.w * k;
    const ht = o.h * k;
    g.lineWidth = Math.max(1.5, k * 0.06);
    g.strokeStyle = '#3e2723';
    if (o.kind === 'cactus') {
      g.fillStyle = '#558b2f';
      cactusShape(g, x + w / 2, gy, ht / 2.3);
      g.strokeStyle = '#33691e';
      g.stroke();
    } else if (o.kind === 'piedra') {
      g.fillStyle = '#8d8d8d';
      g.beginPath();
      g.moveTo(x, gy);
      g.quadraticCurveTo(x + w * 0.05, gy - ht * 0.9, x + w * 0.45, gy - ht);
      g.quadraticCurveTo(x + w * 0.95, gy - ht * 0.95, x + w, gy);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.beginPath();
      g.ellipse(x + w * 0.35, gy - ht * 0.7, w * 0.15, ht * 0.1, -0.4, 0, Math.PI * 2);
      g.fill();
    } else if (o.kind === 'barril') {
      g.fillStyle = '#a1683a';
      g.beginPath();
      g.roundRect(x, gy - ht, w, ht, w * 0.2);
      g.fill();
      g.stroke();
      g.fillStyle = '#5d4037';
      g.fillRect(x, gy - ht * 0.8, w, ht * 0.08);
      g.fillRect(x, gy - ht * 0.28, w, ht * 0.08);
    } else {
      // Valla de madera: dos postes y dos tablas
      g.fillStyle = '#c8873e';
      g.fillRect(x, gy - ht, w * 0.18, ht);
      g.fillRect(x + w * 0.82, gy - ht, w * 0.18, ht);
      g.fillStyle = '#e0a15a';
      g.fillRect(x - w * 0.05, gy - ht * 0.85, w * 1.1, ht * 0.22);
      g.fillRect(x - w * 0.05, gy - ht * 0.45, w * 1.1, ht * 0.22);
      g.strokeRect(x - w * 0.05, gy - ht * 0.85, w * 1.1, ht * 0.22);
      g.strokeRect(x - w * 0.05, gy - ht * 0.45, w * 1.1, ht * 0.22);
    }
  }

  // Caballo marrón de costado (mirando a la derecha), con patas que galopan
  function drawHorse(s) {
    const g = s.ctx;
    const k = s.k;
    const x = s.horseX;
    const base = s.groundY - s.y * k; // dónde apoyan las patas
    const air = s.y > 0.05;
    const blink = s.safe > 0 && Math.floor(s.t * 12) % 2 === 0; // titila después de un choque
    g.save();
    g.globalAlpha = blink ? 0.45 : 1;
    const gallop = air ? 0 : Math.sin(s.t * 16);
    const bob = air ? 0 : Math.abs(gallop) * k * 0.08;
    const bodyY = base - k * 1.45 - bob;
    const brown = '#8d5524';
    const dark = '#5d3a1a';
    g.lineWidth = Math.max(1.5, k * 0.06);
    g.strokeStyle = '#2b2140';
    g.lineCap = 'round';
    // Patas (dos de atrás y dos de adelante), en el aire van estiradas
    const leg = (lx, phase) => {
      const swing = air ? (phase > 0 ? 0.7 : -0.7) : Math.sin(s.t * 16 + phase) * 0.6;
      const kx = lx + Math.sin(swing) * k * 0.45;
      g.strokeStyle = '#2b2140';
      g.lineWidth = k * 0.26;
      g.beginPath();
      g.moveTo(lx, bodyY + k * 0.25);
      g.lineTo(kx, base - k * 0.12);
      g.stroke();
      g.strokeStyle = brown;
      g.lineWidth = k * 0.16;
      g.stroke();
      g.fillStyle = '#2b2140';
      g.fillRect(kx - k * 0.11, base - k * 0.16, k * 0.22, k * 0.14);
    };
    leg(x - k * 0.7, 0.6);
    leg(x + k * 0.55, 2.4);
    // Cola
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(x - k * 1.0, bodyY - k * 0.15);
    g.quadraticCurveTo(x - k * 1.7, bodyY + k * (air ? -0.2 : 0.2), x - k * 1.55, bodyY + k * 0.75);
    g.quadraticCurveTo(x - k * 1.25, bodyY + k * 0.3, x - k * 0.95, bodyY + k * 0.1);
    g.fill();
    g.stroke();
    // Cuerpo
    g.fillStyle = brown;
    g.beginPath();
    g.ellipse(x, bodyY, k * 1.15, k * 0.5, 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = Math.max(1.5, k * 0.06);
    g.stroke();
    // Cuello y cabeza
    g.beginPath();
    g.moveTo(x + k * 0.65, bodyY - k * 0.2);
    g.lineTo(x + k * 1.15, bodyY - k * 1.0);
    g.lineTo(x + k * 1.5, bodyY - k * 0.95);
    g.lineTo(x + k * 1.15, bodyY + k * 0.15);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.ellipse(x + k * 1.55, bodyY - k * 0.95, k * 0.48, k * 0.24, 0.35, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // Mancha blanca en la cara, ojo y oreja
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(x + k * 1.72, bodyY - k * 0.95, k * 0.22, k * 0.08, 0.35, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2b2140';
    g.beginPath();
    g.arc(x + k * 1.38, bodyY - k * 1.08, k * 0.06, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = brown;
    g.beginPath();
    g.moveTo(x + k * 1.18, bodyY - k * 1.1);
    g.lineTo(x + k * 1.12, bodyY - k * 1.42);
    g.lineTo(x + k * 1.32, bodyY - k * 1.15);
    g.fill();
    g.stroke();
    // Crin
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(x + k * 1.12, bodyY - k * 1.15);
    g.quadraticCurveTo(x + k * 0.75, bodyY - k * 0.7, x + k * 0.55, bodyY - k * 0.3);
    g.lineTo(x + k * 0.75, bodyY - k * 0.25);
    g.quadraticCurveTo(x + k * 0.95, bodyY - k * 0.7, x + k * 1.25, bodyY - k * 0.98);
    g.fill();
    // Montura roja
    g.fillStyle = '#c62828';
    g.beginPath();
    g.ellipse(x - k * 0.05, bodyY - k * 0.42, k * 0.42, k * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();

    // El jinete, sentado en la montura (sigue los saltos y el galope)
    s.rider.style.left = x - k * 0.05 + 'px';
    s.rider.style.top = bodyY + k * 0.05 + 'px';
    s.rider.style.opacity = blink ? '0.45' : '1';
  }

  // ---------- Controles ----------

  function listen(s) {
    s.stage.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sfx.init();
      jump(s);
    });
    const onKey = (e) => {
      if (!alive(s)) return removeEventListener('keydown', onKey);
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        jump(s);
      }
    };
    addEventListener('keydown', onKey);
  }

  function jump(s) {
    if (!s.running || s.done) return;
    stopHint(s);
    if (s.y <= 0.02) {
      s.vy = JUMP;
      sfx.whee();
    } else {
      s.queued = 0.18; // si toca justo antes de caer, salta apenas toca el piso
    }
  }

  // Manito que muestra que hay que tocar, la primera vez que se acerca un obstáculo
  function showHint(s) {
    if (!s.hand.hidden) return;
    s.hand.hidden = false;
    s.hand.style.left = s.W * 0.5 + 'px';
    s.hand.style.top = s.H * 0.45 + 'px';
    s.handAnim = s.hand.animate([{ transform: 'scale(1)' }, { transform: 'scale(.8) translateY(8%)' }, { transform: 'scale(1)' }], { duration: 450, iterations: Infinity });
  }

  function stopHint(s) {
    if (s.handAnim) s.handAnim.cancel();
    s.handAnim = null;
    s.hand.hidden = true;
  }

  // ---------- Juego ----------

  function loop(s) {
    if (!alive(s)) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - s.last) / 1000);
    s.last = now;
    if (s.running && !s.done) step(s, dt);
    draw(s);
    setTimeout(() => loop(s), 16);
  }

  function step(s, dt) {
    s.t += dt;
    // Avanza (después de un choque, un ratito más despacio)
    s.slow = Math.max(0, s.slow - dt);
    s.safe = Math.max(0, s.safe - dt);
    s.dist += SPEED * (s.slow > 0 ? 0.55 : 1) * dt;
    // Salto
    if (s.y > 0 || s.vy > 0) {
      s.vy -= GRAVITY * dt;
      s.y = Math.max(0, s.y + s.vy * dt);
      if (s.y === 0) {
        s.vy = 0;
        if (s.queued > 0) {
          s.vy = JUMP;
          sfx.whee();
        }
      }
    }
    s.queued = Math.max(0, s.queued - dt);
    // Galope: cloc-cloc
    s.clop += dt;
    if (s.y === 0 && s.clop > 0.19) {
      s.clop = 0;
      sfx.notes([[Math.random() < 0.5 ? 520 : 440, 0, 0.04, 'triangle', 0.05]]);
    }
    // Choques: las patas del caballo contra el obstáculo (con un poco de margen a favor)
    for (const o of s.obstacles) {
      if (o.hit) {
        o.fly = Math.min(1.2, o.fly + dt * 1.6);
        continue;
      }
      const ahead = o.x - s.dist; // distancia del caballo al obstáculo
      if (s.hinted < 2 && ahead > 3.5 && ahead < 4.5 && s.y === 0) {
        s.hinted++;
        showHint(s);
        voice.say('¡Saltá!');
      }
      const overlap = ahead < 0.5 && ahead + o.w > -0.6; // las patas del caballo, de -0,6 a 0,5
      if (overlap && s.safe === 0 && s.y < o.h - 0.3) crash(s, o);
    }
    s.marker.style.left = Math.min(100, (s.dist / LENGTH) * 100) + '%';
    if (s.dist >= LENGTH + 1.2) finish(s, true);
  }

  async function crash(s, o) {
    o.hit = true;
    s.lives--;
    s.hits++;
    s.slow = 0.8;
    s.safe = 1.3;
    stopHint(s);
    sfx.noise(0.3, 'lowpass', 300, 0.4, 0.01);
    sfx.aww();
    const heart = s.hearts.children[s.lives];
    if (heart) heart.classList.add('lost');
    if (s.lives <= 0) return finish(s, false);
    BQ.sport.flash(s.flash, '¡UY!', 'saved');
    voice.say(s.lives === 1 ? '¡Cuidado! Te queda un corazón.' : '¡Uy! ¡Saltá los obstáculos!');
    await wait(900);
    if (alive(s) && !s.done) s.flash.hidden = true;
  }

  async function finish(s, arrived) {
    if (s.done) return;
    s.done = true;
    stopHint(s);
    if (arrived) {
      BQ.sport.flash(s.flash, '¡LLEGASTE!', 'goal');
      sfx.cheer();
      sfx.win();
      ui().burst(s.stage);
    } else {
      BQ.sport.flash(s.flash, '¡AY!', 'saved');
    }
    await wait(1500);
    if (!alive(s)) return;
    s.flash.hidden = true;
    BQ.sport.result({
      screen: s.screen,
      won: arrived,
      perfect: arrived && s.hits === 0,
      detail: h('div', { class: 'mt-final' }, arrived ? h('span', { class: 'emoji' }, '🏁') : '', arrived ? ' ' + '❤️'.repeat(s.lives) : ''),
      onAgain: startGame,
      winSay: s.hits === 0 ? '¡Llegaste a la meta sin chocar nada! ¡Te ganaste una moneda!' : '¡Llegaste a la meta! ¡Te ganaste una moneda!',
      loseSay: '¡Ay, se terminaron los corazones! ¡Probá otra vez!',
      isAlive: () => alive(s),
    });
  }

  // state y advance: para revisar una carrera desde la consola (advance adelanta n cuadros de dt segundos)
  BQ.carrera = { open, state: () => S, advance: (n, dt = 0.016) => { for (let i = 0; i < n && S && S.running && !S.done; i++) step(S, dt); }, jump: () => jump(S) };
})(window.BQ);
