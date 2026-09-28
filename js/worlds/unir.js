(function (BQ) {
  'use strict';

  const U = BQ.util;

  // Colores bien distintos entre sí, con su plural para la voz
  const COLORS = [
    ['rojo', 'rojos'], ['azul', 'azules'], ['amarillo', 'amarillos'],
    ['verde', 'verdes'], ['naranja', 'naranjas'], ['violeta', 'violetas'],
  ].map(([id, plural]) => Object.assign({ plural }, BQ.color(id)));

  BQ.registerWorld({
    id: 'unir',
    order: 6,
    name: 'Unir',
    sayName: 'el mundo de unir puntos',
    icon: '✏️',
    levels: 3,
    theme: {
      sky1: '#fff4c7', sky2: '#ffd9b0', ground: '#f7b27a',
      card1: '#ff9a44', card2: '#fc6076',
      decor: ['✏️', '🖍️', '🎨', '⭐', '✨'],
    },
    vehicle: { emoji: '🚲', anim: 'bounce', rider: { bottom: '40%', left: '22%', size: 0.5 } },
    goal: '🎨',

    questionTypes: [
      {
        // Nivel N = N pares de puntos, cada par de un color distinto
        id: 'unir-puntos',
        make(level) {
          const pairs = U.sample(COLORS, level);
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
