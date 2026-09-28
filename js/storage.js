(function (BQ) {
  'use strict';

  const KEY = 'babyquiz.v1';

  const defaults = () => ({
    character: null,
    progress: {}, // { [worldId]: último nivel completado }
    coins: 0,
    coinWorlds: [], // mundos que ya dieron su moneda
    wardrobe: {}, // { [charId]: { owned: [itemId], worn: [itemId] } }
    settings: { voiceURI: null, rate: 0.9, sfx: true },
  });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const def = defaults();
        return Object.assign(def, saved, { settings: Object.assign(def.settings, saved.settings) });
      }
    } catch (e) { /* sin almacenamiento: se juega igual, sin guardar */ }
    return defaults();
  }

  BQ.store = {
    data: load(),
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignorar */ }
    },
    completed(worldId) {
      return this.data.progress[worldId] || 0;
    },
    complete(worldId, level) {
      if (level > this.completed(worldId)) {
        this.data.progress[worldId] = level;
        this.save();
      }
    },
    // La primera vez que se completa un mundo se gana una moneda. Devuelve true si la dio.
    awardWorldCoin(worldId) {
      if (this.data.coinWorlds.includes(worldId)) return false;
      this.data.coinWorlds.push(worldId);
      this.data.coins++;
      this.save();
      return true;
    },
    resetProgress() {
      const settings = this.data.settings;
      this.data = defaults();
      this.data.settings = settings;
      this.save();
    },
  };
})(window.BQ);
