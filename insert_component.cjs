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

code = code.replace(
    'const App: React.FC = () => {',
    componentCode + '\nconst App: React.FC = () => {'
);

fs.writeFileSync('App.tsx', code);
console.log('Component inserted');
