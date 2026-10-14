const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');
content = content.replace(/import \{\n  renderAndValidateVideoCutFast,\n  probeVideo as probeVideoFast,\n\} from "\.\/services\/videoCutterService";\n/, '');
content = content.replace(/import { renderAndValidateVideoCutFast, probeVideo as probeVideoFast } from "\.\/services\/videoCutterService";/, '');
fs.writeFileSync('server.ts', content);
console.log('Import removed');
