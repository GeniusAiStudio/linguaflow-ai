const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(/const finalDeliverPath = \`\/api\/download\?file=final-\\\${taskId}\.mp4\`;/g, 'const finalDeliverPath = `/outputs/final-${taskId}.mp4`;');

fs.writeFileSync('server.ts', content);
console.log('Video editor path reverted');
