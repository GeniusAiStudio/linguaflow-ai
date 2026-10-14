const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const newDownloadRoute = `    res.setHeader('Content-Type', 'video/mp4');
    res.download(filePath, 'render.mp4', (err) => {
      if (err) {`;
const oldDownloadRoute = `    res.download(filePath, safeFile, (err) => {
      if (err) {`;

content = content.replace(newDownloadRoute, oldDownloadRoute);
fs.writeFileSync('server.ts', content);
console.log('Download API reverted');
