const { C, text, line, svg } = require('./common');
const fs = require('fs');
const R = JSON.parse(fs.readFileSync('../bench/results.json'));
const get = (t, path) => R.filter(r => r.table === t).map(r => ({ f: r.fraction_pct, ms: r.paths[path].median_ms, picked: r.paths[path].node === r.planner_default }));
const L = 100, Rr = 730, T = 300, B = 860, YMAX = 250, LX0 = -2, LX1 = Math.log10(50);
const X = f => L + (Math.log10(f) - LX0) / (LX1 - LX0) * (Rr - L);
const Y = ms => B - Math.min(ms, YMAX) / YMAX * (B - T);
let b = '';
b += text(40, 66, 'Where the index stops paying off', { size: 44, weight: 500 });
b += text(40, 118, '5M rows, all in RAM, one process,', { size: 28, fill: C.gray });
b += text(40, 154, 'median of 5 runs, PostgreSQL 17', { size: 28, fill: C.gray });
b += `<circle cx="54" cy="196" r="10" fill="${C.ink}" stroke="#FFFFFF" stroke-width="3"/>` + text(76, 205, 'the plan Postgres picked on its own', { size: 26, fill: C.gray });
for (let v = 0; v <= YMAX; v += 50) {
  b += line(L, Y(v), Rr, Y(v), { stroke: v ? '#E4E4E4' : C.gray, sw: v ? 1.5 : 2 });
  b += text(L - 14, Y(v) + 9, v, { size: 26, fill: C.gray, anchor: 'end' });
}
b += text(L - 14, T - 26, 'ms', { size: 26, fill: C.gray, anchor: 'end' });
[[0.01, '0.01%'], [0.1, '0.1%'], [1, '1%'], [10, '10%'], [50, '50%']].forEach(([f, s]) => {
  b += line(X(f), B, X(f), B + 10, { stroke: C.gray, sw: 2 });
  b += text(X(f), B + 44, s, { size: 26, fill: C.gray, anchor: 'middle' });
});
b += text((L + Rr) / 2, B + 90, 'share of rows that match (log scale)', { size: 26, fill: C.gray, anchor: 'middle' });
const path = (pts, o) => {
  // clip at YMAX by interpolating in (log x, linear y)
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.ms <= YMAX) { out.push([X(p.f), Y(p.ms)]); continue; }
    const q = pts[i - 1], t = (YMAX - q.ms) / (p.ms - q.ms);
    const lf = Math.log10(q.f) + t * (Math.log10(p.f) - Math.log10(q.f));
    out.push([X(10 ** lf), Y(YMAX)]); o.clipAt = 10 ** lf; break;
  }
  const d = out.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
  return (o.under ? `<path d="${d}" fill="none" stroke="${o.under}" stroke-width="${o.sw + 4}" stroke-linejoin="round" stroke-linecap="round"/>` : '')
    + `<path d="${d}" fill="none" stroke="${o.stroke}" stroke-width="${o.sw}" stroke-linejoin="round" stroke-linecap="round"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`;
};
const dots = pts => pts.filter(p => p.picked && p.ms <= YMAX).map(p => `<circle cx="${X(p.f)}" cy="${Y(p.ms)}" r="10" fill="${C.ink}" stroke="#FFFFFF" stroke-width="3"/>`).join('');
const seqS = get('t_scattered', 'seq'), seqC = get('t_clustered', 'seq');
const bmpS = get('t_scattered', 'bitmap'), idxS = get('t_scattered', 'index'), idxC = get('t_clustered', 'index');
b += path(seqS, { stroke: C.gray, sw: 4 }) + path(seqC, { stroke: C.gray, sw: 4, dash: '2 9' });
const o = {};
b += path(idxS, Object.assign(o, { stroke: C.ink, sw: 3, dash: '12 9' }));
b += path(bmpS, { stroke: C.ink, sw: 4 });
b += path(idxC, { stroke: C.lime, sw: 7, under: C.ink });
b += dots(seqS) + dots(bmpS) + dots(idxC);
const end = a => a[a.length - 1];
const LX = Rr + 16;
b += text(LX, Y(end(bmpS).ms) + 9, 'Bitmap scan,', { size: 26 }) + text(LX, Y(end(bmpS).ms) + 41, 'scattered rows', { size: 26 });
const sm = (Y(end(seqS).ms) + Y(end(seqC).ms)) / 2;
b += text(LX, sm - 4, 'Seq Scan', { size: 26, fill: C.gray, weight: 700 }) + text(LX, sm + 28, 'dotted: clustered', { size: 26, fill: C.gray });
b += text(LX, Y(end(idxC).ms) + 30, 'Index Scan,', { size: 26, weight: 700 }) + text(LX, Y(end(idxC).ms) + 62, 'clustered rows', { size: 26, weight: 700 });
const cx = X(o.clipAt);
b += line(cx, Y(YMAX) + 2, cx, T - 14, { sw: 2.5, arrow: true });
b += text(cx - 30, T + 34, 'Index Scan,', { size: 26, anchor: 'end' });
b += text(cx - 30, T + 66, 'scattered rows', { size: 26, anchor: 'end' });
b += text(cx - 30, T + 98, `${Math.round(idxS.find(p => p.f === 10).ms)} ms at 10%`, { size: 26, fill: C.gray, anchor: 'end' });
b += text(cx - 30, T + 130, `${(end(idxS).ms / 1000).toFixed(1)} s at 50%`, { size: 26, fill: C.gray, anchor: 'end' });
fs.writeFileSync('crossover.svg', svg(1000, B + 120, b));
