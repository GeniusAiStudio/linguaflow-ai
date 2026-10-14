const fs = require('fs');

let code = fs.readFileSync('App.tsx', 'utf8');

const target1 = `                    <a
                        href="https://www.effectivecpmnetwork.com/zbftex2i7?key=5bbf5f6d414b62f1653cc6e529e8edc1"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full mt-3 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 border-b-2 border-emerald-700 flex items-center justify-center gap-2 group"
                    >
                        <svg className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                        </svg>
                        Earn Free Credits
                    </a>`;

const target2 = `                    <a
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

code = code.replace(target1, '');
code = code.replace(target2, '');
code = code.replace(/\n\n+/g, '\n\n'); // Optional cleanup of multiple newlines

fs.writeFileSync('App.tsx', code);
console.log('Ads removed successfully.');
