const fs = require('fs');

let content = fs.readFileSync('components/AutoRecap.tsx', 'utf-8');

// Add imports
const imports = `import { storage } from '../services/firebase';
import { ref, uploadBytesResumable, getDownloadURL, uploadString } from 'firebase/storage';
`;
content = content.replace("import { ViewMode }", imports + "import { ViewMode }");

fs.writeFileSync('components/AutoRecap.tsx', content);
