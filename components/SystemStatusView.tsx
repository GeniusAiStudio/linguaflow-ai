
import React from 'react';

interface SystemStatusViewProps {
  onBack: () => void;
}

const SystemStatusView: React.FC<SystemStatusViewProps> = ({ onBack }) => {
  const metrics = [
    { label: "API Gateway", status: "Operational", color: "text-green-500", ping: "24ms" },
    { label: "Neural Engine", status: "Active", color: "text-blue-500", ping: "Load 12%" },
    { label: "Voice Synth", status: "Online", color: "text-purple-500", ping: "Ready" },
    { label: "Storage Core", status: "Healthy", color: "text-emerald-500", ping: "1.2GB Free" },
    { label: "Transcription", status: "Idle", color: "text-slate-400", ping: "Waiting" },
    { label: "Translation", status: "Operational", color: "text-green-500", ping: "45ms" },
  ];

  return (
    <div className="flex-1 flex flex-col gap-8 animate-flutter-fade bg-black h-full overflow-hidden">
      <div className="flex items-center gap-6 px-4">
        <button 
          onClick={onBack} 
          className="p-4 rounded-2xl bg-[#111111] border border-[#222222] text-white hover:bg-blue-600 hover:border-blue-500 transition-all active:scale-90 shadow-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-2xl font-black tracking-tighter uppercase italic">System Status</h2>
          <p className="text-[10px] font-black text-[#444444] uppercase tracking-[0.4em]">Infrastructure Health</p>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-[2.5rem] p-8 md:p-12 overflow-y-auto custom-scrollbar bg-[#050505] border-[#111111]">
        <div className="max-w-4xl mx-auto space-y-12">
          
          <div className="bg-[#111111] border border-[#222222] rounded-[2rem] p-8 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                   <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_#22c55e]" />
                </div>
                <div>
                   <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">All Systems Nominal</h3>
                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Uptime: 99.98%</p>
                </div>
             </div>
             <div className="text-right">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Server Region</p>
                <p className="text-lg font-bold text-white">Asia-Southeast1</p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {metrics.map((m, i) => (
                <div key={i} className="bg-[#0A0A0A] border border-[#1A1A1A] p-6 rounded-2xl flex items-center justify-between group hover:border-[#333] transition-colors">
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{m.label}</span>
                      <span className={`text-sm font-bold ${m.color} uppercase`}>{m.status}</span>
                   </div>
                   <span className="text-xs font-mono text-slate-600 bg-[#111111] px-3 py-1 rounded-lg border border-[#222222]">{m.ping}</span>
                </div>
             ))}
          </div>

          <div className="pt-8 text-center border-t border-[#111111]">
             <p className="text-[9px] font-black text-[#333] uppercase tracking-[0.5em]">Last Updated: Just Now</p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SystemStatusView;
