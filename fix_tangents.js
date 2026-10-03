const fs = require('fs');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace getOuterTangentPolygon with getOuterTangentSegments
  const newPolygonFunc = `    const getOuterTangentPolygon = (points: { lat: number, lon: number, r: number }[]) => {
      if (!points || points.length <= 1) return [];
      
      const segments: [number, number][][] = [];
      
      const getDistAndAngle = (p1: any, p2: any) => {
        const dLat = (p2.lat - p1.lat) * 111;
        const dLon = (p2.lon - p1.lon) * 111 * Math.cos((p1.lat + p2.lat) / 2 * Math.PI / 180);
        const dist = Math.sqrt(dLat * dLat + dLon * dLon);
        const angle = Math.atan2(dLat, dLon); 
        return { dist, angle };
      };

      const toLatLng = (p: any, angle: number): [number, number] => {
        return [
          p.lat + (p.r * Math.sin(angle)) / 111,
          p.lon + (p.r * Math.cos(angle)) / (111 * Math.cos(p.lat * Math.PI / 180))
        ];
      };

      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        if (!p1 || !p2) continue;
        const { dist, angle } = getDistAndAngle(p1, p2);
        
        if (dist <= Math.abs(p1.r - p2.r) || dist === 0) continue;

        const theta = Math.asin((p1.r - p2.r) / dist);
        const a1 = angle + Math.PI / 2 + theta;
        const a2 = angle - Math.PI / 2 - theta;

        segments.push([toLatLng(p1, a1), toLatLng(p2, a1)]);
        segments.push([toLatLng(p1, a2), toLatLng(p2, a2)]);
      }
      
      return segments;
    };`;

  content = content.replace(
    /    const getOuterTangentPolygon = \([\s\S]*?(?=    \/\/ 白色の予報円)/,
    newPolygonFunc + '\n\n'
  );

  content = content.replace(
    /    \/\/ 白色の予報円[\s\S]*?(?=    const forecastPolygon = getOuterTangentPolygon\(forecastPoints\);)/,
    `    // 白色の予報円（扇形外枠のみ）
    const forecastPoints = [{ lat, lon, r: 0 }, ...forecasts.map((f: any) => ({ lat: f.lat, lon: f.lon, r: f.circleRadiusKm || 0 }))];\n`
  );

  content = content.replace(
    /    const curStormRaw = getStormCircleForPoint\(lat, lon, cur\.stormRadii\);\s*const stormPointsRaw = \[curStormRaw\];[\s\S]*?(?=    const stormPolygon = getOuterTangentPolygon\(stormPointsRaw\);)/,
    `    const curStormRaw = getStormCircleForPoint(lat, lon, cur.stormRadii);
    const stormPointsRaw = [curStormRaw];
    for (const f of forecasts) {
      const p = getStormCircleForPoint(f.lat, f.lon, f.stormRadii);
      stormPointsRaw.push(p);
      if (p.r === 0) break; // 暴風域が0になった時点で先の予報を打ち切る
    }\n    \n`
  );

  fs.writeFileSync(filePath, content);
  console.log('Fixed tangents for', filePath);
}

fixFile('./frontend/src/App.tsx');
fixFile('./frontend/src/ObsApp.tsx');
