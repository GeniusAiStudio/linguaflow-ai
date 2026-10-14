const fs = require('fs');
let content = fs.readFileSync('components/AutoRecap.tsx', 'utf8');

content = content.replace(/left-6.5/g, 'left-[26px]');

fs.writeFileSync('components/AutoRecap.tsx', content);
console.log("Patched AutoRecap.tsx UI toggles");
