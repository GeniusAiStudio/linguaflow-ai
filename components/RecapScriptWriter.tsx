
import React, { useState, useRef } from 'react';
import { calculateTextCost } from '../utils/creditCosts';
import { geminiService } from '../services/geminiService';
import { backendService } from '../services/backendService';

interface RecapScriptWriterProps {
  onBack: () => void;
  onTransferToStudio: (text: string) => void;
  onRequireCredits: (amount: number) => Promise<boolean>;
}

const RecapScriptWriter: React.FC<RecapScriptWriterProps> = ({ onBack, onTransferToStudio, onRequireCredits }) => {
    const [transcript, setTranscript] = useState('');
  const [generatedScript, setGeneratedScript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState('');
  
  // Reference Image State
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refImageInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

    const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Updated Limit: 5GB
    if (file.size > 5 * 1024 * 1024 * 1024) { 
      alert("Video file too large. Please select a video under 5GB.");
      return;
    }

    setIsProcessing(true);
    setGeneratedScript('');
    setProgress(0);
    setStatusMessage('Uploading & Transcribing (Large File Support Active)...');
    
    try {
      const text = await backendService.transcribeMediaFile(file, (p) => setProgress(p));
      setTranscript(text);
      
    } catch (err) {
      console.warn("Backend fail, falling back to cloud transcribe");
      try {
        // Safety check: Client-side Base64 fallback crashes on huge files (>300MB typically)
        if (file.size > 300 * 1024 * 1024) {
             throw new Error("File too large for client-side fallback. Backend is busy.");
        }
        setStatusMessage('Backend Busy - Using Cloud AI...');
        const text = await geminiService.transcribeMedia(file, file.type, 'en');
        setTranscript(text);
      } catch (e: any) {
        alert(`Transcription failed: ${e.message || 'Unknown error'}`);
      }
    } finally {
      setIsProcessing(false);
      setProgress(null);
      setStatusMessage('');
    }
  };

  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReferenceImage(file);
      setReferencePreview(URL.createObjectURL(file));
    }
  };

  const handleGenerateScript = async () => {
    if (!transcript.trim()) return;
    const cost = calculateTextCost(transcript.length);
    if (!(await onRequireCredits(cost))) return;
    setIsGenerating(true);
    try {
      let base64Image: string | undefined;
      
      if (referenceImage) {
        // Convert reference image to base64
        base64Image = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const res = reader.result as string;
                resolve(res.split(',')[1]);
            };
            reader.readAsDataURL(referenceImage);
        });
      }

      const result = await backendService.generateRecapScript(transcript, base64Image, customPrompt);
      setGeneratedScript(result);
      
      
      // Smooth scroll to result
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      console.error("Recap script generation failed:", err);
      alert(`Generation failed: ${err.message || 'Please check backend logs.'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedScript);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 animate-flutter-fade h-full overflow-hidden safe-area max-w-4xl mx-auto w-full">
      {/* AppBar */}
      <div className="flex items-center gap-6 px-4 flex-shrink-0">
        <button 
          onClick={onBack} 
          className="p-4 rounded-2xl bg-[#111111] border border-[#222222] text-white hover:bg-red-600 transition-all active:scale-90 shadow-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 text-center pr-12">
          <h2 className="text-xl font-black tracking-tighter uppercase italic">Recap Script Writer</h2>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-[2.5rem] p-8 md:p-10 overflow-y-auto custom-scrollbar bg-[#050505] border-[#111111] shadow-2xl space-y-8">
        
        {/* Input Source Grid */}
        <div className="bg-[#0A0D14] border border-[#1A1F2E] p-8 rounded-[2rem] space-y-6">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-red-600/20 flex items-center justify-center">
                <div className="w-4 h-4 bg-red-600 rounded-full flex items-center justify-center">
                   <div className="w-0 h-0 border-l-[4px] border-l-white border-y-[3px] border-y-transparent ml-0.5" />
                </div>
             </div>
             <h3 className="text-xl font-bold text-white tracking-tight">Input Source</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Upload Section */}
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Upload Video (Max 5GB)</label>
              <input type="file" ref={fileInputRef} onChange={handleVideoUpload} accept="video/*" className="hidden" />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full border-2 border-dashed border-[#222222] hover:border-red-500/50 rounded-xl py-3 flex flex-col items-center justify-center gap-1 transition-all group"
              >
                 <div className="flex items-center gap-2">
                   <svg className="w-4 h-4 text-slate-400 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                   <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">Select Video</span>
                 </div>
                 <span className="text-[10px] text-slate-500 italic">Supports MP4, MOV, MKV &lt; 5GB</span>
              </button>
            </div>
          </div>
        </div>

        {/* Visual Reference Section (Optional) */}
        <div className="bg-[#0A0D14] border border-[#1A1F2E] p-6 rounded-[2rem] space-y-4">
           <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                 <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                 Visual Reference (Optional)
              </h3>
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest bg-[#111111] px-2 py-1 rounded">Style Guide</span>
           </div>
           
           <div className="flex items-center gap-4">
              <input type="file" ref={refImageInputRef} onChange={handleReferenceImageUpload} accept="image/*" className="hidden" />
              
              <div 
                onClick={() => refImageInputRef.current?.click()}
                className="w-16 h-16 rounded-xl border border-dashed border-[#333] hover:border-purple-500/50 cursor-pointer flex items-center justify-center overflow-hidden bg-black transition-all group"
              >
                 {referencePreview ? (
                    <img src={referencePreview} alt="Ref" className="w-full h-full object-cover" />
                 ) : (
                    <svg className="w-6 h-6 text-slate-600 group-hover:text-purple-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                 )}
              </div>
              
              <div className="flex-1">
                 <p className="text-xs text-slate-400 font-medium">Upload a movie poster or scene image.</p>
                 <p className="text-[10px] text-slate-600 mt-1">The AI will use this to match the visual mood and style in the script.</p>
              </div>
              
              {referenceImage && (
                 <button 
                   onClick={() => { setReferenceImage(null); setReferencePreview(null); }}
                   className="text-red-500 text-xs font-bold hover:text-red-400"
                 >
                   Remove
                 </button>
              )}
           </div>
        </div>

        {/* Transcript Preview Area */}
        <div className="space-y-4 relative">
          <div className="flex items-center justify-between px-1">
             <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Transcript Preview</h3>
             {isProcessing && (
                <div className="flex items-center gap-2">
                   {progress !== null && <span className="text-[10px] font-black text-red-500 uppercase tracking-widest animate-pulse">{progress}%</span>}
                   <span className="text-[10px] font-black text-red-500 uppercase tracking-widest animate-pulse">{statusMessage || 'Processing...'}</span>
                </div>
             )}
          </div>
          <textarea 
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            maxLength={30000}
            rows={8}
            placeholder="Content will appear here after fetching/uploading or paste manually..."
            className="w-full bg-[#0A0D14] border border-[#1A1F2E] rounded-[1.5rem] p-6 text-slate-300 font-medium leading-relaxed resize-none focus:outline-none focus:border-red-500/30 transition-all custom-scrollbar"
          />
          
          {/* 30,000 Character Count Progress Bar */}
          <div className="space-y-2 px-1">
             <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="text-slate-500">Character Limit (စာလုံးရေ)</span>
                <span className={transcript.length >= 30000 ? "text-red-500 font-bold" : "text-slate-400"}>
                   {transcript.length.toLocaleString()} / 30,000
                </span>
             </div>
             <div className="w-full h-1.5 bg-[#111111] rounded-full overflow-hidden border border-[#222222]">
                <div 
                   className={`h-full transition-all duration-300 ${transcript.length >= 30000 ? "bg-red-500 animate-pulse" : "bg-red-600"}`}
                   style={{ width: `${Math.min(100, (transcript.length / 30000) * 100)}%` }}
                />
             </div>
          </div>
        </div>

        {/* Chat Box Input for Custom Prompt / Instructions */}
        <div className="bg-[#0A0D14] border border-[#1A1F2E] p-6 rounded-[2rem] space-y-4">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-red-600/10 flex items-center justify-center text-red-500 border border-red-500/20">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
             </div>
             <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Chat Box / Additional Prompt (Optional)</h3>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Custom script adjustments & directions</p>
             </div>
          </div>
          <div className="flex gap-2">
             <input 
               type="text" 
               value={customPrompt}
               onChange={(e) => setCustomPrompt(e.target.value)}
               placeholder="ဥပမာ- ဇာတ်လမ်းကို ပိုစိတ်လှုပ်ရှားစရာကောင်းအောင် ရေးပေးပါ၊ ဟာသလေးတွေ ထည့်ပေးပါ..." 
               className="flex-1 bg-black border border-[#222222] text-white rounded-xl px-4 py-3.5 text-sm focus:border-red-500 transition-all outline-none font-medium placeholder-slate-600"
             />
             {customPrompt && (
                <button 
                  onClick={() => setCustomPrompt('')}
                  className="px-4 bg-[#111111] hover:bg-[#222222] text-slate-400 hover:text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all border border-[#222222]"
                >
                  Clear
                </button>
             )}
          </div>
          <p className="text-[10px] text-slate-500 italic px-1">
             💡 Input extra instructions to guide how the Burmese recap script should be crafted.
          </p>
        </div>

        {/* Main Action Button */}
        <div className="pt-2">
          <button 
            onClick={handleGenerateScript}
            disabled={isGenerating || !transcript.trim()}
            className="w-full py-5 bg-red-600 hover:bg-red-500 text-white font-black text-lg rounded-2xl shadow-2xl shadow-red-900/30 active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-30 uppercase tracking-tighter"
          >
            {isGenerating ? (
              <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
            ) : generatedScript ? "Regenerate Burmese Script" : "Generate Burmese Script"}
          </button>
        </div>

        {/* Generated Script Result Section */}
        {generatedScript && (
          <div ref={resultRef} className="space-y-6 pt-6 animate-in slide-in-from-bottom-8 duration-700">
             <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Generated Recap Script (Editable)</h3>
                </div>
                <div className="flex gap-2">
                   <button 
                    onClick={handleCopy}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isCopied ? 'bg-emerald-600 text-white' : 'bg-[#111111] border border-[#222222] text-slate-400 hover:text-white'}`}
                   >
                     {isCopied ? "Copied!" : "Copy Full Script"}
                     {!isCopied && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>}
                   </button>
                </div>
             </div>

             <div className="relative group">
                <textarea 
                  value={generatedScript}
                  onChange={(e) => setGeneratedScript(e.target.value)}
                  rows={12}
                  className="w-full bg-[#050505] border-2 border-emerald-500/20 rounded-[2rem] p-8 text-white font-medium text-lg leading-relaxed resize-none focus:outline-none focus:border-emerald-500/50 transition-all custom-scrollbar shadow-[0_0_40px_rgba(16,185,129,0.05)]"
                />
                <div className="absolute top-4 right-4 opacity-20 group-hover:opacity-100 transition-opacity pointer-events-none">
                   <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest border border-emerald-500/30 px-2 py-1 rounded">Manual Edit Mode</span>
                </div>
             </div>

             <div className="flex flex-col md:flex-row gap-4 pb-12">
                <button 
                  onClick={() => onTransferToStudio(generatedScript)}
                  className="flex-1 py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 border-b-4 border-blue-800 uppercase text-[11px] tracking-widest"
                >
                   Move to Production Studio
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                </button>
             </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default RecapScriptWriter;
