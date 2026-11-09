const { C, text, rect, line, svg } = require('./common');
const fs = require('fs');
const N = 23, W = 34, G = 5, X0 = 40, SH = 60;
const px = i => X0 + i * (W + G);
const strip = (y, hl = []) => Array.from({ length: N }, (_, i) =>
  rect(px(i), y, W, SH, { fill: hl.includes(i) ? C.lime : C.mist, rx: 4, sw: hl.includes(i) ? 3 : 1.5, stroke: hl.includes(i) ? C.ink : C.gray })).join('')
  + text(px(N) + 6, y + 42, '…', { size: 34, fill: C.gray });
let b = '';
b += text(40, 66, 'Two ways to read the same table', { size: 44, weight: 500 });
b += text(40, 140, 'Seq Scan', { size: 34, weight: 700 });
b += text(40, 178, 'every 8 KB page in order, every row checked', { size: 28, fill: C.gray });
b += strip(200);
b += line(px(0), 300, px(N) + 30, 300, { sw: 3, arrow: true });
b += text(40, 345, 'one long sequential read', { size: 26, fill: C.gray });

b += text(40, 425, 'Index Scan', { size: 34, weight: 700 });
b += text(40, 463, 'B-tree first, then one heap page per match', { size: 28, fill: C.gray });
const leafs = [110, 220, 330];
b += rect(160, 490, 120, 50, { fill: C.mist });
b += text(220, 524, 'root', { size: 26, anchor: 'middle' });
leafs.forEach((cx, i) => {
  const hit = i === 2;
  b += line(220, 540, cx, 575, { sw: 1.5, stroke: C.gray });
  b += rect(cx - 45, 575, 90, 50, { fill: hit ? C.ink : C.mist });
  b += text(cx, 609, 'leaf', { size: 26, anchor: 'middle', fill: hit ? '#FFFFFF' : C.ink });
});
const chipY = 700, chipW = 150, hy = 810, busY = 665;
const tids = [['(7,48)', 7], ['(14,96)', 14], ['(22,8)', 22]];
const cxs = tids.map(([, p]) => px(p) + W / 2);
b += line(330, 625, 330, busY, { sw: 2.5 });
b += line(330, busY, cxs[2], busY, { sw: 2.5 });
b += text(350, busY - 12, 'TID = (page, slot)', { size: 26, fill: C.gray });
tids.forEach(([t], i) => {
  const cx = cxs[i];
  if (i === 0) b += line(330, busY, 330, chipY - 6, { sw: 2.5, arrow: true });
  else b += line(cx, busY, cx, chipY - 6, { sw: 2.5, arrow: true });
  b += rect(cx - chipW / 2 + (i === 0 ? 0 : 0), chipY, chipW, 52, { fill: '#FFFFFF' });
  b += text(cx, chipY + 36, t, { size: 28, mono: true, anchor: 'middle' });
  b += line(cx, chipY + 52, cx, hy - 6, { sw: 2.5, arrow: true });
});
b += strip(hy, [7, 14, 22]);
b += text(40, hy + 112, 'heap pages: only the ones the TIDs point to', { size: 26, fill: C.gray });
['each TID is one trip', 'to its heap page,', 'plus a visibility check'].forEach((s, i) => { b += text(480, 520 + i * 38, s, { size: 28 }); });
fs.writeFileSync('hero.svg', svg(1000, 940, b));
