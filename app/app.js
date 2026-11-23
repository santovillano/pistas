/* DECORTE · interfaz */
(function () {
  'use strict';

  var KEY = 'kerf.proyectos.v1'; // clave histórica, se mantiene para no perder proyectos
  var MM = { mm: 1, cm: 10, m: 1000 };
  var HUES = [188, 318, 86, 38, 222, 272, 346, 160];
  var S = Packer.SCALE;

  var st = { projects: [], view: 'list', id: null, tab: 'data', sheet: 0, modal: null };
  var $app = document.getElementById('app');
  var $modal = document.getElementById('modal');
  var $toast = document.getElementById('toast');
  var $busy = document.getElementById('busy');
  var saveTimer = null, toastTimer = null;

  /* ---------- utilidades ---------- */
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function round4(n) { return Math.round(n * 10000) / 10000; }
  function fmt(n) { return (n == null || isNaN(n)) ? '' : String(round4(n)); }
  function parseNum(s) {
    s = String(s).trim().replace(',', '.');
    return /^(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : null;
  }
  function parseQty(s) { s = String(s).trim(); return /^\d+$/.test(s) ? parseInt(s, 10) : null; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function hueOf(i) { return HUES[((i % HUES.length) + HUES.length) % HUES.length]; }
  function hash(str) { var h = 0; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; }
  function pct(x) { return (x * 100).toFixed(1).replace(/\.0$/, '') + '%'; }
  function cur() {
    for (var i = 0; i < st.projects.length; i++) if (st.projects[i].id === st.id) return st.projects[i];
    return null;
  }
  function countPieces(p) {
    var n = 0;
    p.pieces.forEach(function (q) { if (q.w > 0 && q.h > 0 && q.qty > 0) n += q.qty; });
    return n;
  }

  var PATHS = {
    back: '<path d="M15 4 7 12l8 8"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
    data: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    plan: '<path d="M4 4h16v16H4zM4 12h9M13 4v16"/>',
    bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>'
  };
  function ic(n, s) {
    s = s || 22;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square">' + PATHS[n] + '</svg>';
  }

  /* ---------- almacenamiento ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && Array.isArray(d.projects)) st.projects = d.projects;
      }
    } catch (e) { /* sin datos */ }
  }
  function save() {
    clearTimeout(saveTimer);
    try { localStorage.setItem(KEY, JSON.stringify({ projects: st.projects })); }
    catch (e) { toast('No se pudo guardar en el teléfono'); }
  }
  function touch(p) { p.updated = Date.now(); clearTimeout(saveTimer); saveTimer = setTimeout(save, 250); }
  function invalidate(p) {
    p.result = null; touch(p);
    var el = document.getElementById('pcount');
    if (el) el.textContent = countPieces(p);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);

  function toast(msg) {
    $toast.textContent = msg; $toast.className = 'show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $toast.className = ''; }, 2800);
  }

  /* ---------- modelo ---------- */
  function newProject(name, unit) {
    var f = MM[unit];
    return {
      id: uid(), name: name, unit: unit, created: Date.now(), updated: Date.now(),
      sheet: { w: round4(2440 / f), h: round4(1220 / f) },
      kerf: round4(3 / f), margin: 0, rotate: true,
      pieces: [{ id: uid(), name: '', w: null, h: null, qty: 1 }],
      result: null
    };
  }
  function changeUnit(p, nu) {
    if (p.unit === nu) return;
    var r = MM[p.unit] / MM[nu];
    function c(v) { return v == null ? null : round4(v * r); }
    p.sheet.w = c(p.sheet.w); p.sheet.h = c(p.sheet.h); p.kerf = c(p.kerf); p.margin = c(p.margin);
    p.pieces.forEach(function (q) { q.w = c(q.w); q.h = c(q.h); });
    p.unit = nu; p.result = null; touch(p);
  }

  function check(p) {
    var W = p.sheet.w, H = p.sheet.h;
    if (!(W > 0) || !(H > 0)) return { err: 'Indica el ancho y el alto de la plancha' };
    var k = p.kerf == null ? 0 : p.kerf, m = p.margin == null ? 0 : p.margin;
    if (m * 2 >= Math.min(W, H)) return { err: 'El margen es demasiado grande para la plancha' };
    var pieces = [];
    for (var i = 0; i < p.pieces.length; i++) {
      var q = p.pieces[i];
      if (q.w == null && q.h == null) continue;
      if (!(q.w > 0) || !(q.h > 0)) return { err: 'Pieza ' + (i + 1) + ': falta el ancho o el alto', pid: q.id };
      if (!(q.qty >= 1)) return { err: 'Pieza ' + (i + 1) + ': la cantidad debe ser 1 o más', pid: q.id };
      pieces.push({ num: i + 1, label: q.name || '', w: Packer.toInt(q.w), h: Packer.toInt(q.h), qty: q.qty });
    }
    if (!pieces.length) return { err: 'Añade al menos una pieza' };
    return { input: { W: Packer.toInt(W), H: Packer.toInt(H), kerf: Packer.toInt(k), margin: Packer.toInt(m), rotate: !!p.rotate, pieces: pieces } };
  }

  function optimize(p) {
    var chk = check(p);
    if (chk.err) {
      toast(chk.err);
      if (chk.pid) {
        var el = document.querySelector('[data-piece="' + chk.pid + '"]');
        if (el) { el.classList.add('err'); el.scrollIntoView({ block: 'center' }); }
      }
      return;
    }
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    $busy.hidden = false;
    setTimeout(function () {
      var res;
      try { res = Packer.optimize(chk.input, 900); }
      catch (e) { $busy.hidden = true; toast('No se pudo calcular el plano'); return; }
      p.result = { sheets: res.sheets, unplaced: res.unplaced, stats: res.stats, at: Date.now() };
      touch(p); save();
      $busy.hidden = true;
      st.tab = 'plan'; st.sheet = 0;
      render();
    }, 60);
  }

  /* ---------- dibujo de una plancha ---------- */
  function sheetSVG(p, sh, theme, sid) {
    var W = p.sheet.w, H = p.sheet.h, M = Math.max(W, H);
    var P = theme === 'print';
    var pad = M * 0.012;
    var col = P
      ? { bg: '#ffffff', edge: '#111111', hatch: '#a4a9b3', margin: '#777777' }
      : { bg: '#04060d', edge: '#14f1ff', hatch: 'rgba(130,150,225,.34)', margin: 'rgba(20,241,255,.4)' };
    var tile = M / 70;
    var o = [];
    o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (-pad) + ' ' + (-pad) + ' ' + (W + 2 * pad) + ' ' + (H + 2 * pad) + '" preserveAspectRatio="xMidYMid meet">');
    o.push('<defs><pattern id="h' + sid + '" width="' + tile + '" height="' + tile + '" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<line x1="0" y1="0" x2="0" y2="' + tile + '" stroke="' + col.hatch + '" stroke-width="' + (M / 800) + '"/></pattern></defs>');
    o.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + col.bg + '" stroke="' + col.edge + '" stroke-width="2" vector-effect="non-scaling-stroke"' +
      (P ? '' : ' style="filter:drop-shadow(0 0 3px rgba(20,241,255,.8))"') + '/>');
    if (p.margin > 0) {
      o.push('<rect x="' + p.margin + '" y="' + p.margin + '" width="' + (W - 2 * p.margin) + '" height="' + (H - 2 * p.margin) + '" fill="none" stroke="' + col.margin + '" stroke-width="1" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>');
    }
    sh.free.forEach(function (r) {
      o.push('<rect x="' + (r.x / S) + '" y="' + (r.y / S) + '" width="' + (r.w / S) + '" height="' + (r.h / S) + '" fill="url(#h' + sid + ')" stroke="' + col.hatch + '" stroke-width="1" vector-effect="non-scaling-stroke"/>');
    });
    var fam = P ? 'Arial,Helvetica,sans-serif' : 'Share Tech Mono,Roboto Mono,monospace';
    sh.placed.forEach(function (r) {
      var x = r.x / S, y = r.y / S, w = r.w / S, h = r.h / S, hh = hueOf(r.num - 1);
      var fill = P ? 'hsl(' + hh + ',70%,90%)' : 'hsla(' + hh + ',100%,55%,.17)';
      var stroke = P ? '#111111' : 'hsl(' + hh + ',100%,60%)';
      var txt = P ? '#111111' : 'hsl(' + hh + ',100%,80%)';
      o.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.6" vector-effect="non-scaling-stroke"' +
        (r.rot ? ' stroke-dasharray="5 3"' : '') + '/>');
      var dims = fmt(w) + '×' + fmt(h);
      var D = Math.min(h * 0.22, w / (dims.length * 0.72), M * 0.03);
      var showDims = D >= M * 0.011;
      var L = Math.min(h * (showDims ? 0.5 : 0.62), w * 0.6, M * 0.07);
      var showNum = L >= M * 0.013;
      var cx = x + w / 2, cy = y + h / 2;
      if (showNum) {
        var ny = showDims ? cy - D * 0.75 : cy;
        o.push('<text x="' + cx + '" y="' + ny + '" font-size="' + L + '" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="' + txt + '" font-family="' + fam + '">' + r.num + '</text>');
      }
      if (showDims) {
        var dy = showNum ? cy + L * 0.5 : cy;
        o.push('<text x="' + cx + '" y="' + dy + '" font-size="' + D + '" text-anchor="middle" dominant-baseline="central" fill="' + txt + '" font-family="' + fam + '" opacity=".92">' + dims + '</text>');
      }
    });
    o.push('</svg>');
    return o.join('');
  }

  /* ---------- vistas ---------- */
  function viewList() {
    var list = st.projects.slice().sort(function (a, b) { return b.updated - a.updated; });
    var body;
    if (!list.length) {
      body = '<div class="empty">' + ic('plan', 56) +
        '<h3>Sin proyectos</h3>' +
        '<p>Crea un proyecto, anota las piezas que necesitas y Decorte calcula cómo cortar la plancha con el menor desperdicio.</p></div>';
    } else {
      body = list.map(function (p) {
        var r = p.result, n = countPieces(p);
        var h = hueOf(hash(p.id));
        var meta = '<span><b>' + esc(p.unit.toUpperCase()) + '</b></span><span>' + n + ' pieza' + (n === 1 ? '' : 's') + '</span>' +
          (r ? '<span>' + r.stats.sheetCount + ' plancha' + (r.stats.sheetCount === 1 ? '' : 's') + '</span><span>' + pct(r.stats.utilization) + ' aprovechado</span>' : '<span>sin optimizar</span>');
        return '<div class="card" style="--hue:hsl(' + h + ',100%,60%)">' +
          '<button class="main" data-act="open" data-id="' + p.id + '"><div class="name">' + esc(p.name || 'Sin nombre') + '</div>' +
          '<div class="meta">' + meta + '</div>' +
          (r ? '<div class="util"><i style="width:' + Math.round(r.stats.utilization * 100) + '%"></i></div>' : '') + '</button>' +
          '<button class="del" data-act="ask-del" data-id="' + p.id + '" aria-label="Borrar proyecto">' + ic('trash') + '</button></div>';
      }).join('');
    }
    return '<div class="screen">' +
      '<div class="bar"><div class="grow"><div class="brand">DE<i>CORTE</i></div><div class="sub">optimizador de cortes</div></div><span class="ver">V1.0</span></div>' +
      '<div class="content">' + body + '<div style="height:12px"></div></div>' +
      '<div class="foot"><span class="glow"><button class="btn" data-act="new">' + ic('plus', 20) + ' Nuevo proyecto</button></span></div>' +
      '</div>';
  }

  function numField(label, bind, val, ph) {
    return '<div class="f"><label>' + label + '</label><input class="in" inputmode="decimal" autocomplete="off" data-bind="' + bind + '" value="' + esc(fmt(val)) + '" placeholder="' + (ph || '0') + '"></div>';
  }

  function pieceCard(q, i) {
    var h = hueOf(i);
    return '<div class="piece" data-piece="' + q.id + '" style="--hue:hsl(' + h + ',100%,60%)">' +
      '<div class="top"><div class="badge">' + (i + 1) + '</div>' +
      '<input class="in name" data-f="name" maxlength="30" autocomplete="off" placeholder="Nombre (opcional)" value="' + esc(q.name) + '">' +
      '<button class="ib danger" data-act="del-piece" data-pid="' + q.id + '" aria-label="Quitar pieza">' + ic('trash', 18) + '</button></div>' +
      '<div class="dims">' +
      '<div class="f"><label>Ancho</label><input class="in" inputmode="decimal" autocomplete="off" data-f="w" value="' + esc(fmt(q.w)) + '" placeholder="0"></div>' +
      '<div class="times">×</div>' +
      '<div class="f"><label>Alto</label><input class="in" inputmode="decimal" autocomplete="off" data-f="h" value="' + esc(fmt(q.h)) + '" placeholder="0"></div>' +
      '<div class="f"><label>Cant.</label><input class="in" inputmode="numeric" autocomplete="off" data-f="qty" value="' + esc(q.qty == null ? '' : q.qty) + '" placeholder="1"></div>' +
      '</div></div>';
  }

  function viewData(p) {
    var u = p.unit;
    var seg = ['cm', 'mm', 'm'].map(function (k) {
      return '<button class="' + (k === u ? 'on' : '') + '" data-act="unit" data-u="' + k + '">' + k + '</button>';
    }).join('');
    return '<section class="panel">' +
      '<h3 class="tag">Plancha</h3>' +
      '<div class="f"><label>Unidad de medida</label><div class="seg">' + seg + '</div></div>' +
      '<p class="hint">Al cambiar de unidad las medidas se convierten solas.</p>' +
      '<div class="row" style="margin-top:16px">' + numField('Ancho (' + u + ')', 'sheet.w', p.sheet.w) + '<div class="times">×</div>' + numField('Alto (' + u + ')', 'sheet.h', p.sheet.h) + '</div>' +
      '<div class="row">' + numField('Grosor del corte', 'kerf', p.kerf, '0') + numField('Margen de refilado', 'margin', p.margin, '0') + '</div>' +
      '<p class="hint">Grosor del corte: lo que se come el disco en cada pasada. Margen: borde de la plancha que se descarta.</p>' +
      '<div class="switch"><span>Permitir girar piezas 90°</span><button class="sw' + (p.rotate ? ' on' : '') + '" data-act="rot" aria-label="Girar piezas"></button></div>' +
      '</section>' +
      '<section class="panel mag">' +
      '<h3 class="tag">Piezas · <span id="pcount">' + countPieces(p) + '</span></h3>' +
      p.pieces.map(pieceCard).join('') +
      '<span class="glow mag flat"><button class="btn ghost mag sm" data-act="add-piece">' + ic('plus', 18) + ' Añadir pieza</button></span>' +
      '</section>' +
      '<div class="cta"><span class="glow"><button class="btn" data-act="optimize">' + ic('bolt', 20) + ' Optimizar</button></span></div>';
  }

  function viewPlan(p) {
    var r = p.result;
    if (!r) {
      return '<div class="empty">' + ic('plan', 56) + '<h3>Sin plano todavía</h3>' +
        '<p>Completa las medidas y pulsa optimizar para ver cómo cortar cada plancha.</p>' +
        '<span class="glow"><button class="btn" data-act="optimize">' + ic('bolt', 20) + ' Optimizar</button></span></div>';
    }
    var u = p.unit, f = MM[u] / 1000;
    function m2(a) { return a / S / S * f * f; }
    var st2 = r.stats;
    var totalWanted = st2.wantedCount + r.unplaced.reduce(function (a, q) { return a + q.qty; }, 0);
    var html = '';
    if (r.sheets.length) {
      html += '<div class="hud">' +
        '<div class="tile cy"><div class="k">Planchas</div><div class="v">' + st2.sheetCount + '</div></div>' +
        '<div class="tile li"><div class="k">Aprovechado</div><div class="v">' + (st2.utilization * 100).toFixed(1).replace(/\.0$/, '') + '<small>%</small></div></div>' +
        '<div class="tile ma"><div class="k">Desperdicio</div><div class="v">' + m2(st2.totalArea - st2.usedArea).toFixed(2) + '<small>m²</small></div></div>' +
        '<div class="tile am"><div class="k">Piezas</div><div class="v">' + st2.pieceCount + '<small>/ ' + totalWanted + '</small></div></div>' +
        '</div>';
      html += '<div class="spec">PLANCHA <b>' + fmt(p.sheet.w) + ' × ' + fmt(p.sheet.h) + ' ' + u + '</b> · CORTE <b>' + fmt(p.kerf || 0) + ' ' + u + '</b>' +
        (p.margin > 0 ? ' · MARGEN <b>' + fmt(p.margin) + ' ' + u + '</b>' : '') + '</div>';
      if (st.sheet >= r.sheets.length) st.sheet = 0;
      html += '<div class="chips">' + r.sheets.map(function (s, i) {
        return '<button class="chip' + (i === st.sheet ? ' on' : '') + '" data-act="sheet" data-i="' + i + '"><b>' + (i + 1 < 10 ? '0' : '') + (i + 1) + '</b><small>' + Math.round(s.utilization * 100) + '%</small></button>';
      }).join('') + '</div>';
      var sh = r.sheets[st.sheet];
      html += '<div class="board">' + sheetSVG(p, sh, 'neon', 'a') + '</div>';
      html += '<div class="spec" style="margin-top:10px">Zona rayada = sobrante · borde punteado = pieza girada 90°</div>';
      var counts = {};
      sh.placed.forEach(function (q) { counts[q.num] = (counts[q.num] || 0) + 1; });
      html += '<div class="legend">' + Object.keys(counts).map(Number).sort(function (a, b) { return a - b; }).map(function (n) {
        var q = p.pieces[n - 1] || {};
        return '<div class="leg" style="--hue:hsl(' + hueOf(n - 1) + ',100%,60%)"><div class="n">' + n + '</div>' +
          '<div class="t">' + esc(q.name ? q.name + ' · ' : '') + fmt(q.w) + ' × ' + fmt(q.h) + '</div><div class="c">×' + counts[n] + '</div></div>';
      }).join('') + '</div>';
    }
    r.unplaced.forEach(function (q) {
      html += '<div class="warn">Pieza ' + q.num + ' (' + fmt(q.w / S) + ' × ' + fmt(q.h / S) + ' ' + u + ') no cabe en la plancha' + (q.qty > 1 ? ' · ' + q.qty + ' unidades sin colocar' : '') + '.</div>';
    });
    html += '<div class="stack">' +
      (r.sheets.length ? '<span class="glow mag"><button class="btn mag" data-act="print">' + ic('print', 20) + ' Imprimir · PDF</button></span>' : '') +
      '<span class="glow flat"><button class="btn ghost sm" data-act="optimize">' + ic('bolt', 18) + ' Recalcular</button></span></div>';
    return html;
  }

  function tabBtn(id, label, icon) {
    return '<button class="' + (st.tab === id ? 'on' : '') + '" data-act="tab" data-t="' + id + '">' + icon + label + '</button>';
  }

  function viewProject() {
    var p = cur();
    if (!p) { st.view = 'list'; return viewList(); }
    return '<div class="screen">' +
      '<div class="bar"><button class="ib" data-act="back" aria-label="Volver">' + ic('back') + '</button>' +
      '<div class="grow"><div class="sub">Proyecto · ' + esc(p.unit) + '</div>' +
      '<input class="in title" data-bind="name" maxlength="40" autocomplete="off" value="' + esc(p.name) + '" placeholder="Nombre del proyecto"></div></div>' +
      '<div class="content">' + (st.tab === 'plan' ? viewPlan(p) : viewData(p)) + '</div>' +
      '<nav class="tabs">' + tabBtn('data', 'Datos', ic('data', 18)) + tabBtn('plan', 'Plano', ic('plan', 18)) + '</nav></div>';
  }

  function render(keep) {
    var c = $app.querySelector('.content');
    var sc = keep && c ? c.scrollTop : 0;
    $app.innerHTML = st.view === 'list' ? viewList() : viewProject();
    c = $app.querySelector('.content');
    if (c && sc) c.scrollTop = sc;
    renderModal();
  }

  function segUnits(sel) {
    return '<div class="seg">' + ['cm', 'mm', 'm'].map(function (k) {
      return '<button class="' + (k === sel ? 'on' : '') + '" data-act="modal-unit" data-u="' + k + '">' + k + '</button>';
    }).join('') + '</div>';
  }

  function renderModal() {
    var m = st.modal;
    if (!m) { $modal.className = ''; $modal.innerHTML = ''; return; }
    if (m.type === 'new') {
      $modal.innerHTML = '<div class="sheet-m"><h3 class="tag">Nuevo proyecto</h3>' +
        '<div class="f"><label>Nombre</label><input id="m-name" class="in" maxlength="40" autocomplete="off" placeholder="Ej: Closet dormitorio" value="' + esc(m.name || '') + '"></div>' +
        '<div class="f" style="margin-top:16px"><label>Unidad de medida</label>' + segUnits(m.unit) + '</div>' +
        '<div class="two"><button class="btn ghost sm" data-act="modal-close">Cancelar</button>' +
        '<span class="glow"><button class="btn sm" data-act="modal-create">Crear</button></span></div></div>';
      $modal.className = 'show';
      setTimeout(function () { var i = document.getElementById('m-name'); if (i) i.focus(); }, 60);
    } else if (m.type === 'delete') {
      var p = null;
      st.projects.forEach(function (q) { if (q.id === m.id) p = q; });
      if (!p) { st.modal = null; renderModal(); return; }
      $modal.innerHTML = '<div class="sheet-m mag"><h3 class="tag" style="color:var(--mag)">Borrar proyecto</h3>' +
        '<p>Se eliminará «' + esc(p.name || 'Sin nombre') + '» con todas sus piezas y su plano. No se puede deshacer.</p>' +
        '<div class="two"><button class="btn ghost sm" data-act="modal-close">Cancelar</button>' +
        '<span class="glow mag"><button class="btn mag sm" data-act="del-yes">Borrar</button></span></div></div>';
      $modal.className = 'show';
    }
  }

  /* ---------- impresión / PDF ---------- */
  function reportHTML(p) {
    var r = p.result, u = p.unit, f = MM[u] / 1000;
    function m2(a) { return (a / S / S * f * f).toFixed(2); }
    var date = new Date().toLocaleDateString('es-CL');
    var css = '@page{margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;font-size:12px}' +
      'h1{font-size:22px;margin:0 0 2px;letter-spacing:.04em}h2{font-size:15px;margin:0 0 6px}.muted{color:#555}' +
      '.page{page-break-after:always}.page:last-child{page-break-after:auto}' +
      'table{border-collapse:collapse;width:100%;margin-top:10px}th,td{border:1px solid #999;padding:5px 8px;text-align:left}th{background:#eee}' +
      '.kv{display:flex;flex-wrap:wrap;gap:6px 26px;margin:10px 0}.kv b{font-size:15px}' +
      '.box{height:170mm;border:0;margin-top:8px}.box svg{width:100%;height:100%}';
    var h = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(p.name) + '</title><style>' + css + '</style></head><body>';
    h += '<div class="page"><h1>DECORTE · ' + esc(p.name || 'Proyecto') + '</h1><div class="muted">Plan de cortes · ' + date + '</div>';
    h += '<div class="kv"><div>Plancha<br><b>' + fmt(p.sheet.w) + ' × ' + fmt(p.sheet.h) + ' ' + u + '</b></div>' +
      '<div>Grosor del corte<br><b>' + fmt(p.kerf || 0) + ' ' + u + '</b></div>' +
      (p.margin > 0 ? '<div>Margen<br><b>' + fmt(p.margin) + ' ' + u + '</b></div>' : '') +
      '<div>Planchas<br><b>' + r.stats.sheetCount + '</b></div>' +
      '<div>Aprovechado<br><b>' + pct(r.stats.utilization) + '</b></div>' +
      '<div>Desperdicio<br><b>' + m2(r.stats.totalArea - r.stats.usedArea) + ' m²</b></div></div>';
    h += '<h2>Lista de piezas</h2><table><tr><th>N°</th><th>Nombre</th><th>Ancho (' + u + ')</th><th>Alto (' + u + ')</th><th>Cant.</th></tr>';
    p.pieces.forEach(function (q, i) {
      if (q.w > 0 && q.h > 0) h += '<tr><td>' + (i + 1) + '</td><td>' + esc(q.name) + '</td><td>' + fmt(q.w) + '</td><td>' + fmt(q.h) + '</td><td>' + q.qty + '</td></tr>';
    });
    h += '</table>';
    r.unplaced.forEach(function (q) { h += '<p><b>No cabe:</b> pieza ' + q.num + ' (' + fmt(q.w / S) + ' × ' + fmt(q.h / S) + ' ' + u + ')</p>'; });
    h += '</div>';
    r.sheets.forEach(function (sh, i) {
      h += '<div class="page"><h2>Plancha ' + (i + 1) + ' de ' + r.sheets.length + ' · ' + pct(sh.utilization) + ' aprovechado</h2>';
      h += '<div class="muted">' + fmt(p.sheet.w) + ' × ' + fmt(p.sheet.h) + ' ' + u + ' · rayado = sobrante · borde punteado = girada 90°</div>';
      h += '<div class="box">' + sheetSVG(p, sh, 'print', 'p' + i) + '</div>';
      var counts = {}, rots = {};
      sh.placed.forEach(function (q) { counts[q.num] = (counts[q.num] || 0) + 1; if (q.rot) rots[q.num] = (rots[q.num] || 0) + 1; });
      h += '<table><tr><th>N°</th><th>Nombre</th><th>Medida (' + u + ')</th><th>Cant.</th><th>Giradas</th></tr>';
      Object.keys(counts).map(Number).sort(function (a, b) { return a - b; }).forEach(function (n) {
        var q = p.pieces[n - 1] || {};
        h += '<tr><td>' + n + '</td><td>' + esc(q.name) + '</td><td>' + fmt(q.w) + ' × ' + fmt(q.h) + '</td><td>' + counts[n] + '</td><td>' + (rots[n] || 0) + '</td></tr>';
      });
      h += '</table></div>';
    });
    return h + '</body></html>';
  }

  function printReport(p) {
    var html = reportHTML(p);
    var title = 'Decorte - ' + (p.name || 'Proyecto');
    if (window.Android && window.Android.printHtml) {
      window.Android.printHtml(html, title);
    } else {
      var w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); setTimeout(function () { w.focus(); w.print(); }, 350); }
      else toast('El navegador bloqueó la ventana de impresión');
    }
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t) return;
    var a = t.dataset.act, p = cur();
    switch (a) {
      case 'open':
        st.id = t.dataset.id; st.view = 'project'; p = cur();
        st.tab = p && p.result ? 'plan' : 'data'; st.sheet = 0; render(); break;
      case 'back': save(); st.view = 'list'; st.id = null; render(); break;
      case 'new': st.modal = { type: 'new', unit: 'cm', name: '' }; renderModal(); break;
      case 'modal-close': st.modal = null; renderModal(); break;
      case 'modal-unit':
        st.modal.unit = t.dataset.u;
        Array.prototype.forEach.call($modal.querySelectorAll('[data-act="modal-unit"]'), function (b) { b.classList.toggle('on', b === t); });
        break;
      case 'modal-create':
        var inp = document.getElementById('m-name');
        var name = (inp && inp.value.trim()) || ('Proyecto ' + (st.projects.length + 1));
        var np = newProject(name, st.modal.unit);
        st.projects.push(np); save();
        st.modal = null; st.id = np.id; st.view = 'project'; st.tab = 'data'; st.sheet = 0;
        render(); break;
      case 'ask-del': st.modal = { type: 'delete', id: t.dataset.id }; renderModal(); break;
      case 'del-yes':
        st.projects = st.projects.filter(function (q) { return q.id !== st.modal.id; });
        st.modal = null; save(); render(); toast('Proyecto borrado'); break;
      case 'tab': st.tab = t.dataset.t; render(); break;
      case 'unit': if (p) { changeUnit(p, t.dataset.u); render(true); } break;
      case 'rot': if (p) { p.rotate = !p.rotate; invalidate(p); t.classList.toggle('on', p.rotate); } break;
      case 'add-piece':
        if (p) {
          var q = { id: uid(), name: '', w: null, h: null, qty: 1 };
          p.pieces.push(q); invalidate(p); render(true);
          var el = document.querySelector('[data-piece="' + q.id + '"] [data-f="w"]');
          if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); }
        } break;
      case 'del-piece':
        if (p) {
          p.pieces = p.pieces.filter(function (x) { return x.id !== t.dataset.pid; });
          if (!p.pieces.length) p.pieces.push({ id: uid(), name: '', w: null, h: null, qty: 1 });
          invalidate(p); render(true);
        } break;
      case 'optimize': if (p) optimize(p); break;
      case 'sheet': st.sheet = parseInt(t.dataset.i, 10) || 0; render(true); break;
      case 'print': if (p && p.result) printReport(p); break;
    }
  });

  $app.addEventListener('input', function (e) {
    var t = e.target, p = cur();
    if (!p) return;
    var b = t.dataset.bind, fld = t.dataset.f, v;
    if (b) {
      if (b === 'name') { p.name = t.value; touch(p); return; }
      v = t.value.trim() === '' ? null : parseNum(t.value);
      t.classList.toggle('bad', t.value.trim() !== '' && v === null);
      if (b === 'sheet.w') p.sheet.w = v;
      else if (b === 'sheet.h') p.sheet.h = v;
      else if (b === 'kerf') p.kerf = v;
      else if (b === 'margin') p.margin = v;
      invalidate(p);
    } else if (fld) {
      var card = t.closest('[data-piece]'), q = null;
      p.pieces.forEach(function (x) { if (x.id === card.dataset.piece) q = x; });
      if (!q) return;
      card.classList.remove('err');
      if (fld === 'name') q.name = t.value;
      else if (fld === 'qty') { v = parseQty(t.value); t.classList.toggle('bad', t.value.trim() !== '' && v === null); q.qty = v; }
      else { v = t.value.trim() === '' ? null : parseNum(t.value); t.classList.toggle('bad', t.value.trim() !== '' && v === null); q[fld] = v; }
      invalidate(p);
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target && e.target.id === 'm-name') {
      var btn = $modal.querySelector('[data-act="modal-create"]');
      if (btn) btn.click();
    }
  });

  // Botón «atrás» del teléfono: devuelve true si la app lo gestionó
  window.onBack = function () {
    if (st.modal) { st.modal = null; renderModal(); return true; }
    if (st.view === 'project') { save(); st.view = 'list'; st.id = null; render(); return true; }
    return false;
  };

  load();
  render();

  // pantalla de entrada: se cierra sola o al tocarla
  (function () {
    var sp = document.getElementById('splash');
    if (!sp) return;
    var gone = false;
    function close() {
      if (gone) return; gone = true;
      sp.classList.add('out');
      setTimeout(function () { if (sp.parentNode) sp.parentNode.removeChild(sp); }, 600);
    }
    sp.addEventListener('click', close);
    setTimeout(close, 2900);
  })();
})();
