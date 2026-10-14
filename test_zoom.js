const freezeInterval = 4;
const freezeDuration = 2;
const zoomPower = 1.5;

const C = 30 * (freezeInterval + freezeDuration);
const I_frames = 30 * freezeInterval;
const inc = (zoomPower - 1.0) / (30 * freezeDuration);
const zExpr = `if(lt(mod(in,${C}),${I_frames}),1,min(max(zoom,1)+${inc.toFixed(5)},${zoomPower}))`;

console.log(`zoompan=z='${zExpr}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':fps=30:s=1080x1920`);
