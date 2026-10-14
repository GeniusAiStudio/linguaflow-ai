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
    result = result.replace(/([\u1000-\u109F])[ \t]+([\u1000-\u102A][\u1039\u103A])/g, '$1$2');
  }

  // 4. Remove exact single spaces between any Myanmar characters to glue fragmented words
  // (Double spaces are preserved as intentional sentence breaks or formatting)
  result = result.replace(/([\u1000-\u109F]) ([\u1000-\u109F])/g, '$1$2');
  // run it twice in case of overlapping matches like "a b c" -> "abc"
  result = result.replace(/([\u1000-\u109F]) ([\u1000-\u109F])/g, '$1$2');
  
  return result;
}

const s5 = "အ ေမ က ီ   းကို";
const s2 = "Radha ( ရာဓာ )   တစ် ေယ ာက်  ချမ်းလွန်းလို့   တုန်ယင် ပ ီ း   ထိုင် ေန ရှာပါတယ်။";
const s1 = "ရွာ ေလ းတစ်ရွာက   အိမ် ေသ း ေသ း ေလ းရဲ့";

console.log("5:", fixMyanmarPdfTextSpaces(s5));
console.log("2:", fixMyanmarPdfTextSpaces(s2));
console.log("1:", fixMyanmarPdfTextSpaces(s1));
