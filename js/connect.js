(function (BQ) {
  'use strict';

  const h = BQ.util.h;
  const NS = 'http://www.w3.org/2000/svg';

  // Posiciones (0..1) para 2 puntos por par: todos separados entre sí y
  // los dos extremos de cada par bien lejos, para que haya que "dibujar".
  function layout(pairs, w, h) {
    const px = (a, b) => Math.hypot((a.x - b.x) * w, (a.y - b.y) * h);
    const small = Math.min(w, h);
    const big = Math.max(w, h);
    for (let attempt = 0; attempt < 300; attempt++) {
      const pts = [];
      for (let i = 0; i < pairs * 2; i++) {
        let placed = null;
        for (let t = 0; t < 80 && !placed; t++) {
          const p = { x: 0.1 + Math.random() * 0.8, y: 0.14 + Math.random() * 0.72 };
          const apart = pts.every((q) => px(p, q) > small * 0.34);
          // Los dos puntos del par: a buena distancia en el lado largo del tablero
          const farFromPartner = i % 2 === 0 || px(p, pts[i - 1]) > Math.max(small * 0.62, big * 0.4);
          if (apart && farFromPartner) placed = p;
        }
        if (!placed) break;
        pts.push(placed);
      }
      if (pts.length === pairs * 2) return pts;
    }
    // Plan B: filas fijas, cada par de punta a punta
    return Array.from({ length: pairs * 2 }, (_, i) => ({
      x: i % 2 ? 0.85 : 0.15,
      y: (Math.floor(i / 2) + 0.5) / pairs,
    }));
  }

  /*
   * Tablero de "unir los puntos del mismo color" arrastrando el dedo.
   *   pairs: [{ name, hex }]  un color por par
   *   cb:    { onStart, onPair(color, restantes), onMiss, onDone }
   * Devuelve { hint, stopHint }.
   */
  BQ.connectBoard = function (board, pairs, cb) {
    const svg = document.createElementNS(NS, 'svg');
    svg.classList.add('board-svg');
    board.replaceChildren(svg);

    const box = board.getBoundingClientRect();
    const dots = layout(pairs.length, box.width, box.height).map((p, i) => {
      const el = h('div', { class: 'dot', style: { left: p.x * 100 + '%', top: p.y * 100 + '%', '--c': pairs[i >> 1].hex } });
      board.append(el);
      return { pair: i >> 1, p, el, done: false };
    });

    const lines = [];
    let active = null;
    let hand = null;

    const rect = () => board.getBoundingClientRect();
    const toPoint = (e) => {
      const r = rect();
      return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    };
    const pxDist = (a, b) => {
      const r = rect();
      return Math.hypot((a.x - b.x) * r.width, (a.y - b.y) * r.height);
    };
    // Radio de "llegada" generoso: los dedos chiquitos no son precisos
    const reach = () => dots[0].el.offsetWidth * 0.9;

    function draw(line) {
      const r = rect();
      line.el.setAttribute('points', line.pts.map((p) => `${(p.x * r.width).toFixed(1)},${(p.y * r.height).toFixed(1)}`).join(' '));
    }
    function resize() {
      const r = rect();
      svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
      lines.forEach(draw);
      if (active) draw(active);
    }
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(board);

    board.onpointerdown = (e) => {
      if (active) return;
      const p = toPoint(e);
      const from = dots.find((d) => !d.done && pxDist(d.p, p) < reach());
      if (!from) return;
      e.preventDefault();
      try { board.setPointerCapture(e.pointerId); } catch (err) { /* sigue funcionando sin captura */ }
      const el = document.createElementNS(NS, 'polyline');
      el.classList.add('trail');
      el.setAttribute('stroke', pairs[from.pair].hex);
      svg.append(el);
      active = { pair: from.pair, from, pts: [from.p, p], el, pointer: e.pointerId };
      from.el.classList.add('grab');
      draw(active);
      cb.onStart && cb.onStart();
    };

    board.onpointermove = (e) => {
      if (!active || e.pointerId !== active.pointer) return;
      const p = toPoint(e);
      active.pts.push(p);
      draw(active);
      const target = dots.find((d) => d !== active.from && d.pair === active.pair && pxDist(d.p, p) < reach());
      if (target) connect(target);
    };

    board.onpointerup = board.onpointercancel = (e) => {
      if (!active || e.pointerId !== active.pointer) return;
      const a = active;
      active = null;
      a.from.el.classList.remove('grab');
      a.el.classList.add('miss');
      setTimeout(() => a.el.remove(), 450);
      cb.onMiss && cb.onMiss();
    };

    function connect(target) {
      const a = active;
      active = null;
      a.pts.push(target.p);
      draw(a);
      a.el.classList.add('done');
      a.from.done = true;
      target.done = true;
      a.from.el.classList.remove('grab');
      a.from.el.classList.add('done');
      target.el.classList.add('done');
      lines.push(a);
      const left = pairs.length - lines.length;
      if (left === 0) {
        observer.disconnect();
        board.onpointerdown = board.onpointermove = board.onpointerup = board.onpointercancel = null;
        cb.onDone && cb.onDone();
      } else {
        cb.onPair && cb.onPair(pairs[a.pair], left);
      }
    }

    // Manito que muestra el recorrido del primer par sin unir
    function hint() {
      stopHint();
      const pending = dots.filter((d) => !d.done);
      if (!pending.length) return;
      const a = pending[0];
      const b = pending.find((d) => d !== a && d.pair === a.pair);
      const r = rect();
      hand = h('span', { class: 'hand emoji', style: { left: a.p.x * 100 + '%', top: a.p.y * 100 + '%' } }, '👆');
      board.append(hand);
      const dx = (b.p.x - a.p.x) * r.width;
      const dy = (b.p.y - a.p.y) * r.height;
      hand.animate([
        { transform: 'translate(0, 0)', opacity: 0 },
        { transform: 'translate(0, 0)', opacity: 1, offset: 0.15 },
        { transform: `translate(${dx}px, ${dy}px)`, opacity: 1, offset: 0.8 },
        { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
      ], { duration: 2000, iterations: 2, easing: 'ease-in-out' }).onfinish = stopHint;
    }
    function stopHint() {
      if (hand) hand.remove();
      hand = null;
    }

    return { hint, stopHint };
  };
})(window.BQ);
