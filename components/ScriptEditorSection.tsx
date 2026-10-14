
import React, { useState, useMemo } from 'react';
import { ScriptFormat } from '../types';
import { ScriptFormatter } from '../services/scriptFormatter';
import ScriptFormatSelector from './ScriptFormatSelector';
import TranslatedTextBox from './TranslatedTextBox';
import ExportButtons from './ExportButtons';

interface ScriptEditorSectionProps {
  rawText: string;
  onTextChange?: (newText: string) => void;
}

const ScriptEditorSection: React.FC<ScriptEditorSectionProps> = ({ rawText, onTextChange }) => {
  const [format, setFormat] = useState<ScriptFormat>(ScriptFormat.NARRATION);

  const formattedText = useMemo(() => {
    return ScriptFormatter.apply(rawText, format);
  }, [rawText, format]);

  return (
    <div className="flex flex-col items-end w-full h-full">
      <div className="w-full flex justify-between items-center">
        <ScriptFormatSelector
          selected={format}
          onChanged={setFormat}
        />
        <button
          onClick={() => {
            navigator.clipboard.writeText(formattedText);
            const el = document.getElementById("copy-toast-top");
            if(el) {
              el.style.opacity = "1";
              setTimeout(() => { el.style.opacity = "0"; }, 2000);
            }
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 hover:bg-slate-700 hover:text-white transition-all active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          Copy Full Text
        </button>
      </div>
      <div id="copy-toast-top" className="fixed top-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded shadow-lg font-bold text-sm transition-opacity duration-300 opacity-0 pointer-events-none z-50">
        Copied to clipboard!
      </div>
      
      <div className="mt-3 w-full flex-1 min-h-0">
        <TranslatedTextBox 
          translatedText={formattedText} 
          isMono={format !== ScriptFormat.NONE}
          editable={!!onTextChange}
          onTextChange={onTextChange}
        />
      </div>

      <div className="mt-2 w-full shrink-0">
        <ExportButtons text={formattedText} />
      </div>
    </div>
  );
};

export default ScriptEditorSection;
