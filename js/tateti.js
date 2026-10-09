(function (BQ) {
  'use strict';

  /*
   * Tatetí con fichas que se mueven (sin preguntas). Cada jugador tiene 3 fichas:
   *   1) Se ponen de a una, por turnos, en cualquier lugar vacío.
   *   2) Cuando ya están las 3, no se termina: en cada turno se mueve una ficha propia a cualquier
   *      lugar vacío (se toca la ficha y después el lugar). Así nunca hay empate por falta de lugar.
   * Gana la ronda el que hace tres en línea. El partido termina cuando alguien gana 2 rondas.
   * El rival juega en nivel fácil. Ganar da una moneda y un partido para los trofeos.
   */

  const U = BQ.util;
  const h = U.h;
  const store = BQ.store;
  const voice = BQ.voice;
  const sfx = BQ.sfx;
  const ui = () => BQ.ui;
  const wait = BQ.sport.wait;

  const TO_WIN = 2;
  const PIECES = 3;
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  // Nivel fácil: cada cuánto el rival "se da cuenta" de que puede ganar o de que tiene que tapar
  // (1 de cada 10 veces). Probado con partidas simuladas: jugando totalmente al azar se le gana
  // 1 de cada 3 partidos; viendo la línea de vez en cuando, 4 de cada 5.
  const SMART = { win: 0.1, block: 0.1 };
  const HINT_MS = 4000; // si puede hacer tatetí y tarda, se le marca dónde
  const MAX_TURNS = 60; // por las dudas: si una ronda se hace eterna, se empieza de nuevo
  const THEME = { sky1: '#7e57c2', sky2: '#d1c4e9', ground: '#5e35b1', decor: ['⭕', '❌', '⭐', '✨', '🏆'] };

  let S = null;
  const alive = (s) => S === s && s.screen.isConnected;

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
    const scoreMe = h('span', { class: 'mt-goals' }, '0');
    const scoreRival = h('span', { class: 'mt-goals' }, '0');
    const score = h('div', { class: 'mt-score' },
      h('span', { class: 'mt-team' }, BQ.puppet.el(mine)), scoreMe,
      h('span', { class: 'mt-dash' }, '-'),
      scoreRival, h('span', { class: 'mt-team' }, BQ.puppet.el(rival, [])));

    const cells = Array.from({ length: 9 }, (_, i) => h('button', {
      class: 'tt-cell', 'aria-label': 'Casillero ' + (i + 1),
      onpointerdown: ui().tap(() => tapCell(S, i)),
    }));
    const board = h('div', { class: 'tt-board' }, cells);
    const flash = h('div', { class: 'sport-flash', hidden: true });
    // Fichas que faltan poner: las del chico abajo y las del rival arriba
    const trayRival = h('div', { class: 'tt-tray rival' });
    const trayMe = h('div', { class: 'tt-tray me' });

    const screen = h('div', { class: 'screen tateti' },
      ui().topbar(ui().backBtn(() => { S = null; ui().showWorlds(); }), score, h('span', { class: 'spacer' })),
      h('div', { class: 'tt-body' }, trayRival, h('div', { class: 'tt-wrap' }, board, flash), trayMe));
    ui().show(screen, THEME);

    const s = {
      screen, board, cells, flash, trayMe, trayRival, scoreMe, scoreRival, mine, rival,
      grid: Array(9).fill(null), turn: 'me', picked: null, busy: true, turns: 0, wins: { me: 0, rival: 0 }, taught: false, starter: 'me',
    };
    S = s;
    paint(s);
    voice.say('¡Tatetí! Poné tus fichas: tres en línea gana.').then(() => { if (alive(s)) s.busy = false; });
  }

  // ---------- Tablero ----------

  const count = (s, who) => s.grid.filter((v) => v === who).length;
  const placing = (s, who) => count(s, who) < PIECES;
  const empties = (s) => s.grid.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  const lineOf = (grid, who) => LINES.find((l) => l.every((i) => grid[i] === who)) || null;

  const piece = (s, who) => h('span', { class: 'tt-piece ' + who }, BQ.puppet.el(who === 'me' ? s.mine : s.rival, who === 'me' ? undefined : []));

  function paint(s, popAt) {
    const canMove = s.turn === 'me' && !placing(s, 'me') && !s.busy;
    s.cells.forEach((cell, i) => {
      const who = s.grid[i];
      cell.className = 'tt-cell' + (who ? ' ' + who : '')
        + (s.picked === i ? ' picked' : '')
        + (!who && s.turn === 'me' && (placing(s, 'me') || s.picked !== null) ? ' open' : '')
        + (who === 'me' && canMove && s.picked === null ? ' mine-turn' : '');
      cell.replaceChildren(...(who ? [piece(s, who)] : []));
      if (popAt === i) cell.firstChild.classList.add('pop');
    });
    s.trayMe.replaceChildren(...Array.from({ length: PIECES - count(s, 'me') }, () => piece(s, 'me')));
    s.trayRival.replaceChildren(...Array.from({ length: PIECES - count(s, 'rival') }, () => piece(s, 'rival')));
    s.board.classList.toggle('my-turn', s.turn === 'me' && !s.busy);
  }

  // ---------- Turno del chico ----------

  function tapCell(s, i) {
    if (!alive(s) || s.busy || s.turn !== 'me') return;
    const who = s.grid[i];
    if (placing(s, 'me')) {
      if (who) return nope(s, i);
      return play(s, 'me', null, i);
    }
    // Ya puso las 3: elige una ficha suya y después un lugar vacío
    if (who === 'me') {
      s.picked = s.picked === i ? null : i;
      sfx.tap();
      return paint(s);
    }
    if (who === 'rival') return nope(s, i);
    if (s.picked === null) {
      nope(s, i);
      return voice.say('¡Primero tocá una ficha tuya!');
    }
    play(s, 'me', s.picked, i);
  }

  function nope(s, i) {
    const c = s.cells[i];
    c.classList.remove('nope');
    void c.offsetWidth;
    c.classList.add('nope');
    sfx.wrong();
  }

  // ---------- Jugada (de cualquiera): poner en "to", o mover de "from" a "to" ----------

  async function play(s, who, from, to) {
    clearTimeout(s.hintTimer);
    s.busy = true;
    s.picked = null;
    if (from !== null) s.grid[from] = null;
    s.grid[to] = who;
    s.turns++;
    sfx.pop();
    paint(s, to);

    const line = lineOf(s.grid, who);
    if (line) return roundOver(s, who, line);
    if (s.turns >= MAX_TURNS) return restartRound(s, '¡Empate! Otra vez.');

    s.turn = who === 'me' ? 'rival' : 'me';
    if (s.turn === 'rival') {
      paint(s);
      await wait(900);
      if (!alive(s)) return;
      const [f, t] = rivalMove(s);
      return play(s, 'rival', f, t);
    }
    // Le toca al chico. La primera vez que hay que mover, se explica.
    s.busy = false;
    paint(s);
    hintLater(s);
    if (!placing(s, 'me') && !s.taught) {
      s.taught = true;
      voice.say('¡Ahora mové una ficha! Tocá una tuya y después un lugar vacío.');
    }
  }

  // Rival fácil: a veces ve que puede ganar o que tiene que tapar; si no, juega al azar
  function rivalMove(s) {
    const options = [];
    if (placing(s, 'rival')) empties(s).forEach((t) => options.push([null, t]));
    else {
      s.grid.forEach((v, f) => { if (v === 'rival') empties(s).forEach((t) => options.push([f, t])); });
    }
    const after = ([f, t], who) => {
      const g = s.grid.slice();
      if (f !== null) g[f] = null;
      g[t] = who;
      return g;
    };
    const winning = options.filter((o) => lineOf(after(o, 'rival'), 'rival'));
    if (winning.length && Math.random() < SMART.win) return U.pick(winning);
    // Tapar: lugares donde el chico haría tres en línea en su próxima jugada
    const threats = empties(s).filter((t) => {
      if (placing(s, 'me')) return !!lineOf(after([null, t], 'me'), 'me');
      return s.grid.some((v, f) => v === 'me' && lineOf(after([f, t], 'me'), 'me'));
    });
    const blocking = options.filter((o) => threats.includes(o[1]));
    if (blocking.length && Math.random() < SMART.block) return U.pick(blocking);
    return U.pick(options);
  }

  // ---------- Fin de ronda y de partido ----------

  async function roundOver(s, who, line) {
    s.busy = true;
    s.wins[who]++;
    s.scoreMe.textContent = String(s.wins.me);
    s.scoreRival.textContent = String(s.wins.rival);
    line.forEach((i) => s.cells[i].classList.add('win'));
    const mine = who === 'me';
    BQ.sport.flash(s.flash, mine ? '¡TATETÍ!' : 'TATETÍ DEL OTRO', mine ? 'goal' : 'saved');
    if (mine) {
      sfx.correct();
      sfx.cheer();
      ui().burst(s.board);
      line.forEach((i) => BQ.puppet.use(s.cells[i].querySelector('.avatar')));
    } else sfx.aww();
    await Promise.all([voice.say(mine ? '¡Tatetí! ¡Tres en línea!' : '¡Tatetí del otro!'), wait(2000)]);
    if (!alive(s)) return;
    if (s.wins.me >= TO_WIN || s.wins.rival >= TO_WIN) return finish(s);
    restartRound(s, mine ? '¡Otra ronda!' : '¡Vamos de nuevo!');
  }

  async function restartRound(s, say) {
    s.flash.hidden = true;
    s.grid = Array(9).fill(null);
    s.turns = 0;
    s.picked = null;
    // Empieza el otro: una ronda cada uno
    s.starter = s.starter === 'me' ? 'rival' : 'me';
    s.turn = s.starter;
    s.busy = true;
    paint(s);
    await Promise.all([voice.say(say), wait(700)]);
    if (!alive(s)) return;
    if (s.turn === 'rival') {
      const [f, t] = rivalMove(s);
      return play(s, 'rival', f, t);
    }
    s.busy = false;
    paint(s);
    hintLater(s);
  }

  // Pista: si el chico puede hacer tres en línea y pasa un rato sin jugar, se ilumina el lugar
  // (y, si hay que mover, la ficha que tiene que llevar ahí)
  function hintLater(s) {
    clearTimeout(s.hintTimer);
    const turnNow = s.turns;
    s.hintTimer = setTimeout(() => {
      if (!alive(s) || s.busy || s.turn !== 'me' || s.turns !== turnNow) return;
      const move = winningMove(s);
      if (!move) return;
      s.cells[move[1]].classList.add('hint');
      if (move[0] !== null) s.cells[move[0]].classList.add('hint');
    }, HINT_MS);
  }

  function winningMove(s) {
    const opts = [];
    if (placing(s, 'me')) empties(s).forEach((t) => opts.push([null, t]));
    else s.grid.forEach((v, f) => { if (v === 'me') empties(s).forEach((t) => opts.push([f, t])); });
    return opts.find(([f, t]) => {
      const g = s.grid.slice();
      if (f !== null) g[f] = null;
      g[t] = 'me';
      return lineOf(g, 'me');
    }) || null;
  }

  function finish(s) {
    const { me, rival } = s.wins;
    const won = me > rival;
    s.flash.hidden = true;
    BQ.sport.result({
      screen: s.screen,
      won,
      detail: h('div', { class: 'mt-final' }, `${me} - ${rival}`),
      onAgain: startGame,
      winSay: `¡Ganaste ${me} a ${rival}! ¡Te ganaste una moneda!`,
      loseSay: `¡Casi! Terminó ${me} a ${rival}. ¡Jugá otra vez!`,
      isAlive: () => alive(s),
    });
  }

  // state y rivalMove: para revisar partidas desde la consola
  BQ.tateti = { open, state: () => S, rivalMove: () => rivalMove(S), smart: SMART };
})(window.BQ);
