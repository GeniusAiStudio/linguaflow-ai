const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

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
    '                </div>\n' + desktopAd
);

fs.writeFileSync('App.tsx', code);
