const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const oldBlurBlock = `               if (isBlurEnabled) {
                  const yPos = blurPosition / 100;
                  filterComplexGraph += \`\${currentPad}split=2[main\${nextPadIdx}][temp\${nextPadIdx}];\`;
                  filterComplexGraph += \`[temp\${nextPadIdx}]crop=iw:ih*0.2:0:ih*\${yPos},boxblur=20:5[blur\${nextPadIdx}];\`;
                  filterComplexGraph += \`[main\${nextPadIdx}][blur\${nextPadIdx}]overlay=0:H*\${yPos}[v\${nextPadIdx}];\`;
                  currentPad = \`[v\${nextPadIdx}]\`;
                  nextPadIdx++;
               }`;

const newBlurBlock = `               if (isBlurEnabled) {
                  const targetRatioStr = req.body.aspectRatio || "9:16";
                  let targetW = 1080;
                  let targetH = 1920;
                  if (targetRatioStr === "16:9") {
                      targetW = 1920;
                      targetH = 1080;
                  } else if (targetRatioStr === "1:1") {
                      targetW = 1080;
                      targetH = 1080;
                  } else if (targetRatioStr === "4:5") {
                      targetW = 1080;
                      targetH = 1350;
                  }
                  
                  filterComplexGraph += \`\${currentPad}split=2[fg\${nextPadIdx}][bg\${nextPadIdx}];\`;
                  filterComplexGraph += \`[bg\${nextPadIdx}]scale=\${targetW}:\${targetH}:force_original_aspect_ratio=increase,crop=\${targetW}:\${targetH},boxblur=20:5[blur\${nextPadIdx}];\`;
                  filterComplexGraph += \`[fg\${nextPadIdx}]scale=\${targetW}:\${targetH}:force_original_aspect_ratio=decrease[fg_scaled\${nextPadIdx}];\`;
                  filterComplexGraph += \`[blur\${nextPadIdx}][fg_scaled\${nextPadIdx}]overlay=(W-w)/2:(H-h)/2[v\${nextPadIdx}];\`;
                  currentPad = \`[v\${nextPadIdx}]\`;
                  nextPadIdx++;
               }`;

content = content.replace(oldBlurBlock, newBlurBlock);
fs.writeFileSync('server.ts', content);
console.log('Patched blur scaling');
