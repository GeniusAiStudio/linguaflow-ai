function fixMyanmarPdfTextSpaces(text: string): string {
  if (!text) return text;
  
  let result = text;

  // 1. Remove space before any vowel/medial/tone/asat (102B-103F)
  result = result.replace(/([\u1000-\u109F])[ \t]+([\u102B-\u103F])/g, '$1$2');
  result = result.replace(/([\u1000-\u109F])[ \t]+([\u102B-\u103F])/g, '$1$2');
  result = result.replace(/([\u1000-\u109F])[ \t]+([\u102B-\u103F])/g, '$1$2');

  // 2. Remove space after pre-base vowels/medials (ေ 1031, ြ 103C)
  result = result.replace(/([\u1031\u103C])[ \t]+([\u1000-\u102A])/g, '$1$2');
  
  return result;
}

const s1 = "ရွာ ေလ းတစ်ရွာက   အိမ် ေသ း ေသ း ေလ းရဲ့";
const s2 = "Radha ( ရာဓာ )   တစ် ေယ ာက်  ချမ်းလွန်းလို့   တုန်ယင် ပ ီ း   ထိုင် ေန ရှာပါတယ်။";
const s3 = "ြဖ စ် သူ";

console.log("1:", fixMyanmarPdfTextSpaces(s1));
console.log("2:", fixMyanmarPdfTextSpaces(s2));
console.log("3:", fixMyanmarPdfTextSpaces(s3));
