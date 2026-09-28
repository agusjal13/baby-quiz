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

  function avatarEl(c) {
    return h('span', { class: 'avatar' },
      h('span', { class: 'emoji av-main' + (c.flip ? ' flip' : '') }, c.emoji),
      c.badge && h('span', { class: 'emoji av-badge' }, c.badge));
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

  // Engranaje para adultos: hay que mantenerlo apretado 2 segundos.
  function gearBtn() {
    let timer;
    const b = h('button', { class: 'btn-round gear', 'aria-label': 'Opciones para adultos' }, h('span', { class: 'emoji' }, '⚙️'));
    const cancel = () => {
      clearTimeout(timer);
      b.classList.remove('holding');
    };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.classList.add('holding');
      timer = setTimeout(() => {
        cancel();
        openParentPanel();
      }, 2000);
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
      U.sample(BQ.characters, 5).map((c, i) => h('span', { class: 'parade-item', style: { '--i': i } }, avatarEl(c))));
    const play = h('button', { class: 'play-btn', 'aria-label': 'Jugar', onpointerdown: tap(start) }, h('span', { class: 'play-tri' }));

    show(h('div', { class: 'screen title' },
      topbar(null, h('span', { class: 'spacer' })),
      h('h1', { class: 'logo' }, letters),
      parade,
      play));

    function start() {
      goFullscreen();
      voice.unlock();
      if (!store.data.character) showCharacters();
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

    show(h('div', { class: 'screen worlds' },
      topbar(
        h('button', { class: 'btn-round char-mini', 'aria-label': 'Cambiar personaje', onpointerdown: tap(showCharacters) }, avatarEl(currentChar())),
        h('h2', { class: 'screen-title' }, '¿A dónde vamos?')),
      h('div', { class: 'worlds-grid' }, cards)));
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
    const rider = h('div', { class: 'ride-pos', style: { left: pos(0) + '%' } }, rideEl(world, currentChar()));
    track.append(rider);

    const repeat = () => S.q && voice.say(S.q.say);
    const speakBtn = h('button', { class: 'speak-btn', 'aria-label': 'Repetir pregunta', onpointerdown: tap(repeat) }, h('span', { class: 'emoji' }, '🔊'));
    const promptBox = h('button', { class: 'prompt', onpointerdown: tap(repeat) });
    const qtext = h('p', { class: 'qtext' });
    const options = h('div', { class: 'options' });

    const screen = h('div', { class: 'screen game' },
      h('div', { class: 'game-top' }, backBtn(() => showLevels(world)), track),
      h('div', { class: 'ask' }, h('div', { class: 'ask-row' }, speakBtn, promptBox), qtext),
      options);
    show(screen, world.theme);

    const myToken = token;
    const alive = () => myToken === token;

    function nextQuestion(prefix) {
      S.q = BQ.nextQuestion(world, level, S.used);
      S.attempts = 0;
      promptBox.hidden = !S.q.prompt;
      promptBox.replaceChildren(S.q.prompt ? BQ.renderVisual(S.q.prompt) : '');
      qtext.textContent = S.q.text;
      options.replaceChildren(...S.q.options.map((o, k) => {
        const b = h('button', { class: 'option', style: { '--k': k }, onpointerdown: tap(() => answer(o, b)) }, BQ.renderVisual(o));
        o.el = b;
        return b;
      }));
      options.classList.remove('locked');
      voice.say(prefix ? `${prefix} ${S.q.say}` : S.q.say);
    }

    async function answer(o, b) {
      if (options.classList.contains('locked') || b.classList.contains('wrong')) return;

      if (o.correct) {
        options.classList.add('locked');
        b.classList.add('right');
        sfx.correct();
        burst(b);
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
      const hero = h('div', { class: 'party-hero' }, rideEl(world, currentChar()));
      const fx = h('div', { class: 'party-fx' });
      const balloons = Array.from({ length: 7 }, (_, i) => h('span', {
        class: 'balloon emoji',
        style: {
          left: 6 + i * 14 + Math.random() * 6 + '%',
          'animation-delay': 0.8 + Math.random() * 1.6 + 's',
          filter: `hue-rotate(${U.rand(360)}deg)`,
        },
      }, '🎈'));

      const party = h('div', { class: 'party' },
        h('div', { class: 'party-rays' }),
        balloons,
        confetti(),
        fx,
        title,
        hero,
        last && h('div', { class: 'party-prize emoji' }, '🏆'),
        h('div', { class: 'party-actions' },
          h('button', { class: 'btn-round', 'aria-label': 'Niveles', onpointerdown: tap(() => showLevels(world)) }, h('span', { class: 'emoji' }, '🗺️')),
          h('button', { class: 'btn-next', 'aria-label': 'Siguiente', onpointerdown: tap(next) }, h('span', { class: 'play-tri' })),
          h('button', { class: 'btn-round', 'aria-label': 'Repetir nivel', onpointerdown: tap(() => startLevel(world, level)) }, h('span', { class: 'emoji' }, '🔁'))));
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
      later(1100, () => {
        sfx.win();
        voice.say(last
          ? `¡Increíble! ¡Completaste ${world.sayName}!`
          : `¡Yupi! ¡Lo lograste! ¡Vamos al nivel ${level + 1}!`);
      });
      [1000, 1500, 1900, 2400, 2900, 3400].forEach((ms) => later(ms, () => firework(fx)));
      later(3300, () => party.classList.add('settled'));
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

    const voiceSel = h('select', {},
      voices.length
        ? voices.map((v) => h('option', { value: v.voiceURI, selected: voice.current && v.voiceURI === voice.current.voiceURI ? 'selected' : null },
          `${v.name} (${v.lang})${v.localService ? '' : ' · necesita internet'}`))
        : h('option', {}, 'No hay voces en español instaladas'));
    voiceSel.addEventListener('change', () => {
      settings.voiceURI = voiceSel.value;
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
      h('p', { class: 'note' }, 'Para jugar sin internet elegí una voz que no diga "necesita internet".'),
      h('label', {}, 'Velocidad de la voz'),
      rate,
      h('label', { class: 'check' }, sfxChk, ' Efectos de sonido'),
      h('div', { class: 'row' },
        button('Probar voz', '', () => voice.say('¡Hola! ¡Vamos a jugar!')),
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

  // ---------- Inicio ----------

  voice.init();
  showTitle();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})(window.BQ);
