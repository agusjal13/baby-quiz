(function (BQ) {
  'use strict';

  // Personajes elegibles. Para sumar uno nuevo, agregar una línea.
  //   name:  cómo lo nombra la voz
  //   badge: emoji chiquito que acompaña (opcional)
  //   flip:  espejar si el emoji mira hacia la izquierda
  BQ.characters = [
    { id: 'mago', name: 'el mago', emoji: '🧙' },
    { id: 'dragon', name: 'el dragón', emoji: '🐉' },
    { id: 'futbolista', name: 'el futbolista', emoji: '🧒', badge: '⚽' },
    { id: 'princesa', name: 'la princesa', emoji: '👸' },
    { id: 'unicornio', name: 'el unicornio', emoji: '🦄', flip: true },
    { id: 'duende', name: 'el duende', emoji: '🧝' },
    { id: 'hada', name: 'el hada', emoji: '🧚' },
    { id: 'dinosaurio', name: 'el dinosaurio', emoji: '🦖', flip: true },
    { id: 'robot', name: 'el robot', emoji: '🤖' },
    { id: 'superheroe', name: 'el superhéroe', emoji: '🦸' },
    { id: 'gatito', name: 'el gatito', emoji: '🐱' },
  ];
})(window.BQ);
