const fs = require('fs');

function applyFix(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix the math: (p1.r - p2.r) -> (p2.r - p1.r)
  content = content.replace(
    /const theta = Math\.asin\(\(p1\.r - p2\.r\) \/ dist\);/g,
    `const theta = Math.asin((p2.r - p1.r) / dist);`
  );

  // Remove dashArray from forecastPolygon
  content = content.replace(
    /L\.polyline\(forecastPolygon, \{ color: '#ffffff', fillColor: 'transparent', weight: 1\.5, dashArray: '5,5' \}\)/g,
    `L.polyline(forecastPolygon, { color: '#ffffff', fillColor: 'transparent', weight: 1.5 })`
  );

  // Remove dashArray from stormPolygon
  content = content.replace(
    /L\.polyline\(stormPolygon, \{ color: '#FF2800', fillColor: 'transparent', weight: 1, dashArray: '5,5' \}\)/g,
    `L.polyline(stormPolygon, { color: '#FF2800', fillColor: 'transparent', weight: 1.5 })`
  );

  fs.writeFileSync(filePath, content);
  console.log('Fixed math and styles for', filePath);
}

applyFix('./frontend/src/App.tsx');
applyFix('./frontend/src/ObsApp.tsx');
