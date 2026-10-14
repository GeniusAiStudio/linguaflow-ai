const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');

(async () => {
    let fontDir = path.join(os.tmpdir(), 'fonts');
    if (!fs.existsSync(fontDir)) fs.mkdirSync(fontDir, { recursive: true });
    
    const fontPath = path.join(fontDir, "Noto Sans Myanmar.ttf");
    if (!fs.existsSync(fontPath)) {
        const fontRes = await fetch("https://raw.githubusercontent.com/googlefonts/noto-fonts/main/unhinted/ttf/NotoSansMyanmar/NotoSansMyanmar-Regular.ttf");
        fs.writeFileSync(fontPath, Buffer.from(await fontRes.arrayBuffer()));
    }

    const srtPath = path.join(os.tmpdir(), "test.ass");
    fs.writeFileSync(srtPath, `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans Myanmar,50,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,2,8,20,20,85,0

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:05.00,Default,,0,0,0,,မင်္ဂလာပါ`);

    const outPath = path.join(os.tmpdir(), "test_out.mp4");
    
    await new Promise((resolve, reject) => {
        ffmpeg()
            .input('color=c=black:s=1920x1080:d=5')
            .inputFormat('lavfi')
            .complexFilter(`subtitles='${srtPath}':fontsdir='${fontDir}'`)
            .output(outPath)
            .on('end', resolve)
            .on('error', (err, stdout, stderr) => {
                console.error(stderr);
                reject(err);
            })
            .run();
    });
    console.log("Success! File size:", fs.statSync(outPath).size);
})();
