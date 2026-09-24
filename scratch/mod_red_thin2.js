const fs = require('fs');

['frontend/src/App.tsx', 'frontend/src/ObsApp.tsx'].forEach(filepath => {
    let c = fs.readFileSync(filepath, 'utf8');
    c = c.replace(/color: '#FF2800', fillColor: 'transparent', weight: 1\.5, dashArray: '5,5', dashArray: '5,5'/g, "color: '#FF2800', fillColor: 'transparent', weight: 1, dashArray: '5,5'");
    c = c.replace(/color: '#FF2800', fillColor: 'transparent', weight: 1\.5, dashArray: '5,5'/g, "color: '#FF2800', fillColor: 'transparent', weight: 1, dashArray: '5,5'");
    c = c.replace(/color: '#FF2800', fillColor: 'transparent', weight: 1\.5/g, "color: '#FF2800', fillColor: 'transparent', weight: 1, dashArray: '5,5'");
    fs.writeFileSync(filepath, c);
});
console.log("Success");
