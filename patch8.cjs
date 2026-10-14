const fs = require('fs');
let content = fs.readFileSync('components/AutoRecap.tsx', 'utf8');

content = content.replace(
  `{step === ProcessingStep.COMPLETED
                          ? "DONE"
                          : step === ProcessingStep.SCRIPTING
                            ? "WRITING"
                            : step === ProcessingStep.VOICEOVER
                              ? "VOICING"
                              : "RENDERING"}`,
  `{step === ProcessingStep.SCRIPTING
                            ? "WRITING"
                            : step === ProcessingStep.VOICEOVER
                              ? "VOICING"
                              : "RENDERING"}`
);

content = content.replace(
  `{step !== ProcessingStep.COMPLETED && (
                        <div className="flex items-center gap-1.5 opacity-50 px-3 border-l border-white/10">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-[10px] tracking-widest">{formatTime(timeElapsed)}</span>
                        </div>
                      )}`,
  `<div className="flex items-center gap-1.5 opacity-50 px-3 border-l border-white/10">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-[10px] tracking-widest">{formatTime(timeElapsed)}</span>
                        </div>`
);

content = content.replace(
  `{step !== ProcessingStep.COMPLETED && (
                    <div className="mt-4 flex justify-end">
                      <button onClick={abortProduction} className="text-[10px] text-slate-500 hover:text-white uppercase tracking-widest transition-colors font-bold flex items-center gap-2">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        Abort
                      </button>
                    </div>
                  )}`,
  `<div className="mt-4 flex justify-end">
                      <button onClick={abortProduction} className="text-[10px] text-slate-500 hover:text-white uppercase tracking-widest transition-colors font-bold flex items-center gap-2">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        Abort
                      </button>
                    </div>`
);


fs.writeFileSync('components/AutoRecap.tsx', content);
console.log("Patched AutoRecap.tsx completely successfully");
