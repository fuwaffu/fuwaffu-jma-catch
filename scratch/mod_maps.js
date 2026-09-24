const fs = require('fs');

function modifyFile(filepath, isObs) {
    let content = fs.readFileSync(filepath, 'utf8');

    // 1. Map container background
    if (!isObs) {
        content = content.replace(
            `backgroundColor: '#e2e8f0'`,
            `backgroundColor: '#e0f2fe'`
        );
    } else {
        // OBS background is handled via CSS, but let's see. 
        // In ObsApp, it's just 'transparent'. If we want it to be light blue, we should set it on the map div or body.
        // The user wanted "もしデザインの調整が可能であれば、海岸線を濃い緑、陸地を薄い緑で示せるようにしたいです。"
        // But what about the ocean? It's fine to keep the default or light blue.
    }

    // 2. Replace tileLayer with GeoJSON
    const tileLayerRegex = /L\.tileLayer\('https:\/\/server\.arcgisonline\.com[^]+?\}\)\.addTo\((map|mapInstanceRef\.current)\);/;
    const geoJsonReplacement = `fetch('/world.geojson')
      .then(res => res.json())
      .then(data => {
        const targetMap = mapInstanceRef ? mapInstanceRef.current : map;
        if (!targetMap) return;
        const geoLayer = L.geoJSON(data, {
          style: {
            color: '#166534',
            weight: 1,
            fillColor: '#dcfce7',
            fillOpacity: 1
          }
        });
        geoLayer.isBaseMap = true;
        geoLayer.addTo(targetMap);
      })
      .catch(e => console.error('Failed to load map geojson', e));`;

    content = content.replace(tileLayerRegex, geoJsonReplacement);

    // 3. Prevent clearing isBaseMap layers
    const clearLayerRegex = /map\.eachLayer\(\(layer\) => \{\s*if \(!\(layer instanceof L\.TileLayer\)\) \{\s*map\.removeLayer\(layer\);\s*\}\s*\}\);/;
    const newClearLayer = `map.eachLayer((layer: any) => {
      if (!layer.isBaseMap) {
        map.removeLayer(layer);
      }
    });`;
    
    if (clearLayerRegex.test(content)) {
        content = content.replace(clearLayerRegex, newClearLayer);
    } else {
        // App.tsx doesn't clear layers as it re-creates the map, so it's fine.
    }

    // 4. Add black dot for forecasts
    // App.tsx
    if (!isObs) {
        const appForecastRegex = /\/\/ 予報円の中心にマーカー \(非表示\)/;
        if (appForecastRegex.test(content)) {
            content = content.replace(appForecastRegex, `// 予報円の中心に黒点を表示 (現在位置以外の予報点)
      L.circleMarker([fc.lat, fc.lon], {
        radius: 3,
        color: '#000',
        fillColor: '#000',
        fillOpacity: 1,
        weight: 1
      }).addTo(map);`);
        }
    } else {
        // ObsApp.tsx
        const obsForecastRegex = /\/\/ 予報円の中心にマーカー \(非表示\)/;
        if (obsForecastRegex.test(content)) {
            content = content.replace(obsForecastRegex, `// 予報円の中心に黒点を表示 (現在位置以外の予報点)
      L.circleMarker([fc.lat, fc.lon], {
        radius: 3,
        color: '#000',
        fillColor: '#000',
        fillOpacity: 1,
        weight: 1
      }).addTo(map);`);
        }
    }

    fs.writeFileSync(filepath, content);
}

modifyFile('frontend/src/App.tsx', false);
modifyFile('frontend/src/ObsApp.tsx', true);
console.log("Success");
