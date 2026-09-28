(function (BQ) {
  'use strict';

  /*
   * Piezas compartidas por los juegos de fútbol (penales y partidito):
   * preguntas al azar de todos los mundos, el panel de pregunta y la pantalla final con la moneda.
   */

  const U = BQ.util;
  const h = U.h;
  const store = BQ.store;
  const voice = BQ.voice;
  const sfx = BQ.sfx;
  const ui = () => BQ.ui;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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

  // Panel de pregunta: bocina, cartel, texto y 4 opciones.
  // ask() muestra una pregunta y devuelve una promesa con true (bien) o false (mal).
  // Si contesta mal, la opción correcta titila para que vea cuál era.
  function quiz() {
    let q = null;
    const repeat = () => q && voice.say(q.say);
    const promptBox = h('button', { class: 'prompt', onpointerdown: ui().tap(repeat) });
    const qtext = h('p', { class: 'qtext' });
    const options = h('div', { class: 'options' });
    const el = h('div', { class: 'sport-quiz' },
      h('div', { class: 'ask' },
        h('div', { class: 'ask-row' },
          h('button', { class: 'speak-btn', 'aria-label': 'Repetir pregunta', onpointerdown: ui().tap(repeat) }, h('span', { class: 'emoji' }, '🔊')),
          promptBox),
        qtext),
      options);

    return {
      el,
      ask(question, prefix) {
        q = question;
        promptBox.hidden = !q.prompt;
        promptBox.replaceChildren(q.prompt ? BQ.renderVisual(q.prompt) : '');
        qtext.textContent = q.text;
        return new Promise((resolve) => {
          options.replaceChildren(...q.options.map((o, k) => {
            const b = h('button', {
              class: 'option',
              style: { '--k': k },
              onpointerdown: ui().tap(() => {
                if (options.classList.contains('locked')) return;
                options.classList.add('locked');
                if (o.correct) {
                  b.classList.add('right');
                  sfx.correct();
                } else {
                  b.classList.add('wrong');
                  q.options.find((x) => x.correct).el.classList.add('hint');
                }
                voice.stop();
                resolve(o.correct);
              }),
            }, BQ.renderVisual(o));
            o.el = b;
            return b;
          }));
          options.classList.remove('locked');
          voice.say(prefix ? `${prefix} ${q.say}` : q.say);
        });
      },
      clear() {
        q = null;
        options.replaceChildren();
        qtext.textContent = '';
        promptBox.hidden = true;
      },
    };
  }

  /*
   * Pantalla final de un partido. Si ganó, suma una moneda que vuela al contador.
   *   screen   pantalla donde se muestra
   *   won      si ganó
   *   detail   elemento con el resultado (marcador)
   *   onAgain  volver a jugar
   *   winSay / loseSay   lo que dice la voz
   *   isAlive  () => la pantalla sigue abierta
   */
  async function result({ screen, won, detail, onAgain, winSay, loseSay, isAlive }) {
    // Ganar da una moneda y suma para los trofeos
    if (won) store.addCoin();
    const newTrophy = won ? BQ.trophies.win() : null;
    const canBuy = store.data.coins >= BQ.wardrobe.PRICE;

    const hero = ui().playable(h('div', { class: 'party-hero sport-hero' }, BQ.puppet.el(store.data.character)));
    const title = won ? '¡Ganaste!' : '¡Casi!';
    const counter = ui().coinCounter();
    counter.classList.add('party-coins');
    if (won) counter.querySelector('.coin-n').textContent = String(store.data.coins - 1);

    const actions = h('div', { class: 'party-actions' },
      h('button', { class: 'btn-round', 'aria-label': 'Mundos', onpointerdown: ui().tap(() => ui().showWorlds()) }, h('span', { class: 'emoji' }, '🗺️')),
      h('button', { class: 'btn-next', 'aria-label': 'Jugar otra vez', onpointerdown: ui().tap(onAgain) }, h('span', { class: 'play-tri' })),
      canBuy && h('button', { class: 'btn-shop mini', 'aria-label': 'Tienda', onpointerdown: ui().tap(() => ui().showShop()) }, h('span', { class: 'emoji' }, '🛍️')));

    const party = h('div', { class: 'party' + (won ? '' : ' sport-lost') },
      h('div', { class: 'party-rays' }),
      won && ui().confetti(),
      h('h2', { class: 'party-title' }, [...title].map((ch, i) => h('span', {
        style: { '--i': i, color: ui().LOGO_COLORS[i % ui().LOGO_COLORS.length] },
      }, ch))),
      hero,
      detail,
      won && h('div', { class: 'party-prize emoji' }, '🏆'),
      actions,
      counter);
    screen.append(party);

    if (won) {
      sfx.cheer();
      sfx.win();
      setTimeout(() => isAlive() && BQ.puppet.use(hero.querySelector('.avatar'), 'kick'), 900);
      await Promise.all([voice.say(winSay), wait(1800)]);
      if (!isAlive()) return;
      const coin = ui().coinEl('big-coin sport-coin');
      party.append(coin);
      sfx.coin();
      await wait(1300);
      if (!isAlive()) return;
      const from = coin.getBoundingClientRect();
      const to = counter.querySelector('.coin').getBoundingClientRect();
      const fly = coin.animate([
        { transform: 'translate(0, 0)' },
        { transform: `translate(${to.left + to.width / 2 - (from.left + from.width / 2)}px, ${to.top + to.height / 2 - (from.top + from.height / 2)}px) scale(${to.width / from.width})` },
      ], { duration: 700, easing: 'cubic-bezier(.5,0,.7,1)', fill: 'forwards' });
      // Tope de tiempo: con la pantalla en segundo plano la animación no avanza
      await Promise.race([fly.finished.catch(() => {}), wait(900)]);
      if (!isAlive()) return;
      coin.remove();
      sfx.coin();
      counter.set(store.data.coins);

      if (newTrophy) {
        await revealTrophy(party, newTrophy, isAlive);
      } else {
        const next = BQ.trophies.next();
        const left = next ? next.wins - BQ.trophies.wins() : 0;
        if (next) await voice.say(left === 1 ? '¡Te falta un partido para el próximo trofeo!' : `Te faltan ${left} partidos para el próximo trofeo.`);
      }
    } else {
      sfx.aww();
      await voice.say(loseSay);
    }
    if (isAlive()) party.classList.add('settled');
  }

  // Trofeo nuevo: aparece gigante con rayos, se anuncia y después queda chico en la fiesta
  async function revealTrophy(party, t, isAlive) {
    const stage = h('div', { class: 'coin-stage trophy-stage' },
      h('div', { class: 'coin-glow' }),
      h('p', { class: 'trophy-new-label' }, '¡Trofeo nuevo!'),
      BQ.trophies.el(t, 'trophy-big'),
      h('p', { class: 'trophy-name' }, BQ.trophies.title(t)));
    party.classList.add('coin-time');
    party.append(stage);
    sfx.cheer();
    sfx.win();
    await Promise.all([voice.say(`¡Y ganaste un trofeo nuevo: ${t.name}!`), wait(3000)]);
    if (!isAlive()) return;
    stage.remove();
    party.classList.remove('coin-time');
    const prize = party.querySelector('.party-prize');
    if (prize) prize.replaceWith(BQ.trophies.el(t, 'party-prize trophy-prize'));
  }

  // Cartel grande ("¡GOOOL!", "¡ATAJÓ!") letra por letra
  function flash(el, text, kind) {
    el.hidden = false;
    el.className = 'sport-flash ' + kind;
    el.replaceChildren(...[...text].map((ch, i) => h('span', { style: { '--i': i } }, ch === ' ' ? ' ' : ch)));
  }

  BQ.sport = { randomQuestion, quiz, result, flash, wait };
})(window.BQ);
