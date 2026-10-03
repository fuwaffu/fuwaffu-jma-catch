const fs = require('fs');

let content = fs.readFileSync('frontend/src/App.tsx', 'utf8');

const regex = /  useEffect\(\(\) => \{\r?\n    if \(!mapRef\.current \|\| mapInstanceRef\.current\) return;/m;
const replacement = `  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }`;

content = content.replace(regex, replacement);

const depRegex = /        if \(mapInstanceRef\.current\) \{\r?\n          mapInstanceRef\.current\.remove\(\);\r?\n          mapInstanceRef\.current = null;\r?\n        \}\r?\n      \};\r?\n    \}, \[typhoon\]\);/m;
const depReplacement = `        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };
    }, [typhoon, use24HourFormat]);`;

content = content.replace(depRegex, depReplacement);

fs.writeFileSync('frontend/src/App.tsx', content);

let obsContent = fs.readFileSync('frontend/src/ObsApp.tsx', 'utf8');
const obsRegex = /const trackPoints = drawTyphoon\(map, activeTyphoon, \{ isObs: true \}\);/m;
const obsReplacement = `const trackPoints = drawTyphoon(map, activeTyphoon, { isObs: true, use24HourFormat: true });`;

obsContent = obsContent.replace(obsRegex, obsReplacement);
fs.writeFileSync('frontend/src/ObsApp.tsx', obsContent);

console.log('Fixed time format switching and default');
