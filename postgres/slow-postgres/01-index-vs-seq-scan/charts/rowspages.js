const { C, text, rect, svg } = require('./common');
const fs = require('fs');
// from 01_orders_lab.out: rows vs pages query, 221 pages, 30,000 rows
const data = [['paid', 27000, 221], ['created', 2700, 221], ['failed', 270, 207], ['chargeback', 30, 30]];
const ROWS = 30000, PAGES = 221, X = 40, BW = 620, H0 = 330, GH = 165, BH = 34;
const pct = v => v >= 10 ? Math.round(v) + '%' : (Math.round(v * 10) / 10) + '%';
let b = '';
b += text(40, 66, 'failed is 0.9% of the rows', { size: 44, weight: 500 });
b += text(40, 120, 'and sits on 94% of the pages', { size: 44, weight: 500 });
b += text(40, 176, '30,000 orders in 221 pages of 8 KB,', { size: 28, fill: C.gray });
b += text(40, 212, 'about 136 rows per page', { size: 28, fill: C.gray });
b += rect(40, 240, 26, 26, { fill: C.silver, stroke: C.silver, rx: 3, sw: 0 }) + text(80, 264, 'share of rows', { size: 26, fill: C.gray });
b += rect(300, 240, 26, 26, { fill: C.ink, rx: 3, sw: 0 }) + text(340, 264, 'share of pages that hold them', { size: 26, fill: C.gray });
data.forEach(([s, r, p], i) => {
  const y = H0 + i * GH, hot = s === 'failed';
  const rw = Math.max(3, BW * r / ROWS), pw = BW * p / PAGES;
  if (hot) b += `<rect x="14" y="${y - 12}" width="972" height="${GH - 8}" rx="10" fill="${C.lime}" opacity="0.35"/>`;
  b += text(40, y + 22, s, { size: 30, mono: true, weight: hot ? 700 : 400 });
  b += rect(X, y + 40, rw, BH, { fill: C.silver, stroke: C.silver, rx: 3, sw: 0 });
  b += text(X + rw + 14, y + 40 + 27, `${pct(100 * r / ROWS)}  ${r.toLocaleString('en-US')} rows`, { size: 26, fill: C.gray });
  b += rect(X, y + 40 + BH + 10, pw, BH, { fill: C.ink, rx: 3, sw: 0 });
  b += text(X + pw + 14, y + 40 + BH + 10 + 27, `${pct(100 * p / PAGES)}  ${p} pages`, { size: 26, weight: hot ? 700 : 400 });
});
fs.writeFileSync('rows-vs-pages.svg', svg(1000, H0 + data.length * GH - 20, b));
