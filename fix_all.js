const fs = require('fs');

function fixApp(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Update bounds
  content = content.replace(
    /const bounds: L\.LatLngBoundsExpression = \[\[-20, 70\], \[60, 180\]\];/,
    `const bounds: L.LatLngBoundsExpression = [[-80, -180], [80, 180]];`
  );

  // Update curLabelOffsetKm
  content = content.replace(
    /const curLabelOffsetKm = 80;/,
    `const maxCurRadius = Math.max(...(cur.stormRadii||[]).map((r: any)=>r.radiusKm), ...(cur.galeRadii||[]).map((r: any)=>r.radiusKm), 0);
    const curLabelOffsetKm = maxCurRadius + 60;`
  );

  // Update map background color
  if (filePath.includes('App.tsx')) {
    content = content.replace(
      /<div ref=\{mapRef\} style=\{\{ width: '100%', height: '450px', backgroundColor: '#e2e8f0' \}\} \/>/,
      `<div ref={mapRef} style={{ width: '100%', height: '450px', backgroundColor: '#87cefa' }} />`
    );
  } else if (filePath.includes('ObsApp.tsx')) {
    content = content.replace(
      /backgroundColor: '#475569'/g, // This is only used for the map container in ObsApp.tsx
      `backgroundColor: '#87cefa'`
    );
  }

  fs.writeFileSync(filePath, content);
  console.log('Fixed for', filePath);
}

fixApp('./frontend/src/App.tsx');
fixApp('./frontend/src/ObsApp.tsx');
