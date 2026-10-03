const fs = require('fs');

function restoreDashes(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Restore dashArray to forecastPolygon
  content = content.replace(
    /L\.polyline\(forecastPolygon, \{ color: '#ffffff', fillColor: 'transparent', weight: 1\.5 \}\)/g,
    `L.polyline(forecastPolygon, { color: '#ffffff', fillColor: 'transparent', weight: 1.5, dashArray: '5,5' })`
  );

  // Restore dashArray to stormPolygon
  content = content.replace(
    /L\.polyline\(stormPolygon, \{ color: '#FF2800', fillColor: 'transparent', weight: 1\.5 \}\)/g,
    `L.polyline(stormPolygon, { color: '#FF2800', fillColor: 'transparent', weight: 1, dashArray: '5,5' })`
  );

  fs.writeFileSync(filePath, content);
  console.log('Restored dashes for', filePath);
}

restoreDashes('./frontend/src/App.tsx');
restoreDashes('./frontend/src/ObsApp.tsx');
