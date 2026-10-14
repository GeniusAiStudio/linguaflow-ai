const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');

const transcribeCode = `
  app.post("/api/gemini-transcribe-video", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const apiKey = process.env.MY_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "MANDATORY_GEMINI_API_KEY_MISSING" });
      }
      
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      
      console.log("[Transcribe] Uploading to Gemini File API...", req.file.path);
      const uploadResult = await ai.files.upload({
        file: req.file.path,
        mimeType: req.file.mimetype,
      });
      
      console.log("[Transcribe] File uploaded. URI:", uploadResult.uri);
      
      // Wait for processing
      let file = await ai.files.get({ name: uploadResult.name });
      while (file.state === "PROCESSING") {
        console.log("[Transcribe] Waiting for processing...");
        await new Promise((resolve) => setTimeout(resolve, 3000));
        file = await ai.files.get({ name: uploadResult.name });
      }
      
      if (file.state === "FAILED") {
        throw new Error("Gemini File API processing failed.");
      }
      
      console.log("[Transcribe] Generating transcript...");
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            fileData: {
              fileUri: uploadResult.uri,
              mimeType: uploadResult.mimeType
            }
          },
          {
            text: "Transcribe all speech with timestamps and speaker names. ALSO provide a highly detailed scene-by-scene description of all visual actions, events, characters, and on-screen text. Return a comprehensive chronological log in clear text."
          }
        ],
        config: { temperature: 0.1 }
      });
      
      console.log("[Transcribe] Done.");
      res.json({ text: response.text });
      
    } catch (err) {
      console.error("[Transcribe Error]:", err);
      res.status(500).json({ error: err.message });
    }
  });

`;

const target = '  app.post("/api/gemini-generate"';
if (content.includes(target)) {
  const newContent = content.replace(target, transcribeCode + target);
  fs.writeFileSync('server.ts', newContent);
  console.log("Patched server.ts successfully");
} else {
  console.log("Could not find target in server.ts");
}
