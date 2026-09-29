(function (BQ) {
  'use strict';

  /*
   * Pool: se juega solo con 6 bolas. Antes de cada tiro hay una pregunta:
   * bien = la bola entra en la tronera; mal = pega en el borde y queda afuera.
   * Gana si mete más de la mitad (4 de 6) antes de que se termine el tiempo (1:30).
   *
   * Mesa SVG de 400 x 230 vista desde arriba: paño entre (18,18) y (382,212), troneras en las
   * esquinas y en el medio de los lados largos. Cada bola es un <g> con el círculo en (0,0),
   * ubicado con transform: translate(x, y).
   */

  const U = BQ.util;
  const h = U.h;
  const store = BQ.store;
  const voice = BQ.voice;
  const sfx = BQ.sfx;
  const ui = () => BQ.ui;
  const wait = BQ.sport.wait;

  const BALLS = 6;
  const TO_WIN = 4; // más del 50 %
  const TIME = 90; // segundos
  const R = 8; // radio de las bolas
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
    const ball = (i) => `<g class="pl-ball" data-i="${i}"><circle r="${R}" fill="${COLORS[i]}" stroke="${OUT}" stroke-width="1.6"/>`
      + `<circle r="3.6" fill="#fff"/><text y="2.2" font-size="5.5" font-weight="900" text-anchor="middle" fill="${OUT}" font-family="Arial, sans-serif">${i + 1}</text>`
      + `<circle cx="-3" cy="-3" r="1.8" fill="rgba(255,255,255,.7)"/></g>`;
    return `<svg class="pl-table" viewBox="0 0 400 230" preserveAspectRatio="xMidYMid meet">`
      + `<rect x="2" y="2" width="396" height="226" rx="20" fill="#8d5a3b" stroke="${OUT}" stroke-width="3"/>`
      + `<rect x="18" y="18" width="364" height="194" rx="6" fill="#1f8f4e"/>`
      + `<rect x="18" y="18" width="364" height="194" rx="6" fill="none" stroke="#146b39" stroke-width="4"/>`
      + [60, 120, 280, 340].map((x) => `<circle cx="${x}" cy="10" r="2" fill="#f3e0c0"/><circle cx="${x}" cy="220" r="2" fill="#f3e0c0"/>`).join('')
      + pockets
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
    quiz.el.append(h('div', { class: 'mt-waiting' }, h('span', { class: 'emoji' }, '🎱'), ' ¡Se viene un tiro!'));
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
      balls: [...svg.querySelectorAll('.pl-ball')].map((g, i) => ({ g, x: RACK[i][0], y: RACK[i][1], on: true })),
      cue: { g: svg.querySelector('.pl-cue'), x: CUE_START[0], y: CUE_START[1] },
      stick: svg.querySelector('.pl-cue-stick'),
      shot: 0, made: 0, left: TIME, over: false, used: new Set(), timer: null,
    };
    S = s;
    s.balls.forEach((b) => place(b));
    place(s.cue);
    s.stick.style.opacity = '0';

    sfx.whistle();
    voice.say('¡A jugar al pool! Contestá bien para meter cada bola. ¡Meté cuatro antes de que se termine el tiempo!')
      .then(() => {
        if (!alive(s)) return;
        s.timer = setInterval(() => tick(s), 1000);
        nextShot(s);
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
    if (s.left <= 0) finish(s, true);
  }

  // ---------- Movimiento ----------

  function place(b) {
    b.g.style.transform = `translate(${b.x}px, ${b.y}px)`;
  }

  // Mueve una bola con animación y deja fija la posición final
  function roll(b, x, y, ms, extra = '') {
    const from = `translate(${b.x}px, ${b.y}px)`;
    b.x = x;
    b.y = y;
    const to = `translate(${x}px, ${y}px) ${extra}`;
    const anim = b.g.animate([{ transform: from }, { transform: to }], { duration: ms, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    return Promise.race([anim.finished.catch(() => {}), wait(ms + 150)]);
  }

  function nearestPocket(b) {
    return POCKETS.reduce((best, p) => (Math.hypot(p[0] - b.x, p[1] - b.y) < Math.hypot(best[0] - b.x, best[1] - b.y) ? p : best));
  }

  // Taco detrás de la blanca, apuntando hacia (tx, ty); tira hacia atrás y pega
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
    s.stick.style.opacity = '1';
    await Promise.race([s.stick.animate([
      { transform: 'translate(0, 0)' },
      { transform: `translate(${-ux * 14}px, ${-uy * 14}px)`, offset: 0.6 },
      { transform: `translate(${ux * 8}px, ${uy * 8}px)` },
    ], { duration: 650, easing: 'ease-in' }).finished.catch(() => {}), wait(800)]);
    s.stick.style.opacity = '0';
    sfx.notes([[1400, 0, 0.03, 'square', 0.06]]);
  }

  // ---------- Tiros ----------

  async function nextShot(s) {
    if (!alive(s) || s.over) return;
    const ball = s.balls.find((b) => b.on);
    if (!ball || s.shot >= BALLS) return finish(s, false);
    s.slots.children[s.shot].classList.add('now');

    s.quiz.el.classList.remove('idle');
    const good = await s.quiz.ask(BQ.sport.randomQuestion(s.used), `Tiro ${s.shot + 1}.`);
    if (!alive(s) || s.over) return;

    // Hacia dónde va: la tronera más cercana a la bola
    const pocket = nearestPocket(ball);
    const px = pocket[0] - ball.x;
    const py = pocket[1] - ball.y;
    const pl = Math.hypot(px, py) || 1;
    const dx = px / pl;
    const dy = py / pl;
    const contact = [ball.x - dx * R * 2, ball.y - dy * R * 2];

    await strike(s, contact[0], contact[1]);
    if (!alive(s)) return;
    await roll(s.cue, contact[0], contact[1], 420);
    if (!alive(s)) return;
    sfx.notes([[1900, 0, 0.04, 'square', 0.09], [1500, 0.02, 0.05, 'square', 0.06]]); // "clac"
    roll(s.cue, contact[0] + dx * 10, contact[1] + dy * 10, 400);

    const slot = s.slots.children[s.shot];
    slot.classList.remove('now');
    let say;
    if (good) {
      await roll(ball, pocket[0], pocket[1], 520);
      if (!alive(s)) return;
      ball.g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
      ball.on = false;
      s.made++;
      sfx.notes([[196, 0, 0.18, 'sine', 0.25], [147, 0.08, 0.2, 'sine', 0.2]]); // "plop"
      slot.classList.add('in');
      slot.style.setProperty('--c', COLORS[s.balls.indexOf(ball)]);
      BQ.sport.flash(s.flash, '¡ADENTRO!', 'goal');
      ui().burst(s.scene);
      say = `¡Adentro! ${U.pick(ui().PRAISES)}`;
    } else {
      // Pega en el borde al lado de la tronera y rebota: queda afuera
      const side = Math.random() < 0.5 ? 1 : -1;
      const hitX = pocket[0] - dx * 22 + -dy * 16 * side;
      const hitY = pocket[1] - dy * 22 + dx * 16 * side;
      await roll(ball, hitX, hitY, 460);
      if (!alive(s)) return;
      sfx.noise(0.15, 'lowpass', 400, 0.3, 0.005); // golpe en la banda
      await roll(ball, hitX - dx * 14, hitY - dy * 14, 380);
      ball.on = false; // esa bola ya se tiró
      ball.g.animate([{ opacity: 1 }, { opacity: 0.35 }], { duration: 300, fill: 'forwards' });
      slot.classList.add('out');
      sfx.aww();
      BQ.sport.flash(s.flash, '¡AFUERA!', 'saved');
      say = '¡Uy, afuera! Mirá, la respuesta era esta.';
    }
    s.shot++;
    await Promise.all([voice.say(say), wait(1700)]);
    if (!alive(s) || s.over) return;

    s.flash.hidden = true;
    s.quiz.clear();
    s.quiz.el.classList.add('idle');
    // La blanca vuelve a su lugar para el próximo tiro
    await roll(s.cue, CUE_START[0], CUE_START[1] + (Math.random() * 40 - 20), 500);
    if (s.shot >= BALLS) finish(s, false);
    else nextShot(s);
  }

  function finish(s, timeUp) {
    if (s.over) return;
    s.over = true;
    clearInterval(s.timer);
    s.flash.hidden = true;
    const won = s.made >= TO_WIN;
    const made = s.made === 0 ? 'No metiste ninguna' : `Metiste ${s.made === 1 ? 'una bola' : `${s.made} bolas`}`;
    BQ.sport.result({
      screen: s.screen,
      won,
      detail: h('div', { class: 'pl-final' }, [...s.slots.children].map((sl) => sl.cloneNode(true))),
      onAgain: startGame,
      winSay: `¡Ganaste! ${made}. ¡Te ganaste una moneda!`,
      loseSay: timeUp && s.shot < BALLS
        ? `¡Se terminó el tiempo! ${made}. ¡Probá otra vez!`
        : `¡Casi! ${made} y tenías que meter cuatro. ¡Probá otra vez!`,
      isAlive: () => alive(s),
    });
  }

  BQ.pool = { open };
})(window.BQ);
