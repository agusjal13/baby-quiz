(function (BQ) {
  'use strict';

  const h = BQ.util.h;

  function starPoints() {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 46 : 19;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(53 + r * Math.sin(a)).toFixed(1)}`);
    }
    return pts.join(' ');
  }

  // Formas en un viewBox de 100x100
  const SHAPES = {
    circulo: '<circle cx="50" cy="50" r="42"/>',
    cuadrado: '<rect x="12" y="12" width="76" height="76" rx="5"/>',
    triangulo: '<polygon points="50,8 94,88 6,88" stroke-linejoin="round"/>',
    estrella: `<polygon points="${starPoints()}" stroke-linejoin="round"/>`,
    corazon: '<path d="M50 88 C20 66 4 46 17 26 C29 9 47 14 50 31 C53 14 71 9 83 26 C96 46 80 66 50 88 Z"/>',
    rectangulo: '<rect x="4" y="27" width="92" height="46" rx="4"/>',
    ovalo: '<ellipse cx="50" cy="50" rx="45" ry="29"/>',
    rombo: '<polygon points="50,5 90,50 50,95 10,50" stroke-linejoin="round"/>',
  };

  // Dibuja el contenido de una opción o del "cartel" de la pregunta.
  // Tipos: emoji | sized | color | text | group | shape
  BQ.renderVisual = function (v) {
    switch (v.type) {
      case 'emoji':
        return h('span', { class: 'vis vis-emoji emoji' }, v.emoji);
      case 'sized':
        return h('span', { class: 'vis vis-emoji emoji', style: { 'font-size': `${v.scale * 70}cqmin` } }, v.emoji);
      case 'color':
        return h('span', { class: 'vis vis-color' + (v.hex === '#ffffff' ? ' light' : ''), style: { background: v.hex } });
      case 'text':
        return h('span', { class: 'vis vis-text', style: { color: v.color || '#5b3cc4' } }, v.text);
      case 'group': {
        const cols = Math.ceil(Math.sqrt(v.count));
        const rows = Math.ceil(v.count / cols);
        const size = Math.floor(76 / Math.max(cols, rows));
        return h('span', {
          class: 'vis vis-group',
          style: { 'grid-template-columns': `repeat(${cols}, auto)`, 'font-size': `${size}cqmin` },
        }, Array.from({ length: v.count }, () => h('span', { class: 'emoji' }, v.emoji)));
      }
      case 'shape':
        return h('span', {
          class: 'vis vis-shape',
          html: `<svg viewBox="0 0 100 100" fill="${v.color}" stroke="rgba(0,0,0,.22)" stroke-width="3">${SHAPES[v.shape]}</svg>`,
        });
      default:
        return h('span', { class: 'vis' }, '?');
    }
  };
})(window.BQ);
