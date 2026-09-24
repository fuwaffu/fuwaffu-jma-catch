const fs = require('fs');

function fixFinalErrors(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');

    // Remove forecastPolygon and forecastPoints
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('const forecastPolygon') || lines[i].includes('forecastPoints') || lines[i].includes('forecastPolygon =') || lines[i].includes('L.polygon(forecastPolygon') || lines[i].includes('getOuterTangentPolygon')) {
            if (!lines[i].trim().startsWith('//')) {
                lines[i] = '// ' + lines[i];
            }
        }
        
        // Fix multiple className properties
        if (lines[i].includes('className:')) {
            lines[i] = lines[i].replace(/,\s*className:\s*''/g, '');
            // Then add one back if it was completely removed and needed? No, L.divIcon accepts className, it's optional anyway.
            // If it has multiple, the regex above will strip all trailing ones after the first match... wait, no.
            // Let's just fix it manually using a replace on the specific lines:
            // "iconSize: [0, 0], iconAnchor: [0, 0], className: '', className: ''"
            lines[i] = lines[i].replace(/className:\s*' ',\s*className:\s*''/g, "className: ''");
            lines[i] = lines[i].replace(/className:\s*'',\s*className:\s*''/g, "className: ''");
            lines[i] = lines[i].replace(/className:\s*""\s*,\s*className:\s*""/g, 'className: ""');
        }
    }
    
    // Some lines might just have `className: ''` added twice by my scripts
    content = lines.join('\n');
    content = content.replace(/className:\s*' ',\s*className:\s*''/g, "className: ''");
    content = content.replace(/className:\s*'',\s*className:\s*''/g, "className: ''");
    
    // Another possible format: 
    // iconSize: [0, 0], iconAnchor: [0, 0], className: ''
    // But maybe it was already there. Let's just remove ALL instances of `, className: ''` that appear after another `className`
    content = content.replace(/className:\s*'([^']*)',\s*className:\s*'([^']*)'/g, "className: '$1 $2'");

    fs.writeFileSync(filepath, content);
}

fixFinalErrors('frontend/src/App.tsx');
fixFinalErrors('frontend/src/ObsApp.tsx');
console.log("Success");
