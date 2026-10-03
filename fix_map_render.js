const fs = require('fs');

function replaceWithGeoJson(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace imageOverlay with fetch + L.geoJSON
  const imageOverlayCode = /      \/\/ Pre-rendered 4K map background[\s\S]*?bgLayer\.addTo\(targetMap\);\n      }/;
  
  const newCode = `      const targetMap = mapInstanceRef.current;
      if (targetMap) {
        // Fetch and draw GeoJSON instead of static image to guarantee 100% accurate coordinates
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
            bgLayer.addTo(targetMap);
          })
          .catch(err => console.error('Failed to load map data:', err));
      }`;

  content = content.replace(imageOverlayCode, newCode);
  fs.writeFileSync(filePath, content);
  console.log('Replaced map rendering in ' + filePath);
}

replaceWithGeoJson('./frontend/src/App.tsx');
replaceWithGeoJson('./frontend/src/ObsApp.tsx');
