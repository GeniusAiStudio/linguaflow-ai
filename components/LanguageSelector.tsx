
import React from 'react';
import { SUPPORTED_LANGUAGES, Language } from '../types';

interface LanguageSelectorProps {
  label: string;
  value: string;
  onChange: (code: string) => void;
  exclude?: string;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ label, value, onChange, exclude }) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</label>
      <div className="relative group">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-800/50 border border-slate-700 hover:border-blue-500/50 text-slate-100 rounded-xl px-4 py-3 appearance-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
        >
          {SUPPORTED_LANGUAGES.filter(l => l.code !== exclude).map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500 group-hover:text-blue-400 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default LanguageSelector;
