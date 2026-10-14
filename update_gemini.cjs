const fs = require('fs');
const path = 'services/geminiService.ts';
let content = fs.readFileSync(path, 'utf8');

// Update imports
if (!content.includes('fixMyanmarPdfTextSpaces')) {
  content = content.replace(
    'correctCombiningMarksOrder,',
    'correctCombiningMarksOrder,\n  fixMyanmarPdfTextSpaces,'
  );
}

// Update extractContentFromPdf
const targetStr = `      const wordCount = fullText.split(/\\s+/).filter(w => w.length > 0).length;
      
      return {
        text: fullText.trim() || "No text content found.",`;

const replacementStr = `      const cleanedText = fixMyanmarPdfTextSpaces(fullText.trim());
      const wordCount = cleanedText.split(/\\s+/).filter(w => w.length > 0).length;
      
      return {
        text: cleanedText || "No text content found.",`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(path, content);
  console.log("Success gemini");
} else {
  console.log("Failed to find target");
}
