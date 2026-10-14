const fs = require('fs');
let text = fs.readFileSync('components/IllustrationHub.tsx', 'utf8');

// Remove the one at line 104
text = text.replace(/await onRequireCredits\(25\);/g, '');

// Inject at start of handleGenerate
text = text.replace(/const handleGenerate = async \(\) => \{\n\s*if \(!prompt\.trim\(\) \|\| isGenerating\) return;\n/, `const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    if (!(await onRequireCredits(25))) return;
`);

fs.writeFileSync('components/IllustrationHub.tsx', text);
