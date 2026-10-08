(function (BQ) {
  'use strict';

  /*
   * Laberintos: 20 niveles de menor a mayor. El personaje se mueve de a un casillero con un pad
   * de 4 flechas (también con las flechas del teclado o deslizando el dedo sobre el laberinto)
   * hasta llegar al cofre.
   *   - Llave 🔑: abre una puerta 🚪 (cada puerta gasta una llave).
   *   - Espada 🗡️: sirve para vencer al dragón 🐲 que tapa el camino.
   * Los niveles se abren en orden. Terminar el último por primera vez da 100 monedas y cuenta
   * como 5 partidos ganados para los trofeos.
   *
   * Los laberintos no están dibujados a mano: se arman con un sorteo "con semilla" (siempre sale
   * el mismo laberinto en cada nivel). Las puertas y el dragón van sobre el único camino al cofre,
   * y la llave o la espada, en un rincón al que se llega antes.
   */

  const U = BQ.util;
  const h = U.h;
  const store = BQ.store;
  const voice = BQ.voice;
  const sfx = BQ.sfx;
  const ui = () => BQ.ui;
  const wait = BQ.sport.wait;

  // Cada nivel: tamaño del laberinto, puertas, dragón y "steps", cuántos pasos lleva más o menos
  // resolverlo (yendo a buscar llaves y espada). Así la dificultad sube de a poco.
  const LEVELS = [
    { size: 4, steps: 6 }, { size: 4, steps: 8 }, { size: 5, steps: 10 }, { size: 5, steps: 12 },
    { size: 5, steps: 16, doors: 1 }, { size: 6, steps: 20, doors: 1 }, { size: 6, steps: 24, doors: 1 }, { size: 6, steps: 28, doors: 1 },
    { size: 6, steps: 26, dragon: true }, { size: 7, steps: 30, dragon: true }, { size: 7, steps: 34, dragon: true }, { size: 7, steps: 38, dragon: true },
    { size: 7, steps: 42, doors: 1, dragon: true }, { size: 8, steps: 46, doors: 1, dragon: true }, { size: 8, steps: 50, doors: 1, dragon: true }, { size: 8, steps: 54, doors: 1, dragon: true },
    { size: 8, steps: 58, doors: 2, dragon: true }, { size: 9, steps: 64, doors: 2, dragon: true }, { size: 9, steps: 70, doors: 2, dragon: true }, { size: 10, steps: 78, doors: 2, dragon: true },
  ];
  const TRIES = 40; // laberintos que se prueban por nivel para elegir el que más se acerca a "steps"
  const BIG_COINS = 100;
  const BIG_WINS = 5;
  const THEME = { sky1: '#5e35b1', sky2: '#9575cd', ground: '#4527a0', decor: ['🔑', '⭐', '🗡️', '✨', '🧭'] };
  const ICON = { key: '🔑', sword: '🗡️', door: '🚪', dragon: '🐲', goal: '🎁' };

  // Paredes de cada casillero (bits) y movimientos: [dx, dy, pared propia, pared del vecino]
  const N = 1, E = 2, S_ = 4, W = 8;
  const DIRS = { up: [0, -1, N, S_], right: [1, 0, E, W], down: [0, 1, S_, N], left: [-1, 0, W, E] };

  let S = null;
  const alive = (s) => S === s && s.screen.isConnected;
  const progress = () => store.data.maze || (store.data.maze = { done: 0, prize: false });

  // ---------- Armado del laberinto ----------

  // Sorteo con semilla (mulberry32): mismos números para la misma semilla
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Laberinto "perfecto": un solo camino entre dos casilleros cualesquiera
  function carve(cols, rows, rand) {
    const walls = new Array(cols * rows).fill(N | E | S_ | W);
    const seen = new Array(cols * rows).fill(false);
    const stack = [0];
    seen[0] = true;
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const x = cur % cols;
      const y = Math.floor(cur / cols);
      const options = Object.values(DIRS)
        .map(([dx, dy, mine, theirs]) => ({ nx: x + dx, ny: y + dy, mine, theirs }))
        .filter((o) => o.nx >= 0 && o.ny >= 0 && o.nx < cols && o.ny < rows && !seen[o.ny * cols + o.nx]);
      if (!options.length) {
        stack.pop();
        continue;
      }
      const o = options[Math.floor(rand() * options.length)];
      const next = o.ny * cols + o.nx;
      walls[cur] &= ~o.mine;
      walls[next] &= ~o.theirs;
      seen[next] = true;
      stack.push(next);
    }
    return walls;
  }

  const neighbors = (m, i) => Object.values(DIRS)
    .filter(([, , mine]) => !(m.walls[i] & mine))
    .map(([dx, dy]) => i + dx + dy * m.cols);

  // Distancias desde "from" sin pisar los casilleros de "barred"; devuelve también de dónde se llegó
  function flood(m, from, barred) {
    const dist = new Array(m.walls.length).fill(-1);
    const prev = new Array(m.walls.length).fill(-1);
    dist[from] = 0;
    const queue = [from];
    while (queue.length) {
      const cur = queue.shift();
      for (const n of neighbors(m, cur)) {
        if (dist[n] >= 0 || barred.has(n)) continue;
        dist[n] = dist[cur] + 1;
        prev[n] = cur;
        queue.push(n);
      }
    }
    return { dist, prev };
  }

  // Pasos mínimos para resolverlo jugando bien (agarrando llaves y espada cuando hacen falta)
  function solve(m) {
    const cells = [...m.items.keys()];
    const seen = new Set();
    let frontier = [[m.start, 0, 0, 0]]; // casillero, llaves, espada, cosas ya sacadas (bits)
    for (let steps = 0; frontier.length; steps++) {
      const next = [];
      for (const [pos, keys, sword, mask] of frontier) {
        if (pos === m.goal) return steps;
        for (const [dx, dy, wall] of Object.values(DIRS)) {
          if (m.walls[pos] & wall) continue;
          const n = pos + dx + dy * m.cols;
          let k = keys;
          let sw = sword;
          let mk = mask;
          const item = m.items.get(n);
          const bit = 1 << cells.indexOf(n);
          if (item && !(mask & bit)) {
            if (item.type === 'door') {
              if (!k) continue;
              k--;
            } else if (item.type === 'dragon') {
              if (!sw) continue;
              sw = 0;
            } else if (item.type === 'key') k++;
            else sw = 1;
            mk |= bit;
          }
          const id = n + ',' + k + ',' + sw + ',' + mk;
          if (seen.has(id)) continue;
          seen.add(id);
          next.push([n, k, sw, mk]);
        }
      }
      frontier = next;
    }
    return -1; // sin solución (no debería pasar)
  }

  const cache = {};

  // De varios laberintos posibles para el nivel, el que más se acerca al largo que le toca
  function build(level) {
    if (cache[level]) return cache[level];
    const spec = LEVELS[level - 1];
    let best = null;
    for (let attempt = 0; attempt < TRIES * 3 && (attempt < TRIES || !best); attempt++) {
      const m = candidate(level, attempt);
      if (!m) continue;
      m.steps = solve(m);
      if (m.steps < 0) continue;
      if (!best || Math.abs(m.steps - spec.steps) < Math.abs(best.steps - spec.steps)) best = m;
    }
    if (!best) throw new Error('No se pudo armar el laberinto ' + level);
    cache[level] = best;
    return best;
  }

  function candidate(level, attempt) {
    const spec = LEVELS[level - 1];
    const cols = spec.size;
    const rows = spec.size;
    {
      const rand = rng(level * 7919 + attempt * 104729);
      const m = { cols, rows, walls: carve(cols, rows, rand) };
      m.start = (rows - 1) * cols; // abajo a la izquierda
      m.goal = cols - 1; // arriba a la derecha
      const { prev } = flood(m, m.start, new Set());
      const path = [];
      for (let c = m.goal; c !== -1; c = prev[c]) path.unshift(c);

      // Puertas y dragón repartidos sobre el camino (el dragón, lo último)
      const blockers = [...Array(spec.doors || 0).fill('door'), ...(spec.dragon ? ['dragon'] : [])];
      if (path.length < blockers.length * 3 + 3) return null;
      const items = new Map();
      const spots = blockers.map((_, k) => path[Math.round(((k + 1) / (blockers.length + 1)) * (path.length - 1))]);
      if (new Set(spots).size !== spots.length || spots.includes(m.start) || spots.includes(m.goal)) return null;
      spots.forEach((cell, k) => items.set(cell, { type: blockers[k] }));

      // La llave o la espada de cada uno: en un rincón al que se llega sin pasar por él
      let ok = true;
      const onPath = new Set(path);
      spots.forEach((cell, k) => {
        if (!ok) return;
        const { dist } = flood(m, m.start, new Set(spots.slice(k)));
        const free = dist.map((d, i) => ({ d, i })).filter((c) => c.d > 0 && !items.has(c.i) && c.i !== m.goal);
        const corners = free.filter((c) => !onPath.has(c.i) && neighbors(m, c.i).length === 1);
        const pool = corners.length ? corners : free.filter((c) => !onPath.has(c.i));
        const pick = (pool.length ? pool : free).sort((a, b) => b.d - a.d)[0];
        if (!pick) {
          ok = false;
          return;
        }
        items.set(pick.i, { type: blockers[k] === 'door' ? 'key' : 'sword' });
      });
      if (!ok) return null;
      m.items = items;
      return m;
    }
  }

  // ---------- Elegir nivel ----------

  function open() {
    if (!store.data.character) {
      store.data.character = 'futbolista';
      store.save();
    }
    S = null;
    const done = progress().done;
    const grid = h('div', { class: 'mz-levels' }, LEVELS.map((spec, i) => {
      const n = i + 1;
      const locked = n > done + 1;
      return h('button', {
        class: 'mz-level' + (n <= done ? ' done' : '') + (locked ? ' locked' : '') + (n === done + 1 ? ' next' : ''),
        'aria-label': 'Laberinto ' + n,
        onpointerdown: ui().tap(() => {
          if (!locked) return startLevel(n);
          sfx.wrong();
          voice.say('¡Primero pasá los laberintos anteriores!');
        }),
      },
      h('span', { class: 'mz-level-n' }, locked ? h('span', { class: 'emoji' }, '🔒') : String(n)),
      h('span', { class: 'mz-level-tag emoji' }, n <= done ? '⭐' : n === LEVELS.length ? '🏆' : spec.dragon ? '🐲' : spec.doors ? '🔑' : ''));
    }));
    ui().show(h('div', { class: 'screen maze-menu' },
      ui().topbar(ui().backBtn(() => ui().showWorlds()),
        h('h2', { class: 'screen-title' }, h('span', { class: 'emoji' }, '🧭'), ' Laberintos'),
        h('span', { class: 'spacer' })),
      grid), THEME);
    voice.say(done >= LEVELS.length ? '¡Pasaste todos los laberintos! Elegí uno para jugar otra vez.' : '¡Elegí un laberinto!');
  }

  // ---------- Jugar un nivel ----------

  function startLevel(level) {
    const m = build(level);
    const { cols, rows } = m;
    const pct = (i) => ({ left: (((i % cols) + 0.5) / cols) * 100 + '%', top: ((Math.floor(i / cols) + 0.5) / rows) * 100 + '%' });

    // Paredes: una línea por cada pared de arriba y de la izquierda, más el borde
    let d = '';
    for (let i = 0; i < m.walls.length; i++) {
      const x = i % cols;
      const y = Math.floor(i / cols);
      if (m.walls[i] & N) d += `M${x} ${y}h1`;
      if (m.walls[i] & W) d += `M${x} ${y}v1`;
    }
    d += `M0 ${rows}h${cols}M${cols} 0v${rows}`;
    const board = h('div', { class: 'mz-board', style: { '--cols': cols, '--rows': rows } });
    board.innerHTML = `<svg class="mz-walls" viewBox="0 0 ${cols} ${rows}" aria-hidden="true"><path d="${d}"/></svg>`;

    const things = new Map();
    const put = (i, type) => {
      const el = h('span', { class: 'mz-thing emoji ' + type, style: pct(i) }, ICON[type]);
      board.append(el);
      return el;
    };
    put(m.goal, 'goal');
    m.items.forEach((item, i) => things.set(i, { type: item.type, el: put(i, item.type) }));
    const hero = h('span', { class: 'mz-hero', style: pct(m.start) }, BQ.puppet.el(store.data.character));
    board.append(hero);

    const bag = h('div', { class: 'mz-bag' });
    const arrow = (dir, icon) => h('button', { class: 'mz-arrow ' + dir, 'aria-label': dir, 'data-dir': dir }, h('span', { class: 'emoji' }, icon));
    const pad = h('div', { class: 'mz-pad' }, arrow('up', '⬆️'), arrow('left', '⬅️'), arrow('right', '➡️'), arrow('down', '⬇️'));

    const screen = h('div', { class: 'screen maze' },
      ui().topbar(ui().backBtn(() => open()),
        h('div', { class: 'mz-top' }, h('span', { class: 'mz-n' }, h('span', { class: 'emoji' }, '🧭'), ' ' + level), bag),
        h('span', { class: 'spacer' })),
      h('div', { class: 'mz-body' }, h('div', { class: 'mz-stage' }, board), pad));
    ui().show(screen, THEME);

    const s = { screen, board, hero, bag, pad, m, things, pos: m.start, keys: 0, sword: false, level, busy: false, told: {} };
    S = s;
    paintBag(s);
    listen(s);

    const spec = LEVELS[level - 1];
    const first = (test) => LEVELS.findIndex(test) === level - 1;
    voice.say(first((l) => l.doors && l.dragon) ? '¡Buscá la llave y la espada!'
      : first((l) => l.dragon) ? '¡Buscá la espada para vencer al dragón!'
        : first((l) => l.doors) ? '¡Buscá la llave para abrir la puerta!'
          : level === 1 ? '¡Llevalo hasta el regalo con las flechas!'
            : spec.doors > 1 ? '¡Hay dos puertas!' : `Laberinto ${level}`);
  }

  function paintBag(s) {
    const icons = [...Array(s.keys).fill(ICON.key), ...(s.sword ? [ICON.sword] : [])];
    s.bag.replaceChildren(...icons.map((icon) => h('span', { class: 'mz-bag-item emoji' }, icon)));
  }

  // ---------- Controles ----------

  function listen(s) {
    // Pad: un toque = un paso; si se deja apretado, sigue caminando
    let repeat = null;
    const stop = () => { clearInterval(repeat); clearTimeout(repeat); repeat = null; };
    s.pad.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.mz-arrow');
      if (!b) return;
      e.preventDefault();
      sfx.init();
      stop();
      move(s, b.dataset.dir);
      repeat = setTimeout(() => { repeat = setInterval(() => (alive(s) ? move(s, b.dataset.dir) : stop()), 190); }, 380);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => s.pad.addEventListener(ev, stop));

    // Deslizar el dedo sobre el laberinto
    let from = null;
    s.board.addEventListener('pointerdown', (e) => { e.preventDefault(); sfx.init(); from = [e.clientX, e.clientY]; });
    s.board.addEventListener('pointerup', (e) => {
      if (!from) return;
      const dx = e.clientX - from[0];
      const dy = e.clientY - from[1];
      from = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      move(s, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });

    // Flechas del teclado (en la PC)
    const keys = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const onKey = (e) => {
      if (!alive(s)) return removeEventListener('keydown', onKey);
      if (keys[e.key]) {
        e.preventDefault();
        move(s, keys[e.key]);
      }
    };
    addEventListener('keydown', onKey);
  }

  // Choque contra una pared, una puerta cerrada o el dragón: sacudón
  function bump(s, dir) {
    const [dx, dy] = DIRS[dir];
    s.hero.animate([{ translate: '-50% -50%' }, { translate: `calc(-50% + ${dx * 18}%) calc(-50% + ${dy * 18}%)` }, { translate: '-50% -50%' }], { duration: 180 });
  }

  // Decir algo una sola vez cada tanto (para no repetir en cada choque)
  function tell(s, key, text) {
    const now = Date.now();
    if (s.told[key] && now - s.told[key] < 4000) return;
    s.told[key] = now;
    voice.say(text);
  }

  function move(s, dir) {
    if (!alive(s) || s.busy) return;
    const { m } = s;
    const [dx, dy, wall] = DIRS[dir];
    if (dx) s.hero.classList.toggle('flip', dx < 0); // mira para donde camina
    if (m.walls[s.pos] & wall) {
      bump(s, dir);
      sfx.notes([[140, 0, 0.08, 'square', 0.05]]);
      return;
    }
    const next = s.pos + dx + dy * m.cols;
    const thing = s.things.get(next);

    if (thing && thing.type === 'door') {
      if (!s.keys) {
        bump(s, dir);
        sfx.wrong();
        thing.el.classList.remove('nope');
        void thing.el.offsetWidth;
        thing.el.classList.add('nope');
        return tell(s, 'door', '¡Está cerrada! Buscá la llave.');
      }
      s.keys--;
      sfx.notes([[523, 0, 0.1, 'triangle', 0.14], [784, 0.1, 0.2, 'triangle', 0.14]]);
      vanish(s, next, 'open');
    } else if (thing && thing.type === 'dragon') {
      if (!s.sword) {
        bump(s, dir);
        sfx.noise(0.4, 'lowpass', 300, 0.4, 0.02);
        thing.el.classList.remove('roar');
        void thing.el.offsetWidth;
        thing.el.classList.add('roar');
        return tell(s, 'dragon', '¡Cuidado, un dragón! Buscá la espada.');
      }
      s.sword = false;
      sfx.noise(0.25, 'highpass', 1800, 0.3, 0.005);
      sfx.correct();
      vanish(s, next, 'beaten');
      ui().burst(s.board);
      tell(s, 'win-dragon', '¡Venciste al dragón!');
    } else if (thing) { // llave o espada
      if (thing.type === 'key') s.keys++;
      else s.sword = true;
      sfx.coin();
      vanish(s, next, 'taken');
      tell(s, 'got-' + thing.type, thing.type === 'key' ? '¡La llave!' : '¡La espada!');
    } else {
      sfx.step();
    }
    paintBag(s);

    s.pos = next;
    s.hero.style.left = (((next % m.cols) + 0.5) / m.cols) * 100 + '%';
    s.hero.style.top = ((Math.floor(next / m.cols) + 0.5) / m.rows) * 100 + '%';
    if (next === m.goal) finish(s);
  }

  // Sacar algo del laberinto con su animación (puerta que se abre, dragón vencido, llave agarrada)
  function vanish(s, cell, cls) {
    const thing = s.things.get(cell);
    s.things.delete(cell);
    thing.el.classList.add(cls);
    setTimeout(() => thing.el.remove(), 600);
  }

  // ---------- Fin del nivel ----------

  async function finish(s) {
    s.busy = true;
    const p = progress();
    const last = s.level === LEVELS.length;
    const bigPrize = last && !p.prize;
    p.done = Math.max(p.done, s.level);
    if (bigPrize) p.prize = true;
    store.save();

    sfx.win();
    sfx.cheer();
    ui().burst(s.board);
    s.board.querySelector('.mz-thing.goal').classList.add('opened');
    BQ.puppet.use(s.hero.querySelector('.avatar'));
    s.board.classList.add('won');

    if (!last) {
      await Promise.all([voice.say(U.pick(['¡Muy bien!', '¡Lo lograste!', '¡Genial!', '¡Saliste del laberinto!'])), wait(1700)]);
      if (alive(s)) startLevel(s.level + 1);
      return;
    }
    await wait(1200);
    if (!alive(s)) return;
    // El último: la primera vez, el premio grande; después, como ganar un partido
    BQ.sport.result({
      screen: s.screen,
      won: true,
      coins: bigPrize ? BIG_COINS : 1,
      wins: bigPrize ? BIG_WINS : 1,
      title: bigPrize ? '¡Campeón!' : '¡Ganaste!',
      detail: h('div', { class: 'mt-final' }, h('span', { class: 'emoji' }, '🧭'), ` ${LEVELS.length} de ${LEVELS.length}`),
      onAgain: open,
      winSay: bigPrize
        ? '¡Increíble! ¡Pasaste todos los laberintos! ¡Te ganaste cien monedas!'
        : '¡Pasaste el último laberinto otra vez! ¡Te ganaste una moneda!',
      loseSay: '',
      isAlive: () => alive(s),
    });
  }

  BQ.maze = { open, build, levels: LEVELS };
})(window.BQ);
