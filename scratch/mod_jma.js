const fs = require('fs');

const tangentMath = `const getOuterTangentPolygon = (points: { lat: number, lon: number, r: number }[]) => {
      if (!points || points.length <= 1) return [];
      
      const leftPoints: [number, number][] = [];
      const rightPoints: [number, number][] = [];
      
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

        leftPoints.push(toLatLng(p1, a1));
        if (i === points.length - 2) leftPoints.push(toLatLng(p2, a1));

        rightPoints.push(toLatLng(p1, a2));
        if (i === points.length - 2) rightPoints.push(toLatLng(p2, a2));
      }
      
      rightPoints.reverse();
      return [...leftPoints, ...rightPoints];
    };`;

function modifyAppAndObs() {
    ['frontend/src/App.tsx', 'frontend/src/ObsApp.tsx'].forEach(filepath => {
        let content = fs.readFileSync(filepath, 'utf8');

        // 1. Restore getOuterTangentPolygon
        content = content.replace(/const getOuterTangentPolygon = \(_points: any\) => \{ return \[\]; \};/g, tangentMath);
        content = content.replace(/const getOuterTangentPolygon = \(points: \{ lat: number, lon: number, r: number \}\[\]\) => \{ return \[\]; \};/g, tangentMath);

        // 2. Add forecast cone
        // Find: const forecastPolygon = getOuterTangentPolygon(forecastPoints);
        // Next lines should be:
        // if (forecastPolygon.length > 0) { ... }
        // If not present, inject it.
        const coneTarget = 'const forecastPolygon = getOuterTangentPolygon(forecastPoints);';
        if (content.includes(coneTarget)) {
            // Replace whatever is after it
            content = content.replace(
                /const forecastPolygon = getOuterTangentPolygon\(forecastPoints\);[^]+?(?=\/\/ 気象庁の非対称半径データ|const getTrueCircleFromRadii)/,
                `const forecastPolygon = getOuterTangentPolygon(forecastPoints);
    if (forecastPolygon.length > 0) {
      L.polygon(forecastPolygon, { color: '#ffffff', fillColor: 'transparent', weight: 1.5, dashArray: '5,5' }).addTo(map);
    }\n\n    `
            );
        } else {
            // Inject it after forecastPoints definition
            content = content.replace(
                /const forecastPoints = \[\{ lat, lon, r: 0 \}, \.\.\.forecasts\.map\(\(f: any\) => \(\{ lat: f\.lat, lon: f\.lon, r: f\.circleRadiusKm \|\| 0 \}\)\)\];/,
                `const forecastPoints = [{ lat, lon, r: 0 }, ...forecasts.map((f: any) => ({ lat: f.lat, lon: f.lon, r: f.circleRadiusKm || 0 }))];\n    const forecastPolygon = getOuterTangentPolygon(forecastPoints);\n    if (forecastPolygon.length > 0) {\n      L.polygon(forecastPolygon, { color: '#ffffff', fillColor: 'transparent', weight: 1.5, dashArray: '5,5' }).addTo(map);\n    }`
            );
        }

        // 3. Add storm cone
        // Find: const curStormRaw = getStormCircleForPoint(lat, lon, cur.stormRadii); ... stormPointsRaw.push ...
        // Then add L.polygon
        const stormRegex = /\/\/ 暴風警戒域の赤点線ポリゴン（stormPolygon）は非表示にするよう修正/;
        if (content.match(stormRegex)) {
            content = content.replace(
                stormRegex,
                `const stormPolygon = getOuterTangentPolygon(stormPointsRaw);
    if (stormPolygon.length > 0) {
      L.polygon(stormPolygon, { color: '#FF2800', fillColor: 'transparent', weight: 1.5 }).addTo(map);
    }`
            );
        }

        // 4. JMA style circles (No fill)
        // Gale circle
        content = content.replace(
            /color: '#FFD700', fillColor: '#FFD700', fillOpacity: 0\.15, weight: 1\.5, dashArray: '5,5'/g,
            `color: '#FFFF00', fillColor: 'transparent', weight: 2`
        );
        // Storm circle
        content = content.replace(
            /color: '#FF2800', fillColor: '#FF2800', fillOpacity: 0\.2, weight: 2/g,
            `color: '#FF2800', fillColor: 'transparent', weight: 2`
        );

        // 5. Forecast track line (Solid white)
        // Replace: color: '#ffffff', weight: 4, dashArray: '8,8', opacity: 1
        content = content.replace(
            /color: '#ffffff', weight: 4, dashArray: '8,8', opacity: 1/g,
            `color: '#ffffff', weight: 2, opacity: 1`
        );

        // 6. Forecast circle (White dashed, transparent)
        content = content.replace(
            /color: '#fff', fillColor: '#fff', fillOpacity: 0\.1, weight: 1\.5, dashArray: '5,5'/g,
            `color: '#ffffff', fillColor: 'transparent', weight: 1.5, dashArray: '5,5'`
        );
        content = content.replace(
            /color: '#555', fillColor: 'transparent', weight: 1\.5, dashArray: '6,4'/g,
            `color: '#ffffff', fillColor: 'transparent', weight: 1.5, dashArray: '5,5'`
        );

        fs.writeFileSync(filepath, content);
    });
}

modifyAppAndObs();
console.log("Success");
