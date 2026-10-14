const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

let ff = ffmpeg();
ff = ff.input('video.mp4');
ff = ff.input('audio.mp3');

let filterComplexGraph = "[0:v:0]split=2[fg1][bg1];[bg1]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=15:15[blur1];[fg1]scale=1080:1920:force_original_aspect_ratio=decrease,setsar=1[fg_scaled1];[blur1][fg_scaled1]overlay=(W-w)/2:(H-h)/2[v1]";

ff = ff.complexFilter(filterComplexGraph);
ff = ff.outputOptions([
    "-c:v", "libx264",
    "-preset", "fast",
    "-c:a", "aac",
    "-movflags", "+faststart",
    "-map", "[v1]",
    "-map", "1:a:0",
    "-shortest",
    "-y"
]);
ff.output('out.mp4');

ff.on('start', (cmd) => {
    console.log("Command:", cmd);
    process.exit(0);
});
ff.run();
