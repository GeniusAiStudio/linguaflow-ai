import React, { useState, useRef } from 'react';
import { geminiService } from '../services/geminiService';
import { audioBufferToWav, downloadAudio } from '../services/audioUtils';

interface AudioSplitterProps {
  onBack: () => void;
}

interface SpeakerSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

const AudioSplitter: React.FC<AudioSplitterProps> = ({ onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [segments, setSegments] = useState<SpeakerSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [isDownloading, setIsDownloading] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setMediaPreview(URL.createObjectURL(selectedFile));
      setSegments([]);
      setError(null);
    }
  };

  const handleSplit = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setStatusMsg('Initializing Audio Core...');

    try {
      let processingFile: Blob = file;
      let mimeType = file.type;

      // Optimization: If video, extract audio only to reduce payload size
      if (file.type.startsWith('video/')) {
        setStatusMsg('Extracting Audio Track...');
        try {
          const arrayBuffer = await file.arrayBuffer();
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          processingFile = audioBufferToWav(audioBuffer);
          mimeType = 'audio/wav';
        } catch (e) {
          console.warn("Audio extraction failed, falling back to full file", e);
        }
      }

      setStatusMsg('Analyzing Speaker Patterns...');
      const output = await geminiService.splitAudioBySpeaker(processingFile, mimeType);
      setSegments(output);
      setStatusMsg('');
    } catch (err: any) {
      setError("SPLIT_FAILED: Could not analyze speakers. Please try a clearer audio file.");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadSegment = async (seg: SpeakerSegment, index: number) => {
    if (!file) return;
    setIsDownloading(index);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const fullBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      
      const startFrame = Math.floor(seg.start * fullBuffer.sampleRate);
      const endFrame = Math.floor(seg.end * fullBuffer.sampleRate);
      const frameCount = Math.max(0, endFrame - startFrame);
      
      if (frameCount === 0) {
        alert("Segment too short to extract.");
        return;
      }
      
      const segmentBuffer = audioCtx.createBuffer(
        fullBuffer.numberOfChannels,
        frameCount,
        fullBuffer.sampleRate
      );
      
      for (let i = 0; i < fullBuffer.numberOfChannels; i++) {
        const channelData = fullBuffer.getChannelData(i).slice(startFrame, endFrame);
        segmentBuffer.getChannelData(i).set(channelData);
      }
      
      const wavBlob = audioBufferToWav(segmentBuffer);
      downloadAudio(wavBlob, `${seg.speaker.replace(/\s+/g, '_')}_${index + 1}.wav`);
    } catch (err) {
      console.error("Failed to download segment", err);
      alert("Failed to extract audio segment. Browser memory may be low.");
    } finally {
      setIsDownloading(null);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col gap-8 animate-flutter-fade h-full overflow-hidden safe-area max-w-5xl mx-auto w-full">
      {/* AppBar */}
      <div className="flex items-center gap-6 px-4 flex-shrink-0">
        <button 
          onClick={onBack} 
          className="p-4 rounded-2xl bg-[#111111] border border-[#222222] text-white hover:bg-blue-600 hover:border-blue-500 transition-all active:scale-90 shadow-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 text-center pr-12">
          <h2 className="text-xl font-black tracking-tighter uppercase italic">Audio Splitter</h2>
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em]">AI Speaker Diarization</p>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-[2.5rem] p-8 md:p-12 overflow-y-auto custom-scrollbar bg-[#050505] border-[#111111] shadow-2xl relative">
        <div className="max-w-4xl mx-auto space-y-10">
          
          {/* Upload Area */}
          <div className="space-y-4">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] px-1">Source Media</label>
            
            {!mediaPreview ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-64 border-2 border-dashed border-[#222222] rounded-[2rem] flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
              >
                <div className="w-20 h-20 bg-[#111111] rounded-3xl flex items-center justify-center border border-[#222222] group-hover:scale-110 transition-transform shadow-xl">
                   <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                </div>
                <div className="text-center">
                   <p className="text-white font-bold text-lg">Click to Upload Video/Audio</p>
                   <p className="text-slate-500 text-xs mt-1">Supports MP4, MP3, WAV, MOV</p>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="video/*,audio/*" className="hidden" />
              </div>
            ) : (
              <div className="w-full bg-black rounded-[2rem] overflow-hidden border border-[#222222] shadow-2xl relative group">
                 {file?.type.startsWith('video') ? (
                   <video src={mediaPreview} controls className="w-full h-auto max-h-[300px] object-contain" />
                 ) : (
                   <div className="p-12 flex flex-col items-center justify-center gap-4">
                      <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                      </div>
                      <p className="text-white font-bold">{file?.name}</p>
                      <audio src={mediaPreview} controls className="w-full max-w-md" />
                   </div>
                 )}
                 <button 
                   onClick={() => { setFile(null); setMediaPreview(null); setSegments([]); }}
                   className="absolute top-4 right-4 bg-black/70 text-white p-2 rounded-xl hover:bg-red-600 transition-colors"
                 >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
              </div>
            )}

            {file && !isProcessing && segments.length === 0 && (
               <button
                 onClick={handleSplit}
                 className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-900/20 active:scale-95 border-b-4 border-blue-800 flex items-center justify-center gap-3"
               >
                 <span>Split Audio by Character</span>
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
               </button>
            )}
          </div>

          {/* Processing State */}
          {isProcessing && (
            <div className="py-12 flex flex-col items-center justify-center gap-6 animate-in fade-in zoom-in-95">
               <div className="relative">
                 <div className="w-24 h-24 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-ping" />
                 </div>
               </div>
               <div className="text-center space-y-2">
                 <p className="text-blue-400 font-black uppercase tracking-[0.2em] text-sm animate-pulse">{statusMsg}</p>
                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Identifying unique voices...</p>
               </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl flex items-center gap-4 text-red-400 font-bold animate-in zoom-in-95">
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <p className="text-xs uppercase tracking-tight">{error}</p>
            </div>
          )}

          {/* Results Workspace */}
          {segments.length > 0 && (
            <div className="space-y-8 animate-in slide-in-from-bottom-12 duration-700">
               <div className="flex items-center justify-between border-b border-[#111111] pb-4">
                 <h3 className="text-sm font-black text-white uppercase italic tracking-tighter">Split Results</h3>
                 <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                   <span className="text-[10px] font-black text-[#444444] uppercase tracking-widest">{segments.length} Segments Found</span>
                 </div>
               </div>

               <div className="grid gap-4">
                 {segments.map((seg, idx) => (
                   <div key={idx} className="bg-[#111111] border border-[#222222] rounded-2xl p-6 hover:border-blue-500/30 transition-all group">
                     <div className="flex items-center justify-between mb-3">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 font-black text-xs">
                           {seg.speaker.match(/\d+/)?.[0] || idx + 1}
                         </div>
                         <span className="text-xs font-black text-white uppercase tracking-widest">{seg.speaker}</span>
                       </div>
                       <div className="flex items-center gap-4">
                         <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-[#1a1a1a] px-3 py-1 rounded-full">
                           {formatTime(seg.start)} — {formatTime(seg.end)}
                         </div>
                         <button 
                           onClick={() => downloadSegment(seg, idx)}
                           disabled={isDownloading !== null}
                           className="p-2 rounded-lg bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50"
                           title="Download this segment"
                         >
                           {isDownloading === idx ? (
                             <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                           ) : (
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                           )}
                         </button>
                       </div>
                     </div>
                     <p className="text-slate-300 text-sm leading-relaxed">{seg.text}</p>
                   </div>
                 ))}
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AudioSplitter;
