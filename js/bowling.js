(function (BQ) {
  'use strict';

  /*
   * Bowling: se juega arrastrando el dedo hacia arriba sobre la bola (sin preguntas).
   * 3 cuadros de hasta 2 tiros. Gana si voltea 15 pinos o más (de 30); ganar da una moneda
   * y suma para los trofeos, como los otros juegos.
   *
   * Pista SVG de 200 x 400 vista desde arriba: canaletas a los costados (x < 26 y x > 174),
   * línea de tiro en y=330 y los 10 pinos al fondo, con el primero en (100, 120).
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
  const LANE = [26, 174]; // bordes de la pista; afuera son las canaletas
  const BALL_START = [100, 355];
  const PIN_SPOTS = [
    [100, 120],
    [90, 104], [110, 104],
    [80, 88], [100, 88], [120, 88],
    [70, 72], [90, 72], [110, 72], [130, 72],
  ];
  const OUT = '#2b2140';
  const THEME = { sky1: '#2b2d5c', sky2: '#6a4c9c', ground: '#1f1b3a', decor: ['🎳', '⭐', '✨', '🎉', '🏆'] };

  let S = null;
  const alive = (s) => S === s && s.screen.isConnected;

  function laneSvg() {
    const arrows = [70, 85, 100, 115, 130].map((x) => `<polygon points="${x},250 ${x - 4},260 ${x + 4},260" fill="#b27a3c"/>`).join('');
    const boards = Array.from({ length: 12 }, (_, i) => `<line x1="${26 + i * 12.3}" y1="0" x2="${26 + i * 12.3}" y2="400" stroke="rgba(120,70,20,.18)" stroke-width="1"/>`).join('');
    const pin = (i) => `<g class="bw-pin" data-i="${i}">`
      + `<ellipse cx="0" cy="3" rx="${PIN_R}" ry="3" fill="rgba(0,0,0,.18)"/>`
      + `<circle r="${PIN_R}" fill="#fff" stroke="${OUT}" stroke-width="1.4"/>`
      + `<circle r="${PIN_R - 2.2}" fill="none" stroke="#e53935" stroke-width="1.3"/><circle r="1.6" fill="#fff"/></g>`;
    return `<svg class="bw-lane" viewBox="0 0 200 400" preserveAspectRatio="xMidYMid meet">`
      + `<defs><linearGradient id="bw-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8b878"/><stop offset="1" stop-color="#d59a55"/></linearGradient></defs>`
      + `<rect x="0" y="0" width="200" height="400" rx="10" fill="#3a3355"/>`
      + `<rect x="8" y="0" width="18" height="400" fill="#5b5577"/><rect x="174" y="0" width="18" height="400" fill="#5b5577"/>`
      + `<rect x="26" y="0" width="148" height="400" fill="url(#bw-wood)"/>${boards}`
      + `<rect x="26" y="0" width="148" height="40" fill="#1f1b3a" opacity=".85"/>`
      + `<line x1="26" y1="330" x2="174" y2="330" stroke="#e53935" stroke-width="2"/>`
      + arrows
      + PIN_SPOTS.map((_, i) => pin(i)).join('')
      + `<g class="bw-ball"><circle r="${BALL_R}" fill="#6a3de8" stroke="${OUT}" stroke-width="2"/>`
      + `<circle cx="-3" cy="-4" r="2" fill="${OUT}"/><circle cx="3" cy="-4" r="2" fill="${OUT}"/><circle cx="0" cy="2" r="2" fill="${OUT}"/>`
      + `<circle cx="-5" cy="-6" r="3" fill="rgba(255,255,255,.35)"/></g>`
      + `</svg>`;
  }

  // ---------- Pantalla ----------

  function open() {
    if (!store.data.character) {
      store.data.character = 'futbolista';
      store.save();
    }
    startGame();
  }

  function startGame() {
    const lane = h('div', { class: 'bw-lane-box', html: laneSvg() });
    const flash = h('div', { class: 'sport-flash', hidden: true });
    const hand = h('span', { class: 'hand emoji bw-hand', hidden: true }, '👆');
    lane.append(flash, hand);
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

    const svg = lane.querySelector('svg');
    const s = {
      screen, lane, svg, flash, hand, board, hero, tip,
      ball: { g: svg.querySelector('.bw-ball'), x: BALL_START[0], y: BALL_START[1], vx: 0, vy: 0, gutter: false },
      pins: [...svg.querySelectorAll('.bw-pin')].map((g, i) => ({ g, i, x: PIN_SPOTS[i][0], y: PIN_SPOTS[i][1], vx: 0, vy: 0, down: false, gone: false, rot: 0 })),
      frame: 0, throwN: 0, scores: [], ready: false, drag: null, shownHint: false,
    };
    S = s;
    placeBall(s);
    s.pins.forEach(placePin);
    listen(s);

    sfx.whistle();
    voice.say('¡A jugar al bowling! Arrastrá la bola hacia arriba para tirar. ¡Voltiá quince pinos para ganar!')
      .then(() => { if (alive(s)) readyToThrow(s); });
  }

  // ---------- Dibujo ----------

  // La bola se achica un poco a medida que se aleja (sensación de profundidad)
  function placeBall(s) {
    const b = s.ball;
    const sc = 0.62 + 0.38 * Math.max(0, Math.min(1, b.y / 360));
    b.g.style.transform = `translate(${b.x.toFixed(2)}px, ${b.y.toFixed(2)}px) scale(${sc.toFixed(3)})`;
  }

  function placePin(p) {
    p.g.style.transform = `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px) rotate(${p.rot.toFixed(1)}deg) scale(${p.down ? 0.85 : 1})`;
    p.g.style.opacity = p.gone ? '0' : p.down ? '.55' : '1';
  }

  // ---------- Arrastrar para tirar ----------

  // Punto de la pantalla en coordenadas de la pista
  function toLane(s, e) {
    const r = s.svg.getBoundingClientRect();
    const k = Math.min(r.width / 200, r.height / 400);
    const ox = r.left + (r.width - 200 * k) / 2;
    const oy = r.top + (r.height - 400 * k) / 2;
    return { x: (e.clientX - ox) / k, y: (e.clientY - oy) / k, t: performance.now() };
  }

  function listen(s) {
    const box = s.lane;
    box.addEventListener('pointerdown', (e) => {
      if (!s.ready) return;
      e.preventDefault();
      sfx.init();
      try { box.setPointerCapture(e.pointerId); } catch (err) { /* sigue sin captura */ }
      s.drag = { id: e.pointerId, pts: [toLane(s, e)] };
      stopHint(s);
    });
    box.addEventListener('pointermove', (e) => {
      if (!s.drag || e.pointerId !== s.drag.id) return;
      const p = toLane(s, e);
      s.drag.pts.push(p);
      if (s.drag.pts.length > 40) s.drag.pts.shift();
      // Antes de soltar, la bola acompaña el dedo de costado para apuntar (sin acercarse a la canaleta)
      s.ball.x = Math.max(62, Math.min(138, p.x));
      placeBall(s);
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
      if (dy > -18) { // no fue hacia arriba
        voice.say('¡Arrastrá hacia arriba, bien rápido!');
        showHint(s);
        return;
      }
      // Fuerza según la velocidad del dedo; de costado, con ayudita para no ir a la canaleta
      const speed = Math.max(6, Math.min(13, (-dy / dt) * 16 * 0.9));
      const side = Math.max(-0.12, Math.min(0.12, (dx / -dy) * 0.35));
      roll(s, side * speed, -speed);
    };
    box.addEventListener('pointerup', release);
    box.addEventListener('pointercancel', release);
  }

  function readyToThrow(s) {
    s.ready = true;
    s.tip.textContent = `Cuadro ${s.frame + 1} · tiro ${s.throwN + 1}: ¡arrastrá la bola hacia arriba!`;
    if (!s.shownHint) {
      s.shownHint = true;
      showHint(s);
    }
  }

  // Manito que muestra el movimiento: desde la bola hacia arriba
  function showHint(s) {
    stopHint(s);
    const r = s.svg.getBoundingClientRect();
    const k = Math.min(r.width / 200, r.height / 400);
    const box = s.lane.getBoundingClientRect();
    const x = r.left - box.left + (r.width - 200 * k) / 2 + s.ball.x * k;
    const y = r.top - box.top + (r.height - 400 * k) / 2 + s.ball.y * k;
    s.hand.hidden = false;
    s.hand.style.left = x + 'px';
    s.hand.style.top = y + 'px';
    s.handAnim = s.hand.animate([
      { transform: 'translate(0, 0)', opacity: 0 },
      { transform: 'translate(0, 0)', opacity: 1, offset: 0.2 },
      { transform: `translate(0, ${-140 * k}px)`, opacity: 1, offset: 0.8 },
      { transform: `translate(0, ${-140 * k}px)`, opacity: 0 },
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
    sfx.noise(1.4, 'lowpass', 180, 0.25, 0.1); // la bola rodando
    simulate(s).then(() => afterThrow(s));
  }

  function simulate(s) {
    return new Promise((resolve) => {
      const b = s.ball;
      const started = Date.now();
      let lastHit = 0;
      const step = () => {
        if (!alive(s)) return resolve();
        for (let sub = 0; sub < 3; sub++) {
          // Bola
          if (b.y > -30) {
            b.x += b.vx / 3;
            b.y += b.vy / 3;
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
                  p.vx += nx * sp * 0.9 + (Math.random() - 0.5) * 1.5;
                  p.vy += ny * sp * 0.9 - Math.random();
                  knock(p);
                  b.vx *= 0.96;
                  b.vy *= 0.94;
                  b.vx += -nx * 0.15;
                  if (Date.now() - lastHit > 50) { lastHit = Date.now(); sfx.notes([[900 + Math.random() * 500, 0, 0.05, 'square', 0.08]]); }
                }
              }
            }
          }
          // Pinos que vuelan tiran a otros
          for (const p of s.pins) {
            if (p.gone || (!p.vx && !p.vy)) continue;
            p.x += p.vx / 3;
            p.y += p.vy / 3;
            p.rot += (p.vx + p.vy) * 4;
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
                if (Date.now() - lastHit > 50) { lastHit = Date.now(); sfx.notes([[1200 + Math.random() * 500, 0, 0.04, 'square', 0.06]]); }
              }
            }
            if (p.x < LANE[0] - 4 || p.x > LANE[1] + 4 || p.y < 0) p.gone = true; // salió de la pista
          }
        }
        for (const p of s.pins) {
          p.vx *= 0.93;
          p.vy *= 0.93;
          if (Math.abs(p.vx) < 0.05 && Math.abs(p.vy) < 0.05) { p.vx = 0; p.vy = 0; }
          placePin(p);
        }
        placeBall(s);
        const pinsMoving = s.pins.some((p) => !p.gone && (p.vx || p.vy));
        if ((b.y > -30 || pinsMoving) && Date.now() - started < 6000) setTimeout(step, 16);
        else resolve();
      };
      step();
    });
  }

  function knock(p) {
    if (p.down) return;
    p.down = true;
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
    if (s.throwN === 0 && knocked === 10) {
      BQ.sport.flash(s.flash, '¡STRIKE!', 'goal');
      sfx.cheer();
      sfx.win();
      ui().burst(s.lane);
      BQ.puppet.use(s.hero.querySelector('.avatar'), 'shine');
      say = '¡Strike! ¡Tiraste todos los pinos!';
      done = true;
    } else if (s.throwN === 1 && standing === 0) {
      BQ.sport.flash(s.flash, '¡SPARE!', 'goal');
      sfx.cheer();
      ui().burst(s.lane);
      say = '¡Spare! ¡Los tiraste todos!';
      done = true;
    } else {
      if (knocked > 0) sfx.correct(); else sfx.aww();
      if (s.ball.gutter && knocked === 0) BQ.sport.flash(s.flash, '¡CANALETA!', 'saved');
      say = knocked === 0 ? '¡Uy! No tiraste ninguno.' : `¡Tiraste ${knocked === 1 ? 'un pino' : `${knocked} pinos`}!`;
      done = s.throwN === 1;
    }
    await Promise.all([voice.say(say), wait(1600)]);
    if (!alive(s)) return;
    s.flash.hidden = true;

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
    readyToThrow(s);
  }

  // Los pinos caídos se sacan; en un cuadro nuevo se vuelven a parar los 10
  function resetPins(s, all) {
    for (const p of s.pins) {
      if (all) {
        Object.assign(p, { x: PIN_SPOTS[p.i][0], y: PIN_SPOTS[p.i][1], vx: 0, vy: 0, down: false, gone: false, rot: 0 });
      } else if (p.down) {
        p.gone = true;
      }
      placePin(p);
    }
    if (all) s.pinsStanding = 10;
  }

  function resetBall(s) {
    Object.assign(s.ball, { x: BALL_START[0], y: BALL_START[1], vx: 0, vy: 0, gutter: false });
    placeBall(s);
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
