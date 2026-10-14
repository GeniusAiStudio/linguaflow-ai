const fs = require('fs');

const components = [
  'components/PdfArchitect.tsx',
  'components/IllustrationHub.tsx',
  'components/ScriptGenerator.tsx',
  'components/StoryTeller.tsx',
  'components/RecapScriptWriter.tsx',
  'components/VoiceStudio.tsx',
  'components/AutoRecap.tsx'
];

components.forEach(comp => {
  if (!fs.existsSync(comp)) return;
  let text = fs.readFileSync(comp, 'utf8');
  
  // 1. Update interface
  text = text.replace(/onRequireCredits:\s*\(amount:\s*number\)\s*=>\s*boolean;/, 'onRequireCredits: (amount: number) => Promise<boolean>;');

  // 2. Add await to the call
  text = text.replace(/if \(!onRequireCredits\(/g, 'if (!(await onRequireCredits(');
  text = text.replace(/onRequireCredits\((.*?)\)\)/g, 'onRequireCredits($1)))');
  // Handle any direct calls if they exist (like IllustrationHub had)
  // Wait, the previous patch for IllustrationHub didn't match the regex. Let's see if there are any `onRequireCredits(x);` statements.
  text = text.replace(/[^w]onRequireCredits\(([0-9]+)\);/g, ' await onRequireCredits($1);');
  
  fs.writeFileSync(comp, text);
});
console.log('Components updated to async');
