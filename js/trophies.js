(function (BQ) {
  'use strict';

  /*
   * Trofeos: se ganan con los partidos ganados (penales y partidito), de más chicos a más lindos.
   * Cada trofeo se dibuja en SVG (100 x 130, apoyado abajo) combinando forma, metal y adornos.
   *   type      medal | cup | star | ball | boot | shield | crown
   *   metal     bronze | silver | gold | diamond | rainbow
   *   scale     tamaño (los primeros son chiquitos)
   *   tiers     escalones de la base (0 = sin base)
   *   gem, topper, laurel, wings, crown, sparkles   adornos
   */

  const U = BQ.util;
  const h = U.h;
  const store = BQ.store;
  const OUT = '#2b2140';

  const TROPHIES = [
    { wins: 1, name: 'la medalla de bronce', type: 'medal', metal: 'bronze', scale: 0.62, tiers: 0 },
    { wins: 2, name: 'la copita de bronce', type: 'cup', metal: 'bronze', scale: 0.62, tiers: 1 },
    { wins: 3, name: 'la medalla de plata', type: 'medal', metal: 'silver', scale: 0.68, tiers: 0 },
    { wins: 4, name: 'la copa de plata', type: 'cup', metal: 'silver', scale: 0.68, tiers: 1 },
    { wins: 5, name: 'la estrella de plata', type: 'star', metal: 'silver', scale: 0.72, tiers: 1 },
    { wins: 6, name: 'la medalla de oro', type: 'medal', metal: 'gold', scale: 0.74, tiers: 0 },
    { wins: 8, name: 'la copa de oro', type: 'cup', metal: 'gold', scale: 0.76, tiers: 2 },
    { wins: 10, name: 'la pelota de oro', type: 'ball', metal: 'gold', scale: 0.78, tiers: 2 },
    { wins: 12, name: 'el botín de oro', type: 'boot', metal: 'gold', scale: 0.8, tiers: 2 },
    { wins: 14, name: 'el escudo de campeón', type: 'shield', metal: 'gold', scale: 0.82, tiers: 2, gem: '#e53935' },
    { wins: 16, name: 'la copa con rubí', type: 'cup', metal: 'gold', scale: 0.84, tiers: 2, gem: '#e53935', topper: true },
    { wins: 18, name: 'la estrella brillante', type: 'star', metal: 'gold', scale: 0.86, tiers: 2, sparkles: true },
    { wins: 20, name: 'la copa gigante con laureles', type: 'cup', metal: 'gold', scale: 0.88, tiers: 3, laurel: true, gem: '#1e88e5' },
    { wins: 23, name: 'la corona de campeón', type: 'crown', metal: 'gold', scale: 0.88, tiers: 2, sparkles: true },
    { wins: 26, name: 'la copa de diamante', type: 'cup', metal: 'diamond', scale: 0.9, tiers: 3, gem: '#ff80ab', sparkles: true },
    { wins: 30, name: 'la pelota de diamante', type: 'ball', metal: 'diamond', scale: 0.92, tiers: 3, laurel: true, sparkles: true },
    { wins: 35, name: 'la copa con alas', type: 'cup', metal: 'gold', scale: 0.94, tiers: 3, wings: true, gem: '#43a047', topper: true },
    { wins: 40, name: 'la copa arcoíris', type: 'cup', metal: 'rainbow', scale: 0.96, tiers: 3, gem: '#ffffff', laurel: true, sparkles: true },
    { wins: 45, name: 'la súper copa estelar', type: 'star', metal: 'rainbow', scale: 0.98, tiers: 3, wings: true, sparkles: true },
    { wins: 50, name: 'la copa del mundo de Baby Quiz', type: 'cup', metal: 'rainbow', scale: 1, tiers: 3, wings: true, laurel: true, crown: true, gem: '#e53935', sparkles: true },
  ];

  const METALS = {
    bronze: ['#f6c08f', '#cd7f32', '#8e5421'],
    silver: ['#ffffff', '#c9ced8', '#8a94a6'],
    gold: ['#fff4b0', '#ffd23f', '#d99a00'],
    diamond: ['#ffffff', '#b3e5fc', '#29b6f6'],
  };
  const RAINBOW = ['#ff5a5a', '#ffb84d', '#ffe14d', '#5fd35f', '#4fa8ff', '#b36bff'];

  let uid = 0;

  function star(cx, cy, R, r) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? R : r;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
    }
    return pts.join(' ');
  }

  function gradient(id, metal) {
    const stops = metal === 'rainbow'
      ? RAINBOW.map((c, i) => `<stop offset="${(i / (RAINBOW.length - 1)) * 100}%" stop-color="${c}"/>`).join('')
      : METALS[metal].map((c, i) => `<stop offset="${i * 50}%" stop-color="${c}"/>`).join('');
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>`;
  }

  // Dibujo de un trofeo (string SVG)
  function art(t) {
    const id = 'tg' + ++uid;
    const fill = `url(#${id})`;
    const dark = t.metal === 'rainbow' ? '#8e44ad' : METALS[t.metal][2];
    const S = `stroke="${OUT}" stroke-width="2.2" stroke-linejoin="round"`;
    const baseTop = 130 - t.tiers * 9;
    let base = '';
    for (let i = 0; i < t.tiers; i++) {
      const w = 50 - i * 9;
      base += `<rect x="${50 - w / 2}" y="${130 - (i + 1) * 9}" width="${w}" height="9" rx="2" fill="${i % 2 ? '#8d6e63' : '#6d4c41'}" ${S}/>`;
    }
    if (t.tiers) base += `<rect x="42" y="${130 - 9 + 2.5}" width="16" height="4" rx="1" fill="${fill}"/>`;

    // Punto de apoyo de la figura y su centro
    const top = t.tiers ? baseTop : 130;
    const cy = top - 40;
    let body = '';
    let back = '';

    if (t.wings) {
      back += `<path d="M34 ${cy} Q6 ${cy - 22} 4 ${cy - 4} Q12 ${cy + 2} 8 ${cy + 10} Q20 ${cy + 12} 16 ${cy + 20} Q28 ${cy + 18} 34 ${cy + 12} Z" fill="#fff" ${S}/>`
        + `<path d="M66 ${cy} Q94 ${cy - 22} 96 ${cy - 4} Q88 ${cy + 2} 92 ${cy + 10} Q80 ${cy + 12} 84 ${cy + 20} Q72 ${cy + 18} 66 ${cy + 12} Z" fill="#fff" ${S}/>`;
    }
    const stem = (y0) => `<rect x="45" y="${y0}" width="10" height="${top - y0}" fill="${fill}" ${S}/><ellipse cx="50" cy="${top}" rx="13" ry="3.5" fill="${fill}" ${S}/>`;

    switch (t.type) {
      case 'medal': {
        const c = 88;
        body = `<path d="M34 10 L46 ${c - 10} L54 ${c - 10} L42 10 Z" fill="#e53935" ${S}/>`
          + `<path d="M66 10 L54 ${c - 10} L46 ${c - 10} L58 10 Z" fill="#1e88e5" ${S}/>`
          + `<circle cx="50" cy="${c}" r="22" fill="${fill}" ${S}/><circle cx="50" cy="${c}" r="15" fill="none" stroke="${dark}" stroke-width="2.5"/>`
          + `<polygon points="${star(50, c + 1, 10, 4.2)}" fill="${dark}"/>`;
        break;
      }
      case 'cup': {
        const y0 = top - 58;
        body = stem(top - 16)
          + `<path d="M24 ${y0 + 8} Q8 ${y0 + 8} 12 ${y0 + 22} Q16 ${y0 + 32} 32 ${y0 + 32}" fill="none" stroke="${OUT}" stroke-width="7"/>`
          + `<path d="M76 ${y0 + 8} Q92 ${y0 + 8} 88 ${y0 + 22} Q84 ${y0 + 32} 68 ${y0 + 32}" fill="none" stroke="${OUT}" stroke-width="7"/>`
          + `<path d="M24 ${y0 + 8} Q8 ${y0 + 8} 12 ${y0 + 22} Q16 ${y0 + 32} 32 ${y0 + 32}" fill="none" stroke="${dark}" stroke-width="3.5"/>`
          + `<path d="M76 ${y0 + 8} Q92 ${y0 + 8} 88 ${y0 + 22} Q84 ${y0 + 32} 68 ${y0 + 32}" fill="none" stroke="${dark}" stroke-width="3.5"/>`
          + `<path d="M22 ${y0} L78 ${y0} Q78 ${y0 + 34} 50 ${top - 14} Q22 ${y0 + 34} 22 ${y0} Z" fill="${fill}" ${S}/>`
          + `<ellipse cx="50" cy="${y0}" rx="28" ry="5" fill="${dark}" ${S}/>`
          + `<path d="M30 ${y0 + 8} Q30 ${y0 + 26} 42 ${y0 + 34}" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="3.5" stroke-linecap="round"/>`;
        if (t.gem) body += `<path d="M50 ${y0 + 10} L58 ${y0 + 18} L50 ${y0 + 27} L42 ${y0 + 18} Z" fill="${t.gem}" ${S}/>`;
        else body += `<polygon points="${star(50, y0 + 18, 8, 3.4)}" fill="${dark}"/>`;
        if (t.topper) body += `<polygon points="${star(50, y0 - 12, 10, 4.2)}" fill="#ffd23f" ${S}/>`;
        if (t.crown) body += `<path d="M36 ${y0 - 4} L36 ${y0 - 22} L43 ${y0 - 13} L50 ${y0 - 26} L57 ${y0 - 13} L64 ${y0 - 22} L64 ${y0 - 4} Z" fill="#ffd23f" ${S}/>`
          + `<circle cx="50" cy="${y0 - 26}" r="3" fill="#e53935" ${S}/>`;
        break;
      }
      case 'star':
        body = stem(top - 16) + `<polygon points="${star(50, cy - 6, 30, 13)}" fill="${fill}" ${S}/>`
          + `<polygon points="${star(50, cy - 6, 14, 6)}" fill="rgba(255,255,255,.55)"/>`;
        break;
      case 'ball': {
        const r = 22;
        const c = top - 16 - r + 4;
        body = stem(top - 16) + `<circle cx="50" cy="${c}" r="${r}" fill="${fill}" ${S}/>`
          + `<polygon points="50,${c - 8} 57.6,${c - 2.5} 54.7,${c + 6.5} 45.3,${c + 6.5} 42.4,${c - 2.5}" fill="${dark}"/>`
          + `<path d="M50 ${c - 8} L50 ${c - r} M57.6 ${c - 2.5} L${50 + r * 0.95} ${c - 7} M54.7 ${c + 6.5} L${50 + r * 0.6} ${c + r * 0.8} M45.3 ${c + 6.5} L${50 - r * 0.6} ${c + r * 0.8} M42.4 ${c - 2.5} L${50 - r * 0.95} ${c - 7}" stroke="${dark}" stroke-width="2"/>`
          + `<path d="M38 ${c - 12} Q42 ${c - 17} 48 ${c - 18}" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="3" stroke-linecap="round"/>`;
        break;
      }
      case 'boot': {
        const y = top - 36;
        body = `<path d="M30 ${y} L52 ${y} L54 ${y + 14} Q72 ${y + 13} 78 ${y + 24} L78 ${y + 30} L26 ${y + 30} Q24 ${y + 16} 30 ${y} Z" fill="${fill}" ${S}/>`
          + `<path d="M34 ${y + 8} L50 ${y + 8} M34 ${y + 14} L52 ${y + 14}" stroke="${dark}" stroke-width="2.5" stroke-linecap="round"/>`
          + `<rect x="30" y="${y + 30}" width="6" height="5" fill="${OUT}"/><rect x="48" y="${y + 30}" width="6" height="5" fill="${OUT}"/><rect x="66" y="${y + 30}" width="6" height="5" fill="${OUT}"/>`;
        break;
      }
      case 'shield': {
        const y = top - 56;
        body = `<path d="M50 ${y} L76 ${y + 8} L74 ${y + 30} Q68 ${y + 46} 50 ${y + 54} Q32 ${y + 46} 26 ${y + 30} L24 ${y + 8} Z" fill="${fill}" ${S}/>`
          + `<path d="M50 ${y + 8} L67 ${y + 13} L66 ${y + 29} Q62 ${y + 40} 50 ${y + 45} Q38 ${y + 40} 34 ${y + 29} L33 ${y + 13} Z" fill="none" stroke="${dark}" stroke-width="2.5"/>`
          + `<polygon points="${star(50, y + 26, 11, 4.6)}" fill="${t.gem || dark}" ${S}/>`;
        break;
      }
      case 'crown': {
        const y = top - 42;
        body = `<ellipse cx="50" cy="${top - 5}" rx="30" ry="7" fill="#e53935" ${S}/>`
          + `<path d="M24 ${y + 34} L24 ${y + 8} L37 ${y + 20} L50 ${y} L63 ${y + 20} L76 ${y + 8} L76 ${y + 34} Z" fill="${fill}" ${S}/>`
          + `<circle cx="24" cy="${y + 8}" r="4" fill="#1e88e5" ${S}/><circle cx="50" cy="${y}" r="4.5" fill="#e53935" ${S}/><circle cx="76" cy="${y + 8}" r="4" fill="#43a047" ${S}/>`
          + `<rect x="24" y="${y + 26}" width="52" height="8" fill="${dark}" ${S}/>`;
        break;
      }
      default:
        break;
    }

    let front = '';
    if (t.laurel) {
      const leaf = (x, y, rot) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="2.8" fill="#43a047" stroke="#1b5e20" stroke-width="1" transform="rotate(${rot} ${x} ${y})"/>`;
      for (let i = 0; i < 5; i++) {
        front += leaf(20 + i * 2, top - 8 - i * 9, -60 + i * 8) + leaf(80 - i * 2, top - 8 - i * 9, 60 - i * 8);
      }
    }
    if (t.sparkles) {
      [[12, 30], [88, 24], [84, 70], [16, 76], [50, 6]].forEach(([x, y], i) => {
        front += `<polygon class="tr-spark" style="animation-delay:${i * 0.3}s" points="${star(x, y, 5, 1.8)}" fill="#fff59d" stroke="#f0a500" stroke-width=".8"/>`;
      });
    }

    const sc = t.scale;
    return `<svg class="trophy-art" viewBox="0 0 100 130" overflow="visible"><defs>${gradient(id, t.metal)}</defs>`
      + `<g transform="translate(50 130) scale(${sc}) translate(-50 -130)">${back}${base}${body}${front}</g></svg>`;
  }

  // ---------- Vitrina ----------

  const THEME = { sky1: '#3a2a7a', sky2: '#7b5cff', ground: '#2c205f', decor: ['⭐', '✨', '🏆', '🌟', '✨'] };

  function open() {
    const ui = BQ.ui;
    const voice = BQ.voice;
    const sfx = BQ.sfx;
    const won = wins();
    const shelf = h('div', { class: 'trophy-shelf' }, TROPHIES.map((t) => {
      const have = won >= t.wins;
      const slot = h('button', {
        class: 'trophy-slot' + (have ? ' have' : ''),
        'aria-label': have ? BQ.trophies.title(t) : 'Trofeo bloqueado',
        onpointerdown: ui.tap(() => {
          if (have) {
            slot.classList.remove('shine');
            void slot.offsetWidth;
            slot.classList.add('shine');
            sfx.notes([[1568, 0, 0.12, 'sine', 0.08], [2093, 0.08, 0.2, 'sine', 0.08]]);
            voice.say(U.cap(t.name));
          } else {
            const left = t.wins - won;
            sfx.tap();
            voice.say(left === 1 ? 'Ganá un partido más para conseguirlo.' : `Ganá ${left} partidos más para conseguirlo.`);
          }
        }),
      },
      BQ.trophies.el(t),
      have
        ? h('span', { class: 'trophy-slot-name' }, BQ.trophies.title(t))
        : h('span', { class: 'trophy-lock' }, h('span', { class: 'emoji' }, '🔒'), ' ', String(t.wins)));
      return slot;
    }));

    const n = unlocked().length;
    ui.show(h('div', { class: 'screen trophies' },
      ui.topbar(ui.backBtn(() => ui.showWorlds()),
        h('h2', { class: 'screen-title' }, h('span', { class: 'emoji' }, '🏆'), ` Mis trofeos: ${n} de ${TROPHIES.length}`)),
      shelf), THEME);
    const nx = next();
    voice.say(n === 0
      ? '¡Ganá partidos de penales o partidito para conseguir trofeos!'
      : `¡Tenés ${n === 1 ? 'un trofeo' : `${n} trofeos`}!` + (nx ? ` Para el próximo te ${nx.wins - won === 1 ? 'falta un partido' : `faltan ${nx.wins - won} partidos`}.` : ' ¡Los tenés todos!'));
  }

  const wins = () => store.data.wins || 0;
  const unlocked = () => TROPHIES.filter((t) => wins() >= t.wins);
  const next = () => TROPHIES.find((t) => wins() < t.wins) || null;

  BQ.trophies = {
    open,
    list: TROPHIES,
    art,
    wins,
    next,
    // Suma un partido ganado; devuelve el trofeo nuevo si se ganó uno
    win() {
      store.data.wins = wins() + 1;
      store.save();
      return TROPHIES.find((t) => t.wins === store.data.wins) || null;
    },
    el(t, cls) {
      return h('span', { class: 'trophy' + (cls ? ' ' + cls : ''), html: art(t) });
    },
    title: (t) => U.cap(t.name.replace(/^(el|la) /, '')),
    count: () => unlocked().length,
  };
})(window.BQ);
