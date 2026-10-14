const fs = require('fs');
let content = fs.readFileSync('components/AutoRecap.tsx', 'utf8');

content = content.replace(
  /{step !== ProcessingStep\.COMPLETED && \(/g,
  "{true && ("
);

fs.writeFileSync('components/AutoRecap.tsx', content);
console.log("Patched AutoRecap.tsx completely successfully");
