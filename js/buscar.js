(function (BQ) {
  'use strict';

  /*
   * Buscá a tu personaje (como "¿Dónde está Wally?"): la pantalla se llena de personajes y hay que
   * encontrar y tocar al propio, que está uno solo entre todos los demás. Cada escena es al azar:
   * cambia el lugar, cuántos personajes hay (de pocos y grandes a muchos y chiquitos) y dónde está.
   * No se pierde: tocar a otro solo lo sacude. Cada 3 encontrados es un partido ganado
   * (1 moneda y 1 partido para los trofeos, como los otros juegos).
   */

  const U = BQ.util;
  const h = U.h;
  const store = BQ.store;
  const voice = BQ.voice;
  const sfx = BQ.sfx;
  const ui = () => BQ.ui;
  const wait = BQ.sport.wait;

  const ROUNDS = 3;
  const CROWDS = [14, 20, 28, 36, 46]; // cuánta gente puede haber en una escena
  const HINT_MS = 14000; // si tarda, el personaje se mueve un poquito para ayudar
  const PLACES = [
    { name: 'plaza', sky: 'linear-gradient(#8fd3ff 0 22%, #9ccc65 22%, #7cb342)', decor: ['🌳', '🌲', '🌷', '🎈', '⛲', '🌻'] },
    { name: 'playa', sky: 'linear-gradient(#81d4fa 0 14%, #29b6f6 14% 26%, #ffe0a3 26%, #ffcc80)', decor: ['⛱️', '🏖️', '🐚', '🦀', '🌴', '⭐'] },
    { name: 'nieve', sky: 'linear-gradient(#b3e5fc 0 22%, #ffffff 22%, #e1f5fe)', decor: ['⛄', '🌲', '❄️', '🛷', '🏔️', '🎿'] },
    { name: 'fiesta', sky: 'linear-gradient(#ce93d8 0 22%, #f8bbd0 22%, #f48fb1)', decor: ['🎈', '🎁', '🎂', '🎉', '🎊', '🍭'] },
    { name: 'granja', sky: 'linear-gradient(#aee1ff 0 22%, #dce775 22%, #c0ca33)', decor: ['🐄', '🐔', '🌾', '🚜', '🐖', '🌻'] },
  ];
  const THEME = { sky1: '#26a69a', sky2: '#b2dfdb', ground: '#00796b', decor: ['🔎', '⭐', '❓', '✨', '👀'] };

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
    const me = BQ.characters.find((c) => c.id === store.data.character) || BQ.characters[0];
    const scene = h('div', { class: 'bs-scene' });
    const flash = h('div', { class: 'sport-flash', hidden: true });
    const stage = h('div', { class: 'bs-stage' }, scene, flash);
    const slots = h('div', { class: 'pen-score bs-score' }, Array.from({ length: ROUNDS }, () => h('span', { class: 'pen-slot' })));
    // Cartel "buscá a este": tocarlo repite la consigna
    const wanted = h('button', {
      class: 'bs-wanted', 'aria-label': 'Buscá a ' + me.name,
      onpointerdown: ui().tap(() => voice.say(`¡Buscá ${toWhom(me)}!`)),
    }, h('span', { class: 'emoji' }, '🔎'), h('span', { class: 'bs-wanted-face' }, BQ.puppet.el(me.id)));

    const screen = h('div', { class: 'screen buscar' },
      ui().topbar(ui().backBtn(() => { stop(); ui().showWorlds(); }), h('div', { class: 'bs-top' }, wanted, slots), h('span', { class: 'spacer' })),
      stage);
    ui().show(screen, THEME);

    const s = { screen, stage, scene, flash, slots, me, round: 0, busy: true, target: null, hint: null, lastPlace: null, lastCrowd: null };
    S = s;
    listen(s);
    newScene(s);
  }

  function stop() {
    if (S) clearTimeout(S.hint);
    S = null;
  }

  // "al mago", "a la princesa"
  const toWhom = (c) => c.name.replace(/^el /, 'al ').replace(/^la /, 'a la ');

  // ---------- Armar una escena ----------

  function newScene(s) {
    clearTimeout(s.hint);
    s.busy = true;
    s.flash.hidden = true;
    [...s.slots.children].forEach((sl, i) => sl.classList.toggle('now', i === s.round));
    // Lugar y cantidad de gente al azar (sin repetir los de la escena anterior)
    const place = U.pick(PLACES.filter((p) => p !== s.lastPlace));
    const crowd = U.pick(CROWDS.filter((c) => c !== s.lastCrowd));
    s.lastPlace = place;
    s.lastCrowd = crowd;

    const r = s.stage.getBoundingClientRect();
    const W = Math.max(1, r.width);
    const H = Math.max(1, r.height);
    // Grilla desordenada: filas y columnas según la forma de la pantalla; cada uno, corrido al azar
    const cols = Math.max(3, Math.round(Math.sqrt((crowd * W) / H)));
    const rows = Math.ceil(crowd / cols);
    const cells = U.shuffle(Array.from({ length: rows * cols }, (_, i) => i)).slice(0, crowd);
    const top = 0.2; // arriba queda el "cielo" del lugar
    const cellH = (H * (1 - top)) / rows;
    const size = Math.min(cellH * 1.55, (W / cols) * 1.5); // alto de cada personaje (se pisan un poco)
    const others = BQ.characters.filter((c) => c.id !== s.me.id);
    const targetCell = U.pick(cells);

    const people = cells.map((cell) => {
      const row = Math.floor(cell / cols);
      const col = cell % cols;
      const isTarget = cell === targetCell;
      return {
        isTarget,
        char: isTarget ? s.me : U.pick(others),
        x: ((col + 0.5 + rnd(-0.3, 0.3)) / cols) * W,
        y: H * top + (row + 1 + rnd(-0.25, 0.1)) * cellH, // dónde apoya los pies
        flip: Math.random() < 0.5,
      };
    }).sort((a, b) => a.y - b.y); // los de más abajo quedan adelante

    // Que nadie de adelante le tape la cara al buscado: se corren al costado
    const t = people.find((p) => p.isTarget);
    const w = size * 0.72;
    for (const p of people) {
      if (p === t || p.y <= t.y) continue;
      const coversHead = Math.abs(p.x - t.x) < w * 0.75 && p.y - size < t.y - size * 0.45;
      if (coversHead) p.x += (p.x >= t.x ? 1 : -1) * w * 0.8;
    }

    s.scene.style.background = place.sky;
    s.scene.replaceChildren(
      // Adornos del lugar, repartidos por el fondo
      ...U.shuffle(place.decor.slice()).slice(0, 5).map((d, i) => h('span', {
        class: 'bs-decor emoji',
        style: { left: 8 + i * 21 + rnd(-5, 5) + '%', top: rnd(2, 12) + '%', 'font-size': Math.min(W, H) * rnd(0.09, 0.14) + 'px' },
      }, d)),
      ...people.map((p, i) => {
        const el = h('span', {
          class: 'bs-person' + (p.flip ? ' flip' : ''),
          style: { left: p.x + 'px', top: p.y + 'px', 'font-size': size / 1.12 + 'px', 'z-index': String(10 + i) },
        }, BQ.puppet.el(p.char.id, p.isTarget ? undefined : []));
        if (p.isTarget) s.target = el;
        return el;
      }));

    voice.say(s.round === 0 ? `¡Buscá ${toWhom(s.me)}!` : U.pick(['¿Y ahora dónde está?', '¡A buscar otra vez!', '¿Dónde se escondió?']))
      .then(() => { /* se puede tocar apenas aparece */ });
    s.busy = false;
    s.hint = setTimeout(() => { if (alive(s) && !s.busy) s.target.classList.add('hint'); }, HINT_MS);
  }

  // ---------- Tocar ----------

  function listen(s) {
    s.stage.addEventListener('pointerdown', (e) => {
      if (!alive(s) || s.busy) return;
      e.preventDefault();
      sfx.init();
      // Primero se mira si tocó al buscado (su cuerpo, sin los bordes vacíos del dibujo), aunque
      // tenga a otro encimado; si no, se sacude al que tocó
      const r = s.target.getBoundingClientRect();
      const inX = Math.abs(e.clientX - (r.left + r.width / 2)) < r.width * 0.36;
      const inY = e.clientY > r.top + r.height * 0.02 && e.clientY < r.bottom;
      if (inX && inY) return found(s);
      const person = e.target.closest ? e.target.closest('.bs-person') : null;
      if (!person) return;
      person.classList.remove('nope');
      void person.offsetWidth;
      person.classList.add('nope');
      sfx.wrong();
      const now = Date.now();
      if (!s.told || now - s.told > 3500) {
        s.told = now;
        voice.say(U.pick(['¡Ese no!', '¡Seguí buscando!', '¡Casi! Ese no es.']));
      }
    });
  }

  async function found(s) {
    s.busy = true;
    clearTimeout(s.hint);
    s.target.classList.remove('hint');
    s.target.classList.add('found');
    s.scene.classList.add('done');
    s.slots.children[s.round].classList.remove('now');
    s.slots.children[s.round].classList.add('goal');
    BQ.sport.flash(s.flash, '¡ACÁ ESTÁ!', 'goal');
    sfx.correct();
    sfx.cheer();
    ui().burst(s.target);
    BQ.puppet.use(s.target.querySelector('.avatar'));
    s.round++;
    await Promise.all([voice.say(U.pick(['¡Ahí está!', '¡Muy bien, ahí estaba!', '¡Qué buenos ojos!'])), wait(1900)]);
    if (!alive(s)) return;
    s.scene.classList.remove('done');
    if (s.round < ROUNDS) return newScene(s);

    // Tres encontrados: partido ganado
    s.flash.hidden = true;
    BQ.sport.result({
      screen: s.screen,
      won: true,
      detail: h('div', { class: 'mt-final' }, h('span', { class: 'emoji' }, '🔎'), ` ${ROUNDS} de ${ROUNDS}`),
      onAgain: startGame,
      winSay: '¡Encontraste los tres! ¡Te ganaste una moneda!',
      loseSay: '',
      isAlive: () => alive(s),
    });
  }

  BQ.buscar = { open, state: () => S };
})(window.BQ);
