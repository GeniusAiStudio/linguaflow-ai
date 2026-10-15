import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { GlobalWorkerOptions, version } from 'pdfjs-dist/legacy/build/pdf.mjs';
if (typeof window !== 'undefined') {
  GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/legacy/build/pdf.worker.min.mjs`;
}


import { GoogleGenAI, Modality, ThinkingLevel, Type } from "@google/genai";
import { decode, decodeAudioData, encode } from "./audioUtils";
import { TranslationTone, ScriptType } from "../types";
import {
  isZawgyi,
  repairAndNormalizeMyanmarText,
  convertZawgyiToUnicodeWithGemini,
  runMyanmarIntegrityCheck,
  insertZeroWidthSpaces,
  correctCombiningMarksOrder,
  fixMyanmarPdfTextSpaces,
} from "./myanmarUnicodeUtils";

export interface PdfExtractionResult {
  text: string;
  type: "digital" | "scanned";
  confidence: number;
  script: string;
  pageCount: number;
  wordCount: number;
}

export class GeminiService {
  private getApiKey(): string {
    // SECURITY: this must only ever run on the server (Node). The frontend
    // bundle must never contain an API key — browser code talks to Gemini
    // through the /api/gemini-generate backend proxy instead.
    if (typeof window !== "undefined") {
      throw new Error(
        "SECURITY: getApiKey() called in the browser. API keys are server-side only."
      );
    }
    const geminiKey = process.env.GEMINI_API_KEY;
    const myKey = process.env.MY_GEMINI_API_KEY;
    const apiKey = (geminiKey && geminiKey.startsWith("AIzaSy"))
      ? geminiKey
      : (myKey && myKey.startsWith("AIzaSy"))
      ? myKey
      : (!geminiKey?.startsWith("AQ.") && geminiKey)
      ? geminiKey
      : (!myKey?.startsWith("AQ.") && myKey)
      ? myKey
      : (geminiKey || myKey || "");

    if (!apiKey) {
      const errMsg = "MANDATORY_GEMINI_API_KEY_MISSING: The required GEMINI_API_KEY environment variable is missing. Fallbacks are disabled.";
      console.error("GeminiService ERROR: " + errMsg);
      throw new Error(errMsg);
    }
    return apiKey;
  }

  private getAI(): any {
    if (typeof window !== "undefined") {
      return {
        models: {
          generateContent: async (options: any) => {
            const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
            const response = await fetch(`${baseUrl}/api/gemini-generate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(options)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to call the Gemini API.");
            return data;
          }
        }
      };
    }
    const apiKey = this.getApiKey();
    console.log("GeminiService: Initializing client with paid GEMINI_API_KEY (length:", apiKey.length, ")");
    return new GoogleGenAI({ apiKey });
  }

  private async generateContentAutoContinue(
    ai: any,
    requestOptions: any
  ): Promise<any> {
    let fullText = "";
    let isDone = false;
    let safetyCounter = 0;
    
    const reqOptions = { ...requestOptions };
    
    let currentContents: any[] = [];
    if (typeof reqOptions.contents === "string") {
      currentContents = [{ role: "user", parts: [{ text: reqOptions.contents }] }];
    } else if (Array.isArray(reqOptions.contents)) {
      if (reqOptions.contents.length > 0) {
        const first = reqOptions.contents[0];
        if (first.role) {
          currentContents = [...reqOptions.contents];
        } else if (first.parts) {
          currentContents = reqOptions.contents.map((c: any) => ({
            role: c.role || "user",
            parts: c.parts,
          }));
        } else {
          currentContents = [{ role: "user", parts: [...reqOptions.contents] }];
        }
      } else {
        currentContents = [];
      }
    } else if (reqOptions.contents?.parts) {
      currentContents = [{ role: reqOptions.contents.role || "user", parts: [...reqOptions.contents.parts] }];
    } else if (reqOptions.contents) {
      currentContents = [reqOptions.contents];
    }
    
    reqOptions.contents = currentContents;
    let lastResponse: any = null;

    while (!isDone && safetyCounter < 10) {
      safetyCounter++;
      let response: any;
      let retryCount = 0;
      while (retryCount < 3) {
        try {
          response = await ai.models.generateContent(reqOptions);
          break;
        } catch (err: any) {
          retryCount++;
          const isDemandSpike = err?.message?.includes("503") || err?.message?.includes("high demand") || err?.message?.includes("UNAVAILABLE") || err?.status === 503 || err?.code === 503;
          const is404 = err?.message?.includes("404") || err?.message?.includes("not found");
          if ((isDemandSpike || is404) && reqOptions.model !== "gemini-flash-lite-latest") {
            console.warn(`[GeminiService Fallback] Model ${reqOptions.model} error. Retrying with gemini-flash-lite-latest...`);
            reqOptions.model = "gemini-flash-lite-latest";
            continue;
          }
          if (retryCount < 3 && isDemandSpike) {
            console.warn(`[GeminiService Fallback] 503 spike, retrying in 1.5s (attempt ${retryCount}/3)...`);
            await new Promise(r => setTimeout(r, 1500));
            continue;
          }
          throw err;
        }
      }
      lastResponse = response;
      
      let text = response.text || "";
      
      if (safetyCounter > 1) {
        text = text.replace(/^(Here is the continuation|Continuing|Continuing from where I left off)[\s\S]*?:\s*/i, "");
        if (fullText.length > 0 && /[\u1000-\u109F]/.test(fullText.slice(-1))) {
           text = text.replace(/^\s+/, "");
        }
      }
      text = text.replace(/\uFFFD/g, "");
      
      fullText = (fullText + text).normalize("NFC");
      
      const finishReason = response.candidates?.[0]?.finishReason;
      
      if (finishReason === "MAX_TOKENS" || finishReason === 2) {
         console.log(`Max tokens reached (Chunk ${safetyCounter}). Engaging auto-continuation loop...`);
         
         if (reqOptions.config) {
            reqOptions.config = { ...reqOptions.config };
            delete reqOptions.config.responseMimeType;
            delete reqOptions.config.responseSchema;
         }
         
         currentContents.push({ role: "model", parts: [{ text }] });
         currentContents.push({ role: "user", parts: [{ text: "Continue generating EXACTLY from where you left off. Do not repeat the last word. Do not add any conversational filler or introductions. Just output the continuation of the text directly." }] });
         reqOptions.contents = currentContents;
      } else {
        isDone = true;
      }
    }
    
    return {
      ...lastResponse,
      text: fullText,
    };
  }

  private async generateContentWithContinuation(
    ai: any,
    model: string,
    systemInstruction: string,
    userPrompt: string | any[],
    temperature: number = 0.7
  ): Promise<string> {
    let fullText = "";
    let isDone = false;
    
    let contents: any[] = [];
    if (typeof userPrompt === "string") {
      contents = [{ role: "user", parts: [{ text: userPrompt }] }];
    } else if (Array.isArray(userPrompt)) {
      if (userPrompt.length > 0) {
        const first = userPrompt[0];
        if (first.role) {
          contents = [...userPrompt];
        } else if (first.parts) {
          contents = userPrompt.map((c: any) => ({
            role: c.role || "user",
            parts: c.parts,
          }));
        } else {
          contents = [{ role: "user", parts: [...userPrompt] }];
        }
      } else {
        contents = [];
      }
    }

    let safetyCounter = 0;
    let currentModel = model;
    while (!isDone && safetyCounter < 6) {
      safetyCounter++;
      let response: any;
      let retryCount = 0;
      while (retryCount < 3) {
        try {
          response = await ai.models.generateContent({
            model: currentModel,
            contents,
            config: {
              systemInstruction,
              temperature,
              maxOutputTokens: 8192,
            },
          });
          break;
        } catch (err: any) {
          retryCount++;
          const isDemandSpike = err?.message?.includes("503") || err?.message?.includes("high demand") || err?.message?.includes("UNAVAILABLE") || err?.status === 503 || err?.code === 503;
          const is404 = err?.message?.includes("404") || err?.message?.includes("not found");
          
          if ((isDemandSpike || is404) && currentModel !== "gemini-flash-lite-latest") {
            console.warn(`[Translation] Model ${currentModel} error (503/404). Falling back to gemini-flash-lite-latest...`);
            currentModel = "gemini-flash-lite-latest";
            continue;
          }
          
          if (retryCount < 3 && isDemandSpike) {
            console.warn(`[Translation] 503 high demand spike, retrying in 1.5s (attempt ${retryCount}/3)...`);
            await new Promise(r => setTimeout(r, 1500));
            continue;
          }
          
          throw err;
        }
      }

      let text = response.text || "";
      
      // Clean up text if it starts with unwanted conversational filler from continuation
      if (safetyCounter > 1) {
        text = text.replace(/^(Here is the continuation|Continuing|Continuing from where I left off)[\s\S]*?:\s*/i, "");
        // If the previous chunk ended with a Burmese character and this chunk starts with a space, strip the leading space
        if (fullText.length > 0 && /[\u1000-\u109F]/.test(fullText.slice(-1))) {
           text = text.replace(/^\s+/, "");
        }
      }

      // Remove the Unicode replacement character in case of a split multi-byte character
      text = text.replace(/\uFFFD/g, "");
      
      // Normalize before concatenation to maintain grapheme clusters
      fullText = (fullText + text).normalize("NFC");

      const finishReason = response.candidates?.[0]?.finishReason;
      
      if (finishReason === "MAX_TOKENS" || finishReason === 2) { 
        console.log(`Max tokens reached (Chunk ${safetyCounter}). Engaging auto-continuation...`);
        contents.push({ role: "model", parts: [{ text }] });
        contents.push({ role: "user", parts: [{ text: "Continue generating EXACTLY from where you left off. Do not repeat the last word. Do not add any conversational filler or introductions. Just output the continuation of the text directly." }] });
      } else {
        isDone = true;
      }
    }

    return fullText;
  }

  private audioContext: AudioContext | null = null;

  private async postProcessBurmeseText(
    text: string,
    originalTextForIntegrityCheck?: string,
  ): Promise<string> {
    if (!text) return text;

    let processed = text;

    // 1. If it has Zawgyi, convert to Unicode
    if (isZawgyi(processed)) {
      console.log(
        "Zawgyi encoding detected in output. Triggering conversion to Standard Unicode...",
      );
      processed = await convertZawgyiToUnicodeWithGemini(
        processed,
        // The key is only needed (and only exists) on the server. In the
        // browser, convertZawgyiToUnicodeWithGemini uses the backend proxy.
        typeof window === "undefined" ? this.getApiKey() : "",
      );
    }

    // 2. Repair and Normalize Myanmar diacritics, spaces, markdown, line breaks
    processed = repairAndNormalizeMyanmarText(processed);

    // 3. Optional Integrity check
    if (originalTextForIntegrityCheck) {
      const integrity = runMyanmarIntegrityCheck(
        originalTextForIntegrityCheck,
        processed,
      );
      if (!integrity.success) {
        console.warn("Myanmar Integrity Check Warned:", integrity.issue);
      }
    }

    return processed;
  }

  private async postProcessBurmeseSrt(
    srtContent: string,
    originalSrtContent?: string,
  ): Promise<string> {
    if (!srtContent) return srtContent;

    let content = srtContent;
    if (isZawgyi(content)) {
      console.log("Zawgyi encoding detected in SRT. Converting to Unicode...");
      content = await convertZawgyiToUnicodeWithGemini(
        content,
        // The key is only needed (and only exists) on the server. In the
        // browser, convertZawgyiToUnicodeWithGemini uses the backend proxy.
        typeof window === "undefined" ? this.getApiKey() : "",
      );
    }

    const lines = content.split("\n");
    const processedLines = lines.map((line) => {
      // If line is timestamp (e.g. contains -->) or is just an index (number), leave it untouched!
      if (line.includes("-->") || /^\d+$/.test(line.trim())) {
        return line;
      }
      // Apply combining marks order fix, ZWSP insertion
      let processedLine = correctCombiningMarksOrder(line);
      // Remove any standard markdown wrappers
      processedLine = processedLine
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/_([^_]+)_/g, "$1");
      return processedLine;
    });

    return processedLines.join("\n");
  }

  private async postProcessBurmeseJson(jsonString: string): Promise<string> {
    if (!jsonString) return jsonString;
    try {
      const startIdx = jsonString.indexOf("{");
      const endIdx = jsonString.lastIndexOf("}");
      if (startIdx === -1 || endIdx === -1) return jsonString;

      const cleanJson = jsonString.slice(startIdx, endIdx + 1);
      const data = JSON.parse(cleanJson);

      if (data.movie_title) {
        data.movie_title = repairAndNormalizeMyanmarText(data.movie_title);
      }

      if (Array.isArray(data.scenes)) {
        for (const scene of data.scenes) {
          if (scene.voiceover_text) {
            scene.voiceover_text = repairAndNormalizeMyanmarText(
              scene.voiceover_text,
            );
          }
          if (scene.subtitle_text) {
            scene.subtitle_text = repairAndNormalizeMyanmarText(
              scene.subtitle_text,
            );
          }
        }
      }

      return JSON.stringify(data, null, 2);
    } catch (e: any) {
      console.warn(
        "Failed to parse and repair JSON Burmese script directly. Falling back to simple line processing.",
        e,
      );
      return repairAndNormalizeMyanmarText(jsonString);
    }
  }

  private async postProcessBurmeseSegmentJson(
    jsonString: string,
  ): Promise<string> {
    if (!jsonString) return jsonString;
    try {
      const startIdx = jsonString.indexOf("{");
      const endIdx = jsonString.lastIndexOf("}");
      if (startIdx === -1 || endIdx === -1) return jsonString;

      const cleanJson = jsonString.slice(startIdx, endIdx + 1);
      const data = JSON.parse(cleanJson);

      if (Array.isArray(data.segments)) {
        for (const segment of data.segments) {
          if (segment.narration) {
            segment.narration = repairAndNormalizeMyanmarText(
              segment.narration,
            );
          }
        }
      }

      return JSON.stringify(data, null, 2);
    } catch (e: any) {
      console.warn(
        "Failed to parse and repair Segment JSON Burmese script directly.",
        e,
      );
      return repairAndNormalizeMyanmarText(jsonString);
    }
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === "closed") {
      this.audioContext = new (
        window.AudioContext || (window as any).webkitAudioContext
      )({ sampleRate: 24000 });
    }
    return this.audioContext;
  }

  private splitText(text: string, maxLength: number = 4000): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      chunks.push(text.slice(start, start + maxLength));
      start += maxLength;
    }
    return chunks;
  }

  private concatenateAudioBuffers(
    buffers: AudioBuffer[],
    ctx: AudioContext,
  ): AudioBuffer {
    if (buffers.length === 0) return ctx.createBuffer(1, 1, 24000);
    if (buffers.length === 1) return buffers[0];

    const totalLength = buffers.reduce((acc, buffer) => acc + buffer.length, 0);
    const resultBuffer = ctx.createBuffer(
      buffers[0].numberOfChannels,
      totalLength,
      buffers[0].sampleRate,
    );

    let offset = 0;
    for (const buffer of buffers) {
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        resultBuffer
          .getChannelData(channel)
          .set(buffer.getChannelData(channel), offset);
      }
      offset += buffer.length;
    }

    return resultBuffer;
  }

  private chunkTextByParagraphs(
    text: string,
    targetSize: number = 4000,
  ): string[] {
    const normalizedText = text.replace(/\r\n/g, "\n");
    const paragraphs = normalizedText.split(/\n\s*\n/);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const para of paragraphs) {
      const trimmedPara = para.trim();
      if (!trimmedPara) continue;

      if (currentChunk.length + trimmedPara.length + 2 <= targetSize) {
        currentChunk += (currentChunk ? "\n\n" : "") + trimmedPara;
        continue;
      }

      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      if (trimmedPara.length <= targetSize) {
        currentChunk = trimmedPara;
        continue;
      }

      const lines = trimmedPara.split(/\n+/);
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        if (currentChunk.length + trimmedLine.length + 1 <= targetSize) {
          currentChunk += (currentChunk ? "\n" : "") + trimmedLine;
          continue;
        }

        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = "";
        }

        if (trimmedLine.length <= targetSize) {
          currentChunk = trimmedLine;
          continue;
        }

        const sentences = trimmedLine.split(/(?<=[.?!။])\s+/);
        for (const sentence of sentences) {
          const trimmedSentence = sentence.trim();
          if (!trimmedSentence) continue;

          if (currentChunk.length + trimmedSentence.length + 1 <= targetSize) {
            currentChunk += (currentChunk ? " " : "") + trimmedSentence;
            continue;
          }

          if (currentChunk) {
            chunks.push(currentChunk);
            currentChunk = "";
          }

          if (trimmedSentence.length <= targetSize) {
            currentChunk = trimmedSentence;
            continue;
          }

          const words = trimmedSentence.split(/\s+/);
          for (const word of words) {
            const trimmedWord = word.trim();
            if (!trimmedWord) continue;

            if (trimmedWord.length > targetSize) {
              if (currentChunk) {
                chunks.push(currentChunk);
                currentChunk = "";
              }
              let start = 0;
              while (start < trimmedWord.length) {
                chunks.push(trimmedWord.slice(start, start + targetSize));
                start += targetSize;
              }
            } else if (
              currentChunk.length + trimmedWord.length + 1 <=
              targetSize
            ) {
              currentChunk += (currentChunk ? " " : "") + trimmedWord;
            } else {
              if (currentChunk) {
                chunks.push(currentChunk);
              }
              currentChunk = trimmedWord;
            }
          }
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private chunkSrtBlocks(
    srtContent: string,
    targetSize: number = 4000,
  ): string[] {
    const blocks = srtContent.split(/\n\s*\n/);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const block of blocks) {
      if (!block.trim()) continue;
      if (
        currentChunk.length + block.length > targetSize &&
        currentChunk.length > 0
      ) {
        chunks.push(currentChunk);
        currentChunk = "";
      }
      currentChunk += (currentChunk ? "\n\n" : "") + block;
    }
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  }

  async fetchYoutubeTranscript(url: string): Promise<string> {
    const ai = this.getAI();
    const response = await this.generateContentAutoContinue(ai, {
      model: "gemini-flash-lite-latest",
      contents: `Retrieve the detailed content, transcript, or comprehensive summary for this YouTube URL: ${url}`,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: `Retrieve full transcript content. If unavailable, reconstruct a detailed chronological narrative.`,
        temperature: 0.2,
      },
    });

    const text = response.text?.trim() || "";
    if (text.includes("CONTENT_UNAVAILABLE")) {
      throw new Error(
        "Could not retrieve content. The video might be private, deleted, or too new.",
      );
    }
    return text;
  }

  async generateRecapScript(
    sourceText: string,
    referenceImageBase64?: string,
    customPrompt?: string,
  ): Promise<string> {
    const ai = this.getAI();

    const parts: any[] = [];

    if (referenceImageBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: referenceImageBase64,
        },
      });
      parts.push({
        text: "Use this reference image to understand the visual style, mood, and character vibes of the content.",
      });
    }

    if (customPrompt && customPrompt.trim()) {
      parts.push({
        text: `Additional User Instructions/Refinements for this script: ${customPrompt}`,
      });
    }

    parts.push({
      text: `Generate a professional, engaging movie/story recap script based on this content: ${sourceText}`,
    });

    const response = await this.generateContentAutoContinue(ai, {
      model: "gemini-flash-lite-latest",
      contents: [{ parts }],
      config: {
        systemInstruction: `You are an expert Recap Script Writer. Your task is to rewrite and format the provided story text into a clean, engaging, and easy-to-read narrative script.

STRICT FORMATTING RULES:

No Timestamps: You MUST completely remove all timestamps (e.g., 0:00, 29 seconds, 1 minute) from the text.

Simple & Readable: Rewrite the story in a simple, straightforward narrative. Break long, clunky text blocks into well-spaced paragraphs to ensure it is easy to read.

Language Constraint: You MUST strictly output the final script in 'Burmese dialogue'. Ensure the tone is natural and suitable for voice-over narration.

Silent Output (Crucial): DO NOT include this prompt, any rules, conversational fillers (e.g., 'Here is your script', 'Sure'), or any UI text in your output. You must ONLY output the final completed script. Treat the user's input as the raw material and output ONLY the polished result.`,
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    });
    return response.text?.trim() || "Failed to generate recap.";
  }

  async translateRecap(
    transcript: string,
    targetLanguage: string = "Burmese",
    videoDuration?: number,
  ): Promise<string> {
    const ai = this.getAI();

    const durationSec =
      videoDuration && videoDuration > 0 ? Math.round(videoDuration) : 180;
    const lengthPrompt = `
CRITICAL LENGTH & STRUCTURE REQUIREMENT:
The original video is ${durationSec} seconds long.
You MUST write a very detailed scene-by-scene script where the total summed durations of all segments equals exactly ${durationSec} seconds.
DO NOT use short summary sentences.
For every 15-30 seconds of video timeline, write a robust segment detailing what happens and generating a substantial amount of narration text in ${targetLanguage}.
Do NOT skip or compress. Cover 100% of the timeline.`;

    const response = await this.generateContentAutoContinue(ai, {
      model: "gemini-flash-lite-latest",
      contents: `Transcript/Content to process:\n\n${transcript}\n\n${lengthPrompt}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            video_duration: { type: Type.STRING },
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  start_time: { type: Type.STRING },
                  end_time: { type: Type.STRING },
                  scene_description: { type: Type.STRING },
                  narration: { type: Type.STRING },
                },
                required: [
                  "start_time",
                  "end_time",
                  "scene_description",
                  "narration",
                ],
              },
            },
          },
          required: ["video_duration", "segments"],
        },
        systemInstruction: `You are an AI video recapper. You MUST write the recap script strictly based on the provided transcript and visual context. Do NOT invent, guess, or hallucinate any information outside of the provided context.\n\nYou are an advanced AI Recap Script Writer.
Your task is NOT to summarize the video.
Analyze the ENTIRE provided content/transcript from beginning to end and generate a complete recap narration script in ${targetLanguage} that follows the original story exactly as it happens chronologically.

Requirements:
1. Cover 100% of the video timeline (Total Duration: ${durationSec} seconds).
2. Do not skip scenes, events, dialogues, character actions, transitions, or important visual details.
3. Maintain chronological order from the first frame to the last frame.
4. Generate detailed narration for every scene so that the final script duration closely matches the original video duration (${durationSec} seconds).
5. If the source video is 6 minutes long, generate approximately 5.5-6 minutes of narration content.
6. Divide the script into timestamped segments (each from 15 to 35 seconds long, sequential without overlapping).
7. For each segment include:
   - start_time: The start timestamp (e.g. "00:00")
   - end_time: The end timestamp (e.g. "00:25")
   - scene_description: Detailed scene description in English (visual elements, actions, emotions, setting).
   - narration: Spoken voiceover narration text written 100% in fluent to-the-point ${targetLanguage}.
8. Narration timing must match segment duration perfectly (approx. 2 to 2.5 words per second).
9. Never compress multiple scenes into a single sentence.
10. Preserve all major story beats, emotions, character motivations, conflicts, and resolutions.
11. When dialogue exists, explain its meaning and significance naturally in the narration text.
12. Generate enough narration text in ${targetLanguage} to keep voice-over highly active throughout the entire video. Do NOT make a short recap.
13. Reconstruct the entire story scene-by-scene with narration that matches the original video duration and timing.`,
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
    });
    const result =
      response.text?.trim() || "Failed to generate translate-recap.";
    if (targetLanguage === "Burmese" || targetLanguage === "my") {
      return this.postProcessBurmeseSegmentJson(result);
    }
    return result;
  }

  async generateOriginalRecap(
    transcript: string,
    targetLanguage: string = "Burmese",
    videoDuration?: number,
  ): Promise<string> {
    const ai = this.getAI();

    const durationSec =
      videoDuration && videoDuration > 0 ? Math.round(videoDuration) : 180;
    const lengthPrompt = `
CRITICAL LENGTH & STRUCTURE REQUIREMENT:
The original video is ${durationSec} seconds long.
You MUST write a very detailed scene-by-scene recap script where the total summed durations of all segments equals exactly ${durationSec} seconds.
DO NOT summarize or shorten the story.
For every 15-30 seconds of video timeline, write a robust segment detailing what happens and generating a substantial amount of narration text in ${targetLanguage}.
Do NOT skip or compress. Cover 100% of the timeline.`;

    const response = await this.generateContentAutoContinue(ai, {
      model: "gemini-flash-lite-latest",
      contents: `Transcript/Content to process:\n\n${transcript}\n\n${lengthPrompt}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            video_duration: { type: Type.STRING },
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  start_time: { type: Type.STRING },
                  end_time: { type: Type.STRING },
                  scene_description: { type: Type.STRING },
                  narration: { type: Type.STRING },
                },
                required: [
                  "start_time",
                  "end_time",
                  "scene_description",
                  "narration",
                ],
              },
            },
          },
          required: ["video_duration", "segments"],
        },
        systemInstruction: `You are an AI video recapper. You MUST write the recap script strictly based on the provided transcript and visual context. Do NOT invent, guess, or hallucinate any information outside of the provided context.\n\nYou are an advanced AI Recap Script Writer.
Your task is NOT to summarize the video.
Analyze the ENTIRE provided content/transcript from beginning to end and generate a complete recap narration script in ${targetLanguage} that follows the original story exactly as it happens chronologically.

Requirements:
1. Cover 100% of the video timeline (Total Duration: ${durationSec} seconds).
2. Do not skip scenes, events, dialogues, character actions, transitions, or important visual details.
3. Maintain chronological order from the first frame to the last frame.
4. Generate detailed narration for every scene so that the final script duration closely matches the original video duration (${durationSec} seconds).
5. If the source video is 6 minutes long, generate approximately 5.5-6 minutes of narration content.
6. Divide the script into timestamped segments (each from 15 to 35 seconds long, sequential without overlapping).
7. For each segment include:
   - start_time: The start timestamp (e.g. "00:00")
   - end_time: The end timestamp (e.g. "00:25")
   - scene_description: Detailed scene description in English (visual elements, actions, emotions, setting).
   - narration: Spoken voiceover narration text written 100% in fluent to-the-point ${targetLanguage}.
8. Narration timing must match segment duration perfectly (approx. 2 to 2.5 words per second).
9. Never compress multiple scenes into a single sentence.
10. Preserve all major story beats, emotions, character motivations, conflicts, and resolutions.
11. When dialogue exists, explain its meaning and significance naturally in the narration text.
12. Generate enough narration text in ${targetLanguage} to keep voice-over highly active throughout the entire video. Do NOT make a short recap.
13. Reconstruct the entire story scene-by-scene with narration that matches the original video duration and timing.`,
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
    });
    const result =
      response.text?.trim() || "Failed to generate original-recap.";
    if (targetLanguage === "Burmese" || targetLanguage === "my") {
      return this.postProcessBurmeseSegmentJson(result);
    }
    return result;
  }

  async generateStoryScript(
    topic: string,
    previousContext?: string,
    episodeNumber: number = 1,
  ): Promise<string> {
    const ai = this.getAI();

    let userPrompt = "";
    let systemPrompt = "";

    if (previousContext) {
      // Continuing story logic
      userPrompt = `Write Episode ${episodeNumber} of the story based on the topic: "${topic}".
      
      PREVIOUS CONTEXT (End of Episode ${episodeNumber - 1}):
      "${previousContext.slice(-6000)}" 
      
      INSTRUCTIONS:
      1. Continue the story directly from the previous context.
      2. Keep ALL character names, personalities, and relationships exactly the same.
      3. Maintain the same writing style and tone.
      4. Advance the plot significantly in this episode.
      5. Write entirely in Myanmar Language (Unicode).`;

      systemPrompt = `You are an expert Myanmar Novelist using Gemini 3 Pro capabilities.
      You are writing a multi-part series. 
      CRITICAL: You MUST maintain absolute consistency with the previous text provided. Do not change character names (Example: If protagonist is 'Mg Mg', keep 'Mg Mg').
      Ensure the timeline flows naturally from the previous scene.
      
      FORMATTING RULES (MANDATORY):
      1. Write entirely in standard-compliant Myanmar Unicode (UTF-8). Never use Zawgyi.
      2. Format dialogue lines using "**Character Name:** Dialogue content..." or with emotional stage directions, e.g. "**Character Name (stage direction):** Dialogue content..."
      3. Use "**ဇာတ်ကြောင်းပြောသူ:**" for all narrator lines (do NOT use English headers like "**Narration:**" or "**Narrator:**").
      4. Format background music cues, sound effects, or scene transitions in bracketed headers, e.g. '*[နောက်ခံတေးဂီတ - ဝမ်းနည်းဖွယ်]*', '**[နောက်ခံတေးဂီတ]**', '**[အချိန်ကူးပြောင်း]**', '**[ညအချိန်]**', '**[နောက်တစ်နေ့မနက်]**'.
      5. Add emotional stage directions in parenthesis inside character headers when appropriate, e.g. '**ဆူမန် (ငိုလျက်):**', '**ဆူမန် (စိတ်ထဲမှ):**', '**ဆူမန် (နွားကိုပြောလျက်):**'.
      6. Make sure speaker names and narrator header are wrapped in ** double asterisks ** for bolding.
      7. Keep dialogue and narration text clean of any internal bold asterisks or special formatting inside the sentences themselves.
      8. Do NOT omit any parts of the story, dialogue, character motivations, or emotional moments. Write a fully complete script.`;
    } else {
      // New story logic
      userPrompt = `Write Episode 1 of a new story about "${topic}" in Myanmar language (Unicode).`;
      systemPrompt = `You are an expert Myanmar Novelist. 
      Create a compelling Episode 1. Introduce characters clearly. Set the scene vividly.
      Tone: Engaging, Emotional, and Descriptive.
      
      FORMATTING RULES (MANDATORY):
      1. Write entirely in standard-compliant Myanmar Unicode (UTF-8). Never use Zawgyi.
      2. Format dialogue lines using "**Character Name:** Dialogue content..." or with emotional stage directions, e.g. "**Character Name (stage direction):** Dialogue content..."
      3. Use "**ဇာတ်ကြောင်းပြောသူ:**" for all narrator lines (do NOT use English headers like "**Narration:**" or "**Narrator:**").
      4. Format background music cues, sound effects, or scene transitions in bracketed headers, e.g. '*[နောက်ခံတေးဂီတ - ဝမ်းနည်းဖွယ်]*', '**[နောက်ခံတေးဂီတ]**', '**[အချိန်ကူးပြောင်း]**', '**[ညအချိန်]**', '**[နောက်တစ်နေ့မနက်]**'.
      5. Add emotional stage directions in parenthesis inside character headers when appropriate, e.g. '**ဆူမန် (ငိုလျက်):**', '**ဆူမန် (စိတ်ထဲမှ):**', '**ဆူမန် (နွားကိုပြောလျက်):**'.
      6. Make sure speaker names and narrator header are wrapped in ** double asterisks ** for bolding.
      7. Keep dialogue and narration text clean of any internal bold asterisks or special formatting inside the sentences themselves.
      8. Do NOT omit any parts of the story, dialogue, character motivations, or emotional moments. Write a fully complete script.`;
    }

    const response = await this.generateContentAutoContinue(ai, {
      model: "gemini-flash-lite-latest", // Upgraded to Pro for complex reasoning and context retention
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.85,
        maxOutputTokens: 8192,
      },
    });
    const result = response.text?.trim() || "Failed to generate story script.";
    return this.postProcessBurmeseText(result);
  }

  async splitScriptIntoParts(
    script: string,
    partsCount: number,
  ): Promise<string[]> {
    const ai = this.getAI();
    const response = await this.generateContentAutoContinue(ai, {
      model: "gemini-flash-lite-latest",
      contents: `Split this script into exactly ${partsCount} logical parts for a video series. 
      Script: "${script}"`,
      config: {
        systemInstruction: `Split the text into ${partsCount} parts. Each part should end with a hook if possible. Return the parts separated by '---PART_SEPARATOR---'. Do not add any other text.`,
        temperature: 0.3,
      },
    });

    const text = response.text || "";
    return text
      .split("---PART_SEPARATOR---")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  async translateYoutubeTranscript(
    url: string,
    targetLanguage: string,
  ): Promise<string> {
    const ai = this.getAI();
    const languageName =
      targetLanguage === "my" ? "Burmese (Myanmar Unicode)" : "English";

    const response = await this.generateContentAutoContinue(ai, {
      model: "gemini-flash-lite-latest",
      contents: `Process this YouTube URL for accurate translation: ${url}`,
      config: {
        systemInstruction: `Translate YouTube transcript to ${languageName}. Accurate, sentence-by-sentence.`,
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
    });

    const result = response.text?.trim() || "Translation processing error.";
    if (
      targetLanguage === "my" ||
      targetLanguage.toLowerCase().includes("burmese") ||
      targetLanguage.toLowerCase().includes("myanmar")
    ) {
      return this.postProcessBurmeseText(result);
    }
    return result;
  }

  async generateScriptFromYoutubeUrl(
    url: string,
    targetLanguage: string,
  ): Promise<string> {
    const ai = this.getAI();
    const languageName =
      targetLanguage === "my" ? "Burmese (Myanmar Unicode)" : "English";

    const response = await this.generateContentAutoContinue(ai, {
      model: "gemini-flash-lite-latest",
      contents: `Process this YouTube URL: ${url}`,
      config: {
        systemInstruction: `Analyze video topic from URL and generate original content in ${languageName}. Format: Title, Hook, Script, Thumbnail, Summary.`,
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    });

    const result = response.text?.trim() || "Failed to analyze URL.";
    if (
      targetLanguage === "my" ||
      targetLanguage.toLowerCase().includes("burmese") ||
      targetLanguage.toLowerCase().includes("myanmar")
    ) {
      return this.postProcessBurmeseText(result);
    }
    return result;
  }

  async translateText(
    text: string,
    from: string,
    to: string,
    tone: TranslationTone = TranslationTone.NATURAL,
    onProgress?: (totalChunks: number, currentChunkIndex: number, status: "Pending" | "Translating" | "Success" | "Failed", errorMsg?: string) => void,
  ): Promise<string> {
    if (text.length < 3500) {
      if (onProgress) onProgress(1, 0, "Translating");
      try {
        const res = await this.translateTextSingle(text, from, to, tone);
        if (onProgress) onProgress(1, 0, "Success");
        return res;
      } catch (err: any) {
        console.error("GeminiService ERROR: translateText (Single) failed with details:", {
          message: err.message,
          stack: err.stack,
          rawError: err,
          textLength: text.length,
          from,
          to,
          tone
        });
        if (onProgress) onProgress(1, 0, "Failed", err.message || err.toString());
        throw err;
      }
    }

    console.log(
      "Engaging Long-Form Chunking Protocol (Controlled Concurrency with Context to avoid Rate Limits)...",
    );
    const chunks = this.chunkTextByParagraphs(text, 3500);
    const ai = this.getAI();

    if (onProgress) {
      for (let i = 0; i < chunks.length; i++) {
        onProgress(chunks.length, i, "Pending");
      }
    }

    const results: string[] = new Array(chunks.length);
    const concurrencyLimit = 3;
    const batchDelayMs = 1000;

    for (let batchStart = 0; batchStart < chunks.length; batchStart += concurrencyLimit) {
      const batchIndices = Array.from(
        { length: Math.min(concurrencyLimit, chunks.length - batchStart) },
        (_, idx) => batchStart + idx
      );

      // Map progress of all items in this batch to "Translating" in parallel
      if (onProgress) {
        for (const i of batchIndices) {
          onProgress(chunks.length, i, "Translating");
        }
      }

      // Process batch items in parallel
      await Promise.all(
        batchIndices.map(async (i) => {
          const chunk = chunks[i];
          let attempt = 0;
          let lastError: any = null;
          let success = false;
          let result = "";

          const previousContext = i > 0 ? chunks[i - 1].slice(-1500) : "";

          while (attempt < 2 && !success) {
            try {
              const resultText = await this.generateContentWithContinuation(
                ai,
                "gemini-flash-lite-latest",
                `You are an extremely meticulous, professional Long-Form Voice-Over Translator.
                        YOUR ABSOLUTE HIGHEST PRIORITY AND MANDATORY INSTRUCTION IS COMPLETE, ZERO-OMISSION TRANSLATION.
                        You MUST translate every single sentence, speaker name, dialogue, narration, description, and word from the original text into elegant, beautifully natural Myanmar (Burmese) Unicode.
                        
                        CRITICAL SAFETY CLAUSES:
                        - DO NOT summarize!
                        - DO NOT shorten!
                        - DO NOT condense or omit any scene description, dialogue line, speaker speech, or detail!
                        - If you skip or condense even a single line of script, it breaks the entire audio production sync and is a critical failure.
                        - Match the original script 100% line-by-line, sentence-by-sentence.
                        
                        MANDATORY OUTPUT FORMAT CONSTRAINTS:
                        1. Output ONLY the final translated Burmese text. Do NOT provide translation notes, explanations, or introductory/concluding remarks.
                        2. NEVER include the original source text (English, Hindi, etc.) in the output. Do NOT write bilingual or dual-language text.
                        3. NEVER output translation mappings, bilingual comparisons, explanations, or labels like '->' or '(Matches)'.
                        4. The output must flow naturally as a clean, continuous story script suitable for a voiceover.
                        5. Strictly maintain the 'Burmese dialogue' instruction to produce natural conversational, spoken tone rather than stiff literal translations or captions.
                        
                        FORMATTING RULES:
                        1. WRITE THE FOLLOWING SCRIPT INTO FULL MYANMAR VOICE-OVER SCRIPT:START TO FINISH. (long form )(no time stamp)each character dialogue highlighted.
                        2. Write the translation in a Voice-Over Script format. Each character dialogue MUST be highlighted with Markdown bolding, like "**Speaker** - ".
                        - Example: "**ဇာတ်လမ်းပြောသူ** - " or "**မိဖုရားကြီး** - "
                        3. Format all character names by keeping the English name first, followed by the Burmese pronunciation in brackets, e.g., "**Arjun (အာဂျွန်)** - ", "**Ashok (အာရှော့ခ်)** - ".
                        4. NEVER include the original source text (English, Hindi, etc.) behind the translated text. DO NOT show text behind the source content box.
                        5. ZERO-OMISSION IN THE MIDDLE (CRITICAL): Absolutely no words, sentences, dialogues, or descriptive details in the middle or anywhere in the original content may be skipped, summarized, condensed, or omitted. The translated script must contain the exact, lossless mapping of the entire storyline from beginning to end.
                        6. IMPORTANT: Produce natural 'Burmese dialogue'. Do not translate into stiff 'Burmese captions'.
                        7. Translate fully and naturally.
                        ${
                          to === "my" ||
                          to.toLowerCase().includes("burmese") ||
                          to.toLowerCase().includes("myanmar")
                            ? `
                        CRITICAL MYANMAR UNICODE & TEXT PROCESSING RULES (MANDATORY):
                        1. You MUST write ENTIRELY in standard-compliant Myanmar Unicode (UTF-8).
                        2. NEVER output Zawgyi encoding under any circumstances.
                        3. NEVER omit any words, phrases, sentences, speaker lines, or dialogue from the original content. All content must be fully and losslessly preserved.
                        4. DO NOT use any Markdown formatting (*, _, etc.) inside narration or dialogue text itself. The narration text must be plain text. Speaker headings like "**Speaker Name:**" at the beginning of lines are allowed, but do not wrap or pollute narration text with asterisks.
                        5. Ensure correct character ordering (e.g. vowel sign 'i' \\\\u102D comes before vowel sign 'u' \\\\u102F to form the 'o' sound 'ို', and never misorder diacritics).
                        6. Double-check and validate every sentence's Unicode sequence for rendering compatibility with Flutter, iOS, Android, web browsers, and TTS engines.
                        7. Do not use broken stacked consonant representations. Use standard Unicode virama \\\\u1039 stack sequences.
                        `
                            : ""
                        }`,
                `TRANSLATION TASK: Translate Part ${i + 1} of ${chunks.length} of a long script from ${from} to ${to}.
                    
${
  previousContext
    ? `CONTEXT FROM PREVIOUS PART (ORIGINAL SOURCE):
---START OF PREVIOUS CONTEXT---
${previousContext}
---END OF PREVIOUS CONTEXT---
(Use the above context ONLY to maintain character names, story continuity, and writing style. DO NOT translate this previous context again.)`
    : ""
}
ORIGINAL TEXT TO TRANSLATE (PART ${i + 1} - TRANSLATE THIS PART FULLY):
---START OF PART ${i + 1}---
${chunk}
---END OF PART ${i + 1}---`,
                0.1
              );

              result = resultText.trim() || "";
              if (result) success = true;
              else throw new Error("Empty output");
            } catch (e: any) {
              lastError = e;
              console.error(`GeminiService ERROR: Chunk ${i + 1} attempt ${attempt + 1} failed:`, {
                message: e.message,
                stack: e.stack,
                rawError: e,
                chunkLength: chunk.length,
                chunkIndex: i
              });
              attempt++;

              if (e.message && e.message.includes("429")) {
                console.log("Rate limit hit! Waiting 30 seconds before retry...");
                await new Promise((resolve) => setTimeout(resolve, 30000));
              } else {
                await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
              }
            }
          }

          if (success) {
            let processedResult = result;
            if (
              to === "my" ||
              to.toLowerCase().includes("burmese") ||
              to.toLowerCase().includes("myanmar")
            ) {
              processedResult = await this.postProcessBurmeseText(result, chunk);
            }
            results[i] = processedResult;
            if (onProgress) onProgress(chunks.length, i, "Success");
          } else {
            results[i] = `[ERROR: SECTION ${i + 1} FAILED TO TRANSLATE]`;
            if (onProgress) onProgress(chunks.length, i, "Failed", lastError?.message || "Unknown error");
          }
        })
      );

      // Add a batch delay between batches to avoid rate limit spikes
      if (batchStart + concurrencyLimit < chunks.length) {
        await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
      }
    }

    return results.join("\n\n");
  }

  private async translateTextSingle(
    text: string,
    from: string,
    to: string,
    tone: TranslationTone,
  ): Promise<string> {
    const ai = this.getAI();
    const toneInstructions = {
      [TranslationTone.NATURAL]: "Natural, fluent spoken style.",
      [TranslationTone.CREATIVE]: "Creative, evocative, storytelling style.",
      [TranslationTone.PROFESSIONAL]: "Formal, precise, professional style.",
    };

    const result = await this.generateContentWithContinuation(
      ai,
      "gemini-flash-lite-latest",
      `You are an extremely meticulous, professional Myanmar Voice-Over Script Writer and Translator.
        YOUR ABSOLUTE HIGHEST PRIORITY AND MANDATORY INSTRUCTION IS COMPLETE, ZERO-OMISSION TRANSLATION.
        You MUST translate every single sentence, speaker name, dialogue, narration, description, and word from the original input into elegant, beautifully natural Myanmar (Burmese) Unicode.
        
        CRITICAL SAFETY CLAUSES:
        - DO NOT summarize!
        - DO NOT shorten!
        - DO NOT condense or omit any scene description, dialogue line, speaker speech, or detail!
        - Every single sentence in the original input MUST have a corresponding translated sentence in the output.
        - Checking word-by-word and sentence-by-sentence to ensure 100% preservation of content in the middle and everywhere of the script is mandatory.

        MANDATORY OUTPUT FORMAT CONSTRAINTS:
        1. Output ONLY the final translated Burmese text. Do NOT provide translation notes, explanations, or introductory/concluding remarks.
        2. NEVER include the original source text (English, Hindi, etc.) in the output. Do NOT write bilingual or dual-language text.
        3. NEVER output translation mappings, bilingual comparisons, explanations, or labels like '->' or '(Matches)'.
        4. The output must flow naturally as a clean, continuous story script suitable for a voiceover.
        5. Strictly maintain the 'Burmese dialogue' instruction to produce natural conversational, spoken tone rather than stiff literal translations or captions.

        FORMATTING RULES:
        1. WRITE THE FOLLOWING SCRIPT INTO FULL MYANMAR VOICE-OVER SCRIPT:START TO FINISH. (long form )(no time stamp)each character dialogue highlighted.
        2. Write the translation in a Voice-Over Script format. Each character dialogue MUST be highlighted with Markdown bolding, like "**Speaker** - ".
        - Example: "**ဇာတ်လမ်းပြောသူ** - " or "**မိဖုရားကြီး** - "
        3. Format all character names by keeping the English name first, followed by the Burmese pronunciation in brackets, e.g., "**Arjun (အာဂျွန်)** - ", "**Ashok (အာရှော့ခ်)** - ".
        4. NEVER include the original source text (English, Hindi, etc.) behind the translated text. DO NOT show text behind the source content box.
        5. ZERO-OMISSION IN THE MIDDLE (CRITICAL): Absolutely no words, sentences, dialogues, or descriptive details in the middle or anywhere in the original content may be skipped, summarized, condensed, or omitted. The translated script must contain the exact, lossless mapping of the entire storyline from beginning to end.
        6. IMPORTANT: Produce natural 'Burmese dialogue'. Do not translate into stiff 'Burmese captions'.
        7. DO NOT output any English intro sentence or English headers. Start directly with the translated story.
        8. Tone: ${tone} - ${toneInstructions[tone]}
        9. Translate every sentence from start to finish without losing any meaning in the middle.
        ${
          to === "my" ||
          to.toLowerCase().includes("burmese") ||
          to.toLowerCase().includes("myanmar")
            ? `
        CRITICAL MYANMAR UNICODE & TEXT PROCESSING RULES (MANDATORY):
        1. You MUST write ENTIRELY in standard-compliant Myanmar Unicode (UTF-8).
        2. NEVER output Zawgyi encoding under any circumstances.
        3. NEVER omit any words, phrases, sentences, speaker lines, or dialogue from the original content. All content must be fully and losslessly preserved.
        4. DO NOT use any Markdown formatting (*, _, etc.) inside narration or dialogue text itself. The narration text must be plain text. Speaker headings like "**Speaker Name:**" at the beginning of lines are allowed, but do not wrap or pollute narration text with asterisks.
        5. Ensure correct character ordering (e.g. vowel sign 'i' \\u102D comes before vowel sign 'u' \\u102F to form the 'o' sound 'ို', and never misorder diacritics).
        6. Double-check and validate every sentence's Unicode sequence for rendering compatibility with Flutter, iOS, Android, web browsers, and TTS engines.
        7. Do not use broken stacked consonant representations. Use standard Unicode virama \\u1039 stack sequences.
        `
            : ""
        }`,
      `Translate the following script from ${from} to ${to}: "${text}"`,
      0.1
    );

    if (
      to === "my" ||
      to.toLowerCase().includes("burmese") ||
      to.toLowerCase().includes("myanmar")
    ) {
      return this.postProcessBurmeseText(result, text);
    }
    return result;
  }

  async generateCreativeScript(
    brief: string,
    type: ScriptType,
    tone: string,
    language: string,
  ): Promise<string> {
    const ai = this.getAI();
    const isBurmese =
      language.toLowerCase().includes("burmese") ||
      language.toLowerCase().includes("myanmar");

    const systemInstruction = isBurmese
      ? `You are an expert Myanmar (Burmese) Voice-Over Scriptwriter and Novelist.
      Generate a ${type} in elegant standard Myanmar Unicode (UTF-8) based on the user's instructions.
      Tone: ${tone}.
      
      FORMATTING RULES (MANDATORY):
      1. Write entirely in standard-compliant Myanmar Unicode (UTF-8). Never use Zawgyi.
      2. Format dialogue lines using "**Character Name:** Dialogue content..." or with emotional stage directions, e.g. "**Character Name (stage direction):** Dialogue content..."
      3. Use "**ဇာတ်ကြောင်းပြောသူ:**" for all narrator lines (do NOT use English headers like "**Narration:**" or "**Narrator:**").
      4. Format background music cues, sound effects, or scene transitions in bracketed headers, e.g. '*[နောက်ခံတေးဂီတ - ဝမ်းနည်းဖွယ်]*', '**[နောက်ခံတေးဂီတ]**', '**[အချိန်ကူးပြောင်း]**', '**[ညအချိန်]**', '**[နောက်တစ်နေ့မနက်]**'.
      5. Add emotional stage directions in parenthesis inside character headers when appropriate, e.g. '**ဆူမန် (ငိုလျက်):**', '**ဆူမန် (စိတ်ထဲမှ):**', '**ဆူမန် (နွားကိုပြောလျက်):**'.
      6. Make sure speaker names and narrator header are wrapped in ** double asterisks ** for bolding.
      7. Keep dialogue and narration text clean of any internal bold asterisks or special formatting inside the sentences themselves.
      8. Do NOT omit any parts of the story, dialogue, character motivations, or emotional moments. Write a fully complete script.`
      : `Professional scriptwriter. Create ${type} in ${language}. Tone: ${tone}. Full script.`;

    const response = await this.generateContentAutoContinue(ai, {
      model: "gemini-flash-lite-latest",
      contents: `Generate a ${type} about: ${brief}`,
      config: {
        systemInstruction,
        temperature: 0.85,
        maxOutputTokens: 8192,
      },
    });
    const result = response.text?.trim() || "Generation failed";
    if (isBurmese) {
      return this.postProcessBurmeseText(result);
    }
    return result;
  }

  async extractContentFromPdf(blob: Blob): Promise<PdfExtractionResult> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        fullText += pageText + "\n\n";
      }
      
      const cleanedText = fixMyanmarPdfTextSpaces(fullText.trim());
      const wordCount = cleanedText.split(/\s+/).filter(w => w.length > 0).length;
      
      return {
        text: cleanedText || "No text content found.",
        type: "digital",
        script: "Mixed Script",
        confidence: 0.99,
        pageCount: pdf.numPages,
        wordCount: wordCount,
      };
    } catch (e: any) {
      console.error("PDF Parsing Error:", e);
      return {
        text: "Error parsing PDF: " + e.message,
        type: "digital",
        script: "Mixed Script",
        confidence: 0,
        pageCount: 0,
        wordCount: 0
      };
    }
  }

  async enhanceImagePrompt(prompt: string): Promise<string> {
    const ai = this.getAI();
    const response = await this.generateContentAutoContinue(ai, {
      model: "gemini-flash-lite-latest",
      contents: `You are an expert prompt engineer for AI image generators.
Convert the following user request (which might be in Burmese or English) into a highly detailed, descriptive English prompt for an image generation model.
Do not include text overlays in your prompt, just visual descriptions.
Focus on composition, lighting, style, colors, and the subject matter.
Return ONLY the English image generation prompt, nothing else.

User Request: "${prompt}"`,
      config: { temperature: 0.7 },
    });
    return response.text || prompt;
  }

  async generateIllustration(
    prompt: string,
    aspectRatio: string = "16:9",
    referenceImageBase64?: string,
  ): Promise<string> {
    try {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const response = await fetch(`${baseUrl}/api/generate-thumbnail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, aspectRatio, referenceImageBase64 }),
      });

      if (!response.ok) {
        let errMsg = response.statusText;
        try {
          const data = await response.json();
          if (data.error) errMsg = data.error;
        } catch (e) {}
        throw new Error(`Error ${response.status}: ${errMsg}`);
      }

      const data = await response.json();
      if (data.imageUrl) {
        return data.imageUrl;
      }
      throw new Error("No image generated in response payload");
    } catch (err: any) {
      console.error("GeminiService ERROR generating illustration:", err);
      throw err;
    }
  }

  async translateSrt(
    srtContent: string,
    from: string,
    to: string,
    tone: TranslationTone = TranslationTone.NATURAL,
    onProgress?: (totalChunks: number, currentChunkIndex: number, status: "Pending" | "Translating" | "Success" | "Failed", errorMsg?: string) => void,
  ): Promise<string> {
    if (srtContent.length < 3500) {
      if (onProgress) onProgress(1, 0, "Translating");
      try {
        const res = await this.translateSrtSingle(srtContent, from, to, tone);
        if (onProgress) onProgress(1, 0, "Success");
        return res;
      } catch (err: any) {
        console.error("GeminiService ERROR: translateSrt (Single) failed with details:", {
          message: err.message,
          stack: err.stack,
          rawError: err,
          srtLength: srtContent.length,
          from,
          to,
          tone
        });
        if (onProgress) onProgress(1, 0, "Failed", err.message || err.toString());
        throw err;
      }
    }

    console.log("Engaging Long-Form SRT Protocol (Controlled Concurrency with Context)...");
    const chunks = this.chunkSrtBlocks(srtContent, 3500);
    const ai = this.getAI();

    if (onProgress) {
      for (let i = 0; i < chunks.length; i++) {
        onProgress(chunks.length, i, "Pending");
      }
    }

    const results: string[] = new Array(chunks.length);
    const concurrencyLimit = 3;
    const batchDelayMs = 1000;

    for (let batchStart = 0; batchStart < chunks.length; batchStart += concurrencyLimit) {
      const batchIndices = Array.from(
        { length: Math.min(concurrencyLimit, chunks.length - batchStart) },
        (_, idx) => batchStart + idx
      );

      // Map progress of all items in this batch to "Translating" in parallel
      if (onProgress) {
        for (const i of batchIndices) {
          onProgress(chunks.length, i, "Translating");
        }
      }

      // Process batch items in parallel
      await Promise.all(
        batchIndices.map(async (i) => {
          const chunk = chunks[i];
          let attempt = 0;
          let lastError: any = null;
          let success = false;
          let result = "";

          const previousContext = i > 0 ? chunks[i - 1].slice(-1500) : "";

          while (attempt < 2 && !success) {
            try {
              const response = await this.generateContentAutoContinue(ai, {
                model: "gemini-flash-lite-latest",
                contents: `Translate this SRT segment (Part ${i + 1}/${chunks.length}) from ${from} to ${to}.
                     
${
  previousContext
    ? `CONTEXT FROM PREVIOUS SEGMENT (ORIGINAL SOURCE):
---START OF PREVIOUS CONTEXT---
${previousContext}
---END OF PREVIOUS CONTEXT---
(Use the above context ONLY to align character names and maintain translation continuity. DO NOT re-translate this previous context.)`
    : ""
}

ORIGINAL SRT TO TRANSLATE (PART ${i + 1}):
---START OF PART ${i + 1}---
${chunk}
---END OF PART ${i + 1}---`,
                config: {
                  systemInstruction: `You are an extremely meticulous, professional Subtitle Translator.
                        YOUR ABSOLUTE HIGHEST PRIORITY IS COMPLETE, ZERO-OMISSION, BLOCK-FOR-BLOCK TRANSLATION.
                        Every timestamp and subtitle index MUST be preserved perfectly.
                        DO NOT skip, drop, merge, or abbreviate any subtitle blocks.
                        Every single block in the input MUST have an identical corresponding block in the output, with only the textual portion translated into beautiful, natural Myanmar (Burmese) Unicode.
 
                        RULES:
                        1. Keep subtitle index numbers and timestamps EXACTLY as they are in the input.
                        2. Translate only the text subtitle content to Myanmar (Burmese) Unicode. (Produce natural 'Burmese dialogue', do NOT output stiff 'Burmese captions' or use the word caption).
                        3. Do not merge lines or skip any block under any circumstances.
                        4. Return only valid, clean SRT format matching the block structure of the input 100%.`,
                  temperature: 0.1,
                  maxOutputTokens: 8192,
                },
              });

              result = response.text?.trim() || "";
              if (result) success = true;
              else throw new Error("Empty result");
            } catch (e: any) {
              lastError = e;
              console.error(`GeminiService ERROR: SRT Chunk ${i + 1} attempt ${attempt + 1} failed:`, {
                message: e.message,
                stack: e.stack,
                rawError: e,
                chunkLength: chunk.length,
                chunkIndex: i
              });
              attempt++;

              if (e.message && e.message.includes("429")) {
                console.log("Rate limit hit! Waiting 30 seconds before retry...");
                await new Promise((resolve) => setTimeout(resolve, 30000));
              } else {
                await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
              }
            }
          }

          let processedResult = success ? result : chunk;
          if (
            success &&
            (to === "my" ||
              to.toLowerCase().includes("burmese") ||
              to.toLowerCase().includes("myanmar"))
          ) {
            processedResult = await this.postProcessBurmeseSrt(
              processedResult,
              chunk,
            );
          }
          results[i] = processedResult;
          if (success) {
            if (onProgress) onProgress(chunks.length, i, "Success");
          } else {
            if (onProgress) onProgress(chunks.length, i, "Failed", lastError?.message || "Unknown error");
          }
        })
      );

      // Add a batch delay between batches to avoid rate limit spikes
      if (batchStart + concurrencyLimit < chunks.length) {
        await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
      }
    }

    return results.join("\n\n");
  }

  private async translateSrtSingle(
    srtContent: string,
    from: string,
    to: string,
    tone: TranslationTone,
  ): Promise<string> {
    const ai = this.getAI();
    const response = await this.generateContentAutoContinue(ai, {
      model: "gemini-flash-lite-latest",
      contents: `Translate this SRT from ${from} to ${to}:\n\n${srtContent}`,
      config: {
        systemInstruction: `You are an extremely meticulous, professional Subtitle Translator.
        YOUR ABSOLUTE HIGHEST PRIORITY IS COMPLETE, BLOCK-FOR-BLOCK SUBTITLE TRANSLATION.
        Keep subtitle index numbers and timestamps EXACTLY identical to the input.
        Do not skip, drop, or merge any blocks. Translate every line's text content fully into Myanmar (Burmese) Unicode.
        Return ONLY valid, clean SRT content matching the structure of the input.`,
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
    });
    const result = response.text?.trim() || srtContent;
    if (
      to === "my" ||
      to.toLowerCase().includes("burmese") ||
      to.toLowerCase().includes("myanmar")
    ) {
      return this.postProcessBurmeseSrt(result, srtContent);
    }
    return result;
  }

  async transcribeMedia(
    blob: Blob,
    mimeType: string,
    sourceLang: string,
    asSrt: boolean = false,
  ): Promise<string> {
    const ai = this.getAI();
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
    const base64Data = await base64Promise;

    const response = await this.generateContentAutoContinue(ai, {
      model: "gemini-flash-lite-latest",
      contents: [
        {
          parts: [
            { inlineData: { data: base64Data, mimeType: mimeType } },
            { text: asSrt ? "Strictly transcribe the spoken audio word-for-word into standard SRT format. Do not invent any visual descriptions, movie titles, or fictional text. Output only the SRT content." : "Strictly transcribe the spoken audio word-for-word into a clean raw text transcript. Do not invent any visual descriptions, movie titles, or fictional text. Output only the spoken text." },
          ],
        },
      ],
      config: { temperature: 0.1 },
    });
    return response.text || "Transcription failed";
  }

  async splitAudioBySpeaker(blob: Blob, mimeType: string): Promise<any[]> {
    const ai = this.getAI();
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
    const base64Data = await base64Promise;

    const response = await this.generateContentAutoContinue(ai, {
      model: "gemini-flash-lite-latest",
      contents: [
        {
          parts: [
            { inlineData: { data: base64Data, mimeType: mimeType } },
            {
              text: "Transcribe all speech with timestamps and speaker names. If this is a video, ALSO provide a highly detailed scene-by-scene description of all visual actions, events, characters, and on-screen text. Return a comprehensive chronological log in clear text (do not use JSON arrays).",
            },
          ],
        },
      ],
      config: {
        temperature: 0.1,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    try {
      return JSON.parse(response.text || "[]");
    } catch (e: any) {
      console.error("Failed to parse speaker split JSON", e);
      return [];
    }
  }

  private getVoicePersonalityPrompt(
    narratorVoice: string,
    languageName: string = "Burmese",
  ): string {
    const isNilar = narratorVoice.toLowerCase().includes("nilar");
    const isThiha = narratorVoice.toLowerCase().includes("thiha");

    if (isNilar) {
      return `You are using Microsoft Neural Voice "Nilar".

VOICE PERSONALITY:
- Warm Burmese female narrator
- Soft cinematic storytelling
- Emotional and expressive tone
- Natural YouTube narration voice

VOICE BEHAVIOR:
- Human-like speech flow
- Gentle emotional pacing
- Soft pauses during dramatic scenes
- Energetic during exciting moments

USE CASES:
- Emotional storytelling
- Romantic recaps
- Documentary narration
- Female narration videos

OUTPUT:
- SSML compatible
- Burmese pronunciation optimized
- Microsoft TTS ready

IMPORTANT:
- Use only Nilar voice.
- Do not switch voices automatically.

Please write the script in beautiful, fluid, natural ${languageName} specifically optimized to match the voice personality, pacing, and behavior above.`;
    } else if (isThiha) {
      return `You are using Microsoft Neural Voice "Thiha".

VOICE PERSONALITY:
- Deep Burmese male narrator
- Cinematic storytelling style
- Emotional and natural tone
- Professional movie recap voice

VOICE BEHAVIOR:
- Sound human-like
- Avoid robotic pacing
- Add emotional pauses naturally
- Increase intensity during action scenes
- Slow down during emotional scenes

USE CASES:
- Movie recap narration
- Documentary narration
- Storytelling videos
- Viral YouTube recaps

OUTPUT:
- SSML compatible
- Burmese pronunciation optimized
- Microsoft TTS ready

IMPORTANT:
- Use only Thiha voice.
- Do not switch voices automatically.

Please write the script in beautiful, fluid, natural ${languageName} specifically optimized to match the voice personality, pacing, and behavior above.`;
    }

    return `Tone profile: Standard ${narratorVoice} voice. Ensure standard spacing and pronunciation in ${languageName}.`;
  }

  async generateVideoVoiceOver(
    blob: Blob,
    mimeType: string,
    targetLanguage: string = "Burmese",
    narratorVoice: string = "Thiha (Male)",
    videoDuration?: number,
  ): Promise<string> {
    const ai = this.getAI();

    // Read blob to base64
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const result = reader.result as string;
        if (result) {
          resolve(result.split(",")[1]);
        } else {
          reject(new Error("Failed to read file"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const base64Data = await base64Promise;

    const languageName =
      targetLanguage === "Burmese"
        ? "Burmese (Myanmar Unicode)"
        : targetLanguage;
    const voicePersonality = this.getVoicePersonalityPrompt(
      narratorVoice,
      languageName,
    );

    const videoLengthPrompt = videoDuration
      ? `The total duration of the uploaded video is EXACTLY ${Math.round(videoDuration)} seconds. Your generated script MUST have multiple scenes whose total duration dynamically sums up EXACTLY to ${Math.round(videoDuration)} seconds. DO NOT make the scenes shorter or longer. Make sure they cover the full timing range from 0 to ${Math.round(videoDuration)}s.`
      : "Ensure the scenes cover the full duration of the video.";

    const pacingRulesStr =
      targetLanguage === "Burmese"
        ? `BURMESE SPEECH TIMING METRICS:
        - Burmese speakers pronounce roughly 7 to 8 characters per second (including letters, spaces, vowels, and signs).
        - For a scene of duration D seconds, the 'voiceover_text' MUST be around D * 7.5 characters long.
        - For example, if a scene is 10 seconds, its voiceover text MUST consist of approximately 75 Burmese characters.
        - NEVER use word-count division (splitting by space) for Burmese since words are not separated by spaces. Use this character-rate calculation instead.`
        : `ENGLISH/OTHER SPEECH TIMING METRICS:
        - Divide words at 3 words per second (e.g. 15s scene needs ~45 words).`;

    const response = await this.generateContentAutoContinue(ai, {
      model: "gemini-flash-lite-latest",
      contents: [
        {
          parts: [
            { inlineData: { data: base64Data, mimeType: mimeType } },
            {
              text: `Generate a professional, detailed, perfectly sync timed movie/video recap JSON for this video. The voiceover should be in ${languageName} narrated by ${narratorVoice}.`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: `You are an expert YouTube Movie Recap Automation Script & Prompt Engineer.
        
        ${voicePersonality}

        TASK:
        Generate a detailed, perfectly timed movie/video recap script and visual prompts in ${languageName}.

        ${videoLengthPrompt}
        
        RULES:
        1. ${pacingRulesStr}
        2. Ensure the start_time_seconds and end_time_seconds of each scene connect seamlessly without any gaps (e.g., scene 1 ends at 15s, scene 2 starts at 15s).
        3. Make sure the visual_prompt is highly detailed, vivid, cinematic, photorealistic, and matches the voiceover_text.
        4. The output MUST be a single clean valid JSON object following the format below.
        5. DO NOT include any conversational text, explanation or markdown formatting outside the JSON object.
        6. Always write all descriptions, voiceover_text and subtitle_text in the target language: ${languageName}.

        OUTPUT FORMAT:
        {
          "movie_title": "ရုပ်ရှင်အမည် သို့မဟုတ် ဇာတ်လမ်းခေါင်းစဉ်",
          "total_duration_seconds": ${videoDuration ? Math.round(videoDuration) : 120},
          "scenes": [
            {
              "scene_number": 1,
              "start_time_seconds": 0,
              "end_time_seconds": 15,
              "duration_seconds": 15,
              "voiceover_text": "မြန်မာလို Movie Recap စာသား။ အသံထွက်ဖတ်ပါက ၁၅ စက္ကန့် အတိအကျ ကြာရပါမယ်။ (BURMESE: 15s * 7.5 = ၁၁၂ လုံးခန့် ရှိရမည်)",
              "visual_prompt": "Cinematic, Pixar style animation, high contrast, golden hour lighting, ultra-sharp --ar 16:9",
              "subtitle_text": "အပေါ်က voiceover အတိုင်း ပြသမယ့် စာတန်းထိုးစာသား။"
            }
          ]
        }`,
        responseMimeType: "application/json",
        temperature: 0.4,
        maxOutputTokens: 8192,
      },
    });

    const result = response.text?.trim() || "Voice over generation failed.";
    if (targetLanguage === "Burmese") {
      return this.postProcessBurmeseJson(result);
    }
    return result;
  }

  async generateVisualPrompts(
    script: string,
    topic: string,
  ): Promise<string[]> {
    const ai = this.getAI();
    const response = await this.generateContentAutoContinue(ai, {
      model: "gemini-flash-lite-latest",
      contents: `Script: "${script}"
      Topic: "${topic}"
      
      TASK: Extract 5 descriptive, cinematic image prompts that visually represent the key scenes in this script.
      FORMAT: Return ONLY a JSON array of strings. No other text.
      STYLE: Photorealistic, 8k, cinematic lighting, epic composition.`,
    });

    const text = response.text?.trim() || "[]";
    try {
      const cleaned = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed;
      return [
        `Cinematic visual of ${topic}`,
        `Documentary style background for ${topic}`,
      ];
    } catch (e: any) {
      console.warn("Failed to parse visual prompts:", text);
      return [
        `Cinematic visual of ${topic}`,
        `Documentary style background for ${topic}`,
      ];
    }
  }

  async generateRecapScriptFromTopic(
    topic: string,
    targetLanguage: string = "Burmese",
    narratorVoice: string = "Thiha (Male)",
  ): Promise<string> {
    const ai = this.getAI();
    const languageName =
      targetLanguage === "Burmese"
        ? "Burmese (Myanmar Unicode)"
        : targetLanguage;
    const voicePersonality = this.getVoicePersonalityPrompt(
      narratorVoice,
      languageName,
    );

    const response = await this.generateContentAutoContinue(ai, {
      model: "gemini-flash-lite-latest",
      contents: `Generate a professional, detailed, perfectly sync timed movie recap JSON for: "${topic}". The voiceover should be in ${languageName} narrated by ${narratorVoice}.`,
      config: {
        systemInstruction: `You are an expert YouTube Movie Recap Automation Script & Prompt Engineer.
        
        ${voicePersonality}

        TASK:
        Generate a detailed, perfectly timed movie/video recap script and visual prompts in ${languageName} strictly adhering to "3 words per second" speech rate calculation for the given topic.
        
        RULES:
        1. Calculate the duration of each scene's voiceover_text precisely at a rate of 3 words per second.
        2. Ensure the start_time_seconds and end_time_seconds of each scene connect seamlessly without any gaps (e.g., scene 1 ends at 15s, scene 2 starts at 15s).
        3. Make sure the visual_prompt is highly detailed, vivid, cinematic, photorealistic, and matches the voiceover_text.
        4. The output MUST be a single clean valid JSON object following the format below.
        5. DO NOT include any conversational text, explanation or markdown formatting outside the JSON object.
        6. Always write all descriptions, voiceover_text and subtitle_text in the target language: ${languageName}.

        OUTPUT FORMAT:
        {
          "movie_title": "ရုပ်ရှင်အမည် သို့မဟုတ် ဇာတ်လမ်းခေါင်းစဉ်",
          "total_duration_seconds": 120,
          "scenes": [
            {
              "scene_number": 1,
              "start_time_seconds": 0,
              "end_time_seconds": 15,
              "duration_seconds": 15,
              "voiceover_text": "မြန်မာလို Movie Recap စာသား။ အသံထွက်ဖတ်ပါက ၁၅ စက္ကန့် အတိအကျ ကြာရပါမယ်။ (၃ လုံးလျှင် ၁ စက္ကန့်နှုန်းဖြင့် ၄၅ စကားလုံးခန့် ရှိရမည်)",
              "visual_prompt": "Cinematic, Pixar style animation, high contrast, golden hour lighting, ultra-sharp --ar 16:9",
              "subtitle_text": "အပေါ်က voiceover အတိုင်း ပြသမယ့် စာတန်းထိုးစာသား။"
            }
          ]
        }`,
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    });

    const result = response.text?.trim() || "Script generation failed.";
    if (targetLanguage === "Burmese") {
      return this.postProcessBurmeseJson(result);
    }
    return result;
  }

  async smartTimeScript(text: string, lang: string): Promise<string> {
    const ai = this.getAI();
    const response = await this.generateContentAutoContinue(ai, {
      model: "gemini-flash-lite-latest",
      contents: `Align this text to SRT: "${text}"`,
      config: {
        systemInstruction: "Return ONLY valid SRT content.",
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    });
    return response.text?.trim() || text;
  }

  async generateSpeech(
    text: string,
    primaryVoice: string = "Kore",
  ): Promise<AudioBuffer> {
    // Generate in smaller chunks (400 chars) to strictly enforce the selected voice
    // and prevent the AI from hallucinating or switching voices mid-generation.
    const chunks = this.chunkTextByParagraphs(text, 400);
    const ctx = this.getAudioContext();
    const buffers: AudioBuffer[] = [];

    for (const chunk of chunks) {
      const cleanChunk = chunk
        .replace(/\*\*[^*]+:\*\*/g, "") // Removes "**Narration:**" or "**Thiha:**"
        .replace(/\*\*[^*]+\*\*/g, "") // Removes any "**Narration**" bold markers
        .replace(/\*/g, "") // Removes any remaining raw asterisks
        .trim();
      if (!cleanChunk) continue;

      if (/^[a-z]{2,3}-[A-Z]{2}-.+Neural$/.test(primaryVoice)) {
        const response = await fetch("/api/edge-tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            voice: primaryVoice,
            text: cleanChunk,
          }),
        });
        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({})) as { error?: string };
          throw new Error(
            errorBody.error || `Microsoft Speech API returned status ${response.status}`,
          );
        }

        const provider = response.headers.get("X-TTS-Provider");
        const generatedVoice = response.headers.get("X-TTS-Voice");
        if (provider !== "Microsoft-Azure-Speech" || generatedVoice !== primaryVoice) {
          throw new Error(
            `Microsoft voice verification failed for ${primaryVoice}; no substitute voice was used.`,
          );
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        buffers.push(audioBuffer);
      } else {
        const geminiBuffer = await this.generateSpeechWithGemini(
          cleanChunk,
          primaryVoice,
          ctx,
        );
        buffers.push(geminiBuffer);
      }
    }

    if (buffers.length === 0) {
      throw new Error("No audio generated from text chunks.");
    }

    return this.concatenateAudioBuffers(buffers, ctx);
  }

  private async generateSpeechWithGemini(
    cleanChunk: string,
    primaryVoice: string,
    ctx: AudioContext,
  ): Promise<AudioBuffer> {
    const ai = this.getAI();
    let attempt = 0;
      let lastError: any = null;
    let response;
    while (attempt < 2) {
      try {
        response = await this.generateContentAutoContinue(ai, {
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text: cleanChunk }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: primaryVoice } },
            },
          },
        });
        break;
      } catch (e: any) {
        attempt++;
        if (attempt === 3) throw e;
        
          if (e.message && e.message.includes("429")) {
            console.log("Rate limit hit! Waiting 30 seconds before retry...");
            await new Promise((resolve) => setTimeout(resolve, 30000));
          } else {
            await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
          }
      }
    }
    if (!response) {
      throw new Error(`Gemini TTS returned null response`);
    }
    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
    }
    throw new Error("Gemini returned empty inline audio data");
  }
}

export const geminiService = new GeminiService();
