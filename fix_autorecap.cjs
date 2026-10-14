const fs = require('fs');
let text = fs.readFileSync('components/AutoRecap.tsx', 'utf8');

text = text.replace(/await onRequireCredits\(33\); \/\/ Updated cost based on screenshot/g, '');

text = text.replace(/const startAutoRecap = async \(\) => \{\n\s*if \(!videoFile && !recapTopic\) \{\n\s*setError\("Please upload a video or enter a topic for the recap."\);\n\s*return;\n\s*\}/, `const startAutoRecap = async () => {
    if (!videoFile && !recapTopic) {
      setError("Please upload a video or enter a topic for the recap.");
      return;
    }
    const cost = videoDuration ? (videoDuration <= 60 ? 10 : (videoDuration <= 180 ? 32 : 50)) : 33;
    if (!(await onRequireCredits(cost))) return;`);

fs.writeFileSync('components/AutoRecap.tsx', text);
