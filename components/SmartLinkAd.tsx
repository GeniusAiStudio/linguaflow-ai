import React from 'react';

interface SmartLinkAdProps {
  url: string;
  title?: string;
  description?: string;
  buttonText?: string;
}

const SmartLinkAd: React.FC<SmartLinkAdProps> = ({ 
  url, 
  title = "Support Our Platform", 
  description = "Check out our sponsor to help us keep this service running!", 
  buttonText = "Visit Sponsor" 
}) => {
  return (
    <div className="w-full bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 border border-blue-500/30">
          <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <h4 className="text-sm font-black text-white uppercase tracking-widest">{title}</h4>
          <p className="text-xs font-medium text-slate-400 mt-1">{description}</p>
        </div>
      </div>
      <a 
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full md:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-900/20 transition-all border-b-4 border-blue-800 text-center"
      >
        {buttonText}
      </a>
    </div>
  );
};

export default SmartLinkAd;
