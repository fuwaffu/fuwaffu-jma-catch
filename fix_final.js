const fs = require('fs');

function fixFinal(filePath, isObs) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Update bounds to the new equirectangular map bounds
  content = content.replace(
    /const bounds: L\.LatLngBoundsExpression = \[\[-80, -180\], \[80, 180\]\];/,
    `const bounds: L.LatLngBoundsExpression = [[-80, -45], [80, 315]];`
  );

  if (isObs) {
    // Remove the gradient overlay div completely
    content = content.replace(
      /      \{\/\* グラデーションオーバーレイ[\s\S]*?\}\} \/>/,
      ``
    );
  }

  fs.writeFileSync(filePath, content);
  console.log('Fixed final for', filePath);
}

fixFinal('./frontend/src/App.tsx', false);
fixFinal('./frontend/src/ObsApp.tsx', true);
