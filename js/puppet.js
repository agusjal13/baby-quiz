(function (BQ) {
  'use strict';

  /*
   * Personajes de cuerpo entero dibujados en SVG, con partes que se mueven.
   * Lienzo de 100 x 140: cabeza centrada en (50, 40), hombros en y=70, manos en y=90, pies en y=121.
   * Las capas se dibujan de atrás hacia adelante: espalda, piernas, cuerpo, brazo izquierdo,
   * cabeza, cuello y brazo derecho (el que sostiene las cosas).
   */

  const OUT = '#2b2140';
  const S = `stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"`;
  const EMOJI_FONT = '&quot;Segoe UI Emoji&quot;, &quot;Apple Color Emoji&quot;, &quot;Noto Color Emoji&quot;, sans-serif';
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

  // Brazo o pierna: línea gruesa con borde
  const limb = (x1, y1, x2, y2, color, w) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${OUT}" stroke-width="${w + 2.6}" stroke-linecap="round"/>`
    + `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
  const emoji = (e, x, y, size) => `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="central" font-family="${EMOJI_FONT}">${e}</text>`;

  // Cara
  const eyes = (y = 42) => `<g class="pp-eyes" style="transform-origin: 50px ${y}px">`
    + `<ellipse cx="41" cy="${y}" rx="3.4" ry="4.4" fill="${OUT}"/><ellipse cx="59" cy="${y}" rx="3.4" ry="4.4" fill="${OUT}"/>`
    + `<circle cx="42.3" cy="${y - 1.7}" r="1.3" fill="#fff"/><circle cx="60.3" cy="${y - 1.7}" r="1.3" fill="#fff"/></g>`;
  const cheeks = (y = 49) => `<ellipse cx="35" cy="${y}" rx="4" ry="2.6" fill="#ff8a9a" opacity=".55"/><ellipse cx="65" cy="${y}" rx="4" ry="2.6" fill="#ff8a9a" opacity=".55"/>`;
  const smile = (y = 52) => `<path d="M44 ${y} Q50 ${y + 5} 56 ${y}" fill="none" stroke="${OUT}" stroke-width="2.4" stroke-linecap="round"/>`;
  const face = (y = 42) => eyes(y) + cheeks(y + 7) + smile(y + 10);
  const headCircle = (fill) => `<circle cx="50" cy="40" r="24" fill="${fill}" ${S}/>`;

  const TORSO = 'M35 73 Q35 65 43 64 L57 64 Q65 65 65 73 L67 100 Q50 105 33 100 Z';
  const DRESS = 'M38 71 Q38 64 44 63 L56 63 Q62 64 62 71 L75 110 Q50 118 25 110 Z';
  const ROBOT_TORSO = 'M33 69 Q33 63 39 63 L61 63 Q67 63 67 69 L67 93 Q67 99 61 99 L39 99 Q33 99 33 93 Z';

  // ---------- Los personajes ----------
  const SKIN = '#ffd9b3';
  const TAN = '#f5c89a';

  const LOOKS = {
    mago: {
      torso: '#3f6fd8', dress: true, sleeve: '#3f6fd8', hands: SKIN, pants: '#3f6fd8', shoes: '#8d5a3b',
      head: headCircle(SKIN) + eyes(42) + cheeks(49)
        + `<path d="M35 35 Q40 32 46 35 M54 35 Q60 32 65 35" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`
        + `<path d="M27 44 Q28 72 50 80 Q72 72 73 44 Q66 54 58 52 Q50 58 42 52 Q34 54 27 44 Z" fill="#fff" ${S}/>`
        + `<path d="M40 52 Q45 48 50 52 Q55 48 60 52 Q55 56 50 54 Q45 56 40 52 Z" fill="#fff" ${S}/>`
        + `<path d="M28 23 L52 -14 Q57 -18 60 -12 L72 23 Z" fill="#3f6fd8" ${S}/>`
        + `<ellipse cx="50" cy="23" rx="30" ry="6" fill="#3f6fd8" ${S}/>`
        + `<polygon points="${star(53, 4, 6, 2.5)}" fill="#ffd23f"/><circle cx="42" cy="13" r="1.8" fill="#ffd23f"/><circle cx="61" cy="15" r="1.5" fill="#ffd23f"/>`,
      anchors: { head: [50, -20, 20] },
    },
    dragon: {
      torso: '#5cbf60', belly: '#c9ef9a', sleeve: '#5cbf60', hands: '#5cbf60', pants: '#5cbf60', shoes: '#3e8e41',
      back: `<path d="M38 72 L10 54 L16 70 L6 80 L32 88 Z" fill="#ff7043" ${S}/><path d="M62 72 L90 54 L84 70 L94 80 L68 88 Z" fill="#ff7043" ${S}/>`
        + `<path d="M58 100 Q86 112 92 90 Q98 118 64 116 Z" fill="#5cbf60" ${S}/>`,
      headBack: `<path d="M36 23 L29 5 L44 18 Z" fill="#ffd23f" ${S}/><path d="M64 23 L71 5 L56 18 Z" fill="#ffd23f" ${S}/>`,
      head: headCircle('#5cbf60') + eyes(37) + cheeks(45)
        + `<ellipse cx="50" cy="52" rx="15" ry="10" fill="#8ad884" ${S}/>`
        + `<circle cx="45" cy="49" r="1.6" fill="${OUT}"/><circle cx="55" cy="49" r="1.6" fill="${OUT}"/>` + smile(54),
      anchors: { head: [50, 12, 22] },
      idle: 'fire',
    },
    futbolista: {
      torso: '#f4f4f4', sleeve: '#f4f4f4', hands: TAN, pants: '#263238', shoes: '#e53935', ball: true,
      chest: `<text x="50" y="88" font-size="15" font-weight="900" text-anchor="middle" fill="#43a047" font-family="Arial, sans-serif">10</text>`,
      head: headCircle(TAN)
        + `<path d="M26 38 Q24 12 50 13 Q76 12 74 38 Q70 26 60 25 Q54 31 44 26 Q34 26 26 38 Z" fill="#6d4c2f" ${S}/>` + face(),
      // De espaldas (para ver el nombre y el número): la cabeza es puro pelo
      headBackView: headCircle(TAN)
        + `<path d="M26 44 Q22 12 50 13 Q78 12 74 44 Q64 55 50 55 Q36 55 26 44 Z" fill="#6d4c2f" ${S}/>`,
      anchors: { head: [50, 12, 22] },
      idle: 'kick',
    },
    princesa: {
      torso: '#ff80ab', dress: true, sleeve: '#ff80ab', hands: SKIN, pants: SKIN, shoes: '#ff4f8b',
      headBack: `<path d="M24 40 Q20 12 50 13 Q80 12 76 40 L80 76 Q70 82 62 74 L38 74 Q30 82 20 76 Z" fill="#c8873a" ${S}/>`,
      head: headCircle(SKIN)
        + `<path d="M27 36 Q28 15 50 15 Q72 15 73 36 Q64 24 52 27 Q40 22 27 36 Z" fill="#c8873a" ${S}/>`
        + `<path d="M37 18 L39 4 L45 12 L50 1 L55 12 L61 4 L63 18 Z" fill="#ffd23f" ${S}/><circle cx="50" cy="12" r="2.2" fill="#e53935"/>`
        + eyes() + cheeks() + `<path d="M45 52 Q50 57 55 52" fill="#ff6f91" stroke="${OUT}" stroke-width="2.2" stroke-linejoin="round"/>`,
      anchors: { head: [69, 17, 17] },
      idle: 'shine',
    },
    unicornio: {
      torso: '#ffffff', sleeve: '#ffffff', hands: '#b39ddb', pants: '#ffffff', shoes: '#b39ddb',
      back: `<path d="M58 100 Q84 104 86 84 Q96 108 70 116 Q62 112 58 100 Z" fill="#ce93d8" ${S}/>`,
      headBack: `<path d="M32 26 L30 7 L43 19 Z" fill="#ffffff" ${S}/><path d="M68 26 L70 7 L57 19 Z" fill="#ffffff" ${S}/>`,
      head: headCircle('#ffffff') + eyes(39) + cheeks(46)
        + `<ellipse cx="50" cy="53" rx="14" ry="9.5" fill="#ffe0ec" ${S}/>`
        + `<circle cx="45" cy="51" r="1.5" fill="${OUT}"/><circle cx="55" cy="51" r="1.5" fill="${OUT}"/>`
        + `<path d="M46 57 Q50 59 54 57" fill="none" stroke="${OUT}" stroke-width="2" stroke-linecap="round"/>`
        + `<path d="M38 24 Q48 10 62 19 Q56 21 54 28 Q50 22 46 28 Q44 22 38 24 Z" fill="#f48fb1" ${S}/>`
        + `<path d="M45 20 L50 -6 L55 20 Z" fill="#ffd23f" ${S}/><path d="M46.5 12 L53.5 9 M47.5 5 L52.5 3" stroke="#f0a500" stroke-width="1.6"/>`,
      anchors: { head: [32, 20, 17] },
      idle: 'shine',
    },
    duende: {
      torso: '#66bb6a', sleeve: '#66bb6a', hands: SKIN, pants: '#8d5a3b', shoes: '#6d4c2f',
      chest: `<rect x="33" y="89" width="34" height="5" fill="#6d4c2f"/><rect x="46" y="88" width="8" height="7" rx="1" fill="#ffd23f" ${S}/>`,
      headBack: `<path d="M28 38 L9 30 L28 48 Z" fill="${SKIN}" ${S}/><path d="M72 38 L91 30 L72 48 Z" fill="${SKIN}" ${S}/>`,
      head: headCircle(SKIN)
        + `<path d="M28 34 Q34 26 44 30 Q50 24 56 30 Q66 26 72 34 L72 27 L28 27 Z" fill="#ffcc4d" ${S}/>`
        + `<path d="M24 28 Q50 19 76 28 L56 -12 Q52 -17 49 -10 Z" fill="#43a047" ${S}/>`
        + `<path d="M24 28 Q50 20 76 28 Q50 35 24 28 Z" fill="#2e7d32" ${S}/>` + face(),
      anchors: { head: [64, 12, 17] },
    },
    hada: {
      torso: '#7ee0b5', dress: true, sleeve: SKIN, hands: SKIN, pants: SKIN, shoes: '#43a047',
      back: `<ellipse cx="30" cy="74" rx="13" ry="20" fill="#b3e5fc" ${S} transform="rotate(-35 30 74)"/>`
        + `<ellipse cx="70" cy="74" rx="13" ry="20" fill="#b3e5fc" ${S} transform="rotate(35 70 74)"/>`
        + `<ellipse cx="33" cy="94" rx="8" ry="12" fill="#e1f5fe" ${S} transform="rotate(30 33 94)"/>`
        + `<ellipse cx="67" cy="94" rx="8" ry="12" fill="#e1f5fe" ${S} transform="rotate(-30 67 94)"/>`,
      headBack: `<circle cx="50" cy="13" r="10" fill="#ffcc4d" ${S}/><path d="M26 40 Q22 14 50 16 Q78 14 74 40 L74 56 L26 56 Z" fill="#ffcc4d" ${S}/>`,
      head: headCircle(SKIN)
        + `<path d="M27 36 Q30 17 50 17 Q70 17 73 36 Q60 26 50 30 Q40 26 27 36 Z" fill="#ffcc4d" ${S}/>` + face(),
      anchors: { head: [70, 20, 16] },
      idle: 'shine',
    },
    dinosaurio: {
      torso: '#4fb3a9', belly: '#c8f0e6', sleeve: '#4fb3a9', hands: '#4fb3a9', pants: '#4fb3a9', shoes: '#2f8f86',
      back: `<path d="M58 100 Q90 110 96 88 Q100 118 64 116 Z" fill="#4fb3a9" ${S}/>`,
      headBack: `<path d="M38 20 L42 7 L47 17 L52 4 L57 17 L61 8 L64 21 Z" fill="#ff8a65" ${S}/>`,
      head: headCircle('#4fb3a9') + eyes(36) + cheeks(44)
        + `<ellipse cx="50" cy="52" rx="19" ry="12" fill="#6cc9bf" ${S}/>`
        + `<circle cx="44" cy="48" r="1.6" fill="${OUT}"/><circle cx="56" cy="48" r="1.6" fill="${OUT}"/>` + smile(54),
      anchors: { head: [50, 13, 22] },
      idle: 'fire',
    },
    robot: {
      torso: '#b0bec5', robot: true, sleeve: '#b0bec5', hands: '#78909c', pants: '#78909c', shoes: '#546e7a',
      chest: `<circle cx="43" cy="75" r="3.2" fill="#ffd23f" ${S}/><circle cx="57" cy="75" r="3.2" fill="#43a047" ${S}/><rect x="40" y="84" width="20" height="6" rx="2" fill="#78909c"/>`,
      head: `<line x1="50" y1="18" x2="50" y2="7" stroke="${OUT}" stroke-width="2.6"/><circle cx="50" cy="5" r="4" fill="#e53935" ${S}/>`
        + `<rect x="21" y="33" width="8" height="13" rx="2" fill="#78909c" ${S}/><rect x="71" y="33" width="8" height="13" rx="2" fill="#78909c" ${S}/>`
        + `<rect x="27" y="18" width="46" height="42" rx="9" fill="#b0bec5" ${S}/>`
        + `<rect x="32" y="28" width="36" height="18" rx="7" fill="#263238" ${S}/>`
        + `<g class="pp-eyes" style="transform-origin: 50px 37px"><circle cx="42" cy="37" r="4" fill="#4dd0e1"/><circle cx="58" cy="37" r="4" fill="#4dd0e1"/></g>`
        + `<rect x="42" y="50" width="16" height="4" rx="2" fill="#78909c"/>`,
      anchors: { head: [50, 8, 22], neck: [50, 63] },
    },
    superheroe: {
      torso: '#1e88e5', sleeve: '#1e88e5', hands: '#e53935', pants: '#1e88e5', shoes: '#e53935',
      chest: `<polygon points="${star(50, 80, 8, 3.5)}" fill="#ffd23f" ${S}/><rect x="33" y="94" width="34" height="4" fill="#ffd23f"/>`,
      head: headCircle(TAN)
        + `<path d="M26 36 Q24 12 50 13 Q76 12 74 36 Q66 22 50 24 Q34 22 26 36 Z" fill="#4e342e" ${S}/>`
        + `<path d="M27 36 Q50 31 73 36 L72 47 Q60 43 50 46 Q40 43 28 47 Z" fill="#1e88e5" ${S}/>`
        + `<ellipse cx="41" cy="41" rx="5" ry="4" fill="#fff"/><ellipse cx="59" cy="41" rx="5" ry="4" fill="#fff"/>`
        + eyes(41) + cheeks(50) + smile(53),
      anchors: { head: [50, 12, 22], neck: [50, 68] },
    },
    gatito: {
      torso: '#ffb74d', belly: '#ffffff', sleeve: '#ffb74d', hands: '#ffffff', pants: '#ffb74d', shoes: '#ffffff',
      back: `<path d="M60 102 Q86 100 84 80 Q82 70 90 70 Q96 80 90 96 Q84 112 62 110 Z" fill="#ffb74d" ${S}/>`,
      headBack: `<path d="M30 30 L27 7 L46 20 Z" fill="#ffb74d" ${S}/><path d="M70 30 L73 7 L54 20 Z" fill="#ffb74d" ${S}/>`
        + `<path d="M31 24 L30 13 L39 20 Z" fill="#ff8a9a"/><path d="M69 24 L70 13 L61 20 Z" fill="#ff8a9a"/>`,
      head: headCircle('#ffb74d')
        + `<path d="M44 17 L46 25 M50 16 L50 25 M56 17 L54 25" stroke="#f57c00" stroke-width="2.6" stroke-linecap="round"/>`
        + `<ellipse cx="44" cy="52" rx="7" ry="5.5" fill="#fff"/><ellipse cx="56" cy="52" rx="7" ry="5.5" fill="#fff"/>`
        + `<path d="M47 47 L53 47 L50 51 Z" fill="#ff8a9a" ${S}/>` + eyes(40) + cheeks(47)
        + `<path d="M30 50 L17 48 M30 54 L17 57 M70 50 L83 48 M70 54 L83 57" stroke="${OUT}" stroke-width="1.6" stroke-linecap="round"/>`
        + `<path d="M46 55 Q48 58 50 55 Q52 58 54 55" fill="none" stroke="${OUT}" stroke-width="2" stroke-linecap="round"/>`,
      anchors: { head: [65, 16, 17] },
    },
  };

  const DEFAULT_ANCHORS = { head: [50, 12, 22], neck: [50, 66] };

  // ---------- Ropa puesta ----------

  const ART = {
    baston: { vb: '0 0 40 120', at: [64, 54, 13, 40], body: () => BQ.wardrobe.ART.baston },
    varita: { vb: '0 0 50 120', at: [63, 64, 15, 36], body: () => BQ.wardrobe.ART.varita },
  };
  const inner = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

  // Nombre (arriba, chiquito) y número (grande) en la espalda, del color que contraste con la camiseta.
  // Contraste entre dos colores "#rrggbb" (1 = iguales, 21 = blanco contra negro)
  function contrast(c1, c2) {
    const lum = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const v = parseInt(hex.slice(i, i + 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [hi, lo] = [lum(c1), lum(c2)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  // Color de las letras según la camiseta: blanco u oscuro, el que mejor se lea sobre TODOS los colores
  // que quedan detrás (en las rayadas o de dos colores, los dos). El borde va del color opuesto.
  function printColors(shirt, torso) {
    const behind = !shirt ? [torso]
      : ['solid', 'trim'].includes(shirt.kind) ? [shirt.a] : [shirt.a, shirt.b];
    const WHITE = '#ffffff';
    const DARK = '#1a1a2e';
    const worst = (c) => Math.min(...behind.map((bg) => contrast(c, bg)));
    return worst(WHITE) >= worst(DARK) ? { fill: WHITE, edge: DARK } : { fill: DARK, edge: WHITE };
  }

  function backPrint(shirt, torso) {
    const { fill, edge } = printColors(shirt, torso);
    const j = BQ.store.data.jersey || {};
    const name = String(j.name || '').toUpperCase().slice(0, 10);
    const number = String(j.number || '').slice(0, 2);
    const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const style = `text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" fill="${fill}" stroke="${edge}" stroke-linejoin="round" paint-order="stroke"`;
    return (name ? `<text x="50" y="74" font-size="${Math.min(6.4, 30 / name.length)}" stroke-width="1.5" ${style}>${esc(name)}</text>` : '')
      + (number ? `<text x="50" y="${name ? 93 : 90}" font-size="${name ? 17 : 21}" stroke-width="2" ${style}>${esc(number)}</text>` : '');
  }

  function shirtSvg(j, id, back) {
    let design = '';
    if (j.kind === 'stripes') design = [36, 44, 52, 60].map((x) => `<rect x="${x}" y="60" width="4" height="50" fill="${j.b}"/>`).join('');
    if (j.kind === 'hstripes') design = [70, 80, 90, 100].map((y) => `<rect x="28" y="${y}" width="44" height="5" fill="${j.b}"/>`).join('');
    // Mitad y mitad (a = izquierda mirando de frente), con estrella en el corazón (derecha mirando de frente)
    // (de espaldas, los colores quedan del otro lado y no hay estrella ni escudo)
    if (j.kind === 'split') {
      design = back
        ? `<rect x="28" y="60" width="22" height="50" fill="${j.b}"/>`
        : `<rect x="50" y="60" width="22" height="50" fill="${j.b}"/><polygon points="${star(57.5, 75, 4.6, 1.9)}" fill="${j.star}"/>`;
    }
    if (j.kind === 'band') design = `<rect x="30" y="77" width="40" height="10" fill="${j.b}"/>`;
    // Blanca con detalles: costados y ruedo de otro color
    if (j.kind === 'trim') design = `<rect x="28" y="60" width="6" height="50" fill="${j.b}"/><rect x="66" y="60" width="6" height="50" fill="${j.b}"/><rect x="28" y="95" width="44" height="15" fill="${j.b}"/>`;
    if (j.kind === 'diagonal') design = `<path d="M28 68 L37 60 L72 97 L63 106 Z" fill="${j.b}"/>`;
    // Escudito en el corazón (derecha mirando de frente)
    if (j.crest && !back) design += `<path d="M51.5 70 Q55.5 68.6 59.5 70 L59.5 74.5 Q59.5 79 55.5 81 Q51.5 79 51.5 74.5 Z" fill="${j.crest}" stroke="#1b7f76" stroke-width="1"/>`;
    return `<defs><clipPath id="pp-shirt-${id}"><path d="${TORSO}"/></clipPath></defs>`
      + `<g clip-path="url(#pp-shirt-${id})"><rect x="28" y="60" width="44" height="50" fill="${j.a}"/>${design}</g>`
      + `<path d="${TORSO}" fill="none" ${S}/>`;
  }

  function itemSvg(item, look) {
    const anchors = Object.assign({}, DEFAULT_ANCHORS, look.anchors);
    switch (item.slot) {
      case 'head': {
        const [x, y, size] = anchors.head;
        return emoji(item.emoji, x, y, size);
      }
      case 'neck': {
        const [x, y] = anchors.neck;
        if (item.bow) return `<svg x="${x - 10}" y="${y - 6}" width="20" height="12" viewBox="0 0 100 60">${inner(BQ.wardrobe.ART.corbatita(...item.bow))}</svg>`;
        return emoji(item.emoji, x, y + (item.low ? 6 : 1), item.size || 13);
      }
      case 'hand': {
        const art = item.art && ART[item.art];
        if (art) {
          const [x, y, w, h] = art.at;
          return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${art.vb}" class="pp-tip">${inner(art.body())}</svg>`;
        }
        // Trofeo del mapa de trofeos, levantado en la mano
        if (item.trophy) return `<svg x="60" y="57" width="27" height="35" viewBox="0 0 100 130">${inner(BQ.trophies.art(BQ.wardrobe.trophyOf(item)))}</svg>`;
        return emoji(item.emoji, 75, item.high ? 70 : 88, item.size || 20);
      }
      case 'back':
        // Arco de fútbol detrás del personaje
        if (item.goal) return `<svg x="-2" y="42" width="104" height="84" viewBox="0 0 100 80" overflow="visible">${inner(BQ.wardrobe.ART.arco(item.goal.post, item.goal.net))}</svg>`;
        if (item.cape) {
          return `<path d="M35 67 Q50 74 65 67 L79 121 Q50 129 21 121 Z" fill="${item.cape}" ${S}/>`
            + `<polygon points="${star(50, 108, 6, 2.5)}" fill="rgba(255,255,255,.7)"/>`;
        }
        return emoji(item.emoji, 50, 46, 84);
      default:
        return '';
    }
  }

  // ---------- Armado del personaje ----------

  // back: de espaldas (solo los personajes con "headBackView"; por ahora, el futbolista)
  function build(charId, items, back) {
    const look = LOOKS[charId] || LOOKS.mago;
    const bySlot = {};
    items.forEach((it) => { bySlot[it.slot] = it; });
    const id = ++uid;
    const shirt = bySlot.body && bySlot.body.jersey;
    back = !!back && !!look.headBackView;
    let sleeve = shirt ? shirt.sleeve : look.sleeve;
    let sleeveL = shirt && shirt.sleeveL ? shirt.sleeveL : sleeve; // camisetas con una manga de cada color
    if (back) [sleeve, sleeveL] = [sleeveL, sleeve]; // de espaldas, las mangas quedan cambiadas de lado
    // Zapatos, o botines con raya y tapones si tiene puestos
    const boots = bySlot.feet && bySlot.feet.boots;
    const shoe = (x) => (boots
      ? `<ellipse cx="${x}" cy="121" rx="8" ry="4.8" fill="${boots.fill}" ${S}/>`
        + `<path d="M${x - 4} 119.5 L${x + 3} 122.5" stroke="${boots.stripe}" stroke-width="1.8" stroke-linecap="round"/>`
        + (boots.sole ? `<path d="M${x - 7} 123.4 Q${x} 126.6 ${x + 7} 123.4" fill="none" stroke="${boots.sole}" stroke-width="1.8" stroke-linecap="round"/>` : '')
        + [-4, 0, 4].map((d) => `<rect x="${x + d - 1}" y="125" width="2" height="2.4" rx=".6" fill="${OUT}"/>`).join('')
      : `<ellipse cx="${x}" cy="121" rx="7.5" ry="4.8" fill="${look.shoes}" ${S}/>`);

    // Short: las piernas quedan al aire (color de piel) y el short va encima, en la cadera
    const sh = bySlot.shorts && bySlot.shorts.shorts;
    const legColor = sh ? look.hands : look.pants;
    const shortsSvg = sh
      ? `<path d="M35.5 95 L64.5 95 L66.5 111.5 L52.5 111.5 L50 105 L47.5 111.5 L33.5 111.5 Z" fill="${sh.fill}" ${S}/>`
        + `<path d="M37.4 101 L36.4 109.2 M62.6 101 L63.6 109.2" stroke="${sh.stripe}" stroke-width="1.6" stroke-linecap="round"/>`
      : '';
    // Canilleras: una en cada pierna, con dos rayitas
    const sg = bySlot.shin && bySlot.shin.shin;
    const shinPad = (x) => (sg
      ? `<rect x="${x - 3.9}" y="109.5" width="7.8" height="8.6" rx="2.8" fill="${sg.fill}" ${S}/>`
        + `<path d="M${x - 2} 112.4 L${x + 2} 112.4 M${x - 2} 115.2 L${x + 2} 115.2" stroke="${sg.stripe}" stroke-width="1.3" stroke-linecap="round"/>`
      : '');
    // Guantes de arquero: manos más grandes, del color del guante
    const gl = bySlot.gloves && bySlot.gloves.gloves;
    const hand = (x) => (gl
      ? `<circle cx="${x}" cy="90.5" r="6.6" fill="${gl.fill}" ${S}/><circle cx="${x}" cy="90.5" r="2.4" fill="${gl.stripe}"/>`
        + `<path d="M${x - 4.4} 85.6 L${x + 4.4} 85.6" stroke="${gl.stripe}" stroke-width="1.8" stroke-linecap="round"/>`
      : `<circle cx="${x}" cy="90" r="5" fill="${look.hands}" ${S}/>`);
    // Cono de entrenamiento, en el piso al lado del otro pie
    const cone = bySlot.ground && bySlot.ground.cone
      ? `<g class="pp-cone"><path d="M27 109 L32.6 124.5 L21.4 124.5 Z" fill="#ff7a00" ${S}/><path d="M24.6 116.5 L29.4 116.5 L30.8 120.3 L23.2 120.3 Z" fill="#fff"/>`
        + `<rect x="19" y="124" width="16" height="3.6" rx="1.4" fill="#ff7a00" ${S}/></g>`
      : '';

    const torso = look.robot
      ? `<path d="${ROBOT_TORSO}" fill="${look.torso}" ${S}/>`
      : `<path d="${look.dress ? DRESS : TORSO}" fill="${look.torso}" ${S}/>`;
    const belly = look.belly ? `<ellipse cx="50" cy="86" rx="10" ry="13" fill="${look.belly}"/>` : '';
    // Pelota en el pie (futbolista): solo si tiene puesta una de la tienda (lugar "ball"; la común es gratis)
    const ball = look.ball && bySlot.ball
      ? `<g class="pp-ball"><svg x="62" y="116" width="14" height="14" viewBox="0 0 100 100">${inner(BQ.wardrobe.ART[bySlot.ball.art])}</svg></g>`
      : '';

    return `<svg class="pp" viewBox="0 0 100 140" overflow="visible" aria-hidden="true">`
      + `<ellipse class="pp-shadow" cx="50" cy="127" rx="22" ry="4" fill="rgba(0,0,0,.14)"/>`
      + `<g class="pp-all">`
      + `<g class="pp-back">${look.back || ''}${bySlot.back ? `<g class="pp-bitem">${itemSvg(bySlot.back, look)}</g>` : ''}</g>`
      + `<g class="pp-leg pp-leg-l">${limb(45, 98, 44, 117, legColor, 9)}${shinPad(44.3)}${shoe(42.5)}</g>`
      + `<g class="pp-leg pp-leg-r">${limb(55, 98, 56, 117, legColor, 9)}${shinPad(55.7)}${shoe(57.5)}</g>`
      + shortsSvg
      + cone
      + ball
      + `<g class="pp-body">${torso}${belly}${back ? '' : look.chest || ''}${shirt ? shirtSvg(shirt, id, back) : ''}${back ? backPrint(shirt, look.torso) : ''}</g>`
      + `<g class="pp-arm pp-arm-l">${limb(37, 70, 30, 89, sleeveL, 8)}${hand(30)}</g>`
      + `<g class="pp-head">${look.headBack || ''}${back ? look.headBackView : look.head}${bySlot.head ? `<g class="pp-hditem">${itemSvg(bySlot.head, look)}</g>` : ''}</g>`
      + (bySlot.neck ? `<g class="pp-nitem">${itemSvg(bySlot.neck, look)}</g>` : '')
      + `<g class="pp-arm pp-arm-r">${limb(63, 70, 70, 89, sleeve, 8)}`
      // Cinta de capitán en el brazo izquierdo de quien la lleva (a la derecha mirándolo de frente)
      + (bySlot.arm ? `<g transform="translate(65.3 76.3) rotate(-20)"><rect x="-5.6" y="-2.6" width="11.2" height="5.2" rx="1.2" fill="${bySlot.arm.armband}" ${S}/>`
        + `<path d="M1.4 -1.2 Q0 -1.9 -1 -1.1 Q-1.8 0 -1 1.1 Q0 1.9 1.4 1.2" fill="none" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></g>` : '')
      + (bySlot.hand ? `<g class="pp-hitem">${itemSvg(bySlot.hand, look)}</g>` : '')
      + `${hand(70)}</g>`
      + `</g></svg>`;
  }

  // ---------- Acciones ("usar" lo que tiene puesto) ----------

  const USE_MS = { magic: 1400, raise: 1400, block: 1100, hop: 900, wiggle: 900, spin: 1000, flutter: 1200, kick: 1100, fire: 1100, wave: 1400, shine: 1000 };
  const DEFAULT_USE = { head: 'hop', neck: 'wiggle', hand: 'raise', body: 'spin', back: 'flutter', ball: 'kick', feet: 'kick' };

  function spawn(char, x, y, count, spread, size) {
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = 'pp-fx';
      el.textContent = char;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.fontSize = size + 'px';
      document.body.append(el);
      const a = spread.angle + (Math.random() - 0.5) * spread.width;
      const d = spread.dist * (0.6 + Math.random() * 0.6);
      el.animate([
        { transform: 'translate(-50%, -50%) scale(.4)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(1.1)`, opacity: 0 },
      ], { duration: 700 + Math.random() * 400, delay: i * 60, easing: 'ease-out', fill: 'backwards' }).onfinish = () => el.remove();
    }
  }

  // Punto del lienzo (100x140) en coordenadas de pantalla
  function pagePoint(svg, x, y) {
    const r = svg.getBoundingClientRect();
    return [r.left + (x / 100) * r.width, r.top + (y / 140) * r.height, r.width];
  }

  function effects(svg, kind) {
    const sfx = BQ.sfx;
    if (kind === 'magic') {
      setTimeout(() => {
        const tip = svg.querySelector('.pp-hitem');
        if (!tip) return;
        const r = tip.getBoundingClientRect();
        spawn('✨', r.left + r.width / 2, r.top, 7, { angle: -Math.PI / 2, width: Math.PI * 1.4, dist: r.height * 1.2 }, r.height * 0.45);
        sfx.notes([[1568, 0, 0.12, 'sine', 0.08], [2093, 0.08, 0.12, 'sine', 0.08], [2637, 0.16, 0.25, 'sine', 0.08]]);
      }, 380);
    } else if (kind === 'shine') {
      setTimeout(() => {
        const [x, y, w] = pagePoint(svg, 50, 0);
        spawn('✨', x, y, 6, { angle: -Math.PI / 2, width: Math.PI * 1.2, dist: w * 0.6 }, w * 0.22);
        sfx.notes([[1568, 0, 0.12, 'sine', 0.08], [2093, 0.08, 0.2, 'sine', 0.08]]);
      }, 250);
    } else if (kind === 'fire') {
      setTimeout(() => {
        const [x, y, w] = pagePoint(svg, 62, 54);
        spawn('🔥', x, y, 6, { angle: 0, width: 0.6, dist: w * 0.9 }, w * 0.24);
        sfx.pop();
      }, 300);
    } else if (kind === 'kick') {
      setTimeout(() => sfx.pop(), 250);
    } else if (kind === 'spin' || kind === 'flutter') {
      sfx.whee();
    } else {
      sfx.tap();
    }
  }

  BQ.puppet = {
    has: (charId) => !!LOOKS[charId],
    kindFor: (item) => item.use || DEFAULT_USE[item.slot],

    // Personaje con su ropa. Tocarlo lo hace usar sus cosas (o su gesto propio).
    // wornIds: ropa de otro jugador (bingo online); si no se pasa, la guardada en este dispositivo.
    // opts.back: de espaldas, con el nombre y el número de la camiseta
    canTurn: (charId) => !!(LOOKS[charId] && LOOKS[charId].headBackView),
    el(charId, wornIds, opts) {
      const items = wornIds
        ? BQ.wardrobe.items(charId).filter((it) => wornIds.includes(it.id))
        : BQ.wardrobe.wornItems(charId);
      const wrap = document.createElement('span');
      wrap.className = 'avatar';
      wrap.innerHTML = build(charId, items, opts && opts.back);
      const look = LOOKS[charId] || {};
      const uses = items.map((it) => this.kindFor(it));
      uses.push(look.idle || 'wave');
      wrap.dataset.uses = uses.join(',');
      return wrap;
    },

    // Hace la siguiente acción de la lista (va rotando en cada toque)
    use(wrap, kind) {
      const svg = wrap && wrap.querySelector('.pp');
      if (!svg || svg.dataset.busy) return;
      const uses = (wrap.dataset.uses || 'wave').split(',');
      const i = Number(wrap.dataset.useIndex || 0);
      const k = kind || uses[i % uses.length];
      wrap.dataset.useIndex = String(i + 1);
      svg.dataset.busy = '1';
      svg.classList.add('use-' + k);
      effects(svg, k);
      setTimeout(() => {
        svg.classList.remove('use-' + k);
        delete svg.dataset.busy;
      }, USE_MS[k] || 1200);
    },
  };
})(window.BQ);
