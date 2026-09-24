const fs = require('fs');

function fixApp(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');

    // Remove linear-gradient in ObsApp
    if (filepath.includes('ObsApp.tsx')) {
        content = content.replace(
            /background: 'linear-gradient\([^)]+\)',\s*zIndex: 2,\s*pointerEvents: 'none'/g,
            `zIndex: 2, pointerEvents: 'none'`
        );

        // Scale info panel
        const infoPanelRegex = /\{\/\* 左側の情報パネル \*\/\}\s*<div style=\{\{([^]+?)gap: '40px'/;
        if (infoPanelRegex.test(content)) {
            content = content.replace(infoPanelRegex, `{/* 左側の情報パネル */}
      <div style={{$1gap: '40px', transform: 'scale(0.7)', transformOrigin: 'top left'`);
        }
    }

    // Set map background to dark sea color in both
    content = content.replace(
        /backgroundColor: '#e0f2fe'/g,
        `backgroundColor: '#475569'`
    );
    // For ObsApp, it might not have backgroundColor on the div
    if (filepath.includes('ObsApp.tsx')) {
        content = content.replace(
            /<div ref=\{mapRef\} style=\{\{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 \}\} \/>/,
            `<div ref={mapRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1, backgroundColor: '#475569' }} />`
        );
    }

    // Thick white dashed line for track
    // L.polyline(trackPoints, { color: '#333', weight: 2, dashArray: '8,6', opacity: 0.8 }).addTo(map);
    // or L.polyline(trackPoints, { color: '#333', weight: 2 }).addTo(map);
    content = content.replace(
        /L\.polyline\(trackPoints, \{ color: '#333', weight: 2[^}]*\}\)\.addTo\(map\);/g,
        `L.polyline(trackPoints, { color: '#ffffff', weight: 4, dashArray: '8,8', opacity: 1 }).addTo(map);`
    );

    // Thick red dashed line for forecast storm circle
    // radius: fStormCircle.radius * 1000, color: '#FF2800', fillColor: 'transparent', weight: 1.5, dashArray: '2,4'
    content = content.replace(
        /radius: (fStormCircle\.radius \* 1000), color: '#FF2800', fillColor: 'transparent', weight: 1\.5, dashArray: '(2,4|6,6)'/g,
        `radius: $1, color: '#FF2800', fillColor: 'transparent', weight: 3, dashArray: '8,8'`
    );
    // ObsApp might have different weights? Let's use a generic regex for the storm circle
    const stormCircleRegex = /const fStormCircle = getTrueCircleFromRadii[^]+?L\.circle\(\[fStormCircle\.lat, fStormCircle\.lon\], \{([^]+?)\}\)\.addTo\(map\);\s*\}/g;
    content = content.replace(stormCircleRegex, (match, p1) => {
        return match.replace(p1, `radius: fStormCircle.radius * 1000, color: '#FF2800', fillColor: 'transparent', weight: 3, dashArray: '8,8'`);
    });

    // Time label offset logic
    // We'll change the angle and offset to avoid black dots.
    // const angle = (idx % 2 === 0) ? -45 : 135; 
    // const labelOffsetKm = (fc.circleRadiusKm || 50) + 70;
    const offsetRegex = /const angle = \(idx % 2 === 0\) \? -45 : 135;\s*const labelOffsetKm = \(fc\.circleRadiusKm \|\| 50\) \+ 70;/g;
    content = content.replace(offsetRegex, `const angle = (idx % 2 === 0) ? -45 : 135;
      const labelOffsetKm = (fc.circleRadiusKm || 0) + 80;`);

    // Make label have a zIndexOffset so it sits above the dots
    content = content.replace(
        /iconSize: \[0, 0\](?:, iconAnchor: \[0, 0\], className: '')?/g,
        `iconSize: [0, 0], iconAnchor: [0, 0], className: ''`
    );
    content = content.replace(
        /L\.marker\(\[labelLat, labelLon\], \{ icon: labelIcon \}\)\.addTo\(map\);/g,
        `L.marker([labelLat, labelLon], { icon: labelIcon, zIndexOffset: 1000 }).addTo(map);`
    );

    // Remove tangent polygon completely
    const getOuterTangentPolygonRegex = /\/\/ 扇形（コーン）の外枠を計算するヘルパー[^]+?return \[\.\.\.leftPoints, \.\.\.rightPoints\];\s*\};/g;
    content = content.replace(getOuterTangentPolygonRegex, '');

    const stormPolygonRegex = /const outerPoints = getOuterTangentPolygon\(stormPointsRaw\);[^]+?\}\)\.addTo\(map\);\s*\}/g;
    content = content.replace(stormPolygonRegex, '');

    // In ObsApp, it might be already gone, but just in case:
    
    fs.writeFileSync(filepath, content);
}

fixApp('frontend/src/App.tsx');
fixApp('frontend/src/ObsApp.tsx');
console.log("Success");
