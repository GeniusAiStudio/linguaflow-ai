const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

let ff = ffmpeg();
ff = ff.inputOptions(['-ss', '10']);
ff = ff.input('video.mp4');
ff = ff.input('audio.mp3');

ff.on('start', (cmd) => {
    console.log("Command:", cmd);
    process.exit(0);
});
ff.on('error', (err) => {
    console.log("Error:", err.message);
    process.exit(1);
});
ff.output('out.mp4').run();
