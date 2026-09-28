(function (BQ) {
  'use strict';

  /*
   * Penales: 3 penales con preguntas al azar de todos los mundos.
   * Respuesta correcta = gol; incorrecta = ataja el arquero. Con 2 goles o más se gana el partido
   * y se gana una moneda.
   *
   * La cancha es un SVG de 300 x 200: tribuna arriba, arco entre x=70 y x=230 (travesaño en y=38,
   * línea de gol en y=110), punto del penal en (150, 172). El pateador es el personaje del jugador.
   */

  const U = BQ.util;
  const h = U.h;
  const store = BQ.store;
  const voice = BQ.voice;
  const sfx = BQ.sfx;
  const ui = () => BQ.ui;

  const KICKS = 3;
  const WIN_GOALS = 2;
  const OUT = '#2b2140';
  const SPOT = [150, 172];
  const CORNERS = [[96, 56], [204, 56], [96, 94], [204, 94]];
  const THEME = { sky1: '#8fd3ff', sky2: '#d9f2ff', ground: '#4caf50', decor: ['☁️', '⚽', '🏆', '⭐', '🎉'] };

  let S = null; // partido actual

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const alive = (s) => S === s && s.screen.isConnected;

  // Pregunta de cualquier mundo (menos los de dibujar), con nivel según lo que ya jugó en ese mundo
  function randomQuestion(used) {
    for (let i = 0; i < 40; i++) {
      const world = U.pick(BQ.worlds);
      const top = Math.max(1, Math.min(world.levels, store.completed(world.id) + 1));
      const q = BQ.nextQuestion(world, 1 + U.rand(top), used);
      if (q.kind !== 'connect') return q;
    }
    return BQ.nextQuestion(BQ.worlds[0], 1, used);
  }

  // ---------- La cancha ----------

  function crowd() {
    const colors = ['#e53935', '#1e88e5', '#ffd23f', '#43a047', '#ff80ab', '#ffffff', '#fb8c00', '#8e24aa'];
    let dots = '';
    for (let row = 0; row < 3; row++) {
      for (let x = 6 + (row % 2) * 5; x < 300; x += 10) {
        dots += `<circle class="pen-fan" cx="${x}" cy="${9 + row * 8}" r="3.4" fill="${colors[(x * 7 + row * 3) % colors.length]}"/>`;
      }
    }
    return `<rect x="0" y="0" width="300" height="34" fill="#546e7a"/>${dots}`;
  }

  function sceneSvg() {
    let stripes = '';
    for (let y = 34; y < 200; y += 22) stripes += `<rect x="0" y="${y}" width="300" height="11" fill="#43a047"/>`;
    return `<svg class="pen-field" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid meet">`
      + `<defs><pattern id="pen-net" width="6" height="6" patternUnits="userSpaceOnUse">`
      + `<path d="M0 0 L6 6 M6 0 L0 6" stroke="rgba(255,255,255,.6)" stroke-width=".7"/></pattern></defs>`
      + crowd()
      + `<rect x="0" y="34" width="300" height="166" fill="#4caf50"/>${stripes}`
      // Líneas del área
      + `<path d="M10 110 L290 110 M45 110 L45 150 L255 150 L255 110 M95 110 L95 128 L205 128 L205 110" fill="none" stroke="#fff" stroke-width="2" opacity=".9"/>`
      + `<circle cx="150" cy="172" r="2" fill="#fff"/>`
      // Arco con red
      + `<g class="pen-net"><rect x="72" y="40" width="156" height="70" fill="rgba(0,0,0,.12)"/>`
      + `<rect x="72" y="40" width="156" height="70" fill="url(#pen-net)"/></g>`
      + `<path d="M70 111 L70 38 L230 38 L230 111" fill="none" stroke="${OUT}" stroke-width="6.5" stroke-linejoin="round"/>`
      + `<path d="M70 111 L70 38 L230 38 L230 111" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>`
      // Arquero (pies en 150, 110)
      + `<g class="pen-keeper"><g class="pen-keeper-dive">`
      + `<rect x="142.5" y="95" width="5.5" height="14" rx="2.5" fill="#263238"/><rect x="152" y="95" width="5.5" height="14" rx="2.5" fill="#263238"/>`
      + `<line x1="141" y1="82" x2="128" y2="69" stroke="${OUT}" stroke-width="7"/><line x1="141" y1="82" x2="128" y2="69" stroke="#ff9800" stroke-width="4.5"/>`
      + `<line x1="159" y1="82" x2="172" y2="69" stroke="${OUT}" stroke-width="7"/><line x1="159" y1="82" x2="172" y2="69" stroke="#ff9800" stroke-width="4.5"/>`
      + `<rect x="139" y="77" width="22" height="21" rx="6" fill="#ff9800" stroke="${OUT}" stroke-width="1.8"/>`
      + `<text x="150" y="92" font-size="9" font-weight="900" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif">1</text>`
      + `<circle cx="127" cy="67" r="5.5" fill="#c6ff00" stroke="${OUT}" stroke-width="1.8"/><circle cx="173" cy="67" r="5.5" fill="#c6ff00" stroke="${OUT}" stroke-width="1.8"/>`
      + `<circle cx="150" cy="69" r="9" fill="#f5c89a" stroke="${OUT}" stroke-width="1.8"/>`
      + `<path d="M141 67 Q141 58 150 58 Q159 58 159 67 Q152 62 141 67 Z" fill="#263238"/>`
      + `<circle cx="146.5" cy="70" r="1.3" fill="${OUT}"/><circle cx="153.5" cy="70" r="1.3" fill="${OUT}"/>`
      + `<path d="M147 74 Q150 76.5 153 74" fill="none" stroke="${OUT}" stroke-width="1.2" stroke-linecap="round"/>`
      + `</g></g>`
      // Pateador y pelota
      + `<g class="pen-kicker"></g>`
      + `<g class="pen-ball"><circle cx="150" cy="172" r="8" fill="#fff" stroke="${OUT}" stroke-width="1.8"/>`
      + `<polygon points="150,168 153.8,170.8 152.4,175.2 147.6,175.2 146.2,170.8" fill="${OUT}"/></g>`
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
    const scene = h('div', { class: 'pen-scene', html: sceneSvg() });
    const flash = h('div', { class: 'pen-flash', hidden: true });
    scene.append(flash);
    const score = h('div', { class: 'pen-score' },
      Array.from({ length: KICKS }, () => h('span', { class: 'pen-slot' })));
    const speakBtn = h('button', { class: 'speak-btn', 'aria-label': 'Repetir pregunta', onpointerdown: ui().tap(() => S && S.q && voice.say(S.q.say)) },
      h('span', { class: 'emoji' }, '🔊'));
    const promptBox = h('button', { class: 'prompt', onpointerdown: ui().tap(() => S && S.q && voice.say(S.q.say)) });
    const qtext = h('p', { class: 'qtext' });
    const options = h('div', { class: 'options' });

    const screen = h('div', { class: 'screen penales' },
      ui().topbar(ui().backBtn(() => { S = null; ui().showWorlds(); }), score, h('span', { class: 'spacer' })),
      h('div', { class: 'pen-body' },
        scene,
        h('div', { class: 'pen-quiz' },
          h('div', { class: 'ask' }, h('div', { class: 'ask-row' }, speakBtn, promptBox), qtext),
          options)));
    ui().show(screen, THEME);

    // El pateador: el personaje del jugador, con su ropa, parado al lado de la pelota
    const svg = scene.querySelector('svg');
    const kicker = svg.querySelector('.pen-kicker');
    const pp = BQ.puppet.el(store.data.character).querySelector('.pp');
    pp.setAttribute('x', '106');
    pp.setAttribute('y', '140');
    pp.setAttribute('width', '36');
    pp.setAttribute('height', '50');
    kicker.append(pp);

    const s = {
      screen, scene, svg, flash, score, promptBox, qtext, options, kicker,
      keeper: svg.querySelector('.pen-keeper-dive'),
      ball: svg.querySelector('.pen-ball'),
      net: svg.querySelector('.pen-net'),
      kick: 0, goals: 0, used: new Set(), q: null,
    };
    S = s;

    sfx.whistle();
    voice.say('¡A patear penales! Si contestás bien, es gol. ¡Hacé dos goles para ganar el partido!')
      .then(() => wait(300))
      .then(() => { if (alive(s)) nextKick(s); });
  }

  function nextKick(s) {
    s.q = randomQuestion(s.used);
    s.promptBox.hidden = !s.q.prompt;
    s.promptBox.replaceChildren(s.q.prompt ? BQ.renderVisual(s.q.prompt) : '');
    s.qtext.textContent = s.q.text;
    s.options.replaceChildren(...s.q.options.map((o, k) => {
      const b = h('button', { class: 'option', style: { '--k': k }, onpointerdown: ui().tap(() => answer(s, o, b)) }, BQ.renderVisual(o));
      o.el = b;
      return b;
    }));
    s.options.classList.remove('locked');
    s.score.children[s.kick].classList.add('now');
    voice.say(`Penal ${s.kick + 1}. ${s.q.say}`);
  }

  async function answer(s, o, b) {
    if (!alive(s) || s.options.classList.contains('locked')) return;
    s.options.classList.add('locked');
    const goal = o.correct;
    if (goal) {
      b.classList.add('right');
      sfx.correct();
    } else {
      b.classList.add('wrong');
      s.q.options.find((x) => x.correct).el.classList.add('hint'); // que vea cuál era
    }
    voice.stop();
    await shoot(s, goal);
    if (!alive(s)) return;

    const slot = s.score.children[s.kick];
    slot.classList.remove('now');
    slot.classList.add(goal ? 'goal' : 'saved');
    if (goal) s.goals++;
    s.kick++;
    await Promise.all([
      voice.say(goal ? `¡Gooool! ${U.pick(ui().PRAISES)}` : '¡Atajó el arquero! Mirá, la respuesta era esta.'),
      wait(1800),
    ]);
    if (!alive(s)) return;
    resetShot(s);
    if (s.kick < KICKS) nextKick(s);
    else finish(s);
  }

  // ---------- Animación del penal ----------

  async function shoot(s, goal) {
    const target = U.pick(CORNERS);
    const ballLeft = target[0] < 150;
    // Si es gol, el arquero se tira para el otro lado; si ataja, para el mismo y la pelota va a sus guantes
    const diveLeft = goal ? !ballLeft : ballLeft;
    const end = goal ? target : [diveLeft ? 104 : 196, 84];

    // Carrerita y patada
    s.kicker.animate([{ transform: 'translate(0, 0)' }, { transform: 'translate(10px, -3px)' }], { duration: 320, easing: 'ease-in', fill: 'forwards' });
    setTimeout(() => BQ.puppet.use(s.kicker, 'kick'), 120);
    await wait(330);
    if (!alive(s)) return;
    sfx.kick();

    s.keeper.animate([
      { transform: 'translate(0, 0) rotate(0deg)' },
      { transform: `translate(${diveLeft ? -52 : 52}px, 4px) rotate(${diveLeft ? -72 : 72}deg)` },
    ], { duration: 420, delay: 80, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });

    const dx = end[0] - SPOT[0];
    const dy = end[1] - SPOT[1];
    s.ball.animate([
      { transform: 'translate(0, 0) scale(1) rotate(0deg)' },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 14}px) scale(.8) rotate(300deg)`, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(.62) rotate(540deg)` },
    ], { duration: 560, easing: 'ease-out', fill: 'forwards' });
    await wait(580);
    if (!alive(s)) return;

    if (goal) {
      s.net.classList.add('shake');
      sfx.cheer();
      sfx.win();
      showFlash(s, '¡GOOOL!', 'goal');
      ui().burst(s.scene);
      s.svg.classList.add('celebrate');
    } else {
      sfx.aww();
      showFlash(s, '¡ATAJÓ!', 'saved');
    }
    await wait(400);
  }

  function showFlash(s, text, kind) {
    s.flash.hidden = false;
    s.flash.className = 'pen-flash ' + kind;
    s.flash.replaceChildren(...[...text].map((ch, i) => h('span', { style: { '--i': i } }, ch)));
  }

  function resetShot(s) {
    for (const el of [s.kicker, s.keeper, s.ball]) el.getAnimations().forEach((a) => a.cancel());
    s.net.classList.remove('shake');
    s.svg.classList.remove('celebrate');
    s.flash.hidden = true;
  }

  // ---------- Final del partido ----------

  async function finish(s) {
    const won = s.goals >= WIN_GOALS;
    if (won) store.addCoin();
    const canBuy = store.data.coins >= BQ.wardrobe.PRICE;

    const hero = ui().playable(h('div', { class: 'party-hero pen-hero' }, BQ.puppet.el(store.data.character)));
    const title = won ? '¡Ganaste!' : '¡Casi!';
    const counter = ui().coinCounter();
    counter.classList.add('party-coins');
    if (won) counter.querySelector('.coin-n').textContent = String(store.data.coins - 1);

    const again = h('button', { class: 'btn-next', 'aria-label': 'Jugar otra vez', onpointerdown: ui().tap(startMatch) }, h('span', { class: 'play-tri' }));
    const actions = h('div', { class: 'party-actions' },
      h('button', { class: 'btn-round', 'aria-label': 'Mundos', onpointerdown: ui().tap(() => { S = null; ui().showWorlds(); }) }, h('span', { class: 'emoji' }, '🗺️')),
      again,
      canBuy && h('button', { class: 'btn-shop mini', 'aria-label': 'Tienda', onpointerdown: ui().tap(() => { S = null; ui().showShop(); }) }, h('span', { class: 'emoji' }, '🛍️')));

    const party = h('div', { class: 'party' + (won ? '' : ' pen-lost') },
      h('div', { class: 'party-rays' }),
      won && ui().confetti(),
      h('h2', { class: 'party-title' }, [...title].map((ch, i) => h('span', {
        style: { '--i': i, color: ui().LOGO_COLORS[i % ui().LOGO_COLORS.length] },
      }, ch))),
      hero,
      h('div', { class: 'pen-final' },
        Array.from({ length: KICKS }, (_, i) => h('span', { class: 'pen-slot ' + (s.score.children[i].classList.contains('goal') ? 'goal' : 'saved') }))),
      won && h('div', { class: 'party-prize emoji' }, '🏆'),
      actions);
    s.screen.append(party);
    party.append(counter);

    if (won) {
      sfx.cheer();
      sfx.win();
      setTimeout(() => alive(s) && BQ.puppet.use(hero.querySelector('.avatar'), 'kick'), 900);
      await Promise.all([voice.say('¡Ganaste el partido! ¡Te ganaste una moneda!'), wait(1800)]);
      if (!alive(s)) return;
      // Moneda que aparece y vuela al contador
      const coin = ui().coinEl('big-coin pen-coin');
      party.append(coin);
      sfx.coin();
      await wait(1300);
      if (!alive(s)) return;
      const from = coin.getBoundingClientRect();
      const to = counter.querySelector('.coin').getBoundingClientRect();
      const fly = coin.animate([
        { transform: 'translate(0, 0)' },
        { transform: `translate(${to.left + to.width / 2 - (from.left + from.width / 2)}px, ${to.top + to.height / 2 - (from.top + from.height / 2)}px) scale(${to.width / from.width})` },
      ], { duration: 700, easing: 'cubic-bezier(.5,0,.7,1)', fill: 'forwards' });
      await Promise.race([fly.finished.catch(() => {}), wait(900)]);
      if (!alive(s)) return;
      coin.remove();
      sfx.coin();
      counter.set(store.data.coins);
    } else {
      sfx.aww();
      await voice.say(s.goals === 1 ? '¡Casi! Hiciste un gol. ¡Jugá otra vez!' : '¡No importa! ¡Jugá otra vez, que vos podés!');
    }
    if (alive(s)) party.classList.add('settled');
  }

  BQ.penales = { open };
})(window.BQ);
