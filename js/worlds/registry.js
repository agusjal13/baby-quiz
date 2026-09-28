(function (BQ) {
  'use strict';

  const U = BQ.util;

  /*
   * Registro de mundos. Cada mundo se define en su propio archivo con BQ.registerWorld({...}):
   *
   *   id, order            identificador y orden en el mapa
   *   name, sayName        nombre en pantalla y cómo lo dice la voz ("el mundo de los colores")
   *   icon                 emoji del mundo
   *   levels               cantidad de niveles (por defecto 5)
   *   questionsPerLevel    preguntas para completar un nivel (por defecto 5)
   *   theme                colores del fondo, de la tarjeta y emojis decorativos
   *   vehicle              medio de transporte del personaje en este mundo
   *   goal                 emoji de la meta al final del recorrido
   *   questionTypes        lista de generadores: { id, minLevel, weight, make(level) => pregunta }
   *
   * Cada generador arma preguntas al azar con BQ.question(), así nunca salen iguales.
   */
  BQ.worlds = [];

  BQ.registerWorld = function (def) {
    BQ.worlds.push(Object.assign({ levels: 5, questionsPerLevel: 5 }, def));
    BQ.worlds.sort((a, b) => a.order - b.order);
  };

  // Arma una pregunta con 1 opción correcta + las incorrectas, mezcladas.
  //   key:     identificador para no repetir la misma pregunta en un nivel
  //   say:     lo que dice la voz (y se muestra como texto)
  //   prompt:  imagen opcional que acompaña la pregunta
  //   correct / wrong: visuales (ver render.js)
  BQ.question = function ({ key, say, text, prompt, correct, wrong }) {
    return {
      key,
      say,
      text: text || say,
      prompt: prompt || null,
      options: U.shuffle([
        Object.assign({ correct: true }, correct),
        ...wrong.map((o) => Object.assign({ correct: false }, o)),
      ]),
    };
  };

  function weightedPick(types) {
    const total = types.reduce((sum, t) => sum + (t.weight || 1), 0);
    let r = Math.random() * total;
    for (const t of types) {
      r -= t.weight || 1;
      if (r <= 0) return t;
    }
    return types[types.length - 1];
  }

  // Genera la próxima pregunta evitando repetir las ya usadas en el nivel.
  BQ.nextQuestion = function (world, level, used) {
    const types = world.questionTypes.filter((t) => level >= (t.minLevel || 1));
    let q;
    for (let i = 0; i < 40; i++) {
      q = weightedPick(types).make(level);
      if (!used.has(q.key)) break;
    }
    used.add(q.key);
    return q;
  };
})(window.BQ);
