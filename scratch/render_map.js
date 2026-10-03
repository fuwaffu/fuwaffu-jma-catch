const fs = require('fs');
const { createCanvas } = require('canvas');
const d3 = require('d3-geo');

const geojsonStr = fs.readFileSync('../frontend/public/world_50m.geojson', 'utf8');
const geojson = JSON.parse(geojsonStr);

// 縦を2倍 (80度 -> 160度)、横を4倍 (110度 -> 360度: 地球全周)
const minLon = -180;
const maxLon = 180;
const minLat = -80;
const maxLat = 80;

// Leaflet uses standard Web Mercator (EPSG:3857)
const projection = d3.geoMercator();

// We need to calculate the bounding box in projected coordinates
const pMin = projection([minLon, maxLat]); // Top-Left
const pMax = projection([maxLon, minLat]); // Bottom-Right

// Since the width is covering 360 degrees now, let's use a very large canvas width (e.g., 7680 for 8K)
const width = 7680;
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

// Draw land
ctx.fillStyle = '#dcfce7'; // 薄い緑
ctx.strokeStyle = '#166534'; // 濃い緑
ctx.lineWidth = 2; // For 8K, line width 2 or 3 is good.

ctx.beginPath();
path(geojson);
ctx.fill();
ctx.stroke();

const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('../frontend/public/map_bg.png', buffer);

console.log(`Generated map_bg.png! Size: ${width}x${height}`);
console.log(`Leaflet Bounds: [[${minLat}, ${minLon}], [${maxLat}, ${maxLon}]]`);
