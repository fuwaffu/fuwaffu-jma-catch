const fs = require('fs');

function applyImageOverlay(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');

    const fetchRegex = /fetch\('\/world\.geojson'\)[^]+?\.catch[^;]+;/;
    
    // Replace the GeoJSON load with ImageOverlay
    const overlayCode = `// Pre-rendered 4K map background (much lighter processing for OBS)
    const bounds: L.LatLngBoundsExpression = [[-20, 70], [60, 180]];
    const targetMap = mapInstanceRef ? mapInstanceRef.current : map;
    if (targetMap) {
      const bgLayer = L.imageOverlay('/map_bg.png', bounds);
      (bgLayer as any).isBaseMap = true;
      bgLayer.addTo(targetMap);
    }`;

    content = content.replace(fetchRegex, overlayCode);
    fs.writeFileSync(filepath, content);
}

applyImageOverlay('frontend/src/App.tsx');
applyImageOverlay('frontend/src/ObsApp.tsx');
console.log("Success");
