const { C, text, line, svg } = require('./common');
const fs = require('fs');
const R = JSON.parse(fs.readFileSync('../bench/cold_results_full.json'));
// planner picks don't depend on what's cached, so they come from the warm run's plain EXPLAIN
const W = JSON.parse(fs.readFileSync('../bench/results.json'));
const pick = (t, f) => W.find(r => r.table === t && r.fraction_pct === f).planner_default;
const get = (t, path) => R.filter(r => r.table === t && r.path === path).map(r => ({ f: r.fraction_pct, ms: r.median_ms, picked: r.node === pick(t, r.fraction_pct) }));
const L = 120, Rr = 940, T = 330, B = 860, YMAX = 1400, LX0 = -2, LX1 = Math.log10(50);
const X = f => L + (Math.log10(f) - LX0) / (LX1 - LX0) * (Rr - L);
const Y = ms => B - Math.min(ms, YMAX) / YMAX * (B - T);
// square = bitmap scan, diamond = index scan (scattered), circle = the rest; filled = plan Postgres picked
const mark = (shape, x, y, picked, r = 10) => {
  const f = picked ? C.ink : '#FFFFFF', a = `fill="${f}" stroke="${picked ? '#FFFFFF' : C.ink}" stroke-width="${picked ? 3 : 3}"`;
  if (shape === 'sq') return `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" ${a}/>`;
  if (shape === 'di') return `<path d="M${x} ${y - r * 1.4} L${x + r * 1.4} ${y} L${x} ${y + r * 1.4} L${x - r * 1.4} ${y} Z" ${a}/>`;
  return `<circle cx="${x}" cy="${y}" r="${r}" ${a}/>`;
};
let b = '';
b += text(40, 66, 'The same queries, read cold from disk', { size: 44, weight: 500 });
b += text(40, 118, 'Postgres restarted and OS cache dropped', { size: 28, fill: C.gray });
b += text(40, 154, 'before every run, median of 5', { size: 28, fill: C.gray });
b += mark('c', 54, 196, true) + text(76, 205, 'filled: the plan Postgres picked on its own', { size: 26, fill: C.gray });
for (let v = 0; v <= YMAX; v += 200) {
  b += line(L, Y(v), Rr, Y(v), { stroke: v ? '#E4E4E4' : C.gray, sw: v ? 1.5 : 2 });
  b += text(L - 14, Y(v) + 9, v.toLocaleString('en-US'), { size: 26, fill: C.gray, anchor: 'end' });
}
b += text(L - 14, T - 26, 'ms', { size: 26, fill: C.gray, anchor: 'end' });
[[0.01, '0.01%'], [0.1, '0.1%'], [1, '1%'], [10, '10%'], [50, '50%']].forEach(([f, s]) => {
  b += line(X(f), B, X(f), B + 10, { stroke: C.gray, sw: 2 });
  b += text(X(f), B + 44, s, { size: 26, fill: C.gray, anchor: 'middle' });
});
b += text((L + Rr) / 2, B + 90, 'share of rows that match (log scale)', { size: 26, fill: C.gray, anchor: 'middle' });
const path = (pts, o) => {
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
const dots = pts => pts.filter(p => p.picked && p.ms <= YMAX).map(p => mark('c', X(p.f), Y(p.ms), true)).join('');
const all = (shape, pts) => pts.filter(p => p.ms <= YMAX).map(p => mark(shape, X(p.f), Y(p.ms), p.picked, 9)).join('');
const seqS = get('t_scattered', 'seq'), seqC = get('t_clustered', 'seq');
const bmpS = get('t_scattered', 'bitmap'), idxS = get('t_scattered', 'index'), idxC = get('t_clustered', 'index');
b += path(seqS, { stroke: C.gray, sw: 4 }) + path(seqC, { stroke: C.gray, sw: 4, dash: '2 9' });
const o = {};
b += path(idxS, Object.assign(o, { stroke: C.ink, sw: 3, dash: '12 9' }));
b += path(bmpS, { stroke: C.ink, sw: 4 });
b += path(idxC, { stroke: C.lime, sw: 7, under: C.ink });
b += dots(seqS) + dots(idxC) + all('di', idxS) + all('sq', bmpS);
const at = (a, f) => a.find(p => p.f === f).ms;
b += text(640, Y(470), 'Seq Scan, both tables', { size: 26, fill: C.gray, weight: 700 });
const py = Y(at(bmpS, 1)), px1 = 226;
b += mark('sq', px1 - 24, py - 22, true, 9) + text(px1, py - 14, 'Bitmap scan, scattered:', { size: 26 });
b += text(px1, py + 18, `${(at(bmpS, 1) / 1000).toFixed(2)} s at 1%`, { size: 26, weight: 700 });
const cx = X(o.clipAt);
b += line(cx, Y(YMAX) + 2, cx, T - 14, { sw: 2.5, arrow: true });
const lx = cx + 28;
b += mark('di', lx + 10, T + 28, false, 9) + text(lx + 34, T + 36, 'Index Scan,', { size: 26 });
b += text(lx + 34, T + 68, 'scattered rows:', { size: 26 });
b += text(lx + 34, T + 100, `${(at(idxS, 5) / 1000).toFixed(1)} s at 5%`, { size: 26, fill: C.gray });
b += text(lx + 34, T + 132, `${(at(idxS, 50) / 1000).toFixed(1)} s at 50%`, { size: 26, fill: C.gray });
b += text(X(0.1) + 30, Y(0) - 26, 'Index Scan, clustered rows', { size: 26, weight: 700 });
fs.writeFileSync('cold.svg', svg(1000, B + 120, b));
