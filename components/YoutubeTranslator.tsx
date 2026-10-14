
import React, { useState } from 'react';
import { geminiService } from '../services/geminiService';
import TranslatedTextBox from './TranslatedTextBox';
import ExportButtons from './ExportButtons';

interface YoutubeTranslatorProps {
  onBack: () => void;
  targetLang: string;
}

const YoutubeTranslator: React.FC<YoutubeTranslatorProps> = ({ onBack, targetLang }) => {
  const [url, setUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleTranslate = async () => {
    if (!url.trim()) return;
    setIsProcessing(true);
    setError(null);
    setResult('');
    
    try {
      const output = await geminiService.translateYoutubeTranscript(url, targetLang);
      
      // Strict check for the "No transcript" response as per system instructions
      if (output.includes("does not provide a transcript") || output.includes("not possible")) {
        setError(output);
      } else {
        setResult(output);
      }
    } catch (err: any) {
      setError("TRANSLATION_CORE_FAILURE: The translation engine encountered a structural error.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-8 animate-flutter-fade h-full overflow-hidden safe-area max-w-4xl mx-auto w-full">
      {/* AppBar */}
      <div className="flex items-center gap-6 px-4 flex-shrink-0">
        <button 
          onClick={onBack} 
          className="p-4 rounded-2xl bg-[#111111] border border-[#222222] text-white hover:bg-[#881337] hover:border-rose-500 transition-all active:scale-90 shadow-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 text-center pr-12">
          <h2 className="text-xl font-black tracking-tighter uppercase italic">YouTube Translator</h2>
          <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.4em]">High-Fidelity Script Recovery</p>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-[2.5rem] p-8 md:p-12 overflow-y-auto custom-scrollbar bg-[#050505] border-[#111111] shadow-2xl relative">
        {/* Progress Overlay with DeepScan Animation */}
        {isProcessing && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm rounded-[2.5rem] flex flex-col items-center justify-center p-12 overflow-hidden animate-in fade-in duration-300">
             <div className="w-full h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent absolute top-0 animate-[deepScan_3s_ease-in-out_infinite]" style={{ boxShadow: '0 0 30px rgba(244, 63, 94, 0.8)' }} />
             
             <div className="relative mb-10">
                <div className="w-32 h-32 border-4 border-rose-500/10 border-t-rose-500 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-4 h-4 bg-rose-500 rounded-full animate-ping" />
                </div>
             </div>

             <div className="text-center space-y-4 max-w-sm">
                <h4 className="text-xl font-black text-white uppercase italic tracking-tighter">Transcript Syncing</h4>
                <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div className="h-full bg-rose-500 animate-[loading_5s_linear_infinite]" style={{ width: '40%' }} />
                </div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] leading-relaxed">
                  Initializing secure link with YouTube transcript core...
                </p>
             </div>
          </div>
        )}

        <div className="max-w-2xl mx-auto space-y-10">
          
          {/* Protocol Input */}
          <div className="space-y-4">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] px-1">Source Protocol (YouTube URL)</label>
            <div className="flex flex-col md:flex-row gap-4">
              <input 
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste video link for accurate translation..."
                className="flex-1 bg-[#0A0A0A] border border-[#222222] text-white rounded-2xl px-6 py-5 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all font-bold text-sm placeholder:text-[#222222]"
              />
              <button
                onClick={handleTranslate}
                disabled={isProcessing || !url.trim()}
                className="px-10 py-5 bg-[#881337] hover:bg-[#9f1239] disabled:opacity-30 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 border-b-4 border-rose-900 flex items-center justify-center gap-3"
              >
                Sync & Translate
              </button>
            </div>
          </div>

          {/* Warning / Error State */}
          {error && (
            <div className="bg-rose-500/5 border border-rose-500/20 p-10 rounded-[2rem] flex flex-col items-center text-center gap-6 text-rose-400 font-bold animate-in zoom-in-95">
              <div className="w-20 h-20 bg-rose-500/10 rounded-[2rem] flex items-center justify-center border border-rose-500/20">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="space-y-3">
                <p className="text-xl font-black uppercase tracking-tight italic">{error}</p>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest max-w-md mx-auto">
                  Accuracy protocol requires an official or auto-generated transcript to proceed.
                </p>
              </div>
              <button onClick={() => { setError(null); setUrl(''); }} className="mt-4 px-6 py-2 bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase tracking-widest rounded-xl border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all">Clear Protocol</button>
            </div>
          )}

          {/* Results Output */}
          {result && (
            <div className="space-y-8 animate-in slide-in-from-bottom-12 duration-700">
               <div className="flex items-center justify-between border-b border-[#111111] pb-4">
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                     <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                     </svg>
                   </div>
                   <h3 className="text-sm font-black text-white uppercase italic tracking-tighter">Accurate Script Production</h3>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[10px] font-black text-emerald-500/70 uppercase tracking-widest">Verified Transcript Sync</span>
                 </div>
               </div>

               <div className="flex flex-col gap-6">
                 <TranslatedTextBox translatedText={result} isMono={true} />
                 <div className="flex justify-end">
                   <ExportButtons text={result} />
                 </div>
               </div>
            </div>
          )}

          {!result && !isProcessing && !error && (
            <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center gap-6 group">
              <div className="w-24 h-24 bg-[#111111] rounded-[2.5rem] flex items-center justify-center border border-[#222222] group-hover:border-rose-500/30 transition-all duration-500">
                <svg className="w-12 h-12 text-[#444444] group-hover:text-rose-500/50 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              </div>
              <div className="space-y-2">
                <p className="font-black text-white text-xl uppercase italic tracking-tighter">Awaiting Sync Protocol</p>
                <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500">Provide link for accurate transcript extraction</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pb-10 text-center opacity-10">
        <p className="text-[10px] font-black text-white uppercase tracking-[0.8em]">© 2026 GENIUS AI PRODUCTION SECURED</p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes loading {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
};

export default YoutubeTranslator;
