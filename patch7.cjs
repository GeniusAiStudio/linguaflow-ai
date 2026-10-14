const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const target = `const uploadResult = await ai.files.upload({
        file: req.file.path,
        mimeType: req.file.mimetype,
      });`;

const replacement = `const uploadResult = await ai.files.upload({
        file: req.file.path,
        config: { mimeType: req.file.mimetype },
      });`;

content = content.replace(target, replacement);

fs.writeFileSync('server.ts', content);
console.log("Patched upload call in server.ts successfully");
