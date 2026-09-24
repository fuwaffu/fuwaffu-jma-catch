const fs = require('fs');
const bboxClip = require('@turf/bbox-clip').default;

const geojsonStr = fs.readFileSync('ne_10m.geojson', 'utf8');
const geojson = JSON.parse(geojsonStr);

const bbox = [90, -10, 180, 60]; // [minX, minY, maxX, maxY]

const clippedFeatures = [];

for (const feature of geojson.features) {
    try {
        const clipped = bboxClip(feature, bbox);
        // Only keep if there's actual geometry left
        if (clipped.geometry && clipped.geometry.coordinates && clipped.geometry.coordinates.length > 0) {
            // Remove unnecessary properties to save space
            clipped.properties = { name: feature.properties.NAME };
            clippedFeatures.push(clipped);
        }
    } catch (e) {
        // some invalid geometries might throw
    }
}

const out = {
    type: "FeatureCollection",
    features: clippedFeatures
};

fs.writeFileSync('../frontend/public/world.geojson', JSON.stringify(out));
console.log("Clipped geojson written. Size: " + Math.round(fs.statSync('../frontend/public/world.geojson').size / 1024) + " KB");
