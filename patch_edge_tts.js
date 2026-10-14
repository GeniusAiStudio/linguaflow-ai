const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const replacement = `
  app.get("/api/edge-tts", async (req, res) => {
    try {
      const { text, voice } = req.query;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Missing or invalid text" });
      }
      
      const voiceStr = (voice as string) || "my-MM-NilarNeural";
      const isEdgeVoice = voiceStr.includes("Neural") || voiceStr.startsWith("my-MM-") || voiceStr.startsWith("en-US-") || voiceStr.includes("-");
      
      let audioBuffer;
      
      if (isEdgeVoice) {
        audioBuffer = await edgeTts(text, { voice: voiceStr });
      } else {
        const myApiKey = process.env.MY_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!myApiKey) throw new Error("GEMINI_API_KEY missing");
        
        const { GoogleGenAI } = require("@google/genai");
        const ai = new GoogleGenAI({ apiKey: myApiKey });
        
        const ttsResponse = await ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text: text }] }],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceStr } }
            }
          }
        });
        
        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
          throw new Error("No audio returned from Gemini");
        }
        audioBuffer = Buffer.from(base64Audio, 'base64');
      }
      
      res.setHeader("Content-Type", "audio/mpeg");
      res.send(audioBuffer);
    } catch (err: any) {
      console.error("TTS GET error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/edge-tts", express.json(), async (req, res) => {
    try {
      const { text, voice } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Missing or invalid text" });
      }
      
      const voiceStr = (voice as string) || "my-MM-NilarNeural";
      const isEdgeVoice = voiceStr.includes("Neural") || voiceStr.startsWith("my-MM-") || voiceStr.startsWith("en-US-") || voiceStr.includes("-");
      
      let audioBuffer;
      
      if (isEdgeVoice) {
        audioBuffer = await edgeTts(text, { voice: voiceStr });
      } else {
        const myApiKey = process.env.MY_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!myApiKey) throw new Error("GEMINI_API_KEY missing");
        
        const { GoogleGenAI } = require("@google/genai");
        const ai = new GoogleGenAI({ apiKey: myApiKey });
        
        const ttsResponse = await ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text: text }] }],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceStr } }
            }
          }
        });
        
        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
          throw new Error("No audio returned from Gemini");
        }
        audioBuffer = Buffer.from(base64Audio, 'base64');
      }
      
      res.setHeader("Content-Type", "audio/mpeg");
      res.send(audioBuffer);
    } catch (err: any) {
      console.error("TTS POST error:", err);
      res.status(500).json({ error: err.message });
    }
  });
`;

code = code.replace(/app\.get\("\/api\/edge-tts"[\s\S]*?app\.post\("\/api\/edge-tts"[\s\S]*?\}\);/m, replacement.trim());
fs.writeFileSync('server.ts', code);
