export function fixMyanmarPdfTextSpaces(text: string): string {
  if (!text) return text;
  
  let result = text;

  let prev = "";
  while (prev !== result) {
    prev = result;
    // 1. Remove spaces before any vowel/medial/tone/asat (102B-103F)
    result = result.replace(/([\u1000-\u109F])[ \t]+([\u102B-\u103F])/g, '$1$2');

    // 2. Remove spaces after pre-base vowels/medials (ေ 1031, ြ 103C)
    result = result.replace(/([\u1031\u103C])[ \t]+([\u1000-\u109F])/g, '$1$2');

    // 3. Remove spaces before a consonant that is part of a syllable coda (e.g., has Asat 103A, or Virama 1039)
    // Wait, the Asat might be separated by spaces too!
    // If we have "စ  ်", rule 1 will fix it to "စ်".
    // Then we have "ဖ  စ်", the space is before "စ".
    // "စ" is 1005, followed by "်" 103A.
    result = result.replace(/([\u1000-\u109F])[ \t]+([\u1000-\u102A][\u1039\u103A])/g, '$1$2');
  }
  
  // What about just single space between any Myanmar characters?
  // User: "Example simple cleanup logic: text = text.replace(/([\u1000-\u109F])\s+([\u1000-\u109F])/g, '$1$2') (You may need to fine-tune this so it doesn't remove intentional spaces between sentences, but heavily targets broken syllables)."
  // If we just replace a SINGLE space between Myanmar chars:
  // result = result.replace(/([\u1000-\u109F]) ([\u1000-\u109F])/g, '$1$2');
  
  return result;
}

const s5 = "အ ေမ က ီ   းကို";
const s2 = "Radha ( ရာဓာ )   တစ် ေယ ာက်  ချမ်းလွန်းလို့   တုန်ယင် ပ ီ း   ထိုင် ေန ရှာပါတယ်။";
const s1 = "ရွာ ေလ းတစ်ရွာက   အိမ် ေသ း ေသ း ေလ းရဲ့";

console.log("5:", fixMyanmarPdfTextSpaces(s5));
console.log("2:", fixMyanmarPdfTextSpaces(s2));
console.log("1:", fixMyanmarPdfTextSpaces(s1));
