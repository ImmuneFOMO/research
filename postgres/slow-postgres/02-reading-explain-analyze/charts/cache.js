const { C, text, rect, svg } = require('./common');
const fs = require('fs');
const J = f => JSON.parse(fs.readFileSync('../bench/' + f));
const warm = J('warm.json'), os = J('cold-oscache.json'), cold = J('cold.json');
// plain query time, no EXPLAIN: warm median of 7, the two restarts median of 5
const groups = [
  ['in shared_buffers', warm.report.median_ms.plain, warm.report_city_only.median_ms.plain],
  ['Postgres restarted, pages in the OS cache', os.report.median_ms.plain, os.report_city_only.median_ms.plain],
  ['restarted and OS cache dropped: from disk', cold.report.median_ms.plain, cold.report_city_only.median_ms.plain],
];
const reads = n => cold[n].explain_analyze[0].shared_read.toLocaleString('en-US');
const X = 40, BW = 600, MAX = Math.max(...groups.flat().filter(v => typeof v === 'number')), H0 = 330, GH = 190, BH = 40;
const ms = v => v >= 1000 ? (v / 1000).toFixed(2) + ' s' : Math.round(v) + ' ms';
let b = '';
b += text(40, 66, 'The wrong guess wins warm', { size: 46, weight: 500 });
b += text(40, 122, 'and loses from disk', { size: 46, weight: 500 });
b += text(40, 176, 'Same report, same 75,000 rows, plain query time,', { size: 28, fill: C.gray });
b += text(40, 212, 'median of 5 to 7 runs on a 4 vCPU cloud VM', { size: 28, fill: C.gray });
b += rect(40, 244, 26, 26, { fill: C.ink, rx: 3, sw: 0 }) + text(80, 266, 'Nested Loop: the plan for a guess of 300 users', { size: 26, fill: C.gray });
b += rect(40, 284, 26, 26, { fill: C.lime, stroke: C.ink, rx: 3, sw: 2 }) + text(80, 306, 'Hash Join: the plan when the guess is 15,000', { size: 26, fill: C.gray });
groups.forEach(([label, nl, hj], i) => {
  const y = H0 + 30 + i * GH, last = i === groups.length - 1;
  b += text(40, y + 22, label, { size: 28, weight: last ? 700 : 400 });
  const w1 = Math.max(4, BW * nl / MAX), w2 = Math.max(4, BW * hj / MAX);
  b += rect(X, y + 40, w1, BH, { fill: C.ink, rx: 3, sw: 0 });
  b += text(X + w1 + 14, y + 40 + 30, ms(nl), { size: 28, weight: 700 });
  if (last) b += text(X + w1 - 16, y + 40 + 30, `${reads('report')} pages read`, { size: 26, fill: '#FFFFFF', anchor: 'end' });
  b += rect(X, y + 40 + BH + 10, w2, BH, { fill: C.lime, stroke: C.ink, rx: 3, sw: 2 });
  b += text(X + w2 + 14, y + 40 + BH + 10 + 30, ms(hj) + (last ? `, ${reads('report_city_only')} pages read` : ''), { size: 28 });
});
fs.writeFileSync('cache.svg', svg(1000, H0 + 30 + groups.length * GH, b));
