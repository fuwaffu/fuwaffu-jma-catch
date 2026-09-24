const fs = require('fs');

function modifyObs(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');

    // 1. Black dot to white dot, slightly larger, and above the track line.
    // The track line is currently drawn using L.polyline(trackPoints, ...).addTo(map).
    // The circleMarkers are also added to map in the same loop or after.
    // By default, Leaflet draws circleMarkers in the marker pane which is ABOVE polylines (overlay pane).
    // Wait, no. circleMarker is a Path, so it goes to overlayPane, and it is ordered by insertion.
    // Since we add trackPoints polyline AFTER we loop and collect them, wait!
    // In ObsApp.tsx:
    // L.polyline(trackPoints, { color: '#ffffff', weight: 4, dashArray: '8,8', opacity: 1 }).addTo(map);
    // This is drawn outside the loop, AFTER the circleMarkers are added inside the loop!
    // We need to move the trackPoints polyline drawing to BEFORE the loop, or move the circleMarker drawing AFTER the loop.
    // Actually, L.circleMarker returns an object. We can just add `{ pane: 'markerPane' }` to make it render above polylines definitively, because markerPane z-index is 600, overlayPane is 400.
    
    content = content.replace(
        /\/\/ 予報円の中心に黒点を表示\s*L\.circleMarker\(\[fc\.lat, fc\.lon\], \{\s*radius: 3,\s*color: '#000',\s*fillColor: '#000',\s*fillOpacity: 1,\s*weight: 1\s*\}\)\.addTo\(map\);/g,
        `// 予報円の中心に白点を表示 (進路線より上にするため pane を指定)
      L.circleMarker([fc.lat, fc.lon], {
        radius: 4,
        color: '#fff',
        fillColor: '#fff',
        fillOpacity: 1,
        weight: 1,
        pane: 'markerPane'
      }).addTo(map);`
    );

    // 2. Dotted line to time label: light gray, easier to see.
    // L.polyline([[fc.lat, fc.lon], [labelLat, labelLon]], { color: '#666', weight: 1, dashArray: '2,2' }).addTo(map);
    content = content.replace(
        /L\.polyline\(\[\[fc\.lat, fc\.lon\], \[labelLat, labelLon\]\], \{ color: '#666', weight: 1, dashArray: '2,2' \}\)\.addTo\(map\);/g,
        `L.polyline([[fc.lat, fc.lon], [labelLat, labelLon]], { color: '#e2e8f0', weight: 2, dashArray: '4,4' }).addTo(map);`
    );

    // 3. Time label not overlapping forecast circle.
    // const labelOffsetKm = (fc.circleRadiusKm || 50) + 90;
    // Let's make it + 130 km to be safe.
    content = content.replace(
        /const labelOffsetKm = \(fc\.circleRadiusKm \|\| 50\) \+ 90;/g,
        `const labelOffsetKm = (fc.circleRadiusKm || 50) + 160;`
    );

    fs.writeFileSync(filepath, content);
}

modifyObs('frontend/src/ObsApp.tsx');
console.log("Success");
