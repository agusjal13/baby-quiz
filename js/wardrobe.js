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
    capa: (c) => `<svg viewBox="0 0 100 100"><path d="M28 6 Q50 16 72 6 L94 94 Q50 102 6 94 Z" fill="${c}" stroke="rgba(0,0,0,.25)" stroke-width="3" stroke-linejoin="round"/>`
      + `<polygon points="${star(50, 62, 12, 5)}" fill="rgba(255,255,255,.7)"/></svg>`,
  };

  // Camisetas: diseño sobre el cuerpo del personaje (jersey) y para la tarjeta de la tienda (shirt)
  const JERSEYS = {
    celeste: { kind: 'stripes', a: '#74acdf', b: '#ffffff', sleeve: '#74acdf', css: 'repeating-linear-gradient(90deg, #74acdf 0 14%, #ffffff 14% 28%)' },
    azul: { kind: 'band', a: '#1a3d8f', b: '#ffd200', sleeve: '#1a3d8f', css: 'linear-gradient(#1a3d8f 0 38%, #ffd200 38% 62%, #1a3d8f 62%)' },
    roja: { kind: 'diagonal', a: '#ffffff', b: '#e53935', sleeve: '#ffffff', css: 'linear-gradient(135deg, #ffffff 0 36%, #e53935 36% 60%, #ffffff 60%)' },
  };
  const jersey = (id, name) => ({ id, name, slot: 'body', jersey: JERSEYS[id], shirt: JERSEYS[id].css });

  /*
   * Catálogo por personaje. Cada cosa va en un lugar del cuerpo (slot): head, neck, hand, body o back.
   * Una sola cosa por lugar: ponerse otra en el mismo lugar reemplaza la anterior.
   *   emoji | art (bastón, varita) | bow (corbatita) | cape (capa) | jersey (camiseta)
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
      { id: 'copa', name: 'la copa', slot: 'hand', emoji: '🏆' },
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

    items: (charId) => CATALOG[charId] || [],
    owns: (charId, itemId) => entry(charId).owned.includes(itemId),
    wears: (charId, itemId) => entry(charId).worn.includes(itemId),
    wornItems(charId) {
      const worn = entry(charId).worn;
      return this.items(charId).filter((it) => worn.includes(it.id));
    },

    buy(charId, item) {
      if (store.data.coins < this.PRICE || this.owns(charId, item.id)) return false;
      store.data.coins -= this.PRICE;
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
      if (item.jersey) return h('span', { class: 'card-art' }, h('span', { class: 'shirt', style: { background: item.shirt } }));
      const svg = item.art ? ART[item.art] : item.bow ? ART.corbatita(...item.bow) : item.cape ? ART.capa(item.cape) : '';
      return h('span', { class: 'card-art card-svg' + (item.art ? ' tall' : ''), html: svg });
    },
  };
})(window.BQ);
