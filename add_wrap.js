const fs = require('fs');

function addWorldWrap(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  const regex = /          const bgLayer = L\.geoJSON\(data, \{\s*style: \{\s*fillColor: '#dcfce7',\s*color: '#166534',\s*weight: 1,\s*fillOpacity: 1\s*\}\s*\}\);\s*\(bgLayer as any\)\.isBaseMap = true;\s*bgLayer\.addTo\(targetMap\);/g;

  const replaceStr = `          const style = { fillColor: '#dcfce7', color: '#166534', weight: 1, fillOpacity: 1 };
          const bgLayer = L.geoJSON(data, { style });
          (bgLayer as any).isBaseMap = true;
          bgLayer.addTo(targetMap);

          // ponytail: To prevent the map from cutting off at longitude 180 (right of Japan),
          // we add a second geojson layer shifted by +360 degrees.
          const shiftedData = JSON.parse(JSON.stringify(data));
          shiftedData.features.forEach((f: any) => {
            if (f.geometry) {
              const shiftCoords = (coords: any[]) => {
                if (typeof coords[0] === 'number') {
                  coords[0] += 360;
                } else {
                  coords.forEach(shiftCoords);
                }
              };
              shiftCoords(f.geometry.coordinates);
            }
          });
          const bgLayerRight = L.geoJSON(shiftedData, { style });
          (bgLayerRight as any).isBaseMap = true;
          bgLayerRight.addTo(targetMap);`;

  content = content.replace(regex, replaceStr);
  fs.writeFileSync(filePath, content);
}

addWorldWrap('./frontend/src/App.tsx');
addWorldWrap('./frontend/src/ObsApp.tsx');
console.log('Added world wrap to geojson rendering');
