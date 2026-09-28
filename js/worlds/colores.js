(function (BQ) {
  'use strict';

  const U = BQ.util;

  // Cantidad de colores en juego por nivel (se toman en el orden de BQ.COLORS)
  const POOL = [4, 5, 6, 8, 10];

  // Cosas con un color bien reconocible. plural: true => "¿De qué color son...?"
  const THINGS = [
    { name: 'la frutilla', emoji: '🍓', color: 'rojo' },
    { name: 'la manzana', emoji: '🍎', color: 'rojo' },
    { name: 'el tomate', emoji: '🍅', color: 'rojo' },
    { name: 'la banana', emoji: '🍌', color: 'amarillo' },
    { name: 'el pollito', emoji: '🐤', color: 'amarillo' },
    { name: 'la estrella', emoji: '⭐', color: 'amarillo' },
    { name: 'el queso', emoji: '🧀', color: 'amarillo' },
    { name: 'la rana', emoji: '🐸', color: 'verde' },
    { name: 'el trébol', emoji: '🍀', color: 'verde' },
    { name: 'el brócoli', emoji: '🥦', color: 'verde' },
    { name: 'el pepino', emoji: '🥒', color: 'verde' },
    { name: 'la gota de agua', emoji: '💧', color: 'azul' },
    { name: 'la ballena', emoji: '🐳', color: 'azul' },
    { name: 'la gorra', emoji: '🧢', color: 'azul' },
    { name: 'la naranja', emoji: '🍊', color: 'naranja' },
    { name: 'la zanahoria', emoji: '🥕', color: 'naranja' },
    { name: 'la calabaza', emoji: '🎃', color: 'naranja' },
    { name: 'las uvas', emoji: '🍇', color: 'violeta', plural: true },
    { name: 'la berenjena', emoji: '🍆', color: 'violeta' },
    { name: 'el chanchito', emoji: '🐷', color: 'rosa' },
    { name: 'la flor', emoji: '🌸', color: 'rosa' },
    { name: 'el chocolate', emoji: '🍫', color: 'marron' },
    { name: 'la castaña', emoji: '🌰', color: 'marron' },
    { name: 'el oso', emoji: '🐻', color: 'marron' },
    { name: 'la leche', emoji: '🥛', color: 'blanco' },
    { name: 'el fantasmita', emoji: '👻', color: 'blanco' },
    { name: 'la oveja', emoji: '🐑', color: 'blanco' },
    { name: 'la araña', emoji: '🕷️', color: 'negro' },
    { name: 'el sombrero', emoji: '🎩', color: 'negro' },
  ];

  const colorsFor = (level) => U.poolFor(BQ.COLORS, level, POOL);
  const swatch = (c) => ({ type: 'color', hex: c.hex });
  const thing = (t) => ({ type: 'emoji', emoji: t.emoji });

  BQ.registerWorld({
    id: 'colores',
    order: 1,
    name: 'Colores',
    sayName: 'el mundo de los colores',
    icon: '🌈',
    theme: {
      sky1: '#ffd6ec', sky2: '#bfe9ff', ground: '#b8e986',
      card1: '#ff7eb3', card2: '#ffb86b',
      decor: ['☁️', '🌈', '🌸', '🦋', '🌷'],
    },
    vehicle: { emoji: '☁️', anim: 'float', rider: { bottom: '40%', left: '26%', size: 0.62 } },
    goal: '🌈',

    questionTypes: [
      {
        id: 'tocar-color',
        weight: 3,
        make(level) {
          const pool = colorsFor(level);
          const c = U.pick(pool);
          return BQ.question({
            key: 'tocar-' + c.id,
            say: `Tocá el color ${c.name}`,
            correct: swatch(c),
            wrong: U.others(pool, 3, (x) => x === c).map(swatch),
          });
        },
      },
      {
        id: 'de-que-color',
        weight: 2,
        make(level) {
          const pool = colorsFor(level);
          const t = U.pick(THINGS.filter((x) => pool.some((c) => c.id === x.color)));
          const c = BQ.color(t.color);
          return BQ.question({
            key: 'obj-' + t.emoji,
            say: `¿De qué color ${t.plural ? 'son' : 'es'} ${t.name}?`,
            prompt: thing(t),
            correct: swatch(c),
            wrong: U.others(pool, 3, (x) => x === c).map(swatch),
          });
        },
      },
      {
        id: 'algo-de-color',
        minLevel: 3,
        weight: 2,
        make(level) {
          const pool = colorsFor(level);
          const target = U.pick(pool);
          const others = U.others(pool, 3, (x) => x === target);
          const pickThing = (c) => U.pick(THINGS.filter((t) => t.color === c.id));
          return BQ.question({
            key: 'algo-' + target.id,
            say: `Tocá algo de color ${target.name}`,
            correct: thing(pickThing(target)),
            wrong: others.map((c) => thing(pickThing(c))),
          });
        },
      },
    ],
  });
})(window.BQ);
