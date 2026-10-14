const trimStart = 10;
const trimEnd = 20;
const speed = 1.2;
const isBlurEnabled = true;
const blurPosition = 80;
const isZoomEnabled = true;
const isFreezeEnabled = false;

const videoFilters = [];
if (speed !== 1.0) {
  videoFilters.push(`setpts=${(1.0 / speed).toFixed(4)}*PTS`);
}
if (isZoomEnabled || isFreezeEnabled) {
  videoFilters.push("zoompan=z='min(zoom+0.0015,1.5)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=hd1080");
}

let filterComplexGraph = "";
let finalVideoMap = "0:v:0";

if (videoFilters.length > 0 || isBlurEnabled) {
   let currentPad = "[0:v:0]";
   let nextPadIdx = 1;
   
   if (videoFilters.length > 0) {
      const combinedVideoFilters = videoFilters.join(",");
      filterComplexGraph += `${currentPad}${combinedVideoFilters}[v${nextPadIdx}];`;
      currentPad = `[v${nextPadIdx}]`;
      nextPadIdx++;
   }

   if (isBlurEnabled) {
      const yPos = blurPosition / 100;
      filterComplexGraph += `${currentPad}split=2[main${nextPadIdx}][temp${nextPadIdx}];`;
      filterComplexGraph += `[temp${nextPadIdx}]crop=iw:ih*0.2:0:ih*${yPos},boxblur=20:5[blur${nextPadIdx}];`;
      filterComplexGraph += `[main${nextPadIdx}][blur${nextPadIdx}]overlay=0:H*${yPos}[v${nextPadIdx}];`;
      currentPad = `[v${nextPadIdx}]`;
      nextPadIdx++;
   }

   if (filterComplexGraph.endsWith(";")) {
       filterComplexGraph = filterComplexGraph.slice(0, -1);
   }
   finalVideoMap = currentPad.replace(/\[|\]/g, "");
}

console.log("Filter graph:", filterComplexGraph);
console.log("Final map:", finalVideoMap);
