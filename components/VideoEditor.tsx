
import React, { useState, useRef, useEffect } from 'react';
import { backendService } from '../services/backendService';
import { db, auth } from '../services/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';

interface VideoEditorProps {
  onBack: () => void;
}

const VideoEditor: React.FC<VideoEditorProps> = ({ onBack }) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(1.0);
  
  const [blurEnabled, setBlurEnabled] = useState(false);
  const [blurAmount, setBlurAmount] = useState(12);
  const [blurPosition, setBlurPosition] = useState(80);
  
  const [freezeEnabled, setFreezeEnabled] = useState(false);
  const [muteOriginal, setMuteOriginal] = useState(true);

  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);
  const [zoomEnabled, setZoomEnabled] = useState(false);
  
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  const [isRendering, setIsRendering] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [renderedBlob, setRenderedBlob] = useState<string | null>(null);
  
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const videoPlayerRef = useRef<HTMLVideoElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const syncLoopRef = useRef<number>(0);

  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isRendering]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      if (syncLoopRef.current) cancelAnimationFrame(syncLoopRef.current);
    };
  }, [videoUrl, audioUrl, logoPreview]);

  useEffect(() => {
    const video = videoPlayerRef.current;
    const audio = audioPlayerRef.current;
    if (!video || !audio) return;

    video.playbackRate = speed;
    audio.playbackRate = speed; 
    // @ts-ignore
    audio.preservesPitch = true;

    const syncCheck = () => {
        if (video.paused || video.ended) return;
        if (video.currentTime >= trimEnd) {
            video.pause();
            audio.pause();
            video.currentTime = trimStart;
            audio.currentTime = 0;
            return;
        }
        const videoProgress = Math.max(0, video.currentTime - trimStart);
        // Since both have same playbackRate, expected time is 1:1 with source progress
        const expectedAudioTime = videoProgress;
        if (expectedAudioTime < audio.duration && Math.abs(audio.currentTime - expectedAudioTime) > 0.3) {
            audio.currentTime = expectedAudioTime;
        }
        syncLoopRef.current = requestAnimationFrame(syncCheck);
    };

    const handlePlay = () => {
        if (video.currentTime < trimStart || video.currentTime >= trimEnd) {
            video.currentTime = trimStart;
            audio.currentTime = 0;
        }
        audio.play().catch(() => {});
        syncLoopRef.current = requestAnimationFrame(syncCheck);
    };

    const handlePause = () => {
        audio.pause();
        cancelAnimationFrame(syncLoopRef.current);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [videoUrl, audioUrl, speed, trimStart, trimEnd]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return "00:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setRenderedBlob(null);
      const vid = document.createElement('video');
      vid.onloadedmetadata = () => {
        if (vid.duration && isFinite(vid.duration)) {
          setVideoDuration(vid.duration);
          setTrimStart(0);
          setTrimEnd(vid.duration);
        }
      };
      vid.src = url;
    }
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioFile(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      const aud = document.createElement('audio');
      aud.onloadedmetadata = () => { if (aud.duration) setAudioDuration(aud.duration); };
      aud.src = url;
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleAutoMatchSpeed = () => {
    const effectiveVideoDuration = trimEnd - trimStart;
    if (effectiveVideoDuration > 0 && audioDuration > 0) {
      let targetAudioDuration = audioDuration;
      
      // Account for freeze frames if enabled
      if (freezeEnabled) {
        const FREEZE_INTERVAL = 5.0;
        const FREEZE_DURATION = 1.2;
        const numFreezes = Math.floor(effectiveVideoDuration / FREEZE_INTERVAL);
        targetAudioDuration = Math.max(0.1, audioDuration - (numFreezes * FREEZE_DURATION));
      }
      
      setSpeed(parseFloat((effectiveVideoDuration / targetAudioDuration).toFixed(2)));
    }
  };

  const handleRender = async () => {
    if (!videoFile || !audioFile) {
        alert("ဗီဒီယိုနှင့် အသံဖိုင် နှစ်ခုလုံး လိုအပ်ပါသည်။");
        return;
    }
    setIsRendering(true);
    setIsProcessing(true);
    setRenderProgress(0);
    setLogs([`[${new Date().toLocaleTimeString("en-US", { hour12: false })}] Initiating video and audio package upload...`]);
    try {
      setProcessingStep('ဗီဒီယိုနှင့် အသံဖိုင်များကို server သို့ တင်ပို့နေပါသည်...');
      
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('audio', audioFile);
      formData.append('aspectRatio', "9:16");
      formData.append('trimStart', trimStart.toString());
      formData.append('trimEnd', trimEnd.toString());
      formData.append('speed', speed.toString());
      formData.append('blurEnabled', blurEnabled.toString());
      formData.append('blurPosition', blurPosition.toString());
      formData.append('freezeEnabled', freezeEnabled.toString());
      formData.append('zoomEnabled', zoomEnabled.toString());
      formData.append('muteOriginal', muteOriginal.toString());

      if (auth.currentUser) {
        try {
          await addDoc(collection(db, 'uploaded_files'), {
            userId: auth.currentUser.uid,
            userEmail: auth.currentUser.email,
            fileName: videoFile.name,
            type: 'video_edit',
            timestamp: serverTimestamp()
          });
          const userRef = doc(db, 'users', auth.currentUser.uid);
          await updateDoc(userRef, {
            uploadedFilesCount: increment(1)
          });
        } catch (e) {
          console.error("Failed to track file upload", e);
        }
      }
      
      const response = await fetch('/api/video-editor-render', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          const textErr = await response.text();
          console.error("HTML Error Response:", textErr);
          throw new Error(`Server Error ${response.status}: Received HTML instead of JSON. The file might be too large or the server crashed.`);
        }
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server error status: ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        throw new Error(`Server Error 200: Received HTML instead of JSON. Server proxy might have intercepted the request.`);
      }

      const { taskId } = await response.json();
      setProcessingStep('ဗီဒီယိုပေါင်းစပ်ခြင်း...');
      const downloadUrl = await new Promise<string>((resolve, reject) => {
        let failureCount = 0;
        const maxFailures = 8;
        let currentDelay = 5000;
        let timeoutId: any = null;

        async function poll() {
          try {
            const statusRes = await fetch(`/api/finalize-recap/status?taskId=${taskId}`);
            
            if (statusRes.status === 429) {
              currentDelay = Math.min(currentDelay * 2, 30000); // Exponential backoff up to 30s
              setLogs(prev => [...prev, `[${new Date().toLocaleTimeString("en-US", { hour12: false })}] [Rate Limit] Polling rate limit encountered (429). Retrying in ${(currentDelay / 1000).toFixed(0)}s...`]);
              timeoutId = setTimeout(poll, currentDelay);
              return;
            }

            if (!statusRes.ok) {
              failureCount++;
              setLogs(prev => [...prev, `[${new Date().toLocaleTimeString("en-US", { hour12: false })}] Network status warning (${failureCount}/${maxFailures}): Server returned ${statusRes.status}`]);
              if (failureCount >= maxFailures) {
                reject(new Error(`Failed to query task status: ${statusRes.statusText || statusRes.status}`));
                return;
              }
              timeoutId = setTimeout(poll, 5000);
              return;
            }
            
            // Reset consecutive failures and delay on any successful query
            failureCount = 0;
            currentDelay = 5000;
            const statusData = await statusRes.json();
            
            if (statusData.logs) {
              setLogs(statusData.logs);
            }
            if (statusData.progress !== undefined) {
              setRenderProgress(statusData.progress);
            }
            
            if (statusData.status === "completed") {
              setRenderProgress(100);
              setProcessingStep('အောင်မြင်စွာ ပေါင်းစပ်ပြီးပါပြီ။');
              if (statusData.downloadUrl) {
                resolve(statusData.downloadUrl);
              } else {
                reject(new Error("Failed to receive valid download URL from server."));
              }
            } else if (statusData.status === "failed") {
              reject(new Error(statusData.error || "Rendering pipeline failed."));
            } else {
              setProcessingStep(`ပေါင်းစပ်မှုတိုးတက်မှု: ${statusData.progress}%`);
              timeoutId = setTimeout(poll, 5000);
            }
          } catch (pollErr: any) {
            failureCount++;
            setLogs(prev => [...prev, `[${new Date().toLocaleTimeString("en-US", { hour12: false })}] Network warning (${failureCount}/${maxFailures}): ${pollErr.message || "Could not reach server"}`]);
            if (failureCount >= maxFailures) {
              reject(pollErr);
              return;
            }
            timeoutId = setTimeout(poll, 5000);
          }
        }

        // Start the poll
        timeoutId = setTimeout(poll, currentDelay);
      });

      setRenderedBlob(downloadUrl);
      setProcessingStep('အောင်မြင်စွာ ပေါင်းစပ်ပြီးပါပြီ။');
      
      // Auto-trigger direct file download stream
      downloadFileSecurely(downloadUrl);
    } catch (e: any) {
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString("en-US", { hour12: false })}] Workflow pipeline exception: ${e.message}`]);
      alert(`Render Error: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadFileSecurely = async (url: string) => {
    try {
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString("en-US", { hour12: false })}] Requesting secure download stream...`]);
      const res = await fetch(url);
      if (!res.ok) {
        let errStr = "Download failed";
        try {
            const errObj = await res.json();
            errStr = errObj.error || errStr;
        } catch(e) {}
        throw new Error(`Server returned ${res.status}: ${errStr}`);
      }
      
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("video/mp4") && !contentType.includes("video/")) {
         throw new Error(`Invalid content type from server: ${contentType}`);
      }

      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `RECAP_MASTER_SMOOTH_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 10000);
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString("en-US", { hour12: false })}] File successfully downloaded.`]);
    } catch (e: any) {
      console.error("Secure download failed:", e);
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString("en-US", { hour12: false })}] Secure download error: ${e.message}`]);
      alert(`Download Error: ${e.message}`);
    }
  };

  const handleDownload = () => {
    if (!renderedBlob) return;
    downloadFileSecurely(renderedBlob);
  };

  const ToggleSwitch = ({ checked, onChange, color = 'bg-blue-600' }: { checked: boolean, onChange: (v: boolean) => void, color?: string }) => (
    <div onClick={() => onChange(!checked)} className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${checked ? color : 'bg-slate-700'}`}>
      <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${checked ? 'translate-x-6' : ''}`} />
    </div>
  );

  return (
    <div className="flex-1 flex flex-col gap-6 animate-flutter-fade h-full overflow-hidden safe-area max-w-5xl mx-auto w-full">
      {/* AppBar */}
      <div className="flex items-center gap-6 px-4 flex-shrink-0">
        <button onClick={onBack} className="p-4 rounded-2xl bg-[#111111] border border-[#222222] text-white hover:bg-blue-600 transition-all active:scale-90 shadow-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1 text-center pr-12">
          <h2 className="text-xl font-black tracking-tighter uppercase italic">Professional Video Editor</h2>
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em]">Anti-Stutter Smooth Render Core</p>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-[2.5rem] p-6 md:p-10 overflow-y-auto custom-scrollbar bg-[#050505] border-[#111111] shadow-2xl space-y-10 relative">
        {isRendering && (
          <div className="absolute inset-0 z-50 bg-[#050505]/95 backdrop-blur-2xl rounded-[2.5rem] flex flex-col p-6 animate-in fade-in duration-300">
            {/* Terminal Title Bar */}
            <div className="flex items-center justify-between bg-[#0c0c0c] border border-[#1a1a1a] px-5 py-4 rounded-t-3xl flex-shrink-0 select-none">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                <span className="text-[11px] font-mono font-black text-slate-400 ml-3 uppercase tracking-widest">workflow_engine_logs ~ cli</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider">Status:</span>
                <span className={`text-[10px] font-mono font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md border ${
                  isProcessing 
                    ? "bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]/20 animate-pulse" 
                    : logs.some(l => l.includes("Workflow Engine CRITICAL EXCEPTION"))
                      ? "bg-red-500/10 text-red-500 border-red-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                }`}>
                  {isProcessing ? "ONLINE" : logs.some(l => l.includes("Workflow Engine CRITICAL EXCEPTION")) ? "HALTED" : "FINISHED"}
                </span>
              </div>
            </div>

            {/* Terminal Screen Body */}
            <div className="flex-1 bg-[#000000] border-x border-b border-[#1a1a1a] p-6 font-mono text-xs text-[#39FF14] overflow-y-auto rounded-b-none flex flex-col gap-1.5 selection:bg-[#39FF14]/20 custom-scrollbar">
              <div className="text-zinc-500 mb-2 select-none leading-relaxed">
                <p>Workflow Engine Console Terminal [v3.1.2-Cores]</p>
                <p>Environment: sandboxed-node-container-host</p>
                <p>Engine Core: FFmpeg x264 Multi-threaded</p>
                <p>-----------------------------------------------------------------</p>
              </div>

              {/* Real-time Streamed Logs */}
              {logs.map((log, index) => (
                <div key={index} className="leading-relaxed whitespace-pre-wrap font-mono tracking-wide text-[11px]">
                  {log}
                </div>
              ))}

              {/* Pulsing blinking caret cursor for active processing */}
              {isProcessing && (
                <div className="text-zinc-400 animate-pulse mt-2 flex items-center gap-1.5 select-none font-mono text-[11px]">
                  <span>&gt; {processingStep}</span>
                  <span className="inline-block w-2 h-4 bg-[#39FF14] animate-pulse" />
                </div>
              )}

              <div ref={logsEndRef} />
            </div>

            {/* Terminal Interface Bottom Dashboard / Progress */}
            <div className="bg-[#0c0c0c] border-x border-b border-[#1a1a1a] p-5 rounded-b-3xl flex-shrink-0 flex flex-col gap-3 select-none">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Compilation Progress</span>
                <span className="text-[#39FF14] font-black">{renderProgress}%</span>
              </div>
              <div className="w-full bg-zinc-950 h-3 rounded-full overflow-hidden border border-[#1a1a1a] p-[2px]">
                <div 
                  className="bg-[#39FF14] h-full rounded-full shadow-[0_0_12px_#39FF14] transition-all duration-300"
                  style={{ width: `${renderProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1 pt-1 border-t border-zinc-900">
                <span className="text-[9px] font-mono text-slate-500 font-bold uppercase tracking-widest">
                  Intel FFmpeg Acceleration • Stream Looping Active
                </span>
                {!isProcessing && (
                  <button
                    onClick={() => setIsRendering(false)}
                    className="px-6 py-2.5 bg-[#39FF14] hover:bg-[#39FF14]/90 text-black text-xs font-mono font-black uppercase rounded-xl shadow-lg shadow-[#39FF14]/10 transition-all active:scale-95 border-b-2 border-green-800"
                  >
                    Close Console
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Video Preview Section */}
        <div className="space-y-4">
          <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex justify-between items-center px-1">
            <span>Production Monitor</span>
            {videoFile && <span className="text-blue-500 bg-blue-500/10 px-3 py-1 rounded-lg text-[10px] font-black tracking-widest">{formatTime(trimEnd - trimStart)}</span>}
          </h3>
          <div className="relative w-full aspect-video bg-black rounded-[2.5rem] overflow-hidden border border-[#222222] shadow-2xl group">
             {!videoUrl ? (
                <div onClick={() => videoInputRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors text-slate-600 group">
                    <div className="w-20 h-20 bg-[#111111] rounded-3xl flex items-center justify-center border border-[#222222] group-hover:scale-110 transition-transform shadow-xl mb-4">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </div>
                    <span className="text-xs font-black uppercase tracking-[0.3em]">Load Source Footage</span>
                </div>
             ) : (
                <>
                  <video ref={videoPlayerRef} src={videoUrl} className={`w-full h-full object-contain ${zoomEnabled ? 'scale-110' : ''}`} controls playsInline muted={muteOriginal} />
                  {/* Real-time Preview Overlays */}
                  {blurEnabled && (
                    <div 
                      className="absolute left-0 w-full backdrop-blur-md bg-white/5 border-y border-white/10 pointer-events-none transition-all duration-300"
                      style={{ 
                          height: '15%', 
                          top: `${(blurPosition / 100) * 85}%`,
                          zIndex: 10
                      }}
                    />
                  )}
                  {logoPreview && (
                    <img 
                      src={logoPreview} 
                      alt="Preview Logo" 
                      className="absolute top-[5%] right-[5%] w-[12%] h-auto opacity-80 pointer-events-none"
                      style={{ zIndex: 20 }}
                    />
                  )}
                </>
             )}
          </div>
          <input type="file" accept="video/*" ref={videoInputRef} onChange={handleVideoSelect} className="hidden" />
        </div>

        {/* Assets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <button onClick={() => videoInputRef.current?.click()} className="p-5 bg-[#0A0A0A] border border-[#222222] rounded-3xl flex flex-col gap-1 text-left hover:border-blue-500 transition-all group">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-blue-500">Video Source</span>
              <span className="text-sm font-bold text-white truncate">{videoFile ? videoFile.name : "None Loaded"}</span>
           </button>

           <button onClick={() => audioInputRef.current?.click()} className="p-5 bg-[#0A0A0A] border border-[#222222] rounded-3xl flex flex-col gap-1 text-left hover:border-emerald-500 transition-all group">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-emerald-500">Narration Audio</span>
              <span className="text-sm font-bold text-white truncate">{audioFile ? audioFile.name : "None Loaded"}</span>
              <input type="file" accept="audio/*" ref={audioInputRef} onChange={handleAudioSelect} className="hidden" />
           </button>

           <button onClick={() => logoInputRef.current?.click()} className="p-5 bg-[#0A0A0A] border border-[#222222] rounded-3xl flex flex-col gap-1 text-left hover:border-purple-500 transition-all group">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-purple-500">Channel Logo</span>
              <span className="text-sm font-bold text-white truncate">{logoFile ? logoFile.name : "None Loaded"}</span>
              <input type="file" accept="image/*" ref={logoInputRef} onChange={handleLogoSelect} className="hidden" />
           </button>
        </div>

        {/* Adjustments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="space-y-6">
               <div className={`bg-[#0A0A0A] border rounded-[2rem] p-6 flex items-center justify-between transition-all ${muteOriginal ? 'border-red-500/30' : 'border-[#222222]'}`}>
                  <div className="flex flex-col">
                     <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${muteOriginal ? 'text-red-400' : 'text-slate-400'}`}>Mute Original Audio</span>
                     <span className="text-[8px] font-bold text-slate-600 uppercase mt-1">Force Narration Only</span>
                  </div>
                  <ToggleSwitch checked={muteOriginal} onChange={setMuteOriginal} color="bg-red-500" />
               </div>

               {/* Freeze Frame Toggle - User Requested Feature */}
               <div className={`bg-[#0A0A0A] border rounded-[2rem] p-6 flex items-center justify-between transition-all ${freezeEnabled ? 'border-fuchsia-500/30' : 'border-[#222222]'}`}>
                  <div className="flex flex-col">
                     <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${freezeEnabled ? 'text-fuchsia-400' : 'text-slate-400'}`}>Freeze Frame Zoom (5s)</span>
                     <span className="text-[8px] font-bold text-slate-600 uppercase mt-1">Periodic Cinematic Emphasis</span>
                  </div>
                  <ToggleSwitch checked={freezeEnabled} onChange={setFreezeEnabled} color="bg-fuchsia-600" />
               </div>

               <div className="bg-[#0A0A0A] border border-[#222222] rounded-[2rem] p-8 space-y-6">
                  <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Timeline Trim</span><span className="text-[10px] font-black text-blue-500 tracking-widest">{formatTime(trimStart)} — {formatTime(trimEnd)}</span></div>
                  <div className="relative h-2">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-800 rounded-full" />
                    <div className="absolute top-0 h-1.5 bg-blue-600 rounded-full" style={{ left: `${(trimStart / videoDuration) * 100}%`, right: `${100 - (trimEnd / videoDuration) * 100}%` }} />
                    <input type="range" min="0" max={videoDuration} value={trimStart} onChange={(e) => { const v = Number(e.target.value); if(v < trimEnd) setTrimStart(v); }} className="absolute -top-1 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white" />
                    <input type="range" min="0" max={videoDuration} value={trimEnd} onChange={(e) => { const v = Number(e.target.value); if(v > trimStart) setTrimEnd(v); }} className="absolute -top-1 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500" />
                  </div>
               </div>
           </div>

           <div className="space-y-6">
               <div className={`bg-[#0A0A0A] border rounded-[2rem] p-6 space-y-6 transition-all ${blurEnabled ? 'border-blue-500/30' : 'border-[#222222]'}`}>
                  <div className="flex items-center justify-between">
                     <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${blurEnabled ? 'text-blue-400' : 'text-slate-400'}`}>Filmstrip Blur Strip</span>
                     <ToggleSwitch checked={blurEnabled} onChange={setBlurEnabled} />
                  </div>
                  {blurEnabled && (
                    <div className="flex items-center gap-4">
                       <button onClick={() => setBlurPosition(p => Math.max(0, p - 5))} className="flex-1 py-3 bg-[#111111] border border-[#222222] rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all">
                          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" /></svg>
                          <span className="text-[9px] font-black uppercase text-slate-500">Move Up</span>
                       </button>
                       <button onClick={() => setBlurPosition(p => Math.min(100, p + 5))} className="flex-1 py-3 bg-[#111111] border border-[#222222] rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all">
                          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                          <span className="text-[9px] font-black uppercase text-slate-500">Move Down</span>
                       </button>
                    </div>
                  )}
               </div>

               <div className={`bg-[#0A0A0A] border rounded-[2rem] p-6 space-y-4 ${audioDuration > 0 ? 'border-emerald-500/30' : 'border-[#222222]'}`}>
                   <div className="flex justify-between items-center px-1">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Sync & Velocity</h4>
                      <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Recommended: 1.0x</span>
                   </div>
                   
                   <div className="space-y-4">
                      <div className="flex items-center gap-3">
                         <input 
                           type="number" 
                           step="0.05" 
                           min="0.5" 
                           max="2.5"
                           value={speed} 
                           onChange={(e) => setSpeed(parseFloat(e.target.value))} 
                           className="w-20 bg-[#111111] border border-[#222222] rounded-2xl py-4 text-white font-black text-sm text-center outline-none focus:border-blue-500/50 transition-colors" 
                         />
                         <div className="flex-1 flex gap-2">
                            <button onClick={() => setSpeed(1.0)} className={`flex-1 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${speed === 1.0 ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-[#111111] text-slate-500 border border-[#222222] hover:bg-[#151515]'}`}>Normal (1.0x)</button>
                            <button onClick={() => setSpeed(1.2)} className={`flex-1 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${speed === 1.2 ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-[#111111] text-slate-500 border border-[#222222] hover:bg-[#151515]'}`}>Speedy (1.2x)</button>
                         </div>
                      </div>
                      <button 
                        onClick={handleAutoMatchSpeed} 
                        disabled={!videoFile || !audioFile} 
                        className="w-full bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-[10px] font-black uppercase py-4 rounded-2xl transition-colors border border-blue-500/20 active:scale-95 disabled:opacity-30"
                      >
                        Auto-Sync Footage to Audio
                      </button>

                      <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/10 space-y-2">
                         <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest flex items-center gap-2">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Pro Tip
                         </p>
                         <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                            ဗီဒီယို မမြန်စေချင်ရင် <span className="text-white">1.0x</span> ထားပါ။ Audio ရှည်ပြီး Video တိုနေပါက <span className="text-blue-500">Auto-Sync</span> ကိုသုံးပါ။ Video အရမ်းမြန်နေပါက Speed ကို <span className="text-white">1.0x</span> ပြန်ထားပြီး Video ကို Manual <span className="text-blue-500">Trim</span> ညှိပါ။
                         </p>
                      </div>
                   </div>
               </div>
           </div>
        </div>

        {/* Execute */}
        <div className="pt-4 pb-12">
           {!renderedBlob ? (
             <button onClick={handleRender} disabled={isRendering || !videoFile || !audioFile} className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black uppercase tracking-[0.3em] rounded-[2rem] shadow-2xl active:scale-[0.98] transition-all border-b-4 border-indigo-800 disabled:opacity-30">ဗီဒီယို ပေါင်းစပ်မည် (Master Render)</button>
           ) : (
             <div className="space-y-6 animate-in zoom-in-95 duration-500">
                <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-emerald-400 font-black uppercase text-[11px] tracking-[0.3em]">Master Smooth File Produced</span>
                </div>
                <div className="flex gap-4">
                  <button onClick={handleDownload} className="flex-[2] py-6 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black uppercase rounded-3xl shadow-xl border-b-4 border-emerald-800 transition-all active:scale-[0.98]">Download High-Fi WebM (1080p)</button>
                  <button onClick={() => { setRenderedBlob(null); setVideoFile(null); setAudioFile(null); setLogoFile(null); setLogoPreview(null); }} className="flex-1 py-6 bg-[#111111] text-slate-500 hover:text-white rounded-3xl border border-[#222222] font-black uppercase text-xs transition-all">Start Over</button>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default VideoEditor;
