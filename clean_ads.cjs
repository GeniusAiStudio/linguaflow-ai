const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const regexDesktop = /\{\/\* DESKTOP AD BANNER \*\/\}\n\s*<div className="mt-4 flex justify-center items-center w-full min-h-\[250px\] [^"]+"[^>]*>\n\s*<iframe src="\/ad-desktop\.html" width="300" height="250" frameBorder="0" scrolling="no" className="border-none" \/>\n\s*<\/div>/g;

code = code.replace(regexDesktop, '');

fs.writeFileSync('App.tsx', code);
