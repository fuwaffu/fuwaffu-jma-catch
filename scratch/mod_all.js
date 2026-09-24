const fs = require('fs');

function applyChanges() {
    let app = fs.readFileSync('frontend/src/App.tsx', 'utf8');
    let obs = fs.readFileSync('frontend/src/ObsApp.tsx', 'utf8');

    // 1. Remove tangent polygon completely from both files
    const tangentRegex = /\/\/ ポリゴン生成ヘルパー[^]+?\/\/ 気象庁の非対称半径データから/g;
    app = app.replace(tangentRegex, '// 気象庁の非対称半径データから');
    obs = obs.replace(tangentRegex, '// 日付フォーマット関数\n    const formatForecastTime');
    
    // Also remove the storm polygon logic in App.tsx (if any left)
    app = app.replace(/const stormPointsRaw = \[curStormRaw\];[^]+?\/\/ 予報の赤点ポリゴン\(stormPolygon\)は非表示にするよう修正/g, '');

    // 2. Map container sea color
    // App.tsx has backgroundColor: '#e0f2fe'
    app = app.replace(/backgroundColor: '#e0f2fe'/g, "backgroundColor: '#475569'");
    // ObsApp.tsx needs background color on the map div
    obs = obs.replace(
        /<div ref=\{mapRef\} style=\{\{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 \}\} \/>/,
        `<div ref={mapRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1, backgroundColor: '#475569' }} />`
    );

    // 3. Thick white dashed line for track (進路線)
    // Both files have: L.polyline(trackPoints, { color: '#333', weight: 2, dashArray: '8,6', opacity: 0.8 }).addTo(map);
    // Or in ObsApp: L.polyline(trackPoints, { color: '#333', weight: 2 }).addTo(map);
    const trackRegex = /L\.polyline\(trackPoints, \{ color: '#333', weight: 2([^}]*)\}\)\.addTo\(map\);/g;
    app = app.replace(trackRegex, "L.polyline(trackPoints, { color: '#fff', weight: 4, dashArray: '8,8', opacity: 1 }).addTo(map);");
    obs = obs.replace(trackRegex, "L.polyline(trackPoints, { color: '#fff', weight: 4, dashArray: '8,8', opacity: 1 }).addTo(map);");

    // 4. Forecast storm warning circle (太めの赤点線)
    // weight: 1.5, dashArray: '2,4' -> weight: 3, dashArray: '8,8'
    const fStormRegex = /const fStormCircle = getTrueCircleFromRadii([^]+?)radius: fStormCircle\.radius \* 1000, color: '#FF2800', fillColor: 'transparent', weight: 1\.5, dashArray: '2,4'/g;
    app = app.replace(fStormRegex, "const fStormCircle = getTrueCircleFromRadii$1radius: fStormCircle.radius * 1000, color: '#FF2800', fillColor: 'transparent', weight: 3, dashArray: '8,8'");
    // ObsApp doesn't have fStormCircle rendering? Ah wait, in ObsApp it draws circles using `fc.stormRadii`. Let's check ObsApp later if needed. Wait, in ObsApp it does not draw the storm warning circle for forecasts.

    // 5. OBS App changes (Scale 0.7, remove gradient, add black dots)
    // Remove gradient
    obs = obs.replace(/\{\/\* グラデーションオーバーレイ \(情報が見やすいように\) \*\/\}[^]+?\}\} \/>/, "");
    // Scale info panel
    obs = obs.replace(
        /\{\/\* 左側の情報パネル \*\/\}\s*<div style=\{\{([^]+?)gap: '40px'/,
        `{/* 左側の情報パネル */}
      <div style={{$1gap: '40px', transform: 'scale(0.7)', transformOrigin: 'top left'`
    );
    // Add black dot
    const obsDotRegex = /\/\/ 黒点（fcIcon）は非表示にするよう修正/g;
    obs = obs.replace(obsDotRegex, `// 予報円の中心に黒点を表示
      L.circleMarker([fc.lat, fc.lon], {
        radius: 3,
        color: '#000',
        fillColor: '#000',
        fillOpacity: 1,
        weight: 1
      }).addTo(map);`);

    // 6. Time label avoiding black dots
    // offset label offset by 20 more, and add zIndexOffset
    const offsetAppRegex = /const labelOffsetKm = \(fc\.circleRadiusKm \|\| 50\) \+ 70;/g;
    app = app.replace(offsetAppRegex, "const labelOffsetKm = (fc.circleRadiusKm || 50) + 90;");
    
    const offsetObsRegex = /const labelOffsetKm = \(fc\.circleRadiusKm \|\| 50\) \+ 70;/g;
    obs = obs.replace(offsetObsRegex, "const labelOffsetKm = (fc.circleRadiusKm || 50) + 90;");

    app = app.replace(/iconSize: \[0, 0\], iconAnchor: \[0, 0\], className: ''/g, "iconSize: [0, 0], iconAnchor: [0, 0], className: ''");
    app = app.replace(/\{ icon: labelIcon \}\)/g, "{ icon: labelIcon, zIndexOffset: 1000 })");

    obs = obs.replace(/\{ icon: labelIcon \}\)/g, "{ icon: labelIcon, zIndexOffset: 1000 })");

    fs.writeFileSync('frontend/src/App.tsx', app);
    fs.writeFileSync('frontend/src/ObsApp.tsx', obs);
}

applyChanges();
console.log("Success");
