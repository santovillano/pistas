/* KERF · optimizador de cortes
 * Empaquetado tipo guillotina (cada corte va de lado a lado, como en una escuadradora).
 * Trabaja con enteros: valor * SCALE (4 decimales de la unidad elegida).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Packer = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCALE = 10000;
  function toInt(v) { return Math.round(v * SCALE); }
  function fromInt(v) { return v / SCALE; }

  function makeRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // Órdenes de colocación (mayor a menor)
  var SORTS = [
    function (a, b) { return b.w * b.h - a.w * a.h || a.i - b.i; },
    function (a, b) { return Math.max(b.w, b.h) - Math.max(a.w, a.h) || Math.min(b.w, b.h) - Math.min(a.w, a.h) || a.i - b.i; },
    function (a, b) { return Math.min(b.w, b.h) - Math.min(a.w, a.h) || Math.max(b.w, b.h) - Math.max(a.w, a.h) || a.i - b.i; },
    function (a, b) { return b.w - a.w || b.h - a.h || a.i - b.i; },
    function (a, b) { return b.h - a.h || b.w - a.w || a.i - b.i; },
    function (a, b) { return (b.w + b.h) - (a.w + a.h) || a.i - b.i; }
  ];
  var FITS = 3;    // 0 mejor lado corto, 1 mejor lado largo, 2 mejor área
  var RULES = 6;   // reglas para dividir el espacio libre tras colocar una pieza

  function fitScore(kind, F, pw, ph) {
    var dw = F.w - pw, dh = F.h - ph;
    var s = Math.min(dw, dh), l = Math.max(dw, dh);
    if (kind === 0) return [s, l];
    if (kind === 1) return [l, s];
    return [F.w * F.h - pw * ph, s];
  }
  function better(a, b) { return !b || a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]); }

  // true = corte horizontal primero (el espacio de abajo ocupa todo el ancho)
  function splitHorizontal(rule, F, pw, ph) {
    var w = F.w - pw, h = F.h - ph;
    switch (rule) {
      case 0: return w < h;
      case 1: return w >= h;
      case 2:
      case 3:
        var a1 = Math.min(w * ph, F.w * h);
        var a2 = Math.min(w * F.h, pw * h);
        return rule === 2 ? a1 <= a2 : a1 >= a2;
      case 4: return true;
      default: return false;
    }
  }

  function bestIn(sheet, si, orients, fitKind) {
    var cand = null;
    for (var fi = 0; fi < sheet.free.length; fi++) {
      var F = sheet.free[fi];
      for (var oi = 0; oi < orients.length; oi++) {
        var pw = orients[oi][0], ph = orients[oi][1];
        if (pw <= F.w && ph <= F.h) {
          var sc = fitScore(fitKind, F, pw, ph);
          if (better(sc, cand && cand.sc)) cand = { sc: sc, si: si, fi: fi, pw: pw, ph: ph, rot: orients[oi][2] };
        }
      }
    }
    return cand;
  }

  function place(sheet, c, item, k, rule) {
    var F = sheet.free[c.fi];
    var rw = F.w - c.pw - k, rh = F.h - c.ph - k;
    var r1, r2;
    sheet.free.splice(c.fi, 1);
    if (splitHorizontal(rule, F, c.pw, c.ph)) {
      r1 = { x: F.x + c.pw + k, y: F.y, w: rw, h: c.ph };
      r2 = { x: F.x, y: F.y + c.ph + k, w: F.w, h: rh };
    } else {
      r1 = { x: F.x + c.pw + k, y: F.y, w: rw, h: F.h };
      r2 = { x: F.x, y: F.y + c.ph + k, w: c.pw, h: rh };
    }
    if (r1.w > 0 && r1.h > 0) sheet.free.push(r1);
    if (r2.w > 0 && r2.h > 0) sheet.free.push(r2);
    sheet.placed.push({ x: F.x, y: F.y, w: c.pw, h: c.ph, rot: c.rot, num: item.num, label: item.label, copy: item.copy });
    sheet.used += c.pw * c.ph;
  }

  function packOnce(items, o, fitKind, rule, mode) {
    var sheets = [];
    var uw = o.W - 2 * o.margin, uh = o.H - 2 * o.margin;
    for (var n = 0; n < items.length; n++) {
      var it = items[n];
      var orients = (o.rotate && it.w !== it.h)
        ? [[it.w, it.h, false], [it.h, it.w, true]]
        : [[it.w, it.h, false]];
      var best = null;
      for (var si = 0; si < sheets.length; si++) {
        var cand = bestIn(sheets[si], si, orients, fitKind);
        if (!cand) continue;
        if (mode === 0) { best = cand; break; }       // primera plancha donde cabe
        if (better(cand.sc, best && best.sc)) best = cand; // mejor encaje entre todas
      }
      if (!best) {
        var ns = { free: [{ x: o.margin, y: o.margin, w: uw, h: uh }], placed: [], used: 0 };
        sheets.push(ns);
        best = bestIn(ns, sheets.length - 1, orients, fitKind);
      }
      place(sheets[best.si], best, it, o.kerf, rule);
    }
    return sheets;
  }

  function score(sheets) {
    var maxFree = 0;
    for (var i = 0; i < sheets.length; i++) {
      for (var j = 0; j < sheets[i].free.length; j++) {
        var f = sheets[i].free[j];
        if (f.w * f.h > maxFree) maxFree = f.w * f.h;
      }
    }
    return [sheets.length, -maxFree]; // menos planchas; a igualdad, el retazo libre más grande
  }

  /*
   * input: { W, H, kerf, margin, rotate, pieces: [{ num, label, w, h, qty }] }  (enteros)
   * budgetMs: tiempo máximo de búsqueda
   */
  function optimize(input, budgetMs) {
    var o = {
      W: input.W, H: input.H,
      kerf: Math.max(0, input.kerf || 0),
      margin: Math.max(0, input.margin || 0),
      rotate: !!input.rotate
    };
    var uw = o.W - 2 * o.margin, uh = o.H - 2 * o.margin;
    var items = [], unplaced = [], idx = 0;

    input.pieces.forEach(function (p, pi) {
      var num = p.num || (pi + 1);
      var fits = (p.w <= uw && p.h <= uh) || (o.rotate && p.h <= uw && p.w <= uh);
      if (!fits) { unplaced.push({ num: num, label: p.label || '', w: p.w, h: p.h, qty: p.qty }); return; }
      for (var c = 1; c <= p.qty; c++) items.push({ i: idx++, num: num, label: p.label || '', w: p.w, h: p.h, copy: c });
    });

    var bestSheets = [];
    if (items.length) {
      var t0 = Date.now();
      var limit = budgetMs == null ? 700 : budgetMs;
      var bestScore = null;
      var consider = function (sheets) {
        var sc = score(sheets);
        if (!bestScore || sc[0] < bestScore[0] || (sc[0] === bestScore[0] && sc[1] < bestScore[1])) {
          bestScore = sc; bestSheets = sheets;
        }
      };

      // 1) búsqueda ordenada: todas las combinaciones de criterio
      outer:
      for (var s = 0; s < SORTS.length; s++) {
        var sorted = items.slice().sort(SORTS[s]);
        for (var f = 0; f < FITS; f++) {
          for (var r = 0; r < RULES; r++) {
            for (var m = 0; m < 2; m++) {
              consider(packOnce(sorted, o, f, r, m));
              if (Date.now() - t0 > limit) break outer;
            }
          }
        }
      }

      // 2) búsqueda aleatoria con el tiempo que sobre
      var rnd = makeRng(20261119);
      var n = items.length;
      var tries = 0;
      while (Date.now() - t0 < limit && tries < 4000 && n > 1) {
        tries++;
        var arr = items.slice().sort(SORTS[Math.floor(rnd() * SORTS.length)]);
        var swaps = 1 + Math.floor(rnd() * Math.max(2, n / 6));
        var span = Math.max(2, Math.floor(n / 4));
        for (var q = 0; q < swaps; q++) {
          var a = Math.floor(rnd() * n);
          var b = Math.min(n - 1, Math.max(0, a + Math.floor((rnd() - 0.5) * 2 * span)));
          var tmp = arr[a]; arr[a] = arr[b]; arr[b] = tmp;
        }
        consider(packOnce(arr, o, Math.floor(rnd() * FITS), Math.floor(rnd() * RULES), rnd() < 0.5 ? 0 : 1));
      }
    }

    var totalArea = o.W * o.H;
    var used = 0, placedCount = 0;
    var outSheets = bestSheets.map(function (s, i) {
      used += s.used; placedCount += s.placed.length;
      return {
        index: i + 1,
        placed: s.placed,
        free: s.free,
        used: s.used,
        utilization: s.used / totalArea
      };
    });
    var wantedCount = items.length;
    return {
      sheets: outSheets,
      unplaced: unplaced,
      stats: {
        sheetCount: outSheets.length,
        pieceCount: placedCount,
        wantedCount: wantedCount,
        usedArea: used,
        totalArea: totalArea * outSheets.length,
        utilization: outSheets.length ? used / (totalArea * outSheets.length) : 0
      }
    };
  }

  return { SCALE: SCALE, toInt: toInt, fromInt: fromInt, optimize: optimize };
});
