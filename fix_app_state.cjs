const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

if (!code.includes('isMobileAdVisible')) {
    code = code.replace(
        'const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.HOME);',
        'const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.HOME);\n  const [isMobileAdVisible, setIsMobileAdVisible] = useState(true);'
    );
}

// Add padding to bottom for mobile
code = code.replace(
    'min-h-[100dvh] text-slate-200">',
    'min-h-[100dvh] text-slate-200 pb-[80px] lg:pb-4">'
);

fs.writeFileSync('App.tsx', code);
