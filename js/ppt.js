(function (BQ) {
  'use strict';

  /*
   * Piedra, papel o tijera al mejor de 3 (gana el primero que llega a 2; los empates se repiten).
   * Abajo juega el chico con su personaje y elige con 3 botones; arriba un personaje rival
   * elige al azar. Las dos manos se sacuden tres veces ("¡piedra, papel o tijera!") y se muestran.
   * Ganar da una moneda y suma para los trofeos, como los otros juegos.
   */

  const U = BQ.util;
  const h = U.h;
  const store = BQ.store;
  const voice = BQ.voice;
  const sfx = BQ.sfx;
  const ui = () => BQ.ui;
  const wait = BQ.sport.wait;

  const TO_WIN = 2;
  const MOVES = {
    piedra: { emoji: '✊', name: 'la piedra', beats: 'tijera' },
    papel: { emoji: '✋', name: 'el papel', beats: 'piedra' },
    tijera: { emoji: '✌️', name: 'la tijera', beats: 'papel' },
  };
  const THEME = { sky1: '#ffb74d', sky2: '#ffe0b2', ground: '#8d6e63', decor: ['✊', '✋', '✌️', '⭐', '✨'] };

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

    const rivalHand = h('span', { class: 'ppt-hand rival emoji' }, '✊');
    const myHand = h('span', { class: 'ppt-hand me emoji' }, '✊');
    const flash = h('div', { class: 'sport-flash', hidden: true });
    const rivalHero = ui().playable(h('div', { class: 'ppt-hero' }, BQ.puppet.el(rival, [])));
    const myHero = ui().playable(h('div', { class: 'ppt-hero' }, BQ.puppet.el(mine)));
    const buttons = h('div', { class: 'ppt-choices' },
      Object.entries(MOVES).map(([id, m]) => h('button', {
        class: 'ppt-choice', 'data-move': id,
        onpointerdown: ui().tap(() => play(S, id)),
      }, h('span', { class: 'emoji' }, m.emoji), h('span', { class: 'ppt-choice-name' }, U.cap(m.name.replace(/^(el|la) /, ''))))));

    const screen = h('div', { class: 'screen ppt' },
      ui().topbar(ui().backBtn(() => { S = null; ui().showWorlds(); }), score, h('span', { class: 'spacer' })),
      h('div', { class: 'ppt-arena' },
        h('div', { class: 'ppt-side rival' }, rivalHero, rivalHand),
        h('div', { class: 'ppt-middle' }, flash, h('span', { class: 'ppt-vs' }, 'VS')),
        h('div', { class: 'ppt-side me' }, myHero, myHand)),
      buttons);
    ui().show(screen, THEME);

    const s = { screen, rivalHand, myHand, flash, buttons, scoreMe, scoreRival, myHero, rivalHero, me: 0, rival: 0, busy: false };
    S = s;
    voice.say('¡Elegí!');
  }

  async function play(s, move) {
    if (!alive(s) || s.busy) return;
    s.busy = true;
    s.buttons.classList.add('locked');
    s.buttons.querySelector(`[data-move="${move}"]`).classList.add('picked');
    s.flash.hidden = true;
    const rival = U.pick(Object.keys(MOVES));

    // Las dos manos se sacuden tres veces con el puño cerrado
    for (const hand of [s.myHand, s.rivalHand]) {
      hand.textContent = '✊';
      hand.classList.remove('shake', 'reveal', 'win', 'lose');
      void hand.offsetWidth;
      hand.classList.add('shake');
    }
    voice.say('¡Piedra, papel o tijera!');
    for (let i = 0; i < 3; i++) {
      sfx.notes([[330 + i * 110, 0, 0.12, 'triangle', 0.15]]);
      await wait(330);
      if (!alive(s)) return;
    }

    // ¡Ya!
    s.myHand.textContent = MOVES[move].emoji;
    s.rivalHand.textContent = MOVES[rival].emoji;
    for (const hand of [s.myHand, s.rivalHand]) {
      hand.classList.remove('shake');
      void hand.offsetWidth;
      hand.classList.add('reveal');
    }
    sfx.notes([[880, 0, 0.1, 'square', 0.08]]);
    await wait(450);
    if (!alive(s)) return;

    let say;
    if (move === rival) {
      BQ.sport.flash(s.flash, '¡EMPATE!', 'saved');
      sfx.tap();
      say = '¡Empate!';
    } else if (MOVES[move].beats === rival) {
      s.me++;
      s.scoreMe.textContent = String(s.me);
      s.myHand.classList.add('win');
      s.rivalHand.classList.add('lose');
      BQ.sport.flash(s.flash, '¡PUNTO!', 'goal');
      sfx.correct();
      ui().burst(s.myHero);
      BQ.puppet.use(s.myHero.querySelector('.avatar'));
      say = '¡Punto!';
    } else {
      s.rival++;
      s.scoreRival.textContent = String(s.rival);
      s.rivalHand.classList.add('win');
      s.myHand.classList.add('lose');
      BQ.sport.flash(s.flash, 'PUNTO RIVAL', 'saved');
      sfx.aww();
      BQ.puppet.use(s.rivalHero.querySelector('.avatar'));
      say = '¡Punto del otro!';
    }
    await Promise.all([voice.say(say), wait(1300)]);
    if (!alive(s)) return;

    if (s.me >= TO_WIN || s.rival >= TO_WIN) return finish(s);
    s.flash.hidden = true;
    s.buttons.classList.remove('locked');
    s.buttons.querySelectorAll('.picked').forEach((b) => b.classList.remove('picked'));
    s.busy = false;
  }

  function finish(s) {
    const won = s.me > s.rival;
    BQ.sport.result({
      screen: s.screen,
      won,
      perfect: won && s.rival === 0,
      detail: h('div', { class: 'mt-final' }, `${s.me} - ${s.rival}`),
      onAgain: startGame,
      winSay: `¡Ganaste ${s.me} a ${s.rival}! ¡Te ganaste una moneda!`,
      loseSay: `¡Casi! Terminó ${s.me} a ${s.rival}. ¡Jugá otra vez!`,
      isAlive: () => alive(s),
    });
  }

  BQ.ppt = { open };
})(window.BQ);
