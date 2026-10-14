function fixMyanmarPdfTextSpaces(text: string): string {
  if (!text) return text;
  
  // Replace EXACTLY one space between Myanmar characters, repeatedly
  // (We use a while loop or a lookahead to handle overlapping matches, like "a b c" -> "abc")
  // Or just run it a few times.
  let prev = "";
  let curr = text;
  while (prev !== curr) {
    prev = curr;
    curr = curr.replace(/([\u1000-\u109F]) ([\u1000-\u109F])/g, '$1$2');
  }
  return curr;
}

const s1 = "ရွာ ေလ းတစ်ရွာက   အိမ် ေသ း ေသ း ေလ းရဲ့";
const s2 = "Radha ( ရာဓာ )   တစ် ေယ ာက်  ချမ်းလွန်းလို့   တုန်ယင် ပ ီ း   ထိုင် ေန ရှာပါတယ်။";
const s3 = "ြဖ စ် သူ";
const s4 = "ပ ီ း";
const s5 = "အ ေမ က ီ   းကို";

console.log("1:", fixMyanmarPdfTextSpaces(s1));
console.log("2:", fixMyanmarPdfTextSpaces(s2));
console.log("3:", fixMyanmarPdfTextSpaces(s3));
console.log("4:", fixMyanmarPdfTextSpaces(s4));
console.log("5:", fixMyanmarPdfTextSpaces(s5));
