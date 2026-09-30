(function (BQ) {
  'use strict';

  /*
   * Tiro al blanco: durante 20 segundos van apareciendo blancos en lugares al azar y se
   * van solos al rato. Blanco rojo = +1, azul = +2, multicolor = +5 (raro y rápido); cada tanto
   * aparece una bomba, y tocarla resta 1 (nunca baja de 0). Con 6 puntos o más se gana (moneda y trofeos, como los otros juegos).
   */

  const U = BQ.util;
  const h = U.h;
  const store = BQ.store;
  const voice = BQ.voice;
  const sfx = BQ.sfx;
  const ui = () => BQ.ui;
  const wait = BQ.sport.wait;

  const TIME = 20; // segundos
  const TO_WIN = 6;
  const MAX_ON = 3; // cosas en pantalla a la vez
  const BAD_CHANCE = 0.4;
  const FAST_AT = 10; // en los últimos segundos salen más rápido
  const between = (a, b) => a + Math.random() * (b - a);
  const THEME = { sky1: '#81d4fa', sky2: '#e1f5fe', ground: '#aed581', decor: ['🎯', '⭐', '☁️', '🎈', '✨'] };

  const rings = (colors, stroke = '#8d6e63') => `<svg viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="48" fill="${colors[0]}" stroke="${stroke}" stroke-width="3"/>
    ${colors.slice(1).map((c, i) => `<circle cx="50" cy="50" r="${38 - i * 10}" fill="${c}"/>`).join('')}
  </svg>`;
  // Blancos: rojo común, azul (+2) y multicolor (+5, que dura menos)
  const TARGETS = {
    rojo: { points: 1, svg: rings(['#fff', '#e53935', '#fff', '#e53935', '#ffd23f']) },
    azul: { points: 2, svg: rings(['#fff', '#1e63d6', '#fff', '#1e63d6', '#fff']) },
    arcoiris: { points: 5, svg: rings(['#e53935', '#ff9800', '#ffd23f', '#43a047', '#1e88e5'], '#7b1fa2') },
  };

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
    stop();
    const clock = h('span', { class: 'pl-clock' }, fmt(TIME));
    const points = h('span', { class: 'tb-points' }, '0');
    const slots = h('div', { class: 'tb-slots' }, Array.from({ length: TO_WIN }, () => h('span', { class: 'tb-slot' })));
    const field = h('div', { class: 'tb-field' });
    const hero = ui().playable(h('div', { class: 'tb-hero' }, BQ.puppet.el(store.data.character)));
    const flash = h('div', { class: 'sport-flash', hidden: true });

    const screen = h('div', { class: 'screen tiro' },
      ui().topbar(ui().backBtn(() => { stop(); ui().showWorlds(); }),
        h('div', { class: 'pl-top' },
          h('span', { class: 'pl-clock-box' }, h('span', { class: 'emoji' }, '⏱️'), clock),
          h('span', { class: 'pl-clock-box tb-score' }, h('span', { class: 'emoji' }, '🎯'), points),
          slots),
        h('span', { class: 'spacer' })),
      h('div', { class: 'tb-scene' }, field, hero, flash));
    ui().show(screen, THEME);

    const s = { screen, field, clock, points, slots, hero, flash, score: 0, left: TIME, over: false, timer: null, spawner: null, count: 0 };
    S = s;

    voice.say('¡Tocá los blancos! ¡Las bombas no!').then(() => {
      if (!alive(s)) return;
      sfx.whistle();
      s.timer = setInterval(() => tick(s), 1000);
      spawnLoop(s);
    });
  }

  function stop() {
    if (S) {
      clearInterval(S.timer);
      clearTimeout(S.spawner);
    }
    S = null;
  }

  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  function tick(s) {
    if (!alive(s) || s.over) return clearInterval(s.timer);
    s.left--;
    s.clock.textContent = fmt(s.left);
    s.clock.parentElement.classList.toggle('hurry', s.left <= 10);
    if (s.left <= 5 && s.left > 0) sfx.notes([[880, 0, 0.05, 'sine', 0.05]]);
    if (s.left <= 0) finish(s);
  }

  // ---------- Blancos y bombas ----------

  function spawnLoop(s) {
    if (!alive(s) || s.over) return;
    if (s.field.querySelectorAll('.tb-thing:not(.gone)').length < MAX_ON) spawn(s);
    // Al principio más tranquilo, después un poco más rápido
    const gap = s.left > FAST_AT ? between(900, 1300) : between(650, 1000);
    s.spawner = setTimeout(() => spawnLoop(s), gap);
  }

  function spawn(s) {
    s.count++;
    // Los dos primeros son siempre blancos; nunca dos bombas seguidas
    const bad = s.count > 2 && !s.lastBad && Math.random() < BAD_CHANCE;
    s.lastBad = bad;
    const pos = freeSpot(s);
    if (!pos) return;
    const r = Math.random();
    // El multicolor sale poco, pero al menos una vez por partido
    const rainbow = (r < 0.12 && s.count > 3) || (!s.rainbows && s.left <= 12);
    const kind = bad ? null : rainbow ? 'arcoiris' : r < 0.4 ? 'azul' : 'rojo';
    if (kind === 'arcoiris') s.rainbows = (s.rainbows || 0) + 1;
    let life = (s.left > FAST_AT ? 2600 : 2100) + (bad ? 400 : 0);
    if (kind === 'arcoiris') life = 1600;
    const el = h('button', {
      class: 'tb-thing' + (bad ? ' bad' : ' ' + kind),
      'aria-label': bad ? 'Bomba' : 'Blanco',
      style: { left: pos.x + '%', top: pos.y + '%', '--life': life + 'ms' },
      html: bad ? '<span class="emoji">💣</span>' : TARGETS[kind].svg,
    });
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hit(s, el, bad ? -1 : TARGETS[kind].points);
    });
    s.field.append(el);
    setTimeout(() => {
      if (el.classList.contains('gone')) return;
      el.classList.add('gone', 'leave');
      setTimeout(() => el.remove(), 350);
    }, life);
  }

  // Un lugar que no pise a los que ya están (en % del campo)
  function freeSpot(s) {
    const taken = [...s.field.querySelectorAll('.tb-thing:not(.gone)')].map((el) => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) }));
    for (let i = 0; i < 25; i++) {
      const p = { x: between(12, 88), y: between(14, 80) };
      // Abajo a la izquierda está el personaje
      if (p.x < 26 && p.y > 58) continue;
      if (taken.every((t) => Math.hypot(t.x - p.x, t.y - p.y) > 24)) return p;
    }
    return null;
  }

  function hit(s, el, points) {
    const bad = points < 0;
    if (!alive(s) || s.over || el.classList.contains('gone')) return;
    el.classList.add('gone');
    const pop = h('span', { class: 'tb-pop' + (bad ? ' bad' : ' p' + points), style: { left: el.style.left, top: el.style.top } }, bad ? '-1' : '+' + points);
    s.field.append(pop);
    setTimeout(() => pop.remove(), 900);

    if (bad) {
      el.classList.add('boom');
      el.innerHTML = '<span class="emoji">💥</span>';
      sfx.noise(0.35, 'lowpass', 400, 0.5, 0.005);
      sfx.wrong();
      s.screen.querySelector('.tb-scene').classList.remove('shake');
      void s.field.offsetWidth;
      s.screen.querySelector('.tb-scene').classList.add('shake');
      setScore(s, Math.max(0, s.score - 1));
    } else {
      el.classList.add('hit');
      sfx.pop();
      sfx.correct();
      if (points >= 5) sfx.win();
      else if (points >= 2) sfx.coin();
      const stars = h('span', { class: 'tb-stars', style: { left: el.style.left, top: el.style.top } },
        Array.from({ length: 4 + points * 2 }, (_, i, n = 4 + points * 2) => {
          const a = (i / n) * Math.PI * 2;
          const d = 16 + (points >= 5 ? 10 : 0);
          return h('span', { class: 'burst emoji', style: { '--dx': Math.cos(a) * d + 'cqmin', '--dy': Math.sin(a) * d + 'cqmin' } }, points >= 5 ? U.pick(['⭐', '🌟', '✨', '💖']) : '⭐');
        }));
      s.field.append(stars);
      setTimeout(() => stars.remove(), 900);
      const before = s.score;
      setScore(s, s.score + points);
      if (before < TO_WIN && s.score >= TO_WIN) {
        ui().burst(s.hero);
        sfx.cheer();
      }
      if (points > 1 || s.score % 3 === 0) BQ.puppet.use(s.hero.querySelector('.avatar'));
    }
    setTimeout(() => el.remove(), 800);
  }

  function setScore(s, n) {
    s.score = n;
    s.points.textContent = String(n);
    s.points.parentElement.classList.remove('bump');
    void s.points.offsetWidth;
    s.points.parentElement.classList.add('bump');
    [...s.slots.children].forEach((slot, i) => slot.classList.toggle('on', i < n));
    s.slots.classList.toggle('done', n >= TO_WIN);
  }

  async function finish(s) {
    s.over = true;
    clearInterval(s.timer);
    clearTimeout(s.spawner);
    s.field.querySelectorAll('.tb-thing:not(.gone)').forEach((el) => el.classList.add('gone', 'leave'));
    const won = s.score >= TO_WIN;
    sfx.whistle();
    BQ.sport.flash(s.flash, '¡TIEMPO!', won ? 'goal' : 'saved');
    await wait(1400);
    if (!alive(s)) return;
    BQ.sport.result({
      screen: s.screen,
      won,
      perfect: s.score > 15,
      detail: h('div', { class: 'mt-final' }, h('span', { class: 'emoji' }, '🎯'), ` ${s.score}`),
      onAgain: startGame,
      winSay: `¡Ganaste! ¡Hiciste ${s.score} puntos! ¡Te ganaste una moneda!`,
      loseSay: `¡Casi! Hiciste ${s.score} ${s.score === 1 ? 'punto' : 'puntos'}. ¡Jugá otra vez!`,
      isAlive: () => alive(s),
    });
  }

  BQ.tiro = { open };
})(window.BQ);
