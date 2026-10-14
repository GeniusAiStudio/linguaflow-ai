const fs = require('fs');

let code = fs.readFileSync('App.tsx', 'utf8');

// 1. Add State
if (!code.includes('const [isMobileAdVisible, setIsMobileAdVisible] = useState(true);')) {
    code = code.replace(
        'const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.HOME);',
        'const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.HOME);\n  const [isMobileAdVisible, setIsMobileAdVisible] = useState(true);'
    );
}

// 2. Desktop Ad
const desktopAd = `
                {/* DESKTOP AD BANNER */}
                <div className="mt-4 flex justify-center items-center w-full min-h-[250px] bg-[var(--element-bg)] rounded-xl overflow-hidden border border-[var(--border-color)]">
                    <iframe src="/ad-desktop.html" width="300" height="250" frameBorder="0" scrolling="no" className="border-none" />
                </div>
            </div>
        </aside>
`;

code = code.replace(
    '                </div>\n            </div>\n        </aside>',
    '                </div>' + desktopAd
);

// 3. Mobile Ad + padding to main wrapper
// Find the outer main div returned at the end.
// We can just inject it right before the last closing </div> of the main return
const mobileAd = `
        {/* MOBILE STICKY AD */}
        {isMobileAdVisible && (
            <div className="fixed bottom-0 left-0 w-full z-[100] bg-[var(--sidebar-bg)] border-t border-[var(--border-color)] flex flex-col items-center justify-center lg:hidden shadow-[0_-5px_20px_rgba(0,0,0,0.8)] pb-safe">
                <button 
                    onClick={() => setIsMobileAdVisible(false)}
                    className="absolute -top-7 right-2 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-t-lg px-3 py-1 flex items-center justify-center text-xs font-bold text-slate-400 hover:text-[var(--text-main)] shadow-lg"
                >
                    Close (X)
                </button>
                <div className="w-full flex justify-center py-1 overflow-hidden">
                    <iframe src="/ad-mobile.html" width="320" height="50" frameBorder="0" scrolling="no" className="border-none" />
                </div>
            </div>
        )}
    </div>
  );
};
`;

code = code.replace(
    '    </div>\n  );\n};\n',
    mobileAd
);

fs.writeFileSync('App.tsx', code);
console.log('Ads logic patched.');
