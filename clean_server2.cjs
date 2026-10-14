const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const strStart = `  async function renderAndValidateVideoCut(`;
const strEnd = `// API Route to cleanup original file`;

const startIndex = content.indexOf(strStart);
const endIndex = content.indexOf(strEnd);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + content.substring(endIndex);
  fs.writeFileSync('server.ts', content);
  console.log('Removed from server.ts');
} else {
  console.log('Could not find start or end index', startIndex, endIndex);
}
