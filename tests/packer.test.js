// Pruebas del optimizador: node tests/packer.test.js
const Packer = require('../app/src/main/assets/packer.js');
const S = Packer.SCALE;
let fails = 0;
function check(cond, msg) { if (!cond) { fails++; console.log('  FALLA:', msg); } }

// ¿se puede cortar de lado a lado? (propiedad guillotina) respetando el kerf
function guillotine(rects, k) {
  if (rects.length <= 1) return true;
  const cuts = [];
  rects.forEach(r => { cuts.push(['x', r.x + r.w]); cuts.push(['y', r.y + r.h]); });
  for (const [axis, c] of cuts) {
    const lo = [], hi = [];
    let ok = true;
    for (const r of rects) {
      const a = axis === 'x' ? r.x : r.y, l = axis === 'x' ? r.w : r.h;
      if (a + l <= c) lo.push(r);
      else if (a >= c + k) hi.push(r);
      else { ok = false; break; }
    }
    if (ok && lo.length && hi.length) return guillotine(lo, k) && guillotine(hi, k);
  }
  return false;
}

function verify(name, input, budget) {
  const t = Date.now();
  const res = Packer.optimize(input, budget);
  const ms = Date.now() - t;
  const k = input.kerf || 0, m = input.margin || 0;
  let total = 0;
  res.sheets.forEach(s => {
    s.placed.forEach(p => {
      check(p.x >= m && p.y >= m && p.x + p.w <= input.W - m && p.y + p.h <= input.H - m, name + ': pieza fuera de la plancha');
      total++;
    });
    for (let i = 0; i < s.placed.length; i++) for (let j = i + 1; j < s.placed.length; j++) {
      const a = s.placed[i], b = s.placed[j];
      const sepX = a.x + a.w + k <= b.x || b.x + b.w + k <= a.x;
      const sepY = a.y + a.h + k <= b.y || b.y + b.h + k <= a.y;
      check(sepX || sepY, name + ': piezas solapadas o sin espacio para el corte');
    }
    check(guillotine(s.placed, k), name + ': el diseño no se puede cortar de lado a lado');
  });
  const wanted = input.pieces.reduce((a, p) => a + p.qty, 0) - res.unplaced.reduce((a, p) => a + p.qty, 0);
  check(total === wanted, name + ': faltan piezas (' + total + ' de ' + wanted + ')');
  check(total === res.stats.pieceCount, name + ': conteo inconsistente');
  console.log(`${name}: ${res.stats.sheetCount} planchas, ${(res.stats.utilization * 100).toFixed(1)}% aprovechado, ${total} piezas, ${ms} ms, sin colocar: ${res.unplaced.length}`);
  return res;
}

const I = v => Math.round(v * S);
const mk = (list, o) => Object.assign({
  W: I(244), H: I(122), kerf: I(0.3), margin: 0, rotate: true,
  pieces: list.map((p, i) => ({ num: i + 1, label: '', w: I(p[0]), h: I(p[1]), qty: p[2] }))
}, o || {});

// 1. caso clásico de carpintería
verify('clásico', mk([[80, 40, 4], [60, 30, 6], [120, 50, 2], [45.5, 45.5, 8], [30, 20, 10]]), 300);

// 2. encaje perfecto: 4 piezas de 122x61 caben en una plancha sin kerf
const perfect = verify('perfecto', mk([[122, 61, 4]], { kerf: 0 }), 200);
check(perfect.stats.sheetCount === 1, 'perfecto: debería usar 1 plancha');

// 3. pieza que no cabe
const big = verify('no cabe', mk([[300, 200, 1], [50, 50, 2]]), 100);
check(big.unplaced.length === 1 && big.unplaced[0].num === 1, 'no cabe: debía quedar sin colocar la pieza 1');

// 4. rotación: 200x100 en plancha 100x200 sólo cabe girada
const rot = verify('rotación', mk([[200, 100, 1]], { W: I(100), H: I(200) }), 100);
check(rot.sheets[0].placed[0].rot === true, 'rotación: la pieza debía girarse');
const norot = verify('sin rotación', mk([[200, 100, 1]], { W: I(100), H: I(200), rotate: false }), 100);
check(norot.unplaced.length === 1, 'sin rotación: no debía caber');

// 5. margen de refilado
verify('margen', mk([[100, 50, 6], [70, 70, 3]], { margin: I(1) }), 200);

// 6. muchas piezas aleatorias (determinista)
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const many = []; for (let i = 0; i < 40; i++) many.push([10 + Math.floor(rnd() * 90), 10 + Math.floor(rnd() * 70), 1 + Math.floor(rnd() * 5)]);
verify('aleatorio x40', mk(many), 700);

// 7. unidades milímetros
verify('mm', { W: I(2440), H: I(1220), kerf: I(3), margin: 0, rotate: true,
  pieces: [[800, 400, 4], [600, 300, 6], [1200, 500, 2]].map((p, i) => ({ num: i + 1, label: '', w: I(p[0]), h: I(p[1]), qty: p[2] })) }, 200);

console.log(fails ? `\n${fails} fallas` : '\nTodo correcto');
process.exit(fails ? 1 : 0);
