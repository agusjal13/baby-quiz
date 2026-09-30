(function (BQ) {
  'use strict';

  /*
   * Pool como una partida de verdad: las bolas ruedan, chocan entre sí, rebotan en las bandas y
   * se frenan de a poco. Arranca con un saque que desarma el triángulo y después son tiros sin
   * límite: antes de cada uno hay una pregunta.
   *   bien = la bola elegida entra (las demás se mueven con los choques)
   *   mal  = la bola pega en la banda y no entra ninguna; no pasa nada, sigue el próximo tiro
   * Gana si mete más de la mitad (4 de 6) antes de que se termine el tiempo (1:30).
   *
   * Mesa SVG de 400 x 230 vista desde arriba: paño entre (18,18) y (382,212), troneras en las
   * esquinas y en el medio de los lados largos. Cada bola es un <g> con el círculo en (0,0),
   * ubicado con transform: translate(x, y). Las velocidades son en unidades por cuadro (16 ms).
   */

  const U = BQ.util;
  const h = U.h;
  const voice = BQ.voice;
  const sfx = BQ.sfx;
  const ui = () => BQ.ui;
  const wait = BQ.sport.wait;

  const BALLS = 6;
  const TO_WIN = 4; // más del 50 %
  const TIME = 90; // segundos
  const R = 8; // radio de las bolas
  const FRICTION = 0.975; // cuánto conserva la velocidad en cada cuadro
  const BANK = 0.8; // cuánto conserva al rebotar en la banda
  const POCKET_R = 14; // distancia al centro de la tronera para caer
  const MIN = [18 + R, 18 + R];
  const MAX = [382 - R, 212 - R];
  const OUT = '#2b2140';
  const POCKETS = [[24, 24], [200, 19], [376, 24], [24, 206], [200, 211], [376, 206]];
  const RACK = [[262, 115], [280, 104], [280, 126], [298, 93], [298, 115], [298, 137]];
  const COLORS = ['#ffd200', '#1e88e5', '#e53935', '#8e24aa', '#fb8c00', '#2e9e44'];
  const CUE_START = [100, 115];
  const THEME = { sky1: '#6d4c41', sky2: '#a1887f', ground: '#4e342e', decor: ['🎱', '⭐', '✨', '🎉', '🏆'] };

  let S = null;
  const alive = (s) => S === s && s.screen.isConnected;

  function tableSvg() {
    const pockets = POCKETS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="12" fill="#1a1a1a" stroke="#3e2723" stroke-width="3"/>`).join('');
    const ball = (i) => `<g class="pl-ball"><circle r="${R}" fill="${COLORS[i]}" stroke="${OUT}" stroke-width="1.6"/>`
      + `<circle r="3.6" fill="#fff"/><text y="2.2" font-size="5.5" font-weight="900" text-anchor="middle" fill="${OUT}" font-family="Arial, sans-serif">${i + 1}</text>`
      + `<circle cx="-3" cy="-3" r="1.8" fill="rgba(255,255,255,.7)"/></g>`;
    return `<svg class="pl-table" viewBox="0 0 400 230" preserveAspectRatio="xMidYMid meet">`
      + `<rect x="2" y="2" width="396" height="226" rx="20" fill="#8d5a3b" stroke="${OUT}" stroke-width="3"/>`
      + `<rect x="18" y="18" width="364" height="194" rx="6" fill="#1f8f4e"/>`
      + `<rect x="18" y="18" width="364" height="194" rx="6" fill="none" stroke="#146b39" stroke-width="4"/>`
      + [60, 120, 280, 340].map((x) => `<circle cx="${x}" cy="10" r="2" fill="#f3e0c0"/><circle cx="${x}" cy="220" r="2" fill="#f3e0c0"/>`).join('')
      + pockets
      + `<line class="pl-aim" x1="0" y1="0" x2="0" y2="0" stroke="rgba(255,255,255,.55)" stroke-width="1.4" stroke-dasharray="4 4"/>`
      + `<g class="pl-cue-stick"><line x1="0" y1="0" x2="0" y2="0" stroke="${OUT}" stroke-width="6" stroke-linecap="round"/>`
      + `<line x1="0" y1="0" x2="0" y2="0" stroke="#d7a86e" stroke-width="3.6" stroke-linecap="round"/></g>`
      + Array.from({ length: BALLS }, (_, i) => ball(i)).join('')
      + `<g class="pl-cue"><circle r="${R}" fill="#fff" stroke="${OUT}" stroke-width="1.6"/><circle cx="-3" cy="-3" r="1.8" fill="rgba(0,0,0,.08)"/></g>`
      + `</svg>`;
  }

  // ---------- Pantalla ----------

  function open() { startGame(); }

  function startGame() {
    const scene = h('div', { class: 'pen-scene pl-scene', html: tableSvg() });
    const flash = h('div', { class: 'sport-flash', hidden: true });
    scene.append(flash);
    const clock = h('span', { class: 'pl-clock' }, fmt(TIME));
    const slots = h('div', { class: 'pl-slots' }, Array.from({ length: BALLS }, () => h('span', { class: 'pl-slot' })));
    const quiz = BQ.sport.quiz();
    const waiting = h('span', {}, ' ¡Mirá cómo ruedan!');
    quiz.el.append(h('div', { class: 'mt-waiting' }, h('span', { class: 'emoji' }, '🎱'), waiting));
    quiz.el.classList.add('idle'); // hasta que salga la pregunta

    const screen = h('div', { class: 'screen pool' },
      ui().topbar(ui().backBtn(() => { stop(); ui().showWorlds(); }),
        h('div', { class: 'pl-top' }, h('span', { class: 'pl-clock-box' }, h('span', { class: 'emoji' }, '⏱️'), clock), slots),
        h('span', { class: 'spacer' })),
      h('div', { class: 'pen-body' }, scene, quiz.el));
    ui().show(screen, THEME);

    const svg = scene.querySelector('svg');
    const s = {
      screen, scene, svg, flash, quiz, clock, slots,
      balls: [...svg.querySelectorAll('.pl-ball')].map((g, i) => ({ g, i, x: RACK[i][0], y: RACK[i][1], vx: 0, vy: 0, on: true })),
      cue: { g: svg.querySelector('.pl-cue'), cue: true, x: CUE_START[0], y: CUE_START[1], vx: 0, vy: 0, on: true },
      stick: svg.querySelector('.pl-cue-stick'),
      aim: svg.querySelector('.pl-aim'),
      made: 0, shots: 0, left: TIME, over: false, used: new Set(), timer: null,
      noPocket: false, assist: null, lastClack: 0,
    };
    S = s;
    [...s.balls, s.cue].forEach(place);
    s.stick.style.opacity = '0';
    s.aim.style.opacity = '0';

    sfx.whistle();
    voice.say('¡A jugar al pool! Contestá bien para meter las bolas. ¡Meté cuatro antes de que se termine el tiempo!')
      .then(async () => {
        if (!alive(s)) return;
        s.timer = setInterval(() => tick(s), 1000);
        await breakShot(s);
        if (alive(s) && !s.over) nextShot(s);
      });
  }

  function stop() {
    if (S) clearInterval(S.timer);
    S = null;
  }

  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  function tick(s) {
    if (!alive(s) || s.over) return clearInterval(s.timer);
    s.left--;
    s.clock.textContent = fmt(s.left);
    s.clock.parentElement.classList.toggle('hurry', s.left <= 15);
    if (s.left <= 10 && s.left > 0) sfx.notes([[880, 0, 0.05, 'sine', 0.05]]);
    if (s.left <= 0) finish(s);
  }

  // ---------- Física ----------

  function place(b) {
    b.g.style.transform = `translate(${b.x.toFixed(2)}px, ${b.y.toFixed(2)}px)`;
  }

  const moving = (b) => b.on && (Math.abs(b.vx) > 0.02 || Math.abs(b.vy) > 0.02);
  const all = (s) => [s.cue, ...s.balls].filter((b) => b.on);

  function clack(s, strength) {
    const now = Date.now();
    if (now - s.lastClack < 60) return;
    s.lastClack = now;
    sfx.notes([[1900, 0, 0.035, 'square', Math.min(0.1, 0.02 + strength * 0.012)]]);
  }

  function collide(s, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= R * 2 || dist === 0) return;
    // Mientras vuela hacia su bola, la blanca no choca con las demás (así el tiro sale derecho)
    const as = s.assist;
    if (as && as.phase === 'cue' && (a.cue || b.cue) && a !== as.target && b !== as.target) return;
    if (as && as.phase === 'target' && (a === as.target || b === as.target)) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = R * 2 - dist;
    a.x -= (nx * overlap) / 2;
    a.y -= (ny * overlap) / 2;
    b.x += (nx * overlap) / 2;
    b.y += (ny * overlap) / 2;
    const p = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (p <= 0) return;
    a.vx -= p * nx;
    a.vy -= p * ny;
    b.vx += p * nx;
    b.vy += p * ny;
    clack(s, p);
    // Saque: cuando la blanca llega al triángulo, las bolas salen disparadas para todos lados
    if (s.breaking && (a.cue || b.cue)) {
      s.breaking = false;
      const cx = RACK.reduce((t, r) => t + r[0], 0) / RACK.length;
      const cy = RACK.reduce((t, r) => t + r[1], 0) / RACK.length;
      for (const ball of s.balls) {
        const ang = Math.atan2(ball.y - cy, ball.x - cx) + (Math.random() - 0.5) * 1.2;
        const speed = 5 + Math.random() * 4;
        ball.vx = Math.cos(ang) * speed;
        ball.vy = Math.sin(ang) * speed;
      }
      const cue = a.cue ? a : b;
      cue.vx *= -0.3;
      cue.vy = (Math.random() - 0.5) * 4;
      sfx.noise(0.2, 'highpass', 1500, 0.3, 0.005);
    }
    // Tiro guiado: al pegarle la blanca, la bola sale justo hacia donde tiene que ir
    if (as && as.phase === 'cue' && ((a.cue && b === as.target) || (b.cue && a === as.target))) {
      const speed = Math.max(Math.hypot(as.target.vx, as.target.vy), as.speed);
      as.target.vx = as.dir[0] * speed;
      as.target.vy = as.dir[1] * speed;
      as.phase = as.pocket ? 'target' : 'done';
    }
  }

  function pocketCheck(s, b) {
    if (s.noPocket) return false;
    const p = POCKETS.find(([px, py]) => Math.hypot(px - b.x, py - b.y) < POCKET_R);
    if (!p) return false;
    b.on = false;
    b.vx = 0;
    b.vy = 0;
    b.g.animate([
      { transform: `translate(${b.x}px, ${b.y}px) scale(1)`, opacity: 1 },
      { transform: `translate(${p[0]}px, ${p[1]}px) scale(.4)`, opacity: 0 },
    ], { duration: 220, fill: 'forwards' });
    sfx.notes([[196, 0, 0.18, 'sine', 0.25], [147, 0.08, 0.2, 'sine', 0.2]]); // "plop"
    if (b.cue) s.scratch = true;
    else pocketed(s, b);
    if (s.assist && b === s.assist.target) s.assist.phase = 'done';
    return true;
  }

  function banks(s, b) {
    let hit = false;
    for (const k of [0, 1]) {
      const pos = k ? 'y' : 'x';
      const vel = k ? 'vy' : 'vx';
      if (b[pos] < MIN[k]) { b[pos] = MIN[k]; b[vel] = Math.abs(b[vel]) * BANK; hit = true; }
      if (b[pos] > MAX[k]) { b[pos] = MAX[k]; b[vel] = -Math.abs(b[vel]) * BANK; hit = true; }
    }
    if (hit && Math.hypot(b.vx, b.vy) > 1) sfx.noise(0.08, 'lowpass', 300, 0.12, 0.005);
  }

  // Corre la simulación hasta que todas las bolas se quedan quietas
  function simulate(s) {
    return new Promise((resolve) => {
      const step = () => {
        if (!alive(s) || s.over) return resolve();
        const balls = all(s);
        for (let sub = 0; sub < 3; sub++) {
          for (const b of balls) {
            if (!b.on) continue;
            b.x += b.vx / 3;
            b.y += b.vy / 3;
          }
          for (let i = 0; i < balls.length; i++) {
            for (let j = i + 1; j < balls.length; j++) if (balls[i].on && balls[j].on) collide(s, balls[i], balls[j]);
          }
          for (const b of balls) if (b.on && !pocketCheck(s, b)) banks(s, b);
        }
        for (const b of balls) {
          if (!b.on) continue;
          b.vx *= FRICTION;
          b.vy *= FRICTION;
          if (!moving(b)) { b.vx = 0; b.vy = 0; }
          place(b);
        }
        if (all(s).some(moving)) setTimeout(step, 16);
        else resolve();
      };
      step();
    });
  }

  // ---------- Tiros ----------

  // Taco detrás de la blanca apuntando a (tx, ty): tira hacia atrás y pega
  async function strike(s, tx, ty) {
    const dx = tx - s.cue.x;
    const dy = ty - s.cue.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const [a, b] = s.stick.querySelectorAll('line');
    for (const line of [a, b]) {
      line.setAttribute('x1', String(s.cue.x - ux * 14));
      line.setAttribute('y1', String(s.cue.y - uy * 14));
      line.setAttribute('x2', String(s.cue.x - ux * 120));
      line.setAttribute('y2', String(s.cue.y - uy * 120));
    }
    s.aim.setAttribute('x1', String(s.cue.x));
    s.aim.setAttribute('y1', String(s.cue.y));
    s.aim.setAttribute('x2', String(tx));
    s.aim.setAttribute('y2', String(ty));
    s.stick.style.opacity = '1';
    s.aim.style.opacity = '1';
    await Promise.race([s.stick.animate([
      { transform: 'translate(0, 0)' },
      { transform: `translate(${-ux * 16}px, ${-uy * 16}px)`, offset: 0.65 },
      { transform: `translate(${ux * 8}px, ${uy * 8}px)` },
    ], { duration: 700, easing: 'ease-in' }).finished.catch(() => {}), wait(850)]);
    s.stick.style.opacity = '0';
    s.aim.style.opacity = '0';
    sfx.notes([[1400, 0, 0.03, 'square', 0.07]]);
    return [ux, uy];
  }

  async function breakShot(s) {
    s.noPocket = true; // el saque solo desarma el triángulo
    s.breaking = true;
    const [ux, uy] = await strike(s, RACK[0][0], RACK[0][1] + (Math.random() * 6 - 3));
    s.cue.vx = ux * 13;
    s.cue.vy = uy * 13;
    await simulate(s);
    s.noPocket = false;
    s.breaking = false;
  }

  // Elige el mejor tiro: la bola y la tronera con el ángulo más fácil desde la blanca
  function chooseShot(s) {
    let best = null;
    for (const t of s.balls.filter((b) => b.on)) {
      for (const p of POCKETS) {
        const px = p[0] - t.x;
        const py = p[1] - t.y;
        const pd = Math.hypot(px, py);
        if (pd < R * 3) continue;
        const dir = [px / pd, py / pd];
        const ghost = [t.x - dir[0] * R * 2, t.y - dir[1] * R * 2];
        if (ghost[0] < MIN[0] || ghost[0] > MAX[0] || ghost[1] < MIN[1] || ghost[1] > MAX[1]) continue;
        const cx = ghost[0] - s.cue.x;
        const cy = ghost[1] - s.cue.y;
        const cd = Math.hypot(cx, cy) || 1;
        const cut = Math.acos(Math.max(-1, Math.min(1, (cx / cd) * dir[0] + (cy / cd) * dir[1])));
        if (cut > 1.2) continue; // más de ~70°: muy finito
        const score = cut * 60 + cd * 0.1 + pd * 0.05;
        if (!best || score < best.score) best = { t, p, dir, ghost, pd, cd, score };
      }
    }
    return best;
  }

  async function nextShot(s) {
    if (!alive(s) || s.over) return;
    if (s.scratch) respawnCue(s);
    const shot = chooseShot(s);
    s.shots++;

    s.quiz.el.classList.remove('idle');
    const good = await s.quiz.ask(BQ.sport.randomQuestion(s.used), '¡A tirar!');
    if (!alive(s) || s.over) return;
    s.quiz.el.classList.add('idle');

    // Bien: la bola sale derecho a la tronera. Mal: sale torcida, pega en la banda y no entra ninguna.
    let dir = shot ? shot.dir : [1, 0];
    if (!good) {
      const a = (Math.random() < 0.5 ? 1 : -1) * (0.45 + Math.random() * 0.2);
      dir = [dir[0] * Math.cos(a) - dir[1] * Math.sin(a), dir[0] * Math.sin(a) + dir[1] * Math.cos(a)];
    }
    const aimAt = shot ? shot.ghost : [s.balls.find((b) => b.on).x, s.balls.find((b) => b.on).y];
    const [ux, uy] = await strike(s, aimAt[0], aimAt[1]);
    if (!alive(s) || s.over) return;
    const dist = shot ? shot.cd : 100;
    const power = Math.min(12, 3.5 + dist * (1 - FRICTION) * 1.4);
    s.cue.vx = ux * power;
    s.cue.vy = uy * power;
    if (shot) {
      s.assist = {
        target: shot.t,
        dir,
        pocket: good,
        speed: 3 + shot.pd * (1 - FRICTION) * 1.5, // lo justo para llegar a la tronera
        phase: 'cue',
      };
    }
    s.noPocket = !good; // si contestó mal, esta vez no entra ninguna
    const before = s.made;
    await simulate(s);
    s.assist = null;
    s.noPocket = false;
    if (!alive(s) || s.over) return;

    let say;
    if (s.made > before) {
      BQ.sport.flash(s.flash, '¡ADENTRO!', 'goal');
      ui().burst(s.scene);
      say = `¡Adentro! ${U.pick(ui().PRAISES)}`;
    } else {
      sfx.aww();
      BQ.sport.flash(s.flash, '¡NO ENTRÓ!', 'saved');
      say = good ? '¡Casi! ¡Probá de nuevo!' : '¡Uy, no entró! Mirá, la respuesta era esta.';
    }
    await Promise.all([voice.say(say), wait(1400)]);
    if (!alive(s) || s.over) return;
    s.flash.hidden = true;
    s.quiz.clear();

    if (s.balls.every((b) => !b.on)) return finish(s); // las metió todas
    nextShot(s);
  }

  function pocketed(s, b) {
    s.made++;
    const slot = s.slots.children[s.made - 1];
    slot.classList.add('in');
    slot.style.setProperty('--c', COLORS[b.i]);
  }

  // Si la blanca se fue a la tronera, vuelve a su lugar (sin castigo)
  function respawnCue(s) {
    s.scratch = false;
    const c = s.cue;
    c.on = true;
    c.vx = 0;
    c.vy = 0;
    c.x = CUE_START[0];
    c.y = CUE_START[1];
    // Que no quede encima de otra bola
    for (let tries = 0; tries < 20 && s.balls.some((b) => b.on && Math.hypot(b.x - c.x, b.y - c.y) < R * 2.5); tries++) {
      c.y = MIN[1] + Math.random() * (MAX[1] - MIN[1]);
    }
    c.g.getAnimations().forEach((a) => a.cancel());
    place(c);
  }

  function finish(s) {
    if (s.over) return;
    s.over = true;
    clearInterval(s.timer);
    s.flash.hidden = true;
    const won = s.made >= TO_WIN;
    const made = s.made === 0 ? 'No metiste ninguna' : `Metiste ${s.made === 1 ? 'una bola' : `${s.made} bolas`}`;
    BQ.sport.result({
      screen: s.screen,
      won,
      perfect: s.made === BALLS,
      detail: h('div', { class: 'pl-final' }, [...s.slots.children].map((sl) => sl.cloneNode(true))),
      onAgain: startGame,
      winSay: `¡Ganaste! ${made}. ¡Te ganaste una moneda!`,
      loseSay: `¡Se terminó el tiempo! ${made}, y tenías que meter cuatro. ¡Probá otra vez!`,
      isAlive: () => alive(s),
    });
  }

  BQ.pool = { open };
})(window.BQ);
