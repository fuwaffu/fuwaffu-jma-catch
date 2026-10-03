const fs = require('fs');

function fixApp(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(
    /      \/\/ 予報の暴風域（円で描画）\r?\n      const fStormCircle = getTrueCircleFromRadii\(fc\.lat, fc\.lon, fc\.stormRadii\);\r?\n      if \(fStormCircle && fStormCircle\.radius > 0\) \{\r?\n        L\.circle\(\[fStormCircle\.lat, fStormCircle\.lon\], \{ radius: fStormCircle\.radius \* 1000, color: '#FF2800', fillColor: 'transparent', weight: 3, dashArray: '6,6' \}\)\.addTo\(map\);\r?\n      \}/,
    `      // 暴風域の予報円情報を収集（後で描画するため）
      const fStormCircle = getTrueCircleFromRadii(fc.lat, fc.lon, fc.stormRadii);
      if (fStormCircle && fStormCircle.radius > 0) {
        fStormCircles.push(fStormCircle);
      }`
  );

  content = content.replace(
    /    \/\/ 予報進路（点線）と予報円\r?\n    forecasts\.forEach/,
    `    // 予報進路（点線）と予報円
    const fStormCircles: {lat: number, lon: number, radius: number}[] = [];
    forecasts.forEach`
  );

  content = content.replace(
    /    L\.polyline\(trackPoints, \{ color: '#ffffff', weight: 2, opacity: 1 \}\)\.addTo\(map\);\r?\n/,
    `    L.polyline(trackPoints, { color: '#ffffff', weight: 2, opacity: 1 }).addTo(map);

    // 予報の暴風域（進路予測よりもレイヤーを上にするため、後に描画）
    fStormCircles.forEach(c => {
      L.circle([c.lat, c.lon], { radius: c.radius * 1000, color: '#FF2800', fillColor: 'transparent', weight: 1.5, dashArray: '5,5' }).addTo(map);
    });
`
  );

  fs.writeFileSync(filePath, content);
  console.log('Fixed App.tsx order');
}

fixApp('./frontend/src/App.tsx');
