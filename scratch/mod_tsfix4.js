const fs = require('fs');

function fix(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');
    content = content.replace(/if \(forecastPolygon\.length > 0\) \{/g, '// if (forecastPolygon.length > 0) {');
    fs.writeFileSync(filepath, content);
}

fix('frontend/src/App.tsx');
fix('frontend/src/ObsApp.tsx');
console.log("Success");
