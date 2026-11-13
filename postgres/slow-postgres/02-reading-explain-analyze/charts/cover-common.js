const fs = require('fs');
const { execFileSync } = require('child_process');
// the article charts' lime and ink on white; C.white is the text ink (the name is left from the dark version)
const C = { bg: '#FFFFFF', lime: '#C6F94A', white: '#0B0B0B', gray: '#6B6B6B' };
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "Menlo, SFMono-Regular, monospace";
const text = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-family="${o.mono ? MONO : SANS}" font-size="${o.size || 28}" fill="${o.fill || C.white}" font-weight="${o.weight || 400}" text-anchor="${o.anchor || 'start'}"${o.ls ? ` letter-spacing="${o.ls}"` : ''}${o.op ? ` opacity="${o.op}"` : ''}>${s}</text>`;
// deterministic noise so reruns give the same picture
const rng = (seed = 7) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const render = (name, defs, body) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs>${defs}</defs>
<rect width="1200" height="630" fill="${C.bg}"/>
${body}
</svg>`;
  fs.writeFileSync(`${__dirname}/${name}.svg`, svg);
  execFileSync('rsvg-convert', ['-z', '2', '-o', `${__dirname}/${name}.png`, `${__dirname}/${name}.svg`]);
};
module.exports = { C, text, rng, render };
