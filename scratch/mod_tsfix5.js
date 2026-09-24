const fs = require('fs');

function finalFix(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');

    // Fix map reference
    content = content.replace(
        /const targetMap = mapInstanceRef \? mapInstanceRef\.current : map;/g,
        'const targetMap = mapInstanceRef ? mapInstanceRef.current : null;'
    );

    // Fix TS6133 unused variables day and weekDay in time formatter
    // Since I replaced the regex and injected ${day} and ${weekDay} directly as strings...
    // Wait, my previous mod_fonts.js used string interpolation in the format string but I wrote the replacement in a weird way.
    // The previous regex replacement was:
    // app = app.replace(timeLabelRegex, "`\\$\\{day\\}日<span style=\\\"font-family: 'Zen Kaku Gothic New', sans-serif; font-weight: 900;\\\">(</span>\\$\\{weekDay\\}<span style=\\\"font-family: 'Zen Kaku Gothic New', sans-serif; font-weight: 900;\\\">)</span>$1`");
    // This probably created a syntax error or made the variables unused if they were commented out?
    // Let's actually look at what the code became for formatForecastTime.

    fs.writeFileSync(filepath, content);
}

finalFix('frontend/src/App.tsx');
finalFix('frontend/src/ObsApp.tsx');
console.log("Success");
