const fs = require('fs');

function applyGeoJson(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  const newCodeStr = `    const targetMap = mapInstanceRef.current;
    if (targetMap) {
      fetch('/world_50m.geojson')
        .then(res => res.json())
        .then(data => {
          const bgLayer = L.geoJSON(data, {
            style: {
              fillColor: '#dcfce7',
              color: '#166534',
              weight: 1,
              fillOpacity: 1
            }
          });
          bgLayer.isBaseMap = true;
          bgLayer.addTo(targetMap);
        });
    }`;

  content = content.replace(/    \/\/ Pre-rendered 4K map background[\s\S]*?bgLayer\.addTo\(targetMap\);\r?\n    \}/, newCodeStr);
  fs.writeFileSync(filePath, content);
  console.log('Applied geojson to ' + filePath);
}

applyGeoJson('./frontend/src/App.tsx');
applyGeoJson('./frontend/src/ObsApp.tsx');
