const fs = require('fs');

function syncObsApp(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Change `forecasts.forEach` to initialize `fStormCircles`
  content = content.replace(
    /    \/\/ 予報円とマーカー\r?\n    forecasts\.forEach/,
    `    // 予報円とマーカー
    const fStormCircles: {lat: number, lon: number, radius: number}[] = [];
    forecasts.forEach`
  );

  // Add the logic to collect `fStormCircle` inside the `forecasts.forEach` loop
  // I will place it right after `L.circleMarker` for the forecast point
  content = content.replace(
    /      \}\)\.addTo\(map\);\r?\n\r?\n      if \(fc\.circleRadiusKm > 0\) \{/,
    `      }).addTo(map);

      // 暴風域の予報円情報を収集（後で描画するため）
      const fStormCircle = getTrueCircleFromRadii(fc.lat, fc.lon, fc.stormRadii);
      if (fStormCircle && fStormCircle.radius > 0) {
        fStormCircles.push(fStormCircle);
      }

      if (fc.circleRadiusKm > 0) {`
  );

  // Ensure drawing the collected storm circles after `trackPoints`
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
  console.log('Synced ObsApp.tsx');
}

syncObsApp('./frontend/src/ObsApp.tsx');
