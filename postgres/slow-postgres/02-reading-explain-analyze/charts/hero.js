const { C, text, rect, line, svg } = require('./common');
const fs = require('fs');
// node by node from ../bench/02_plans.out, section 2: [name, depth, estimated rows, actual rows per loop, loops, note]
const out = fs.readFileSync('../bench/02_plans.out', 'utf8').split('### 2.')[1].split('### 3.')[0];
const nodes = [...out.matchAll(/^\s*(?:->\s+)?(\w[\w ]*?)(?: on (\w+) \w| using \w+ on (\w+) \w)?\s+\(cost=[\d.]+\.\.[\d.]+ rows=(\d+) width=\d+\) \(actual time=[\d.]+\.\.[\d.]+ rows=(\d+) loops=(\d+)\)/gm)]
  .map(m => ({ name: m[1] + (m[2] || m[3] ? ' ' + (m[2] || m[3]) : ''), est: +m[4], act: +m[5], loops: +m[6] }));
const fmt = n => n.toLocaleString('en-US');
const depth = [0, 1, 2, 3, 4, 4], ROW = 100, Y0 = 290, NX = 120, EX = 650, AX = 850;
let b = '';
b += text(40, 66, 'Read the plan from the bottom up', { size: 46, weight: 500 });
b += text(40, 116, 'The report query, rows per node: what the planner', { size: 29, fill: C.gray });
b += text(40, 154, 'expected and what EXPLAIN ANALYZE counted', { size: 29, fill: C.gray });
b += text(EX, Y0 - 50, 'expected', { size: 28, fill: C.gray, anchor: 'end' });
b += text(AX + 110, Y0 - 50, 'got', { size: 28, fill: C.gray, anchor: 'end' });
nodes.forEach((n, i) => {
  const y = Y0 + i * ROW, x = NX + depth[i] * 34, bad = n.act * n.loops > 10 * n.est * n.loops;
  if (n.name === 'Seq Scan users') b += `<rect x="78" y="${y - 48}" width="904" height="${ROW - 12}" rx="10" fill="${C.lime}" opacity="0.45"/>`;
  if (depth[i]) b += line(x - 22, y - 30, x - 22, y - 12, { stroke: C.silver, sw: 2 }) + line(x - 22, y - 12, x - 8, y - 12, { stroke: C.silver, sw: 2 });
  b += text(x, y, n.name, { size: 31, mono: true, weight: bad ? 700 : 400 });
  b += text(EX, y, fmt(n.est), { size: 31, anchor: 'end', fill: C.gray });
  b += text(AX + 110, y, fmt(n.act), { size: 31, anchor: 'end', weight: bad ? 700 : 400 });
  if (n.loops > 1) b += text(AX + 110, y + 36, `× ${fmt(n.loops)} loops`, { size: 26, anchor: 'end', weight: 700 });
});
const yb = Y0 + (nodes.length - 1) * ROW, yt = Y0;
b += line(46, yb + 20, 46, yt - 30, { sw: 3, arrow: true });
b += text(40, yb + 112, 'The first node where the guess is off by 50x is the', { size: 28 });
b += text(40, yb + 150, 'one to fix. Every node above it was planned around 300.', { size: 28 });
fs.writeFileSync('hero.svg', svg(1000, yb + 190, b));
