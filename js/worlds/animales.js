(function (BQ) {
  'use strict';

  const U = BQ.util;

  // Ordenados de más conocidos a menos: el nivel define cuántos entran en juego.
  const ANIMALS = [
    { name: 'el perro', emoji: '🐶', sound: 'guau guau' },
    { name: 'el gato', emoji: '🐱', sound: 'miau miau' },
    { name: 'la vaca', emoji: '🐮', sound: 'mu mu' },
    { name: 'el pato', emoji: '🦆', sound: 'cua cua' },
    { name: 'el chancho', emoji: '🐷', sound: 'oinc oinc' },
    { name: 'la oveja', emoji: '🐑', sound: 'bee bee' },
    { name: 'el pollito', emoji: '🐤', sound: 'pío pío' },
    { name: 'el caballo', emoji: '🐴' },
    { name: 'el gallo', emoji: '🐓', sound: 'quiquiriquí' },
    { name: 'la rana', emoji: '🐸', sound: 'croac croac' },
    { name: 'el conejo', emoji: '🐰' },
    { name: 'el ratón', emoji: '🐭' },
    { name: 'el león', emoji: '🦁' },
    { name: 'el elefante', emoji: '🐘' },
    { name: 'el mono', emoji: '🐵' },
    { name: 'la jirafa', emoji: '🦒' },
    { name: 'el tigre', emoji: '🐯' },
    { name: 'el oso', emoji: '🐻' },
    { name: 'el pingüino', emoji: '🐧' },
    { name: 'la cebra', emoji: '🦓' },
    { name: 'el cocodrilo', emoji: '🐊' },
    { name: 'la tortuga', emoji: '🐢' },
    { name: 'el zorro', emoji: '🦊' },
    { name: 'el panda', emoji: '🐼' },
    { name: 'el pez', emoji: '🐟', habitat: 'agua' },
    { name: 'el pulpo', emoji: '🐙', habitat: 'agua' },
    { name: 'la ballena', emoji: '🐳', habitat: 'agua' },
    { name: 'el delfín', emoji: '🐬', habitat: 'agua' },
    { name: 'la mariposa', emoji: '🦋', habitat: 'aire' },
    { name: 'la abeja', emoji: '🐝', habitat: 'aire' },
    { name: 'el búho', emoji: '🦉', habitat: 'aire' },
    { name: 'el pajarito', emoji: '🐦', habitat: 'aire' },
  ];

  const POOL = [8, 12, 18, 24, ANIMALS.length];
  const LAND = ANIMALS.filter((a) => !a.habitat);
  const HABITATS = {
    agua: '¿Quién vive en el agua?',
    aire: '¿Quién puede volar?',
  };

  const poolFor = (level) => U.poolFor(ANIMALS, level, POOL);
  const pic = (a) => ({ type: 'emoji', emoji: a.emoji });

  BQ.registerWorld({
    id: 'animales',
    order: 2,
    name: 'Animales',
    sayName: 'el mundo de los animales',
    icon: '🦁',
    theme: {
      sky1: '#ffe9a8', sky2: '#ffc978', ground: '#d9b36c',
      card1: '#f7b733', card2: '#fc7c3c',
      decor: ['🌳', '🌴', '🌾', '☀️', '🌵'],
    },
    vehicle: { emoji: '🚙', flip: true, anim: 'bounce', rider: { bottom: '30%', left: '30%', size: 0.6 } },
    goal: '🏕️',

    questionTypes: [
      {
        id: 'nombre',
        weight: 3,
        make(level) {
          const pool = poolFor(level);
          const a = U.pick(pool);
          return BQ.question({
            key: 'nombre-' + a.emoji,
            say: `Tocá ${a.name}`,
            correct: pic(a),
            wrong: U.others(pool, 3, (x) => x === a).map(pic),
          });
        },
      },
      {
        id: 'sonido',
        minLevel: 2,
        weight: 2,
        make(level) {
          const pool = poolFor(level);
          const a = U.pick(pool.filter((x) => x.sound));
          return BQ.question({
            key: 'sonido-' + a.emoji,
            say: `¿Quién hace ${a.sound}?`,
            correct: pic(a),
            wrong: U.others(pool, 3, (x) => x === a).map(pic),
          });
        },
      },
      {
        id: 'donde-vive',
        minLevel: 4,
        weight: 1,
        make(level) {
          const habitat = U.pick(Object.keys(HABITATS));
          const a = U.pick(ANIMALS.filter((x) => x.habitat === habitat));
          return BQ.question({
            key: 'habitat-' + habitat,
            say: HABITATS[habitat],
            correct: pic(a),
            wrong: U.sample(LAND, 3).map(pic),
          });
        },
      },
    ],
  });
})(window.BQ);
