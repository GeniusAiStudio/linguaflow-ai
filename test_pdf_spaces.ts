function fixSpaces(text: string) {
  // First, we only target single spaces ` ` to avoid touching `\n` or `  `
  // Actually, replacing a single space between any two Myanmar characters might be aggressive but often correct for PDFs that split every character.
  // Let's look at the user's string: "ရွာ ေလ းတစ်ရွာက" -> we want "ရွာလေးတစ်ရွာက".
  // Wait, "ရွာ ေလ း" -> "ရွာ" + " " + "ေ" + "လ" + " " + "း"
  // If we just remove all single spaces between Myanmar characters:
  // text.replace(/([\u1000-\u109F])\x20([\u1000-\u109F])/g, "$1$2");
  // However, because of overlapping matches, we need to run it in a loop or use a lookahead,
  // or simply `text.replace(/([\u1000-\u109F]) (?=[\u1000-\u109F])/g, "$1")`
  let res = text.replace(/([\u1000-\u109F]) (?=[\u1000-\u109F])/g, "$1");
  // Since "ရွာ ေလ း" is "ရွာ" " " "ေ" "လ" " " "း", it will become "ရွာေလး".
  return res;
}

const s1 = "ရွာ ေလ းတစ်ရွာက";
const s2 = "ြဖ စ်";
const s3 = "Hello \n World  This is double  space. Sentence 1 ။ Sentence 2";
const s4 = "စာကြောင်း ၁ ။ စာကြောင်း ၂";
const s5 = "Radha ( ရာဓာ ) တစ် ေယ ာက် ချမ်းလွန်းလို့ တုန်ယင် ပ ီ း ထိုင် ေန ရှာပါတယ်။";

console.log("1:", fixSpaces(s1));
console.log("2:", fixSpaces(s2));
console.log("3:", fixSpaces(s3));
console.log("4:", fixSpaces(s4));
console.log("5:", fixSpaces(s5));
