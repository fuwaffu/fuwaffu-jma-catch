const fs = require('fs');
const { createCanvas } = require('canvas');
const d3 = require('d3-geo');

const geojsonStr = fs.readFileSync('../frontend/public/world_50m.geojson', 'utf8');
const geojson = JSON.parse(geojsonStr);

// We must use Web Mercator so it matches Leaflet's projection!
const projection = d3.geoMercator();

// Center on Japan: lon 135.
projection.rotate([-135, 0]);

// We want the bounds to correspond exactly to:
const minLon = -45;
const maxLon = 315;
const minLat = -80;
const maxLat = 80;

const width = 7680;

// In d3.geoMercator, total width for 360 degrees is 2 * PI * scale
// We want exactly 360 degrees (from -45 to 315 is 360 degrees).
const scale = width / (2 * Math.PI);

projection.scale(scale);

// To find height, we need the projected Y of maxLat (80) and minLat (-80).
// In d3.geoMercator, the center (0,0) is mapped to projection.translate().
// If we set translate to [width / 2, 0], we can easily find the Y span.
projection.translate([width / 2, 0]);

const pTopLeft = projection([minLon, maxLat]); // Top-Left
const pBottomRight = projection([maxLon, minLat]); // Bottom-Right

// Height is the difference in Y
const height = Math.round(pBottomRight[1] - pTopLeft[1]);

// Now adjust translate so that the top-left is exactly at [0, 0]
projection.translate([
  width / 2 - pTopLeft[0],
  -pTopLeft[1]
]);

const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

const path = d3.geoPath().projection(projection).context(ctx);

// Draw land
ctx.fillStyle = '#dcfce7'; 
ctx.strokeStyle = '#166534'; 
ctx.lineWidth = 3; 

ctx.beginPath();
path(geojson);
ctx.fill();
ctx.stroke();

const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('../frontend/public/map_bg.png', buffer);

console.log(`Generated Web Mercator map_bg.png! Size: ${width}x${height}`);
console.log(`Leaflet Bounds: [[${minLat}, ${minLon}], [${maxLat}, ${maxLon}]]`);
