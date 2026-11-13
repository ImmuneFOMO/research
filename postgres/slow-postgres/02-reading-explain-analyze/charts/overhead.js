const { C, text, rect, svg } = require('./common');
const fs = require('fs');
const hosts = [
  ['mac-m3max', 'M3 Max laptop, macOS'],
  ['instabox-offload', 'AMD EPYC cloud VM, tsc clock'],
  ['alphavps-la', 'Xeon 8176 VPS, kvm-clock'],
  ['netcup-arm', 'ARM Neoverse-N1 VPS, arch timer'],
].map(([h, label]) => ({ label, ...JSON.parse(fs.readFileSync(`../bench/overhead-${h}.json`)) }));
const q = 'count';
const ratios = hosts.map(h => h.queries[q].median_ms.explain_analyze / h.queries[q].median_ms.plain);
const MAX = Math.max(...hosts.map(h => h.queries[q].median_ms.explain_analyze));
const X = 40, BW = 640, H0 = 360, GH = 236, BH = 34;
const ms = v => Math.round(v).toLocaleString('en-US') + ' ms';
let b = '';
b += text(40, 66, `EXPLAIN ANALYZE made count(*)`, { size: 46, weight: 500 });
b += text(40, 122, `${Math.min(...ratios).toFixed(1)} to ${Math.max(...ratios).toFixed(1)} times slower on all four machines`, { size: 46, weight: 500 });
b += text(40, 176, 'SELECT count(*) over 10 million rows in RAM,', { size: 28, fill: C.gray });
b += text(40, 212, 'PostgreSQL 17, one core, median of 7 runs', { size: 28, fill: C.gray });
[['plain query', C.lime, C.ink], ['EXPLAIN (ANALYZE, TIMING OFF)', C.silver, C.silver], ['EXPLAIN ANALYZE', C.ink, C.ink]].forEach(([s, f, st], i) => {
  b += rect(40, 244 + i * 38, 26, 26, { fill: f, stroke: st, rx: 3, sw: f === C.lime ? 2 : 0 }) + text(80, 266 + i * 38, s, { size: 26, fill: C.gray });
});
hosts.forEach((h, i) => {
  const y = H0 + 30 + i * GH, m = h.queries[q].median_ms;
  b += text(40, y + 22, h.label, { size: 28, weight: 700 });
  b += text(40, y + 58, `pg_test_timing: ${Math.round(h.pg_test_timing.per_loop_ns)} ns per loop`, { size: 26, fill: C.gray });
  [[m.plain, C.lime, ms(m.plain), 400], [m.timing_off, C.silver, ms(m.timing_off), 400], [m.explain_analyze, C.ink, `${ms(m.explain_analyze)}  ×${ratios[i].toFixed(1)}`, 700]].forEach(([v, f, s, wt], j) => {
    const w = BW * v / MAX, yy = y + 76 + j * (BH + 8);
    b += rect(X, yy, w, BH, { fill: f, stroke: f === C.lime ? C.ink : f, rx: 3, sw: f === C.lime ? 2 : 0 });
    b += text(X + w + 12, yy + 27, s, { size: 26, weight: wt });
  });
});
fs.writeFileSync('overhead.svg', svg(1000, H0 + 30 + hosts.length * GH - 10, b));
