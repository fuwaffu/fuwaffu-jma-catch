const fs = require('fs');

function applyGeoJson(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Use a simpler string replacement
  const oldCodeStr = "    // Pre-rendered 4K map background (much lighter processing for OBS)\n    const bounds: L.LatLngBoundsExpression = [[-80, -45], [80, 315]];\n    const targetMap = mapInstanceRef.current;\n    if (targetMap) {\n      const bgLayer = L.imageOverlay('/map_bg.png', bounds);\n      (bgLayer as any).isBaseMap = true;\n      bgLayer.addTo(targetMap);\n    }";

  const newCodeStr = "    const targetMap = mapInstanceRef.current;\n    if (targetMap) {\n      fetch('/world_50m.geojson')\n        .then(res => res.json())\n        .then(data => {\n          // GeoJSON to render the exact geography accurately\n          const bgLayer = L.geoJSON(data, {\n            style: {\n              fillColor: '#dcfce7',\n              color: '#166534',\n              weight: 1,\n              fillOpacity: 1\n            }\n          });\n          (bgLayer as any).isBaseMap = true;\n          bgLayer.addTo(targetMap);\n        })\n        .catch(err => console.error('Map load error', err));\n    }";

  content = content.replace(oldCodeStr, newCodeStr);
  fs.writeFileSync(filePath, content);
  console.log('Applied geojson to ' + filePath);
}

applyGeoJson('./frontend/src/App.tsx');
applyGeoJson('./frontend/src/ObsApp.tsx');
