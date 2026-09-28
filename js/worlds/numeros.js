(function (BQ) {
  'use strict';

  const U = BQ.util;

  // Número más alto en juego por nivel
  const MAX = [4, 5, 6, 8, 10];

  const THINGS = [
    { emoji: '🍎', one: 'manzana', many: 'manzanas', fem: true },
    { emoji: '⭐', one: 'estrella', many: 'estrellas', fem: true },
    { emoji: '🐟', one: 'pez', many: 'peces' },
    { emoji: '🎈', one: 'globo', many: 'globos' },
    { emoji: '🐞', one: 'vaquita', many: 'vaquitas', fem: true },
    { emoji: '🍪', one: 'galletita', many: 'galletitas', fem: true },
    { emoji: '🚗', one: 'auto', many: 'autos' },
    { emoji: '🐥', one: 'pollito', many: 'pollitos' },
    { emoji: '🌸', one: 'flor', many: 'flores', fem: true },
    { emoji: '🍓', one: 'frutilla', many: 'frutillas', fem: true },
  ];

  const DIGIT_COLORS = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00897b', '#d81b60', '#5e35b1', '#f4511e', '#3949ab', '#c0ca33'];

  const range = (level) => Array.from({ length: MAX[Math.min(level, MAX.length) - 1] }, (_, i) => i + 1);
  const digit = (n) => ({ type: 'text', text: String(n), color: DIGIT_COLORS[n] });
  const group = (emoji, n) => ({ type: 'group', emoji, count: n });

  BQ.registerWorld({
    id: 'numeros',
    order: 3,
    name: 'Números',
    sayName: 'el mundo de los números',
    icon: '🔢',
    theme: {
      sky1: '#c8e6ff', sky2: '#eef8ff', ground: '#8fd07a',
      card1: '#4facfe', card2: '#00c9a7',
      decor: ['⛰️', '🌲', '🎈', '☁️', '🌻'],
    },
    vehicle: { emoji: '🚂', flip: true, anim: 'bounce', rider: { bottom: '52%', left: '6%', size: 0.55 } },
    goal: '🎪',

    questionTypes: [
      {
        id: 'tocar-numero',
        weight: 2,
        make(level) {
          const nums = range(level);
          const n = U.pick(nums);
          return BQ.question({
            key: 'num-' + n,
            say: `Tocá el número ${U.NUM_WORDS[n]}`,
            correct: digit(n),
            wrong: U.others(nums, 3, (x) => x === n).map(digit),
          });
        },
      },
      {
        id: 'donde-hay',
        weight: 3,
        make(level) {
          const nums = range(level);
          const n = U.pick(nums);
          const t = U.pick(THINGS);
          return BQ.question({
            key: 'donde-' + n,
            say: `¿Dónde hay ${U.numWord(n, t.fem)} ${n === 1 ? t.one : t.many}?`,
            correct: group(t.emoji, n),
            wrong: U.others(nums, 3, (x) => x === n).map((m) => group(t.emoji, m)),
          });
        },
      },
      {
        id: 'cuantos',
        minLevel: 2,
        weight: 3,
        make(level) {
          const nums = range(level);
          const n = U.pick(nums);
          const t = U.pick(THINGS);
          return BQ.question({
            key: 'cuantos-' + n,
            say: `¿${t.fem ? 'Cuántas' : 'Cuántos'} ${t.many} hay?`,
            prompt: group(t.emoji, n),
            correct: digit(n),
            wrong: U.others(nums, 3, (x) => x === n).map(digit),
          });
        },
      },
    ],
  });
})(window.BQ);
