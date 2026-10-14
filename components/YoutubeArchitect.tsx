
import React, { useState } from 'react';
import { geminiService } from '../services/geminiService';
import TranslatedTextBox from './TranslatedTextBox';
import ExportButtons from './ExportButtons';

interface YoutubeArchitectProps {
  onBack: () => void;
  targetLang: string;
}

const YoutubeArchitect: React.FC<YoutubeArchitectProps> = ({ onBack, targetLang }) => {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async () => {
    if (!url.trim()) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const output = await geminiService.generateScriptFromYoutubeUrl(url, targetLang);
      setResult(output);
    } catch (err: any) {
      setError("ANALYSIS_FAILED: Could not establish link with URL core.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-8 animate-flutter-fade h-full overflow-hidden safe-area max-w-4xl mx-auto w-full">
      {/* AppBar */}
      <div className="flex items-center gap-6 px-4 flex-shrink-0">
        <button 
          onClick={onBack} 
          className="p-4 rounded-2xl bg-[#111111] border border-[#222222] text-white hover:bg-red-600 hover:border-red-500 transition-all active:scale-90 shadow-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 text-center pr-12">
          <h2 className="text-xl font-black tracking-tighter uppercase italic">YouTube Architect</h2>
          <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.4em]">URL Theme Reconstruction</p>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-[2.5rem] p-8 md:p-12 overflow-y-auto custom-scrollbar bg-[#050505] border-[#111111] shadow-2xl relative">
        <div className="max-w-2xl mx-auto space-y-10">
          
          {/* URL Input Terminal */}
          <div className="space-y-4">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] px-1">YouTube Link Protocol</label>
            <div className="flex flex-col md:flex-row gap-4">
              <input 
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="flex-1 bg-[#0A0A0A] border border-[#222222] text-white rounded-2xl px-6 py-5 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-bold text-sm placeholder:text-[#222222]"
              />
              <button
                onClick={handleExecute}
                disabled={isAnalyzing || !url.trim()}
                className="px-10 py-5 bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 border-b-4 border-red-800 flex items-center justify-center gap-3"
              >
                {isAnalyzing ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : "Execute Analysis"}
              </button>
            </div>
          </div>

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
                 <h3 className="text-sm font-black text-white uppercase italic tracking-tighter">Production Output</h3>
                 <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                   <span className="text-[10px] font-black text-[#444444] uppercase tracking-widest">Theme Reconstructed</span>
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

          {!result && !isAnalyzing && (
            <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center gap-6">
              <div className="w-20 h-20 bg-[#111111] rounded-[2rem] flex items-center justify-center border border-[#222222]">
                <svg className="w-10 h-10 text-[#444444]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <div className="space-y-2">
                <p className="font-black text-white text-xl uppercase italic tracking-tighter">Awaiting URL Payload</p>
                <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500">Ready for script reconstruction</p>
              </div>
            </div>
          )}

          {isAnalyzing && (
            <div className="py-20 flex flex-col items-center justify-center gap-8 animate-in zoom-in-95">
              <div className="relative">
                <div className="w-24 h-24 border-4 border-red-500/10 border-t-red-500 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-white font-black uppercase tracking-[0.3em] text-sm animate-pulse">Deep Neural Theme Analysis</p>
                <p className="text-[9px] text-[#444444] font-bold uppercase tracking-widest">Architect core engaged</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pb-10 text-center opacity-10">
        <p className="text-[10px] font-black text-white uppercase tracking-[0.8em]">© 2026 GENIUS AI PRODUCTION SECURED</p>
      </div>
    </div>
  );
};

export default YoutubeArchitect;
