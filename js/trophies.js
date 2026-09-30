(function (BQ) {
  'use strict';

  /*
   * Trofeos: se ganan con los partidos ganados (penales, partidito, pool, bowling, piedra papel o
   * tijera), de más chicos a más lindos.
   * Cada trofeo se dibuja en SVG (100 x 130, apoyado abajo) combinando forma, metal y adornos.
   *   type      medal | cup | star | ball | boot | shield | crown | heart | rocket | planet | bolt | gem
   *   metal     bronze | silver | gold | diamond | ruby | emerald | sapphire | rose | rainbow | fire | galaxy
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
    // Segunda vitrina: formas y materiales nuevos
    { wins: 55, name: 'la medalla de rubí', type: 'medal', metal: 'ruby', scale: 0.9, tiers: 0 },
    { wins: 60, name: 'el corazón de oro', type: 'heart', metal: 'gold', scale: 0.9, tiers: 2 },
    { wins: 65, name: 'la copa esmeralda', type: 'cup', metal: 'emerald', scale: 0.9, tiers: 2, gem: '#ffd23f' },
    { wins: 70, name: 'el cohete de plata', type: 'rocket', metal: 'silver', scale: 0.92, tiers: 2 },
    { wins: 75, name: 'la estrella de zafiro', type: 'star', metal: 'sapphire', scale: 0.92, tiers: 2, sparkles: true },
    { wins: 80, name: 'el rayo de oro', type: 'bolt', metal: 'gold', scale: 0.92, tiers: 2 },
    { wins: 85, name: 'la copa rosa', type: 'cup', metal: 'rose', scale: 0.93, tiers: 3, gem: '#ffffff', topper: true },
    { wins: 90, name: 'el planeta dorado', type: 'planet', metal: 'gold', scale: 0.93, tiers: 2, sparkles: true },
    { wins: 95, name: 'el escudo de diamante', type: 'shield', metal: 'diamond', scale: 0.94, tiers: 3, gem: '#e53935', laurel: true },
    { wins: 100, name: 'la copa de los cien partidos', type: 'cup', metal: 'gold', scale: 0.96, tiers: 3, crown: true, laurel: true, gem: '#1e88e5', sparkles: true },
    { wins: 110, name: 'el diamante gigante', type: 'gem', metal: 'diamond', scale: 0.95, tiers: 3, sparkles: true },
    { wins: 120, name: 'el cohete de fuego', type: 'rocket', metal: 'fire', scale: 0.96, tiers: 3, sparkles: true },
    { wins: 130, name: 'la corona de rubí', type: 'crown', metal: 'ruby', scale: 0.96, tiers: 3, laurel: true },
    { wins: 140, name: 'el corazón arcoíris', type: 'heart', metal: 'rainbow', scale: 0.97, tiers: 3, wings: true, sparkles: true },
    { wins: 150, name: 'la copa galáctica', type: 'cup', metal: 'galaxy', scale: 0.97, tiers: 3, wings: true, gem: '#ffd23f', sparkles: true },
    { wins: 160, name: 'el planeta arcoíris', type: 'planet', metal: 'rainbow', scale: 0.98, tiers: 3, laurel: true, sparkles: true },
    { wins: 170, name: 'la estrella de fuego', type: 'star', metal: 'fire', scale: 0.98, tiers: 3, wings: true, sparkles: true },
    { wins: 180, name: 'la pelota galáctica', type: 'ball', metal: 'galaxy', scale: 0.99, tiers: 3, laurel: true, wings: true },
    { wins: 190, name: 'el rayo arcoíris', type: 'bolt', metal: 'rainbow', scale: 0.99, tiers: 3, wings: true, laurel: true, sparkles: true },
    { wins: 200, name: 'la súper copa legendaria', type: 'cup', metal: 'galaxy', scale: 1, tiers: 3, wings: true, laurel: true, crown: true, gem: '#ff80ab', topper: true, sparkles: true },
  ];

  const METALS = {
    bronze: ['#f6c08f', '#cd7f32', '#8e5421'],
    silver: ['#ffffff', '#c9ced8', '#8a94a6'],
    gold: ['#fff4b0', '#ffd23f', '#d99a00'],
    diamond: ['#ffffff', '#b3e5fc', '#29b6f6'],
    ruby: ['#ffb3b3', '#e53935', '#8e0000'],
    emerald: ['#c8ffd9', '#2e9e44', '#1b5e20'],
    sapphire: ['#cfe6ff', '#1e88e5', '#0d47a1'],
    rose: ['#ffe0ee', '#ff80ab', '#c2185b'],
  };
  // Materiales de muchos colores (degradé) y el color oscuro que los acompaña
  const MULTI = {
    rainbow: { stops: ['#ff5a5a', '#ffb84d', '#ffe14d', '#5fd35f', '#4fa8ff', '#b36bff'], dark: '#8e44ad' },
    fire: { stops: ['#fff176', '#ffb300', '#ff6d00', '#e53935'], dark: '#b71c1c' },
    galaxy: { stops: ['#ff80ab', '#7c4dff', '#304ffe', '#00bcd4'], dark: '#1a237e' },
  };

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
    const list = MULTI[metal] ? MULTI[metal].stops : METALS[metal];
    const stops = list.map((c, i) => `<stop offset="${(i / (list.length - 1)) * 100}%" stop-color="${c}"/>`).join('');
    // La galaxia lleva estrellitas encima del degradé
    const dots = metal === 'galaxy'
      ? `<pattern id="${id}s" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="url(#${id}g)"/>`
        + '<circle cx="3" cy="4" r="1" fill="#fff"/><circle cx="10" cy="10" r=".8" fill="#fff" opacity=".8"/></pattern>'
      : '';
    return `<linearGradient id="${metal === 'galaxy' ? id + 'g' : id}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>${dots}`;
  }

  // Dibujo de un trofeo (string SVG)
  function art(t) {
    const id = 'tg' + ++uid;
    const fill = t.metal === 'galaxy' ? `url(#${id}s)` : `url(#${id})`;
    const dark = MULTI[t.metal] ? MULTI[t.metal].dark : METALS[t.metal][2];
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
      case 'heart': {
        const y = top - 64;
        body = stem(top - 18)
          + `<path d="M50 ${y + 46} C14 ${y + 24} 16 ${y} 35 ${y} C44 ${y} 50 ${y + 8} 50 ${y + 12} C50 ${y + 8} 56 ${y} 65 ${y} C84 ${y} 86 ${y + 24} 50 ${y + 46} Z" fill="${fill}" ${S}/>`
          + `<path d="M30 ${y + 12} Q31 ${y + 6} 37 ${y + 6}" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="3.5" stroke-linecap="round"/>`;
        break;
      }
      case 'rocket': {
        body = `<path d="M42 ${top - 20} Q50 ${top} 58 ${top - 20} Z" fill="#ffb300" ${S}/>`
          + `<path d="M38 ${top - 42} L24 ${top - 16} L38 ${top - 22} Z" fill="${dark}" ${S}/><path d="M62 ${top - 42} L76 ${top - 16} L62 ${top - 22} Z" fill="${dark}" ${S}/>`
          + `<path d="M50 ${top - 86} Q66 ${top - 66} 62 ${top - 30} L62 ${top - 20} L38 ${top - 20} L38 ${top - 30} Q34 ${top - 66} 50 ${top - 86} Z" fill="${fill}" ${S}/>`
          + `<circle cx="50" cy="${top - 54}" r="7.5" fill="#b3e5fc" ${S}/><circle cx="48" cy="${top - 56}" r="2" fill="#fff"/>`;
        break;
      }
      case 'planet': {
        const c = top - 42;
        body = stem(top - 16)
          + `<ellipse cx="50" cy="${c}" rx="34" ry="8" fill="none" stroke="${dark}" stroke-width="4" transform="rotate(-16 50 ${c})"/>`
          + `<circle cx="50" cy="${c}" r="20" fill="${fill}" ${S}/>`
          + `<path d="M22 ${c + 6} Q50 ${c + 16} 80 ${c - 10}" fill="none" stroke="${dark}" stroke-width="4" stroke-linecap="round"/>`
          + `<circle cx="42" cy="${c - 8}" r="4" fill="rgba(255,255,255,.55)"/>`;
        break;
      }
      case 'bolt':
        body = `<path d="M58 ${top - 88} L28 ${top - 42} L47 ${top - 42} L38 ${top - 6} L72 ${top - 56} L53 ${top - 56} Z" fill="${fill}" ${S}/>`
          + `<path d="M55 ${top - 78} L38 ${top - 48}" stroke="rgba(255,255,255,.7)" stroke-width="3" stroke-linecap="round"/>`;
        break;
      case 'gem': {
        const y = top - 70;
        body = stem(top - 16)
          + `<path d="M30 ${y} L70 ${y} L84 ${y + 16} L50 ${y + 56} L16 ${y + 16} Z" fill="${fill}" ${S}/>`
          + `<path d="M16 ${y + 16} L84 ${y + 16} M30 ${y} L40 ${y + 16} L50 ${y + 56} L60 ${y + 16} L70 ${y} M40 ${y + 16} L50 ${y} L60 ${y + 16}" fill="none" stroke="${dark}" stroke-width="1.8" stroke-linejoin="round"/>`
          + `<path d="M24 ${y + 12} L31 ${y + 4}" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`;
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

  // ---------- Mapa de trofeos ----------
  // Un caminito que serpentea con los trofeos en orden; entre trofeo y trofeo hay un casillero por
  // partido. El personaje está parado en los partidos que lleva ganados. Páginas de PAGE trofeos:
  // si se agregan más trofeos a la lista, aparecen solas más páginas.

  const THEME = { sky1: '#3a2a7a', sky2: '#7b5cff', ground: '#2c205f', decor: ['⭐', '✨', '🏆', '🌟', '✨'] };
  const PAGE = 20;

  function open() {
    const ui = BQ.ui;
    const voice = BQ.voice;
    const won = wins();
    const pages = Math.ceil(TROPHIES.length / PAGE);
    const nx = next();
    // Arranca en la página del próximo trofeo (o la última si tiene todos)
    let page = nx ? Math.floor(TROPHIES.indexOf(nx) / PAGE) : pages - 1;

    const look = (BQ.sport.PATHS && BQ.sport.PATHS[store.data.character]) || { place: 'cancha', start: '🏁', dot: '⭐', decor: [] };
    const board = h('div', { class: 'tm-board tp-' + look.place });
    const prev = h('button', { class: 'btn-round tm-arrow', 'aria-label': 'Página anterior', onpointerdown: ui.tap(() => go(page - 1)) }, h('span', { class: 'emoji' }, '⬅️'));
    const nextBtn = h('button', { class: 'btn-round tm-arrow', 'aria-label': 'Página siguiente', onpointerdown: ui.tap(() => go(page + 1)) }, h('span', { class: 'emoji' }, '➡️'));
    const dots = h('div', { class: 'tm-pages' });

    const n = unlocked().length;
    const screen = h('div', { class: 'screen trophies' },
      ui.topbar(ui.backBtn(() => { removeEventListener('resize', onResize); ui.showWorlds(); }),
        h('h2', { class: 'screen-title' }, h('span', { class: 'emoji' }, '🏆'), ` ${n} de ${TROPHIES.length}`),
        h('span', { class: 'spacer' })),
      h('div', { class: 'tm-wrap' }, prev, board, nextBtn),
      dots);
    ui.show(screen, THEME);

    function go(p) {
      if (p < 0 || p >= pages) return;
      page = p;
      BQ.sfx.tap();
      draw();
    }

    function draw() {
      prev.disabled = page === 0;
      nextBtn.disabled = page === pages - 1;
      dots.replaceChildren(...Array.from({ length: pages }, (_, i) => h('span', { class: 'tm-dot' + (i === page ? ' on' : '') })));
      drawPage(board, page, look, won);
    }

    let timer = null;
    const onResize = () => {
      if (!screen.isConnected) return removeEventListener('resize', onResize);
      clearTimeout(timer);
      timer = setTimeout(draw, 150);
    };
    addEventListener('resize', onResize);
    draw();
    if (!board.clientWidth) setTimeout(draw, 100);

    voice.say(n === 0
      ? '¡Ganá partidos para avanzar por el camino y conseguir trofeos!'
      : `¡Tenés ${n === 1 ? 'un trofeo' : `${n} trofeos`}!` + (nx ? ` Para el próximo te ${nx.wins - won === 1 ? 'falta un partido' : `faltan ${nx.wins - won} partidos`}.` : ' ¡Los tenés todos!'));
  }

  function drawPage(board, page, look, won) {
    const ui = BQ.ui;
    const voice = BQ.voice;
    const list = TROPHIES.slice(page * PAGE, page * PAGE + PAGE);
    const startWins = page === 0 ? 0 : TROPHIES[page * PAGE - 1].wins;
    const W = board.clientWidth;
    const H = board.clientHeight;
    if (!W || !H) return;

    // Paradas (salida + trofeos) en una grilla que va y vuelve, como un juego de la oca
    const stops = list.length + 1;
    const cols = W >= H ? (stops > 12 ? 6 : 4) : 3;
    const rows = Math.ceil(stops / cols);
    const padX = W / cols / 2;
    const padY = H / rows / 2;
    const pts = Array.from({ length: stops }, (_, i) => {
      const r = Math.floor(i / cols);
      const c = r % 2 ? cols - 1 - (i % cols) : i % cols;
      return [padX + c * ((W - padX * 2) / Math.max(1, cols - 1)), padY + r * ((H - padY * 2) / Math.max(1, rows - 1))];
    });
    // Camino suave: rectas en cada fila y media vuelta al cambiar de fila
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      if (y0 === y1) d += ` L ${x1} ${y1}`;
      else {
        const out = x0 > W / 2 ? padX * 0.9 : -padX * 0.9;
        d += ` C ${x0 + out} ${y0}, ${x1 + out} ${y1}, ${x1} ${y1}`;
      }
    }

    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'tm-svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const road = (cls) => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('class', cls);
      svg.append(p);
      return p;
    };
    road('tm-road-edge');
    const main = road('tm-road');
    board.replaceChildren(svg);

    // Largo del camino hasta cada parada, para repartir los casilleros entre trofeos
    const lens = [0];
    {
      const probe = document.createElementNS(NS, 'path');
      let acc = `M ${pts[0][0]} ${pts[0][1]}`;
      const segs = d.split(/(?= [LC] )/).slice(1);
      segs.forEach((seg) => {
        acc += seg;
        probe.setAttribute('d', acc);
        svg.append(probe);
        lens.push(probe.getTotalLength());
        probe.remove();
      });
    }
    const at = (len) => {
      const p = main.getPointAtLength(len);
      return [p.x, p.y];
    };

    const size = Math.min(W / cols, H / rows);
    board.style.setProperty('--stop', size * 0.6 + 'px');
    board.style.setProperty('--step', Math.max(10, size * 0.16) + 'px');

    // Posición del personaje: partidos ganados dentro de esta página
    let walkerAt = null;
    const place = (x, y, el) => {
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      board.append(el);
      return el;
    };

    // Salida
    place(...pts[0], h('span', { class: 'tm-start emoji' }, page === 0 ? look.start : '🏆'));
    if (won <= startWins) walkerAt = pts[0];

    let from = startWins;
    list.forEach((t, k) => {
      const gap = t.wins - from;
      // Casilleros intermedios
      for (let j = 1; j < gap; j++) {
        const w = from + j;
        const [x, y] = at(lens[k] + (lens[k + 1] - lens[k]) * (j / gap));
        place(x, y, h('span', { class: 'tm-step' + (won >= w ? ' on' : '') }, won >= w ? h('span', { class: 'emoji' }, look.dot) : ''));
        if (won === w) walkerAt = [x, y];
      }
      // Trofeo
      const have = won >= t.wins;
      const isNext = !have && (k === 0 ? won >= from : won >= list[k - 1].wins);
      const stop = h('button', {
        class: 'tm-stop' + (have ? ' have' : '') + (isNext ? ' next' : ''),
        'aria-label': have ? BQ.trophies.title(t) : 'Trofeo bloqueado',
        onpointerdown: ui.tap(() => {
          if (have) return showBig(t);
          const left = t.wins - won;
          BQ.sfx.tap();
          voice.say(left === 1 ? 'Ganá un partido más para conseguirlo.' : `Ganá ${left} partidos más para conseguirlo.`);
        }),
      }, BQ.trophies.el(t), !have && h('span', { class: 'tm-need' }, String(t.wins)));
      place(...pts[k + 1], stop);
      if (won === t.wins || (k === list.length - 1 && won > t.wins)) walkerAt = pts[k + 1];
      from = t.wins;
    });

    if (walkerAt) {
      const walker = place(...walkerAt, h('span', { class: 'tm-walker' }, BQ.puppet.el(store.data.character)));
      walker.animate([{ translate: '-50% -130%' }, { translate: '-50% -100%' }], { duration: 500, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    }
  }

  // Trofeo en grande, girando como una moneda. Tocarlo lo hace girar más rápido y largar brillitos.
  function showBig(t) {
    const ui = BQ.ui;
    const voice = BQ.voice;
    const sfx = BQ.sfx;
    const chime = () => sfx.notes([[1568, 0, 0.12, 'sine', 0.08], [2093, 0.08, 0.12, 'sine', 0.08], [2637, 0.16, 0.25, 'sine', 0.08]]);
    const spinner = h('div', { class: 'trophy-spin' }, BQ.trophies.el(t, 'trophy-spin-art'));
    const stage = h('button', {
      class: 'trophy-view-stage',
      'aria-label': BQ.trophies.title(t),
      onpointerdown: ui.tap((e) => {
        e.stopPropagation();
        spinner.classList.remove('fast');
        void spinner.offsetWidth;
        spinner.classList.add('fast');
        chime();
        ui.burst(stage);
        voice.say(U.cap(t.name));
      }),
    }, spinner);
    const close = () => view.remove();
    const view = h('div', { class: 'trophy-view', onpointerdown: ui.tap(close) },
      h('div', { class: 'party-rays' }),
      h('button', { class: 'btn-round trophy-view-close', 'aria-label': 'Cerrar', onpointerdown: ui.tap(close) }, h('span', { class: 'emoji' }, '✖️')),
      stage,
      h('p', { class: 'trophy-view-name' }, BQ.trophies.title(t)),
      h('p', { class: 'trophy-view-hint' }, '¡Tocalo para hacerlo girar!'));
    document.getElementById('app').append(view);
    chime();
    voice.say(`¡${U.cap(t.name)}!`);
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
