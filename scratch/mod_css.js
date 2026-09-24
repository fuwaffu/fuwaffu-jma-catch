const fs = require('fs');

let css = fs.readFileSync('frontend/src/index.css', 'utf8');
css = css.replace(
    /src: local\('Zen Kaku Gothic New Black'\), local\('Zen Kaku Gothic New'\);/g,
    "src: url(https://fonts.gstatic.com/s/zenkakugothicnew/v18/gNMVW2drQpDw0GjzrVNFf_valaDBcznOqr9PaWQ.ttf) format('truetype');"
);
fs.writeFileSync('frontend/src/index.css', css);
console.log("Success");
