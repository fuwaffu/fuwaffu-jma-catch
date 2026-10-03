const fs = require('fs');

function replaceInObs(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Add import if not present
  if (!content.includes('drawTyphoon')) {
    content = content.replace(
      /import L from 'leaflet';/,
      `import L from 'leaflet';\nimport { drawTyphoon } from './utils/drawTyphoon';`
    );
  }

  content = content.replace(
    /    \/\/ 台風の目・現在位置・マーカー[\s\S]*?(?=    \/\/ マップの表示範囲を調整)/,
    `    const trackPoints = drawTyphoon(map, activeTyphoon, { isObs: true });\n`
  );

  fs.writeFileSync(filePath, content);
  console.log('Applied drawTyphoon to ObsApp.tsx');
}

replaceInObs('./frontend/src/ObsApp.tsx');
