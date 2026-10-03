(function (BQ) {
  'use strict';

  const U = BQ.util;
  const h = U.h;
  const store = BQ.store;
  const voice = BQ.voice;
  const sfx = BQ.sfx;
  const app = document.getElementById('app');

  const PRAISES = ['¡Muy bien!', '¡Genial!', '¡Excelente!', '¡Bravo!', '¡Súper!', '¡Eso es!', '¡Qué bien!', '¡Lo hiciste muy bien!'];
  const LOGO_COLORS = ['#ff5a8a', '#ffb200', '#35c46a', '#2f9bff', '#9b5cff'];
  const CONFETTI_COLORS = ['#ff5a8a', '#ffd23f', '#35c46a', '#2f9bff', '#9b5cff', '#ff8a3d'];
  const DEFAULT_THEME = {
    sky1: '#b9a4ff', sky2: '#ffc6e8', ground: '#9be08f',
    decor: ['⭐', '☁️', '🎈', '✨', '🌈'],
  };

  // Cada cambio de pantalla invalida las esperas (await) de la pantalla anterior.
  let token = 0;

  const currentChar = () => BQ.characters.find((c) => c.id === store.data.character) || BQ.characters[0];

  // Los chicos chiquitos arrastran el dedo al tocar: pointerdown responde mejor que click.
  const tap = (fn) => (e) => {
    e.preventDefault();
    sfx.init();
    fn(e);
  };

  // ---------- Piezas reutilizables ----------

  function background(theme) {
    const bg = h('div', { class: 'bg', style: { '--sky1': theme.sky1, '--sky2': theme.sky2, '--ground': theme.ground } });
    const spots = [[5, 8], [82, 5], [42, 12], [18, 38], [90, 32], [62, 26], [30, 60], [74, 55], [6, 72], [93, 70]];
    spots.forEach(([x, y], i) => bg.append(h('span', {
      class: 'decor emoji',
      style: { left: x + '%', top: y + '%', 'font-size': 5 + (i % 3) * 2 + 'vmin', 'animation-delay': -i * 0.7 + 's' },
    }, theme.decor[i % theme.decor.length])));
    return bg;
  }

  function show(screen, theme) {
    token++;
    voice.stop();
    app.replaceChildren(background(theme || DEFAULT_THEME), screen);
  }

  // Personaje de cuerpo entero con la ropa que tiene puesta
  const avatarEl = (c) => BQ.puppet.el(c.id);

  // Tocar al personaje: usa sus cosas (o hace su gesto)
  const playable = (el) => {
    el.classList.add('playable');
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sfx.init();
      BQ.puppet.use(el.querySelector('.avatar'));
    });
    return el;
  };

  // Moneda dibujada con CSS (el emoji de moneda no existe en todos los dispositivos)
  const coinEl = (cls) => h('span', { class: 'coin' + (cls ? ' ' + cls : '') });

  const counters = new Set();
  function coinCounter() {
    const n = h('span', { class: 'coin-n' }, String(store.data.coins));
    const el = h('span', { class: 'coin-counter' }, coinEl(), n);
    el.set = (v) => {
      n.textContent = String(v);
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    };
    counters.add(el);
    return el;
  }
  function refreshCounters() {
    for (const el of counters) {
      if (el.isConnected) el.set(store.data.coins);
      else counters.delete(el);
    }
  }

  // Personaje montado en el transporte del mundo
  function rideEl(world, c) {
    const v = world.vehicle;
    const r = v.rider || {};
    return h('div', {
      class: 'ride anim-' + (v.anim || 'bounce'),
      style: { '--rb': r.bottom || '40%', '--rl': r.left || '25%', '--rs': r.size || 0.5, '--rz': r.front ? 3 : 1 },
    },
    h('div', { class: 'ride-rider' }, avatarEl(c)),
    h('div', { class: 'ride-vehicle emoji' + (v.flip ? ' flip' : '') }, v.emoji));
  }

  function backBtn(fn) {
    return h('button', { class: 'btn-round back', 'aria-label': 'Volver', onpointerdown: tap(fn) }, h('span', { class: 'emoji' }, '⬅️'));
  }

  // Engranaje para adultos: mantenerlo apretado 1,2 segundos o tocarlo 3 veces seguidas.
  // (En Android mantener apretado abre el menú contextual y cancela el toque: por eso se bloquea
  // ese menú y existe la alternativa de los 3 toques.)
  const HOLD_MS = 1200;
  function gearBtn() {
    let timer;
    let taps = [];
    const b = h('button', { class: 'btn-round gear', 'aria-label': 'Opciones para adultos' }, h('span', { class: 'emoji' }, '⚙️'));
    const cancel = () => {
      clearTimeout(timer);
      b.classList.remove('holding');
    };
    const openPanel = () => {
      cancel();
      taps = [];
      openParentPanel();
    };
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const now = Date.now();
      taps = taps.filter((t) => now - t < 1500).concat(now);
      if (taps.length >= 3) return openPanel();
      b.classList.add('holding');
      timer = setTimeout(openPanel, HOLD_MS);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, cancel));
    return b;
  }

  function topbar(left, title, right) {
    return h('div', { class: 'topbar' }, left || h('span', { class: 'spacer' }), title, right || gearBtn());
  }

  function starsRow(done, total) {
    return Array.from({ length: total }, (_, i) => h('span', { class: 'star' + (i < done ? ' on' : '') }, '★'));
  }

  function confetti() {
    const wrap = h('div', { class: 'confetti' });
    for (let i = 0; i < 70; i++) {
      wrap.append(h('i', {
        style: {
          left: Math.random() * 100 + '%',
          background: U.pick(CONFETTI_COLORS),
          'animation-delay': Math.random() * 2 + 's',
          'animation-duration': 2.5 + Math.random() * 2 + 's',
        },
      }));
    }
    return wrap;
  }

  function burst(el) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const s = h('span', { class: 'burst emoji', style: { '--dx': Math.cos(a) * 45 + 'cqmin', '--dy': Math.sin(a) * 45 + 'cqmin' } }, '⭐');
      el.append(s);
      setTimeout(() => s.remove(), 900);
    }
  }

  function goFullscreen() {
    const el = document.documentElement;
    if (matchMedia('(pointer: coarse)').matches && el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    }
  }

  // ---------- Pantallas ----------

  function showTitle() {
    const letters = 'Baby Quiz'.split('').map((ch, i) => (ch === ' '
      ? h('span', { class: 'logo-space' })
      : h('span', { class: 'logo-l', style: { '--i': i, color: LOGO_COLORS[i % LOGO_COLORS.length] } }, ch)));
    const parade = h('div', { class: 'parade' },
      U.sample(BQ.characters, 5).map((c, i) => playable(h('span', { class: 'parade-item', style: { '--i': i } }, avatarEl(c)))));
    const play = h('button', { class: 'play-btn', 'aria-label': 'Jugar', onpointerdown: tap(start) }, h('span', { class: 'play-tri' }));

    show(h('div', { class: 'screen title' },
      topbar(null, h('span', { class: 'spacer' })),
      h('h1', { class: 'logo' }, letters),
      parade,
      play));

    function start() {
      goFullscreen();
      voice.unlock();
      // Llegó por un link de bingo (#bingo-CODIGO): directo a la partida
      const room = /^#bingo-([A-Z0-9]{4})$/i.exec(location.hash);
      if (room && BQ.bingo) BQ.bingo.open(room[1].toUpperCase());
      else if (!store.data.character) showCharacters();
      else showWorlds(true);
    }
  }

  function showCharacters() {
    const tk = () => token;
    const grid = h('div', { class: 'char-grid' });
    for (const c of BQ.characters) {
      const b = h('button', {
        class: 'char-btn' + (store.data.character === c.id ? ' selected' : ''),
        'aria-label': c.name,
        onpointerdown: tap(() => choose(c, b)),
      }, avatarEl(c));
      grid.append(b);
    }

    show(h('div', { class: 'screen chars' },
      topbar(store.data.character ? backBtn(() => showWorlds()) : null, h('h2', { class: 'screen-title' }, '¿Con quién querés jugar?')),
      grid));
    voice.say('¿Con quién querés jugar?');
    const myToken = tk();

    async function choose(c, b) {
      BQ.puppet.use(b.querySelector('.avatar'));
      grid.querySelectorAll('.char-btn').forEach((x) => x.classList.remove('selected'));
      b.classList.add('selected');
      grid.classList.add('locked');
      sfx.correct();
      store.data.character = c.id;
      store.save();
      await Promise.race([voice.say(`¡${U.cap(c.name)}!`), U.wait(2500)]);
      await U.wait(250);
      if (myToken === token) showWorlds(true);
    }
  }

  function showWorlds(greet) {
    const cards = BQ.worlds.map((w) => h('button', {
      class: 'world-card',
      style: { '--c1': w.theme.card1, '--c2': w.theme.card2 },
      onpointerdown: tap(() => {
        showLevels(w);
        voice.say(U.cap(w.sayName));
      }),
    },
    h('span', { class: 'emoji wc-icon' }, w.icon),
    h('span', { class: 'wc-name' }, w.name),
    h('span', { class: 'wc-stars' }, starsRow(store.completed(w.id), w.levels))));

    const shopBtn = h('button', { class: 'shop-btn', 'aria-label': 'Tienda', onpointerdown: tap(() => showShop()) },
      h('span', { class: 'emoji' }, '🛍️'), coinCounter());
    // Juegos aparte de los mundos
    const games = h('div', { class: 'games-row' },
      h('button', { class: 'game-pill penales', onpointerdown: tap(() => BQ.penales.open()) }, h('span', { class: 'emoji' }, '🥅'), ' Penales'),
      h('button', { class: 'game-pill libres', onpointerdown: tap(() => BQ.libres.open()) }, h('span', { class: 'emoji' }, '⚽💨'), ' Tiros libres'),
      h('button', { class: 'game-pill partido', onpointerdown: tap(() => BQ.partido.open()) }, h('span', { class: 'emoji' }, '⚽'), ' Partidito'),
      h('button', { class: 'game-pill pool', onpointerdown: tap(() => BQ.pool.open()) }, h('span', { class: 'emoji' }, '🎱'), ' Pool'),
      h('button', { class: 'game-pill bowling', onpointerdown: tap(() => BQ.bowling.open()) }, h('span', { class: 'emoji' }, '🎳'), ' Bowling'),
      h('button', { class: 'game-pill ppt', 'aria-label': 'Piedra, papel o tijera', onpointerdown: tap(() => BQ.ppt.open()) }, h('span', { class: 'emoji' }, '✊✋✌️')),
      h('button', { class: 'game-pill tiro', onpointerdown: tap(() => BQ.tiro.open()) }, h('span', { class: 'emoji' }, '🎯'), ' Tiro al blanco'),
      h('button', { class: 'game-pill bingo', onpointerdown: tap(() => BQ.bingo.open()) }, h('span', { class: 'emoji' }, '🎟️'), ' Bingo'),
      h('button', { class: 'game-pill trofeos', onpointerdown: tap(() => BQ.trophies.open()) }, h('span', { class: 'emoji' }, '🏆'), ' Trofeos'));

    show(h('div', { class: 'screen worlds' },
      topbar(
        h('button', { class: 'btn-round char-mini', 'aria-label': 'Cambiar personaje', onpointerdown: tap(showCharacters) }, avatarEl(currentChar())),
        h('h2', { class: 'screen-title' }, '¿A dónde vamos?'),
        h('div', { class: 'top-right' }, shopBtn, gearBtn())),
      h('div', { class: 'worlds-grid' }, cards),
      games));
    if (greet) voice.say('¿A dónde vamos?');
  }

  function showLevels(world) {
    const done = store.completed(world.id);
    const current = Math.min(done + 1, world.levels);
    const nodes = [];

    for (let L = 1; L <= world.levels; L++) {
      const unlocked = L <= done + 1;
      const completed = L <= done;
      const b = h('button', {
        class: 'level-node' + (completed ? ' done' : '') + (unlocked ? '' : ' locked') + (L === current && !completed ? ' next' : ''),
        style: { '--dy': (L % 2 ? -5 : 5) + 'vmin' },
        'aria-label': 'Nivel ' + L,
        onpointerdown: tap(() => {
          if (unlocked) return startLevel(world, L);
          b.classList.remove('nope');
          void b.offsetWidth;
          b.classList.add('nope');
          sfx.wrong();
          voice.say('Primero jugá el nivel ' + (done + 1));
        }),
      },
      h('span', { class: 'ln-num' + (unlocked ? '' : ' emoji') }, unlocked ? String(L) : '🔒'),
      completed && h('span', { class: 'emoji ln-star' }, '⭐'),
      L === current && h('span', { class: 'ln-rider' }, rideEl(world, currentChar())));
      nodes.push(b);
    }

    show(h('div', { class: 'screen levels' },
      topbar(backBtn(() => showWorlds()),
        h('h2', { class: 'screen-title' }, h('span', { class: 'emoji' }, world.icon), ' ', world.name)),
      h('div', { class: 'level-path' }, nodes)), world.theme);
  }

  // ---------- Tienda ----------

  function showShop() {
    const c = currentChar();
    const W = BQ.wardrobe;
    const counter = coinCounter();
    const hero = h('div', { class: 'shop-hero' });
    // Con muchas cosas (el futbolista tiene más de 20), la tienda se separa en pestañas por tipo:
    // camisetas, pelotas, botines y lo demás. Cada pestaña es un dibujito (el chico no lee).
    const all = W.items(c.id);
    const TABS = [
      { id: 'body', icon: '👕', say: 'Camisetas' },
      { id: 'ball', icon: '⚽', say: 'Pelotas' },
      { id: 'feet', icon: '👟', say: 'Botines' },
      { id: 'otros', icon: '✨', say: 'Otras cosas' },
    ];
    const tabOf = (item) => (['body', 'ball', 'feet'].includes(item.slot) ? item.slot : 'otros');
    const tabs = all.length > 9 ? TABS.filter((t) => all.some((it) => tabOf(it) === t.id)) : [];
    let tab = tabs.length ? tabs[0].id : null;
    const shown = () => (tab ? all.filter((it) => tabOf(it) === tab) : all);
    const grid = h('div', { class: 'shop-grid' });
    const tabBar = tabs.length > 1 && h('div', { class: 'shop-tabs' }, tabs.map((t) => h('button', {
      class: 'shop-tab', 'data-tab': t.id, 'aria-label': t.say,
      onpointerdown: tap(() => {
        if (tab === t.id) return;
        tab = t.id;
        sfx.tap();
        voice.say(t.say);
        paint();
      }),
    }, h('span', { class: 'emoji' }, t.icon))));

    function paint() {
      hero.replaceChildren(avatarEl(c));
      // Más columnas cuantas más cosas haya, para que entren en pantalla
      const count = shown().length;
      grid.className = 'shop-grid' + (count > 9 ? ' lots' : count > 4 ? ' many' : '');
      if (tabBar) tabBar.querySelectorAll('.shop-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
      grid.replaceChildren(...shown().map((item) => {
        const owned = W.owns(c.id, item.id);
        const worn = W.wears(c.id, item.id);
        const b = h('button', {
          class: 'shop-item' + (owned ? ' owned' : '') + (worn ? ' worn' : ''),
          'aria-label': item.name,
          onpointerdown: tap(() => pick(item, b)),
        },
        h('span', { class: 'shop-art' }, W.card(item)),
        owned
          ? h('span', { class: 'shop-tag' + (worn ? ' on' : '') }, worn ? '✔' : '')
          : W.price(item) === 0
            ? h('span', { class: 'shop-price free' }, 'GRATIS')
            : h('span', { class: 'shop-price' }, coinEl(), String(W.price(item))));
        return b;
      }));
    }

    function pick(item, b) {
      if (W.owns(c.id, item.id)) {
        if (W.wears(c.id, item.id)) {
          W.takeOff(c.id, item);
          sfx.tap();
          voice.say(`Le sacaste ${item.name}`);
        } else {
          W.wear(c.id, item);
          sfx.correct();
          voice.say(`¡Le pusiste ${item.name}!`);
          paint();
          showOff(item);
          return;
        }
        paint();
        return;
      }
      if (!W.buy(c.id, item)) {
        b.classList.remove('nope');
        void b.offsetWidth;
        b.classList.add('nope');
        sfx.wrong();
        voice.say(`Necesitás ${U.NUM_WORDS[W.price(item)]} monedas y tenés ${coinsWord()}. ¡Pasá niveles para ganar más!`);
        return;
      }
      sfx.coin();
      counter.set(store.data.coins);
      voice.say(W.price(item) === 0 ? `¡Te regalaron ${item.name}!` : `¡Le compraste ${item.name}!`);
      paint();
      burst(hero);
      showOff(item);
    }

    // Recién puesta, el personaje la usa
    function showOff(item) {
      setTimeout(() => BQ.puppet.use(hero.querySelector('.avatar'), BQ.puppet.kindFor(item)), 350);
    }

    playable(hero);
    paint();
    show(h('div', { class: 'screen shop' },
      topbar(backBtn(() => showWorlds()), h('h2', { class: 'screen-title' }, h('span', { class: 'emoji' }, '🛍️'), ' Tienda'),
        h('div', { class: 'top-right' }, counter, gearBtn())),
      h('div', { class: 'shop-body' }, hero, h('div', { class: 'shop-side' }, tabBar, grid))));
    voice.say(store.data.coins >= W.PRICE
      ? `¡Bienvenido a la tienda! ¿Qué le comprás ${c.name.replace(/^el /, 'al ').replace(/^la /, 'a la ')}?`
      : `¡Bienvenido a la tienda! Cada cosa cuesta ${U.NUM_WORDS[W.PRICE]} monedas. ¡Pasá niveles para juntarlas!`);
  }

  // "una moneda", "tres monedas", "ninguna moneda"
  function coinsWord(n = store.data.coins) {
    if (n === 0) return 'ninguna';
    if (n === 1) return 'una';
    return n <= 10 ? U.NUM_WORDS[n] : String(n);
  }

  // ---------- Juego ----------

  function startLevel(world, level) {
    const N = world.questionsPerLevel;
    const S = { step: 0, used: new Set(), q: null, attempts: 0 };
    const pos = (i) => 6 + i * (88 / N);

    const track = h('div', { class: 'track' }, h('div', { class: 'road' }));
    const nodes = [];
    for (let i = 0; i <= N; i++) {
      const node = h('div', { class: 'node' + (i === N ? ' goal' : '') + (i === 0 ? ' start' : ''), style: { left: pos(i) + '%' } },
        i === N && h('span', { class: 'emoji' }, world.goal));
      nodes.push(node);
      track.append(node);
    }
    const rider = playable(h('div', { class: 'ride-pos', style: { left: pos(0) + '%' } }, rideEl(world, currentChar())));
    track.append(rider);

    const repeat = () => S.q && voice.say(S.q.say);
    const speakBtn = h('button', { class: 'speak-btn', 'aria-label': 'Repetir pregunta', onpointerdown: tap(repeat) }, h('span', { class: 'emoji' }, '🔊'));
    const promptBox = h('button', { class: 'prompt', onpointerdown: tap(repeat) });
    const qtext = h('p', { class: 'qtext' });
    const options = h('div', { class: 'options' });
    const board = h('div', { class: 'board', hidden: true });

    const screen = h('div', { class: 'screen game' },
      h('div', { class: 'game-top' }, backBtn(() => showLevels(world)), track),
      h('div', { class: 'ask' }, h('div', { class: 'ask-row' }, speakBtn, promptBox), qtext),
      options,
      board);
    show(screen, world.theme);

    const myToken = token;
    const alive = () => myToken === token;

    function nextQuestion(prefix) {
      S.q = BQ.nextQuestion(world, level, S.used);
      S.attempts = 0;
      promptBox.hidden = !S.q.prompt;
      promptBox.replaceChildren(S.q.prompt ? BQ.renderVisual(S.q.prompt) : '');
      qtext.textContent = S.q.text;
      const connect = S.q.kind === 'connect';
      options.hidden = connect;
      board.hidden = !connect;
      voice.say(prefix ? `${prefix} ${S.q.say}` : S.q.say);
      if (connect) return startConnect();

      options.replaceChildren(...S.q.options.map((o, k) => {
        const b = h('button', { class: 'option', style: { '--k': k }, onpointerdown: tap(() => answer(o, b)) }, BQ.renderVisual(o));
        o.el = b;
        return b;
      }));
      options.classList.remove('locked');
    }

    // Unir puntos: cada tablero completo avanza una parada.
    function startConnect() {
      const firstBoard = S.step === 0 && level === 1;
      const game = BQ.connectBoard(board, S.q.pairs, {
        onStart() { sfx.init(); game.stopHint(); },
        onPair(color) {
          sfx.correct();
          voice.say(`¡${U.cap(color.name)}!`);
        },
        onMiss() {
          sfx.wrong();
          voice.say('¡Casi! Llevá el dedo hasta el otro punto.');
          game.hint();
        },
        onDone() {
          voice.stop();
          advance(board);
        },
      });
      if (firstBoard) setTimeout(() => alive() && game.hint(), 900);
    }

    // Respuesta correcta: festejo, el personaje avanza y sigue la próxima pregunta (o la fiesta).
    async function advance(el) {
      sfx.correct();
      burst(el);
      // Se espera a que termine el festejo hablado Y el viaje del personaje antes de seguir.
      const praised = voice.say(U.pick(PRAISES));
      S.step++;
      await U.wait(400);
      if (!alive()) return;
      sfx.step();
      nodes[S.step].classList.add('done');
      rider.classList.add('moving');
      rider.style.left = pos(S.step) + '%';
      await Promise.all([praised, U.wait(1400)]);
      if (!alive()) return;
      rider.classList.remove('moving');
      await U.wait(250);
      if (!alive()) return;
      if (S.step >= N) levelComplete();
      else nextQuestion();
    }

    async function answer(o, b) {
      if (options.classList.contains('locked') || b.classList.contains('wrong')) return;

      if (o.correct) {
        options.classList.add('locked');
        b.classList.add('right');
        advance(b);
        return;
      }

      // Respuesta incorrecta: la primera vez se deshabilita esa opción;
      // la segunda se muestra la correcta y se pasa a otra pregunta (sin avanzar).
      S.attempts++;
      b.classList.add('wrong');
      sfx.wrong();
      if (S.attempts === 1) {
        voice.say(`¡Casi! Probá otra vez. ${S.q.say}`);
        return;
      }
      options.classList.add('locked');
      S.q.options.find((x) => x.correct).el.classList.add('hint');
      await Promise.all([voice.say('¡Mirá! Era este.'), U.wait(1800)]);
      await U.wait(300);
      if (alive()) nextQuestion('¡Vamos con otra!');
    }

    // Fiesta de fin de nivel: el personaje vuela al centro, fuegos artificiales, globos y
    // recién al final aparecen los botones (así los toques seguidos no se saltean el festejo).
    function levelComplete() {
      store.complete(world.id, level);
      const last = level >= world.levels;
      const next = last ? () => showWorlds() : () => startLevel(world, level + 1);
      const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

      const titleText = last ? '¡Mundo completo!' : '¡Lo lograste!';
      const title = h('h2', { class: 'party-title' }, [...titleText].map((ch, i) => h('span', {
        style: { '--i': i, color: LOGO_COLORS[i % LOGO_COLORS.length] },
      }, ch === ' ' ? ' ' : ch)));
      const hero = playable(h('div', { class: 'party-hero' }, rideEl(world, currentChar())));
      const fx = h('div', { class: 'party-fx' });
      const balloons = Array.from({ length: 7 }, (_, i) => h('span', {
        class: 'balloon emoji',
        style: {
          left: 6 + i * 14 + Math.random() * 6 + '%',
          'animation-delay': 0.8 + Math.random() * 1.6 + 's',
          filter: `hue-rotate(${U.rand(360)}deg)`,
        },
      }, '🎈'));

      // Premio de una moneda (primera vez, o repitiendo en un mundo ya completo)
      const earnedCoin = store.awardLevelCoin(world.id, level, world.levels);
      const canBuy = store.data.coins >= BQ.wardrobe.PRICE;
      const shopBtn = (cls) => h('button', { class: 'btn-shop' + (cls ? ' ' + cls : ''), 'aria-label': 'Tienda', onpointerdown: tap(() => showShop()) }, h('span', { class: 'emoji' }, '🛍️'));

      // El botón grande es la acción principal: seguir jugando, o la tienda al terminar un mundo con monedas
      const actions = last
        ? [
          h('button', { class: 'btn-round', 'aria-label': 'Mundos', onpointerdown: tap(() => showWorlds()) }, h('span', { class: 'emoji' }, '🗺️')),
          canBuy ? shopBtn() : h('button', { class: 'btn-next', 'aria-label': 'Mundos', onpointerdown: tap(next) }, h('span', { class: 'play-tri' })),
        ]
        : [
          h('button', { class: 'btn-round', 'aria-label': 'Niveles', onpointerdown: tap(() => showLevels(world)) }, h('span', { class: 'emoji' }, '🗺️')),
          h('button', { class: 'btn-next', 'aria-label': 'Siguiente', onpointerdown: tap(next) }, h('span', { class: 'play-tri' })),
          canBuy
            ? shopBtn('mini')
            : h('button', { class: 'btn-round', 'aria-label': 'Repetir nivel', onpointerdown: tap(() => startLevel(world, level)) }, h('span', { class: 'emoji' }, '🔁')),
        ];

      const party = h('div', { class: 'party' },
        h('div', { class: 'party-rays' }),
        balloons,
        confetti(),
        fx,
        title,
        hero,
        last && h('div', { class: 'party-prize emoji' }, '🏆'),
        h('div', { class: 'party-actions' }, actions));
      screen.append(party);

      // Salto desde el camino hasta el centro, con una vuelta en el aire
      if (!calm) {
        const from = rider.getBoundingClientRect();
        const to = hero.getBoundingClientRect();
        const dx = from.left + from.width / 2 - (to.left + to.width / 2);
        const dy = from.top + from.height / 2 - (to.top + to.height / 2);
        const s = from.width / to.width;
        hero.animate([
          { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
          { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - to.height * 0.8}px) scale(${(s + 1) / 2}) rotate(-25deg)`, offset: 0.45 },
          { transform: 'translate(0, 0) scale(1.2) rotate(360deg)', offset: 0.8 },
          { transform: 'translate(0, 0) scale(1) rotate(360deg)' },
        ], { duration: 1100, easing: 'ease-in-out' });
      }
      rider.style.visibility = 'hidden';
      sfx.whee();

      const later = (ms, fn) => setTimeout(() => alive() && fn(), ms);
      later(1500, () => BQ.puppet.use(hero.querySelector('.avatar')));
      later(1100, () => {
        sfx.win();
        voice.say(last
          ? `¡Increíble! ¡Completaste ${world.sayName}!`
          : `¡Yupi! ¡Lo lograste! ¡Vamos al nivel ${level + 1}!`);
      });
      [1000, 1500, 1900, 2400, 2900, 3400].forEach((ms) => later(ms, () => firework(fx)));
      later(3300, () => (earnedCoin ? coinReward(party, fx) : party.classList.add('settled')));
    }

    // Moneda gigante que gira y brilla, y después cae en la fila de 5 lugares (lo que cuesta una prenda)
    async function coinReward(party, fx) {
      const price = BQ.wardrobe.PRICE;
      const coins = store.data.coins;
      const before = Math.min(coins - 1, price);
      const after = Math.min(coins, price);

      const counter = coinCounter();
      counter.classList.add('party-coins');
      counter.querySelector('.coin-n').textContent = String(coins - 1);
      const slots = Array.from({ length: price }, (_, i) => coinEl('slot' + (i < before ? ' on' : '')));
      const coin = coinEl('big-coin');
      const stage = h('div', { class: 'coin-stage' },
        h('div', { class: 'coin-glow' }),
        coin,
        h('div', { class: 'coin-goal' }, slots, h('span', { class: 'emoji goal-bag' }, '🛍️')));
      party.append(counter, stage);
      party.classList.add('coin-time');
      sfx.coin();
      [300, 1000].forEach((ms) => setTimeout(() => alive() && firework(fx), ms));

      const missing = price - coins;
      await Promise.all([
        voice.say(missing <= 0
          ? `¡Ganaste una moneda! ¡Ya tenés ${coinsWord(coins)}! ¡Podés comprar algo en la tienda!`
          : `¡Ganaste una moneda! Te ${missing === 1 ? 'falta una' : `faltan ${U.NUM_WORDS[missing]}`} para comprar algo en la tienda.`),
        U.wait(2400),
      ]);
      if (!alive()) return;

      // Vuela a su lugar en la fila (o al contador, si la fila ya estaba llena)
      const target = before < price ? slots[after - 1] : counter.querySelector('.coin');
      const from = coin.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      const fly = coin.animate([
        { transform: 'translate(0, 0) scale(1)' },
        {
          transform: `translate(${to.left + to.width / 2 - (from.left + from.width / 2)}px, ${to.top + to.height / 2 - (from.top + from.height / 2)}px) scale(${to.width / from.width})`,
        },
      ], { duration: 750, easing: 'cubic-bezier(.5,0,.7,1)', fill: 'forwards' });
      // Tope de tiempo: si la pantalla está en segundo plano la animación no avanza y no hay que trabarse
      await Promise.race([fly.finished.catch(() => {}), U.wait(1000)]);
      if (!alive()) return;
      coin.remove();
      target.classList.add('on');
      sfx.coin();
      counter.set(coins);
      if (after >= price) stage.classList.add('full');
      await U.wait(after >= price ? 1400 : 900);
      if (!alive()) return;
      stage.remove();
      party.classList.remove('coin-time');
      party.classList.add('settled');
    }

    function firework(layer) {
      const x = 12 + Math.random() * 76;
      const y = 12 + Math.random() * 40;
      const color = U.pick(CONFETTI_COLORS);
      const radius = Math.min(innerWidth, innerHeight) * (0.12 + Math.random() * 0.08);
      sfx.pop();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const c = i % 2 ? color : '#fff';
        const spark = h('i', { class: 'spark', style: { left: x + '%', top: y + '%', background: c, color: c } });
        layer.append(spark);
        spark.animate([
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${Math.cos(a) * radius}px, ${Math.sin(a) * radius + 20}px) scale(.3)`, opacity: 0 },
        ], { duration: 900, easing: 'cubic-bezier(.1,.7,.3,1)' }).onfinish = () => spark.remove();
      }
    }

    nextQuestion(`¡Nivel ${level}!`);
  }

  // ---------- Panel para adultos ----------

  function openParentPanel() {
    const settings = store.data.settings;
    const voices = voice.spanishVoices();

    const natural = (v) => /natural|neural|premium|enhanced|wavenet|online/i.test(v.name);
    const voiceSel = h('select', {},
      voices.length
        ? [
          h('option', { value: '', selected: settings.voiceURI ? null : 'selected' }, '✨ Automática (la más natural que haya)'),
          ...voices.map((v) => h('option', { value: v.voiceURI, selected: settings.voiceURI === v.voiceURI ? 'selected' : null },
            `${natural(v) ? '✨ ' : ''}${v.name} (${v.lang})${v.localService ? '' : ' · necesita internet'}`)),
        ]
        : h('option', {}, 'No hay voces en español instaladas'));
    voiceSel.addEventListener('change', () => {
      settings.voiceURI = voiceSel.value || null;
      store.save();
      voice.choose();
      voice.say('Hola, así suena mi voz');
    });

    const rate = h('input', { type: 'range', min: '0.6', max: '1.3', step: '0.05', value: String(settings.rate) });
    rate.addEventListener('change', () => {
      settings.rate = Number(rate.value);
      store.save();
      voice.say('¿Así está bien?');
    });

    const sfxChk = h('input', { type: 'checkbox' });
    sfxChk.checked = settings.sfx;
    sfxChk.addEventListener('change', () => {
      settings.sfx = sfxChk.checked;
      store.save();
    });

    const close = () => modal.remove();
    const button = (label, cls, fn) => h('button', { class: cls, onclick: fn }, label);

    const modal = h('div', { class: 'modal' }, h('div', { class: 'panel' },
      h('h3', {}, 'Opciones para adultos'),
      h('label', {}, 'Voz'),
      voiceSel,
      !voice.supported && h('p', { class: 'note' }, 'Este navegador no permite leer en voz alta.'),
      h('p', { class: 'note' }, 'Las voces con ✨ son las más reales y necesitan internet. En "Automática", sin internet se usa una voz instalada. '
        + 'En la PC, el navegador Edge trae voces argentinas naturales (Elena y Tomás).'),
      voice.current && h('p', { class: 'note' }, `Ahora habla: ${voice.current.name}`),
      h('label', {}, 'Velocidad de la voz'),
      rate,
      h('label', { class: 'check' }, sfxChk, ' Efectos de sonido'),
      h('div', { class: 'row' },
        button('Probar voz', '', () => voice.say('¡Hola! ¡Vamos a jugar!')),
        button(`Regalar una moneda (tiene ${store.data.coins}; cada cosa cuesta ${BQ.wardrobe.PRICE})`, '', (e) => {
          store.data.coins++;
          store.save();
          e.currentTarget.textContent = `Regalar una moneda (tiene ${store.data.coins}; cada cosa cuesta ${BQ.wardrobe.PRICE})`;
          refreshCounters();
        }),
        button('Desbloquear todos los niveles', '', () => {
          BQ.worlds.forEach((w) => store.complete(w.id, w.levels));
          close();
          showWorlds();
        }),
        button('Reiniciar progreso', 'danger', (e) => {
          // Doble toque en vez de confirm(): no todos los navegadores/visores muestran diálogos.
          const b = e.currentTarget;
          if (!b.dataset.armed) {
            b.dataset.armed = '1';
            b.textContent = '¿Seguro? Tocá de nuevo para borrar';
            return;
          }
          store.resetProgress();
          close();
          showTitle();
        })),
      h('div', { class: 'row' }, button('Cerrar', 'primary', close))));
    app.append(modal);
  }

  // Piezas compartidas con otros módulos (bingo.js)
  BQ.ui = { show, topbar, backBtn, tap, confetti, burst, playable, currentChar, showWorlds, showShop, coinEl, coinCounter, PRAISES, LOGO_COLORS };

  // ---------- Inicio ----------

  voice.init();
  showTitle();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})(window.BQ);
