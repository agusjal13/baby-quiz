(function (BQ) {
  'use strict';

  /*
   * Bingo familiar online (Supabase Realtime: canales con "broadcast" y "presence", sin tablas).
   *
   * El dispositivo que crea la partida es el anfitrión: guarda el estado (números salidos, ganadores)
   * y se lo manda a todos cada vez que cambia. Los demás solo marcan su cartón y avisan si hicieron
   * línea o bingo; el anfitrión decide quién llegó primero.
   *
   * Mensajes del canal "bingo-CODIGO":
   *   state  anfitrión → todos   estado completo de la partida
   *   hello  jugador → todos     "acabo de entrar": el anfitrión responde con el estado
   *   claim  jugador → todos     "hice línea / bingo": solo el anfitrión lo procesa
   */

  const U = BQ.util;
  const h = U.h;
  const store = BQ.store;
  const voice = BQ.voice;
  const sfx = BQ.sfx;

  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
  const MAX_N = 40;
  const SIZE = 4;
  const AUTO_MS = 7000;
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin O/0 ni I/1, que se confunden
  const THEME = {
    sky1: '#ffe3b3', sky2: '#ffc9c9', ground: '#a8dba8',
    decor: ['🎱', '🎈', '⭐', '🎉', '✨'],
  };
  const BALL_COLORS = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa'];

  // Las 10 líneas del cartón 4x4: filas, columnas y diagonales
  const LINES = [];
  for (let r = 0; r < SIZE; r++) LINES.push([0, 1, 2, 3].map((c) => r * SIZE + c));
  for (let c = 0; c < SIZE; c++) LINES.push([0, 1, 2, 3].map((r) => r * SIZE + c));
  LINES.push([0, 5, 10, 15], [3, 6, 9, 12]);

  let client = null;
  let S = null; // partida actual

  const ui = () => BQ.ui;
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignorar */ } },
  };

  // ---------- Identidad del jugador ----------

  function pid() {
    if (!store.data.pid) {
      store.data.pid = Math.random().toString(36).slice(2, 10);
      store.save();
    }
    return store.data.pid;
  }
  const charId = () => store.data.character || 'mago';
  const defaultName = () => U.cap(ui().currentChar().name.replace(/^(el|la) /, ''));
  const myName = () => store.data.nick || defaultName();
  const myLook = () => ({ charId: charId(), worn: BQ.wardrobe.wornItems(charId()).map((i) => i.id) });

  const ballColor = (n) => BALL_COLORS[n % BALL_COLORS.length];
  const cardKey = (code, round) => `bingo.card.${code}.${round}`;
  const hostKey = (code) => `bingo.host.${code}`;
  const newCode = () => Array.from({ length: 4 }, () => U.pick([...CODE_CHARS])).join('');
  const newCard = () => U.sample(Array.from({ length: MAX_N }, (_, i) => i + 1), SIZE * SIZE).sort((a, b) => a - b);
  const shareLink = (code) => `${location.origin}${location.pathname}#bingo-${code}`;

  // ---------- Conexión ----------

  function loadSdk() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SDK_URL;
      s.onload = resolve;
      s.onerror = () => reject(new Error('offline'));
      document.head.append(s);
    });
  }

  async function getClient() {
    if (client) return client;
    const cfg = BQ.ONLINE || {};
    if (!cfg.url || !cfg.anonKey) throw new Error('config');
    if (!navigator.onLine) throw new Error('offline');
    await loadSdk();
    client = window.supabase.createClient(cfg.url, cfg.anonKey, { realtime: { params: { eventsPerSecond: 10 } } });
    return client;
  }

  function errorText(e) {
    switch (e && e.message) {
      case 'config': return 'Falta configurar el juego online (Supabase).';
      case 'offline': return 'No hay internet. El bingo necesita conexión.';
      case 'notfound': return 'No encontré esa partida. Revisá el código y que siga abierta en el dispositivo que la creó.';
      case 'badcode': return 'El código tiene 4 letras o números.';
      default: return 'No se pudo conectar. Probá de nuevo en un ratito.';
    }
  }

  const waitUntil = (cond, ms) => new Promise((resolve) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (cond() || Date.now() - t0 > ms) {
        clearInterval(iv);
        resolve(cond());
      }
    }, 100);
  });

  async function enter(code, create) {
    leave();
    const sb = await getClient();
    const me = pid();
    const resumed = ls.get(hostKey(code));
    let host = null;
    if (create) host = { code, host: me, round: 1, status: 'lobby', drawn: [], winners: {}, v: 1 };
    else if (resumed && resumed.host === me) host = resumed; // el anfitrión volvió a entrar

    const ch = sb.channel('bingo-' + code, { config: { broadcast: { self: false }, presence: { key: me } } });
    const session = {
      code, ch, me, host,
      state: null, players: {}, round: 0, card: null, marks: new Set(),
      lastCount: 0, seenWin: {}, myLine: false, auto: null, beat: null, timers: [], view: null, dom: null,
    };
    S = session;

    ch.on('broadcast', { event: 'state' }, ({ payload }) => { if (S === session && !session.host) onState(payload); });
    ch.on('broadcast', { event: 'hello' }, () => { if (S === session && session.host) sendState(); });
    ch.on('broadcast', { event: 'claim' }, ({ payload }) => { if (S === session && session.host) onClaim(payload); });
    ch.on('presence', { event: 'sync' }, () => { if (S === session) onPresence(); });

    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('connect')), 12000);
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') { clearTimeout(t); resolve(); }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(t); reject(new Error('connect')); }
      });
    });
    if (S !== session) return;
    await ch.track(Object.assign({ pid: me, name: myName(), host: !!host }, myLook()));

    if (host) {
      saveHost();
      onState(host);
      sendState();
      session.beat = setInterval(sendState, 8000); // por si algún mensaje se perdió
    } else {
      // Pedir el estado al anfitrión (dos intentos)
      ch.send({ type: 'broadcast', event: 'hello', payload: { pid: me } });
      let ok = await waitUntil(() => S !== session || session.state, 3500);
      if (!ok && S === session) {
        ch.send({ type: 'broadcast', event: 'hello', payload: { pid: me } });
        ok = await waitUntil(() => S !== session || session.state, 4000);
      }
      if (S === session && !session.state) {
        leave();
        throw new Error('notfound');
      }
    }
    if (S === session) history.replaceState(null, '', '#bingo-' + code);
  }

  function leave() {
    if (!S) return;
    const s = S;
    S = null;
    clearInterval(s.auto);
    clearInterval(s.beat);
    s.timers.forEach(clearTimeout);
    try { s.ch.untrack(); } catch (e) { /* ignorar */ }
    try { client.removeChannel(s.ch); } catch (e) { /* ignorar */ }
    if (location.hash.startsWith('#bingo')) history.replaceState(null, '', location.pathname + location.search);
  }

  // ---------- Anfitrión ----------

  function saveHost() { if (S && S.host) ls.set(hostKey(S.code), S.host); }

  function sendState() {
    if (!S || !S.host) return;
    S.ch.send({ type: 'broadcast', event: 'state', payload: S.host });
  }

  function hostUpdate(fn) {
    if (!S || !S.host) return;
    fn(S.host);
    S.host.v++;
    saveHost();
    sendState();
    onState(S.host);
  }

  function draw() {
    if (!S || !S.host || S.host.status !== 'playing') return;
    const left = [];
    for (let n = 1; n <= MAX_N; n++) if (!S.host.drawn.includes(n)) left.push(n);
    if (!left.length) return setAuto(false);
    hostUpdate((st) => { st.drawn.push(U.pick(left)); });
  }

  function setAuto(on) {
    if (!S || !S.host) return;
    clearInterval(S.auto);
    S.auto = null;
    if (on && S.host.status === 'playing') {
      draw();
      S.auto = setInterval(draw, AUTO_MS);
    }
    if (S.dom && S.dom.autoBtn) S.dom.autoBtn.classList.toggle('on', !!S.auto);
  }

  function onClaim(c) {
    const st = S.host;
    if (!c || c.round !== st.round || st.status !== 'playing' || st.winners[c.kind]) return;
    hostUpdate((s) => {
      s.winners[c.kind] = { pid: c.pid, name: c.name, charId: c.charId, worn: c.worn };
      if (c.kind === 'bingo') s.status = 'done';
    });
    if (c.kind === 'bingo') setAuto(false);
  }

  function start() { hostUpdate((st) => { st.status = 'playing'; }); }

  function nextRound() {
    hostUpdate((st) => {
      st.round++;
      st.status = 'playing';
      st.drawn = [];
      st.winners = {};
    });
  }

  // ---------- Estado recibido ----------

  function onState(st) {
    if (!S) return;
    const first = !S.state;
    S.state = JSON.parse(JSON.stringify(st));

    if (S.round !== st.round) {
      S.round = st.round;
      S.card = ls.get(cardKey(S.code, st.round)) || newCard();
      ls.set(cardKey(S.code, st.round), S.card);
      S.marks = new Set(ls.get(cardKey(S.code, st.round) + '.marks') || []);
      S.myLine = false;
      S.lastCount = first ? st.drawn.length : 0;
      S.view = null;
    }

    const view = st.status === 'lobby' ? 'waiting' : 'game';
    if (S.view !== view) {
      S.view = view;
      if (view === 'waiting') renderWaiting(first);
      else renderGame(first);
    } else {
      update();
    }

    // Número nuevo
    if (view === 'game' && st.drawn.length > S.lastCount) {
      const n = st.drawn[st.drawn.length - 1];
      S.lastCount = st.drawn.length;
      announce(n);
    }
    S.lastCount = st.drawn.length;

    // Ganadores (al entrar tarde, se muestran sin festejar de nuevo)
    for (const kind of ['line', 'bingo']) {
      const w = st.winners[kind];
      const key = st.round + kind;
      if (w && !S.seenWin[key]) {
        S.seenWin[key] = true;
        if (kind === 'line') { if (!first) lineBanner(w); } else showWinner(w, first);
      }
    }
  }

  function onPresence() {
    const raw = S.ch.presenceState();
    const players = {};
    for (const [key, metas] of Object.entries(raw)) if (metas && metas[0]) players[key] = metas[0];
    const joined = Object.keys(players).some((k) => !S.players[k]);
    S.players = players;
    if (S.host && joined) sendState(); // que el que llega reciba el estado enseguida
    update();
  }

  // ---------- Pantallas ----------

  function open(code) {
    if (!store.data.character) {
      store.data.character = 'mago';
      store.save();
    }
    showLobby(code);
  }

  function showLobby(code, message) {
    leave();
    const name = h('input', { class: 'bingo-input', id: 'bingo-name', maxlength: '12', placeholder: defaultName(), value: store.data.nick || '' });
    const codeIn = h('input', { class: 'bingo-input code', id: 'bingo-code', maxlength: '4', placeholder: 'CÓDIGO', value: code || '', autocapitalize: 'characters', autocomplete: 'off' });
    const status = h('p', { class: 'bingo-status' + (message ? ' error' : '') }, message || '');
    const busy = (text) => { status.className = 'bingo-status'; status.textContent = text; };
    const fail = (e) => { status.className = 'bingo-status error'; status.textContent = errorText(e); };
    const saveName = () => {
      store.data.nick = name.value.trim().slice(0, 12);
      store.save();
    };

    const createBtn = h('button', { class: 'bingo-big create', onclick: async () => {
      sfx.init();
      saveName();
      busy('Creando la partida…');
      try {
        await getClient();
        await enter(newCode(), true);
      } catch (e) { fail(e); }
    } }, h('span', { class: 'emoji' }, '🎲'), ' Crear partida');

    const joinBtn = h('button', { class: 'bingo-big join', onclick: async () => {
      sfx.init();
      saveName();
      const c = codeIn.value.trim().toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(c)) return fail(new Error('badcode'));
      busy('Buscando la partida…');
      try { await enter(c, false); } catch (e) { fail(e); }
    } }, h('span', { class: 'emoji' }, '🚪'), ' Unirme');

    const back = ui().backBtn(() => ui().showWorlds());
    ui().show(h('div', { class: 'screen bingo-lobby' },
      ui().topbar(back, h('h2', { class: 'screen-title' }, h('span', { class: 'emoji' }, '🎱'), ' Bingo familiar'), h('span', { class: 'spacer' })),
      h('div', { class: 'bingo-panel' },
        h('div', { class: 'bingo-me' }, BQ.puppet.el(charId()),
          h('label', { class: 'bingo-label', for: 'bingo-name' }, '¿Cómo te llamás?'), name),
        h('div', { class: 'bingo-choices' },
          createBtn,
          h('div', { class: 'bingo-or' }, 'o'),
          h('div', { class: 'bingo-join' }, codeIn, joinBtn)),
        status)), THEME);
    voice.say(code ? '¡Te invitaron a jugar al bingo! Tocá unirme.' : '¡Bingo en familia! Creá una partida o unite a una.');
  }

  function playersRow(big) {
    const list = Object.values(S ? S.players : {});
    return list.map((p) => h('div', { class: 'bingo-player' + (big ? ' big' : '') + (p.pid === (S && S.me) ? ' me' : '') },
      ui().playable(h('span', { class: 'bingo-player-art' }, BQ.puppet.el(p.charId, p.worn || []))),
      h('span', { class: 'bingo-player-name' }, (p.host ? '👑 ' : '') + p.name)));
  }

  function renderWaiting(first) {
    const code = S.code;
    const players = h('div', { class: 'bingo-players' });
    const copyBtn = h('button', { class: 'bingo-small', onclick: async (e) => {
      const b = e.currentTarget;
      try {
        await navigator.clipboard.writeText(shareLink(code));
        b.textContent = '¡Copiado!';
      } catch (err) {
        b.textContent = shareLink(code);
      }
    } }, 'Copiar link');
    const shareBtn = navigator.share && h('button', { class: 'bingo-small', onclick: () => {
      navigator.share({ title: 'Bingo familiar', text: `¡Vení a jugar al bingo! Código ${code}`, url: shareLink(code) }).catch(() => {});
    } }, 'Compartir');

    const hostArea = S.host
      ? h('button', { class: 'btn-next bingo-start', 'aria-label': 'Empezar', onpointerdown: ui().tap(start) }, h('span', { class: 'play-tri' }))
      : h('p', { class: 'bingo-wait' }, 'Esperando que empiece el juego…');

    const back = ui().backBtn(() => showLobby());
    ui().show(h('div', { class: 'screen bingo-room' },
      ui().topbar(back, h('h2', { class: 'screen-title' }, h('span', { class: 'emoji' }, '🎱'), ' Bingo familiar'), h('span', { class: 'spacer' })),
      h('div', { class: 'bingo-panel' },
        h('div', { class: 'bingo-code-box' },
          h('span', { class: 'bingo-label' }, 'Código de la partida'),
          h('div', { class: 'bingo-code' }, [...code].map((ch) => h('span', {}, ch))),
          h('div', { class: 'bingo-share' }, copyBtn, shareBtn)),
        players,
        hostArea)), THEME);
    S.dom = { players };
    update();
    if (first) {
      voice.say(S.host
        ? '¡Partida creada! Pasales el código a tu familia. Cuando estén todos, tocá empezar.'
        : '¡Entraste! Esperá que empiece el juego.');
    }
  }

  function renderGame(first) {
    const st = S.state;
    const players = h('div', { class: 'bingo-players small' });
    const ball = h('div', { class: 'bingo-ball' }, h('span', { class: 'bingo-ball-n' }, '?'));
    const board = h('div', { class: 'bingo-board' },
      Array.from({ length: MAX_N }, (_, i) => h('span', { class: 'bingo-board-n', 'data-n': i + 1 }, String(i + 1))));
    const card = h('div', { class: 'bingo-card' },
      S.card.map((n, i) => h('button', {
        class: 'bingo-cell' + (S.marks.has(i) ? ' marked' : ''),
        'data-i': i,
        onpointerdown: ui().tap(() => mark(i)),
      }, h('span', { class: 'bingo-cell-n' }, String(n)))));

    let controls = null;
    let autoBtn = null;
    if (S.host) {
      autoBtn = h('button', { class: 'bingo-small auto' + (S.auto ? ' on' : ''), onclick: () => setAuto(!S.auto) }, '⏱️ Automático');
      controls = h('div', { class: 'bingo-controls' },
        h('button', { class: 'bingo-draw', 'aria-label': 'Sacar número', onpointerdown: ui().tap(() => draw()) }, h('span', { class: 'emoji' }, '🎱'), ' Sacar'),
        autoBtn);
    }

    const back = ui().backBtn(() => showLobby());
    const screen = h('div', { class: 'screen bingo-game' },
      ui().topbar(back, players, h('span', { class: 'spacer' })),
      h('div', { class: 'bingo-main' },
        h('div', { class: 'bingo-side' }, ball, controls, board),
        card));
    ui().show(screen, THEME);
    S.dom = { players, ball, board, card, autoBtn, screen };
    update();

    const last = st.drawn[st.drawn.length - 1];
    if (last) setBall(last, false);
    if (!first || st.drawn.length === 0) voice.say('¡Empieza el bingo! Cuando salga un número de tu cartón, tocalo.');
    if (st.status === 'done' && st.winners.bingo) showWinner(st.winners.bingo, true);
  }

  // Actualiza lo que cambia sin redibujar toda la pantalla
  function update() {
    if (!S || !S.dom) return;
    const d = S.dom;
    if (d.players) d.players.replaceChildren(...playersRow(S.view === 'waiting'));
    if (S.view === 'game' && S.state) {
      const drawn = new Set(S.state.drawn);
      d.board.querySelectorAll('.bingo-board-n').forEach((el) => el.classList.toggle('on', drawn.has(Number(el.dataset.n))));
      const hostHere = Object.values(S.players).some((p) => p.host);
      d.screen.classList.toggle('no-host', !S.host && !hostHere);
    }
  }

  function setBall(n, animate) {
    const b = S.dom.ball;
    b.style.setProperty('--ball', ballColor(n));
    b.querySelector('.bingo-ball-n').textContent = String(n);
    if (animate) {
      b.classList.remove('roll');
      void b.offsetWidth;
      b.classList.add('roll');
    }
  }

  function announce(n) {
    setBall(n, true);
    sfx.notes([[523, 0, 0.08], [659, 0.08, 0.08], [784, 0.16, 0.2]]);
    voice.say(`¡Salió el ${n}!`);
    // Ayuda: si está en el cartón y no lo marca, a los 6 segundos titila
    const i = S.card.indexOf(n);
    if (i >= 0 && !S.marks.has(i)) {
      const s = S;
      s.timers.push(setTimeout(() => {
        if (S !== s || s.marks.has(i) || !s.dom) return;
        const cell = s.dom.card.querySelector(`[data-i="${i}"]`);
        if (cell) cell.classList.add('hint');
      }, 6000));
    }
  }

  // ---------- Marcar el cartón ----------

  function mark(i) {
    if (!S || !S.state || S.state.status !== 'playing' || S.marks.has(i)) return;
    const n = S.card[i];
    const cell = S.dom.card.querySelector(`[data-i="${i}"]`);
    if (!S.state.drawn.includes(n)) {
      cell.classList.remove('nope');
      void cell.offsetWidth;
      cell.classList.add('nope');
      sfx.wrong();
      voice.say(`El ${n} todavía no salió.`);
      return;
    }
    S.marks.add(i);
    ls.set(cardKey(S.code, S.round) + '.marks', [...S.marks]);
    cell.classList.remove('hint');
    cell.classList.add('marked');
    sfx.correct();
    ui().burst(cell);

    const full = S.marks.size === S.card.length;
    const line = LINES.some((l) => l.every((k) => S.marks.has(k)));
    if (full) return claim('bingo');
    if (line && !S.myLine) {
      S.myLine = true;
      if (!S.state.winners.line) claim('line');
      else voice.say('¡Hiciste línea!');
    }
  }

  function claim(kind) {
    const c = Object.assign({ kind, pid: S.me, name: myName(), round: S.round }, myLook());
    if (S.host) onClaim(c);
    else S.ch.send({ type: 'broadcast', event: 'claim', payload: c });
  }

  // ---------- Festejos ----------

  function lineBanner(w) {
    if (!S.dom || !S.dom.screen) return;
    const mine = w.pid === S.me;
    const banner = h('div', { class: 'bingo-banner' },
      h('span', { class: 'bingo-banner-art' }, BQ.puppet.el(w.charId, w.worn || [])),
      h('span', {}, mine ? '¡Hiciste línea!' : `¡Línea de ${w.name}!`));
    S.dom.screen.append(banner);
    sfx.win();
    voice.say(mine ? '¡Línea! ¡Muy bien!' : `¡Línea de ${w.name}!`);
    setTimeout(() => banner.remove(), 3500);
  }

  function showWinner(w, quiet) {
    if (!S.dom || !S.dom.screen) return;
    const mine = w.pid === S.me;
    const art = ui().playable(h('div', { class: 'bingo-winner-art' }, BQ.puppet.el(w.charId, w.worn || [])));
    const actions = S.host
      ? h('button', { class: 'btn-next', 'aria-label': 'Otra partida', onpointerdown: ui().tap(nextRound) }, h('span', { class: 'play-tri' }))
      : h('p', { class: 'bingo-wait' }, 'Esperando otra partida…');
    const overlay = h('div', { class: 'party settled bingo-winner' },
      h('div', { class: 'party-rays' }),
      ui().confetti(),
      h('h2', { class: 'party-title' }, [...'¡BINGO!'].map((ch, i) => h('span', {
        style: { '--i': i, color: ui().LOGO_COLORS[i % ui().LOGO_COLORS.length] },
      }, ch))),
      art,
      h('p', { class: 'bingo-winner-name' }, mine ? '¡Ganaste!' : `¡Ganó ${w.name}!`),
      h('div', { class: 'party-actions bingo-winner-actions' }, actions));
    S.dom.screen.append(overlay);
    if (!quiet) {
      sfx.win();
      voice.say(mine ? '¡Bingo! ¡Ganaste!' : `¡Bingo! ¡Ganó ${w.name}!`);
      setTimeout(() => BQ.puppet.use(art.querySelector('.avatar')), 1200);
    }
  }

  BQ.bingo = { open, leave };
})(window.BQ);
