(function (BQ) {
  'use strict';

  const h = BQ.util.h;

  function star(cx, cy, R, r) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? R : r;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
    }
    return pts.join(' ');
  }

  // Dibujos propios para lo que no existe como emoji (se usan en la tienda y sobre el personaje)
  const ART = {
    baston: '<svg viewBox="0 0 40 120"><rect x="16" y="34" width="8" height="84" rx="4" fill="#8d5a3b" stroke="#5d3a22" stroke-width="2"/>'
      + '<circle cx="20" cy="22" r="17" fill="#b388ff" stroke="#6a3de8" stroke-width="3"/>'
      + `<polygon points="${star(20, 23, 11, 5)}" fill="#fff59d"/></svg>`,
    varita: '<svg viewBox="0 0 50 120"><rect x="21" y="40" width="7" height="78" rx="3" fill="#ff80ab" stroke="#c2185b" stroke-width="2"/>'
      + `<polygon points="${star(25, 24, 23, 10)}" fill="#ffd23f" stroke="#f0a500" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
    corbatita: (c, dark) => `<svg viewBox="0 0 100 60"><path d="M50 30 L8 5 Q0 30 8 55 Z" fill="${c}" stroke="${dark}" stroke-width="3" stroke-linejoin="round"/>`
      + `<path d="M50 30 L92 5 Q100 30 92 55 Z" fill="${c}" stroke="${dark}" stroke-width="3" stroke-linejoin="round"/>`
      + `<circle cx="50" cy="30" r="11" fill="${dark}"/></svg>`,
    // Pelota con los colores del Mundial 2026: tres pétalos verde, rojo y azul
    pelota26: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#fff" stroke="#2b2140" stroke-width="5"/>'
      + ['#2e9e44', '#e53935', '#1e88e5'].map((c, i) => `<path d="M50 50 C28 40 24 14 50 7 C76 14 72 40 50 50 Z" fill="${c}" stroke="#2b2140" stroke-width="2.5" transform="rotate(${i * 120} 50 50)"/>`).join('')
      + '<circle cx="50" cy="50" r="6" fill="#fff" stroke="#2b2140" stroke-width="3"/></svg>',
    // Pelota clásica blanca con pentágonos negros (la que tenía siempre el futbolista; ahora es gratis)
    pelota: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#fff" stroke="#2b2140" stroke-width="5"/>'
      + '<polygon points="50,33 66,45 60,64 40,64 34,45" fill="#2b2140"/>'
      + [0, 72, 144, 216, 288].map((a) => `<path d="M50 9 L58 17 L50 22 L42 17 Z" fill="#2b2140" transform="rotate(${a} 50 50)"/>`).join('')
      + '</svg>',
    // Dorada, con brillo
    pelotaOro: '<svg viewBox="0 0 100 100"><defs><radialGradient id="bq-oro" cx=".35" cy=".3"><stop offset="0" stop-color="#fff6c2"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#d49b00"/></radialGradient></defs>'
      + '<circle cx="50" cy="50" r="44" fill="url(#bq-oro)" stroke="#8a6200" stroke-width="5"/>'
      + '<polygon points="50,33 66,45 60,64 40,64 34,45" fill="#b07800"/>'
      + [0, 72, 144, 216, 288].map((a) => `<path d="M50 9 L58 17 L50 22 L42 17 Z" fill="#b07800" transform="rotate(${a} 50 50)"/>`).join('')
      + `<polygon points="${star(30, 30, 9, 3.5)}" fill="#fff"/></svg>`,
    // Arcoíris: gajos de colores
    pelotaArcoiris: '<svg viewBox="0 0 100 100">'
      + ['#e53935', '#ff9800', '#ffd23f', '#43a047', '#1e88e5', '#8e24aa'].map((c, i) => `<path d="M50 50 L50 6 A44 44 0 0 1 88.1 28 Z" fill="${c}" transform="rotate(${i * 60} 50 50)"/>`).join('')
      + '<circle cx="50" cy="50" r="14" fill="#fff"/><circle cx="50" cy="50" r="44" fill="none" stroke="#2b2140" stroke-width="5"/></svg>',
    // De fuego: naranja con llamas
    pelotaFuego: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#ff9800"/>'
      + '<path d="M14 62 Q22 40 30 52 Q32 28 46 40 Q50 16 60 36 Q70 24 72 46 Q84 38 86 60 Q70 92 50 92 Q26 92 14 62 Z" fill="#e53935"/>'
      + '<path d="M30 72 Q36 58 42 66 Q46 50 54 62 Q62 52 66 70 Q60 84 48 84 Q36 84 30 72 Z" fill="#ffd23f"/>'
      + '<circle cx="50" cy="50" r="44" fill="none" stroke="#2b2140" stroke-width="5"/></svg>',
    // Galaxia: azul noche con estrellas
    pelotaGalaxia: '<svg viewBox="0 0 100 100"><defs><radialGradient id="bq-gal" cx=".4" cy=".35"><stop offset="0" stop-color="#7c4dff"/><stop offset="1" stop-color="#1a1150"/></radialGradient></defs>'
      + '<circle cx="50" cy="50" r="44" fill="url(#bq-gal)" stroke="#2b2140" stroke-width="5"/>'
      + [[34, 32, 8], [66, 44, 6], [44, 68, 7], [72, 70, 4], [24, 56, 4]].map(([x, y, r]) => `<polygon points="${star(x, y, r, r * 0.42)}" fill="#fff59d"/>`).join('')
      + '<circle cx="58" cy="24" r="2.5" fill="#fff"/><circle cx="20" cy="40" r="2" fill="#fff"/><circle cx="80" cy="56" r="2" fill="#fff"/></svg>',
    // De cuero, antigua: marrón con costuras y cordón
    pelotaRetro: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#a0612d" stroke="#4e2a0e" stroke-width="5"/>'
      + '<path d="M8 44 Q50 34 92 44 M8 58 Q50 68 92 58 M44 7 Q34 50 44 93 M58 7 Q68 50 58 93" fill="none" stroke="#5d3412" stroke-width="3"/>'
      + '<path d="M47 36 L55 36 M46 42 L56 42 M46 48 L56 48 M47 54 L55 54" stroke="#f5deb3" stroke-width="3" stroke-linecap="round"/>'
      + '<ellipse cx="34" cy="28" rx="9" ry="5" fill="rgba(255,255,255,.25)" transform="rotate(-30 34 28)"/></svg>',
    // Short visto de frente, con vivo al costado
    short: (fill, stripe) => '<svg viewBox="0 0 100 70">'
      + `<path d="M12 8 L88 8 L96 62 L56 62 L50 34 L44 62 L4 62 Z" fill="${fill}" stroke="#2b2140" stroke-width="4" stroke-linejoin="round"/>`
      + `<path d="M17 12 L11 58 M83 12 L89 58" stroke="${stripe}" stroke-width="6" stroke-linecap="round"/>`
      + `<path d="M14 16 L86 16" stroke="${stripe}" stroke-width="4" stroke-linecap="round" opacity=".7"/></svg>`,
    // Canillera, con dos rayas
    canillera: (fill, stripe) => '<svg viewBox="0 0 50 100">'
      + `<path d="M10 14 Q25 4 40 14 L37 82 Q25 96 13 82 Z" fill="${fill}" stroke="#2b2140" stroke-width="4" stroke-linejoin="round"/>`
      + `<path d="M15 34 Q25 28 35 34 M16 54 Q25 48 34 54" fill="none" stroke="${stripe}" stroke-width="6" stroke-linecap="round"/></svg>`,
    // Guante de arquero
    guante: (fill, stripe) => '<svg viewBox="0 0 100 100">'
      + `<path d="M30 92 L30 60 Q14 52 16 40 Q20 34 28 42 L28 22 Q28 14 35 14 Q41 14 41 22 L42 12 Q43 5 50 5 Q57 5 57 13 L58 18 Q59 11 65 12 Q71 13 71 21 L72 28 Q74 22 79 24 Q84 26 83 34 L80 62 Q78 72 70 76 L70 92 Z" fill="${fill}" stroke="#2b2140" stroke-width="4" stroke-linejoin="round"/>`
      + `<rect x="27" y="80" width="46" height="14" rx="4" fill="${stripe}" stroke="#2b2140" stroke-width="4"/>`
      + `<circle cx="52" cy="50" r="10" fill="${stripe}"/></svg>`,
    // Arco de fútbol: palos de color (post) y red (net). El mismo dibujo va detrás del futbolista.
    arco: (post, net) => '<svg viewBox="0 0 100 80">'
      + `<path d="M10 74 L10 10 L90 10 L90 74 Z" fill="${net}" opacity=".18"/>`
      + [22, 34, 46, 58, 70, 82].map((x) => `<path d="M${x - 4} 10 L${x - 4} 74" stroke="${net}" stroke-width="2"/>`).join('')
      + [22, 34, 46, 58, 70].map((y) => `<path d="M10 ${y} L90 ${y}" stroke="${net}" stroke-width="2"/>`).join('')
      + '<path d="M10 76 L10 10 L90 10 L90 76" fill="none" stroke="#2b2140" stroke-width="12" stroke-linejoin="round" stroke-linecap="round"/>'
      + `<path d="M10 76 L10 10 L90 10 L90 76" fill="none" stroke="${post}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/></svg>`,
    // Cono de entrenamiento
    cono: '<svg viewBox="0 0 100 100"><path d="M50 8 L78 80 L22 80 Z" fill="#ff7a00" stroke="#2b2140" stroke-width="4" stroke-linejoin="round"/>'
      + '<path d="M37 44 L63 44 L69 60 L31 60 Z" fill="#fff"/>'
      + '<rect x="10" y="78" width="80" height="14" rx="5" fill="#ff7a00" stroke="#2b2140" stroke-width="4"/></svg>',
    // Cinta de capitán: banda de color con la "C" blanca
    cinta: (c) => '<svg viewBox="0 0 100 60">'
      + `<rect x="6" y="12" width="88" height="36" rx="8" fill="${c}" stroke="#2b2140" stroke-width="4"/>`
      + '<path d="M60 22 Q50 16 42 22 Q36 30 42 38 Q50 44 60 38" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/></svg>',
    // Botín visto de costado, con raya y tapones (sole: color de la suela, si no es negra)
    botin: (fill, stripe, sole = '#2b2140') => '<svg viewBox="0 0 100 70">'
      + `<path d="M14 18 Q14 8 26 8 L46 8 Q50 8 52 14 L56 26 Q84 26 92 40 Q96 48 88 52 L14 52 Q8 52 8 44 Z" fill="${fill}" stroke="#2b2140" stroke-width="4" stroke-linejoin="round"/>`
      + `<path d="M30 30 L60 44 M36 22 L66 36" stroke="${stripe}" stroke-width="5" stroke-linecap="round"/>`
      + `<rect x="8" y="50" width="86" height="7" rx="3" fill="${sole}"/>`
      + [18, 38, 62, 82].map((x) => `<rect x="${x - 4}" y="56" width="8" height="8" rx="2" fill="#2b2140"/>`).join('')
      + '</svg>',
    capa: (c) =>`<svg viewBox="0 0 100 100"><path d="M28 6 Q50 16 72 6 L94 94 Q50 102 6 94 Z" fill="${c}" stroke="rgba(0,0,0,.25)" stroke-width="3" stroke-linejoin="round"/>`
      + `<polygon points="${star(50, 62, 12, 5)}" fill="rgba(255,255,255,.7)"/></svg>`,
  };

  // Camisetas: diseño sobre el cuerpo del personaje (jersey) y para la tarjeta de la tienda (shirt)
  const JERSEYS = {
    celeste: { kind: 'stripes', a: '#74acdf', b: '#ffffff', sleeve: '#74acdf', css: 'repeating-linear-gradient(90deg, #74acdf 0 14%, #ffffff 14% 28%)' },
    azul: { kind: 'band', a: '#1a3d8f', b: '#ffd200', sleeve: '#1a3d8f', css: 'linear-gradient(#1a3d8f 0 38%, #ffd200 38% 62%, #1a3d8f 62%)' },
    roja: { kind: 'diagonal', a: '#ffffff', b: '#e53935', sleeve: '#ffffff', css: 'linear-gradient(135deg, #ffffff 0 36%, #e53935 36% 60%, #ffffff 60%)' },
    celesteLisa: { kind: 'solid', a: '#74acdf', b: '#74acdf', sleeve: '#74acdf', css: '#74acdf' },
    verdeAmarilla: { kind: 'band', a: '#ffd200', b: '#2e9e44', sleeve: '#ffd200', css: 'linear-gradient(#ffd200 0 42%, #2e9e44 42% 58%, #ffd200 58%)' },
    rojaAmarilla: { kind: 'hstripes', a: '#e53935', b: '#ffd200', sleeve: '#e53935', css: 'repeating-linear-gradient(180deg, #e53935 0 14%, #ffd200 14% 28%)' },
    azulRoja: { kind: 'stripes', a: '#a50044', b: '#004d98', sleeve: '#004d98', css: 'repeating-linear-gradient(90deg, #a50044 0 14%, #004d98 14% 28%)' },
    // Mitad negra y mitad celeste. El celeste va del lado izquierdo de quien la lleva (a la derecha
    // mirándolo de frente), con la estrellita negra en el corazón.
    celesteNegra: {
      kind: 'split', a: '#1a1a1a', b: '#74acdf', star: '#1a1a1a', sleeveL: '#1a1a1a', sleeve: '#74acdf',
      css: `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><polygon points="${star(10, 10.5, 9, 3.8)}" fill="#1a1a1a"/></svg>`)}") 66% 30% / 16% no-repeat, linear-gradient(90deg, #1a1a1a 0 50%, #74acdf 50%)`,
    },
  };

  // (agregadas después)
  Object.assign(JERSEYS, {
    // Blanca con detalles rosa: costados, mangas y ruedo rosa
    // ...y un escudito verde agua en el corazón
    blancaRosa: {
      kind: 'trim', a: '#ffffff', b: '#ff4f9a', sleeve: '#ff4f9a', crest: '#2ec4b6',
      css: `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 24"><path d="M2 3 Q10 0 18 3 L18 11 Q18 19 10 23 Q2 19 2 11 Z" fill="#2ec4b6" stroke="#1b7f76" stroke-width="2"/></svg>')}") 66% 28% / 15% no-repeat, linear-gradient(transparent 82%, #ff4f9a 82%), linear-gradient(90deg, #ff4f9a 0 12%, #ffffff 12% 88%, #ff4f9a 88%)`,
    },
    rosa: { kind: 'solid', a: '#ff6fae', b: '#ff6fae', sleeve: '#ff6fae', css: '#ff6fae' },
    // Mitad rosa (izquierda mirando de frente) y mitad negra, sin estrella
    rosaNegra: { kind: 'split', a: '#ff6fae', b: '#1a1a1a', star: 'none', sleeveL: '#ff6fae', sleeve: '#1a1a1a', css: 'linear-gradient(90deg, #ff6fae 0 50%, #1a1a1a 50%)' },
  });

  // Botines del futbolista: reemplazan los zapatos (lugar "feet")
  const BOOTS = {
    botinesOro: { fill: '#ffd23f', stripe: '#ffffff' },
    botinesFluo: { fill: '#c6ff00', stripe: '#ff4081' },
    botinesAzules: { fill: '#1e88e5', stripe: '#ffffff' },
    botinesCelestes: { fill: '#74acdf', stripe: '#ffffff', sole: '#ffffff' },
    botinesRosa: { fill: '#1e63d6', stripe: '#ffffff', sole: '#ff4f9a' },
  };
  const boots = (id, name) => ({ id, name, slot: 'feet', boots: BOOTS[id], use: 'kick' });
  // Shorts (lugar "shorts"), canilleras ("shin") y guantes de arquero ("gloves"): color y vivo
  const shorts = (id, name, fill, stripe) => ({ id, name, slot: 'shorts', shorts: { fill, stripe }, use: 'hop' });
  const shin = (id, name, fill, stripe) => ({ id, name, slot: 'shin', shin: { fill, stripe }, use: 'kick' });
  // Arcos (lugar "back": van detrás del futbolista)
  const goal = (id, name, post, net) => ({ id, name, slot: 'back', goal: { post, net }, use: 'kick' });
  const gloves = (id, name, fill, stripe) => ({ id, name, slot: 'gloves', gloves: { fill, stripe }, use: 'block' });
  const jersey = (id, name) => ({ id, name, slot: 'body', jersey: JERSEYS[id], shirt: JERSEYS[id].css });

  /*
   * Catálogo por personaje. Cada cosa va en un lugar del cuerpo (slot): head, neck, hand, body, back,
   * ball (pelota del pie), feet (botines), arm (cinta de capitán), shorts, shin (canilleras),
   * gloves (guantes) o ground (cono, al lado del otro pie).
   * Una sola cosa por lugar: ponerse otra en el mismo lugar reemplaza la anterior.
   *   emoji | art (bastón, varita, pelota) | bow (corbatita) | cape (capa) | jersey (camiseta) | boots (botines)
   *   use   lo que hace al usarla (si no, depende del lugar: ver puppet.js)
   */
  const CATALOG = {
    mago: [
      { id: 'baston', name: 'el bastón mágico', slot: 'hand', art: 'baston', use: 'magic' },
      { id: 'capa', name: 'la capa de estrellas', slot: 'back', cape: '#5e35b1' },
      { id: 'bola', name: 'la bola de cristal', slot: 'hand', emoji: '🔮', use: 'magic' },
    ],
    dragon: [
      { id: 'corbatita', name: 'la corbatita', slot: 'neck', bow: ['#e53935', '#8e0000'] },
      { id: 'corona', name: 'la corona', slot: 'head', emoji: '👑' },
      { id: 'galera', name: 'la galera', slot: 'head', emoji: '🎩' },
    ],
    futbolista: [
      jersey('celeste', 'la camiseta celeste y blanca'),
      jersey('azul', 'la camiseta azul y amarilla'),
      jersey('roja', 'la camiseta con la banda roja'),
      jersey('celesteLisa', 'la camiseta toda celeste'),
      jersey('verdeAmarilla', 'la camiseta verde y amarilla'),
      jersey('rojaAmarilla', 'la camiseta roja y amarilla'),
      jersey('azulRoja', 'la camiseta azul y roja a rayas'),
      jersey('celesteNegra', 'la camiseta celeste y negra'),
      jersey('blancaRosa', 'la camiseta blanca y rosa'),
      jersey('rosa', 'la camiseta rosa'),
      jersey('rosaNegra', 'la camiseta rosa y negra'),
      { id: 'pelota', name: 'la pelota', slot: 'ball', art: 'pelota', use: 'kick', price: 0 },
      { id: 'pelota26', name: 'la pelota del mundial', slot: 'ball', art: 'pelota26', use: 'kick' },
      { id: 'pelotaOro', name: 'la pelota dorada', slot: 'ball', art: 'pelotaOro', use: 'kick' },
      { id: 'pelotaArcoiris', name: 'la pelota arcoíris', slot: 'ball', art: 'pelotaArcoiris', use: 'kick' },
      { id: 'pelotaFuego', name: 'la pelota de fuego', slot: 'ball', art: 'pelotaFuego', use: 'kick' },
      { id: 'pelotaGalaxia', name: 'la pelota galaxia', slot: 'ball', art: 'pelotaGalaxia', use: 'kick' },
      { id: 'pelotaRetro', name: 'la pelota de cuero antigua', slot: 'ball', art: 'pelotaRetro', use: 'kick' },
      boots('botinesOro', 'los botines dorados'),
      boots('botinesFluo', 'los botines verde flúor'),
      boots('botinesAzules', 'los botines azules'),
      boots('botinesCelestes', 'los botines celestes y blancos'),
      boots('botinesRosa', 'los botines azules, blancos y rosa'),
      shorts('shortBlanco', 'el short blanco', '#ffffff', '#1a1a1a'),
      shorts('shortNegro', 'el short negro', '#1a1a1a', '#ffffff'),
      shorts('shortAzul', 'el short azul', '#1a3d8f', '#ffd200'),
      shorts('shortCeleste', 'el short celeste', '#74acdf', '#ffffff'),
      shorts('shortRosa', 'el short rosa', '#ff6fae', '#ffffff'),
      shin('canillerasBlancas', 'las canilleras blancas', '#ffffff', '#1e63d6'),
      shin('canillerasNegras', 'las canilleras negras', '#1a1a1a', '#ffd200'),
      shin('canillerasCelestes', 'las canilleras celestes', '#74acdf', '#ffffff'),
      shin('canillerasRosas', 'las canilleras rosas', '#ff6fae', '#ffffff'),
      gloves('guantesVerdes', 'los guantes verdes', '#7ed321', '#1a1a1a'),
      gloves('guantesNaranjas', 'los guantes naranjas', '#ff8a00', '#ffffff'),
      gloves('guantesAzules', 'los guantes azules', '#1e63d6', '#ffffff'),
      gloves('guantesRosas', 'los guantes rosas', '#ff4f9a', '#ffffff'),
      { id: 'cono', name: 'el cono de entrenamiento', slot: 'ground', cone: true, use: 'kick' },
      goal('arcoBlanco', 'el arco blanco', '#ffffff', '#9aa5b1'),
      goal('arcoDorado', 'el arco dorado', '#ffd23f', '#f2a900'),
      goal('arcoCeleste', 'el arco celeste', '#74acdf', '#ffffff'),
      goal('arcoRosa', 'el arco rosa', '#ff6fae', '#ffffff'),
      goal('arcoRojo', 'el arco rojo', '#e53935', '#ffd200'),
      { id: 'cintaRoja', name: 'la cinta de capitán roja', slot: 'arm', armband: '#e53935', use: 'raise' },
      { id: 'cintaAzul', name: 'la cinta de capitán azul', slot: 'arm', armband: '#1e63d6', use: 'raise' },
      { id: 'cintaVerde', name: 'la cinta de capitán verde', slot: 'arm', armband: '#2e9e44', use: 'raise' },
      { id: 'cintaAmarilla', name: 'la cinta de capitán amarilla', slot: 'arm', armband: '#ffc400', use: 'raise' },
      { id: 'cintaRosa', name: 'la cinta de capitán rosa', slot: 'arm', armband: '#ff4f9a', use: 'raise' },
      { id: 'cintaCeleste', name: 'la cinta de capitán celeste', slot: 'arm', armband: '#4fb3ec', use: 'raise' },
      { id: 'copa', name: 'la copa', slot: 'hand', emoji: '🏆' },
      // Trofeos de verdad (los del mapa de trofeos): se pueden comprar solo si ya se ganaron
      { id: 'trofeoPlata', name: 'la copa de plata', slot: 'hand', trophy: 4, use: 'raise' },
      { id: 'trofeoOro', name: 'la copa de oro', slot: 'hand', trophy: 8, use: 'raise' },
      { id: 'trofeoPelota', name: 'la pelota de oro', slot: 'hand', trophy: 10, use: 'raise' },
      { id: 'trofeoBotin', name: 'el botín de oro', slot: 'hand', trophy: 12, use: 'raise' },
      { id: 'trofeoEscudo', name: 'el escudo de campeón', slot: 'hand', trophy: 14, use: 'raise' },
    ],
    princesa: [
      { id: 'varita', name: 'la varita mágica', slot: 'hand', art: 'varita', use: 'magic' },
      { id: 'flor', name: 'la flor', slot: 'head', emoji: '🌸' },
      { id: 'collar', name: 'el collar', slot: 'neck', emoji: '📿' },
    ],
    unicornio: [
      { id: 'mono', name: 'el moño', slot: 'neck', emoji: '🎀', size: 16 },
      { id: 'flor', name: 'la flor', slot: 'head', emoji: '🌸' },
      { id: 'arcoiris', name: 'el arcoíris', slot: 'back', emoji: '🌈' },
    ],
    duende: [
      { id: 'trebol', name: 'el trébol de la suerte', slot: 'head', emoji: '🍀' },
      { id: 'hongo', name: 'el hongo', slot: 'hand', emoji: '🍄' },
      { id: 'bufanda', name: 'la bufanda', slot: 'neck', emoji: '🧣', size: 18, low: true },
    ],
    hada: [
      { id: 'varita', name: 'la varita mágica', slot: 'hand', art: 'varita', use: 'magic' },
      { id: 'flor', name: 'la flor', slot: 'head', emoji: '🌸' },
      { id: 'mariposa', name: 'la mariposa', slot: 'head', emoji: '🦋' },
    ],
    dinosaurio: [
      { id: 'gorra', name: 'la gorra', slot: 'head', emoji: '🧢' },
      { id: 'corbatita', name: 'la corbatita', slot: 'neck', bow: ['#1e88e5', '#0d47a1'] },
      { id: 'globo', name: 'el globo', slot: 'hand', emoji: '🎈', high: true, size: 24 },
    ],
    robot: [
      { id: 'galera', name: 'la galera', slot: 'head', emoji: '🎩' },
      { id: 'corbatita', name: 'la corbatita', slot: 'neck', bow: ['#43a047', '#1b5e20'] },
      { id: 'girasol', name: 'el girasol', slot: 'hand', emoji: '🌻' },
    ],
    superheroe: [
      { id: 'capa', name: 'la capa roja', slot: 'back', cape: '#e53935' },
      { id: 'escudo', name: 'el escudo', slot: 'hand', emoji: '🛡️', use: 'block', size: 22 },
      { id: 'medalla', name: 'la medalla', slot: 'neck', emoji: '🏅', size: 16, low: true },
    ],
    gatito: [
      { id: 'mono', name: 'el moño', slot: 'head', emoji: '🎀' },
      { id: 'cascabel', name: 'el cascabel', slot: 'neck', emoji: '🔔' },
      { id: 'ovillo', name: 'el ovillo de lana', slot: 'hand', emoji: '🧶' },
    ],
  };

  const store = BQ.store;
  const entry = (charId) => store.data.wardrobe[charId] || { owned: [], worn: [] };
  const writable = (charId) => {
    const w = store.data.wardrobe;
    if (!w[charId]) w[charId] = { owned: [], worn: [] };
    return w[charId];
  };

  BQ.wardrobe = {
    PRICE: 5,
    ART,
    // Precio de una cosa (algunas son gratis: price: 0)
    price: (item) => (item.price ?? 5),
    // Trofeo que todavía no ganó: no se puede comprar
    locked: (item) => !!item.trophy && BQ.trophies.wins() < item.trophy,
    // (en tamaño grande: en la lista, los primeros trofeos se dibujan más chicos)
    trophyOf: (item) => ({ ...BQ.trophies.list.find((t) => t.wins === item.trophy), scale: 1 }),

    items: (charId) => CATALOG[charId] || [],
    owns: (charId, itemId) => entry(charId).owned.includes(itemId),
    wears: (charId, itemId) => entry(charId).worn.includes(itemId),
    wornItems(charId) {
      const worn = entry(charId).worn;
      return this.items(charId).filter((it) => worn.includes(it.id));
    },

    buy(charId, item) {
      const price = this.price(item);
      if (store.data.coins < price || this.owns(charId, item.id) || this.locked(item)) return false;
      store.data.coins -= price;
      writable(charId).owned.push(item.id);
      this.wear(charId, item);
      return true;
    },

    // Poner (sacando lo que haya en el mismo lugar)
    wear(charId, item) {
      const e = writable(charId);
      const sameSlot = this.items(charId).filter((it) => it.slot === item.slot).map((it) => it.id);
      e.worn = e.worn.filter((id) => !sameSlot.includes(id)).concat(item.id);
      store.save();
    },

    takeOff(charId, item) {
      const e = writable(charId);
      e.worn = e.worn.filter((id) => id !== item.id);
      store.save();
    },

    // Dibujo de la prenda sola, para la tarjeta de la tienda
    card(item) {
      if (item.emoji) return h('span', { class: 'card-art emoji' }, item.emoji);
      if (item.trophy) return h('span', { class: 'card-art' + (this.locked(item) ? ' locked' : '') }, BQ.trophies.el(this.trophyOf(item), 'card-trophy'));
      if (item.jersey) return h('span', { class: 'card-art' }, h('span', { class: 'shirt', style: { background: item.shirt } }));
      const svg = item.art ? ART[item.art]
        : item.boots ? ART.botin(item.boots.fill, item.boots.stripe, item.boots.sole)
          : item.bow ? ART.corbatita(...item.bow)
            : item.cape ? ART.capa(item.cape)
              : item.armband ? ART.cinta(item.armband)
                : item.shorts ? ART.short(item.shorts.fill, item.shorts.stripe)
                  : item.shin ? ART.canillera(item.shin.fill, item.shin.stripe)
                    : item.gloves ? ART.guante(item.gloves.fill, item.gloves.stripe)
                      : item.cone ? ART.cono
                        : item.goal ? ART.arco(item.goal.post, item.goal.net) : '';
      return h('span', { class: 'card-art card-svg' + (['hand', 'shin'].includes(item.slot) ? ' tall' : ['ball', 'gloves', 'ground', 'back'].includes(item.slot) ? ' round' : item.slot === 'arm' ? ' band' : ''), html: svg });
    },
  };
})(window.BQ);
