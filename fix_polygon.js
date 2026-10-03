const fs = require('fs');

function applyFix(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // getOuterTangentPolygon の戻り値を変更 (配列の配列にする)
  content = content.replace(
    /rightPoints\.reverse\(\);\r?\n\s*return \[\.\.\.leftPoints, \.\.\.rightPoints\];/,
    `return [leftPoints, rightPoints];`
  );

  // forecastPolygon の描画を L.polygon から L.polyline に変更
  content = content.replace(
    /L\.polygon\(forecastPolygon, \{ color: '#ffffff', fillColor: 'transparent', weight: 1\.5, dashArray: '5,5' \}\)\.addTo\(map\);/g,
    `L.polyline(forecastPolygon, { color: '#ffffff', fillColor: 'transparent', weight: 1.5, dashArray: '5,5' }).addTo(map);`
  );

  // stormPolygon の描画を L.polygon から L.polyline に変更
  content = content.replace(
    /L\.polygon\(stormPolygon, \{ color: '#FF2800', fillColor: 'transparent', weight: 1, dashArray: '5,5' \}\)\.addTo\(map\);/g,
    `L.polyline(stormPolygon, { color: '#FF2800', fillColor: 'transparent', weight: 1, dashArray: '5,5' }).addTo(map);`
  );

  fs.writeFileSync(filePath, content);
  console.log('Fixed', filePath);
}

applyFix('./frontend/src/App.tsx');
applyFix('./frontend/src/ObsApp.tsx');
