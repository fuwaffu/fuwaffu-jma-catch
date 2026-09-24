const fs = require('fs');
const { createCanvas } = require('canvas');
const d3 = require('d3-geo');

const geojsonStr = fs.readFileSync('../frontend/public/world.geojson', 'utf8');
const geojson = JSON.parse(geojsonStr);

// We want to render a wide area: Lon 80 to 180, Lat -20 to 60
// We need to define exactly what LatLng bounds this image corresponds to for Leaflet's imageOverlay.
const minLon = 70;
const maxLon = 180; // or 190? let's stick to 180. Wait, 70 to 180 is 110 degrees.
const minLat = -20;
const maxLat = 60;

// Leaflet uses standard Web Mercator (EPSG:3857)
const projection = d3.geoMercator();

// We need to calculate the bounding box in projected coordinates
const pMin = projection([minLon, maxLat]); // Top-Left
const pMax = projection([maxLon, minLat]); // Bottom-Right

// Let's decide a resolution. 1 degree = roughly 50 pixels?
// 110 degrees * 50 = 5500 pixels wide. Let's make it 3840 pixels wide (4K).
const width = 3840;
const scaleFactor = width / (pMax[0] - pMin[0]);
const height = Math.round((pMax[1] - pMin[1]) * scaleFactor);

// Adjust projection to fit exactly our canvas
projection
    .scale(projection.scale() * scaleFactor)
    .translate([
        projection.translate()[0] * scaleFactor - pMin[0] * scaleFactor,
        projection.translate()[1] * scaleFactor - pMin[1] * scaleFactor
    ]);

const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

const path = d3.geoPath().projection(projection).context(ctx);

// Fill sea (background) -> transparent? Or colored?
// The user asked for "海のいろは現在のグレーよりも2段階濃いめの色"
// In our previous edit, we set backgroundColor on the div to #475569.
// If the PNG has transparent sea, the div background will show through!
// But wait, they want the map generated as an image to be light.
// Transparent PNG is great.

// Draw land
ctx.fillStyle = '#dcfce7'; // 薄い緑
ctx.strokeStyle = '#166534'; // 濃い緑
ctx.lineWidth = 2; // For 4K, line width 2 is good.

ctx.beginPath();
path(geojson);
ctx.fill();
ctx.stroke();

const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('../frontend/public/map_bg.png', buffer);

console.log(`Generated map_bg.png! Size: ${width}x${height}`);
console.log(`Leaflet Bounds: [[${minLat}, ${minLon}], [${maxLat}, ${maxLon}]]`);
