const fs = require('fs');
let text = fs.readFileSync('components/VoiceStudio.tsx', 'utf8');

text = text.replace(/if \(\!voiceOverride\) \{\n\s*await onRequireCredits\(15\);\n\s*\}/g, '');

fs.writeFileSync('components/VoiceStudio.tsx', text);
