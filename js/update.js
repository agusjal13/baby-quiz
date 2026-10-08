(function (BQ) {
  'use strict';

  /*
   * Actualizaciones. El juego instalado en la tablet funciona sin internet con los archivos que
   * tiene guardados, y puede quedar varios días abierto en segundo plano con una versión vieja.
   *
   * - check(): con internet, mira el número de versión publicado (js/version.js) y lo compara con
   *   el que está corriendo. Si hay una más nueva, el botón 🔄 muestra un globito rojo con "!".
   * - apply(): baja de nuevo todos los archivos (sin usar copias viejas), renueva lo guardado y
   *   recarga el juego. El progreso, las monedas y los trofeos no se tocan (están aparte).
   */

  const h = BQ.util.h;
  const LOCAL = self.BQ_VERSION || 0;
  const online = /^https?:$/.test(location.protocol);

  const state = { local: LOCAL, remote: null, available: false, checked: false };
  const badges = new Set(); // botones que muestran el globito

  function paint() {
    for (const b of [...badges]) {
      if (!b.isConnected) badges.delete(b);
      else b.classList.toggle('has-news', state.available);
    }
  }

  // Versión publicada, o null si no hay internet (o no se pudo leer)
  async function remoteVersion() {
    if (!online) return null;
    try {
      const res = await fetch('js/version.js', { cache: 'no-store' });
      if (!res.ok) return null;
      const m = /BQ_VERSION\s*=\s*(\d+)/.exec(await res.text());
      return m ? Number(m[1]) : null;
    } catch (e) {
      return null;
    }
  }

  async function check() {
    const remote = await remoteVersion();
    state.checked = true;
    state.remote = remote;
    state.available = remote !== null && remote > LOCAL;
    paint();
    return state;
  }

  // Baja todo de nuevo y recarga. onProgress(hechos, total). Devuelve false si no hay internet.
  async function apply(onProgress) {
    if ((await remoteVersion()) === null) return false;
    // La lista de archivos sale del sw.js publicado (el nuevo)
    let files = ['index.html', 'css/styles.css'];
    try {
      const sw = await (await fetch('sw.js', { cache: 'no-store' })).text();
      const found = [...sw.matchAll(/'([\w./-]+\.(?:html|css|js|png|svg|webmanifest))'/g)].map((m) => m[1]);
      if (found.length) files = [...new Set(found)];
    } catch (e) { /* se sigue con lo básico */ }
    let done = 0;
    let failed = 0;
    // "reload": va a internet sí o sí y renueva la copia del navegador
    await Promise.all(files.map((file) => fetch(file, { cache: 'reload' })
      .then((res) => { if (!res.ok) failed++; })
      .catch(() => { failed++; })
      .then(() => onProgress && onProgress(++done, files.length))));
    if (failed > files.length / 2) return false; // se cortó internet: no se toca nada
    try {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg) await reg.update();
    } catch (e) { /* igual se recarga */ }
    location.reload();
    return true;
  }

  // Botón redondo 🔄 con el globito rojo "!" cuando hay una versión nueva
  function button() {
    const b = h('button', {
      class: 'btn-round update-btn' + (state.available ? ' has-news' : ''),
      'aria-label': 'Actualizar el juego',
      onpointerdown: BQ.ui.tap(() => dialog()),
    }, h('span', { class: 'emoji' }, '🔄'), h('span', { class: 'update-badge' }, '!'));
    badges.add(b);
    return b;
  }

  // Cartel: avisa si hay algo nuevo y ofrece actualizar
  async function dialog() {
    const app = document.getElementById('app');
    const title = h('h3', {}, 'Buscando novedades…');
    const text = h('p', { class: 'update-text' }, '');
    const bar = h('div', { class: 'update-bar', hidden: true }, h('span', {}));
    const go = h('button', { type: 'button', class: 'primary', hidden: true }, 'Actualizar');
    const closeBtn = h('button', { type: 'button' }, 'Cerrar');
    const close = () => modal.remove();
    closeBtn.onclick = close;
    const modal = h('div', { class: 'modal' }, h('div', { class: 'panel update-panel' },
      h('div', { class: 'update-icon emoji' }, '🔄'), title, text, bar,
      h('p', { class: 'note' }, `Versión instalada: ${LOCAL}`),
      h('div', { class: 'row' }, closeBtn, go)));
    app.append(modal);

    await check();
    if (!modal.isConnected) return;
    if (state.remote === null) {
      title.textContent = 'No hay internet';
      text.textContent = 'Para buscar novedades, conectá la tablet a internet y probá de nuevo.';
      return;
    }
    if (state.available) {
      title.textContent = '¡Hay cosas nuevas!';
      text.textContent = 'Si actualizás, el juego trae cosas nuevas. No se pierde nada: las monedas, los trofeos y todo lo que ganaste quedan igual.';
      go.textContent = 'Actualizar';
      BQ.voice.say('¡Hay cosas nuevas! Tocá actualizar.');
    } else {
      title.textContent = 'Ya tenés la última versión';
      text.textContent = 'No hay nada nuevo por ahora. Si algo no anda bien, podés bajar todo de nuevo igual.';
      go.textContent = 'Actualizar igual';
      go.classList.remove('primary');
    }
    go.hidden = false;
    go.onclick = async () => {
      go.disabled = true;
      closeBtn.disabled = true;
      bar.hidden = false;
      title.textContent = 'Actualizando…';
      text.textContent = 'Un momento, no cierres el juego.';
      const ok = await apply((n, total) => { bar.firstChild.style.width = Math.round((n / total) * 100) + '%'; });
      if (ok) return; // se recarga solo
      go.disabled = false;
      closeBtn.disabled = false;
      bar.hidden = true;
      title.textContent = 'No se pudo actualizar';
      text.textContent = 'Se cortó internet. El juego quedó como estaba; probá de nuevo cuando haya conexión.';
    };
  }

  // Busca novedades al abrir, al volver al juego y cuando vuelve internet (como mucho cada 5 minutos)
  let last = 0;
  function autoCheck() {
    if (document.hidden || Date.now() - last < 5 * 60 * 1000) return;
    last = Date.now();
    check();
  }
  if (online) {
    addEventListener('online', () => { last = 0; autoCheck(); });
    document.addEventListener('visibilitychange', autoCheck);
    setTimeout(autoCheck, 1500);
  }

  BQ.update = { state, check, apply, button, dialog };
})(window.BQ);
