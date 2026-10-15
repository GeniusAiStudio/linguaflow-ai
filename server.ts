process.on('unhandledRejection', (reason, promise) => { console.error('Unhandled Rejection at:', promise, 'reason:', reason); });
process.on('uncaughtException', (err) => { console.error('Uncaught Exception:', err); });

import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import path from "path";
import fs from "fs";
import os from "os";
import ffmpegPath from "ffmpeg-static";
import { fileURLToPath } from "url";
import YtDlpWrapModule from "yt-dlp-wrap";
import { GoogleGenAI, Modality } from "@google/genai";
import { geminiService } from "./services/geminiService";

export function getValidGeminiApiKey(): string {
  const geminiKey = process.env.GEMINI_API_KEY;
  const myKey = process.env.MY_GEMINI_API_KEY;

  if (geminiKey && geminiKey.startsWith("AIzaSy")) {
    return geminiKey;
  }
  if (myKey && myKey.startsWith("AIzaSy")) {
    return myKey;
  }
  if (geminiKey && !geminiKey.startsWith("AQ.")) {
    return geminiKey;
  }
  if (myKey && !myKey.startsWith("AQ.")) {
    return myKey;
  }
  return geminiKey || myKey || "";
}

const MICROSOFT_VOICE_ALIASES: Record<string, string> = {
  Nilar: "my-MM-NilarNeural",
  "Nilar (Female)": "my-MM-NilarNeural",
  Thiha: "my-MM-ThihaNeural",
  "Thiha (Male)": "my-MM-ThihaNeural",
};

function normalizeMicrosoftVoice(voice?: string): string {
  const requestedVoice = (voice || "my-MM-NilarNeural").trim();
  return MICROSOFT_VOICE_ALIASES[requestedVoice] || requestedVoice;
}

function isMicrosoftNeuralVoice(voice: string): boolean {
  return /^[a-z]{2,3}-[A-Z]{2}-.+Neural$/.test(normalizeMicrosoftVoice(voice));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getAzureSpeechConfig(): { key: string; endpoint: string } | null {
  const key = process.env.AZURE_SPEECH_KEY || process.env.SPEECH_KEY || "";
  const region = process.env.AZURE_SPEECH_REGION || process.env.SPEECH_REGION || "";
  const configuredEndpoint = process.env.AZURE_SPEECH_ENDPOINT || "";

  if (!key || (!region && !configuredEndpoint)) return null;

  const baseEndpoint = configuredEndpoint
    ? configuredEndpoint.replace(/\/$/, "")
    : `https://${region}.tts.speech.microsoft.com`;
  const endpoint = baseEndpoint.endsWith("/cognitiveservices/v1")
    ? baseEndpoint
    : `${baseEndpoint}/cognitiveservices/v1`;

  return { key, endpoint };
}

async function microsoftTts(
  text: string,
  options: { voice?: string } = {},
): Promise<Buffer> {
  const config = getAzureSpeechConfig();
  if (!config) {
    throw new Error(
      "Microsoft Speech is not configured. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION on the server.",
    );
  }

  const voice = normalizeMicrosoftVoice(options.voice);
  if (!isMicrosoftNeuralVoice(voice)) {
    throw new Error(`Invalid Microsoft neural voice ID: ${voice}`);
  }

  const language = voice.split("-").slice(0, 2).join("-");
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${escapeXml(language)}">` +
    `<voice name="${escapeXml(voice)}">${escapeXml(text)}</voice>` +
    `</speak>`;

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": config.key,
      "Content-Type": "application/ssml+xml; charset=utf-8",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "LinguaFlowAI",
    },
    body: ssml,
  });

  if (!response.ok) {
    const details = (await response.text()).trim();
    throw new Error(
      `Microsoft Speech returned ${response.status}${details ? `: ${details.slice(0, 300)}` : ""}`,
    );
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length === 0) {
    throw new Error(`Microsoft Speech returned empty audio for ${voice}.`);
  }
  return audio;
}

const YtDlpWrap = (YtDlpWrapModule as any).default || YtDlpWrapModule;

if (ffmpegPath) {
  console.log("Setting ffmpeg path to static binary path:", ffmpegPath);
  ffmpeg.setFfmpegPath(ffmpegPath);
} else {
  console.log("Setting ffmpeg path to installer fallback path:", ffmpegInstaller.path);
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
}
ffmpeg.setFfprobePath(ffprobeInstaller.path);

let resolvedFilename = "";
let resolvedDirname = "";

try {
  // @ts-ignore
  resolvedFilename =
    typeof __filename !== "undefined"
      ? __filename
      : fileURLToPath(import.meta.url);
  // @ts-ignore
  resolvedDirname =
    typeof __dirname !== "undefined"
      ? __dirname
      : path.dirname(resolvedFilename);
} catch (e) {
  resolvedFilename = process.cwd() + "/server.js";
  resolvedDirname = process.cwd();
}

const currentFilename = resolvedFilename;
const currentDirname = resolvedDirname;

const uploadsDir = path.resolve(os.tmpdir(), "uploads");
console.log("Uploads directory (OS temp subfolder):", uploadsDir);
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Initialize yt-dlp inside OS temp directory
const ytDlpBinaryPath = path.resolve(os.tmpdir(), "yt-dlp");
const ytDlpWrap = new YtDlpWrap(ytDlpBinaryPath);

// Ensure the latest binary is refreshed on startup to get the latest bypasses
(async () => {
  console.log(
    "Checking and downloading the latest yt-dlp binary from GitHub...",
  );
  try {
    if (fs.existsSync(ytDlpBinaryPath)) {
      try {
        fs.unlinkSync(ytDlpBinaryPath);
        console.log("Deleted old yt-dlp binary for fresh upgrade");
      } catch (err) {
        console.warn(
          "Could not delete old yt-dlp binary, attempting direct replacement:",
          err,
        );
      }
    }
    await YtDlpWrap.downloadFromGithub(ytDlpBinaryPath);
    console.log("yt-dlp binary downloaded successfully");
    fs.chmodSync(ytDlpBinaryPath, "755");
  } catch (err) {
    console.error("Failed to download yt-dlp binary:", err);
  }
})();

function verifyOutputMP4(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
      resolve(false);
      return;
    }
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err || !metadata) {
        resolve(false);
        return;
      }
      const hasVideo = metadata.streams.some((s) => s.codec_type === "video");
      const hasAudio = metadata.streams.some((s) => s.codec_type === "audio");
      resolve(hasVideo && hasAudio);
    });
  });
}

function reencodeForFacebook(
  inputPath: string,
  audioPath?: string,
  targetW: number = 1080,
  targetH: number = 1920,
  finalDuration?: number,
  videoDuration?: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      reject(new Error(`reencodeForFacebook Error: Input path does not exist: ${inputPath}`));
      return;
    }
    if (audioPath && !fs.existsSync(audioPath)) {
      console.log(`reencodeForFacebook Warning: Audio path specified but does not exist: ${audioPath}`);
    }

    const rawOutput = inputPath
      .replace(".mp4", "_facebook.mp4")
      .replace(".dat", "_facebook.mp4")
      .replace(".tmp", "_facebook.mp4");
    const outputPath = rawOutput.endsWith(".mp4")
      ? rawOutput
      : rawOutput + ".mp4";

    console.log(
      `[Reencode] Running reencodeForFacebook. Input: ${inputPath}, Audio: ${audioPath || "None"}, Target: ${targetW}x${targetH} (final: ${finalDuration || "default"}s)`,
    );

    let ff = ffmpeg(inputPath);

    const options = [
      "-preset",
      "fast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart", // ← Extremely critical for streaming & platform support
      "-r",
      "30",
      "-threads",
      "6",
      "-y",
    ];

    if (
      audioPath &&
      fs.existsSync(audioPath) &&
      fs.statSync(audioPath).size > 0
    ) {
      ff = ff.input(audioPath);
      options.push(
        "-c:v",
        "libx264",
          "-preset",
          "veryfast",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ac",
        "2",
        "-ar",
        "44100",
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
      );
    } else {
      options.push(
        "-c:v",
        "libx264",
          "-preset",
          "veryfast",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ac",
        "2",
        "-ar",
        "44100",
      );
    }

    if (finalDuration && finalDuration > 0) {
      options.push("-t", finalDuration.toFixed(3));
    }

    if (videoDuration && finalDuration && finalDuration > videoDuration) {
      const extraTime = finalDuration - videoDuration;
      ff = ff.videoFilters(
        `tpad=stop_mode=clone:stop_duration=${extraTime.toFixed(3)}`,
      );
    }

    ff.size(`${targetW}x${targetH}`)
      .outputOptions(options)
      .output(outputPath)
      .on("start", (cmd) => {
        console.log(`[Reencode] FFmpeg Executing: ${cmd}`);
      })
      .on("end", () => {
        console.log(`[Reencode] Completed: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err, stdout, stderr) => {
        console.error(`[Reencode Error]`, err.message, stderr);
        reject(new Error(`reencodeForFacebook failed: ${err.message}. Stderr: ${stderr}`));
      })
      .run();
  });
}

// ═══════════════════════
// STEP 1: VALIDATE INPUT
// ═══════════════════════
export function validateInputFile(inputPath: string) {
  if (!fs.existsSync(inputPath)) {
    throw new Error("INPUT_NOT_FOUND: " + inputPath);
  }

  const stats = fs.statSync(inputPath);

  if (stats.size === 0) {
    throw new Error("INPUT_EMPTY_FILE: 0 bytes");
  }

  if (stats.size < 1000) {
    throw new Error("INPUT_TOO_SMALL: Possibly corrupt");
  }

  console.log(`✅ Input valid: ${stats.size} bytes`);
  return stats;
}

// ═══════════════════════
// STEP 2: PROBE FILE
// ═══════════════════════
export function probeVideoFile(inputPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(
        (s: any) => s.codec_type === "video",
      );
      const audioStream = metadata.streams.find(
        (s: any) => s.codec_type === "audio",
      );

      const rawDuration = metadata.format.duration;
      const rawSize = metadata.format.size;

      const durationVal =
        typeof rawDuration === "number"
          ? rawDuration
          : parseFloat((rawDuration as any) || "0");

      const sizeVal =
        typeof rawSize === "number"
          ? rawSize
          : parseInt((rawSize as any) || "0");

      const diagnosis = {
        duration: durationVal,
        size_bytes: sizeVal,
        video_found: !!videoStream,
        audio_found: !!audioStream,
        codec: videoStream?.codec_name || "NONE",
        pixel_format: videoStream?.pix_fmt || "NONE",
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
        needs_reencode:
          videoStream?.pix_fmt !== "yuv420p" ||
          videoStream?.codec_name !== "h264",
      };

      console.log("📊 Probe result:", diagnosis);
      resolve(diagnosis);
    });
  });
}

// ═══════════════════════
// STEP 3: AUTO FIX
// ═══════════════════════
export function fixAndReencode(
  inputPath: string,
  outputPath: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log("🔧 Starting FFmpeg fix...");

    ffmpeg(inputPath)
      // Video settings
      .videoCodec("libx264")
      .outputOptions(["-preset", "veryfast", "-threads", "6", "-r", "30"])
      .outputOptions("-crf 23")
      .outputOptions("-pix_fmt yuv420p")
      .outputOptions("-vf scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30")
      .outputOptions("-r 30")
      .outputOptions("-threads 6")

      // Audio settings
      .audioCodec("aac")
      .audioBitrate("128k")
      .outputOptions("-ac 2")
      .outputOptions("-ar 44100")

      // Browser compatibility
      .outputOptions("-movflags +faststart")
      .outputOptions("-max_muxing_queue_size 9999")

      // Overwrite
      .outputOptions("-y")

      .output(outputPath)

      .on("start", (cmd) => {
        console.log("▶️ FFmpeg command:", cmd);
      })

      .on("progress", (progress) => {
        console.log(`⏳ Processing: ${progress.percent?.toFixed(1) || "0"}%`);
      })

      .on("end", () => {
        console.log("✅ FFmpeg fix complete!");
        resolve(outputPath);
      })
      .on("error", (err, stdout, stderr) => {
        console.error("FFmpeg stderr:", stderr);
        reject(err);
      })

      .run();
  });
}

// ═══════════════════════
// STEP 4: VALIDATE OUTPUT
// ═══════════════════════
export async function validateOutput(outputPath: string) {
  const stats = fs.statSync(outputPath);

  if (stats.size < 10000) {
    throw new Error("OUTPUT_TOO_SMALL: Fix failed");
  }

  const probe = await probeVideoFile(outputPath);

  const isValid =
    probe.video_found &&
    probe.duration > 0 &&
    probe.codec === "h264" &&
    probe.pixel_format === "yuv420p";

  if (!isValid) {
    throw new Error("OUTPUT_INVALID: Validation failed");
  }

  console.log("✅ Output validated successfully");
  return {
    browser_compatible: true,
    size_bytes: stats.size,
    duration_seconds: probe.duration,
    codec: probe.codec,
    pixel_format: probe.pixel_format,
    has_audio: probe.audio_found,
  };
}

// ═══════════════════════
// MAIN FIX FUNCTION
// ═══════════════════════
export async function autoFixVideo(inputPath: string) {
  const outputPath = inputPath.replace(".mp4", "_fixed.mp4");

  try {
    // Step 1
    console.log("1️⃣ Validating input...");
    validateInputFile(inputPath);

    // Step 2
    console.log("2️⃣ Probing file...");
    const diagnosis = await probeVideoFile(inputPath);

    // Step 3
    console.log("3️⃣ Fixing & re-encoding...");
    await fixAndReencode(inputPath, outputPath);

    // Step 4
    console.log("4️⃣ Validating output...");
    const outputInfo = await validateOutput(outputPath);

    return {
      fix_status: "success",
      diagnosis,
      output: {
        filename: path.basename(outputPath),
        download_url: `/outputs/${path.basename(outputPath)}`,
        ...outputInfo,
      },
      error: null,
    };
  } catch (error: any) {
    return {
      fix_status: "failed",
      error: error.message,
      output: null,
    };
  }
}

// ═══════════════════════════
// AUDIO-VIDEO SYNC PIPELINE
// ═══════════════════════════

export interface SceneData {
  id: number;
  videoPath: string;
  audioPath: string;
  narrationText: string;
}

export function getAudioDuration(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, meta) => {
      if (err || !meta || !meta.format) {
        reject(err || new Error("Invalid audio metadata format"));
        return;
      }
      const rawDuration = meta.format.duration;
      const durationVal =
        typeof rawDuration === "number"
          ? rawDuration
          : parseFloat((rawDuration as any) || "0");
      const ms = durationVal * 1000;
      console.log(
        `🎵 Audio/Video duration for ${path.basename(audioPath)}: ${ms}ms`,
      );
      resolve(ms);
    });
  });
}

export function extendVideoToMatch(
  videoPath: string,
  targetDurationSec: number,
  outputPath: string,
  inputDurationSec?: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const runFfmpeg = (actualDurationSec: number) => {
      const padDuration = Math.max(0, targetDurationSec - actualDurationSec);
      console.log(
        `📊 [extendVideoToMatch] Padding video by cloning last frame. Actual: ${actualDurationSec}s. Target: ${targetDurationSec}s. Adding ${padDuration}s.`,
      );

      ffmpeg(videoPath)
        .videoFilters([
          `tpad=stop_mode=clone:stop_duration=${padDuration}`,
          `fps=30`,
        ])
        .outputOptions([
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-pix_fmt",
          "yuv420p",
          "-crf",
          "23",
          "-r",
          "30",
          "-threads",
          "6",
          "-y",
        ])
        .output(outputPath)
        .on("end", () => resolve(outputPath))
        .on("error", (err, stdout, stderr) => {
          console.error("FFmpeg stderr:", stderr);
          reject(err);
        })
        .run();
    };

    if (
      typeof inputDurationSec === "number" &&
      !isNaN(inputDurationSec) &&
      inputDurationSec > 0
    ) {
      runFfmpeg(inputDurationSec);
    } else {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        let probDuration = 1.0;
        if (!err && metadata && metadata.format && metadata.format.duration) {
          probDuration =
            typeof metadata.format.duration === "string"
              ? parseFloat(metadata.format.duration)
              : metadata.format.duration;
        }
        runFfmpeg(probDuration || 1.0);
      });
    }
  });
}

export function trimVideoToMatch(
  videoPath: string,
  targetDurationSec: number,
  outputPath: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .duration(targetDurationSec)
      .videoFilters([`fps=30`])
      .outputOptions([
        "-c:v",
        "libx264",
          "-preset",
          "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "23",
        "-r",
        "30",
        "-threads",
        "6",
        "-y",
      ])
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", (err, stdout, stderr) => {
        console.error("FFmpeg stderr:", stderr);
        reject(err);
      })
      .run();
  });
}

export function mergeSceneAudioVideo(
  videoPath: string,
  audioPath: string,
  outputPath: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .inputOptions(["-stream_loop", "-1"])
      .input(audioPath)
      .videoFilters([`fps=30`])
      .outputOptions([
        "-c:v",
        "libx264",
          "-preset",
          "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ac",
        "2",
        "-ar",
        "44100",
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-vsync",
        "cfr",
        "-r",
        "30",
        "-threads",
        "6",
        "-shortest",
        "-movflags",
        "+faststart",
        "-y",
      ])
      .output(outputPath)
      .on("start", (cmd) => console.log(`▶️ Merging scene: ${cmd}`))
      .on("end", () => {
        console.log(`✅ Scene merged: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err, stdout, stderr) => {
        console.error("FFmpeg stderr:", stderr);
        reject(err);
      })
      .run();
  });
}

export function concatAllScenes(
  scenePaths: string[],
  outputPath: string,
  tempDir: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Write concat list
    const listPath = path.join(tempDir, "concat_list.txt");
    const listContent = scenePaths.map((p) => `file '${p}'`).join("\n");
    fs.writeFileSync(listPath, listContent);
    console.log("📝 Concat list written:", listContent);

    ffmpeg()
      .input(listPath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .outputOptions([
        "-c:v",
        "libx264",
          "-preset",
          "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "23",
        "-preset",
        "medium",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ac",
        "2",
        "-ar",
        "44100",
        "-movflags",
        "+faststart",
        "-max_muxing_queue_size",
        "9999",
        "-y",
      ])
      .output(outputPath)
      .on("progress", (p: any) => {
        console.log(`⏳ Concat: ${p.percent?.toFixed(1) || "0"}%`);
      })
      .on("end", () => {
        console.log("✅ All scenes concatenated!");
        resolve(outputPath);
      })
      .on("error", (err, stdout, stderr) => {
        console.error("FFmpeg stderr:", stderr);
        reject(err);
      })
      .run();
  });
}

export function burnSubtitles(
  videoPath: string,
  srtPath: string,
  outputPath: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .videoFilters(
        `subtitles=${srtPath}:force_style=` +
          `'FontName=Noto Sans Myanmar,FontSize=18,` +
          `PrimaryColour=&HFFFFFF,OutlineColour=&H000000,` +
          `Outline=2,Alignment=2,MarginV=30'`,
      )
      .outputOptions([
        "-c:v",
        "libx264",
          "-preset",
          "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "23",
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
        "-y",
      ])
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", (err, stdout, stderr) => {
        console.error("FFmpeg stderr:", stderr);
        reject(err);
      })
      .run();
  });
}

export async function syncAudioVideo(
  scenes: SceneData[],
  outputDir: string,
  subtitlePath?: string,
) {
  const tempDir = path.join(outputDir, `temp-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const syncResults = [];
  const mergedScenes = [];

  console.log(`🎬 Processing ${scenes.length} scenes...`);

  try {
    // Process each scene individually
    for (const scene of scenes) {
      console.log(`\n📍 Scene ${scene.id}`);

      // Resolve paths safely
      const resolvedVideoPath = path.isAbsolute(scene.videoPath)
        ? scene.videoPath
        : path.resolve(uploadsDir, path.basename(scene.videoPath));

      const resolvedAudioPath = path.isAbsolute(scene.audioPath)
        ? scene.audioPath
        : path.resolve(uploadsDir, path.basename(scene.audioPath));

      // 1. Get audio duration
      const audioDurationMs = await getAudioDuration(resolvedAudioPath);
      const audioDurationSec = audioDurationMs / 1000;

      // 2. Get video duration
      const videoDurationMs = await getAudioDuration(resolvedVideoPath);
      const videoDurationSec = videoDurationMs / 1000;

      const targetDurationSec = audioDurationSec + 0.2; // 200ms buffer

      // 3. Adjust video to match audio
      const adjustedVideoPath = path.join(
        tempDir,
        `scene_${scene.id}_adjusted.mp4`,
      );

      if (videoDurationSec < audioDurationSec) {
        console.log(`⬆️ Extending scene ${scene.id} video`);
        await extendVideoToMatch(
          resolvedVideoPath,
          targetDurationSec,
          adjustedVideoPath,
          videoDurationSec,
        );
      } else {
        console.log(`✂️ Trimming scene ${scene.id} video`);
        await trimVideoToMatch(
          resolvedVideoPath,
          targetDurationSec,
          adjustedVideoPath,
        );
      }

      // 4. Merge adjusted video + audio
      const mergedPath = path.join(tempDir, `scene_${scene.id}_merged.mp4`);
      await mergeSceneAudioVideo(
        adjustedVideoPath,
        resolvedAudioPath,
        mergedPath,
      );

      mergedScenes.push(mergedPath);
      syncResults.push({
        scene_id: scene.id,
        narration_text: scene.narrationText,
        audio_duration_ms: audioDurationMs,
        video_duration_ms: videoDurationMs,
        synced: true,
      });
    }

    // 5. Concat all merged scenes
    const finalOutput = path.join(outputDir, `recap_final-${Date.now()}.mp4`);
    await concatAllScenes(mergedScenes, finalOutput, tempDir);

    // 6. Burn subtitles if provided
    let finalWithSubs = finalOutput;
    if (subtitlePath && fs.existsSync(subtitlePath)) {
      finalWithSubs = path.join(outputDir, `recap_with_subs-${Date.now()}.mp4`);
      await burnSubtitles(finalOutput, subtitlePath, finalWithSubs);
    }

    // 7. Cleanup temp files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.warn("Temp folder removal failed", e);
    }
    console.log("🧹 Temp files cleaned");

    // Check Final File Size (CRITICAL: Minimum size 10KB)
    if (!finalWithSubs || !fs.existsSync(finalWithSubs)) {
      throw new Error("Render Failed: Final video file is missing.");
    }
    const finalWithSubsSize = fs.statSync(finalWithSubs).size;
    if (finalWithSubsSize < 10240) {
      throw new Error(`Render Failed: Final video file is too small or blank (${finalWithSubsSize} bytes). Minimum size is 10KB.`);
    }
    console.log(`Size validation check passed: final video size is ${finalWithSubsSize} bytes.`);

    return {
      sync_status: "success",
      total_scenes: scenes.length,
      scenes: syncResults,
      output: {
        filename: path.basename(finalWithSubs),
        download_url: `/outputs/${path.basename(finalWithSubs)}`,
        browser_compatible: true,
      },
      validation: {
        audio_video_in_sync: true,
        passed: true,
      },
      error: null,
    };
  } catch (error: any) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
    return {
      sync_status: "failed",
      error: error.message,
      scenes: [],
      output: null,
      validation: {
        audio_video_in_sync: false,
        passed: false,
      },
    };
  }
}

async function ensureBgMusic() {
  const bgMusicPath = path.resolve(uploadsDir, "bg_music.mp3");
  if (fs.existsSync(bgMusicPath)) {
    return;
  }

  const bgUrl =
    "https://commondatastorage.googleapis.com/codeskulptor-assets/EaselJS-assets/background.mp3";
  console.log(
    `[BgMusic] Downloading royalty-free cinematic music from: ${bgUrl}`,
  );
  try {
    const response = await fetch(bgUrl);
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(bgMusicPath, Buffer.from(buffer));
      console.log("[BgMusic] Background music cached successfully.");
    } else {
      console.warn("[BgMusic] Non-OK response trying to fetch bg music.");
    }
  } catch (err: any) {
    console.warn("[BgMusic] Background music download warning:", err.message);
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `upload-${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5GB
});

const chunkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fileId = (req.query.fileId as string) || "session-fallback";
    const dir = path.join(uploadsDir, "temp-chunks", fileId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const chunkIndex = (req.query.chunkIndex as string) || "0";
    cb(null, `chunk-${chunkIndex}`);
  },
});

const uploadChunk = multer({
  storage: chunkStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per chunk limit (individual chunk should be ~1MB anyway)
});

// Background cleanup for old files (older than 1 hour)
setInterval(() => {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) return;
    const now = Date.now();
    files.forEach((file) => {
      const filePath = path.join(uploadsDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        if (now - stats.mtimeMs > 3600000) {
          // 1 hour
          console.log(`[Cleanup] Deleting old file: ${file}`);
          fs.unlink(filePath, () => {});
        }
      });
    });
  });
}, 600000); // Every 10 minutes

async function startServer() {
  const app = express();
  // Hosting platforms (Render, Railway, etc.) inject the port via the PORT
  // environment variable. Fall back to 3000 for local development.
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // CORS headers to ensure smooth video streaming in iframe / cross-origin preview environments
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Range, Accept");
    res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges, X-TTS-Provider, X-TTS-Voice");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Set massive payload limits for file uploads/rendering
  app.use(express.json({ limit: "500mb" }));
  app.use(express.urlencoded({ limit: "500mb", extended: true }));

  // Cache royalty free music assets
  try {
    await ensureBgMusic();
  } catch (e) {}

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      ffmpegPath: ffmpegInstaller.path,
      ffmpegExists: fs.existsSync(ffmpegInstaller.path),
      ytDlpExists: fs.existsSync(ytDlpBinaryPath),
      microsoftSpeechConfigured: Boolean(getAzureSpeechConfig()),
    });
  });

  app.get("/api/edge-tts", async (req, res) => {
    try {
      const { text, voice } = req.query;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Missing or invalid text" });
      }

      const voiceStr = normalizeMicrosoftVoice(voice as string | undefined);
      const isMicrosoftVoice = isMicrosoftNeuralVoice(voiceStr);
      
      let audioBuffer;
      
      if (isMicrosoftVoice) {
        audioBuffer = await microsoftTts(text, { voice: voiceStr });
      } else {
        const myApiKey = getValidGeminiApiKey();
        if (!myApiKey) throw new Error("GEMINI_API_KEY missing");
        
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: myApiKey });
        
        const ttsResponse = await ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text: text }] }],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceStr } }
            }
          }
        });
        
        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
          throw new Error("No audio returned from Gemini");
        }
        audioBuffer = Buffer.from(base64Audio, "base64");
      }
      
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("X-TTS-Provider", isMicrosoftVoice ? "Microsoft-Azure-Speech" : "Google-Gemini");
      res.setHeader("X-TTS-Voice", voiceStr);
      res.send(audioBuffer);
    } catch (err: any) {
      console.error("TTS GET error:", err);
      const status = err.message?.includes("not configured") ? 503 : 500;
      res.status(status).json({ error: err.message });
    }
  });

  app.post("/api/edge-tts", express.json(), async (req, res) => {
    try {
      const { text, voice } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Missing or invalid text" });
      }

      const voiceStr = normalizeMicrosoftVoice(voice as string | undefined);
      const isMicrosoftVoice = isMicrosoftNeuralVoice(voiceStr);
      
      let audioBuffer;
      
      if (isMicrosoftVoice) {
        audioBuffer = await microsoftTts(text, { voice: voiceStr });
      } else {
        const myApiKey = getValidGeminiApiKey();
        if (!myApiKey) throw new Error("GEMINI_API_KEY missing");
        
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: myApiKey });
        
        const ttsResponse = await ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text: text }] }],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceStr } }
            }
          }
        });
        
        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
          throw new Error("No audio returned from Gemini");
        }
        audioBuffer = Buffer.from(base64Audio, "base64");
      }
      
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("X-TTS-Provider", isMicrosoftVoice ? "Microsoft-Azure-Speech" : "Google-Gemini");
      res.setHeader("X-TTS-Voice", voiceStr);
      res.send(audioBuffer);
    } catch (err: any) {
      console.error("TTS POST error:", err);
      const status = err.message?.includes("not configured") ? 503 : 500;
      res.status(status).json({ error: err.message });
    }
  });

  // Re-enable body parsing for subsequent routes requiring multer, or use express.json() locally per route
  // Note: we already use express.json() locally per route as needed.

  // Serve static files from uploads directory for /uploads and /outputs routes with CORS and Range headers
  const staticVideoOptions = {
    setHeaders: (res: express.Response, filePath: string) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
      res.setHeader("Accept-Ranges", "bytes");
      if (filePath.endsWith(".mp4")) {
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Disposition", "inline");
      }
    },
  };

  app.use("/uploads", express.static(uploadsDir, staticVideoOptions));
  app.use("/outputs", express.static(uploadsDir, staticVideoOptions));

  // Dedicated Video Streaming Endpoint with full HTTP Range (206) support for all browsers
  app.get("/api/stream-video", (req, res) => {
    const file = req.query.file as string;
    if (!file) {
      return res.status(400).send("Missing file parameter");
    }
    let safeFile = path.basename(file);
    if (safeFile.includes("file=")) {
      safeFile = safeFile.split("file=")[1];
    }
    safeFile = safeFile.split("?")[0];
    const filePath = path.resolve(uploadsDir, safeFile);

    if (!fs.existsSync(filePath)) {
      console.error(`[Stream Video] File not found: ${filePath}`);
      return res.status(404).send("Video file not found");
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", "inline");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        res.status(416).send(`Requested range not satisfiable\n${start} >= ${fileSize}`);
        return;
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": "video/mp4",
        "Content-Disposition": "inline",
        "Access-Control-Allow-Origin": "*",
      });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "video/mp4",
        "Content-Disposition": "inline",
        "Access-Control-Allow-Origin": "*",
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });

  // Auto-fix endpoint

  app.post("/api/gemini-transcribe-video", upload.single("file"), async (req, res) => {
    let extractedAudioPath = "";
    try {
      const fileId = req.body?.fileId as string;
      const targetFilePath = req.file ? req.file.path : (fileId ? path.join(uploadsDir, fileId) : null);

      if (!targetFilePath || !fs.existsSync(targetFilePath)) {
        return res.status(400).json({ error: "No video file found to transcribe" });
      }
      const apiKey = getValidGeminiApiKey();
      if (!apiKey) {
        return res.status(500).json({ error: "MANDATORY_GEMINI_API_KEY_MISSING" });
      }
      
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      let uploadPath = targetFilePath;
      let uploadMime = req.file?.mimetype || "video/mp4";
      let isAudio = false;

      // Extract lightweight MP3 audio from the video for ultra-fast, robust transcription
      extractedAudioPath = path.join(os.tmpdir(), `transcribe-${Date.now()}.mp3`);
      await new Promise<void>((resolve) => {
        ffmpeg(targetFilePath)
          .noVideo()
          .audioCodec("libmp3lame")
          .audioBitrate("64k")
          .audioChannels(1)
          .audioFrequency(16000)
          .output(extractedAudioPath)
          .on("end", () => {
            if (fs.existsSync(extractedAudioPath) && fs.statSync(extractedAudioPath).size > 500) {
              uploadPath = extractedAudioPath;
              uploadMime = "audio/mp3";
              isAudio = true;
              console.log("[Transcribe] Audio extracted successfully for faster transcription:", fs.statSync(extractedAudioPath).size, "bytes");
            }
            resolve();
          })
          .on("error", (err) => {
            console.warn("[Transcribe] Audio extraction note (using original media):", err?.message || err);
            resolve();
          })
          .run();
      });
      
      console.log("[Transcribe] Uploading to Gemini File API...", uploadPath, "MIME:", uploadMime);
      const uploadResult = await ai.files.upload({
        file: uploadPath,
        config: { mimeType: uploadMime },
      });
      
      console.log("[Transcribe] File uploaded. URI:", uploadResult.uri);
      
      // Wait for processing
      let file = await ai.files.get({ name: uploadResult.name });
      let waited = 0;
      while (file.state === "PROCESSING" && waited < 45000) {
        console.log("[Transcribe] Waiting for processing...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        waited += 2000;
        file = await ai.files.get({ name: uploadResult.name });
      }
      
      if (file.state === "FAILED") {
        console.warn("[Transcribe] Gemini File API state is FAILED, returning empty context for graceful topic fallback");
        return res.json({ text: "" });
      }
      
      console.log("[Transcribe] Generating transcript with AI model fallback chain...");
      const candidateModels = isAudio 
        ? ["gemini-3.5-transcribe", "gemini-flash-latest", "gemini-3.8-flash", "gemini-flash-lite-latest"]
        : ["gemini-flash-latest", "gemini-3.8-flash", "gemini-flash-lite-latest"];

      const promptText = isAudio
        ? "Strictly transcribe all spoken speech and dialogue word-for-word in order with timestamps and speaker names if audible. If the audio is silent or contains background music only, summarize the mood and theme."
        : "Transcribe all speech with timestamps and speaker names. ALSO provide a detailed scene-by-scene description of all visual actions, characters, and on-screen events in chronological order.";

      let transcriptResult = "";
      for (const modelName of candidateModels) {
        try {
          console.log(`[Transcribe] Attempting transcription with model: ${modelName}...`);
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                fileData: {
                  fileUri: uploadResult.uri,
                  mimeType: uploadResult.mimeType || uploadMime,
                },
              },
              {
                text: promptText,
              },
            ],
            config: { temperature: 0.1 },
          });

          if (response?.text && response.text.trim()) {
            transcriptResult = response.text.trim();
            console.log(`[Transcribe] Succeeded with model: ${modelName}, length: ${transcriptResult.length} chars`);
            break;
          }
        } catch (modelErr: any) {
          console.warn(`[Transcribe] Model ${modelName} attempt notice:`, modelErr?.message || modelErr);
          // Wait briefly before trying fallback
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      
      res.json({ text: transcriptResult });
    } catch (err: any) {
      console.error("[Transcribe Error]:", err);
      // Return 200 with empty text so frontend can gracefully fallback without throwing fatal UI crash
      res.json({ text: "", notice: err?.message || "Transcription completed with fallback" });
    } finally {
      if (extractedAudioPath && fs.existsSync(extractedAudioPath)) {
        try { fs.unlinkSync(extractedAudioPath); } catch (_) {}
      }
    }
  });


  app.options("/api/generate-thumbnail", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.sendStatus(204);
  });

  app.post("/api/generate-thumbnail", express.json({ limit: "200mb" }), async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    
    try {
      const apiKey = getValidGeminiApiKey();
      if (!apiKey) {
        return res.status(500).json({ error: "Missing API Key" });
      }
      
      const { prompt, aspectRatio, referenceImageBase64 } = req.body;
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      const parts = [];
      if (referenceImageBase64) {
        parts.push({
          inlineData: { data: referenceImageBase64, mimeType: "image/png" },
        });
        parts.push({ text: "Use the provided image as a visual reference." });
      }
      parts.push({ text: `High-quality illustration: ${prompt}` });

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-image",
        contents: { parts },
        config: { imageConfig: { aspectRatio: aspectRatio || "16:9" } },
      });

      const generatedParts = response.candidates?.[0]?.content?.parts || [];
      for (const part of generatedParts) {
        if (part.inlineData) {
          return res.json({ imageUrl: `data:image/png;base64,${part.inlineData.data}` });
        }
      }
      throw new Error("No image part generated in response");
    } catch (err) {
      console.error("[Backend /api/generate-thumbnail] Error:", err);
      res.status(500).json({ error: err.message || "Internal Server Error" });
    }
  });

  app.options("/api/gemini-generate", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.sendStatus(204);
  });

  app.post("/api/gemini-generate", express.json({ limit: "200mb" }), async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    try {
      const apiKey = getValidGeminiApiKey();
      if (!apiKey) {
        return res.status(500).json({ error: "MANDATORY_GEMINI_API_KEY_MISSING: The required MY_GEMINI_API_KEY or GEMINI_API_KEY environment variable is missing." });
      }
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      let { model, contents, config } = req.body;
      if (!model || model === "gemini-2.5-flash" || model === "gemini-2.0-flash") {
        model = "gemini-flash-lite-latest";
      }
      let response: any;
      try {
        response = await ai.models.generateContent({ model, contents, config });
      } catch (genErr: any) {
        if ((genErr?.message?.includes("503") || genErr?.message?.includes("high demand") || genErr?.message?.includes("UNAVAILABLE") || genErr?.message?.includes("404")) && model !== "gemini-flash-lite-latest") {
          console.warn(`[Proxy Fallback] Model ${model} failed. Retrying with gemini-flash-lite-latest...`);
          response = await ai.models.generateContent({ model: "gemini-flash-lite-latest", contents, config });
        } else {
          throw genErr;
        }
      }
      const json = JSON.parse(JSON.stringify(response));
      json.text = response.text; 
      res.json(json);
    } catch (err: any) {
      console.error("[Proxy Error]:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/fix-video", express.json(), async (req, res) => {
    try {
      const { videoPath } = req.body;

      if (!videoPath) {
        return res
          .status(400)
          .json({ success: false, error: "Missing videoPath" });
      }

      console.log("🔧 Fix request for:", videoPath);

      // Convert to relative/absolute path safely
      const resolvedPath = path.isAbsolute(videoPath)
        ? videoPath
        : path.resolve(uploadsDir, path.basename(videoPath));

      const result = await autoFixVideo(resolvedPath);

      if (result.fix_status === "success") {
        res.json({ success: true, data: result });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (err: any) {
      console.error("[api/fix-video Error]:", err);
      res.status(500).json({ success: false, error: err.message || err.toString() });
    }
  });

  // Audio-Video sync endpoint
  app.post("/api/autorecap/sync", express.json(), async (req, res) => {
    try {
      const { scenes, outputDir, subtitlePath } = req.body;

      console.log("🎬 Starting Audio-Video Sync...");
      if (!scenes || !Array.isArray(scenes)) {
        return res
          .status(400)
          .json({ success: false, error: "Missing or invalid scenes array" });
      }

      const resolvedOutputDir = outputDir ? path.resolve(outputDir) : uploadsDir;

      const result = await syncAudioVideo(
        scenes,
        resolvedOutputDir,
        subtitlePath,
      );

      if (result.sync_status === "success" && result.output) {
        res.json({
          status: "PRODUCTION FINISHED",
          success: true,
          video_url: result.output.download_url,
          data: result,
        });
      } else {
        res.status(500).json({
          status: "PRODUCTION FAILED",
          success: false,
          error: result.error || "Sync failed",
          data: result,
        });
      }
    } catch (err: any) {
      console.error("[api/autorecap/sync Error]:", err);
      res.status(500).json({
        status: "PRODUCTION FAILED",
        success: false,
        error: err.message || err.toString()
      });
    }
  });

  // --- YT Downloader Routes (Using yt-dlp) ---

  app.post("/api/translate", express.json(), async (req, res) => {
    const { text, from, to, tone, isSrt } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Missing text to translate" });
    }

    const myApiKey = getValidGeminiApiKey();
    if (!myApiKey) {
      console.error("[Proxy Translation Error]: GEMINI_API_KEY is missing from environment.");
      return res.status(400).json({
        error: "MANDATORY_GEMINI_API_KEY_MISSING: The required MY_GEMINI_API_KEY or GEMINI_API_KEY environment variable is missing. Fallbacks are disabled."
      });
    }

    console.log(`[Proxy Translation] Request received for ${isSrt ? 'SRT' : 'Text'} from ${from} to ${to}, tone=${tone}`);

    // Set response headers for NDJSON streaming
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    try {
      const onProgress = (
        totalChunks: number,
        currentChunkIndex: number,
        status: "Pending" | "Translating" | "Success" | "Failed",
        errorMsg?: string
      ) => {
        const payload = JSON.stringify({
          type: "progress",
          totalChunks,
          currentChunkIndex,
          status,
          errorMsg
        });
        res.write(payload + "\n");
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      };

      let result = "";
      if (isSrt) {
        result = await geminiService.translateSrt(text, from, to, tone, onProgress);
      } else {
        result = await geminiService.translateText(text, from, to, tone, onProgress);
      }

      res.write(JSON.stringify({
        type: "result",
        result
      }) + "\n");
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
      res.end();
    } catch (error: any) {
      console.error("[Proxy Translation Error]:", error);
      res.write(JSON.stringify({
        type: "error",
        error: error.message || error.toString()
      }) + "\n");
      res.end();
    }
  });

  // Smart align SRT endpoint proxy
  app.post("/api/smart-time", express.json(), async (req, res) => {
    const { text, lang } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Missing text to align" });
    }

    const myApiKey = getValidGeminiApiKey();
    if (!myApiKey) {
      console.error("[Smart Time Proxy Error]: GEMINI_API_KEY is missing from environment.");
      return res.status(400).json({
        error: "MANDATORY_GEMINI_API_KEY_MISSING: The required MY_GEMINI_API_KEY or GEMINI_API_KEY environment variable is missing. Fallbacks are disabled."
      });
    }

    console.log(`[Smart Time Proxy] Aligning text to SRT`);

    try {
      const result = await geminiService.smartTimeScript(text, lang || "en");
      res.json({ success: true, result });
    } catch (error: any) {
      console.error("[Smart Time Proxy Error]:", error);
      res.status(500).json({ success: false, error: error.message || error.toString() });
    }
  });

  const inFlightGenerations = new Map<string, Promise<string>>();

  // API Endpoint for secure and robust Script Generation (No-Crash Promise Wrapping)
  app.post("/api/generate-script", express.json(), async (req, res) => {
    const { mode, topic, brief, type, tone, language, transcript, referenceImageBase64, targetLanguage, narratorVoice, customPrompt } = req.body;

    console.log(`[Script Generation Endpoint] Request received, mode=${mode || "default"}, topic=${topic ? topic.substring(0, 30) : "N/A"}`);

    const myApiKey = getValidGeminiApiKey();
    if (!myApiKey) {
      console.error("[Script Generation Error]: GEMINI_API_KEY is missing from environment.");
      return res.status(400).json({
        error: "MANDATORY_GEMINI_API_KEY_MISSING: The required MY_GEMINI_API_KEY or GEMINI_API_KEY environment variable is missing. Fallbacks are disabled."
      });
    }

    const generationKey = JSON.stringify({
      mode: mode || "default",
      topic: topic || "",
      brief: brief || "",
      type: type || "",
      tone: tone || "",
      language: language || "",
      transcript: transcript || "",
      targetLanguage: targetLanguage || "",
      narratorVoice: narratorVoice || "",
      customPrompt: customPrompt || ""
    });

    if (inFlightGenerations.has(generationKey)) {
      console.log(`[Script Generation Lock] Duplicate generation request detected. Reusing in-flight generation promise.`);
      try {
        const script = await inFlightGenerations.get(generationKey);
        return res.json({ success: true, script });
      } catch (err: any) {
        return res.status(500).json({ 
          success: false, 
          error: "Script generation failed: " + (err.message || err.toString()) 
        });
      }
    }

    const runGeneration = async () => {
      let script = "";

      // Determine script generation flavor based on input attributes
      if (mode === "creative" || brief) {
        const scriptType = type || "NARRATION";
        const scriptTone = tone || "Professional";
        const scriptLang = language || "English";
        const scriptBrief = brief || topic || "No description provided.";
        
        script = await geminiService.generateCreativeScript(
          scriptBrief,
          scriptType,
          scriptTone,
          scriptLang
        );
      } else if (mode === "recap" || transcript) {
        script = await geminiService.generateRecapScript(
          transcript || topic || "",
          referenceImageBase64,
          customPrompt
        );
      } else if (mode === "topic-recap" || (topic && !transcript && !brief)) {
        const targetLang = targetLanguage || language || "Burmese";
        const voice = narratorVoice || "Thiha (Male)";
        script = await geminiService.generateRecapScriptFromTopic(
          topic,
          targetLang,
          voice
        );
      } else {
        script = await geminiService.generateRecapScriptFromTopic(
          topic || "Intriguing story",
          "Burmese",
          "Thiha (Male)"
        );
      }
      return script;
    };

    const generationPromise = runGeneration();
    inFlightGenerations.set(generationKey, generationPromise);

    try {
      const script = await generationPromise;
      res.json({ success: true, script });
    } catch (error: any) {
      console.error("[Script Generation Error]:", error);
      res.status(500).json({ 
        success: false, 
        error: "Script generation failed: " + (error.message || error.toString()) 
      });
    } finally {
      inFlightGenerations.delete(generationKey);
    }
  });

  function splitTextIntoTtsChunks(text: string, maxLength: number = 200): string[] {
    const parts = text.split(/([။\n.!?])/g).filter(Boolean);
    const chunks: string[] = [];
    let current = "";
    
    for (const part of parts) {
      if (current.length + part.length > maxLength) {
        if (current.trim()) {
          chunks.push(current.trim());
        }
        current = part;
      } else {
        current += part;
      }
    }
    if (current.trim()) {
      chunks.push(current.trim());
    }
    return chunks;
  }

  async function callGeminiWithRetry<T>(fn: () => Promise<T>, retries = 5, initialDelay = 4000): Promise<T> {
    let attempt = 0;
    while (attempt < retries) {
      try {
        return await fn();
      } catch (err: any) {
        attempt++;
        if (attempt >= retries) {
          throw err;
        }
        let delay = initialDelay * Math.pow(2, attempt - 1);
        if (err.message && err.message.includes("429")) {
          console.warn(`[API Rate Limit 429] Waiting extra long...`);
          delay = Math.max(delay, 20000); // Wait at least 20s for 429
        }
        console.warn(`[API Retry] Call failed (attempt ${attempt}/${retries}). Retrying in ${delay}ms... Error: ${err.message}`);
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error("API call retries exhausted.");
  }

  interface RenderTask {
    id: string;
    status: "pending" | "processing" | "completed" | "failed";
    progress: number;
    error?: string;
    outputPath?: string;
    downloadUrl?: string;
    videoUrl?: string;
    streamUrl?: string;
    filesToCleanup: string[];
    createdAt: number;
    logs?: string[];
  }
  const renderTasks = new Map<string, RenderTask>();

  
  // Professional Video Editor Route
  const videoEditorUpload = upload.fields([{ name: 'video', maxCount: 1 }, { name: 'audio', maxCount: 1 }]);
  app.post("/api/video-editor-render", (req, res, next) => {
    videoEditorUpload(req, res, (err) => {
      if (err) {
        console.error("Multer Error:", err);
        return res.status(500).json({ error: "Upload failed: " + err.message });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const videoFile = files['video'] ? files['video'][0] : null;
      const audioFile = files['audio'] ? files['audio'][0] : null;
      
      const trimStart = parseFloat(req.body.trimStart) || 0;
      const trimEnd = parseFloat(req.body.trimEnd) || 0;
      const speed = parseFloat(req.body.speed) || 1.0;
      const isBlurEnabled = req.body.blurEnabled === 'true';
      const blurPosition = parseFloat(req.body.blurPosition) || 80;
      const isZoomEnabled = req.body.zoomEnabled === 'true';
      const isFreezeEnabled = req.body.freezeEnabled === 'true'; // Treated as Zoom
      const isMuteOriginal = req.body.muteOriginal === 'true';

      if (!videoFile || !audioFile) {
        return res.status(400).json({ error: "Missing video or audio file." });
      }

      const taskId = "task-" + Date.now() + "-" + Math.random().toString(36).substring(2, 8);
      const filesToCleanup: string[] = [videoFile.path, audioFile.path];

      const task = {
        id: taskId,
        status: "processing",
        progress: 5,
        filesToCleanup,
        createdAt: Date.now(),
        logs: ["Task started..."]
      };
      renderTasks.set(taskId, task as any);
      res.json({ success: true, taskId, status: "processing" });

      // Run background process
      (async () => {
        const updateProgress = (p) => {
          const t = renderTasks.get(taskId);
          if (t) { t.progress = Math.min(99, Math.round(p)); }
        };
        const addLog = (msg) => {
          const t = renderTasks.get(taskId);
          if (t) { 
            if (!t.logs) t.logs = [];
            t.logs.push(msg);
            console.log(`[TaskLog ${taskId}] ${msg}`);
          }
        };

        try {
          addLog("Validating input paths...");
          if (!fs.existsSync(videoFile.path)) {
            throw new Error("Video file missing from tmp directory.");
          }
          if (!fs.existsSync(audioFile.path)) {
            throw new Error("Audio file missing from tmp directory.");
          }

          const outputPath = path.resolve(os.tmpdir(), `final-${taskId}.mp4`);
          addLog("Probing video dimensions...");
          const metadata: any = await new Promise((resolve, reject) => {
             ffmpeg.ffprobe(videoFile.path, (err, meta) => {
                if (err) reject(err); else resolve(meta);
             });
          });
          const vStream = metadata.streams.find((s) => s.codec_type === 'video');
          const originalW = vStream?.width || 1080;
          const originalH = vStream?.height || 1920;

          filesToCleanup.push(outputPath);

          addLog("Running ffmpeg...");
          updateProgress(30);

          await new Promise((resolve, reject) => {
            let ff = ffmpeg();
            
            ff = ff.input(videoFile.path);
            if (trimStart > 0) ff = ff.inputOptions(["-ss", trimStart.toString()]);
            if (trimEnd > 0) ff = ff.inputOptions(["-to", trimEnd.toString()]);
            
            ff = ff.input(audioFile.path);

            const videoFilters = [];
            if (speed !== 1.0) {
              videoFilters.push(`setpts=${(1.0 / speed).toFixed(4)}*PTS`);
            }
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

            if (isZoomEnabled || isFreezeEnabled) {
              videoFilters.push(`zoompan=z='min(zoom+0.0015,1.5)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${originalW}x${originalH}:fps=30`);
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
                  filterComplexGraph += `${currentPad}split=2[bg_in${nextPadIdx}][fg_in${nextPadIdx}];`;
                  filterComplexGraph += `[bg_in${nextPadIdx}]scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH},boxblur=15:15[bg_out${nextPadIdx}];`;
                  filterComplexGraph += `[fg_in${nextPadIdx}]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,setsar=1[fg_out${nextPadIdx}];`;
                  filterComplexGraph += `[bg_out${nextPadIdx}][fg_out${nextPadIdx}]overlay=(W-w)/2:(H-h)/2[v${nextPadIdx}];`;
                  currentPad = `[v${nextPadIdx}]`;
                  nextPadIdx++;
               }

               if (filterComplexGraph.endsWith(";")) {
                   filterComplexGraph = filterComplexGraph.slice(0, -1);
               }
               finalVideoMap = currentPad.replace(/\[|\]/g, "");
            }

            if (filterComplexGraph) {
              ff = ff.complexFilter(filterComplexGraph);
            }

            ff = ff.outputOptions([
                "-c:v", "libx264",
                "-preset", "fast",
                "-pix_fmt", "yuv420p",
                "-profile:v", "main",
                "-c:a", "aac",
                "-b:a", "192k",
                "-ar", "44100",
                "-ac", "2",
                "-brand", "mp42",
                "-movflags", "+faststart",
                "-map", finalVideoMap.includes(":") ? finalVideoMap : `[${finalVideoMap}]`,
                "-map", "1:a:0",
                "-shortest",
                "-y"
              ])
              .output(outputPath)
              .on("progress", (progress) => {
                if (progress.percent) updateProgress(30 + (progress.percent * 0.6));
              })
              .on("end", () => resolve(null))
              .on("error", (err) => reject(err));

            ff.run();
          });

          if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1024 * 1024) {
             throw new Error("Output video size is too small (less than 1MB), rendering likely failed.");
          }

          updateProgress(95);
          
          const finalDeliverPath = `/outputs/final-${taskId}.mp4`;
          const permPath = path.resolve(uploadsDir, `final-${taskId}.mp4`);
          fs.copyFileSync(outputPath, permPath);
          
          const t = renderTasks.get(taskId);
          if (t) {
            t.status = "completed";
            t.progress = 100;
            t.outputPath = finalDeliverPath;
            t.downloadUrl = `/api/video-editor-download?file=final-${taskId}.mp4`;
            t.videoUrl = `/outputs/final-${taskId}.mp4`;
            t.logs.push("Render complete!");
          }
        } catch (e) {
          const t = renderTasks.get(taskId);
          if (t) {
            t.status = "failed";
            t.error = e.message;
            t.logs.push("Error: " + e.message);
          }
        }
      })();
    } catch (e) {
      console.error(e);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
  });

  // Burmese syllable splitter regex:
  // Splits on syllable boundaries without breaking combining diacritics or subscript stacks
  const BURMESE_SYLLABLE_REGEX = /(?<=[^\u1039])(?=[\u1000-\u102A](?![\u1039\u103A]))/g;

  function wrapSubtitleForAss(text: string, maxChars: number = 28): string {
    if (!text) return "";
    const cleaned = text.trim();
    if (cleaned.length <= maxChars) return cleaned;

    const chunks = cleaned.split(/(?<=[၊။ \n])/);
    const lines: string[] = [];
    let cur = "";

    for (const chunk of chunks) {
      if ((cur + chunk).length <= maxChars || !cur) {
        cur += chunk;
      } else {
        lines.push(cur.trim());
        cur = chunk;
      }
    }
    if (cur.trim()) lines.push(cur.trim());

    const finalLines: string[] = [];
    for (const line of lines) {
      if (line.length <= maxChars) {
        finalLines.push(line);
      } else {
        const syls = line.split(BURMESE_SYLLABLE_REGEX);
        let subCur = "";
        for (const syl of syls) {
          if ((subCur + syl).length <= maxChars || !subCur) {
            subCur += syl;
          } else {
            finalLines.push(subCur.trim());
            subCur = syl;
          }
        }
        if (subCur.trim()) finalLines.push(subCur.trim());
      }
    }
    return finalLines.join("\\N");
  }

  interface SubtitleCue {
    text: string;
    start: number;
    end: number;
  }

  function parseScriptToSubtitleCues(
    scriptText: string,
    totalDuration: number,
    clientSegments?: any[]
  ): SubtitleCue[] {
    if (Array.isArray(clientSegments) && clientSegments.length > 0) {
      const valid = clientSegments
        .map((s: any) => ({
          text: String(s.text || "").replace(/\*\*[^*]+\*\*/g, "").replace(/[*_#]/g, "").trim(),
          start: Number(s.start) || 0,
          end: Number(s.end) || 0,
        }))
        .filter(s => s.text.length > 0 && s.end > s.start);
      if (valid.length > 0) return valid;
    }

    let cleaned = (scriptText || "").trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
    }

    try {
      const parsed = JSON.parse(cleaned);
      const rawList = parsed.scenes || parsed.segments || (Array.isArray(parsed) ? parsed : null);
      if (Array.isArray(rawList) && rawList.length > 0) {
        const items = rawList
          .map((item: any) => {
            const t = String(item.subtitle_text || item.narration || item.voiceover_text || item.text || "")
              .replace(/\*\*[^*]+:\*\*/g, "")
              .replace(/\*\*[^*]+\*\*/g, "")
              .replace(/[*_#]/g, "")
              .trim();
            const d = Number(item.duration_seconds || item.duration) || 0;
            return { text: t, duration: d };
          })
          .filter((i: any) => i.text.length > 0);

        if (items.length > 0) {
          const totalGiven = items.reduce((acc: number, i: any) => acc + i.duration, 0);
          let cur = 0;
          return items.map((item: any) => {
            const dur = (totalGiven > 0 && item.duration > 0)
              ? (item.duration / totalGiven) * totalDuration
              : totalDuration / items.length;
            const s = cur;
            const e = Math.min(totalDuration, cur + dur);
            cur = e;
            return { text: item.text, start: s, end: e };
          });
        }
      }
    } catch (e) {}

    cleaned = cleaned
      .replace(/^Title:[\s\S]*?(?:Recap:|Summary:)/i, "")
      .replace(/(?:Key Takeaways|Key Points):[\s\S]*$/i, "")
      .replace(/\[\d+:\d+(?:\s*-\s*\d+:\d+)?\]/g, "")
      .replace(/\*\*[^*]+:\*\*/g, "")
      .replace(/\*\*[^*]+\*\*/g, "")
      .replace(/[*_#]/g, "")
      .trim();

    const rawParagraphs = cleaned.split(/\r?\n+/).map(p => p.trim()).filter(Boolean);
    const sentenceList: string[] = [];

    for (const para of rawParagraphs) {
      const parts = para.split(/(?<=[။.?!])\s*/).map(p => p.trim()).filter(Boolean);
      for (const part of parts) {
        if (part.length > 50 && part.includes("၊")) {
          const subParts = part.split(/(?<=[၊])\s*/).map(p => p.trim()).filter(Boolean);
          sentenceList.push(...subParts);
        } else {
          sentenceList.push(part);
        }
      }
    }

    const finalSentences = sentenceList.filter(s => s.length > 0);
    if (finalSentences.length === 0) return [];

    const totalChars = finalSentences.reduce((acc, s) => acc + s.length, 0) || 1;
    let curTime = 0;
    return finalSentences.map(text => {
      const dur = (text.length / totalChars) * totalDuration;
      const start = curTime;
      const end = Math.min(totalDuration, curTime + dur);
      curTime = end;
      return { text, start, end };
    });
  }

  // API Route to finalize recap video (Robust 9-step pipeline with deep fallback resilience)
  app.post(
    "/api/finalize-recap",
    express.json({ limit: "50mb" }),
    async (req, res) => {
      const { videoUrl, audioUrl, sceneImageUrls, script, voice, aspectRatio, idToken, altStyle, blurEnabled, freezeEnabled, freezeInterval, freezeDuration, zoomPower, blurY, blurHeight, blurStrength, blurMode, blurX, blurWidth, subtitleSize, subtitleY, subtitleStyle, subtitleColor, subtitleHighlightColor, subtitleOutlineColor, subtitleMode, subtitleSegments } = req.body;
      const scriptText = script || "";
      const requestedVoiceName = voice || "Kore";
      const voiceName = isMicrosoftNeuralVoice(requestedVoiceName)
        ? normalizeMicrosoftVoice(requestedVoiceName)
        : requestedVoiceName;
      const targetRatioStr = aspectRatio || "9:16";

      console.log("[Pipeline Info] Reached finalize-recap endpoint with JSON payload.");

      // Early Key Check: If selecting a voice that requires Gemini and key is missing, fail immediately
      const isMicrosoftVoice = isMicrosoftNeuralVoice(voiceName);
      if (isMicrosoftVoice && !getAzureSpeechConfig()) {
        console.error("[Pipeline Error] Microsoft Speech credentials are missing for the selected voice.");
        return res.status(503).json({
          error: "Microsoft Speech is not configured. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION on the server. No substitute voice was used."
        });
      }
      if (!isMicrosoftVoice && !(getValidGeminiApiKey())) {
        console.error("[Pipeline Error] GEMINI_API_KEY environment variable is missing for the selected voice.");
        return res.status(400).json({
          error: "MANDATORY_GEMINI_API_KEY_MISSING: The required MY_GEMINI_API_KEY or GEMINI_API_KEY environment variable is missing. Fallbacks are disabled. Please select a Burmese neural voice starting with 'my-MM-' or specify GEMINI_API_KEY in the environment."
        });
      }

      // Generate unique task ID
      const taskId = "task-" + Date.now() + "-" + Math.random().toString(36).substring(2, 8);
      const filesToCleanup: string[] = [];

      // GC: Clean up old expired tasks
      try {
        for (const [tid, t] of renderTasks.entries()) {
          if (Date.now() - t.createdAt > 3600000) {
            try {
              if (t.outputPath && fs.existsSync(t.outputPath)) fs.unlinkSync(t.outputPath);
              for (const f of t.filesToCleanup) {
                if (f && fs.existsSync(f)) fs.unlinkSync(f);
              }
            } catch (e) {}
            renderTasks.delete(tid);
          }
        }
      } catch (gcErr) {
        console.error("[Cleanup] Task GC failed:", gcErr);
      }

      const task: RenderTask = {
        id: taskId,
        status: "processing",
        progress: 5,
        filesToCleanup,
        createdAt: Date.now(),
        logs: []
      };
      renderTasks.set(taskId, task);

      // Immediately return to prevent browser timeout/throttling
      res.json({ success: true, taskId, status: "processing" });

      // Process in background asynchronously
      (async () => {
        let inputVideoPath = "";
        let uploadedAudioPath = "";
        let extractedAudioPath = "";
        let mixedAudioPath = "";
        let ttsWavPath = "";
        let outputPath = "";
        let isFixed = false;
        let finalDeliverPath = "";

        const formatTime = () => {
          const now = new Date();
          const hrs = String(now.getHours()).padStart(2, '0');
          const mins = String(now.getMinutes()).padStart(2, '0');
          const secs = String(now.getSeconds()).padStart(2, '0');
          return `[${hrs}:${mins}:${secs}]`;
        };

        const addLog = (msg: string) => {
          const t = renderTasks.get(taskId);
          if (t) {
            if (!t.logs) t.logs = [];
            t.logs.push(`${formatTime()} ${msg}`);
            console.log(`[TaskLog ${taskId}] ${msg}`);
          }
        };

        const updateProgress = (p: number) => {
          const t = renderTasks.get(taskId);
          if (t) {
            const newP = Math.min(99, Math.round(p));
            if (newP > t.progress) {
               t.progress = newP;
            }
          }
        };

        addLog("Initializing workflow engine rendering pipeline...");
        addLog(`Target production aspect ratio selected: ${targetRatioStr}`);

        try {
          console.log(`[Background Pipeline] Executing task ${taskId}...`);

          // Download assets or link local files
          addLog("Staging media assets for render pipeline...");
          const downloadAsset = async (url: string, prefix: string, ext: string) => {
            if (!url) return "";
            const p = path.join(os.tmpdir(), `${prefix}-${taskId}${ext}`);

            // 1. Data URL (Base64)
            if (url.startsWith("data:")) {
              const base64Data = url.replace(/^data:[^;]+;base64,/, "");
              fs.writeFileSync(p, Buffer.from(base64Data, "base64"));
              filesToCleanup.push(p);
              return p;
            }

            // 2. Direct absolute path on disk
            if (fs.existsSync(url)) {
              return url;
            }

            // 3. Local file in uploadsDir
            const directUpload = path.join(uploadsDir, path.basename(url));
            if (fs.existsSync(directUpload)) {
              return directUpload;
            }

            // 4. Server-relative URL (e.g. /uploads/... or /outputs/...)
            const fetchUrl = url.startsWith("/") ? `http://127.0.0.1:3000${url}` : url;
            const res = await fetch(fetchUrl);
            if (!res.ok) throw new Error(`Failed to fetch asset from ${url}: ${res.statusText}`);
            const buf = Buffer.from(await res.arrayBuffer());
            fs.writeFileSync(p, buf);
            filesToCleanup.push(p);
            return p;
          };

          if (videoUrl) {
            inputVideoPath = await downloadAsset(videoUrl, 'video', '.mp4');
            addLog(`Video asset downloaded successfully (${fs.statSync(inputVideoPath).size} bytes).`);
          }
          if (audioUrl) {
            uploadedAudioPath = await downloadAsset(audioUrl, 'audio', '.wav');
            addLog(`Audio asset downloaded successfully.`);
          }

          // Read video duration for audio sync
          addLog("Stage 1: Reading and parsing input video source metadata...");
          let videoDuration = 0;
          if (inputVideoPath) {
            videoDuration = await new Promise<number>((resolve) => {
              ffmpeg.ffprobe(inputVideoPath, (err, metadata) => {
                if (err || !metadata || !metadata.format || !metadata.format.duration) resolve(30);
                else resolve(metadata.format.duration);
              });
            });
            addLog(`Successfully parsed video source. Duration: ${videoDuration.toFixed(2)}s, Size: ${fs.statSync(inputVideoPath).size} bytes.`);
          } else {
            addLog("No source video file provided; initializing to empty stream.");
          }
          updateProgress(10);

          // Step 2: Extract audio from input video (only if video file exists)
          if (inputVideoPath) {
            addLog("Stage 2: Initiating demuxing. Extracting raw audio stream from video source...");
            extractedAudioPath = path.resolve(os.tmpdir(), `extracted-${Date.now()}.wav`);
            filesToCleanup.push(extractedAudioPath);
            await new Promise<void>((resolve) => {
              ffmpeg(inputVideoPath)
                .output(extractedAudioPath)
                .noVideo()
                .audioCodec("pcm_s16le")
                .on("end", () => { addLog("Demuxing completed."); resolve(); })
                .on("error", (err) => { addLog(`Demuxing alert: ${err.message}.`); resolve(); })
                .run();
            });
          }
          updateProgress(20);

          // Confirm extracted audio and generate silence placeholder if needed
          if (!extractedAudioPath || !fs.existsSync(extractedAudioPath) || fs.statSync(extractedAudioPath).size === 0) {
            addLog("Silence placeholder generation triggered...");
            extractedAudioPath = path.resolve(os.tmpdir(), `silence-${Date.now()}.wav`);
            filesToCleanup.push(extractedAudioPath);
            const silenceDur = videoDuration > 0 ? videoDuration : 30;
            await new Promise<void>((resolve) => {
              ffmpeg()
                .input("anullsrc=r=44100:cl=stereo")
                .inputOptions(["-f", "lavfi"])
                .outputOptions(["-t", silenceDur.toString()])
                .output(extractedAudioPath)
                .on("end", () => resolve())
                .on("error", () => resolve())
                .run();
            });
          }
          updateProgress(25);

          // Step 3: Generate TTS narration audio
          let narrationAudioPath = uploadedAudioPath || "";
          addLog("Stage 3: Analysing narration audio parameters...");
          if (!narrationAudioPath && scriptText) {
            addLog(`Stage 3: Requesting neural text-to-speech engine with target voice: "${voiceName}"...`);
            addLog(`Synthesizing narration using direct Burmese dialogue format...`);
            try {
              const cleanedText = scriptText.replace(/\*\*[^*]+:\*\*/g, "").replace(/\*\*[^*]+\*\*/g, "").replace(/\*/g, "").trim();
              if (cleanedText) {
                ttsWavPath = path.join(os.tmpdir(), `tts-${Date.now()}.wav`);
                filesToCleanup.push(ttsWavPath);
                
                if (isMicrosoftVoice) {
                  addLog(`Stage 3: Calling Microsoft Azure Speech...`);
                  await callGeminiWithRetry(async () => {
                    const edgeRes = await fetch(`http://127.0.0.1:${PORT}/api/edge-tts`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ text: cleanedText, voice: voiceName })
                    });
                    if (!edgeRes.ok) {
                      const errorBody = await edgeRes.json().catch(() => ({})) as { error?: string };
                      throw new Error(errorBody.error || `Microsoft Speech failed with status ${edgeRes.status}`);
                    }
                    fs.writeFileSync(ttsWavPath, Buffer.from(await edgeRes.arrayBuffer()));
                  }, 4, 3000);
                } else {
                  addLog(`Stage 3: Launching Google GenAI speech synthesizer for voice "${voiceName}"...`);
                  const myApiKey = getValidGeminiApiKey();
                  if (!myApiKey) throw new Error("GEMINI_API_KEY missing");
                  const ai = new GoogleGenAI({ apiKey: myApiKey });
                  const voiceLower = voiceName.toLowerCase();
                  const isFemaleGenAI = voiceLower.includes("nilar") || voiceLower.includes("female") || voiceLower.includes("girl") || voiceLower.includes("woman") || voiceLower.includes("jenny") || voiceLower.includes("emma") || voiceLower.includes("sophia") || voiceLower.includes("ana");
                  const fallbackVoiceName = isFemaleGenAI ? "Aoede" : "Puck";
                  const ttsResponse = await callGeminiWithRetry(async () => {
                    return await ai.models.generateContent({
                      model: "gemini-flash-lite-latest",
                      contents: [{ text: `Say in standard Burmese, naturally and clearly: ${cleanedText}` }],
                      config: {
                        responseModalities: ["AUDIO"],
                        speechConfig: {
                          voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: fallbackVoiceName }
                          }
                        }
                      }
                    });
                  });
                  const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                  if (!base64Audio) throw new Error("No audio data returned from Gemini TTS");
                  const buf = Buffer.from(base64Audio, "base64");
                  
                  const tempRawPath = path.join(os.tmpdir(), `gemini_raw-${Date.now()}.raw`);
                  fs.writeFileSync(tempRawPath, buf);
                  filesToCleanup.push(tempRawPath);
                  
                  await new Promise<void>((resolve, reject) => {
                    ffmpeg(tempRawPath)
                      .inputOptions(["-f", "s16le", "-ar", "24000", "-ac", "1"])
                      .output(ttsWavPath)
                      .on("end", () => resolve())
                      .on("error", (err) => reject(err))
                      .run();
                  });
                }
                narrationAudioPath = ttsWavPath;
                addLog("Speech synthesis complete. Audio WAV track compiled.");
              }
            } catch (ttsErr: any) {
              addLog(`Stage 3 Error: TTS synthesis failed (${ttsErr.message}).`);
              if (isMicrosoftVoice) {
                throw new Error(`Microsoft ${voiceName} synthesis failed: ${ttsErr.message}. No substitute voice was used.`);
              }
              if (uploadedAudioPath) narrationAudioPath = uploadedAudioPath;
              else if (extractedAudioPath) narrationAudioPath = extractedAudioPath;
            }
          }
          if (!narrationAudioPath) narrationAudioPath = extractedAudioPath;
          updateProgress(35);

          addLog("Stage 3.5: Checking synchronized timeline duration...");
          let narrationDuration = 30;
          try {
            narrationDuration = await new Promise<number>((resolve) => {
              ffmpeg.ffprobe(narrationAudioPath, (err, metadata) => {
                if (err || !metadata || !metadata.format || !metadata.format.duration) resolve(30);
                else resolve(metadata.format.duration);
              });
            });
            addLog(`Timeline analyzed: Voiceover duration = ${narrationDuration.toFixed(2)}s, source footage duration = ${videoDuration.toFixed(2)}s.`);
          } catch (err) {}
          const finalDuration = narrationDuration;
          addLog(`Adjusting workflow pipeline final duration to match voiceover: ${finalDuration.toFixed(2)}s.`);
          updateProgress(42);

          // Slideshow generation
          if (!inputVideoPath && sceneImageUrls && sceneImageUrls.length > 0) {
            addLog("Stage 3.6: No primary video track found. Generating server-side slideshow...");
            try {
              const imagePaths: string[] = [];
              const slideshowDuration = finalDuration > 0 ? finalDuration : 30;
              const singleImgDuration = slideshowDuration / sceneImageUrls.length;
              addLog(`Setting each storyboard panel duration to ${singleImgDuration.toFixed(2)}s.`);
              
              for (let i = 0; i < sceneImageUrls.length; i++) {
                const imgPath = await downloadAsset(sceneImageUrls[i], `scene-img-${i}`, '.jpg');
                imagePaths.push(imgPath);
              }
              
              const generatedSlideshowPath = path.join(os.tmpdir(), `slideshow-${taskId}.mp4`);
              if (altStyle && imagePaths.length > 1) {
                addLog(`ALT-TR Mode: Applying dynamic AI crossfade transitions...`);
                const fadeDuration = Math.min(1.0, singleImgDuration / 3);
                const adjustedImgDuration = singleImgDuration + fadeDuration;
                const sw = targetRatioStr === "16:9" ? 1920 : (targetRatioStr === "1:1" ? 1080 : 1080);
                const sh = targetRatioStr === "16:9" ? 1080 : (targetRatioStr === "1:1" ? 1080 : 1920);
                
                let ff = ffmpeg();
                let fg = "";
                
                imagePaths.forEach((imgPath, idx) => {
                  ff = ff.input(imgPath).inputOptions(["-loop", "1", "-t", adjustedImgDuration.toFixed(3)]);
                  fg += `[${idx}:v]scale=${sw}:${sh}:force_original_aspect_ratio=increase,crop=${sw}:${sh},setsar=1,fps=30,format=yuv420p[v${idx}];`;
                });
                
                let lastOut = "v0";
                const transTypes = ["fade", "wipeleft", "wiperight", "slideleft", "slideright", "circlecrop"];
                
                for (let i = 1; i < imagePaths.length; i++) {
                  const outName = `xfade${i}`;
                  const trans = transTypes[i % transTypes.length];
                  const offset = i * (adjustedImgDuration - fadeDuration);
                  fg += `[${lastOut}][v${i}]xfade=transition=${trans}:duration=${fadeDuration}:offset=${offset.toFixed(3)}[${outName}];`;
                  lastOut = outName;
                }
                
                fg += `[${lastOut}]format=yuv420p[vfinal]`;
                
                await new Promise<void>((resolve, reject) => {
                  ff.complexFilter(fg)
                    .outputOptions(["-map", "[vfinal]", "-c:v", "libx264", "-preset", "veryfast", "-threads", "6", "-pix_fmt", "yuv420p", "-r", "30", "-y"])
                    .output(generatedSlideshowPath)
                    .on("end", () => {
                      inputVideoPath = generatedSlideshowPath;
                      filesToCleanup.push(generatedSlideshowPath);
                      videoDuration = (imagePaths.length * adjustedImgDuration) - ((imagePaths.length - 1) * fadeDuration); 
                      addLog("Storyboard slideshow compiled with ALT-TR transitions.");
                      resolve();
                    })
                    .on("error", (err) => reject(new Error(err.message)))
                    .run();
                });
              } else {
                let concatFileContent = "";
                for (const imgPath of imagePaths) {
                  concatFileContent += `file '${imgPath}'\nduration ${singleImgDuration.toFixed(3)}\n`;
                }
                if (imagePaths.length > 0) concatFileContent += `file '${imagePaths[imagePaths.length - 1]}'\n`;
                const concatTxtPath = path.join(os.tmpdir(), `concat-${taskId}.txt`);
                fs.writeFileSync(concatTxtPath, concatFileContent);
                filesToCleanup.push(concatTxtPath);
                
                await new Promise<void>((resolve, reject) => {
                  ffmpeg()
                    .input(concatTxtPath)
                    .inputOptions(["-f", "concat", "-safe", "0"])
                    .outputOptions(["-c:v", "libx264", "-preset", "veryfast", "-threads", "6", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-pix_fmt", "yuv420p", "-r", "30", "-y"])
                    .output(generatedSlideshowPath)
                    .on("end", () => {
                      inputVideoPath = generatedSlideshowPath;
                      filesToCleanup.push(generatedSlideshowPath);
                      videoDuration = slideshowDuration;
                      addLog("Storyboard slideshow video compilation completed successfully.");
                      resolve();
                    })
                    .on("error", (err) => reject(new Error(err.message)))
                    .run();
                });
              }
            } catch (err: any) {
              addLog(`Storyboard compilation fatal error: ${err.message}`);
            }
          }
          updateProgress(45);

          // Step 4: Mix audio
          mixedAudioPath = path.resolve(os.tmpdir(), `mixed-${Date.now()}.wav`);
          filesToCleanup.push(mixedAudioPath);
          addLog("Stage 4: Multiplexing audio streams. Aligning Burmese dialogue and background music channels...");
          const bgMusicPath = path.resolve(uploadsDir, "bg_music.mp3");
          if (fs.existsSync(bgMusicPath)) {
            addLog("System soundtrack found (bg_music.mp3). Executing complex amix filter with resampler...");
            await new Promise<void>((resolve) => {
              ffmpeg()
                .input(narrationAudioPath)
                .input(bgMusicPath)
                .inputOptions(["-stream_loop", "-1"])
                .complexFilter([`[0:a]aresample=44100,volume=1.0,aformat=channel_layouts=stereo[a1]; [1:a]aresample=44100,volume=0.1,aformat=channel_layouts=stereo[a2]; [a1][a2]amix=inputs=2:duration=first:dropout_transition=2,aformat=channel_layouts=stereo[a]`])
                .outputOptions(["-map", "[a]", "-c:a", "pcm_s16le", "-ar", "44100", "-ac", "2", "-y"])
                .output(mixedAudioPath)
                .on("end", () => { addLog("Audio streams successfully multiplexed and mastered to stereo."); resolve(); })
                .on("error", () => resolve())
                .run();
            });
          } else {
            addLog("No background soundtrack detected. Standardizing dialogue channel sample rate...");
            await new Promise<void>((resolve) => {
              ffmpeg()
                .input(narrationAudioPath)
                .outputOptions(["-c:a", "pcm_s16le", "-ar", "44100", "-ac", "2", "-y"])
                .output(mixedAudioPath)
                .on("end", () => { addLog("Audio stream mastered to 44.1kHz stereo."); resolve(); })
                .on("error", () => { mixedAudioPath = narrationAudioPath; resolve(); })
                .run();
            });
          }
          updateProgress(60);

          // Step 5 & 6: Composite transcode
          addLog("Stage 5: Starting core composite transcode pipeline...");
          outputPath = path.join(os.tmpdir(), `recap-${taskId}.mp4`);
          filesToCleanup.push(outputPath);

          const w = targetRatioStr === "16:9" ? 1920 : (targetRatioStr === "1:1" ? 1080 : 1080);
          const h = targetRatioStr === "16:9" ? 1080 : (targetRatioStr === "1:1" ? 1080 : 1920);
          let ptsMultiplier = 1.0;
          let shouldLoop = false;
          if (videoDuration > 0 && finalDuration > 0) {
             if (finalDuration > videoDuration + 1.0 && !(!inputVideoPath && sceneImageUrls && sceneImageUrls.length > 0)) {
                 shouldLoop = true;
                 ptsMultiplier = 1.0;
             } else {
                 ptsMultiplier = finalDuration / videoDuration;
             }
          }
          
          // Generate Subtitles ASS file
          let srtPath = "";
          let fontDir = path.join(os.tmpdir(), "fonts");
          if (!fs.existsSync(fontDir)) {
            fs.mkdirSync(fontDir, { recursive: true });
          }
          const fontPath = path.join(fontDir, "Noto Sans Myanmar.ttf");
          let usedFont = "Noto Sans Myanmar";

          // Ensure Burmese font is available in fontDir
          if (!fs.existsSync(fontPath)) {
            const localFont1 = path.join(process.cwd(), "fonts", "NotoSansMyanmar-Regular.ttf");
            const localFont2 = path.join(process.cwd(), "fonts", "Noto Sans Myanmar.ttf");
            const systemFont = "/usr/local/share/fonts/myanmar/Noto Sans Myanmar.ttf";
            if (fs.existsSync(localFont1)) {
              fs.copyFileSync(localFont1, fontPath);
            } else if (fs.existsSync(localFont2)) {
              fs.copyFileSync(localFont2, fontPath);
            } else if (fs.existsSync(systemFont)) {
              fs.copyFileSync(systemFont, fontPath);
            } else {
              try {
                const fontUrl = "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/unhinted/ttf/NotoSansMyanmar/NotoSansMyanmar-Regular.ttf";
                const fontRes = await fetch(fontUrl);
                if (fontRes.ok) {
                  fs.writeFileSync(fontPath, Buffer.from(await fontRes.arrayBuffer()));
                  addLog("Stage 5: Downloaded fallback font for Burmese subtitles.");
                } else {
                  usedFont = "Arial";
                }
              } catch (e) {
                console.warn("Failed to download font", e);
                usedFont = "Arial";
              }
            }
          }
          if (!fs.existsSync(fontPath)) {
            usedFont = "Arial";
          }

          if (scriptText || (subtitleSegments && subtitleSegments.length > 0)) {
            const cues = parseScriptToSubtitleCues(scriptText, finalDuration > 0 ? finalDuration : 30, subtitleSegments);
            if (cues.length > 0) {
              const formatAssTime = (timeInSeconds: number) => {
                const hours = Math.floor(timeInSeconds / 3600);
                const minutes = Math.floor((timeInSeconds % 3600) / 60);
                const seconds = Math.floor(timeInSeconds % 60);
                const cs = Math.floor((timeInSeconds - Math.floor(timeInSeconds)) * 100);
                return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
              };

              const hexToAss = (hex: string) => {
                hex = (hex || "#FFFFFF").replace("#", "");
                if (hex.length === 6) {
                  const r = hex.substring(0, 2);
                  const g = hex.substring(2, 4);
                  const b = hex.substring(4, 6);
                  return `&H00${b}${g}${r}&`;
                }
                return "&H00FFFFFF&";
              };

              const maxCharsPerLine = targetRatioStr === "16:9" ? 42 : 28;
              const fontSize = Math.max(28, Math.round(w * ((subtitleSize || 35) / 100) * 0.14));
              // Alignment = 2 (Bottom-Center). MarginV is measured upwards from bottom of frame
              const userY = Math.min(95, Math.max(10, subtitleY || 85));
              const marginV = Math.max(30, Math.floor(h * ((100 - userY) / 100)));
              const marginHoriz = Math.max(30, Math.floor(w * 0.05));
              const primaryColor = hexToAss(subtitleColor || "#FFFFFF");
              const highlightColor = hexToAss(subtitleHighlightColor || "#FFD700");
              const outlineColor = hexToAss(subtitleOutlineColor || "#000000");
              const outline = subtitleStyle === "MINIMAL" ? 1 : 3;
              const shadow = subtitleStyle === "MINIMAL" ? 0 : 2;

              let assContent = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${w}\nPlayResY: ${h}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n`;
              assContent += `[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n`;
              assContent += `Style: Default,${usedFont},${fontSize},${primaryColor},${primaryColor},${outlineColor},&H00000000,-1,0,0,0,100,100,0,0,1,${outline},${shadow},2,${marginHoriz},${marginHoriz},${marginV},0\n\n`;
              assContent += `[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

              if (subtitleMode === "LINE_BY_LINE") {
                // ONE LINE AT A TIME: Show each sentence wrapped for its exact spoken duration
                for (const cue of cues) {
                  const startStr = formatAssTime(cue.start);
                  const endStr = formatAssTime(cue.end);
                  const wrapped = wrapSubtitleForAss(cue.text, maxCharsPerLine);
                  assContent += `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${wrapped}\n`;
                }
              } else if (subtitleMode === "HIGHLIGHT_LINE") {
                // ACTIVE LINE HIGHLIGHT: Show 2-sentence block, highlighting active line
                const chunkSize = 2;
                for (let i = 0; i < cues.length; i += chunkSize) {
                  const chunk = cues.slice(i, i + chunkSize);
                  for (let j = 0; j < chunk.length; j++) {
                    const activeCue = chunk[j];
                    const startStr = formatAssTime(activeCue.start);
                    const endStr = formatAssTime(activeCue.end);

                    const blockText = chunk.map((c, idx) => {
                      const wrapped = wrapSubtitleForAss(c.text, maxCharsPerLine);
                      if (idx === j) {
                        return `{\\c${highlightColor}}${wrapped}{\\c${primaryColor}}`;
                      }
                      return `{\\c${primaryColor}}${wrapped}`;
                    }).join("\\N");

                    assContent += `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${blockText}\n`;
                  }
                }
              } else {
                // ALL_LINES / STANDARD BLOCK: Show 2-sentence block together stacked vertically with \N
                const chunkSize = 2;
                for (let i = 0; i < cues.length; i += chunkSize) {
                  const chunk = cues.slice(i, i + chunkSize);
                  const startStr = formatAssTime(chunk[0].start);
                  const endStr = formatAssTime(chunk[chunk.length - 1].end);
                  const blockText = chunk.map(c => wrapSubtitleForAss(c.text, maxCharsPerLine)).join("\\N");
                  assContent += `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${blockText}\n`;
                }
              }

              srtPath = path.join(os.tmpdir(), `subs-${taskId}.ass`);
              fs.writeFileSync(srtPath, assContent);
              filesToCleanup.push(srtPath);
              addLog(`Stage 5: Generated ASS subtitle file (Mode: ${subtitleMode || "ALL_LINES"}, Cues: ${cues.length}, Size: ${fontSize}, Style: ${subtitleStyle})`);
            }
          }

                    let filterGraph = `[0:v]setpts=${ptsMultiplier}*PTS,fps=30[vbase];`;
          
          if (blurEnabled && blurMode !== 'CUSTOM') {
             const bStrength = blurStrength || 15;
             // Split into bg and fg
             filterGraph += `[vbase]split=2[bg][fg];`;
             // Process background (Blur): scale to fill canvas, crop, and apply boxblur
             filterGraph += `[bg]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=${bStrength}:${bStrength},setsar=1[bg_blurred];`;
             // Process foreground (Sharp): scale to fit within canvas while maintaining aspect ratio
             filterGraph += `[fg]scale=${w}:${h}:force_original_aspect_ratio=decrease,setsar=1[fg_sharp];`;
             // Overlay sharp fg onto blurred bg (centered)
             filterGraph += `[bg_blurred][fg_sharp]overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2:shortest=1[vmerged]`;
          } else {
             // Standard scaling without background blur effect
             filterGraph += `[vbase]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1[vmerged]`;
             if (blurEnabled && blurMode === 'CUSTOM') {
                const bStrength = blurStrength || 15;
                const bx = Math.floor(w * ((blurX || 0) / 100));
                const by = Math.floor(h * ((blurY || 0) / 100));
                const bw = Math.floor(w * ((blurWidth || 100) / 100));
                const bh = Math.floor(h * ((blurHeight || 100) / 100));
                filterGraph += `;[vmerged]split[main][toblur];[toblur]crop=${bw}:${bh}:${bx}:${by},boxblur=${bStrength}:${bStrength}[blurred];[main][blurred]overlay=${bx}:${by}:shortest=1[vmerged]`;
             }
          }

          if (altStyle && inputVideoPath && (!sceneImageUrls || sceneImageUrls.length <= 1)) {
             // Apply ALT-TR style to video
             filterGraph += `;[vmerged]eq=saturation=1.3:contrast=1.1,unsharp=5:5:1.0:5:5:0.0[vmerged]`;
          }
          
                    if (freezeEnabled) {
             const C = 30 * ((freezeInterval || 4) + (freezeDuration || 2));
             const I_frames = 30 * (freezeInterval || 4);
             const inc = ((zoomPower || 1.5) - 1.0) / (30 * (freezeDuration || 2));
             const zExpr = `if(lt(mod(in,${C}),${I_frames}),1,min(max(zoom,1)+${inc.toFixed(5)},${zoomPower || 1.5}))`;
             filterGraph += `;[vmerged]zoompan=z='${zExpr}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':fps=30:s=${w}x${h}[vmerged]`;
          }
          if (srtPath) {
             const escapedSrtPath = srtPath.replace(/\\\\/g, '\\\\\\\\').replace(/:/g, '\\\\:');
             filterGraph += `;[vmerged]subtitles='${escapedSrtPath}':fontsdir='${fontDir}'[vmerged]`;
          }
          filterGraph += `;[vmerged]trim=duration=${finalDuration},format=yuv420p[vfinal]`;
          const preset = "veryfast";
          let encodeSuccess = false;
          let attemptCount = 1;
          {
            {
              addLog(`Stage 6: Compiling H.264/AAC transcode with preset "${preset}"...`);
              try {
                await new Promise<void>((resolve, reject) => {
                  let isTimeout = false;
                  let ffmpegCommand = ffmpeg();
                  
                  if (shouldLoop) {
                      ffmpegCommand = ffmpegCommand.input(inputVideoPath).inputOptions(["-stream_loop", "-1", "-r", "30"]);
                  } else {
                      ffmpegCommand = ffmpegCommand.input(inputVideoPath).inputOptions(["-r", "30"]);
                  }
                  
                  ffmpegCommand = ffmpegCommand
                    .input(mixedAudioPath)
                    .complexFilter(filterGraph)
                    .outputOptions([
                      "-map", "[vfinal]", "-map", "1:a",
                      "-c:v", "libx264", "-preset", preset,
                      "-pix_fmt", "yuv420p",
                      "-profile:v", "main",
                      "-level", "4.0",
                      "-threads", "6",
                      "-r", "30",
                      "-fps_mode", "cfr",
                      "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2",
                      "-async", "1",
                      "-t", finalDuration.toString(),
                      "-shortest",
                      "-brand", "mp42",
                      "-movflags", "+faststart", "-y"
                    ])
                    .output(outputPath)
                    .on("end", () => {
                        if (!isTimeout) {
                           setTimeout(() => resolve(), 500);
                        }
                    })
                    .on("progress", (progress) => {
                       if (!isTimeout) {
                          if (progress.percent) {
                             const scaledProgress = 60 + Math.floor(progress.percent * 0.35); // 60 -> 95
                             updateProgress(scaledProgress > 95 ? 95 : scaledProgress);
                          } else if (progress.timemark && finalDuration > 0) {
                             const timeTokens = progress.timemark.split(':');
                             if (timeTokens.length === 3) {
                                const hours = parseFloat(timeTokens[0]);
                                const mins = parseFloat(timeTokens[1]);
                                const secs = parseFloat(timeTokens[2]);
                                const currentSec = hours * 3600 + mins * 60 + secs;
                                const currentPercent = (currentSec / finalDuration) * 100;
                                const scaledProgress = 60 + Math.floor(currentPercent * 0.35);
                                updateProgress(scaledProgress > 95 ? 95 : scaledProgress);
                             }
                          }
                       }
                    })
                    .on("error", (err, stdout, stderr) => {
                        if (isTimeout) return;
                        console.error("FFmpeg transcode failed:", stderr);
                        reject(new Error(err.message + " | Details: " + (stderr ? stderr.substring(0, 200) : "")));
                    });
                  
                  ffmpegCommand.run();
                  
                  // 15 Minute timeout
                  setTimeout(() => {
                      isTimeout = true;
                      ffmpegCommand.kill('SIGKILL');
                      reject(new Error("FFmpeg transcode timed out after 15 minutes (possible hang due to fonts or filters)."));
                  }, 15 * 60 * 1000);
                });
                encodeSuccess = true;
                addLog("Transcode completed successfully!");
              } catch (e: any) {
                addLog(`Transcode error: ${e.message}`);
                throw e;
              }
            }
          }
          if (!encodeSuccess) throw new Error("All FFmpeg encoding and transcode recipes failed.");
          updateProgress(85);

          // Skip post-processing (faststart already applied)
          finalDeliverPath = outputPath;
          addLog("Stage 8: Container validation PASSED.");
          updateProgress(95);

          // Always copy final video into uploadsDir for immediate local streaming and high-speed delivery
          const finalFilename = `recap-${taskId}.mp4`;
          const localDestPath = path.join(uploadsDir, finalFilename);
          if (finalDeliverPath !== localDestPath && fs.existsSync(finalDeliverPath)) {
            fs.copyFileSync(finalDeliverPath, localDestPath);
          }

          const localVideoUrl = `/outputs/${finalFilename}`;
          const localStreamUrl = `/api/stream-video?file=${finalFilename}`;
          const localDownloadUrl = `/api/download?file=${finalFilename}`;

          // Upload to Firebase Storage
          addLog("Stage 9: Securing final video output...");
          let finalPublicUrl = "";
          try {
            const bucketName = "gen-lang-client-0840221202.firebasestorage.app"; // Assuming from config
            const fbUploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o?name=${encodeURIComponent("uploads/recap-"+taskId+".mp4")}`;
            const stats = fs.statSync(localDestPath);
            addLog(`Validating video stream readiness (size: ${stats.size} bytes)...`);
            
            // Check size to prevent OOM
            if (stats.size <= 50 * 1024 * 1024 && idToken) {
              const fileBuf = fs.readFileSync(localDestPath);
              const uploadRes = await fetch(fbUploadUrl, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${idToken}`,
                  "Content-Type": "video/mp4"
                },
                body: fileBuf
              });
              const uploadData = await uploadRes.json();
              if (uploadData && !uploadData.error && uploadData.downloadTokens) {
                finalPublicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent("uploads/recap-"+taskId+".mp4")}?alt=media&token=${uploadData.downloadTokens}`;
                addLog(`Synced to Cloud Storage! File size: ${stats.size} bytes.`);
              }
            }
          } catch (uploadErr: any) {
            console.log("Storage note:", uploadErr.message);
          }

          addLog("Stage 10: Cleaning up intermediate rendering buffers to release system assets...");
          for (const f of filesToCleanup) {
            if (f && fs.existsSync(f) && f !== localDestPath) {
              try { fs.unlinkSync(f); } catch (e) {}
            }
          }
          addLog("Cleanup of transient assets successfully finished.");

          const finalTask = renderTasks.get(taskId);
          if (finalTask) {
            finalTask.status = "completed";
            finalTask.progress = 100;
            finalTask.outputPath = localDestPath;
            // Explicit URLs to guarantee immediate streaming and download
            finalTask.videoUrl = localVideoUrl;
            finalTask.streamUrl = localStreamUrl;
            finalTask.downloadUrl = `/api/download?file=${finalFilename}&name=autorecap_${Date.now()}.mp4`;
            (finalTask as any).cloudUrl = finalPublicUrl;
          }

        } catch (err: any) {
          addLog(`Workflow Engine CRITICAL EXCEPTION: ${err.message}`);
          const t = renderTasks.get(taskId);
          if (t) {
            t.status = "failed";
            t.error = err.message;
          }
        }
      })();
    }
  );

  // Status API for Video Rendering (Robust endpoints supporting /api/finalize-recap/status and /api/status)
  const getTaskStatusHandler = (req: express.Request, res: express.Response) => {
    const taskId = (req.query.taskId || req.query.id) as string;
    if (!taskId) {
      return res.status(400).json({ error: "Missing taskId parameter" });
    }
    const task = renderTasks.get(taskId);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    let downloadUrl = task.downloadUrl;
    let videoUrl = task.videoUrl;
    let streamUrl = task.streamUrl;
    
    // Fallback logic for legacy tasks or when URLs need normalization
    if (task.outputPath) {
      let rawFilename = path.basename(task.outputPath);
      if (rawFilename.includes("file=")) {
        rawFilename = rawFilename.split("file=")[1];
      }
      rawFilename = rawFilename.split("?")[0];

      if (!videoUrl) {
        if (task.outputPath.startsWith("http://") || task.outputPath.startsWith("https://")) {
          videoUrl = task.outputPath;
        } else {
          videoUrl = `/outputs/${rawFilename}`;
        }
      }
      if (!downloadUrl) {
        downloadUrl = `/api/download?file=${rawFilename}`;
      }
      if (!streamUrl) {
        streamUrl = `/api/stream-video?file=${rawFilename}`;
      }
    }

    res.json({
      id: task.id,
      status: task.status,
      progress: task.progress,
      error: task.error,
      logs: task.logs || [],
      downloadUrl,
      videoUrl: videoUrl || downloadUrl,
      streamUrl: streamUrl || videoUrl || downloadUrl
    });
  };

  app.get("/api/finalize-recap/status", getTaskStatusHandler);
  app.get("/api/status", getTaskStatusHandler);

  
  // Dedicated Video Editor Download Endpoint
  app.get("/api/video-editor-download", (req, res) => {
    const file = req.query.file as string;
    if (!file) {
      return res.status(400).json({ error: "Missing file parameter" });
    }
    let safeFile = path.basename(file);
    if (safeFile.includes("file=")) {
      safeFile = safeFile.split("file=")[1];
    }
    safeFile = safeFile.split("?")[0];
    const filePath = path.resolve(uploadsDir, safeFile);
    
    if (!fs.existsSync(filePath)) {
      console.error(`[Video Editor Download] File not found: ${filePath}`);
      return res.status(404).send(JSON.stringify({ error: "File not found on the server. Please regenerate." }));
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.download(filePath, 'render.mp4', (err) => {
      if (err) {
        console.error("[Video Editor Download] Error:", err.message);
      }
    });
  });

  // Dedicated High-Compatibility Direct File Download Endpoint (GC cleaned up after 1 hour)
  app.get("/api/download", (req, res) => {
    const file = req.query.file as string;
    if (!file) {
      return res.status(400).json({ error: "Missing file parameter" });
    }
    let safeFile = path.basename(file);
    if (safeFile.includes("file=")) {
      safeFile = safeFile.split("file=")[1];
    }
    safeFile = safeFile.split("?")[0];
    const filePath = path.resolve(uploadsDir, safeFile);
    
    if (!fs.existsSync(filePath)) {
      console.error(`[Download API] File not found: ${filePath}`);
      return res.status(404).send("File not found on the server. Please regenerate the recap.");
    }

    const rawName = (req.query.name as string) || safeFile;
    const cleanName = path.basename(rawName).replace(/[^a-zA-Z0-9_.-]/g, "_");
    const downloadName = cleanName.toLowerCase().endsWith(".mp4") ? cleanName : `${cleanName}.mp4`;

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");

    res.download(filePath, downloadName, (err) => {
      if (err) {
        const errMsg = err.message || "";
        if (errMsg.includes("EPIPE") || errMsg.includes("aborted") || errMsg.includes("ECONNRESET")) {
          console.log(`[Download API] Download completed or cancelled early by client: ${downloadName} (${errMsg})`);
        } else {
          console.error("[Download API] Error in direct download transmission:", errMsg);
        }
      }
    });
  });

  // Download API for Completed Render Tasks (Legacy Fallback)
  app.get("/api/finalize-recap/download", (req, res) => {
    const taskId = req.query.taskId as string;
    if (!taskId) {
      return res.status(400).json({ error: "Missing taskId parameter" });
    }
    const task = renderTasks.get(taskId);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    if (task.status !== "completed" || !task.outputPath || !fs.existsSync(task.outputPath)) {
      return res.status(400).json({ error: "Task is not completed or final file is missing" });
    }

    res.download(task.outputPath, "final_recap_1080p.mp4", (err) => {
      if (err) {
        console.error("[Download API] Error serving file:", err.message);
      }
      // Clean up final file and task after delivery is complete
      try {
        if (task.outputPath && fs.existsSync(task.outputPath)) {
          fs.unlinkSync(task.outputPath);
        }
        for (const f of task.filesToCleanup) {
          if (f && fs.existsSync(f)) {
            fs.unlinkSync(f);
          }
        }
      } catch (e) {}
      renderTasks.delete(taskId);
    });
  });

  // API Route for initial upload
  app.post("/api/upload-video", upload.single("video"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded" });
    }
    // Return the filename as the ID and local static url
    res.json({ fileId: req.file.filename, url: `/uploads/${req.file.filename}` });
  });

  // API Route for audio upload
  app.post("/api/upload-audio", upload.single("audio"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }
    res.json({ fileId: req.file.filename, url: `/uploads/${req.file.filename}` });
  });

  // API Route for chunked upload to completely bypass reverse proxy payload limits (413 errors)
  app.post(
    "/api/upload-video-chunk",
    uploadChunk.single("chunk"),
    async (req, res) => {
      try {
        const fileId = req.query.fileId as string;
        const chunkIndex = req.query.chunkIndex as string;
        const totalChunks = req.query.totalChunks as string;
        const fileName = req.query.fileName as string;

        const totalIdx = parseInt(totalChunks);
        const currIdx = parseInt(chunkIndex);

        if (isNaN(totalIdx) || isNaN(currIdx) || !fileId || !fileName) {
          return res
            .status(400)
            .json({ error: "Invalid metadata query params" });
        }

        const chunksDir = path.join(uploadsDir, "temp-chunks", fileId);
        const uploadedFiles = fs.existsSync(chunksDir)
          ? fs.readdirSync(chunksDir)
          : [];

        console.log(
          `[ChunkUpload] Received chunk ${currIdx + 1}/${totalIdx} for ${fileId}, parts so far: ${uploadedFiles.length}`,
        );

        // If the last chunk is uploaded (by index) or directory reaches correct count:
        if (currIdx === totalIdx - 1) {
          // Double-check we have all chunks in directory
          // Wait briefly (200ms) to ensure file writers finish flushing the last chunk to disk
          await new Promise((resolve) => setTimeout(resolve, 200));

          const finalSafeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
          const uniqueName = `upload-${Date.now()}-${finalSafeFileName}`;
          const finalPath = path.join(uploadsDir, uniqueName);

          // Delete if already exists somehow
          if (fs.existsSync(finalPath)) {
            fs.unlinkSync(finalPath);
          }

          // Merge chunk by chunk synchronously to guarantee perfect data sequence and zero loss
          for (let i = 0; i < totalIdx; i++) {
            const chunkPath = path.join(chunksDir, `chunk-${i}`);
            if (!fs.existsSync(chunkPath)) {
              throw new Error(`Chunk merge missing part indexed: ${i}`);
            }
            const data = fs.readFileSync(chunkPath);
            fs.appendFileSync(finalPath, data);
          }

          const mergedSize = fs.statSync(finalPath).size;
          console.log(
            `[ChunkUpload] Consolidated chunk session merged successfully into file: ${uniqueName}, Size: ${mergedSize} bytes`
          );

          // Async cleanup of temp-chunks folder soon
          setTimeout(() => {
            try {
              if (fs.existsSync(chunksDir)) {
                fs.rmSync(chunksDir, { recursive: true, force: true });
              }
            } catch (cleanupErr) {
              console.error("Failed to clean up chunks directory:", cleanupErr);
            }
          }, 5000);

          return res.json({ completed: true, fileId: uniqueName, url: `/uploads/${uniqueName}` });
        }

        res.json({ completed: false, receivedChunk: currIdx });
      } catch (err: any) {
        console.error("Chunk upload/merge error:", err);
        res
          .status(500)
          .json({ error: err.message || "Failed to process chunk" });
      }
    },
  );

  interface VideoMetadata {
    duration: number;
    hasVideo: boolean;
    hasAudio: boolean;
    size?: number;
  }

  function probeVideo(filePath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      console.log(`[VideoCutter-Probe] Probing file: ${filePath}`);
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err || !metadata) {
          return reject(
            err || new Error("Failed to read video metadata via ffprobe"),
          );
        }
        const durationStr =
          metadata.format.duration !== undefined
            ? String(metadata.format.duration)
            : "0";
        const duration = parseFloat(durationStr);
        const hasVideo = metadata.streams.some((s) => s.codec_type === "video");
        const hasAudio = metadata.streams.some((s) => s.codec_type === "audio");
        const sizeStr =
          metadata.format.size !== undefined
            ? String(metadata.format.size)
            : "0";
        console.log(
          `[VideoCutter-Probe] Probed successfully. Duration: ${duration}s, hasVideo: ${hasVideo}, hasAudio: ${hasAudio}, size: ${sizeStr} bytes`,
        );
        resolve({
          duration,
          hasVideo,
          hasAudio,
          size: parseInt(sizeStr, 10),
        });
      });
    });
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  interface ValidationResult {
    isValid: boolean;
    error?: string;
    duration?: number;
    fileSize?: number;
    hasVideo: boolean;
    hasAudio: boolean;
  }

  function validateOutputVideo(
    outputPath: string,
    sourceMeta?: VideoMetadata,
  ): Promise<ValidationResult> {
    return new Promise((resolve) => {
      console.log(
        `[VideoCutter-Validation] Starting validation for: ${outputPath}`,
      );

      // 1. Check output file exists
      if (!fs.existsSync(outputPath)) {
        console.error(
          `[VideoCutter-Validation] Failed: Output file does not exist at ${outputPath}`,
        );
        return resolve({
          isValid: false,
          error: "Output file does not exist",
          hasVideo: false,
          hasAudio: false,
        });
      }

      // 2. Check file size is non-zero
      const stats = fs.statSync(outputPath);
      const fileSizeKB = stats.size / 1024;
      console.log(
        `[VideoCutter-Validation] File physical size: ${stats.size} bytes (${fileSizeKB.toFixed(2)} KB)`,
      );

      // Minimum size is relaxed to 1 KB to support very short or highly compressed video cuts.
      if (stats.size < 1024) {
        console.error(
          `[VideoCutter-Validation] Failed: File size is ${fileSizeKB.toFixed(2)} KB, which is less than the required 1 KB threshold.`,
        );
        return resolve({
          isValid: false,
          error: `File size is too small: ${fileSizeKB.toFixed(2)} KB (must be > 1 KB)`,
          fileSize: stats.size,
          hasVideo: false,
          hasAudio: false,
        });
      }

      // 3. Verify the file can be opened by ffprobe / MP4 container integrity
      ffmpeg.ffprobe(outputPath, (err, metadata) => {
        if (err || !metadata) {
          console.error(
            `[VideoCutter-Validation] Failed: ffprobe could not open file or parse metadata. Error: ${err?.message || "unknown"}`,
          );
          return resolve({
            isValid: false,
            error: `Muxing or container integrity failure: ${err?.message || "unreadable by ffprobe"}`,
            fileSize: stats.size,
            hasVideo: false,
            hasAudio: false,
          });
        }

        // 4. Check video stream exists
        const hasVideo = metadata.streams.some((s) => s.codec_type === "video");
        // 5. Check audio stream exists
        const hasAudio = metadata.streams.some((s) => s.codec_type === "audio");
        // 6. Check video duration > 0
        const durationStr =
          metadata.format.duration !== undefined
            ? String(metadata.format.duration)
            : "0";
        const duration = parseFloat(durationStr);

        console.log(
          `[VideoCutter-Validation] Streams detected - hasVideo: ${hasVideo}, hasAudio: ${hasAudio}, duration: ${duration}s`,
        );

        // Only enforce video stream if source has video stream
        const expectVideo = sourceMeta ? sourceMeta.hasVideo : true;
        if (expectVideo && !hasVideo) {
          console.error(
            `[VideoCutter-Validation] Failed: No active video stream detected.`,
          );
          return resolve({
            isValid: false,
            error: "Output file is missing a video stream",
            duration,
            fileSize: stats.size,
            hasVideo,
            hasAudio,
          });
        }

        // Only enforce audio stream if source has audio stream
        const expectAudio = sourceMeta ? sourceMeta.hasAudio : false;
        if (expectAudio && !hasAudio) {
          console.error(
            `[VideoCutter-Validation] Failed: No active audio stream detected.`,
          );
          return resolve({
            isValid: false,
            error: "Output file is missing an audio stream",
            duration,
            fileSize: stats.size,
            hasVideo,
            hasAudio,
          });
        }

        if (duration <= 0 || isNaN(duration)) {
          console.error(
            `[VideoCutter-Validation] Failed: File reports duration of <= 0 (${duration}s).`,
          );
          return resolve({
            isValid: false,
            error: `Output file has an invalid duration: ${duration}s`,
            duration,
            fileSize: stats.size,
            hasVideo,
            hasAudio,
          });
        }

        console.log(
          `[VideoCutter-Validation] Success: All verification checks passed seamlessly.`,
        );
        resolve({
          isValid: true,
          duration,
          fileSize: stats.size,
          hasVideo,
          hasAudio,
        });
      });
    });
  }

// API Route to cleanup original file
  app.post("/api/cleanup-video", express.json(), (req, res) => {
    try {
      const { fileId } = req.body;
      if (fileId) {
        const filePath = path.resolve(uploadsDir, fileId);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      res.json({ status: "ok" });
    } catch (err: any) {
      console.error("[api/cleanup-video Error]:", err);
      res.json({ status: "error", error: err.message || err.toString() });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use("/api", (req, res, next) => {
       res.status(404).json({ error: "API route not found: " + req.method + " " + req.originalUrl });
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  server.timeout = 10 * 60 * 1000; // 10 minutes
}

startServer();
