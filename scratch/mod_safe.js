const fs = require('fs');

function safeReplace() {
    let app = fs.readFileSync('frontend/src/App.tsx', 'utf8');
    let obs = fs.readFileSync('frontend/src/ObsApp.tsx', 'utf8');

    // --- 1. ObsApp panel scale & gradient ---
    obs = obs.replace(
        /\{\/\* グラデーションオーバーレイ \(情報が見やすいように\) \*\/\}\s*<div style=\{\{\s*position: 'absolute',\s*top: 0, left: 0, right: 0, bottom: 0,\s*background: 'linear-gradient\([^)]+\)',\s*zIndex: 2,\s*pointerEvents: 'none'\s*\}\} \/>/g,
        ''
    );
    obs = obs.replace(
        /\{\/\* 左側の情報パネル \*\/\}\s*<div style=\{\{\s*position: 'absolute',\s*top: '80px',\s*left: '80px',\s*width: '520px',\s*zIndex: 10,\s*color: '#fff',\s*display: 'flex',\s*flexDirection: 'column',\s*gap: '40px'\s*\}\}>/g,
        `{/* 左側の情報パネル */}
      <div style={{
        position: 'absolute',
        top: '80px',
        left: '80px',
        width: '520px',
        zIndex: 10,
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: '40px',
        transform: 'scale(0.7)',
        transformOrigin: 'top left'
      }}>`
    );

    // --- 2. Sea Color ---
    app = app.replace(/backgroundColor: '#e0f2fe'/g, "backgroundColor: '#475569'");
    obs = obs.replace(
        /<div ref=\{mapRef\} style=\{\{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 \}\} \/>/,
        `<div ref={mapRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1, backgroundColor: '#475569' }} />`
    );

    // --- 3. Track Line ---
    app = app.replace(
        /L\.polyline\(trackPoints, \{ color: '#333', weight: 2, dashArray: '8,6', opacity: 0\.8 \}\)\.addTo\(map\);/g,
        `L.polyline(trackPoints, { color: '#ffffff', weight: 4, dashArray: '8,8', opacity: 1 }).addTo(map);`
    );
    obs = obs.replace(
        /L\.polyline\(trackPoints, \{ color: '#333', weight: 2 \}\)\.addTo\(map\);/g,
        `L.polyline(trackPoints, { color: '#ffffff', weight: 4, dashArray: '8,8', opacity: 1 }).addTo(map);`
    );

    // --- 4. Storm circle ---
    app = app.replace(
        /radius: fStormCircle\.radius \* 1000, color: '#FF2800', fillColor: 'transparent', weight: 1\.5, dashArray: '2,4'/g,
        `radius: fStormCircle.radius * 1000, color: '#FF2800', fillColor: 'transparent', weight: 3, dashArray: '6,6'`
    );
    // ObsApp actually doesn't have it natively for forecasts, but that's fine.

    // --- 5. Black dot in ObsApp ---
    obs = obs.replace(
        /\/\/ 黒点（fcIcon）は非表示にするよう修正\s*if \(fc\.circleRadiusKm > 0\) \{/g,
        `// 予報円の中心に黒点を表示
      L.circleMarker([fc.lat, fc.lon], {
        radius: 3,
        color: '#000',
        fillColor: '#000',
        fillOpacity: 1,
        weight: 1
      }).addTo(map);
      
      if (fc.circleRadiusKm > 0) {`
    );

    // --- 6. Time label offset & font ---
    const updateTimeLabel = (content) => {
        let res = content;
        res = res.replace(
            /const labelOffsetKm = \(fc\.circleRadiusKm \|\| 50\) \+ 70;/g,
            `const labelOffsetKm = (fc.circleRadiusKm || 50) + 90;`
        );
        res = res.replace(
            /\{ icon: labelIcon \}\)\.addTo\(map\);/g,
            `{ icon: labelIcon, zIndexOffset: 1000 }).addTo(map);`
        );
        
        // Font
        res = res.replace(/'LINE Seed JP'/g, "'Zen Kaku Gothic Paren', 'LINE Seed JP'");
        
        // Date format
        res = res.replace(
            /return `\$\{day\}日\(\$\{weekDay\}\) 午前0時`;/g,
            `return \`\$\{day\}日<span style="font-family: 'Zen Kaku Gothic New', sans-serif; font-weight: 900;">(</span>\$\{weekDay\}<span style="font-family: 'Zen Kaku Gothic New', sans-serif; font-weight: 900;">)</span> 午前0時\`;`
        );
        res = res.replace(
            /return `\$\{day\}日\(\$\{weekDay\}\) 午前\$\{hour\}時`;/g,
            `return \`\$\{day\}日<span style="font-family: 'Zen Kaku Gothic New', sans-serif; font-weight: 900;">(</span>\$\{weekDay\}<span style="font-family: 'Zen Kaku Gothic New', sans-serif; font-weight: 900;">)</span> 午前\$\{hour\}時\`;`
        );
        res = res.replace(
            /return `\$\{day\}日\(\$\{weekDay\}\) 午後0時`;/g,
            `return \`\$\{day\}日<span style="font-family: 'Zen Kaku Gothic New', sans-serif; font-weight: 900;">(</span>\$\{weekDay\}<span style="font-family: 'Zen Kaku Gothic New', sans-serif; font-weight: 900;">)</span> 午後0時\`;`
        );
        res = res.replace(
            /return `\$\{day\}日\(\$\{weekDay\}\) 午後\$\{hour - 12\}時`;/g,
            `return \`\$\{day\}日<span style="font-family: 'Zen Kaku Gothic New', sans-serif; font-weight: 900;">(</span>\$\{weekDay\}<span style="font-family: 'Zen Kaku Gothic New', sans-serif; font-weight: 900;">)</span> 午後\$\{hour - 12\}時\`;`
        );
        res = res.replace(
            /return `\$\{day\}日\(\$\{weekDay\}\) \$\{hour\}時`;/g,
            `return \`\$\{day\}日<span style="font-family: 'Zen Kaku Gothic New', sans-serif; font-weight: 900;">(</span>\$\{weekDay\}<span style="font-family: 'Zen Kaku Gothic New', sans-serif; font-weight: 900;">)</span> \$\{hour\}時\`;`
        );
        return res;
    };
    app = updateTimeLabel(app);
    obs = updateTimeLabel(obs);

    // Parentheses in ObsApp Title
    obs = obs.replace(
        /\(\{activeTyphoon\.nameEn\}\)/g,
        `<span style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 900 }}>(</span>{activeTyphoon.nameEn}<span style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 900 }}>)</span>`
    );

    // --- 7. Remove Tangent Polygon safely ---
    // Instead of complex regex, let's just make getOuterTangentPolygon return [] always!
    const makePolygonEmpty = (content) => {
        return content.replace(
            /const getOuterTangentPolygon = \(points: \{ lat: number, lon: number, r: number \}\[\]\) => \{([^]+?)return \[\.\.\.leftPoints, \.\.\.rightPoints\];\s*\};/g,
            `const getOuterTangentPolygon = (points: { lat: number, lon: number, r: number }[]) => { return []; };`
        );
    };
    app = makePolygonEmpty(app);
    obs = makePolygonEmpty(obs);

    // --- 8. Image Overlay ---
    const applyImage = (content) => {
        return content.replace(
            /fetch\('\/world\.geojson'\)[^]+?\.catch[^;]+;/g,
            `// Pre-rendered 4K map background (much lighter processing for OBS)
    const bounds: L.LatLngBoundsExpression = [[-20, 70], [60, 180]];
    const targetMap = mapInstanceRef.current;
    if (targetMap) {
      const bgLayer = L.imageOverlay('/map_bg.png', bounds);
      (bgLayer as any).isBaseMap = true;
      bgLayer.addTo(targetMap);
    }`
        );
    };
    app = applyImage(app);
    obs = applyImage(obs);

    fs.writeFileSync('frontend/src/App.tsx', app);
    fs.writeFileSync('frontend/src/ObsApp.tsx', obs);
}

safeReplace();
console.log("Success");
