const fs = require('fs');

let code = fs.readFileSync('App.tsx', 'utf8');

// Find the broken section:
//         `}} />
//                                                     </div>
//                 <div className="bg-[#0A0A0A] rounded-2xl border border-[#222222] overflow-hidden">

const brokenStart = code.indexOf('\n        `}} />\n');
const brokenEnd = code.indexOf('                <div className="bg-[#0A0A0A] rounded-2xl border border-[#222222] overflow-hidden">');

if (brokenStart !== -1 && brokenEnd !== -1) {
    const desktopSidebar = `        \`}} />
        
        <aside className="w-64 bg-[var(--sidebar-bg)] border-r border-[var(--border-color)] hidden lg:flex flex-col overflow-y-auto custom-scrollbar pr-4 py-2 gap-2 shrink-0 transition-colors duration-300 rounded-3xl">
            <div className="p-4 mb-1 flex items-center gap-3">
               <div className="w-10 h-10 flex-shrink-0">
                 <img 
                   src="https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Genius" 
                   alt="GeniusAI Logo" 
                   className="w-full h-full rounded-xl shadow-lg bg-black border border-blue-900/30" 
                 />
               </div>
               <h1 className="font-black text-lg tracking-tighter italic text-[var(--text-main)]">
                 GeniusAi<span className="text-amber-500">Studio</span>
               </h1>
            </div>

            {/* Clickable Theme Switcher */}
            <div className="px-4 mb-3 select-none">
              <div className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 px-1">
                Theme
              </div>
              <div 
                id="theme-toggle-btn"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={\`flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 cursor-pointer \${
                  isDarkMode 
                    ? 'bg-[#000000] border-[#222222] hover:bg-[#07070a]' 
                    : 'bg-[#f8fafc]/50 border-slate-200/80 hover:bg-[#f1f5f9]'
                }\`}
              >
                <div className="flex items-center gap-2.5">
                  {!isDarkMode ? (
                    <div className="w-5 h-5 flex items-center justify-center bg-amber-500/10 text-amber-500 rounded-lg">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="4" />
                        <line x1="12" y1="2" x2="12" y2="4" />
                        <line x1="12" y1="20" x2="12" y2="22" />
                        <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
                        <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
                        <line x1="2" y1="12" x2="4" y2="12" />
                        <line x1="20" y1="12" x2="22" y2="12" />
                        <line x1="6.34" y1="17.66" x2="4.93" y2="19.07" />
                        <line x1="19.07" y1="4.93" x2="17.66" y2="6.34" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-5 h-5 flex items-center justify-center bg-blue-500/10 text-blue-400 rounded-lg">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                      </svg>
                    </div>
                  )}
                  <span className={\`text-[10px] font-black uppercase tracking-wider \${
                    isDarkMode ? 'text-slate-400' : 'text-slate-700'
                  }\`}>
                    {isDarkMode ? 'Dark Mode' : 'Light Mode'}
                  </span>
                </div>
                
                <div className={\`w-10 h-5 rounded-full p-0.5 transition-colors duration-300 flex items-center \${
                  isDarkMode ? 'bg-blue-600' : 'bg-slate-300'
                }\`}>
                  <div className={\`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 \${
                    isDarkMode ? 'translate-x-5' : 'translate-x-0'
                  }\`} />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 flex-1 pr-2">
                {sidebarItems.map((item, index) => (
                    <SidebarItem 
                        key={index}
                        icon={item.icon}
                        label={item.label}
                        active={item.active}
                        onClick={item.action}
                    />
                ))}
            </div>

            <div className="mt-auto pt-8 opacity-90 transition-opacity">
                {/* PRO UPGRADE BUTTON */}
                <div className="mb-4 px-2">
                    <button
                        onClick={() => setViewMode(ViewMode.PREMIUM)}
                        className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] active:scale-95 border-b-2 border-amber-700 flex items-center justify-center gap-2 group"
                    >
                        <svg className="w-3.5 h-3.5 group-hover:scale-125 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        Upgrade Pro
                    </button>
                    <a
                        href="https://www.effectivecpmnetwork.com/zbftex2i7?key=5bbf5f6d414b62f1653cc6e529e8edc1"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full mt-3 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 border-b-2 border-emerald-700 flex items-center justify-center gap-2 group"
                    >
                        <svg className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                        </svg>
                        Earn Free Credits
                    </a>
                </div>
                
`;

    code = code.substring(0, brokenStart) + desktopSidebar + code.substring(brokenEnd);
    
    // Now also insert into mobile drawer
    const mobileAnchor = `                    <button
                        onClick={() => {
                            setViewMode(ViewMode.PREMIUM);
                            setIsMobileDrawerOpen(false);
                        }}
                        className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] flex items-center justify-center gap-2"
                    >
                        Upgrade Pro
                    </button>`;
                    
    const mobileAdBtn = `                    <a
                        href="https://www.effectivecpmnetwork.com/zbftex2i7?key=5bbf5f6d414b62f1653cc6e529e8edc1"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full mt-2 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                        </svg>
                        Earn Free Credits
                    </a>`;
                    
    code = code.replace(mobileAnchor, mobileAnchor + '\n' + mobileAdBtn);
    
    fs.writeFileSync('App.tsx', code);
    console.log('Fixed sidebar and inserted both buttons safely.');
} else {
    console.log('Failed to find injection points');
}
