import React from "react";

interface TranslatedTextBoxProps {
  translatedText: string;
  placeholder?: string;
  isMono?: boolean;
  editable?: boolean;
  onTextChange?: (text: string) => void;
}

const TranslatedTextBox: React.FC<TranslatedTextBoxProps> = ({
  translatedText,
  placeholder = "Translated text will appear here",
  isMono = false,
  editable = false,
  onTextChange,
}) => {
  // Simple bold parser for markdown-like syntax **text**
  const renderWithBold = (text: string) => {
    if (!text) return null;

    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={index} className="text-slate-900 font-black text-[15px]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return (
        <span key={index} className="text-slate-800">
          {part}
        </span>
      );
    });
  };

  return (
    <div className="bg-white h-full flex flex-col justify-between transition-all duration-500 animate-flutter-fade group overflow-hidden">
      {editable ? (
        <textarea
          value={translatedText}
          onChange={(e) => onTextChange && onTextChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          style={{
            fontFamily: "'Pyidaungsu', 'Noto Sans Myanmar', 'Padauk', 'Myanmar Text', sans-serif",
          }}
          className={`w-full h-full p-6 bg-transparent border-none outline-none resize-none focus:ring-0 text-slate-800 font-medium leading-[1.8] custom-scrollbar text-[15px] ${isMono ? "font-mono text-slate-700" : ""}`}
        />
      ) : (
        <div
          style={{
            fontFamily: "'Pyidaungsu', 'Noto Sans Myanmar', 'Padauk', 'Myanmar Text', sans-serif",
          }}
          className={`p-6 text-slate-800 font-medium text-[15px] leading-[1.8] select-text whitespace-pre-wrap h-full overflow-y-auto custom-scrollbar ${isMono ? "font-mono bg-slate-50 p-6 rounded-xl border border-slate-200 text-slate-700" : ""}`}
        >
          {translatedText.trim() === "" ? (
            <span className="text-slate-400 italic font-bold uppercase tracking-widest text-xs">
              Waiting for Production Input...
            </span>
          ) : (
            renderWithBold(translatedText)
          )}
        </div>
      )}
    </div>
  );
};

export default TranslatedTextBox;
