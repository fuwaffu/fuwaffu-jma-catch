const fs = require('fs');

function replaceInApp(filePath, isObs) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Add import if not present
  if (!content.includes('drawTyphoon')) {
    content = content.replace(
      /import L from 'leaflet';/,
      `import L from 'leaflet';\nimport { drawTyphoon } from './utils/drawTyphoon';`
    );
  }

  if (isObs) {
    // Replace lines in ObsApp.tsx
    // From `    // 台風マーカー（現在位置）を「×」印に` to `    // マップの表示範囲を調整`
    content = content.replace(
      /    \/\/ 台風マーカー（現在位置）を「×」印に[\s\S]*?(?=    \/\/ マップの表示範囲を調整)/,
      `    const trackPoints = drawTyphoon(map, typhoon, { isObs: true });\n`
    );
  } else {
    // Replace lines in App.tsx
    // From `    // 台風マーカー（現在位置）を「×」印に` to `    // 全体が見えるようにフィット`
    content = content.replace(
      /    \/\/ 台風マーカー（現在位置）を「×」印に[\s\S]*?(?=    \/\/ 全体が見えるようにフィット)/,
      `    const trackPoints = drawTyphoon(map, typhoon, { isObs: false, use24HourFormat });\n`
    );
  }

  fs.writeFileSync(filePath, content);
  console.log('Applied drawTyphoon to', filePath);
}

replaceInApp('./frontend/src/App.tsx', false);
replaceInApp('./frontend/src/ObsApp.tsx', true);
