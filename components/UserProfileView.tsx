
import React from 'react';
import { UserProfile, ViewMode, SUPPORTED_LANGUAGES } from '../types';

interface UserProfileViewProps {
  user: UserProfile;
  onLogout: () => void;
  onNavigate: (mode: ViewMode) => void;
  onUpdateProfile?: (updates: Partial<UserProfile>) => void;
}

const UserProfileView: React.FC<UserProfileViewProps> = ({ user, onLogout, onNavigate, onUpdateProfile }) => {


  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 flex flex-col gap-6 md:gap-8 animate-in fade-in slide-in-from-right-8 duration-700">
      {/* Quick Access Workspace Navigation Badge for mobile */}
      <div className="flex lg:hidden justify-end">
        <button 
          onClick={() => onNavigate(ViewMode.HOME)}
          className="px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 border border-blue-500/15"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
          </svg>
          Go to Creator Tools
        </button>
      </div>

      <div className="glass-panel p-6 md:p-10 rounded-3xl md:rounded-[2.5rem] border-slate-800 shadow-2xl flex flex-col md:flex-row gap-6 md:gap-12 items-center">
        <div className="w-32 h-32 md:w-48 md:h-48 rounded-[2rem] md:rounded-[3rem] bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-4xl md:text-6xl font-black shadow-2xl border-4 border-slate-900 shrink-0">
          {user.name[0]}
        </div>
        
        <div className="flex-1 space-y-6 text-center md:text-left">
          <div className="space-y-2">
            <div className="flex flex-col md:flex-row items-center gap-3 justify-center md:justify-start">
              <h2 className="text-2xl md:text-4xl font-black tracking-tighter">{user.name}</h2>
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest rounded-lg border border-blue-500/30">{user.tier} ACCOUNT</span>
            </div>
            <p className="text-slate-500 font-medium text-base md:text-lg">{user.email}</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/50 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-800">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Status</span>
              <span className="text-sm font-bold text-green-500">Active</span>
            </div>
            <div className="bg-slate-900/50 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-800">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Region</span>
              <span className="text-sm font-bold text-slate-300">Myanmar</span>
            </div>
            {/* Added Credit Balance Card */}
            <div className="bg-slate-900/50 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-800">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Credit Balance</span>
              <span className="text-sm font-bold text-amber-500">{user.credits} CR</span>
            </div>
          </div>

          <div className="pt-2 flex md:hidden justify-center">
            <button 
              onClick={() => onNavigate(ViewMode.HOME)}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 active:scale-95 border border-blue-500/30"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Access Main Creator Tools
            </button>
          </div>
        </div>
      </div>

      {/* System Preferences Section */}
      <div className="glass-panel rounded-[2rem] border-slate-800 p-8 space-y-6">
         <h3 className="text-sm font-black text-white uppercase tracking-widest border-b border-slate-800 pb-4">System Preferences</h3>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
               <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Interface Language</label>
               <div className="relative group">
                  <select
                    value={user.preferredLanguage || 'my'}
                    onChange={(e) => onUpdateProfile && onUpdateProfile({ preferredLanguage: e.target.value })}
                    className="w-full bg-[#0A0A0A] border border-[#222222] text-white rounded-2xl px-5 py-4 font-bold text-sm focus:border-blue-500 outline-none appearance-none cursor-pointer transition-all hover:border-slate-700"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-slate-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </div>
               </div>
               <p className="text-[10px] text-slate-500 font-medium px-1">Sets the default output language for translation tasks.</p>
            </div>
         </div>
      </div>



      <button onClick={onLogout} className="w-full py-5 text-red-500 font-black text-xs uppercase tracking-[0.3em] hover:bg-red-500/10 rounded-2xl transition-all border border-transparent hover:border-red-500/20">Deactivate Current Session</button>
    </div>
  );
};

export default UserProfileView;
