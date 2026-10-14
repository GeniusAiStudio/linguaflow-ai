const fs = require('fs');
let content = fs.readFileSync('components/AutoRecap.tsx', 'utf8');

const target1 = `            } catch (err) {
              addLog(\`Cloud transcription fallback warning: Empty transcript.\`);
              transcriptText = "";
            }`;

const replacement1 = `            } catch (err) {
              addLog(\`Transcription failed completely. Cannot proceed without context.\`);
              throw new Error("Failed to extract context from video. Please try a different video or provide a topic.");
            }`;

if (content.includes(target1)) {
  content = content.replaceAll(target1, replacement1);
  fs.writeFileSync('components/AutoRecap.tsx', content);
  console.log("Patched components/AutoRecap.tsx successfully");
} else {
  console.log("Could not find target in components/AutoRecap.tsx");
}
