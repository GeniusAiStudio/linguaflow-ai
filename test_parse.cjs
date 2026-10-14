const fs = require('fs');
const ts = require('typescript');
const code = fs.readFileSync('server.ts', 'utf-8');
const sourceFile = ts.createSourceFile('server.ts', code, ts.ScriptTarget.Latest, true);
console.log("Parse successful: " + (sourceFile.statements.length > 0));
