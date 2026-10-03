const fs = require('fs');

function fixMapDisappear(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // We find where bgLayer and bgLayerRight are defined, and add eachLayer
  content = content.replace(/\(bgLayer as any\)\.isBaseMap = true;/g, '(bgLayer as any).isBaseMap = true;\n          bgLayer.eachLayer((l: any) => l.isBaseMap = true);');
  content = content.replace(/\(bgLayerRight as any\)\.isBaseMap = true;/g, '(bgLayerRight as any).isBaseMap = true;\n          bgLayerRight.eachLayer((l: any) => l.isBaseMap = true);');
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed map disappear bug in ' + filePath);
}

fixMapDisappear('./frontend/src/App.tsx');
fixMapDisappear('./frontend/src/ObsApp.tsx');
