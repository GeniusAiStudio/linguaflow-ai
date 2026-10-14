
export class BackendService {
  private baseUrl: string = 'https://api.yourapp.org'; 

  async uploadFileInChunks(file: File, onProgress?: (p: number) => void): Promise<string> {
    const chunkSize = 2 * 1024 * 1024; // 2MB safe chunk
    const totalChunks = Math.ceil(file.size / chunkSize);
    const fileId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    let finalFileId = "";

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      const chunk = file.slice(start, end);

      const chunkForm = new FormData();
      chunkForm.append("chunk", chunk);

      const url = `/api/upload-video-chunk?fileId=${encodeURIComponent(fileId)}&chunkIndex=${i}&totalChunks=${totalChunks}&fileName=${encodeURIComponent(file.name)}`;
      const res = await fetch(url, { method: "POST", body: chunkForm });
      if (!res.ok) throw new Error(`Chunk ${i + 1}/${totalChunks} upload error: ${res.statusText}`);
      const data = await res.json();
      if (data.completed && data.fileId) {
        finalFileId = data.fileId;
      }
      if (onProgress) {
        onProgress(Math.round(((i + 1) / totalChunks) * 80));
      }
    }
    return finalFileId;
  }

  async uploadVideoFile(file: File, onProgress?: (p: number) => void): Promise<{ fileId: string; url: string }> {
    if (file.size > 15 * 1024 * 1024) {
      const fileId = await this.uploadFileInChunks(file, onProgress);
      return { fileId, url: `/uploads/${fileId}` };
    }

    try {
      const form = new FormData();
      form.append("video", file);
      if (onProgress) onProgress(30);

      const res = await fetch("/api/upload-video", {
        method: "POST",
        body: form,
      });
      if (onProgress) onProgress(90);

      if (!res.ok) {
        // Fallback to chunked upload
        const fileId = await this.uploadFileInChunks(file, onProgress);
        return { fileId, url: `/uploads/${fileId}` };
      }

      const data = await res.json();
      if (onProgress) onProgress(100);
      return { fileId: data.fileId, url: data.url || `/uploads/${data.fileId}` };
    } catch (e) {
      // Chunked fallback
      const fileId = await this.uploadFileInChunks(file, onProgress);
      return { fileId, url: `/uploads/${fileId}` };
    }
  }

  async uploadAudioFile(file: File | Blob): Promise<{ fileId: string; url: string }> {
    const form = new FormData();
    form.append("audio", file, "voiceover.wav");
    const res = await fetch("/api/upload-audio", {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      throw new Error(`Audio upload failed: ${res.statusText}`);
    }
    const data = await res.json();
    return { fileId: data.fileId, url: data.url || `/uploads/${data.fileId}` };
  }

  async transcribeMediaFile(file: File, onProgress?: (p: number) => void): Promise<string> {
    try {
      // If file is larger than 20MB, upload in chunks to bypass Cloud Run 32MB payload limit
      if (file.size > 20 * 1024 * 1024) {
        console.log(`[BackendService] File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds 20MB. Using chunked stream upload...`);
        const serverFileId = await this.uploadFileInChunks(file, onProgress);
        if (onProgress) onProgress(85);

        const response = await fetch("/api/gemini-transcribe-video", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId: serverFileId }),
        });
        if (onProgress) onProgress(100);
        if (!response.ok) return "";
        const data = await response.json();
        return data?.text || "";
      }

      // Small-to-medium files: direct multipart upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', 'small');

      let interval: any = null;
      if (onProgress) {
        let p = 0;
        interval = setInterval(() => {
          p += 5;
          if (p <= 90) onProgress(p);
        }, 600);
      }

      const response = await fetch("/api/gemini-transcribe-video", {
        method: 'POST',
        body: formData,
      }).catch((e) => {
        if (interval) clearInterval(interval);
        console.warn("[BackendService] Transcribe network reachability note:", e);
        return null;
      });

      if (interval) clearInterval(interval);
      if (onProgress) onProgress(100);

      if (!response || !response.ok) return "";
      const data = await response.json();
      return data?.text || "";
    } catch (err) {
      console.warn("[BackendService] Transcribe media file notice:", err);
      return "";
    }
  }

  async generateScript(topic: string): Promise<string> {
    try {
      const response = await fetch("/api/generate-script", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'default', topic }),
      }).catch(() => {
        throw new Error("NETWORK_UNAVAILABLE");
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `API_ERROR: ${response.statusText}`);
      }
      const data = await response.json();
      return data.script;
    } catch (err) {
      throw err;
    }
  }

  async generateCreativeScript(
    brief: string,
    type: string,
    tone: string,
    language: string,
  ): Promise<string> {
    try {
      const response = await fetch("/api/generate-script", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'creative',
          brief,
          type,
          tone,
          language,
        }),
      }).catch(() => {
        throw new Error("NETWORK_UNAVAILABLE");
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `API_ERROR: ${response.statusText}`);
      }
      const data = await response.json();
      return data.script;
    } catch (err) {
      throw err;
    }
  }

  async generateRecapScript(
    transcript: string,
    referenceImageBase64?: string,
    customPrompt?: string,
  ): Promise<string> {
    try {
      const response = await fetch("/api/generate-script", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'recap',
          transcript,
          referenceImageBase64,
          customPrompt,
        }),
      }).catch(() => {
        throw new Error("NETWORK_UNAVAILABLE");
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `API_ERROR: ${response.statusText}`);
      }
      const data = await response.json();
      return data.script;
    } catch (err) {
      throw err;
    }
  }

  async translateText(text: string, targetLanguage: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          target_language: targetLanguage
        }),
      }).catch(() => {
        throw new Error("NETWORK_UNAVAILABLE");
      });

      if (!response.ok) throw new Error(`TRANSLATION_ERROR: ${response.statusText}`);
      const data = await response.json();
      
      if (data.result === undefined || data.result === null) {
        throw new Error("EMPTY_RESULT");
      }
      
      return data.result;
    } catch (err) {
      throw err;
    }
  }

  async translateWithBackendProxy(
    text: string,
    from: string,
    to: string,
    tone: string,
    isSrt: boolean,
    onProgress?: (totalChunks: number, currentChunkIndex: number, status: "Pending" | "Translating" | "Success" | "Failed", errorMsg?: string) => void,
  ): Promise<string> {
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, from, to, tone, isSrt }),
      });

      if (!response.ok) {
        throw new Error(`Translation server error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to get response stream reader");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult = "";

      const processJsonLine = (rawJson: string) => {
        const trimmed = rawJson.trim();
        if (!trimmed) return;
        try {
          const payload = JSON.parse(trimmed);
          if (payload.type === "progress") {
            if (onProgress) {
              onProgress(
                payload.totalChunks,
                payload.currentChunkIndex,
                payload.status,
                payload.errorMsg
              );
            }
          } else if (payload.type === "result") {
            finalResult = payload.result ?? "";
          } else if (payload.type === "error") {
            throw new Error(payload.error || "Server reported translation failure");
          }
        } catch (e: any) {
          // Check if multiple JSON frames were concatenated without a newline (e.g. }{)
          if (trimmed.includes("}{")) {
            const splitObjects = trimmed.replace(/}\s*{/g, "}---JSON_SPLIT---{").split("---JSON_SPLIT---");
            for (const item of splitObjects) {
              processJsonLine(item);
            }
            return;
          }
          console.error("Failed to parse progress frame:", trimmed, e);
          if (trimmed.includes('"type":"error"')) {
            throw new Error(e.message || "Translation error");
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          processJsonLine(line);
        }
      }

      if (buffer.trim()) {
        processJsonLine(buffer);
      }

      return finalResult;
    } catch (err: any) {
      throw err;
    }
  }

  async smartTimeWithBackendProxy(text: string, lang: string): Promise<string> {
    try {
      const response = await fetch("/api/smart-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
      });

      if (!response.ok) {
        throw new Error(`Smart time alignment server error: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        return data.result;
      } else {
        throw new Error(data.error || "Timing alignment failed");
      }
    } catch (err: any) {
      throw err;
    }
  }

    /**
    * RECAP MASTER RENDER ENGINE (v7.8 - MULTI-LAYER CINEMATIC COMPOSITOR)
    * Guaranteed visual track output with layer-based rendering and Ken Burns animation.
    */
    async renderVideoProcess(videoFile: File | null, audioFile: File | null, config: any, onProgress?: (p: number) => void): Promise<Blob> {
      return new Promise(async (resolve, reject) => {
          const TARGET_FPS = 30;
          let audioSpeed = config.audioSpeed || 1.0;
          
           // Script & Scene Engine
           const script = config.script || "";
           const cleanSubtitleText = (s: string) => {
               return s
                 .replace(/\*\*[^*]+:\*\*/g, '') // Removes "**Narration:**" or "**Thiha:**"
                 .replace(/\*\*[^*]+\*\*/g, '')   // Removes any "**Narration**" bold markers
                 .replace(/\*/g, '')              // Removes any remaining raw asterisks
                 .trim();
           };
 
           let subtitleParts: string[] = [];
           let rawSceneDurations: number[] = [];
           let isJsonScript = false;
 
           try {
              let cleanedForJson = script.trim();
              if (cleanedForJson.startsWith('```')) {
                 cleanedForJson = cleanedForJson.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
              }
              const parsed = JSON.parse(cleanedForJson);

              const parseTimestampToSeconds = (ts: any): number => {
                if (typeof ts === 'number') return ts;
                if (!ts) return 0;
                const parts = String(ts).trim().split(':').map(Number);
                if (parts.length === 2) return parts[0] * 60 + parts[1];
                if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
                return Number(ts) || 0;
              };

              if (parsed && Array.isArray(parsed.segments) && !parsed.scenes) {
                 parsed.scenes = parsed.segments.map((s: any) => {
                    const start = parseTimestampToSeconds(s.start_time);
                    const end = parseTimestampToSeconds(s.end_time);
                    const duration = Math.max(1, end - start);
                    return {
                       subtitle_text: s.narration,
                       voiceover_text: s.narration,
                       duration_seconds: duration,
                       start_time_seconds: start,
                       end_time_seconds: end
                    };
                 });
              }
              if (parsed && Array.isArray(parsed.scenes)) {
                 subtitleParts = parsed.scenes.map((s: any) => cleanSubtitleText(s.subtitle_text || s.voiceover_text || ""));
                 rawSceneDurations = parsed.scenes.map((s: any) => Number(s.duration_seconds) || 0);
                 isJsonScript = true;
              }
           } catch (e) {
              // Fallback
           }
 
           if (!isJsonScript) {
              subtitleParts = script.split(/[\n।။.]/)
                .map((s: string) => cleanSubtitleText(s))
                .filter((s: string) => s.length > 0);
           }
  
          const video = document.createElement('video');
          const audio = document.createElement('audio');
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { alpha: false }); 
  
          if (!ctx) return reject(new Error("CANVAS_INIT_ERROR"));
          const container = document.createElement('div');
          // Style container inside viewport with full opacity but 1x1 size.
          // This keeps the browser's layout & rendering engine fully awake (100% active) and forces full video frame decoding and paint cycles,
          // while keeping any video previews completely unobtrusive and 100% invisible to the user.
          container.style.cssText = 'position:fixed;bottom:1px;right:1px;width:1px;height:1px;opacity:1;z-index:-99999;pointer-events:none;overflow:hidden;background:black;';
          video.style.cssText = 'width:100%;height:100%;object-fit:contain;';
          container.appendChild(video);
          container.appendChild(audio);
          container.appendChild(canvas);
          document.body.appendChild(container);
   
          // Load Scene Images if provided
          const sceneImages: HTMLImageElement[] = [];
          if (config.sceneImages && Array.isArray(config.sceneImages)) {
            const loadPromises = config.sceneImages.map(async (imgData: any) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              const loaded = new Promise((resolve) => {
                img.onload = () => {
                  (img as any)._loaded = true;
                  resolve(true);
                };
                img.onerror = () => resolve(false);
                setTimeout(() => resolve(false), 10000); // 10s timeout per image
              });

              if (typeof imgData === 'string') {
                img.src = imgData;
              } else if (imgData instanceof Blob || imgData instanceof File) {
                img.src = URL.createObjectURL(imgData);
              }
              sceneImages.push(img);
              return loaded;
            });
            await Promise.all(loadPromises);
          }
   
          let videoUrl = "";
          if (videoFile) {
            video.muted = true;
            video.playsInline = true;
            video.setAttribute('muted', 'true');
            video.setAttribute('playsinline', 'true');
            video.crossOrigin = "anonymous";
            videoUrl = URL.createObjectURL(videoFile);
            video.src = videoUrl;
            
            // Wait for video metadata and dimensions to load fully
            await new Promise((r) => {
                const check = () => {
                    if (video.readyState >= 1 && video.videoWidth > 0) {
                        r(null);
                    } else {
                        setTimeout(check, 100);
                    }
                };
                video.onloadedmetadata = check;
                if (video.readyState >= 1 && video.videoWidth > 0) {
                    r(null);
                } else {
                    check();
                }
                setTimeout(r, 6000); // Fail-safe
            });
          }
  
          const logoImg = new Image();
          let logoLoaded = false;
          if (config.logoFile) {
              logoImg.src = URL.createObjectURL(config.logoFile);
              logoImg.onload = () => { logoLoaded = true; };
          }
  
          if (audioFile) {
              audio.src = URL.createObjectURL(audioFile);
              audio.crossOrigin = "anonymous";
              audio.playbackRate = audioSpeed;
              audio.muted = false; // MUST be false so Web Audio API can record its sound output. Bypassing speaker output through createMediaElementSource.
              // @ts-ignore
              audio.preservesPitch = true;

              // Robust Metadata Loading
              await new Promise((r) => {
                  audio.onloadedmetadata = r;
                  if (audio.readyState >= 1) r(null);
                  setTimeout(r, 5000); // Fail-safe
              });
          }
  
          let worker: Worker | null = null;
          const cleanup = () => {
              if (videoUrl) URL.revokeObjectURL(videoUrl);
              if (audio.src) URL.revokeObjectURL(audio.src);
              sceneImages.forEach(img => { if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src); });
              if (document.body.contains(container)) document.body.removeChild(container);
              if (worker) {
                 try {
                     worker.postMessage('stop');
                     worker.terminate();
                 } catch (e) {}
                 worker = null;
              }
          };
  
          if (videoFile) {
            const timeoutSeconds = 6; 
            await new Promise((r) => {
                const checkStatus = () => {
                    if (video.readyState >= 2 && video.videoWidth > 0) {
                        r(null);
                    } else {
                        setTimeout(checkStatus, 100);
                    }
                };
                video.onloadeddata = checkStatus;
                video.onerror = () => {
                    console.warn("[RenderEngine] Video element reported load error, proceeding anyway.");
                    r(null);
                };
                if (video.readyState >= 2 && video.videoWidth > 0) {
                    r(null);
                } else {
                    checkStatus();
                }
                setTimeout(() => {
                    console.warn("[RenderEngine] Video data load timed out. Continuing to load dynamically.");
                    r(null);
                }, timeoutSeconds * 1000);
            });
          }
          
          const duration = video.duration || 0;
          const originalAudioDuration = (audio.duration && !isNaN(audio.duration)) ? audio.duration : 60; 
          const effectiveTrimEnd = Math.min(config.trimEnd || duration, duration || 9999);
          const totalVideoDuration = duration > 0 ? (effectiveTrimEnd - config.trimStart) : originalAudioDuration;

          audioSpeed = config.audioSpeed || 1.0;
          audio.playbackRate = audioSpeed;

          // Compute duration based on real audio playback rate
          const audioDuration = originalAudioDuration / audioSpeed;
  
          // ULTRA SYNC: Scene-based timing distribution
          let sceneTimings: number[] = [];
          if (isJsonScript) {
             const totalSceneDurations = rawSceneDurations.reduce((acc: number, d: number) => acc + d, 0) || 1;
             sceneTimings = rawSceneDurations.map((d: number) => {
                 return (d / totalSceneDurations) * audioDuration;
             });
          } else {
             const totalChars = subtitleParts.reduce((acc: number, s: string) => acc + s.length, 0);
             sceneTimings = subtitleParts.map((text: string) => {
                 const ratio = text.length / (totalChars || 1);
                 return audioDuration * ratio;
             });
          }
  
          // Aspect Ratio Logic
          const targetRatioStr = config.aspectRatio || "9:16";
          const [ratioW, ratioH] = targetRatioStr.split(':').map(Number);
          const targetRatio = ratioW / ratioH;          let baseWidth = 720; 
          if (videoFile && video.videoWidth > 0) {
            baseWidth = Math.min(video.videoWidth, 1280);
          }
          canvas.width = baseWidth;
          canvas.height = Math.floor(baseWidth / targetRatio);
  
          let recorder: MediaRecorder | null = null;
          let animationFrameId: any;
          let isFinished = false;
          let lastTime = performance.now();
          const FRAME_TIME = 1000 / TARGET_FPS;
          
          // Visual Enforcement Counters
          let framesCaptured = 0;
          let visualsVerified = false;

          const startProcessing = async () => {
              try {
                  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                  if (audioCtx.state === 'suspended') await audioCtx.resume();
                  const dest = audioCtx.createMediaStreamDestination();
                  
                  if (audioFile) {
                      const audioSource = audioCtx.createMediaElementSource(audio);
                      audioSource.connect(dest);
                  }
  
                  // IMPORTANT: Draw the first frame BEFORE capturing the stream
                  // This "wakes up" the video track with actual data
                  ctx.fillStyle = "#000000";
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  if (videoFile && video.videoWidth > 0) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  }

                  const canvasStream = canvas.captureStream(TARGET_FPS);
                  const audioTracks = dest.stream.getAudioTracks();
                  
                  // Ensure Video Track is properly added
                  const videoTracks = canvasStream.getVideoTracks();
                  if (videoTracks.length === 0) {
                      throw new Error("VIDEO_TRACK_MISSING: Canvas failed to provide video track.");
                  }
                  
                  videoTracks.forEach(track => {
                      track.enabled = true;
                  });

                  // Directly attach the audio tracks from the Web Audio destination node to the canvas capture stream
                  audioTracks.forEach(track => {
                      canvasStream.addTrack(track);
                  });
  
                  let mimeType = 'video/webm;codecs=vp9,opus';
                  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8,opus';
                  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
  
                  recorder = new MediaRecorder(canvasStream, {
                      mimeType,
                      videoBitsPerSecond: 12000000, 
                      audioBitsPerSecond: 128000
                  });
  
                  const chunks: Blob[] = [];
                  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
                  recorder.onstop = async () => {
                      isFinished = true;
                      canvasStream.getTracks().forEach(track => track.stop());
                      cleanup();
                      // Final Visual Validation
                      if (framesCaptured < 5) {
                        return reject(new Error("RENDER_VALIDATION_FAILED: Video track produced no frames. Check if the tab was focused."));
                      }
                      
                      if (chunks.length === 0) {
                        return reject(new Error("RENDER_FAILED: No data captured by MediaRecorder. Are you in a background tab?"));
                      }
                      
                      const recordedBlob = new Blob(chunks, { type: mimeType });
                      if (recordedBlob.size < 1000) {
                        return reject(new Error("RENDER_VALIDATION_FAILED: Captured video is too small. Rendering interrupted."));
                      }
                      
                      // NEW: SERVER-SIDE FINALIZATION (MP4 libx264/yuv420p Enforcement with audio merge)
                      try {
                        const formData = new FormData();
                        formData.append('video', recordedBlob, 'raw_recap.webm');
                        if (audioFile) {
                          formData.append('audio', audioFile, 'voiceover.wav');
                        }
                        if (config.script) {
                          formData.append('script', config.script);
                        }
                        if (config.voice) {
                          formData.append('voice', config.voice);
                        }
                        if (config.aspectRatio) {
                          formData.append('aspectRatio', config.aspectRatio);
                        }
                        
                        const finalizeResponse = await fetch('/api/finalize-recap', {
                          method: 'POST',
                          body: formData
                        });
                        
                        if (!finalizeResponse.ok) {
                           console.warn("Server finalization failed, falling back to raw browser output.");
                           resolve(recordedBlob);
                           return;
                        }
                        
                        const finalizedBlob = await finalizeResponse.blob();
                        resolve(finalizedBlob);
                      } catch (err) {
                        console.error("Finalization error:", err);
                        resolve(recordedBlob); // Fallback to raw if server fails
                      }
                  };                  if (videoFile) {
                    video.currentTime = config.trimStart;
                    await new Promise(r => {
                        const check = () => {
                            if (video.readyState >= 3 && !video.seeking) {
                                r(null);
                            } else {
                                setTimeout(check, 100);
                            }
                        };
                        video.onseeked = () => {
                            if (video.readyState >= 3) r(null);
                        };
                        check();
                        setTimeout(r, 2000); // 2 seconds absolute failsafe
                    });
                  }
                  
                  // Second draw just to be absolutely sure the stream is flowing
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  if (videoFile) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
   
                  audio.currentTime = 0;
                  
                  // Small delay before recording to let tracks settle
                  await new Promise(r => setTimeout(r, 200));
 
                  const startTime = performance.now();
                  recorder.start(100); 
                  
                  await Promise.all([
                      videoFile ? video.play().catch(() => {}) : Promise.resolve(),
                      audioFile ? audio.play().catch(() => {}) : Promise.resolve()
                  ]);
                  let lastVideoTime = video.currentTime;
                  let lastTimeUpdate = performance.now();
                  let lastKnownAudioTime = 0;
                  let lastAudioAdvanceTime = performance.now();
                  console.info(`[RenderEngine] Started. Audio Duration: ${audioDuration}s`);
  
                  const renderFrame = (timestamp: number) => {
                      if (isFinished) return;
                      
                      const now = performance.now();
  
                      if (timestamp - lastTime < FRAME_TIME) {
                           return;
                      }
                      lastTime = timestamp;
                      lastTimeUpdate = now; // Heartbeat update
  
                      // Core Clock: Identify Stalled Audio Element and Fall Back to Virtual Timeline
                      let activeTime = audio.currentTime;
                      if (audio.currentTime !== lastKnownAudioTime) {
                          lastKnownAudioTime = audio.currentTime;
                          lastAudioAdvanceTime = now;
                      }
                      const elapsedSeconds = ((now - startTime) / 1000) * audioSpeed;
                      const audioStalled = (now - lastAudioAdvanceTime) > 1200;
                      
                      if (audioStalled || audio.paused) {
                          activeTime = Math.min(audioDuration, elapsedSeconds);
                      }
  
                      if (onProgress && audioDuration > 0) {
                          onProgress(Math.min(99.9, (activeTime / audioDuration) * 100)); 
                      }
  
                      const minDurationReached = (performance.now() - startTime) > 1000;
                      if ((activeTime >= audioDuration && minDurationReached) || (audio.ended && minDurationReached) || performance.now() - lastTimeUpdate > 90000) {
                          if (recorder && recorder.state === 'recording') {
                              console.info(`[RenderEngine] Finishing. Time: ${activeTime}s, Frames: ${framesCaptured}`);
                              isFinished = true;
                              recorder.stop();
                          }
                          return;
                      }
  
                        // ULTRA SYNC: High-Precision Dynamic Playback Drift Correction & Timeline Mapping
                        if (videoFile) {
                          const vEffectiveDuration = totalVideoDuration || 1;
                          
                          // No-loop fallback: clamp to end of video duration instead of wrapping via modulo
                          const progressTime = Math.min(activeTime, vEffectiveDuration);
                          const targetPos = config.trimStart + progressTime;
                          
                          // Keep video playing if paused (e.g., due to background, but tab is active)
                          if (video.paused && activeTime < audioDuration) {
                            video.play().catch(() => {});
                          }
                          
                          // Base configured audio speed
                          const baseSpeed = audioSpeed;
                          
                          // Calculate sync deviation
                          const drift = video.currentTime - targetPos;
                          const gracePeriodPassed = activeTime > 1.5;
                          
                          if (Math.abs(drift) > 0.3 && gracePeriodPassed) {
                            // High precision sync: Immediate seek when drift exceeds 300ms
                            if (!video.seeking) {
                              video.currentTime = targetPos;
                            }
                          } else if (Math.abs(drift) > 0.03) {
                            // Proportional, fine-tuned playback rate adjustments for minor drift
                            try {
                              const scalingFactor = Math.min(0.5, Math.abs(drift) / 0.3);
                              if (drift > 0) {
                                // Video is leading, decelerate proportionally
                                video.playbackRate = Math.max(0.3, (1.0 - scalingFactor) * baseSpeed);
                              } else {
                                // Video is lagging, accelerate proportionally
                                video.playbackRate = Math.min(2.5, (1.0 + scalingFactor) * baseSpeed);
                              }
                            } catch (e) {}
                          } else {
                            // Fully in sync: Maintain configured Master base speed
                            try {
                              if (video.playbackRate !== baseSpeed) {
                                video.playbackRate = baseSpeed;
                              }
                            } catch (e) {}
                          }
                        }
  
                      try {
                          ctx.fillStyle = "#000000";
                          ctx.fillRect(0, 0, canvas.width, canvas.height);
                          ctx.save();
  
                          let sceneIdx = 0;
                          let accTime = 0;
                          for (let i = 0; i < sceneTimings.length; i++) {
                              if (activeTime >= accTime && activeTime < accTime + sceneTimings[i]) {
                                  sceneIdx = i;
                                  break;
                              }
                              accTime += sceneTimings[i];
                          }
                          
                          let sceneProgress = 0;
                          if (sceneTimings[sceneIdx] > 0) {
                              sceneProgress = Math.min(1.0, Math.max(0.0, (activeTime - accTime) / sceneTimings[sceneIdx]));
                          }
                          const currentText = subtitleParts[sceneIdx] || "";
                          const drawScale = 1.0 + (sceneProgress * 0.15); 
  
                          let visualSource: any = null;
                          if (videoFile) {
                              visualSource = video;
                          } else if (sceneImages.length > 0) {
                              const imgIdx = Math.min(sceneIdx, sceneImages.length - 1);
                              if (sceneImages[imgIdx] && ((sceneImages[imgIdx] as any)._loaded || sceneImages[imgIdx].complete)) {
                                 visualSource = sceneImages[imgIdx];
                              }
                          }
  
                          if (visualSource) {
                              const sW_orig = Math.max(1, visualSource.videoWidth || visualSource.naturalWidth || visualSource.width || canvas.width);
                              const sH_orig = Math.max(1, visualSource.videoHeight || visualSource.naturalHeight || visualSource.height || canvas.height);
                              const sRatio = sW_orig / sH_orig;
                              let sW, sH, sX, sY;
                              if (sRatio > targetRatio) {
                                  sH = sH_orig;
                                  sW = sH * targetRatio;
                                  sX = (sW_orig - sW) / 2;
                                  sY = 0;
                              } else {
                                  sW = sW_orig;
                                  sH = sW / targetRatio;
                                  sX = 0;
                                  sY = (sH_orig - sH) / 2;
                              }
                              
                              const zW = sW / drawScale;
                              const zH = sH / drawScale;
                              sX += (sW - zW) / 2;
                              sY += (sH - zH) / 2;
                              
                              ctx.drawImage(visualSource, sX, sY, zW, zH, 0, 0, canvas.width, canvas.height);
                              (canvas as any)._lastSourceParams = { sX, sY, zW, zH };
                          } else {
                              const hue = (sceneIdx * 45 + timestamp / 50) % 360;
                              const g = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, canvas.width);
                              g.addColorStop(0, `hsla(${hue}, 60%, 15%, 1)`);
                              g.addColorStop(1, `#000000`);
                              ctx.fillStyle = g;
                              ctx.fillRect(0, 0, canvas.width, canvas.height);
                          }

                          // DYNAMIC CANVAS BLUR EFFECT OVERLAY
                          if (config.blurEnabled) {
                              ctx.save();
                              
                              const bY = canvas.height * ((config.blurY !== undefined ? config.blurY : 80) / 100);
                              const bH = canvas.height * ((config.blurHeight !== undefined ? config.blurHeight : 15) / 100);
                              
                              let bX = 0;
                              let bW = canvas.width;
                              if (config.blurMode === 'CUSTOM') {
                                 bX = canvas.width * ((config.blurX !== undefined ? config.blurX : 0) / 100);
                                 bW = canvas.width * ((config.blurWidth !== undefined ? config.blurWidth : 100) / 100);
                              }
                              
                              // Clip to blur region
                              ctx.beginPath();
                              ctx.rect(bX, bY, bW, bH);
                              ctx.clip();
                              
                              // Set blur filter intensity
                              const strength = config.blurStrength !== undefined ? config.blurStrength : 20;
                              ctx.filter = `blur(${strength}px)`;
                              
                              // Redraw content inside clipped blur region
                              if (visualSource) {
                                  const params = (canvas as any)._lastSourceParams || { sX: 0, sY: 0, zW: canvas.width, zH: canvas.height };
                                  ctx.drawImage(visualSource, params.sX, params.sY, params.zW, params.zH, 0, 0, canvas.width, canvas.height);
                              } else {
                                  // Draw background gradient
                                  const hue = (sceneIdx * 45 + timestamp / 50) % 360;
                                  const gBlur = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, canvas.width);
                                  gBlur.addColorStop(0, `hsla(${hue}, 60%, 15%, 1)`);
                                  gBlur.addColorStop(1, `#000000`);
                                  ctx.fillStyle = gBlur;
                                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                              }
                              
                              // Draw translucent overlay for subtitles readability
                              ctx.filter = 'none';
                              ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
                              ctx.fillRect(bX, bY, bW, bH);
                              
                              ctx.restore();
                          }

                          ctx.restore();
  
                          // SUBTITLES
                          if (currentText) {
                              ctx.save();
                              const sizeMultiplier = (config.subtitleSize || 35) / 100;
                              const yPosMultiplier = (config.subtitleY || 85) / 100;
                              const isMinimal = config.subtitleStyle === 'MINIMAL';
                              const subtitleColor = config.subtitleColor || '#FFFFFF';
                              const highlightColor = config.subtitleHighlightColor || '#FFD700';
                              const outlineColor = config.subtitleOutlineColor || '#000000';
                              const subtitleMode = config.subtitleMode || 'ALL_LINES';
                              const fontSize = Math.floor(canvas.height * 0.08 * sizeMultiplier);
                              
                              ctx.font = `${isMinimal ? '500' : '900'} italic ${fontSize}px "Inter", sans-serif`;
                              ctx.textAlign = "center";
                              ctx.textBaseline = "bottom";
                              
                              const words = currentText.split(' ');
                              let line = '';
                              let lines = [];
                              const maxWidth = canvas.width * 0.88;
  
                              for(let n = 0; n < words.length; n++) {
                                const testLine = line + words[n] + ' ';
                                if (ctx.measureText(testLine).width > maxWidth && n > 0) {
                                  lines.push(line.trim());
                                  line = words[n] + ' ';
                                } else {
                                  line = testLine;
                                }
                              }
                              lines.push(line.trim());
  
                              // Determine progress inside current scene segment to map to the correct wrapped line index
                              const activeLineIndex = Math.min(lines.length - 1, Math.floor(sceneProgress * lines.length));

                              // Set Stroke Styles
                              if (!isMinimal) {
                                  ctx.shadowColor = "rgba(0,0,0,0.85)";
                                  ctx.shadowBlur = fontSize * 0.3;
                                  ctx.lineWidth = fontSize * 0.15;
                                  ctx.strokeStyle = outlineColor;
                              }

                              let displayedRows: { text: string; isActive: boolean }[] = [];
                              if (subtitleMode === 'LINE_BY_LINE') {
                                 displayedRows = [{ text: lines[activeLineIndex], isActive: true }];
                              } else if (subtitleMode === 'HIGHLIGHT_LINE') {
                                 displayedRows = lines.map((text, idx) => ({ text, isActive: idx === activeLineIndex }));
                              } else {
                                 displayedRows = lines.map(text => ({ text, isActive: false }));
                              }

                              let currentY = (canvas.height * yPosMultiplier) - (displayedRows.length - 1) * fontSize * 1.25;
                              displayedRows.forEach((row) => {
                                 if (!isMinimal) ctx.strokeText(row.text, canvas.width / 2, currentY);
                                 ctx.fillStyle = row.isActive ? highlightColor : subtitleColor;
                                 ctx.fillText(row.text, canvas.width / 2, currentY);
                                 currentY += fontSize * 1.25;
                              });
                              ctx.restore();
                          }
  
                          // Logo
                          if (logoLoaded) {
                              const s = canvas.width * ((config.logoSize !== undefined ? config.logoSize : 12) / 100);
                              const x = config.logoX !== undefined 
                                  ? (canvas.width * (config.logoX / 100)) 
                                  : (canvas.width - s - canvas.width * 0.05);
                              const y = config.logoY !== undefined 
                                  ? (canvas.height * (config.logoY / 100)) 
                                  : (canvas.width * 0.05);
                              ctx.globalAlpha = 0.9;
                              ctx.drawImage(logoImg, x, y, s, s);
                              ctx.globalAlpha = 1.0;
                          }
  
                          framesCaptured++;
                      } catch (e) {
                          console.warn("Render frame error:", e);
                      }
                  };
  
                  const rafLoop = () => {
                      if (isFinished) return;
                      renderFrame(performance.now());
                      animationFrameId = requestAnimationFrame(rafLoop);
                  };
  
                  try {
                      const workerCode = `
                          let timer = null;
                          self.onmessage = function(e) {
                              if (e.data === 'start') {
                                  if (timer) clearInterval(timer);
                                  timer = setInterval(() => {
                                      self.postMessage('tick');
                                  }, 33);
                              } else if (e.data === 'stop') {
                                  if (timer) clearInterval(timer);
                                  timer = null;
                              }
                          };
                      `;
                      const blob = new Blob([workerCode], { type: 'application/javascript' });
                      const workerUrl = URL.createObjectURL(blob);
                      worker = new Worker(workerUrl);
                      worker.onmessage = () => {
                          if (isFinished) return;
                          // If RAF stalls (e.g. in background), this worker tick keeps the timeline moving
                          if (performance.now() - lastTimeUpdate > 25) {
                              renderFrame(performance.now());
                          }
                      };
                      worker.postMessage('start');
                  } catch (workerErr) {
                      console.warn("Failed to initialize background Web Worker timer, falling back to interval:", workerErr);
                      const backupInterval = setInterval(() => {
                          if (isFinished) {
                              clearInterval(backupInterval);
                              return;
                          }
                          if (performance.now() - lastTimeUpdate > 100) {
                              renderFrame(performance.now());
                          }
                      }, 33);
                  }
  
                  animationFrameId = requestAnimationFrame(rafLoop);
  
              } catch (err) {
                  cleanup();
                  reject(err);
              }
          };
  
          if (videoFile) {
            // If the video has already loaded to oncanplay or above, start immediately
            if (video.readyState >= 2) {
              console.info("[RenderEngine] Video is already ready. Direct start.");
              startProcessing();
            } else {
              console.info("[RenderEngine] Listening for video state...");
              video.oncanplay = () => { if (!recorder) startProcessing(); };
              video.onloadeddata = () => { if (!recorder) startProcessing(); };
              video.oncanplaythrough = () => { if (!recorder) startProcessing(); };
              
              // Absolute safety fallback
              setTimeout(() => {
                if (!recorder) {
                  console.warn("[RenderEngine] Backup start trigger activated.");
                  startProcessing();
                }
              }, 3000);
            }
          } else {
            // No video mode - start immediately
            startProcessing();
          }
      });
    }

  /**
   * Re-encodes output video with maximum H.264 / AAC and +faststart compatibility 
   * for quick upload on Facebook Reels, TikTok, and YouTube Shorts.
   */
  async reencodeForFacebook(videoFile: File | Blob): Promise<Blob> {
    console.log("[Client backendService] Initiating high-compatibility Facebook/TikTok re-encode process on server...");
    const formData = new FormData();
    formData.append('video', videoFile, 'input_reencode.mp4');
    
    const response = await fetch('/api/finalize-recap', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Failed to re-encode video. Server returned: ${response.statusText}`);
    }

    return await response.blob();
  }

  /**
   * Syncs video scenes accurately with audio narration logs using server-side frame-extending and trimming.
   */
  async syncAudioVideo(
    scenes: Array<{ id: number; videoPath: string; audioPath: string; narrationText: string }>,
    outputDir?: string,
    subtitlePath?: string
  ): Promise<any> {
    console.log("[Client backendService] Initiating advanced multi-scene audio-video synchronization...");
    const response = await fetch('/api/autorecap/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        scenes,
        outputDir,
        subtitlePath
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Sync pipeline failed with status: ${response.statusText}`);
    }

    return await response.json();
  }

  setBaseUrl(url: string) {
    this.baseUrl = url;
  }
}

export const backendService = new BackendService();
