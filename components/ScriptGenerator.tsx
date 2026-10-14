
import React, { useState } from 'react';
import { calculateTextCost } from '../utils/creditCosts';
import { ScriptType, ViewMode } from '../types';
import { geminiService } from '../services/geminiService';
import { backendService } from '../services/backendService';
import { projectService } from '../services/projectService';

interface ScriptGeneratorProps {
  onRequireCredits: (amount: number) => Promise<boolean>;
  onTransferToStudio: (text: string) => void;
  onBack: () => void;
}

const CATEGORIES = [
  "Education",
  "Technology",
  "History",
  "Health",
  "Business",
  "Startup",
  "Finance",
  "Motivation",
  "Lifestyle",
  "Travel",
  "Food",
  "Movies",
  "Music",
  "Sports",
  "Relationship",
  "News",
  "Career",
  "Marketing",
  "Gaming",
  "AI",
  "Storytelling",
  "Philosophy",
  "General Knowledge"
];

const LANGUAGES = [
  "Burmese",
  "English",
  "Nepali",
  "Japanese",
  "Korean",
  "Chinese (Simplified)",
  "Chinese (Traditional)",
  "Thai",
  "Vietnamese",
  "Hindi",
  "Indonesian",
  "Malay",
  "French",
  "German",
  "Spanish",
  "Italian",
  "Russian",
  "Portuguese",
  "Arabic",
  "Turkish",
  "Bengali",
];

const InputLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="text-[13px] font-bold text-white uppercase tracking-tight mb-2 block ml-1">
    {children}
  </label>
);

/**
 * ToggleButton component matching the Flutter widget logic and colors.
 */
const ToggleButton: React.FC<{
  title: string;
  selected: boolean;
  activeColor: string;
  onTap: () => void;
}> = ({ title, selected, activeColor, onTap }) => (
  <button
    onClick={onTap}
    className={`flex-1 py-3.5 mx-1.5 rounded-2xl border transition-all duration-200 font-bold text-[13px] text-center active:scale-95 select-none ${
      selected 
        ? `text-white border-transparent shadow-lg shadow-black/40` 
        : `bg-[#0A0A0A] text-[#666666] border-[#222222] hover:border-[#333333]`
    }`}
    style={{ backgroundColor: selected ? activeColor : undefined }}
  >
    {title}
  </button>
);

const ScriptGenerator: React.FC<ScriptGeneratorProps> = ({ onTransferToStudio, onBack, onRequireCredits }) => {
  const [language, setLanguage] = useState("Burmese");
  const [category, setCategory] = useState("Education");
  const [topicDescription, setTopicDescription] = useState("");
  const [fineTune, setFineTune] = useState("");
  const [contentType, setContentType] = useState("VIDEO SCRIPT");
  const [creatorVoice, setCreatorVoice] = useState("FEMALE");
  const [visualType, setVisualType] = useState("WITH AI IMAGE");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState('');

  // Restore Project
  React.useEffect(() => {
    const activeProj = projectService.getActiveProject();
    if (activeProj && activeProj.type === ViewMode.GENERATOR) {
      if (activeProj.stateData) {
        if (activeProj.stateData.language) setLanguage(activeProj.stateData.language);
        if (activeProj.stateData.category) setCategory(activeProj.stateData.category);
        if (activeProj.stateData.topicDescription) setTopicDescription(activeProj.stateData.topicDescription);
        if (activeProj.stateData.fineTune) setFineTune(activeProj.stateData.fineTune);
        if (activeProj.stateData.contentType) setContentType(activeProj.stateData.contentType);
        if (activeProj.stateData.creatorVoice) setCreatorVoice(activeProj.stateData.creatorVoice);
        if (activeProj.stateData.visualType) setVisualType(activeProj.stateData.visualType);
        if (activeProj.stateData.result) setResult(activeProj.stateData.result);
      }
      projectService.setActiveProject(null);
    }
  }, []);

  // Save Project
  React.useEffect(() => {
    if (topicDescription.trim() || result.trim()) {
      projectService.saveProject({
        name: `Script Creator: ${topicDescription.slice(0, 30).trim() || 'Untitled'}...`,
        type: ViewMode.GENERATOR,
        fileName: 'script_brief.json',
        fileSize: `${Math.round((topicDescription.length + result.length + fineTune.length) / 1024 * 10) / 10} KB`,
        stateData: {
          language,
          category,
          topicDescription,
          fineTune,
          contentType,
          creatorVoice,
          visualType,
          result
        }
      });
    }
  }, [language, category, topicDescription, fineTune, contentType, creatorVoice, visualType, result]);

  // Voice Preview State
  const [playingVoice, setPlayingVoice] = useState<'MALE' | 'FEMALE' | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);

  const handlePlayVoice = async (gender: 'MALE' | 'FEMALE') => {
    if (voiceLoading || playingVoice) return;
    
    setVoiceLoading(true);
    setPlayingVoice(gender);
    
    try {
        const text = gender === 'MALE' 
            ? "Hello, I am your male AI voice assistant." 
            : "Hello, I am your female AI voice assistant.";
        const voiceName = gender === 'MALE' ? 'Charon' : 'Kore';
        
        const audioBuffer = await geminiService.generateSpeech(text, voiceName);
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        
        source.onended = () => {
            setPlayingVoice(null);
            setVoiceLoading(false);
        };
        
        setVoiceLoading(false); // Stop loading spinner, start playing indicator
        source.start();
        
    } catch (e) {
        console.error("Voice preview failed", e);
        alert("Voice generation is currently busy (500). Please try again in a moment.");
        setPlayingVoice(null);
        setVoiceLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!topicDescription.trim()) return;
    const cost = calculateTextCost(topicDescription.length);
    if (!(await onRequireCredits(cost))) return;
    setIsGenerating(true);
    
    const fullBrief = `
      Category: ${category}
      Topic: ${topicDescription}
      Additional Instructions: ${fineTune}
      Content Format: ${contentType}
      Voice Preference: ${creatorVoice}
      Visual Style: ${visualType}
      Target Language: ${language}
    `;

    try {
      const script = await backendService.generateScript(topicDescription);
      const refinedScript = await backendService.generateCreativeScript(
        `Brief: ${fullBrief}. Initial Draft: ${script}`, 
        contentType === "VIDEO SCRIPT" ? ScriptType.VIDEO_SCRIPT : ScriptType.NARRATION, 
        "Professional", 
        language
      );
      setResult(refinedScript);
    } catch (err) {
      try {
        const script = await backendService.generateCreativeScript(
          fullBrief, 
          contentType === "VIDEO SCRIPT" ? ScriptType.VIDEO_SCRIPT : ScriptType.NARRATION, 
          "Professional", 
          language
        );
        setResult(script);
      } catch (innerErr: any) {
        console.error("Script generation failed:", innerErr);
        alert(innerErr.message || "Script generation failed. Please try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-8 animate-flutter-fade pb-20 max-w-2xl mx-auto w-full h-full overflow-hidden safe-area">
      {/* AppBar Header */}
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
          <h2 className="text-xl font-black tracking-tighter uppercase italic">Script Creator</h2>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-[2.5rem] p-8 md:p-12 bg-[#050505] border-[#111111] shadow-2xl overflow-y-auto custom-scrollbar">
        <div className="flex flex-col gap-6 items-start">
          
          {/* LANGUAGE DROPDOWN */}
          <div className="w-full">
            <InputLabel>LANGUAGE</InputLabel>
            <div className="relative group">
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#222222] text-white rounded-2xl px-5 py-4 font-bold text-sm focus:border-red-500/50 outline-none appearance-none cursor-pointer transition-all"
              >
                {LANGUAGES.map(lang => (
                  <option key={lang} value={lang}>{lang.toUpperCase()}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* CATEGORY DROPDOWN */}
          <div className="w-full">
            <InputLabel>CATEGORY</InputLabel>
            <div className="relative group">
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#222222] text-white rounded-2xl px-5 py-4 font-bold text-sm focus:border-red-500/50 outline-none appearance-none cursor-pointer transition-all"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* TOPIC DESCRIPTION */}
          <div className="w-full">
            <InputLabel>TOPIC DESCRIPTION</InputLabel>
            <textarea 
              value={topicDescription}
              onChange={(e) => setTopicDescription(e.target.value)}
              rows={3}
              placeholder="Ex: Why reading books daily is important for success..."
              className="w-full bg-[#0A0A0A] border border-[#222222] text-white rounded-2xl px-5 py-5 font-medium text-base focus:border-red-500/50 outline-none resize-none placeholder:text-[#222222] transition-all"
            />
          </div>

          {/* CONTENT TYPE TOGGLE (Indigo: #4f46e5) */}
          <div className="w-full">
            <InputLabel>CONTENT TYPE</InputLabel>
            <div className="flex -mx-1.5">
              <ToggleButton 
                title="TEXT BLOG" 
                selected={contentType === "TEXT BLOG"} 
                activeColor="#4f46e5"
                onTap={() => setContentType("TEXT BLOG")} 
              />
              <ToggleButton 
                title="VIDEO SCRIPT" 
                selected={contentType === "VIDEO SCRIPT"} 
                activeColor="#4f46e5"
                onTap={() => setContentType("VIDEO SCRIPT")} 
              />
            </div>
          </div>

          {/* CREATOR VOICE TOGGLE (DeepPurple: #673ab7 / Red: #ef4444) */}
          <div className="w-full">
            <InputLabel>CREATOR VOICE (PREVIEW AVAILABLE)</InputLabel>
            <div className="flex gap-3">
              {/* MALE OPTION */}
              <div className={`flex-1 flex items-center p-1.5 rounded-2xl border transition-all ${creatorVoice === "MALE" ? 'bg-[#111111] border-[#333]' : 'bg-[#0A0A0A] border-[#222222]'}`}>
                 <button
                    onClick={() => setCreatorVoice("MALE")}
                    className={`flex-1 py-3 rounded-xl font-bold text-[13px] text-center transition-all active:scale-95 ${
                        creatorVoice === "MALE" 
                        ? 'bg-[#673ab7] text-white shadow-lg' 
                        : 'text-[#666666] hover:text-[#888]'
                    }`}
                 >
                    MALE
                 </button>
                 <button 
                    onClick={() => handlePlayVoice('MALE')}
                    disabled={voiceLoading || (playingVoice !== null && playingVoice !== 'MALE')}
                    className={`w-10 h-10 ml-1.5 flex-shrink-0 flex items-center justify-center rounded-xl bg-[#1A1A1A] border border-[#252525] text-slate-400 hover:text-white transition-all active:scale-95 ${playingVoice === 'MALE' ? 'text-purple-400 border-purple-500/30' : ''}`}
                    title="Preview Male Voice"
                 >
                    {playingVoice === 'MALE' && voiceLoading ? (
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : playingVoice === 'MALE' ? (
                        <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    )}
                 </button>
              </div>

              {/* FEMALE OPTION */}
              <div className={`flex-1 flex items-center p-1.5 rounded-2xl border transition-all ${creatorVoice === "FEMALE" ? 'bg-[#111111] border-[#333]' : 'bg-[#0A0A0A] border-[#222222]'}`}>
                 <button
                    onClick={() => setCreatorVoice("FEMALE")}
                    className={`flex-1 py-3 rounded-xl font-bold text-[13px] text-center transition-all active:scale-95 ${
                        creatorVoice === "FEMALE" 
                        ? 'bg-[#ef4444] text-white shadow-lg' 
                        : 'text-[#666666] hover:text-[#888]'
                    }`}
                 >
                    FEMALE
                 </button>
                 <button 
                    onClick={() => handlePlayVoice('FEMALE')}
                    disabled={voiceLoading || (playingVoice !== null && playingVoice !== 'FEMALE')}
                    className={`w-10 h-10 ml-1.5 flex-shrink-0 flex items-center justify-center rounded-xl bg-[#1A1A1A] border border-[#252525] text-slate-400 hover:text-white transition-all active:scale-95 ${playingVoice === 'FEMALE' ? 'text-red-400 border-red-500/30' : ''}`}
                    title="Preview Female Voice"
                 >
                    {playingVoice === 'FEMALE' && voiceLoading ? (
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : playingVoice === 'FEMALE' ? (
                        <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    )}
                 </button>
              </div>
            </div>
          </div>

          {/* VISUAL ILLUSTRATION TOGGLE (Green: #22c55e / Grey: #64748b) */}
          <div className="w-full">
            <InputLabel>VISUAL ILLUSTRATION</InputLabel>
            <div className="flex -mx-1.5">
              <ToggleButton 
                title="WITH AI IMAGE" 
                selected={visualType === "WITH AI IMAGE"} 
                activeColor="#22c55e"
                onTap={() => setVisualType("WITH AI IMAGE")} 
              />
              <ToggleButton 
                title="TEXT ONLY" 
                selected={visualType === "TEXT ONLY"} 
                activeColor="#64748b"
                onTap={() => setVisualType("TEXT ONLY")} 
              />
            </div>
          </div>

          {/* MAIN GENERATE BUTTON */}
          <div className="pt-6 w-full">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !topicDescription.trim()}
              className="w-full py-5 bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-red-900/20 border-b-4 border-red-800 flex items-center justify-center gap-3"
            >
              {isGenerating ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>{contentType}</span>
              )}
            </button>
          </div>

          {/* OUTPUT PREVIEW */}
          {result && (
            <div className="mt-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-4 px-1">
                <InputLabel>DRAFT OUTPUT</InputLabel>
                <button 
                  onClick={() => onTransferToStudio(result)}
                  className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-400 flex items-center gap-2"
                >
                  Send to Studio 
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="glass-panel p-8 rounded-[2rem] border-slate-800 bg-slate-950/40 text-slate-300 font-medium whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto custom-scrollbar border">
                {result}
              </div>
            </div>
          )}

          {/* LOGIN FOR MORE */}
          <div className="pt-8 w-full">
            <button
              onClick={() => {}}
              className="w-full py-5 bg-green-600 hover:bg-green-500 text-white rounded-full font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-green-900/20 border-b-4 border-green-800"
            >
              Login for More
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ScriptGenerator;
