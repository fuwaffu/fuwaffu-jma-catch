const fs = require('fs');

function modifyFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');
    content = content.replace(/geoLayer\.isBaseMap = true;/g, '(geoLayer as any).isBaseMap = true;');
    fs.writeFileSync(filepath, content);
}

modifyFile('frontend/src/App.tsx');
modifyFile('frontend/src/ObsApp.tsx');
console.log("Success");
