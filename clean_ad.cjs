const fs = require('fs');

let code = fs.readFileSync('App.tsx', 'utf8');

// Remove all injected ad links
code = code.replace(/<a[\s\S]*?effectivecpmnetwork[\s\S]*?<\/a>/g, '');
fs.writeFileSync('App.tsx', code);
console.log('Cleaned');
