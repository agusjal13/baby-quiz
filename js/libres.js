(function (BQ) {
  'use strict';

  /*
   * Tiros libres: se patea arrastrando el dedo hacia el arco (sin preguntas). 5 tiros; con 3 goles
   * se gana (los 5 = resultado perfecto). Ganar da monedas y suma para los trofeos, como los otros.
   *
   * El dedo decide todo:
   *   - hacia dónde: la dirección del arrastre (de punta a punta)
   *   - la potencia: qué tan rápido se arrastra (flojito pega en la barrera; muy fuerte, va por arriba)
   *   - la comba: si el arrastre es curvo, la pelota sale para un lado y dobla para el otro
   *     (sirve para pasar por al lado de la barrera y para engañar al arquero)
   *
   * Mundo en metros: x de costado (0 = medio del arco), y altura, z profundidad (pelota en z=0).
   * La barrera está en z=9 y el arco en z=20 (7,3 m de ancho y 2,4 de alto). Se dibuja en un canvas
   * con perspectiva desde atrás de la pelota; los jugadores son los muñequitos encima del canvas.
   */

  const U = BQ.util;
  const h = U.h;
  const store = BQ.store;
  const voice = BQ.voice;
  const sfx = BQ.sfx;
  const ui = () => BQ.ui;
  const wait = BQ.sport.wait;

  const KICKS = 5;
  const TO_WIN = 3;
  const GOAL_Z = 20;
  const KEEPER_Z = GOAL_Z - 0.8; // el arquero, un pasito adelante de la línea
  const WALL_Z = 9;
  const POST = 3.66; // medio ancho del arco
  const BAR = 2.44;
  const BALL_R = 0.17; // más grande que la real, para que se vea bien de lejos
  const WALL_H = 1.85;
  const CAM_Z = -11;
  const CAM_H = 7; // cámara bien alta: el arco se ve por encima de la barrera y queda lugar para arrastrar
  const PEOPLE = 0.8; // los jugadores, un poco más chicos que de verdad, para que no tapen
  const THEME = { sky1: '#29b6f6', sky2: '#b3e5fc', ground: '#2e7d32', decor: ['⚽', '🥅', '⭐', '🎉', '🏆'] };

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
    const canvas = h('canvas', { class: 'tl-canvas' });
    const field = h('div', { class: 'tl-field' }, canvas);
    const wall = Array.from({ length: 4 }, () => h('span', { class: 'tl-player wall' }, BQ.puppet.el(rival, [])));
    const keeper = h('span', { class: 'tl-player keeper' }, BQ.puppet.el(rival, []));
    const kicker = h('span', { class: 'tl-player kicker' }, BQ.puppet.el(mine));
    const hand = h('span', { class: 'hand emoji tl-hand', hidden: true }, '👆');
    const flash = h('div', { class: 'sport-flash', hidden: true });
    const trail = h('canvas', { class: 'tl-trail' });
    // La pelota va en su propia capa, que se pone delante o detrás de cada muñequito según la distancia
    const ballLayer = h('canvas', { class: 'tl-ball' });
    field.append(...wall, keeper, kicker, ballLayer, trail, hand, flash);
    const score = h('div', { class: 'pen-score' }, Array.from({ length: KICKS }, () => h('span', { class: 'pen-slot' })));

    const screen = h('div', { class: 'screen libres' },
      ui().topbar(ui().backBtn(() => { S = null; ui().showWorlds(); }), score, h('span', { class: 'spacer' })),
      field);
    ui().show(screen, THEME);

    const s = {
      screen, field, canvas, ctx: canvas.getContext('2d'), trail, tctx: trail.getContext('2d'),
      ballLayer, bctx: ballLayer.getContext('2d'),
      wall, keeper, kicker, hand, flash, score,
      ball: { x: 0, y: BALL_R, z: 0, spin: 0 },
      wallX: 0, keeperX: 0, keeperHome: 0, keeperDive: null, wallJump: 0,
      kick: 0, goals: 0, ready: false, drag: null, flying: false, shownHint: false, t0: performance.now(),
    };
    S = s;
    resize(s);
    const ro = new ResizeObserver(() => { if (alive(s)) { resize(s); render(s); } else ro.disconnect(); });
    ro.observe(field);
    listen(s);
    setupKick(s);
    idle(s);

    sfx.whistle();
    voice.say('¡Pateá al arco con el dedo!').then(() => { if (alive(s)) ready(s); });
  }

  // ---------- Vista ----------

  function resize(s) {
    const r = s.field.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    s.W = Math.max(1, r.width);
    s.H = Math.max(1, r.height);
    for (const c of [s.canvas, s.trail, s.ballLayer]) {
      c.width = Math.round(s.W * dpr);
      c.height = Math.round(s.H * dpr);
    }
    s.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    s.tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    s.bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // La pelota queda abajo de todo (y = 86 %) y el travesaño cerca de arriba (y = 14 %);
    // el horizonte puede quedar fuera de la pantalla (se ve la tribuna detrás del arco)
    const near = CAM_H / (0 - CAM_Z);
    const bar = (CAM_H - BAR) / (GOAL_Z - CAM_Z);
    s.F = Math.min(s.W * 2.9, (s.H * 0.72) / (near - bar));
    s.horizon = s.H * 0.86 - near * s.F;
  }

  function project(s, x, y, z) {
    const dz = z - CAM_Z;
    if (dz < 0.5) return null;
    const k = s.F / dz;
    return { x: s.W / 2 + x * k, y: s.horizon + (CAM_H - y) * k, k };
  }

  function line(s, a, b, color, width) {
    const p = project(s, ...a);
    const q = project(s, ...b);
    if (!p || !q) return;
    const g = s.ctx;
    g.beginPath();
    g.moveTo(p.x, p.y);
    g.lineTo(q.x, q.y);
    g.strokeStyle = color;
    g.lineWidth = width * Math.min(p.k, q.k);
    g.lineCap = 'round';
    g.stroke();
  }

  function render(s) {
    const g = s.ctx;
    const { W, H } = s;
    // Cielo y tribuna
    const sky = g.createLinearGradient(0, 0, 0, s.horizon);
    sky.addColorStop(0, '#4fc3f7');
    sky.addColorStop(1, '#b3e5fc');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    const standZ = GOAL_Z + 7;
    const standTop = project(s, 0, 6, standZ).y;
    const standBottom = project(s, 0, 0, standZ).y;
    g.fillStyle = '#5c6bc0';
    g.fillRect(0, standTop, W, standBottom - standTop);
    // Público: puntitos de colores
    const colors = ['#ffeb3b', '#ff5a8a', '#fff', '#81d4fa', '#ff9800'];
    for (let i = 0; i < 90; i++) {
      const x = ((i * 97) % 1000) / 1000 * W;
      const y = standTop + 4 + ((i * 37) % 100) / 100 * (standBottom - standTop - 12);
      g.fillStyle = colors[i % colors.length];
      g.beginPath();
      g.arc(x, y + Math.sin(performance.now() / 300 + i) * (s.celebrate ? 3 : 0.6), Math.max(2, H * 0.007), 0, Math.PI * 2);
      g.fill();
    }
    // Césped a franjas
    for (let i = 0; i < 16; i++) {
      const z1 = -6 + i * 2.5;
      const a = project(s, -40, 0, z1);
      const b = project(s, -40, 0, z1 + 2.5);
      if (!a || !b) continue;
      g.fillStyle = i % 2 ? '#43a047' : '#4caf50';
      g.fillRect(0, b.y, W, a.y - b.y + 1);
    }
    const far = project(s, 0, 0, 34);
    g.fillStyle = '#4caf50';
    g.fillRect(0, standBottom, W, far.y - standBottom + 1);

    // Líneas del área
    const white = 'rgba(255,255,255,.85)';
    line(s, [-20, 0, GOAL_Z], [20, 0, GOAL_Z], white, 0.12);
    line(s, [-20, 0, GOAL_Z - 16.5], [20, 0, GOAL_Z - 16.5], white, 0.12);
    line(s, [-9.2, 0, GOAL_Z - 5.5], [9.2, 0, GOAL_Z - 5.5], white, 0.12);
    line(s, [-9.2, 0, GOAL_Z - 5.5], [-9.2, 0, GOAL_Z], white, 0.12);
    line(s, [9.2, 0, GOAL_Z - 5.5], [9.2, 0, GOAL_Z], white, 0.12);

    drawGoal(s);
    // La pelota se dibuja delante o detrás de la red según dónde está
    drawBall(s);
    placePlayers(s);
  }

  function drawGoal(s) {
    const g = s.ctx;
    const back = GOAL_Z + 1.6;
    // Red: fondo y cuadriculado
    const tl = project(s, -POST, BAR, back);
    const br = project(s, POST, 0, back);
    g.fillStyle = 'rgba(255,255,255,.18)';
    g.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    const net = 'rgba(255,255,255,.45)';
    const bulge = s.netShake ? Math.sin(performance.now() / 40) * 0.25 * s.netShake : 0;
    for (let x = -POST; x <= POST + 0.01; x += 0.5) line(s, [x, 0, back + bulge], [x, BAR, back + bulge], net, 0.03);
    for (let y = 0; y <= BAR + 0.01; y += 0.4) line(s, [-POST, y, back + bulge], [POST, y, back + bulge], net, 0.03);
    for (let z = GOAL_Z; z <= back; z += 0.4) {
      line(s, [-POST, BAR, z], [POST, BAR, z], net, 0.03);
      line(s, [-POST, 0, z], [-POST, BAR, z], net, 0.03);
      line(s, [POST, 0, z], [POST, BAR, z], net, 0.03);
    }
    // Palos y travesaño
    const post = s.postHit ? '#ffd23f' : '#fff';
    line(s, [-POST, 0, GOAL_Z], [-POST, BAR, GOAL_Z], post, 0.14);
    line(s, [POST, 0, GOAL_Z], [POST, BAR, GOAL_Z], post, 0.14);
    line(s, [-POST, BAR, GOAL_Z], [POST, BAR, GOAL_Z], post, 0.14);
  }

  function drawBall(s) {
    const g = s.bctx;
    const b = s.ball;
    g.clearRect(0, 0, s.W, s.H);
    s.ballLayer.style.zIndex = String(Math.round(1000 - b.z * 10)); // igual que los muñequitos (placeAt)
    const sh = project(s, b.x, 0, b.z);
    const c = project(s, b.x, b.y, b.z);
    if (!sh || !c) return;
    const r = BALL_R * c.k;
    // Sombra
    g.fillStyle = 'rgba(0,0,0,.25)';
    g.beginPath();
    g.ellipse(sh.x, sh.y, r * 1.1, r * 0.35, 0, 0, Math.PI * 2);
    g.fill();
    // Pelota con gajos que giran
    g.save();
    g.translate(c.x, c.y);
    g.rotate(b.spin);
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#333';
    g.lineWidth = Math.max(1, r * 0.08);
    g.stroke();
    g.fillStyle = '#222';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.beginPath();
      g.arc(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, r * 0.2, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.arc(0, 0, r * 0.26, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // Los muñequitos se paran en su lugar de la cancha y se achican con la distancia
  function placeAt(s, el, x, z, height, lift = 0) {
    height *= PEOPLE;
    const p = project(s, x, lift, z);
    if (!p) return;
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    el.style.fontSize = (height * p.k) / 1.12 + 'px';
    el.style.zIndex = String(Math.round(1000 - z * 10));
  }

  function placePlayers(s) {
    s.wall.forEach((el, i) => placeAt(s, el, s.wallX + (i - 1.5) * 0.62, WALL_Z, WALL_H + 0.25, s.wallJump));
    const d = s.keeperDive;
    placeAt(s, s.keeper, s.keeperX, KEEPER_Z, 2.0, d ? d.lift : 0);
    s.keeper.style.rotate = d ? d.rot + 'deg' : '0deg';
    placeAt(s, s.kicker, -0.9, -0.6, 1.0);
  }

  // Animación tranquila entre tiros: el arquero se mueve un poco y la tribuna salta si hay gol
  function idle(s) {
    if (!alive(s)) return;
    if (!s.flying) {
      const t = (performance.now() - s.t0) / 1000;
      s.keeperX = s.keeperHome + Math.sin(t * 1.6) * 0.5;
      render(s);
    }
    requestAnimationFrame(() => idle(s));
  }

  // ---------- Cada tiro ----------

  function setupKick(s) {
    // La barrera tapa un lado del arco y el arquero cuida el otro
    const side = U.pick([-1, 1]);
    s.wallX = side * U.pick([0.9, 1.4, 1.9]);
    s.keeperHome = -side * 1.1;
    s.keeperX = s.keeperHome;
    s.keeperDive = null;
    s.wallJump = 0;
    s.netShake = 0;
    s.postHit = false;
    s.celebrate = false;
    Object.assign(s.ball, { x: 0, y: BALL_R, z: 0, spin: 0 });
    s.flash.hidden = true;
    s.tctx.clearRect(0, 0, s.W, s.H);
    [...s.score.children].forEach((sl, i) => sl.classList.toggle('now', i === s.kick));
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
    const c = project(s, 0, BALL_R, 0);
    if (!c) return;
    s.hand.hidden = false;
    s.hand.style.left = c.x + 'px';
    s.hand.style.top = c.y + 'px';
    const up = -s.H * 0.35;
    s.handAnim = s.hand.animate([
      { transform: 'translate(0, 0)', opacity: 0 },
      { transform: 'translate(0, 0)', opacity: 1, offset: 0.15 },
      { transform: `translate(${-s.W * 0.06}px, ${up * 0.5}px)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${s.W * 0.04}px, ${up}px)`, opacity: 1, offset: 0.8 },
      { transform: `translate(${s.W * 0.04}px, ${up}px)`, opacity: 0 },
    ], { duration: 1500, iterations: 3 });
    s.handAnim.onfinish = () => stopHint(s);
  }

  function stopHint(s) {
    if (s.handAnim) s.handAnim.cancel();
    s.handAnim = null;
    s.hand.hidden = true;
  }

  // ---------- Arrastrar para patear ----------

  function point(s, e) {
    const r = s.field.getBoundingClientRect();
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
    g.strokeStyle = 'rgba(255,255,255,.75)';
    g.lineWidth = Math.max(6, s.H * 0.018);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.stroke();
  }

  function listen(s) {
    const box = s.field;
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
      const dy = end.y - first.y;
      const dx = end.x - first.x;
      if (pts.length < 3 || dy > -s.H * 0.08) { // muy cortito o no fue hacia el arco
        s.tctx.clearRect(0, 0, s.W, s.H);
        voice.say('¡Arrastrá el dedo hacia el arco!');
        showHint(s);
        return;
      }
      setTimeout(() => s.tctx.clearRect(0, 0, s.W, s.H), 500);
      shoot(s, readSwipe(s, pts, dx, dy));
    };
    box.addEventListener('pointerup', release);
    box.addEventListener('pointercancel', release);
  }

  // Del arrastre salen la dirección, la potencia y la comba
  function readSwipe(s, pts, dx, dy) {
    const angle = (a, b) => Math.atan2(b.x - a.x, -(b.y - a.y)); // 0 = derecho hacia arriba
    const at = (f) => pts[Math.min(pts.length - 1, Math.round(f * (pts.length - 1)))];
    // Dirección: la pelota va adonde apunta el arrastre (de punta a punta) en la pantalla:
    // se sigue esa recta desde la pelota hasta la altura del arco
    const ball = project(s, 0, BALL_R, 0);
    const aim = project(s, 0, 1, GOAL_Z);
    const sx = ball.x + dx * ((aim.y - ball.y) / dy);
    const xEnd = clamp((sx - s.W / 2) / aim.k, -6, 6);
    // Comba: cuánto cambia la dirección entre el principio y el final del arrastre
    const turn = angle(at(0.55), at(1)) - angle(at(0), at(0.45));
    const curve = clamp(turn * 3.2, -3.2, 3.2);
    // Potencia: velocidad del dedo en el último tramo, en "pantallas por segundo"
    const last = pts.find((p) => pts[pts.length - 1].t - p.t <= 220) || pts[0];
    const dt = Math.max(16, pts[pts.length - 1].t - last.t);
    const speed = ((last.y - pts[pts.length - 1].y) / dt) * 1000 / s.H;
    // Un arrastre normal da potencia media; hay que arrastrar MUY rápido para que se vaya por arriba
    const raw = (speed - 0.4) / 3;
    return { xEnd, curve, power: clamp(raw, 0, 1), over: raw > 1.3 };
  }

  async function shoot(s, { xEnd, curve, power, over }) {
    s.ready = false;
    s.flying = true;
    BQ.puppet.use(s.kicker.querySelector('.avatar'), 'kick');
    await wait(220);
    if (!alive(s)) return;
    sfx.kick();

    // Altura al llegar al arco y "panza" del vuelo (para pasar la barrera)
    const hEnd = over ? 3.1 : 0.25 + power * 1.95;
    const bump = 1.4 + power * 1.0;
    // x(u) = a·u + c·u²: sale con pendiente a y termina con a + 2c (la comba)
    const c = curve;
    const a = xEnd - c;
    const xAt = (u) => a * u + c * u * u;
    const yAt = (u) => BALL_R + hEnd * u + bump * 4 * u * (1 - u);
    const T = 1300 - power * 550; // ms hasta el arco

    // ¿Qué pasa? Barrera, palo, afuera, arquero o gol
    const uw = WALL_Z / GOAL_Z;
    const blocked = yAt(uw) < WALL_H + 0.2 && Math.abs(xAt(uw) - s.wallX) < 1.25;
    const keeperAt = s.keeperX;
    const reach = clamp(0.95 - Math.abs(c) * 0.2 - power * 0.3 + (hEnd > 1.9 ? -0.2 : 0), 0.45, 1.1);
    let result;
    if (blocked) result = 'wall';
    else if (over || hEnd > BAR - BALL_R) result = 'over';
    else if (Math.abs(xEnd) > POST + 0.15) result = 'out';
    else if (Math.abs(xEnd) > POST - 0.2) result = 'post';
    else if (Math.abs(xEnd - keeperAt) < reach) result = 'save';
    else result = 'goal';
    s.last = { xEnd, curve, power, result, ball: s.ball }; // para revisar los tiros desde la consola

    // La barrera salta, el arquero se tira (llega si ataja; si no, se tira tarde)
    const dir = Math.sign(xEnd - keeperAt) || 1;
    // (al tirarse queda acostado: las manos quedan medio metro más allá del cuerpo)
    const diveTo = result === 'save' ? xEnd - dir * 0.5 : keeperAt + dir * Math.min(1.1, Math.abs(xEnd - keeperAt));
    const start = performance.now();
    await new Promise((done) => {
      const step = () => {
        if (!alive(s)) return done();
        const t = performance.now() - start;
        const uRaw = t / T;
        const stopAt = result === 'wall' ? uw : result === 'save' ? (KEEPER_Z - 0.4) / GOAL_Z : 1;
        const u = Math.min(uRaw, stopAt);
        s.ball.x = xAt(u);
        s.ball.y = yAt(u);
        s.ball.z = u * GOAL_Z;
        s.ball.spin += 0.25 + c * 0.05;
        // Barrera: salta cuando la pelota se acerca
        const jw = Math.max(0, 1 - Math.abs(uRaw - uw * 0.8) / 0.25);
        s.wallJump = 0.25 * jw;
        // Arquero: se tira en la segunda mitad del vuelo
        const kd = clamp((uRaw - 0.45) / 0.45, 0, 1);
        if (result !== 'wall' && kd > 0) {
          s.keeperX = keeperAt + (diveTo - keeperAt) * kd;
          // Se estira hacia la pelota: sube según la altura a la que llega el tiro
          s.keeperDive = { rot: dir * 70 * kd, lift: Math.min(0.9, hEnd * 0.4) * Math.sin(kd * Math.PI / 2) };
        }
        render(s);
        if (uRaw >= stopAt) return done();
        setTimeout(step, 16);
      };
      setTimeout(step, 16);
      // Tope por si algo se traba (con la pantalla en segundo plano los tiempos se estiran)
      setTimeout(done, T + 600);
    });
    if (!alive(s)) return;

    await afterShot(s, result, c);
  }

  async function afterShot(s, result, curve) {
    const slot = s.score.children[s.kick];
    slot.classList.remove('now');
    const goal = result === 'goal';
    // Movimiento final de la pelota
    if (goal) {
      s.goals++;
      slot.classList.add('goal');
      s.netShake = 1;
      s.celebrate = true;
      bounce(s, { z: GOAL_Z + 1.4, y: s.ball.y * 0.6 });
      BQ.sport.flash(s.flash, '¡GOOOL!', 'goal');
      sfx.cheer();
      sfx.correct();
      BQ.puppet.use(s.kicker.querySelector('.avatar'));
    } else {
      slot.classList.add('saved');
      if (result === 'post') {
        s.postHit = true;
        sfx.notes([[1200, 0, 0.25, 'square', 0.08], [900, 0.05, 0.3, 'square', 0.06]]);
      } else if (result === 'save') {
        sfx.kick(); // el manotazo del arquero
        sfx.aww();
      } else sfx.aww();
      const back = { wall: { z: WALL_Z - 3, y: 0.3 }, save: { z: GOAL_Z - 10, y: 0.2, x: s.ball.x + (Math.sign(s.ball.x - s.keeperX) || 1) * 2.5, arc: 1.6, ms: 900 }, post: { z: GOAL_Z - 5, y: 0.2, x: s.ball.x * 1.4 } }[result]
        || { z: GOAL_Z + 6, y: result === 'over' ? 4 : 0.5, x: s.ball.x * 1.5 };
      bounce(s, back);
      const text = { wall: '¡BARRERA!', save: '¡ATAJÓ!', post: '¡PALO!', over: '¡ARRIBA!', out: '¡AFUERA!' }[result];
      BQ.sport.flash(s.flash, text, 'saved');
    }
    const say = goal
      ? (Math.abs(curve) > 1.2 ? '¡Gol con comba!' : '¡Gol!')
      : { wall: '¡Más fuerte!', save: '¡Atajó!', post: '¡Palo!', over: '¡Muy fuerte!', out: '¡Afuera!' }[result];
    await Promise.all([voice.say(say), wait(1800)]);
    if (!alive(s)) return;

    s.kick++;
    s.flying = false;
    // Se patean siempre los 5 (para poder hacer el perfecto)
    if (s.kick >= KICKS) return finish(s);
    setupKick(s);
    ready(s);
  }

  // La pelota rebota o entra en la red (animación corta hacia "to")
  function bounce(s, to) {
    const from = { ...s.ball };
    const start = performance.now();
    const step = () => {
      if (!alive(s)) return;
      const t = Math.min(1, (performance.now() - start) / (to.ms || 600));
      const e = 1 - (1 - t) * (1 - t);
      s.ball.z = from.z + ((to.z ?? from.z) - from.z) * e;
      s.ball.x = from.x + ((to.x ?? from.x) - from.x) * e;
      s.ball.y = Math.max(BALL_R, from.y + ((to.y ?? from.y) - from.y) * e + Math.sin(t * Math.PI) * (to.arc ?? 0.4));
      s.ball.spin += 0.15;
      s.netShake = Math.max(0, (s.netShake || 0) - 0.02);
      render(s);
      if (t < 1) setTimeout(step, 16);
    };
    setTimeout(step, 16);
  }

  function finish(s) {
    const won = s.goals >= TO_WIN;
    s.flash.hidden = true;
    s.ready = false;
    BQ.sport.result({
      screen: s.screen,
      won,
      perfect: s.goals === KICKS,
      detail: h('div', { class: 'pen-final' },
        [...s.score.children].map((sl) => h('span', { class: 'pen-slot ' + (sl.classList.contains('goal') ? 'goal' : 'saved') }))),
      onAgain: startGame,
      winSay: `¡Ganaste! ¡Hiciste ${s.goals} goles! ¡Te ganaste una moneda!`,
      loseSay: s.goals === 1 ? '¡Casi! Hiciste un gol. ¡Jugá otra vez!' : `¡Casi! Hiciste ${s.goals} goles. ¡Jugá otra vez!`,
      isAlive: () => alive(s),
    });
  }

  BQ.libres = { open, last: () => S && S.last };
})(window.BQ);
