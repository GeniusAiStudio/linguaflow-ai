
import React, { useMemo, useState } from 'react';
import { exportService } from '../services/exportService';
import { SrtGenerator } from '../services/srtGenerator';
import { SrtExportService } from '../services/srtExportService';
import { geminiService } from '../services/geminiService';
import { audioBufferToWav, downloadAudio } from '../services/audioUtils';

interface ExportButtonsProps {
  text: string;
}

const ExportButtons: React.FC<ExportButtonsProps> = ({ text }) => {
  const [isAudioGenerating, setIsAudioGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastAudioBlob, setLastAudioBlob] = useState<Blob | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const isSrtAlready = useMemo(() => {
    return /(\d{2}:\d{2}:\d{2},\d{3})\s-->\s(\d{2}:\d{2}:\d{2},\d{3})/.test(text);
  }, [text]);

  if (!text.trim()) return null;

  const handleExport = async (type: 'txt' | 'docx') => {
    const fileName = 'subtitle';
    if (type === 'txt') {
      exportService.exportAsTxt(text, fileName);
    } else {
      exportService.exportAsDocx(text, fileName);
    }
  };

  const handleCopy = async () => {
    const success = await exportService.copyToClipboard(text);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } else {
      console.error("Clipboard copy failed");
    }
  };

  const handleAudioGeneration = async () => {
    if (isAudioGenerating || isPlaying) return;
    setIsAudioGenerating(true);
    setLastAudioBlob(null);
    try {
      const cleanText = isSrtAlready 
        ? text.replace(/\d+\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\n/g, '') 
        : text;

      const audioBuffer = await geminiService.generateSpeech(cleanText);
      const wavBlob = audioBufferToWav(audioBuffer);
      setLastAudioBlob(wavBlob);

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        setIsPlaying(false);
        setIsAudioGenerating(false);
      };
      setIsPlaying(true);
      source.start();
    } catch (err) {
      console.error("Audio generation failed", err);
      setIsAudioGenerating(false);
    }
  };

  const handleDownloadAudio = () => {
    if (!lastAudioBlob) return;
    downloadAudio(lastAudioBlob, `voice_over_${Date.now()}.wav`);
  };

  const handleAutoSrt = async () => {
    const fileName = 'subtitle_output';
    const srtContent = isSrtAlready ? text : SrtGenerator.generate(text);
    await SrtExportService.export(fileName, srtContent);
    
    if (navigator.share) {
      try {
        const file = new File([srtContent], `${fileName}.srt`, { type: 'text/plain' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'SRT Export',
            text: 'Subtitle file from LinguaFlow',
          });
        }
      } catch (err) {
        console.log("Sharing cancelled", err);
      }
    }
  };

  const ActionButton = ({ 
    label, 
    onClick, 
    icon, 
    disabled = false,
    className = ""
  }: { 
    label: string; 
    onClick: () => void; 
    icon: React.ReactNode;
    disabled?: boolean;
    className?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 border border-blue-500/30 bg-slate-900/40 text-blue-400/80 rounded-[6px] transition-all active:scale-95 group shadow-sm hover:bg-blue-500/10 hover:border-blue-500/60 hover:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      <span className="text-blue-400/70 group-hover:text-blue-400 transition-transform group-hover:scale-110">
        {icon}
      </span>
      <span className="text-[13px] font-medium tracking-tight whitespace-nowrap">
        {label}
      </span>
    </button>
  );

  return (
    <div className="flex items-center justify-end gap-2 select-none flex-wrap">
      
      {/* Full Copy Button */}
      <button
        onClick={handleCopy}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] transition-all active:scale-95 border ${isCopied ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'}`}
      >
        <span className={isCopied ? "text-green-400" : "text-slate-400"}>
          {isCopied ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
        </span>
        <span className="text-[13px] font-bold tracking-tight whitespace-nowrap">
          {isCopied ? "Copied" : "Full Copy Script"}
        </span>
      </button>

      <div className="h-4 w-px bg-slate-700 mx-1" />

      <div className="flex items-center gap-1">
        <ActionButton
          label={isAudioGenerating ? "Generating..." : isPlaying ? "Playing" : "Listen"}
          onClick={handleAudioGeneration}
          disabled={isAudioGenerating || isPlaying}
          className={isPlaying ? "bg-blue-600/20 border-blue-400 text-blue-300" : ""}
          icon={
            isAudioGenerating ? (
              <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
               <div className="flex gap-0.5 items-end h-3">
                  <div className="w-1 bg-blue-400 animate-[bounce_0.6s_infinite]" />
                  <div className="w-1 bg-blue-400 animate-[bounce_0.8s_infinite]" />
                  <div className="w-1 bg-blue-400 animate-[bounce_0.5s_infinite]" />
               </div>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )
          }
        />
        {lastAudioBlob && (
          <ActionButton 
            label="Download"
            onClick={handleDownloadAudio}
            className="bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/40"
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            }
          />
        )}
      </div>

      <ActionButton
        label="TXT"
        onClick={() => handleExport('txt')}
        icon={
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
      />
      <ActionButton
        label="DOC"
        onClick={() => handleExport('docx')}
        icon={
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        }
      />

      <button
        onClick={handleAutoSrt}
        className="flex items-center gap-1.5 px-3 py-2 bg-[#673AB7] hover:bg-[#5E35B1] text-white rounded-[6px] transition-all active:scale-95 shadow-lg shadow-purple-900/20"
      >
        <span className="text-white/80">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </span>
        <span className="text-[13px] font-semibold tracking-tight whitespace-nowrap">
          {isSrtAlready ? 'Download SRT' : 'Auto SRT'}
        </span>
      </button>
    </div>
  );
};

export default ExportButtons;
