const fs = require('fs');

function applyObsZoom(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/padding: \[110, 110\]/g, 'padding: [54, 54]');
  fs.writeFileSync(filePath, content);
}

applyObsZoom('frontend/src/ObsApp.tsx');
console.log('Fixed OBS padding to 90%');
