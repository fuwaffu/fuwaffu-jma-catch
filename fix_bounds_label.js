const fs = require('fs');

function fixApp(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(
    /const bounds: L\.LatLngBoundsExpression = \[\[-20, 70\], \[60, 180\]\];/,
    `const bounds: L.LatLngBoundsExpression = [[-80, -180], [80, 180]];`
  );

  content = content.replace(
    /const curLabelOffsetKm = 80;/,
    `const maxCurRadius = Math.max(...(cur.stormRadii||[]).map((r: any)=>r.radiusKm), ...(cur.galeRadii||[]).map((r: any)=>r.radiusKm), 0);
    const curLabelOffsetKm = maxCurRadius + 60;`
  );

  fs.writeFileSync(filePath, content);
  console.log('Fixed bounds and label for', filePath);
}

fixApp('./frontend/src/App.tsx');
fixApp('./frontend/src/ObsApp.tsx');
