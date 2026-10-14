import { repairAndNormalizeMyanmarText, insertZeroWidthSpaces } from './services/myanmarUnicodeUtils';

const s = "ကျောင်းသား";
const r = insertZeroWidthSpaces(s);
console.log(s === r);
console.log(r);
console.log(r.split('').map(c => c.charCodeAt(0).toString(16)).join(' '));
