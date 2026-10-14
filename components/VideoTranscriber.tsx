
import React, { useState, useRef } from 'react';
import { geminiService } from '../services/geminiService';
import TranslatedTextBox from './TranslatedTextBox';
import ExportButtons from './ExportButtons';

interface VideoTranscriberProps {
  onBack: () => void;
}

const VideoTranscriber: React.FC<VideoTranscriberProps> = ({ onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024 * 1024) { 
         alert("Notice: Files larger than 10GB may cause browser instability. Please ensure a stable connection.");
      }
      setFile(selectedFile);
      setVideoPreview(URL.createObjectURL(selectedFile));
      setResult('');
      setError(null);
    }
  };

  const handleTranscribe = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setStatusMsg('Initializing Neural Core...');

    try {
      // Simulate steps for better UX on large files
      setStatusMsg('Uploading to Secure Sandbox...');
      await new Promise(r => setTimeout(r, 1000));
      
      setStatusMsg('Analyzing Audio & Visual Context...');
      
      // Call the service
      const output = await geminiService.transcribeMedia(file, file.type, "auto", false);
      setResult(output);
      setStatusMsg('');
    } catch (err: any) {
      setError("PROCESSING_FAILED: The video could not be processed. Please check file format and size.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-8 animate-flutter-fade h-full overflow-hidden safe-area max-w-5xl mx-auto w-full">
      {/* AppBar */}
      <div className="flex items-center gap-6 px-4 flex-shrink-0">
        <button 
          onClick={onBack} 
          className="p-4 rounded-2xl bg-[#111111] border border-[#222222] text-white hover:bg-emerald-600 hover:border-emerald-500 transition-all active:scale-90 shadow-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 text-center pr-12">
          <h2 className="text-xl font-black tracking-tighter uppercase italic">Video Transcriber</h2>
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">10GB Max • Audio Transcription</p>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-[2.5rem] p-8 md:p-12 overflow-y-auto custom-scrollbar bg-[#050505] border-[#111111] shadow-2xl relative">
        <div className="max-w-4xl mx-auto space-y-10">
          
          {/* Upload Area */}
          <div className="space-y-4">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] px-1">Source Footage</label>
            
            {!videoPreview ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-64 border-2 border-dashed border-[#222222] rounded-[2rem] flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group"
              >
                <div className="w-20 h-20 bg-[#111111] rounded-3xl flex items-center justify-center border border-[#222222] group-hover:scale-110 transition-transform shadow-xl">
                   <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </div>
                <div className="text-center">
                   <p className="text-white font-bold text-lg">Click to Upload Video</p>
                   <p className="text-slate-500 text-xs mt-1">Supports MP4, MOV, MKV (Max 10GB)</p>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="video/*" className="hidden" />
              </div>
            ) : (
              <div className="w-full bg-black rounded-[2rem] overflow-hidden border border-[#222222] shadow-2xl relative group">
                 <video src={videoPreview} controls className="w-full h-auto max-h-[400px] object-contain" />
                 <button 
                   onClick={() => { setFile(null); setVideoPreview(null); setResult(''); }}
                   className="absolute top-4 right-4 bg-black/70 text-white p-2 rounded-xl hover:bg-red-600 transition-colors"
                 >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
              </div>
            )}

            {file && !isProcessing && !result && (
               <button
                 onClick={handleTranscribe}
                 className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-900/20 active:scale-95 border-b-4 border-emerald-800 flex items-center justify-center gap-3"
               >
                 <span>Transcribe Audio</span>
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
               </button>
            )}
          </div>

          {/* Processing State */}
          {isProcessing && (
            <div className="py-12 flex flex-col items-center justify-center gap-6 animate-in fade-in zoom-in-95">
               <div className="relative">
                 <div className="w-24 h-24 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin" />
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
                 </div>
               </div>
               <div className="text-center space-y-2">
                 <p className="text-emerald-400 font-black uppercase tracking-[0.2em] text-sm animate-pulse">{statusMsg}</p>
                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">This may take a moment for large files</p>
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
          {result && (
            <div className="space-y-8 animate-in slide-in-from-bottom-12 duration-700">
               <div className="flex items-center justify-between border-b border-[#111111] pb-4">
                 <h3 className="text-sm font-black text-white uppercase italic tracking-tighter">Video Transcription</h3>
                 <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[10px] font-black text-[#444444] uppercase tracking-widest">Script Ready</span>
                 </div>
               </div>

               <div className="flex flex-col gap-6">
                 <TranslatedTextBox translatedText={result} />
                 
                 <div className="flex justify-end">
                    <ExportButtons text={result} />
                 </div>
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default VideoTranscriber;
