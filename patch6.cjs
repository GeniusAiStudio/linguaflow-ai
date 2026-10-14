const fs = require('fs');
let content = fs.readFileSync('services/geminiService.ts', 'utf8');

const target3 = '        systemInstruction: "You are an AI video recapper. You MUST write the recap script strictly based on the provided transcript and visual context. Do NOT invent, guess, or hallucinate any information outside of the provided context.",\n';
content = content.replaceAll(target3, '');

fs.writeFileSync('services/geminiService.ts', content);
console.log("Cleaned up duplicate instructions in services/geminiService.ts successfully");
