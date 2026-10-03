const fs = require('fs');
const { createCanvas } = require('canvas');
const d3 = require('d3-geo');

const geojsonStr = fs.readFileSync('../frontend/public/world_50m.geojson', 'utf8');
const geojson = JSON.parse(geojsonStr);

// We want equirectangular because Leaflet's L.imageOverlay expects linear lat/lon to stretch properly over Mercator.
const projection = d3.geoEquirectangular();

// Center on Japan (Lon 135, Lat 0 for the equator)
// Rotate shifts the map. A negative longitude rotation shifts the map east.
projection.rotate([-135, 0]);

// Bounds: -80 to 80 lat. Longitude will be effectively -45 to 315.
const width = 7680;
// Equirectangular maps 360 degrees to width.
// Height should be for 160 degrees (from -80 to 80).
// 160 / 360 = 0.4444...
const height = Math.round(width * (160 / 360));

// Fit the projection to exactly these dimensions
projection.fitExtent([[0, 0], [width, width * (180/360)]], {type: "Sphere"});
// Wait, if we use fitExtent on Sphere, it fits -90 to 90.
// But we want to crop to -80 to 80.
// Let's just manually scale and translate.
// Equirectangular formula: x = (lon - lambda0) * cos(phi1)
// With rotate([-135, 0]), the center (135) is at x=0.
// Map width spans 360 degrees, so scale = width / (2 * PI)
const scale = width / (2 * Math.PI);

projection
  .scale(scale)
  .translate([width / 2, height / 2]); 
  
// But wait, the standard translation puts lat 0 at height/2.
// Since we want -80 to 80, lat 0 IS exactly at height / 2.
// The total vertical span is 160 degrees out of 180.
// If scale is width / (2 * PI), then 180 degrees is width / 2.
// So 160 degrees is (160/360) * width.
// Our canvas height is (160/360) * width.
// The center of the canvas is height / 2.
// So lat=0 is mapped to height/2. This perfectly crops -80 to 80!

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

console.log(`Generated equirectangular map_bg.png! Size: ${width}x${height}`);
console.log(`Leaflet Bounds: [[-80, -45], [80, 315]]`);
