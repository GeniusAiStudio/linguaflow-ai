const fs = require('fs');
let content = fs.readFileSync('services/geminiService.ts', 'utf8');

const strictText = "You are an AI video recapper. You MUST write the recap script strictly based on the provided transcript and visual context. Do NOT invent, guess, or hallucinate any information outside of the provided context.\\n\\n";

const target2 = "systemInstruction: `You are an advanced AI Recap Script Writer.";
const replacement2 = "systemInstruction: `" + strictText + "You are an advanced AI Recap Script Writer.";

content = content.replaceAll(target2, replacement2);

fs.writeFileSync('services/geminiService.ts', content);
console.log("Patched services/geminiService.ts with strict instructions successfully");
