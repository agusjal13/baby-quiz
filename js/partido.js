(function (BQ) {
  'use strict';

  /*
   * Partidito 4 vs 4 (arquero + 3). Los jugadores corren y se pasan la pelota; cada pocos segundos
   * se arma una jugada de gol de uno de los dos equipos y sale una pregunta:
   *   ataque de tu equipo:   bien = gol tuyo;          mal = ataja el arquero de ellos
   *   ataque de ellos:       bien = ataja tu arquero;  mal = gol de ellos
   * Gana el primero que llega a 3 goles (más o menos un minuto). Ganar da una moneda.
   *
   * Cancha SVG de 400 x 250 vista de costado: tu arco a la izquierda (x=10), el de ellos a la
   * derecha (x=390), arcos entre y=100 y y=150. Las posiciones de los jugadores son sus pies.
   */

  const U = BQ.util;
  const h = U.h;
  const store = BQ.store;
  const voice = BQ.voice;
  const sfx = BQ.sfx;
  const ui = () => BQ.ui;
  const wait = BQ.sport.wait;

  const GOALS_TO_WIN = 3;
  const OUT = '#2b2140';
  const P_W = 30; // tamaño de cada jugador en la cancha
  const P_H = 42;
  const CENTER = [200, 125];
  const THEME = { sky1: '#8fd3ff', sky2: '#d9f2ff', ground: '#4caf50', decor: ['☁️', '⚽', '🏆', '⭐', '🎉'] };

  // Formación inicial: arquero y 3 jugadores por equipo
  const KICKOFF = {
    us: [[24, 125], [120, 72], [150, 128], [118, 182]],
    them: [[376, 125], [280, 72], [250, 128], [282, 182]],
  };

  let S = null;
  const alive = (s) => S === s && s.screen.isConnected;

  function fieldSvg() {
    let stripes = '';
    for (let x = 0; x < 400; x += 40) stripes += `<rect x="${x}" y="0" width="20" height="250" fill="#43a047"/>`;
    const goal = (x, dir) => `<g class="mt-net mt-net-${dir > 0 ? 'them' : 'us'}">`
      + `<rect x="${dir > 0 ? x : x - 12}" y="100" width="12" height="50" fill="rgba(255,255,255,.35)"/>`
      + `<path d="M${x} 100 L${x + 12 * dir} 100 L${x + 12 * dir} 150 L${x} 150" fill="none" stroke="#fff" stroke-width="3.5"/></g>`;
    return `<svg class="mt-field" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid meet">`
      + `<rect width="400" height="250" fill="#4caf50"/>${stripes}`
      + `<g fill="none" stroke="#fff" stroke-width="2" opacity=".9">`
      + `<rect x="10" y="12" width="380" height="226"/><line x1="200" y1="12" x2="200" y2="238"/>`
      + `<circle cx="200" cy="125" r="30"/><rect x="10" y="72" width="58" height="106"/><rect x="332" y="72" width="58" height="106"/></g>`
      + `<circle cx="200" cy="125" r="2.5" fill="#fff"/>`
      + goal(10, -1) + goal(390, 1)
      + `<g class="mt-players"></g>`
      + `<g class="mt-ball"><circle r="6" fill="#fff" stroke="${OUT}" stroke-width="1.6"/>`
      + `<polygon points="0,-3 2.9,-0.9 1.8,2.4 -1.8,2.4 -2.9,-0.9" fill="${OUT}"/></g>`
      + `</svg>`;
  }

  // ---------- Pantalla ----------

  function open() {
    if (!store.data.character) {
      store.data.character = 'futbolista';
      store.save();
    }
    startMatch();
  }

  function startMatch() {
    const mine = store.data.character;
    const rival = U.pick(BQ.characters.filter((c) => c.id !== mine)).id;

    const field = h('div', { class: 'mt-scene', html: fieldSvg() });
    const flash = h('div', { class: 'sport-flash', hidden: true });
    field.append(flash);
    const scoreUs = h('span', { class: 'mt-goals' }, '0');
    const scoreThem = h('span', { class: 'mt-goals' }, '0');
    const score = h('div', { class: 'mt-score' },
      h('span', { class: 'mt-team us' }, BQ.puppet.el(mine)), scoreUs,
      h('span', { class: 'mt-dash' }, '-'),
      scoreThem, h('span', { class: 'mt-team them' }, BQ.puppet.el(rival, [])));
    const quiz = BQ.sport.quiz();
    const waiting = h('div', { class: 'mt-waiting' }, h('span', { class: 'emoji' }, '👀'), ' ¡Mirá el partido!');
    quiz.el.append(waiting);

    const screen = h('div', { class: 'screen partido' },
      ui().topbar(ui().backBtn(() => { stop(); ui().showWorlds(); }), score, h('span', { class: 'spacer' })),
      h('div', { class: 'pen-body' }, field, quiz.el));
    ui().show(screen, THEME);

    const svg = field.querySelector('svg');
    const layer = svg.querySelector('.mt-players');
    const makePlayer = (team, charId, worn, i) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `mt-player ${team}` + (i === 0 ? ' keeper' : ''));
      const pp = BQ.puppet.el(charId, worn).querySelector('.pp');
      pp.setAttribute('width', String(P_W));
      pp.setAttribute('height', String(P_H));
      g.append(pp);
      layer.append(g);
      return { g, team, keeper: i === 0, x: 0, y: 0 };
    };
    const myWorn = BQ.wardrobe.wornItems(mine).map((it) => it.id);
    const s = {
      screen, field, svg, flash, quiz, waiting, scoreUs, scoreThem,
      ball: svg.querySelector('.mt-ball'),
      nets: { us: svg.querySelector('.mt-net-us'), them: svg.querySelector('.mt-net-them') },
      us: KICKOFF.us.map((_, i) => makePlayer('us', mine, myWorn, i)),
      them: KICKOFF.them.map((_, i) => makePlayer('them', rival, [], i)),
      goals: { us: 0, them: 0 },
      used: new Set(),
      timers: [],
      ballAt: CENTER,
    };
    S = s;
    kickoff(s, 0);

    sfx.whistle();
    voice.say('¡Empieza el partido! Cuando haya una jugada de gol, contestá la pregunta. ¡Gana el primero que haga tres goles!')
      .then(() => { if (alive(s)) play(s); });
  }

  function stop() {
    if (S) S.timers.forEach(clearTimeout);
    S = null;
  }

  // ---------- Movimiento ----------

  function moveTo(p, x, y, ms) {
    p.x = x;
    p.y = y;
    p.g.style.transition = `transform ${ms}ms ease-in-out`;
    p.g.style.transform = `translate(${x - P_W / 2}px, ${y - P_H}px)`;
  }

  function ballTo(s, x, y, ms) {
    s.ballAt = [x, y];
    s.ball.style.transition = `transform ${ms}ms ease-out`;
    s.ball.style.transform = `translate(${x}px, ${y}px)`;
  }

  function kickoff(s, ms) {
    s.us.forEach((p, i) => moveTo(p, ...KICKOFF.us[i], ms));
    s.them.forEach((p, i) => moveTo(p, ...KICKOFF.them[i], ms));
    ballTo(s, ...CENTER, ms);
  }

  const later = (s, ms, fn) => s.timers.push(setTimeout(() => alive(s) && fn(), ms));

  // Unos segundos de juego libre: todos corren y la pelota va de pie en pie; después, una jugada
  function play(s) {
    s.quiz.el.classList.add('idle');
    const field = [...s.us.slice(1), ...s.them.slice(1)];
    const steps = 3 + U.rand(2);
    for (let i = 0; i < steps; i++) {
      later(s, i * 900, () => {
        field.forEach((p) => moveTo(p, 60 + Math.random() * 280, 30 + Math.random() * 190, 850));
        moveTo(s.us[0], 24, 105 + Math.random() * 40, 850);
        moveTo(s.them[0], 376, 105 + Math.random() * 40, 850);
        const owner = U.pick(field);
        later(s, 450, () => {
          ballTo(s, owner.x + 6, owner.y - 2, 500);
          sfx.notes([[220, 0, 0.05, 'sine', 0.05]]);
        });
      });
    }
    // Un poco más de ataques propios, para que el partido dure alrededor de un minuto
    later(s, steps * 900 + 300, () => chance(s, Math.random() < 0.6 ? 'us' : 'them'));
  }

  // ---------- Jugada de gol ----------

  async function chance(s, attacking) {
    const attackers = attacking === 'us' ? s.us : s.them;
    const defenders = attacking === 'us' ? s.them : s.us;
    const dir = attacking === 'us' ? 1 : -1; // hacia dónde patea
    const shooter = U.pick(attackers.slice(1));
    const keeper = defenders[0];
    const shotX = attacking === 'us' ? 300 : 100;
    const shotY = 85 + Math.random() * 80;

    // Se arma la jugada: el que patea llega al área con la pelota, los demás acompañan
    moveTo(shooter, shotX, shotY, 700);
    attackers.slice(1).filter((p) => p !== shooter).forEach((p, i) => moveTo(p, shotX - dir * (50 + i * 30), 60 + i * 120, 700));
    defenders.slice(1).forEach((p, i) => moveTo(p, shotX + dir * 18, 70 + i * 55, 700));
    moveTo(keeper, keeper.x, 125, 500);
    ballTo(s, shotX + dir * 7, shotY - 2, 700);
    sfx.whistle();
    await wait(800);
    if (!alive(s)) return;

    s.quiz.el.classList.remove('idle');
    const good = await s.quiz.ask(BQ.sport.randomQuestion(s.used), attacking === 'us' ? '¡Ataque de tu equipo!' : '¡Cuidado, atacan ellos!');
    if (!alive(s)) return;

    // Patada: gol si (atacamos y contestó bien) o (atacan ellos y contestó mal)
    const goal = attacking === 'us' ? good : !good;
    const goalX = attacking === 'us' ? 397 : 3;
    const keeperX = attacking === 'us' ? 376 : 24;
    const aimY = 108 + Math.random() * 34;
    BQ.puppet.use(shooter.g, 'kick');
    await wait(200);
    if (!alive(s)) return;
    sfx.kick();
    if (goal) {
      moveTo(keeper, keeperX, aimY < 125 ? 145 : 105, 350); // se tira para el otro lado
      ballTo(s, goalX, aimY, 550);
    } else {
      moveTo(keeper, keeperX, aimY, 350); // llega a la pelota
      ballTo(s, keeperX + (attacking === 'us' ? -8 : 8), aimY - 14, 550);
    }
    await wait(600);
    if (!alive(s)) return;

    let say;
    if (goal) {
      const side = attacking; // equipo que hizo el gol
      s.goals[side]++;
      (side === 'us' ? s.scoreUs : s.scoreThem).textContent = String(s.goals[side]);
      s.nets[side === 'us' ? 'them' : 'us'].classList.add('shake');
      if (side === 'us') {
        sfx.cheer();
        sfx.win();
        BQ.sport.flash(s.flash, '¡GOOOL!', 'goal');
        ui().burst(s.field);
        say = `¡Gooool! ${U.pick(ui().PRAISES)}`;
      } else {
        sfx.aww();
        BQ.sport.flash(s.flash, 'Gol de ellos', 'saved');
        say = '¡Uy, gol de ellos! Mirá, la respuesta era esta.';
      }
    } else if (attacking === 'us') {
      sfx.aww();
      BQ.sport.flash(s.flash, '¡ATAJÓ!', 'saved');
      say = '¡Atajó el arquero de ellos! Mirá, la respuesta era esta.';
    } else {
      sfx.cheer();
      BQ.sport.flash(s.flash, '¡ATAJADA!', 'goal');
      say = '¡Atajó tu arquero! ¡Muy bien!';
    }
    await Promise.all([voice.say(say), wait(2000)]);
    if (!alive(s)) return;

    s.flash.hidden = true;
    Object.values(s.nets).forEach((n) => n.classList.remove('shake'));
    s.quiz.clear();
    s.quiz.el.classList.add('idle');
    if (s.goals.us >= GOALS_TO_WIN || s.goals.them >= GOALS_TO_WIN) return finish(s);
    kickoff(s, 700);
    await wait(900);
    if (alive(s)) {
      sfx.whistle();
      play(s);
    }
  }

  function finish(s) {
    const won = s.goals.us > s.goals.them;
    BQ.sport.result({
      screen: s.screen,
      won,
      detail: h('div', { class: 'mt-final' }, `${s.goals.us} - ${s.goals.them}`),
      onAgain: startMatch,
      winSay: `¡Ganaste el partido ${s.goals.us} a ${s.goals.them}! ¡Te ganaste una moneda!`,
      loseSay: `¡Casi! Terminó ${s.goals.us} a ${s.goals.them}. ¡Jugá otra vez, que vos podés!`,
      isAlive: () => alive(s),
    });
  }

  BQ.partido = { open };
})(window.BQ);
