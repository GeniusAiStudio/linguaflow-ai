const fs = require('fs');
const content = fs.readFileSync('services/backendService.ts', 'utf8');

const target = 'const response = await fetch(`${this.baseUrl}/transcribe`, {';
const replacement = 'const response = await fetch("/api/gemini-transcribe-video", {';

if (content.includes(target)) {
  const newContent = content.replace(target, replacement);
  fs.writeFileSync('services/backendService.ts', newContent);
  console.log("Patched services/backendService.ts successfully");
} else {
  console.log("Could not find target in services/backendService.ts");
}
