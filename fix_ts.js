const fs = require('fs');
let content = fs.readFileSync('frontend/src/utils/drawTyphoon.ts', 'utf8');
content = content.replace(/  const maxCurRadius = Math.max\(\.\.\.\(cur\.stormRadii\|\|\[\]\)\.map\(\(r: any\)=>r\.radiusKm\), \.\.\.\(cur\.galeRadii\|\|\[\]\)\.map\(\(r: any\)=>r\.radiusKm\), 0\);\r?\n/, '');
fs.writeFileSync('frontend/src/utils/drawTyphoon.ts', content);
