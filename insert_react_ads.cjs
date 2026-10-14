const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const componentCode = `
// Isolated Adsterra Ad Component
const AdsterraAd = ({ width, height, adKey }: { width: number, height: number, adKey: string }) => {
  const srcDoc = \`<!DOCTYPE html><html><head><style>body{margin:0;padding:0;overflow:hidden;background:transparent;display:flex;justify-content:center;align-items:center;}</style></head><body><script type="text/javascript">var atOptions = {'key' : '\${adKey}', 'format' : 'iframe', 'height' : \${height}, 'width' : \${width}, 'params' : {}};</script><script type="text/javascript" src="https://www.highperformanceformat.com/\${adKey}/invoke.js"></script></body></html>\`;
  return (
    <iframe
      srcDoc={srcDoc}
      width={width}
      height={height}
      frameBorder="0"
      scrolling="no"
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      style={{ border: 'none', overflow: 'hidden', width: \`\${width}px\`, height: \`\${height}px\` }}
    />
  );
};
`;

// Insert the component right above the App component
if (!code.includes('const AdsterraAd')) {
    code = code.replace(
        'const App = () => {',
        componentCode + '\nconst App = () => {'
    );
}

const desktopAd = `
                {/* DESKTOP AD BANNER */}
                <div className="mt-4 flex justify-center items-center w-full min-h-[250px] bg-[var(--element-bg)] rounded-xl overflow-hidden border border-[var(--border-color)] shrink-0">
                    <AdsterraAd width={300} height={250} adKey="2790948312e2d03dae525901dda0519e" />
                </div>
            </div>
        </aside>
`;

// Replace desktop ad
code = code.replace(
    '            </div>\n        </aside>',
    desktopAd
);

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
                    <AdsterraAd width={320} height={50} adKey="6eaca2407476410ebed3b745f10017d9" />
                </div>
            </div>
        )}
    </div>
  );
};
`;

// Clean up old mobile ad if it's there
if (code.includes('MOBILE STICKY AD')) {
    code = code.replace(/\{\/\* MOBILE STICKY AD \*\/\}[\s\S]*?<\/div>\n  \);\n};\n/, mobileAd);
} else {
    code = code.replace(
        '    </div>\n  );\n};\n',
        mobileAd
    );
}


fs.writeFileSync('App.tsx', code);
console.log('Ads component patched successfully.');
