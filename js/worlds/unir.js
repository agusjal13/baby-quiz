(function (BQ) {
  'use strict';

  const U = BQ.util;

  // Colores bien distintos entre sí, con su plural para la voz
  const COLORS = [
    ['rojo', 'rojos'], ['azul', 'azules'], ['amarillo', 'amarillos'],
    ['verde', 'verdes'], ['naranja', 'naranjas'], ['violeta', 'violetas'],
  ].map(([id, plural]) => Object.assign({ plural }, BQ.color(id)));
  const MAX_PAIRS = 3;

  BQ.registerWorld({
    id: 'unir',
    order: 6,
    name: 'Unir',
    sayName: 'el mundo de unir puntos',
    icon: '✏️',
    theme: {
      sky1: '#fff4c7', sky2: '#ffd9b0', ground: '#f7b27a',
      card1: '#ff9a44', card2: '#fc6076',
      decor: ['✏️', '🖍️', '🎨', '⭐', '✨'],
    },
    vehicle: { emoji: '🚲', anim: 'bounce', rider: { bottom: '40%', left: '22%', size: 0.5 } },
    goal: '🎨',

    questionTypes: [
      {
        // Nivel 1 = 1 par, nivel 2 = 2 pares, del 3 en adelante 3 pares (máximo, para que no se complique)
        id: 'unir-puntos',
        make(level) {
          const pairs = U.sample(COLORS, Math.min(level, MAX_PAIRS));
          const say = pairs.length === 1
            ? `Arrastrá el dedo y uní los dos puntos ${pairs[0].plural}`
            : 'Uní cada punto con el de su mismo color';
          return {
            kind: 'connect',
            key: 'unir-' + pairs.map((c) => c.id).join('-'),
            say,
            text: say,
            prompt: null,
            pairs,
          };
        },
      },
    ],
  });
})(window.BQ);
