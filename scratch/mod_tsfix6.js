const fs = require('fs');

function fix(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');

    // Fix map reference
    content = content.replace(
        /const targetMap = mapInstanceRef \? mapInstanceRef\.current : map;/g,
        'const targetMap = mapInstanceRef.current;'
    );

    // Fix string interpolation
    content = content.replace(/\\\$\\\{day\\\}/g, '${day}');
    content = content.replace(/\\\$\\\{weekDay\\\}/g, '${weekDay}');

    fs.writeFileSync(filepath, content);
}

fix('frontend/src/App.tsx');
fix('frontend/src/ObsApp.tsx');
console.log("Success");
