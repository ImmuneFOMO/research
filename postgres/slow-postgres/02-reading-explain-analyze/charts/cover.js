// white variant: one green fan, no ink strands; fewer lines read cleaner on white than 15,000 near-invisible ones
const { C, text, rng, render } = require('./cover-common');
const r = rng(42), X0 = 300, Y0 = 315, X1 = 1100, T = 92, B = 538, d = X1 - X0, N = +process.argv[2] || 2500, OP = process.argv[3] || '0.16';
const strand = () => {
  const y = (T + r() * (B - T)).toFixed(1), y0 = (Y0 + (r() - 0.5) * 3).toFixed(1);
  return `<path d="M${X0},${y0}C${(X0 + d * (0.3 + r() * 0.3)).toFixed(1)},${y0} ${(X1 - d * (0.25 + r() * 0.3)).toFixed(1)},${y} ${X1},${y}"/>`;
};
// solid greens per strand: a stroke gradient bands into vertical steps in rsvg/cairo once thousands of strokes overlap
const GREENS = ['#3F7D00', '#4F9208', '#62A812', '#76BC1E', '#8BD02A', '#A2E236'], fans = GREENS.map(() => '');
for (let i = 0; i < N; i++) fans[Math.floor(r() * GREENS.length)] += strand();
// the official 3-color Slonik, unmodified: the PostgreSQL trademark policy allows only its official color forms
const fs = require('fs'), slonik = fs.readFileSync(__dirname + '/slonik.svg', 'utf8').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const defs = '';
let b = '';
GREENS.forEach((c, i) => { b += `<g fill="none" stroke="${c}" stroke-width="0.6" stroke-opacity="${OP}">${fans[i]}</g>`; });
b += `<line x1="${X1}" y1="${T}" x2="${X1}" y2="${B}" stroke="#7DC21E" stroke-width="3"/>`;
b += `<circle cx="${X0}" cy="${Y0}" r="7" fill="${C.lime}" stroke="#0B0B0B" stroke-width="2"/>`;
b += `<svg x="76" y="92" width="80" height="82" viewBox="0 0 432.071 445.383">${slonik}</svg>`;
b += text(176, 162, '15,000', { size: 88, weight: 700, ls: -2 });
b += text(180, 204, 'index lookups', { mono: true, size: 22, fill: C.gray });
b += text(180, 236, 'planned: 300', { mono: true, size: 22, fill: C.white });
render('cover', defs, b);
