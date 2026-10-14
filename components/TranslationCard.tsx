
import React, { useState } from 'react';
import { TranslationEntry, SUPPORTED_LANGUAGES } from '../types';
import { geminiService } from '../services/geminiService';
import { exportService } from '../services/exportService';
import ScriptEditorSection from './ScriptEditorSection';

interface TranslationCardProps {
  entry: TranslationEntry;
  onCopy?: (msg?: string) => void;
}

const TranslationCard: React.FC<TranslationCardProps> = ({ entry, onCopy }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: true
  });

  const getLangFlag = (code: string) => SUPPORTED_LANGUAGES.find(l => l.code === code)?.flag || '';

  const playTranslation = async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      const audioBuffer = await geminiService.generateSpeech(entry.translatedText);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setIsPlaying(false);
      source.start();
    } catch (err) {
      console.error("TTS Failed", err);
      setIsPlaying(false);
    }
  };

  const copyText = async () => {
    if (!entry.translatedText.trim()) return;
    try {
      await navigator.clipboard.writeText(entry.translatedText);
      if (onCopy) onCopy();
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const handleShare = async () => {
    const success = await exportService.shareContent(
      `LinguaFlow Translation (${entry.targetLang.toUpperCase()})`,
      entry.translatedText
    );
    if (!success) copyText();
  };

  const copyLabel = entry.targetLang === 'my' ? 'copy ကူးရန်' : 'Copy';

  return (
    <div className="glass-panel p-5 rounded-2xl group transition-all duration-300 hover:scale-[1.01] hover:border-blue-500/30 shadow-2xl">
      {/* Card Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <span className="text-sm">{getLangFlag(entry.sourceLang)}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{entry.sourceLang}</span>
          </div>
          <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7-7 7" />
          </svg>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-900/20 border border-blue-500/20">
            <span className="text-sm">{getLangFlag(entry.targetLang)}</span>
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">{entry.targetLang}</span>
          </div>
          {entry.tone && (
            <div className="ml-2 px-2 py-0.5 rounded bg-slate-800/40 border border-slate-700/30 text-[8px] font-black text-slate-500 uppercase tracking-widest">
              {entry.tone}
            </div>
          )}
        </div>
        <span className="text-[10px] text-slate-500 mono font-medium">
          {timeFormatter.format(new Date(entry.timestamp))}
        </span>
      </div>

      <div className="space-y-4">
        {/* Source Text Context */}
        <p className="text-slate-400 text-sm leading-relaxed border-l-2 border-slate-700 pl-4 py-1 italic">
          {entry.originalText}
        </p>

        {/* Script Editor Section - Replaces manual layout to match Flutter Column structure */}
        <div className="flex flex-col gap-2">
          <ScriptEditorSection rawText={entry.translatedText} />
          
          {/* Persistent Action Row (TTS, Share, Quick Copy) */}
          <div className="flex items-center justify-end gap-3 px-1">
             <button
                onClick={playTranslation}
                disabled={isPlaying || !entry.translatedText.trim()}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  isPlaying ? 'bg-blue-500 text-white animate-pulse' : 'text-slate-500 hover:text-blue-400 disabled:opacity-20'
                }`}
                title="Play Audio"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button
                onClick={handleShare}
                disabled={!entry.translatedText.trim()}
                className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-blue-400 transition-all disabled:opacity-20"
                title="Share"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
              <button
                onClick={copyText}
                disabled={!entry.translatedText.trim()}
                className="text-[12px] font-bold text-blue-500 hover:text-blue-400 px-2 py-1 rounded transition-all disabled:opacity-20 uppercase tracking-tighter"
              >
                {copyLabel}
              </button>
          </div>
        </div>
      </div>
      
      {/* Footer Meta */}
      <div className="mt-3 pt-3 border-t border-slate-800/50 flex items-center justify-between text-[9px] font-black text-slate-700 uppercase tracking-widest px-1">
        <span>Hub: {entry.translationProvider}</span>
        <span className="mono">ID: {entry.id}</span>
      </div>
    </div>
  );
};

export default TranslationCard;
