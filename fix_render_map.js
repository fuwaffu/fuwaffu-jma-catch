const fs = require('fs');

let renderMapContent = fs.readFileSync('scratch/render_map.js', 'utf8');
renderMapContent = renderMapContent.replace(/world\.geojson/g, 'world_50m.geojson');
fs.writeFileSync('scratch/render_map.js', renderMapContent);
console.log('Fixed render_map.js');
