(function (BQ) {
  'use strict';

  const U = BQ.util;

  const SHAPES = [
    { id: 'circulo', name: 'el círculo' },
    { id: 'cuadrado', name: 'el cuadrado' },
    { id: 'triangulo', name: 'el triángulo' },
    { id: 'estrella', name: 'la estrella', fem: true },
    { id: 'corazon', name: 'el corazón' },
    { id: 'rectangulo', name: 'el rectángulo' },
    { id: 'ovalo', name: 'el óvalo' },
    { id: 'rombo', name: 'el rombo' },
  ];
  const POOL = [4, 5, 6, 8, 8];

  const SHAPE_COLORS = ['rojo', 'azul', 'amarillo', 'verde', 'naranja', 'violeta'].map(BQ.color);
  const SIZE_ITEMS = ['🐶', '🍎', '⭐', '🚗', '🐸', '🎈', '🐱', '🍩', '🐘', '🌸', '🐢', '🍓'];
  const SCALES = [0.32, 0.5, 0.72, 1];

  const shapesFor = (level) => U.poolFor(SHAPES, level, POOL);
  const shape = (s, c) => ({ type: 'shape', shape: s.id, color: c.hex });

  BQ.registerWorld({
    id: 'formas',
    order: 5,
    name: 'Formas',
    sayName: 'el mundo de las formas',
    icon: '🔺',
    theme: {
      sky1: '#1b1446', sky2: '#44307e', ground: '#2c205f',
      card1: '#6a3de8', card2: '#1f1147',
      decor: ['⭐', '✨', '🪐', '🌙', '☄️'],
    },
    vehicle: { emoji: '🛸', anim: 'float', rider: { bottom: '24%', left: '30%', size: 0.5, front: true } },
    goal: '🪐',

    questionTypes: [
      {
        id: 'tocar-forma',
        weight: 3,
        make(level) {
          const pool = shapesFor(level);
          const s = U.pick(pool);
          const colors = U.sample(SHAPE_COLORS, 4);
          const wrong = U.others(pool, 3, (x) => x === s);
          return BQ.question({
            key: 'forma-' + s.id,
            say: `Tocá ${s.name}`,
            correct: shape(s, colors[0]),
            wrong: wrong.map((x, i) => shape(x, colors[i + 1])),
          });
        },
      },
      {
        id: 'tamano',
        weight: 2,
        make() {
          const emoji = U.pick(SIZE_ITEMS);
          const big = Math.random() < 0.5;
          const sized = (scale) => ({ type: 'sized', emoji, scale });
          return BQ.question({
            key: 'tamano-' + (big ? 'grande' : 'chico'),
            say: big ? 'Tocá el más grande' : 'Tocá el más chiquito',
            correct: sized(big ? SCALES[3] : SCALES[0]),
            wrong: (big ? SCALES.slice(0, 3) : SCALES.slice(1)).map(sized),
          });
        },
      },
      {
        id: 'forma-y-color',
        minLevel: 4,
        weight: 3,
        make(level) {
          const pool = shapesFor(level);
          const [s, s2, s3] = U.sample(pool, 3);
          const [c, c2, c3] = U.sample(SHAPE_COLORS, 3);
          return BQ.question({
            key: `forma-color-${s.id}-${c.id}`,
            say: `Tocá ${s.name} ${s.fem ? c.fem : c.name}`,
            correct: shape(s, c),
            // Distractores que comparten la forma o el color, para que haya que mirar las dos cosas
            wrong: [shape(s, c2), shape(s2, c), shape(s3, c3)],
          });
        },
      },
    ],
  });
})(window.BQ);
