
import React from 'react';
import { ScriptFormat } from '../types';

interface ScriptFormatSelectorProps {
  selected: ScriptFormat;
  onChanged: (format: ScriptFormat) => void;
}

const ScriptFormatSelector: React.FC<ScriptFormatSelectorProps> = ({ selected, onChanged }) => {
  const FormatButton = ({ label, format, icon }: { label: string; format: ScriptFormat; icon: React.ReactNode }) => {
    const active = selected === format;
    return (
      <button
        onClick={() => onChanged(format)}
        className={`px-4 py-2 rounded-[8px] transition-all duration-300 text-[13px] font-semibold flex items-center gap-2 active:scale-95 shadow-sm border ${
          active 
            ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/20 scale-100' 
            : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200 scale-95 opacity-70 hover:opacity-100'
        }`}
      >
        <span className={`${active ? 'scale-110' : 'opacity-60'} transition-transform`}>{icon}</span>
        {label}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-2 bg-slate-950/30 p-1.5 rounded-xl border border-slate-800/40 w-fit">
      <FormatButton 
        label="Dialogue" 
        format={ScriptFormat.DIALOGUE} 
        icon={<span>🗣</span>}
      />
      <FormatButton 
        label="Narration" 
        format={ScriptFormat.NARRATION} 
        icon={<span>🎙</span>}
      />
      
      <div className="w-px h-4 bg-slate-800 mx-1" />
      
      <button 
        onClick={() => onChanged(ScriptFormat.NONE)}
        className={`p-2 rounded-lg transition-colors group ${selected === ScriptFormat.NONE ? 'text-blue-400' : 'text-slate-600 hover:text-slate-400'}`}
        title="Plain Text"
      >
        <svg className={`w-4 h-4 ${selected === ScriptFormat.NONE ? 'opacity-100' : 'opacity-40'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h7" />
        </svg>
      </button>
    </div>
  );
};

export default ScriptFormatSelector;
