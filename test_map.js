const finalVideoMap = "v2";
const mapStr = finalVideoMap.includes(":") ? finalVideoMap : `[${finalVideoMap}]`;
console.log(mapStr);
