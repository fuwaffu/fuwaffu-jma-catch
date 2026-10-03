const fs = require('fs');
let content = fs.readFileSync('frontend/src/utils/drawTyphoon.ts', 'utf8');

// Fix cur.center.lat -> cur.lat
content = content.replace(
  /  const cur = typhoon\.current;\n  if \(!cur \|\| !cur\.center\) return \[\];\n\n  const lat = cur\.center\.lat;\n  const lon = cur\.center\.lon;/,
  `  const cur = typhoon.current || {};\n  const lat = cur.lat;\n  const lon = cur.lon;\n  if (!lat || !lon) return [];`
);

fs.writeFileSync('frontend/src/utils/drawTyphoon.ts', content);
console.log('Fixed drawTyphoon.ts lat/lon');
