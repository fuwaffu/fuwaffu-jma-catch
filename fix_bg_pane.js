const fs = require('fs');

const fixPane = (file) => {
  let content = fs.readFileSync(file, 'utf8');

  // 1. Create pane after setting view
  if (!content.includes('map.createPane(\'bgPane\')')) {
    const mapCreation = "const map = L.map(mapRef.current, { zoomControl: true }).setView([lat, lon], 5);";
    const mapCreationObs = "mapInstanceRef.current = L.map(mapRef.current, {";
    
    if (content.includes(mapCreation)) {
      content = content.replace(mapCreation, mapCreation + "\n      map.createPane('bgPane');\n      map.getPane('bgPane').style.zIndex = 200;");
    } else if (content.includes(mapCreationObs)) {
      // For ObsApp, it spans multiple lines. Find where it ends
      const endMapCreation = "attributionControl: false // 出典表記は独自のUIで行うため非表示\n        });";
      if (content.includes(endMapCreation)) {
        content = content.replace(endMapCreation, endMapCreation + "\n\n        mapInstanceRef.current.createPane('bgPane');\n        mapInstanceRef.current.getPane('bgPane').style.zIndex = 200;");
      }
    }
  }

  // 2. Add pane to L.geoJSON options
  const styleOption = "const bgLayer = L.geoJSON(data, { style });";
  const styleOptionNew = "const bgLayer = L.geoJSON(data, { style, pane: 'bgPane' });";
  content = content.replace(styleOption, styleOptionNew);

  const styleOptionRight = "const bgLayerRight = L.geoJSON(shiftedData, { style });";
  const styleOptionRightNew = "const bgLayerRight = L.geoJSON(shiftedData, { style, pane: 'bgPane' });";
  content = content.replace(styleOptionRight, styleOptionRightNew);

  fs.writeFileSync(file, content);
};

fixPane('frontend/src/App.tsx');
fixPane('frontend/src/ObsApp.tsx');
console.log('Fixed background layer pane order');
