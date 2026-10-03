const fs = require('fs');
const content = fs.readFileSync('frontend/src/ObsApp.tsx', 'utf8');

const replaced = content.replace(
  /    const trackPoints: \[number, number\]\[\] = \[\[lat, lon\]\];[\s\S]*?(?=    \/\/ マップの表示範囲を調整)/,
  `    const trackPoints = drawTyphoon(map, activeTyphoon, { isObs: true });\n`
);

fs.writeFileSync('frontend/src/ObsApp.tsx', replaced);
console.log('Successfully replaced logic in ObsApp.tsx');
