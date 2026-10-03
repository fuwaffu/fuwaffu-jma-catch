const fs = require('fs');
let content = fs.readFileSync('frontend/src/App.tsx', 'utf8');
content = content.replace("map.getPane('bgPane').style.zIndex = 200;", "map.getPane('bgPane')!.style.zIndex = '200';");
fs.writeFileSync('frontend/src/App.tsx', content);

let obsContent = fs.readFileSync('frontend/src/ObsApp.tsx', 'utf8');
obsContent = obsContent.replace("mapInstanceRef.current.getPane('bgPane').style.zIndex = 200;", "mapInstanceRef.current.getPane('bgPane')!.style.zIndex = '200';");
fs.writeFileSync('frontend/src/ObsApp.tsx', obsContent);
