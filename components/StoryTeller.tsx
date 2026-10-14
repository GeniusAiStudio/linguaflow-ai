
import React, { useState } from 'react';
import { calculateTextCost } from '../utils/creditCosts';
import { geminiService } from '../services/geminiService';
import { projectService } from '../services/projectService';
import { ViewMode } from '../types';
import TranslatedTextBox from './TranslatedTextBox';
import ExportButtons from './ExportButtons';

interface StoryTellerProps {
  onRequireCredits: (amount: number) => Promise<boolean>;
  onBack: () => void;
  onTransferToStudio: (text: string) => void;
}

const StoryTeller: React.FC<StoryTellerProps> = ({ onBack, onTransferToStudio , onRequireCredits }) => {
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string>('');
  const [episode, setEpisode] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>('');

  const stateRef = React.useRef({ topic, result, episode });
  React.useEffect(() => {
    stateRef.current = { topic, result, episode };
  }, [topic, result, episode]);

  // Restore Project or Auto-save Draft
  React.useEffect(() => {
    const activeProj = projectService.getActiveProject();
    if (activeProj && activeProj.type === ViewMode.STORY_TELLER) {
      if (activeProj.stateData) {
        if (activeProj.stateData.topic) setTopic(activeProj.stateData.topic);
        if (activeProj.stateData.result) setResult(activeProj.stateData.result);
        if (activeProj.stateData.episode) setEpisode(activeProj.stateData.episode);
      }
      projectService.setActiveProject(null);
    } else {
      const savedDraft = localStorage.getItem('genius_ai_story_teller_draft');
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          if (draft.topic) setTopic(draft.topic);
          if (draft.result) setResult(draft.result);
          if (draft.episode) setEpisode(draft.episode);
        } catch (e) {
          console.error("Failed to restore Story Teller draft", e);
        }
      }
    }
  }, []);

  // Save/Update Project
  React.useEffect(() => {
    if (topic.trim() || result.trim()) {
      projectService.saveProject({
        name: `Story: ${topic.slice(0, 30).trim() || 'Untitled'}...`,
        type: ViewMode.STORY_TELLER,
        fileName: 'story_script.txt',
        fileSize: `${Math.round((topic.length + result.length) / 1024 * 10) / 10} KB`,
        stateData: {
          topic,
          result,
          episode
        }
      });
    }
  }, [topic, result, episode]);

  // Auto-save interval of 30 seconds
  React.useEffect(() => {
    const interval = setInterval(() => {
      const current = stateRef.current;
      if (current.topic.trim() || current.result.trim()) {
        localStorage.setItem(
          'genius_ai_story_teller_draft',
          JSON.stringify(current)
        );
        const now = new Date().toLocaleTimeString();
        setLastSaved(now);
      } else {
        localStorage.removeItem('genius_ai_story_teller_draft');
        setLastSaved('');
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleGenerate = async (nextEpisode: boolean = false) => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setError(null);
    
    try {
      const targetEpisode = nextEpisode ? episode + 1 : 1;
      const previousContext = nextEpisode ? result : undefined;
      
      const output = await geminiService.generateStoryScript(topic, previousContext, targetEpisode);
      
      if (nextEpisode) {
        setResult(prev => `${prev}\n\n============================\nEPISODE ${targetEpisode}\n============================\n\n${output}`);
        setEpisode(targetEpisode);
      } else {
        setResult(`EPISODE 1\n============================\n\n${output}`);
        setEpisode(1);
      }
    } catch (err: any) {
      setError("GENERATION_FAILED: Neural story engine encountered an error.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(result);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        return;
      }
    } catch (err) {
      console.warn("navigator.clipboard.writeText failed, trying fallback:", err);
    }

    try {
      const textArea = document.createElement("textarea");
      textArea.value = result;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      if (successful) {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } else {
        console.error("Fallback copy failed");
      }
    } catch (fallbackErr) {
      console.error("Clipboard copy fallback failed:", fallbackErr);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-8 animate-flutter-fade h-full overflow-hidden safe-area max-w-4xl mx-auto w-full">
      {/* AppBar */}
      <div className="flex items-center gap-6 px-4 flex-shrink-0">
        <button 
          onClick={onBack} 
          className="p-4 rounded-2xl bg-[#111111] border border-[#222222] text-white hover:bg-fuchsia-600 hover:border-fuchsia-500 transition-all active:scale-90 shadow-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 text-center pr-12">
          <h2 className="text-xl font-black tracking-tighter uppercase italic">Story Teller</h2>
          <p className="text-[10px] font-black text-fuchsia-500 uppercase tracking-[0.4em]">Gemini 3 Pro Engine</p>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-[2.5rem] p-8 md:p-12 overflow-y-auto custom-scrollbar bg-[#050505] border-[#111111] shadow-2xl relative">
        <div className="max-w-3xl mx-auto space-y-10">
          
          {/* Input Area */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em]">Story Topic / Title</label>
              {lastSaved && (
                <span className="text-[10px] text-fuchsia-400 font-bold flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500"></span>
                  Auto-saved {lastSaved}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-4">
              <div className="relative">
                <input 
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ex: တောနက်ထဲဦးက နတ်သမီးလေး (The Fairy in the Deep Forest)"
                  className="w-full bg-[#0A0A0A] border border-[#222222] text-white rounded-2xl pl-6 pr-6 py-5 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 transition-all font-bold text-sm placeholder:text-[#222222]"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-700">
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => handleGenerate(false)}
                  disabled={isGenerating || !topic.trim()}
                  className="flex-1 py-5 bg-gradient-to-r from-fuchsia-700 to-purple-800 hover:from-fuchsia-600 hover:to-purple-700 disabled:opacity-30 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-fuchsia-900/20 active:scale-95 border-b-4 border-purple-900 flex items-center justify-center gap-3"
                >
                  {isGenerating && episode === 1 ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Writing Episode 1...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                      <span>{result ? 'Restart Story' : 'Generate Story Script'}</span>
                    </>
                  )}
                </button>

                {result && (
                  <button
                    onClick={() => handleGenerate(true)}
                    disabled={isGenerating}
                    className="flex-1 py-5 bg-[#1A1A1A] hover:bg-[#252525] border border-[#333] text-blue-400 disabled:opacity-30 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3"
                  >
                    {isGenerating && episode > 1 ? (
                      <>
                        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        <span>Writing Ep {episode + 1}...</span>
                      </>
                    ) : (
                      <>
                        <span>Generate Ep {episode + 1}</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </>
                    )}
                  </button>
                )}
              </div>
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
            <div className="space-y-8 animate-in slide-in-from-bottom-12 duration-700 pt-6">
               <div className="flex items-center justify-between border-b border-[#111111] pb-4">
                 <h3 className="text-sm font-black text-white uppercase italic tracking-tighter">Script Output</h3>
                 <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse" />
                   <span className="text-[10px] font-black text-[#444444] uppercase tracking-widest">Episode {episode} Ready</span>
                 </div>
               </div>

               <div className="flex flex-col gap-6">
                 <TranslatedTextBox translatedText={result} />
                 
                 <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => onTransferToStudio(result)}
                        className="px-6 py-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all border border-blue-600/20 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        Edit in Studio
                      </button>
                      <button
                        onClick={handleCopy}
                        className={`px-6 py-3 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all border flex items-center gap-2 ${isCopied ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-[#111111] text-slate-300 border-[#222222] hover:bg-[#1A1A1A] hover:text-white'}`}
                      >
                        {isCopied ? (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                Copied
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                Full Script Copy
                            </>
                        )}
                      </button>
                    </div>
                    <ExportButtons text={result} />
                 </div>
               </div>
            </div>
          )}

          {!result && !isGenerating && (
            <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center gap-6">
              <div className="w-20 h-20 bg-[#111111] rounded-[2rem] flex items-center justify-center border border-[#222222]">
                <svg className="w-10 h-10 text-[#444444]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="space-y-2">
                <p className="font-black text-white text-xl uppercase italic tracking-tighter">Awaiting Inspiration</p>
                <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500">Enter a topic to weave a new tale</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pb-10 text-center opacity-10">
        <p className="text-[10px] font-black text-white uppercase tracking-[0.8em]">© 2026 GENIUS AI STORY ENGINE</p>
      </div>
    </div>
  );
};

export default StoryTeller;
