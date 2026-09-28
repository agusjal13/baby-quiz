(function (BQ) {
  'use strict';

  const KEY = 'babyquiz.v1';

  const defaults = () => ({
    character: null,
    progress: {}, // { [worldId]: último nivel completado }
    coins: 0,
    coinLevels: null, // niveles que ya dieron su moneda ("mundo:nivel")
    wardrobe: {}, // { [charId]: { owned: [itemId], worn: [itemId] } }
    settings: { voiceURI: null, rate: 0.9, sfx: true },
  });

  // Datos guardados con versiones anteriores: los niveles ya completados cuentan como cobrados
  // (antes la moneda se daba por mundo), así no se regalan monedas de golpe.
  function migrate(data) {
    if (!Array.isArray(data.coinLevels)) {
      data.coinLevels = [];
      for (const [worldId, done] of Object.entries(data.progress)) {
        for (let level = 1; level <= done; level++) data.coinLevels.push(`${worldId}:${level}`);
      }
    }
    delete data.coinWorlds;
    return data;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const def = defaults();
        return migrate(Object.assign(def, saved, { settings: Object.assign(def.settings, saved.settings) }));
      }
    } catch (e) { /* sin almacenamiento: se juega igual, sin guardar */ }
    return migrate(defaults());
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
    // La primera vez que se completa cada nivel se gana una moneda. Devuelve true si la dio.
    awardLevelCoin(worldId, level) {
      const key = `${worldId}:${level}`;
      if (this.data.coinLevels.includes(key)) return false;
      this.data.coinLevels.push(key);
      this.data.coins++;
      this.save();
      return true;
    },
    resetProgress() {
      const settings = this.data.settings;
      this.data = migrate(defaults());
      this.data.settings = settings;
      this.save();
    },
  };
})(window.BQ);
