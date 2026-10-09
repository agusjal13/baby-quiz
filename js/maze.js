(function (BQ) {
  'use strict';

  /*
   * Laberintos: 40 niveles de menor a mayor. El personaje camina libre (en cualquier dirección, no
   * de a casilleros) con una palanca analógica; también va hacia el dedo si se toca el laberinto,
   * o con las flechas del teclado. Se desliza contra las paredes y dobla suave en las esquinas.
   *   - Llave 🔑: abre una puerta 🚪 (cada puerta gasta una llave).
   *   - Espada 🗡️: sirve para vencer al dragón 🐲 que tapa el camino.
   *   - Botón de color (desde el nivel 21): al pisarlo baja el muro del mismo color.
   * Los niveles se abren en orden. Terminar por primera vez los niveles 10, 20, 30 y 40 da un premio
   * de monedas y de partidos ganados para los trofeos (ver PRIZES).
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
    // Del 21 en adelante: muros de colores (gates) que se bajan pisando el botón del mismo color
    { size: 6, steps: 22, gates: 1 }, { size: 7, steps: 30, gates: 1 }, { size: 7, steps: 38, gates: 1, doors: 1 }, { size: 8, steps: 44, gates: 1, doors: 1 },
    { size: 8, steps: 48, gates: 2 }, { size: 8, steps: 52, gates: 2 }, { size: 8, steps: 56, gates: 1, dragon: true }, { size: 9, steps: 60, gates: 2, dragon: true },
    { size: 9, steps: 64, gates: 2, doors: 1 }, { size: 9, steps: 70, gates: 2, doors: 1, dragon: true }, { size: 9, steps: 74, gates: 2, doors: 1, dragon: true }, { size: 10, steps: 78, gates: 2, doors: 1, dragon: true },
    { size: 10, steps: 82, gates: 2, doors: 2 }, { size: 10, steps: 86, gates: 3 }, { size: 10, steps: 90, gates: 3, doors: 1 }, { size: 11, steps: 94, gates: 3, doors: 1, dragon: true },
    { size: 11, steps: 98, gates: 3, doors: 1, dragon: true }, { size: 11, steps: 102, gates: 3, doors: 2, dragon: true }, { size: 11, steps: 108, gates: 3, doors: 2, dragon: true }, { size: 12, steps: 114, gates: 3, doors: 2, dragon: true },
  ];
  // Premios (solo la primera vez que se termina ese nivel): monedas y partidos para los trofeos
  const PRIZES = {
    10: { coins: 20, wins: 2 },
    20: { coins: 30, wins: 5 },
    30: { coins: 35, wins: 7 },
    40: { coins: 40, wins: 10 },
  };
  // Colores de los botones y sus muros (rojo, azul, verde)
  const COLORS = [
    { name: 'rojo', fill: '#e53935', dark: '#8e1b18' },
    { name: 'azul', fill: '#1e88e5', dark: '#0d4a8a' },
    { name: 'verde', fill: '#43a047', dark: '#1f5c23' },
  ];
  const TRIES = 40; // laberintos que se prueban por nivel para elegir el que más se acerca a "steps"
  const THEME = { sky1: '#5e35b1', sky2: '#9575cd', ground: '#4527a0', decor: ['🔑', '⭐', '🗡️', '✨', '🧭'] };
  const ICON = { key: '🔑', sword: '🗡️', door: '🚪', dragon: '🐲', goal: '🎁' };

  // Paredes de cada casillero (bits) y movimientos: [dx, dy, pared propia, pared del vecino]
  const N = 1, E = 2, S_ = 4, W = 8;
  const DIRS = { up: [0, -1, N, S_], right: [1, 0, E, W], down: [0, 1, S_, N], left: [-1, 0, W, E] };

  let S = null;
  const alive = (s) => S === s && s.screen.isConnected;
  // Guardado: último nivel pasado y premios ya cobrados. (Antes había un solo premio, el del nivel 20.)
  const progress = () => {
    const p = store.data.maze || (store.data.maze = { done: 0 });
    if (!p.prizes) p.prizes = p.prize ? { 20: true } : {};
    return p;
  };

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
    const buttonBit = {}; // bit del botón de cada color
    cells.forEach((c, i) => { if (m.items.get(c).type === 'button') buttonBit[m.items.get(c).color] = 1 << i; });
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
          if (item && item.type === 'gate') {
            if (!(mask & buttonBit[item.color])) continue; // muro levantado
          } else if (item && !(mask & bit)) {
            if (item.type === 'door') {
              if (!k) continue;
              k--;
            } else if (item.type === 'dragon') {
              if (!sw) continue;
              sw = 0;
            } else if (item.type === 'key') k++;
            else if (item.type === 'sword') sw = 1;
            mk |= bit; // (botón: queda pisado)
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

      // Puertas y dragón repartidos sobre el camino (el dragón, lo último). Con muros de colores,
      // se mezclan en cualquier orden.
      const blockers = [...Array(spec.doors || 0).fill('door'), ...(spec.dragon ? ['dragon'] : [])];
      if (spec.gates) {
        for (let c = 0; c < spec.gates; c++) blockers.push('gate' + c);
        for (let i = blockers.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [blockers[i], blockers[j]] = [blockers[j], blockers[i]];
        }
      }
      const thing = (b) => (b.startsWith('gate') ? { type: 'gate', color: +b.slice(4) } : { type: b });
      const opener = (b) => (b.startsWith('gate') ? { type: 'button', color: +b.slice(4) } : { type: b === 'door' ? 'key' : 'sword' });
      if (path.length < blockers.length * 3 + 3) return null;
      const items = new Map();
      const spots = blockers.map((_, k) => path[Math.round(((k + 1) / (blockers.length + 1)) * (path.length - 1))]);
      if (new Set(spots).size !== spots.length || spots.includes(m.start) || spots.includes(m.goal)) return null;
      spots.forEach((cell, k) => items.set(cell, thing(blockers[k])));

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
        items.set(pick.i, opener(blockers[k]));
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
      h('span', { class: 'mz-level-tag emoji' }, PRIZES[n] ? '🏆' : n <= done ? '⭐' : spec.gates ? '🔴' : spec.dragon ? '🐲' : spec.doors ? '🔑' : ''));
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
    const put = (i, type, color) => {
      // Botón y muro: dibujados con su color (no hay emoji); lo demás, emoji
      const el = color === undefined
        ? h('span', { class: 'mz-thing emoji ' + type, style: pct(i) }, ICON[type])
        : h('span', { class: 'mz-thing mz-' + type, style: Object.assign(pct(i), { '--c': COLORS[color].fill, '--d': COLORS[color].dark }) });
      board.append(el);
      return el;
    };
    put(m.goal, 'goal');
    m.items.forEach((item, i) => things.set(i, { type: item.type, color: item.color, el: put(i, item.type, item.color) }));
    const hero = h('span', { class: 'mz-hero', style: pct(m.start) }, BQ.puppet.el(store.data.character));
    board.append(hero);

    const bag = h('div', { class: 'mz-bag' });
    // Palanca analógica: una base redonda y la perilla que sigue al dedo
    const knob = h('span', { class: 'mz-knob' });
    const pad = h('div', { class: 'mz-stick', 'aria-label': 'Palanca para moverse' },
      ['up', 'right', 'down', 'left'].map((d) => h('span', { class: 'mz-stick-arrow ' + d })), knob);

    const screen = h('div', { class: 'screen maze' },
      ui().topbar(ui().backBtn(() => open()),
        h('div', { class: 'mz-top' }, h('span', { class: 'mz-n' }, h('span', { class: 'emoji' }, '🧭'), ' ' + level), bag),
        h('span', { class: 'spacer' })),
      h('div', { class: 'mz-body' }, h('div', { class: 'mz-stage' }, board), pad));
    ui().show(screen, THEME);

    const s = {
      screen, board, hero, bag, pad, knob, m, things, keys: 0, sword: false, level, busy: false, told: {},
      // Posición en casilleros (con decimales): arranca en el centro del casillero de salida
      x: (m.start % cols) + 0.5, y: Math.floor(m.start / cols) + 0.5,
      stick: { x: 0, y: 0 }, finger: null, held: {}, walked: 0, last: performance.now(),
    };
    S = s;
    paintBag(s);
    listen(s);
    loop(s);

    const spec = LEVELS[level - 1];
    const first = (test) => LEVELS.findIndex(test) === level - 1;
    voice.say(first((l) => l.gates) ? '¡Pisá el botón rojo para bajar el muro rojo!'
      : first((l) => l.gates > 1) ? '¡Cada botón baja el muro de su color!'
      : first((l) => l.doors && l.dragon) ? '¡Buscá la llave y la espada!'
      : first((l) => l.dragon) ? '¡Buscá la espada para vencer al dragón!'
        : first((l) => l.doors) ? '¡Buscá la llave para abrir la puerta!'
          : level === 1 ? '¡Llevalo hasta el regalo con la palanca!'
            : spec.doors > 1 ? '¡Hay dos puertas!' : `Laberinto ${level}`);
  }

  function paintBag(s) {
    const icons = [...Array(s.keys).fill(ICON.key), ...(s.sword ? [ICON.sword] : [])];
    s.bag.replaceChildren(...icons.map((icon) => h('span', { class: 'mz-bag-item emoji' }, icon)));
  }

  // ---------- Controles ----------

  const SPEED = 3.4; // casilleros por segundo con la palanca a fondo
  const BODY = 0.27; // "radio" del personaje, en casilleros: lo que no puede meterse en una pared

  function listen(s) {
    // Palanca: mientras el dedo está apoyado, la perilla lo sigue y marca hacia dónde y qué tan rápido
    let id = null;
    const aim = (e) => {
      const r = s.pad.getBoundingClientRect();
      const max = r.width * 0.3;
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      if (d > max) {
        dx *= max / d;
        dy *= max / d;
      }
      s.stick.x = dx / max;
      s.stick.y = dy / max;
      s.knob.style.translate = `${dx}px ${dy}px`;
    };
    const release = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      s.stick.x = 0;
      s.stick.y = 0;
      s.knob.style.translate = '0px 0px';
      s.pad.classList.remove('on');
    };
    s.pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sfx.init();
      id = e.pointerId;
      try { s.pad.setPointerCapture(id); } catch (err) { /* sigue sin captura */ }
      s.pad.classList.add('on');
      aim(e);
    });
    s.pad.addEventListener('pointermove', (e) => { if (e.pointerId === id) aim(e); });
    s.pad.addEventListener('pointerup', release);
    s.pad.addEventListener('pointercancel', release);

    // Tocar (o arrastrar el dedo por) el laberinto: el personaje camina hacia el dedo
    let bid = null;
    const point = (e) => {
      const r = s.board.getBoundingClientRect();
      s.finger = { x: ((e.clientX - r.left) / r.width) * s.m.cols, y: ((e.clientY - r.top) / r.height) * s.m.rows };
    };
    s.board.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sfx.init();
      bid = e.pointerId;
      try { s.board.setPointerCapture(bid); } catch (err) { /* sigue sin captura */ }
      point(e);
    });
    s.board.addEventListener('pointermove', (e) => { if (e.pointerId === bid) point(e); });
    const lift = (e) => { if (e.pointerId === bid) { bid = null; s.finger = null; } };
    s.board.addEventListener('pointerup', lift);
    s.board.addEventListener('pointercancel', lift);

    // Flechas del teclado (en la PC)
    const keys = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const onKey = (e) => {
      if (!alive(s)) {
        removeEventListener('keydown', onKey);
        removeEventListener('keyup', onKey);
        return;
      }
      if (!keys[e.key]) return;
      e.preventDefault();
      s.held[keys[e.key]] = e.type === 'keydown';
    };
    addEventListener('keydown', onKey);
    addEventListener('keyup', onKey);
  }

  // Hacia dónde quiere ir (vector de largo 0 a 1): palanca, dedo sobre el laberinto o teclado
  function wish(s) {
    let x = s.stick.x;
    let y = s.stick.y;
    if (Math.hypot(x, y) < 0.18) { // palanca suelta (o apenas tocada)
      x = (s.held.right ? 1 : 0) - (s.held.left ? 1 : 0);
      y = (s.held.down ? 1 : 0) - (s.held.up ? 1 : 0);
      if (!x && !y && s.finger) {
        x = s.finger.x - s.x;
        y = s.finger.y - s.y;
        if (Math.hypot(x, y) < 0.15) return [0, 0]; // ya llegó al dedo
        const d = Math.hypot(x, y);
        x /= d;
        y /= d;
      }
    }
    const d = Math.hypot(x, y);
    return d > 1 ? [x / d, y / d] : [x, y];
  }

  function loop(s) {
    if (!alive(s)) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - s.last) / 1000);
    s.last = now;
    if (!s.busy) step(s, dt);
    setTimeout(() => loop(s), 16);
  }

  // Decir algo una sola vez cada tanto (para no repetir en cada choque)
  function tell(s, key, text) {
    const now = Date.now();
    if (s.told[key] && now - s.told[key] < 4000) return;
    s.told[key] = now;
    voice.say(text);
  }

  // ¿Lo que hay en ese casillero no deja pasar? (puerta sin llave, dragón sin espada, muro levantado)
  function blocker(s, cell) {
    const t = s.things.get(cell);
    if (!t) return null;
    if (t.type === 'gate' || (t.type === 'door' && !s.keys) || (t.type === 'dragon' && !s.sword)) return t;
    return null;
  }

  // Chocó contra algo que no deja pasar: se sacude y la voz dice qué falta
  function refuse(s, t) {
    const now = Date.now();
    if (s.refused && now - s.refused < 700) return;
    s.refused = now;
    t.el.classList.remove('nope', 'roar');
    void t.el.offsetWidth;
    t.el.classList.add(t.type === 'dragon' ? 'roar' : 'nope');
    if (t.type === 'dragon') sfx.noise(0.4, 'lowpass', 300, 0.4, 0.02);
    else sfx.wrong();
    tell(s, t.type, t.type === 'door' ? '¡Está cerrada! Buscá la llave.'
      : t.type === 'dragon' ? '¡Cuidado, un dragón! Buscá la espada.'
        : `¡Pisá el botón ${COLORS[t.color].name}!`);
  }

  function step(s, dt) {
    const { m } = s;
    const [wx, wy] = wish(s);
    if (!wx && !wy) return;
    if (Math.abs(wx) > 0.1) s.hero.classList.toggle('flip', wx < 0); // mira para donde camina
    const fromX = s.x;
    const fromY = s.y;
    s.x += wx * SPEED * dt;
    s.y += wy * SPEED * dt;

    // Paredes del casillero donde está: no puede acercarse a menos de BODY (y así se desliza).
    // Una puerta cerrada, el dragón o un muro levantado en el casillero de al lado cuentan como pared.
    const cx = clampInt(Math.floor(fromX), 0, m.cols - 1);
    const cy = clampInt(Math.floor(fromY), 0, m.rows - 1);
    const cell = cy * m.cols + cx;
    const side = (bit, dx, dy) => {
      if (m.walls[cell] & bit) return true;
      const t = blocker(s, cell + dx + dy * m.cols);
      if (!t) return false;
      return t; // pared "blanda": avisa
    };
    const hit = [];
    let w;
    if ((w = side(N, 0, -1)) && s.y < cy + BODY) { s.y = cy + BODY; hit.push(w); }
    if ((w = side(S_, 0, 1)) && s.y > cy + 1 - BODY) { s.y = cy + 1 - BODY; hit.push(w); }
    if ((w = side(W, -1, 0)) && s.x < cx + BODY) { s.x = cx + BODY; hit.push(w); }
    if ((w = side(E, 1, 0)) && s.x > cx + 1 - BODY) { s.x = cx + 1 - BODY; hit.push(w); }
    const soft = hit.find((t) => t !== true);
    if (soft) refuse(s, soft);

    // Esquinas: donde termina una pared hay un "poste"; lo rodea en vez de trabarse
    for (const [px, py] of [[cx, cy], [cx + 1, cy], [cx, cy + 1], [cx + 1, cy + 1]]) {
      if (!post(m, px, py)) continue;
      const dx = s.x - px;
      const dy = s.y - py;
      const d = Math.hypot(dx, dy);
      if (d < BODY && d > 0.0001) {
        s.x = px + (dx / d) * BODY;
        s.y = py + (dy / d) * BODY;
      }
    }
    s.x = Math.max(BODY, Math.min(m.cols - BODY, s.x));
    s.y = Math.max(BODY, Math.min(m.rows - BODY, s.y));

    s.hero.style.left = (s.x / m.cols) * 100 + '%';
    s.hero.style.top = (s.y / m.rows) * 100 + '%';
    // Pasitos: un sonido cada medio casillero caminado
    s.walked += Math.hypot(s.x - fromX, s.y - fromY);
    if (s.walked > 0.5) {
      s.walked = 0;
      sfx.step();
    }
    enter(s, Math.floor(s.y) * m.cols + Math.floor(s.x));
  }

  const clampInt = (v, a, b) => Math.max(a, Math.min(b, v));

  // ¿Hay un poste (punta de alguna pared) en el cruce (px, py) de la cuadrícula?
  function post(m, px, py) {
    const wallsAt = (x, y) => (x < 0 || y < 0 || x >= m.cols || y >= m.rows ? 0 : m.walls[y * m.cols + x]);
    return !!((wallsAt(px - 1, py - 1) & (E | S_)) || (wallsAt(px, py - 1) & (W | S_))
      || (wallsAt(px - 1, py) & (E | N)) || (wallsAt(px, py) & (W | N)));
  }

  // Lo que pasa al pisar un casillero: abrir la puerta, vencer al dragón, agarrar algo, pisar un botón, llegar
  function enter(s, cell) {
    const { m } = s;
    const thing = s.things.get(cell);
    if (thing && thing.type === 'door' && s.keys) {
      s.keys--;
      sfx.notes([[523, 0, 0.1, 'triangle', 0.14], [784, 0.1, 0.2, 'triangle', 0.14]]);
      vanish(s, cell, 'open');
      paintBag(s);
    } else if (thing && thing.type === 'dragon' && s.sword) {
      s.sword = false;
      sfx.noise(0.25, 'highpass', 1800, 0.3, 0.005);
      sfx.correct();
      vanish(s, cell, 'beaten');
      ui().burst(s.board);
      tell(s, 'win-dragon', '¡Venciste al dragón!');
      paintBag(s);
    } else if (thing && (thing.type === 'key' || thing.type === 'sword' || thing.type === 'button')) {
      // Hay que acercarse al medio del casillero para agarrarlo o pisarlo
      const near = Math.hypot(s.x - ((cell % m.cols) + 0.5), s.y - (Math.floor(cell / m.cols) + 0.5)) < 0.42;
      if (near && thing.type === 'button') {
        // Pisa el botón: se hunde y baja el muro de su color
        s.things.delete(cell);
        thing.el.classList.add('pressed');
        sfx.notes([[330, 0, 0.08, 'square', 0.1], [220, 0.08, 0.25, 'triangle', 0.14]]);
        for (const [c, t] of s.things) {
          if (t.type === 'gate' && t.color === thing.color) vanish(s, c, 'lowered');
        }
        tell(s, 'button', '¡Se bajó el muro!');
      } else if (near) {
        if (thing.type === 'key') s.keys++;
        else s.sword = true;
        sfx.coin();
        vanish(s, cell, 'taken');
        tell(s, 'got-' + thing.type, thing.type === 'key' ? '¡La llave!' : '¡La espada!');
        paintBag(s);
      }
    }
    if (cell === m.goal && Math.hypot(s.x - ((cell % m.cols) + 0.5), s.y - (Math.floor(cell / m.cols) + 0.5)) < 0.45) finish(s);
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
    // Premio del nivel (10, 20, 30 y 40), solo la primera vez
    const prize = PRIZES[s.level] && !p.prizes[s.level] ? PRIZES[s.level] : null;
    p.done = Math.max(p.done, s.level);
    if (prize) p.prizes[s.level] = true;
    store.save();

    sfx.win();
    sfx.cheer();
    ui().burst(s.board);
    s.board.querySelector('.mz-thing.goal').classList.add('opened');
    BQ.puppet.use(s.hero.querySelector('.avatar'));
    s.board.classList.add('won');

    if (!prize && !last) {
      await Promise.all([voice.say(U.pick(['¡Muy bien!', '¡Lo lograste!', '¡Genial!', '¡Saliste del laberinto!'])), wait(1700)]);
      if (alive(s)) startLevel(s.level + 1);
      return;
    }
    await wait(1200);
    if (!alive(s)) return;
    // Nivel con premio (la primera vez): monedas y partidos para los trofeos. El último, ya cobrado,
    // vale como ganar un partido. El botón grande sigue con el laberinto siguiente.
    BQ.sport.result({
      screen: s.screen,
      won: true,
      coins: prize ? prize.coins : 1,
      wins: prize ? prize.wins : 1,
      title: prize ? '¡Campeón!' : '¡Ganaste!',
      detail: h('div', { class: 'mt-final' }, h('span', { class: 'emoji' }, '🧭'), ` ${s.level} de ${LEVELS.length}`),
      onAgain: last ? open : () => startLevel(s.level + 1),
      winSay: !prize ? '¡Pasaste el último laberinto otra vez! ¡Te ganaste una moneda!'
        : last ? `¡Increíble! ¡Pasaste todos los laberintos! ¡Te ganaste ${prize.coins} monedas!`
          : `¡Pasaste ${s.level} laberintos! ¡Te ganaste ${prize.coins} monedas!`,
      loseSay: '',
      isAlive: () => alive(s),
    });
  }

  // state y advance: para revisar un nivel desde la consola (advance adelanta n cuadros de dt segundos)
  BQ.maze = { open, build, levels: LEVELS, prizes: PRIZES, state: () => S, advance: (n, dt = 0.016) => { for (let i = 0; i < n && S && !S.busy; i++) step(S, dt); } };
})(window.BQ);
