const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const oldBlurAndFreeze = `          if (blurEnabled) {
             filterGraph += \`,split[bg][fg];\`;
             filterGraph += \`[bg]scale=\${Math.floor(w/8)*2}:\${Math.floor(h/8)*2}:force_original_aspect_ratio=increase,crop=\${Math.floor(w/8)*2}:\${Math.floor(h/8)*2},boxblur=5:5,scale=\${w}:\${h}[bgblurred];\`;
             filterGraph += \`[fg]scale=\${w}:\${h}:force_original_aspect_ratio=decrease[fgscaled];\`;
             filterGraph += \`[bgblurred][fgscaled]overlay=(W-w)/2:(H-h)/2,setsar=1\`;
          } else {
             filterGraph += \`,scale=\${w}:\${h}:force_original_aspect_ratio=increase,crop=\${w}:\${h},setsar=1\`;
          }
          
          if (freezeEnabled) {
             const C = 30 * ((freezeInterval || 4) + (freezeDuration || 2));
             const I_frames = 30 * (freezeInterval || 4);
             const inc = ((zoomPower || 1.5) - 1.0) / (30 * (freezeDuration || 2));
             const zExpr = \`if(lt(mod(in,\${C}),\${I_frames}),1,min(max(zoom,1)+\${inc.toFixed(5)},\${zoomPower || 1.5}))\`;
             filterGraph += \`,zoompan=z='\${zExpr}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':fps=30:s=\${w}x\${h}\`;
          }`;

const newBlurAndFreeze = `          // First ensure we are at the target size
          filterGraph += \`,scale=\${w}:\${h}:force_original_aspect_ratio=increase,crop=\${w}:\${h},setsar=1\`;

          if (altStyle && inputVideoPath && (!sceneImageUrls || sceneImageUrls.length <= 1)) {
             // Apply ALT-TR style to video
             filterGraph += \`,eq=saturation=1.3:contrast=1.1,unsharp=5:5:1.0:5:5:0.0\`;
          }
          
          if (blurEnabled) {
             const bStrength = blurStrength || 15;
             if (blurMode === 'CUSTOM') {
                const bx = Math.floor(w * ((blurX || 0) / 100));
                const by = Math.floor(h * ((blurY || 0) / 100));
                const bw = Math.floor(w * ((blurWidth || 100) / 100));
                const bh = Math.floor(h * ((blurHeight || 100) / 100));
                filterGraph += \`,split[main][toblur];[toblur]crop=\${bw}:\${bh}:\${bx}:\${by},boxblur=\${bStrength}:\${bStrength}[blurred];[main][blurred]overlay=\${bx}:\${by}:shortest=1\`;
             } else {
                filterGraph += \`,boxblur=\${bStrength}:\${bStrength}\`;
             }
          }
          
          if (freezeEnabled) {
             const C = 30 * ((freezeInterval || 4) + (freezeDuration || 2));
             const I_frames = 30 * (freezeInterval || 4);
             const inc = ((zoomPower || 1.5) - 1.0) / (30 * (freezeDuration || 2));
             const zExpr = \`if(lt(mod(in,\${C}),\${I_frames}),1,min(max(zoom,1)+\${inc.toFixed(5)},\${zoomPower || 1.5}))\`;
             filterGraph += \`,zoompan=z='\${zExpr}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':fps=30:s=\${w}x\${h}\`;
          }`;

content = content.replace(oldBlurAndFreeze, newBlurAndFreeze);
fs.writeFileSync('server.ts', content);
console.log("Patched server.ts filterGraph");
