const fs = require('fs');
let text = fs.readFileSync('components/RecapScriptWriter.tsx', 'utf8');

text = text.replace(/await onRequireCredits\(15\);/g, '');
text = text.replace(/await onRequireCredits\(25\);/g, '');

text = text.replace(/const handleFileSelect = async \(e: React.ChangeEvent<HTMLInputElement>\) => \{\n\s*const file = e\.target\.files\?\.\[0\];\n\s*if \(!file\) return;\n/, `const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!(await onRequireCredits(25))) return;
`);

fs.writeFileSync('components/RecapScriptWriter.tsx', text);
