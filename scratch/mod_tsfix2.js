const fs = require('fs');

function fixErrors(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');

    // Remove remaining references to getOuterTangentPolygon
    const regex1 = /const outerPoints = getOuterTangentPolygon\([^)]+\);[^]+?\}\)\.addTo\(map\);\s*\}/g;
    content = content.replace(regex1, '');

    // Actually, maybe it's just one line:
    content = content.replace(/const outerPoints = getOuterTangentPolygon\([^)]+\);/g, '');
    content = content.replace(/if \(outerPoints\.length > 0\) \{[^]+?\}\)\.addTo\(map\);\s*\}/g, '');

    // Let's just remove anything mentioning getOuterTangentPolygon
    // But I might break the JS if I'm not careful. Let's just comment out any line containing getOuterTangentPolygon
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('getOuterTangentPolygon') && !lines[i].trim().startsWith('//')) {
            lines[i] = '// ' + lines[i];
        }
    }
    content = lines.join('\n');

    // Fix duplicate className
    content = content.replace(/className: '', className: ''/g, "className: ''");
    content = content.replace(/iconAnchor: \[0, 0\], className: '', className: ''/g, "iconAnchor: [0, 0], className: ''");
    content = content.replace(/iconSize: \[0, 0\], iconAnchor: \[0, 0\], className: '', className: ''/g, "iconSize: [0, 0], iconAnchor: [0, 0], className: ''");

    fs.writeFileSync(filepath, content);
}

fixErrors('frontend/src/App.tsx');
fixErrors('frontend/src/ObsApp.tsx');
console.log("Success");
