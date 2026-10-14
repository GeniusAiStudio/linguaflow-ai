const fs = require('fs');
const path = 'services/myanmarUnicodeUtils.ts';
let content = fs.readFileSync(path, 'utf8');

const newFunc = `
/**
 * Fixes spaces inserted by PDF parsers between Myanmar syllables and characters.
 * Preserves paragraphs and intentional double spaces.
 */
export function fixMyanmarPdfTextSpaces(text: string): string {
  if (!text) return text;
  
  let result = text;

  let prev = "";
  while (prev !== result) {
    prev = result;
    // 1. Remove spaces before any vowel/medial/tone/asat (102B-103F)
    result = result.replace(/([\\u1000-\\u109F])[ \\t]+([\\u102B-\\u103F])/g, '$1$2');

    // 2. Remove spaces after pre-base vowels/medials (ေ 1031, ြ 103C)
    result = result.replace(/([\\u1031\\u103C])[ \\t]+([\\u1000-\\u109F])/g, '$1$2');

    // 3. Remove spaces before a consonant that is part of a syllable coda (e.g., has Asat 103A, or Virama 1039)
    result = result.replace(/([\\u1000-\\u109F])[ \\t]+([\\u1000-\\u102A][\\u1039\\u103A])/g, '$1$2');
  }

  // 4. Remove exact single spaces between any Myanmar characters to glue fragmented words
  // (Double spaces and newlines are preserved as intentional sentence breaks or formatting)
  let prev2 = "";
  while (prev2 !== result) {
    prev2 = result;
    result = result.replace(/([\\u1000-\\u109F]) ([\\u1000-\\u109F])/g, '$1$2');
  }
  
  return result;
}
`;

if (!content.includes('fixMyanmarPdfTextSpaces')) {
  content = content + '\n' + newFunc;
  fs.writeFileSync(path, content);
  console.log("Success utils");
} else {
  console.log("Already exists");
}
