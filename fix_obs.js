const fs = require('fs');
const path = './frontend/src/ObsApp.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /\/\/ 白色の予報円（扇形外枠のみ）\r?\n\s*const forecastPoints = \[\{ lat, lon, r: 0 \}, \.\.\.forecasts\.map\(\(f: any\) => \(\{ lat: f\.lat, lon: f\.lon, r: f\.circleRadiusKm \|\| 0 \}\)\)\];\r?\n\s*const forecastPolygon = getOuterTangentPolygon\(forecastPoints\);\r?\n\s*if \(forecastPolygon\.length > 0\) \{\r?\n\s*L\.polygon\(forecastPolygon, \{ color: '#ffffff', fillColor: 'transparent', weight: 1\.5, dashArray: '5,5' \}\)\.addTo\(map\);\r?\n\s*\}/,
  `// 白色の予報円（扇形外枠のみ）
    const forecastPoints: { lat: number, lon: number, r: number }[] = [];
    if (forecasts.length > 0) {
      forecastPoints.push({ lat, lon, r: 0 }); // start point
      let lastTime = 0;
      for (const f of forecasts) {
        const time = new Date(f.dateTime).getTime();
        if (lastTime > 0 && time - lastTime < 12 * 3600 * 1000) {
          continue; 
        }
        forecastPoints.push({ lat: f.lat, lon: f.lon, r: f.circleRadiusKm || 0 });
        lastTime = time;
      }
    }
    const forecastPolygon = getOuterTangentPolygon(forecastPoints);
    if (forecastPolygon.length > 0) {
      L.polygon(forecastPolygon, { color: '#ffffff', fillColor: 'transparent', weight: 1.5, dashArray: '5,5' }).addTo(map);
    }`
);

content = content.replace(
  /const curStormRaw = getStormCircleForPoint\(lat, lon, cur\.stormRadii\);\r?\n\s*const stormPointsRaw = \[curStormRaw\];\r?\n\s*for \(const f of forecasts\) \{\r?\n\s*const p = getStormCircleForPoint\(f\.lat, f\.lon, f\.stormRadii\);\r?\n\s*stormPointsRaw\.push\(p\);\r?\n\s*if \(p\.r === 0\) break; \/\/ 暴風域が0になった時点で先の予報を打ち切る\r?\n\s*\}/,
  `const curStormRaw = getStormCircleForPoint(lat, lon, cur.stormRadii);
    const stormPointsRaw = [curStormRaw];
    let lastTimeStorm = 0;
    for (const f of forecasts) {
      const p = getStormCircleForPoint(f.lat, f.lon, f.stormRadii);
      if (p.r === 0) break; // 暴風域が0になった時点で先の予報を打ち切る
      
      const time = new Date(f.dateTime).getTime();
      if (lastTimeStorm > 0 && time - lastTimeStorm < 12 * 3600 * 1000) continue;
      
      stormPointsRaw.push(p);
      lastTimeStorm = time;
    }`
);

fs.writeFileSync(path, content);
console.log('Fixed ObsApp.tsx');
