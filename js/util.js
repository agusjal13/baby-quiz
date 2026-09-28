window.BQ = window.BQ || {};

(function (BQ) {
  'use strict';

  const U = {};

  U.rand = (n) => Math.floor(Math.random() * n);
  U.pick = (arr) => arr[U.rand(arr.length)];
  U.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = U.rand(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  U.sample = (arr, n) => U.shuffle(arr).slice(0, n);
  // n elementos al azar de arr que no cumplan exclude(x)
  U.others = (arr, n, exclude) => U.sample(arr.filter((x) => !exclude(x)), n);
  // Toma los primeros N elementos de arr según el nivel: sizes = [nivel1, nivel2, ...]
  U.poolFor = (arr, level, sizes) => arr.slice(0, sizes[Math.min(level, sizes.length) - 1]);
  U.wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  U.cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  U.NUM_WORDS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];
  // "un auto" / "una manzana" / "tres autos"
  U.numWord = (n, fem) => (n === 1 ? (fem ? 'una' : 'un') : U.NUM_WORDS[n]);

  // Crea elementos del DOM: h('div', {class: 'x', onclick: fn, style: {'--a': 1}}, hijos...)
  U.h = function (tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style') for (const [sk, sv] of Object.entries(v)) el.style.setProperty(sk, String(sv));
        else if (k === 'html') el.innerHTML = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v);
      }
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : String(c));
    }
    return el;
  };

  // Paleta compartida por los mundos
  BQ.COLORS = [
    { id: 'rojo', name: 'rojo', fem: 'roja', hex: '#e53935' },
    { id: 'azul', name: 'azul', fem: 'azul', hex: '#1e88e5' },
    { id: 'amarillo', name: 'amarillo', fem: 'amarilla', hex: '#fdd835' },
    { id: 'verde', name: 'verde', fem: 'verde', hex: '#43a047' },
    { id: 'naranja', name: 'naranja', fem: 'naranja', hex: '#fb8c00' },
    { id: 'violeta', name: 'violeta', fem: 'violeta', hex: '#8e24aa' },
    { id: 'rosa', name: 'rosa', fem: 'rosa', hex: '#f48fb1' },
    { id: 'marron', name: 'marrón', fem: 'marrón', hex: '#8d5a3b' },
    { id: 'blanco', name: 'blanco', fem: 'blanca', hex: '#ffffff' },
    { id: 'negro', name: 'negro', fem: 'negra', hex: '#263238' },
  ];
  BQ.color = (id) => BQ.COLORS.find((c) => c.id === id);

  BQ.util = U;
})(window.BQ);
