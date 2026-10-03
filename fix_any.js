const fs = require('fs');

function applyAny(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/bgLayer\.isBaseMap = true;/g, '(bgLayer as any).isBaseMap = true;');
  fs.writeFileSync(filePath, content);
}

applyAny('./frontend/src/App.tsx');
applyAny('./frontend/src/ObsApp.tsx');
