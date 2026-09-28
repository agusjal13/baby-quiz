(function (BQ) {
  'use strict';

  const U = BQ.util;

  const VOWELS = ['a', 'e', 'i', 'o', 'u'];
  const VOWEL_COLORS = { a: '#e53935', e: '#1e88e5', i: '#43a047', o: '#fb8c00', u: '#8e24aa' };

  const WORDS = [
    { word: 'avión', emoji: '✈️' },
    { word: 'abeja', emoji: '🐝' },
    { word: 'árbol', emoji: '🌳' },
    { word: 'araña', emoji: '🕷️' },
    { word: 'auto', emoji: '🚗' },
    { word: 'anillo', emoji: '💍' },
    { word: 'ardilla', emoji: '🐿️' },
    { word: 'elefante', emoji: '🐘' },
    { word: 'estrella', emoji: '⭐' },
    { word: 'escoba', emoji: '🧹' },
    { word: 'erizo', emoji: '🦔' },
    { word: 'enchufe', emoji: '🔌' },
    { word: 'escuela', emoji: '🏫' },
    { word: 'isla', emoji: '🏝️' },
    { word: 'iguana', emoji: '🦎' },
    { word: 'imán', emoji: '🧲' },
    { word: 'iglesia', emoji: '⛪' },
    { word: 'oso', emoji: '🐻' },
    { word: 'ojo', emoji: '👁️' },
    { word: 'oveja', emoji: '🐑' },
    { word: 'oreja', emoji: '👂' },
    { word: 'ola', emoji: '🌊' },
    { word: 'uva', emoji: '🍇' },
    { word: 'uno', emoji: '1️⃣' },
    { word: 'unicornio', emoji: '🦄' },
    { word: 'uña', emoji: '💅' },
  ];
  // Vocal inicial sin tilde (árbol => a)
  const first = (w) => w.word.normalize('NFD').charAt(0);

  // Hasta el nivel 3 mayúsculas; en el 4 minúsculas; en el 5 cualquiera de las dos.
  function caseFor(level) {
    if (level <= 3) return (s) => s.toUpperCase();
    if (level === 4) return (s) => s;
    return Math.random() < 0.5 ? (s) => s.toUpperCase() : (s) => s;
  }

  BQ.registerWorld({
    id: 'vocales',
    order: 4,
    name: 'Vocales',
    sayName: 'el mundo de las vocales',
    icon: '🅰️',
    theme: {
      sky1: '#a9ecff', sky2: '#e3f9ff', ground: '#3fb4e8',
      card1: '#36d1dc', card2: '#5b86e5',
      decor: ['🐚', '🌴', '⛅', '🐠', '🦀'],
    },
    vehicle: { emoji: '⛵', anim: 'sway', rider: { bottom: '16%', left: '2%', size: 0.55, front: true } },
    goal: '🏝️',

    questionTypes: [
      {
        id: 'tocar-letra',
        weight: 3,
        make(level) {
          const fmt = caseFor(level);
          const letter = (v) => ({ type: 'text', text: fmt(v), color: VOWEL_COLORS[v] });
          const v = U.pick(VOWELS);
          return BQ.question({
            key: 'letra-' + v,
            say: `Tocá la letra ${v}`,
            correct: letter(v),
            wrong: U.others(VOWELS, 3, (x) => x === v).map(letter),
          });
        },
      },
      {
        id: 'empieza-con',
        minLevel: 2,
        weight: 3,
        make(level) {
          const fmt = caseFor(level);
          const letter = (v) => ({ type: 'text', text: fmt(v), color: VOWEL_COLORS[v] });
          const w = U.pick(WORDS);
          const v = first(w);
          return BQ.question({
            key: 'empieza-' + w.word,
            say: `¿Con qué letra empieza ${w.word}?`,
            prompt: { type: 'emoji', emoji: w.emoji },
            correct: letter(v),
            wrong: U.others(VOWELS, 3, (x) => x === v).map(letter),
          });
        },
      },
      {
        id: 'que-empieza',
        minLevel: 3,
        weight: 2,
        make() {
          const v = U.pick(VOWELS);
          const others = U.others(VOWELS, 3, (x) => x === v);
          const wordFor = (x) => U.pick(WORDS.filter((w) => first(w) === x));
          return BQ.question({
            key: 'que-empieza-' + v,
            say: `¿Qué cosa empieza con la ${v}?`,
            correct: { type: 'emoji', emoji: wordFor(v).emoji },
            wrong: others.map((x) => ({ type: 'emoji', emoji: wordFor(x).emoji })),
          });
        },
      },
    ],
  });
})(window.BQ);
