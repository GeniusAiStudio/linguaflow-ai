const ffmpeg = require('fluent-ffmpeg');

let ff = ffmpeg();
ff = ff.inputOptions(['-ss', '10']);
ff = ff.input('video.mp4');
ff = ff.input('audio.mp3');

ff.on('start', (cmd) => {
    console.log("Command:", cmd);
});
ff.on('error', (err) => {
    console.log("Error:", err.message);
});
ff.output('out.mp4').run();
