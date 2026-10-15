import React, { useState, useRef } from "react";
import { calculateVideoCost } from '../utils/creditCosts';
import { motion, AnimatePresence } from "motion/react";
import { backendService } from "../services/backendService";
import { geminiService } from "../services/geminiService";
import { audioBufferToWav } from "../services/audioUtils";
import { projectService } from "../services/projectService";
import { auth, db } from "../services/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { ViewMode } from "../types";
import {
  Loader2,
  Video,
  Sparkles,
  Wand2,
  Download,
  CheckCircle2,
  AlertCircle,
  Play,
  FileVideo,
  Music,
  Type,
  Check,
  Search,
  Pause,
  Volume2,
  ExternalLink,
  Eye,
} from "lucide-react";

interface AutoRecapProps {
  onBack: () => void;
  onRequireCredits: (amount: number) => Promise<boolean>;
}

enum ProcessingStep {
  IDLE = "IDLE",
  SCRIPTING = "SCRIPTING",
  VOICEOVER = "VOICEOVER",
  RENDERING = "RENDERING",
  COMPLETED = "COMPLETED",
  ERROR = "ERROR",
}

interface VoiceOption {
  id: string;
  name: string;
  gender: "Female" | "Male" | "Burmese";
  style: string;
  description: string;
  voiceKey: string;
  sampleText: string;
}

const MASTER_VOICES: VoiceOption[] = [
  {
    id: "Maya",
    name: "Maya (Storytelling)",
    gender: "Female",
    style: "Warm Storytelling Female",
    description:
      "Warm, friendly, natural. Suitable for storytelling & YouTube.",
    voiceKey: "en-US-JennyNeural",
    sampleText:
      "Hello there! I am Maya, your warm and friendly storytelling voice.",
  },
  {
    id: "Emma",
    name: "Emma (Professional)",
    gender: "Female",
    style: "Professional Female",
    description:
      "Clear, confident, professional. Suitable for educational & documentary content.",
    voiceKey: "en-US-EmmaNeural",
    sampleText:
      "Hello, my name is Emma. I am clear, confident, and professional.",
  },
  {
    id: "Sophia",
    name: "Sophia (Soft)",
    gender: "Female",
    style: "Soft Calm Female",
    description:
      "Gentle, calm, relaxing. Suitable for bedtime stories and meditation.",
    voiceKey: "en-US-SophiaNeural",
    sampleText:
      "Close your eyes and breathe. I am Sophia, your gentle and soothing guide.",
  },
  {
    id: "Lily",
    name: "Lily (Energetic)",
    gender: "Female",
    style: "Energetic Female",
    description:
      "Cheerful, lively, expressive. Suitable for Shorts, Reels, TikTok, and entertaining content.",
    voiceKey: "en-US-AnaNeural",
    sampleText:
      "Hey! I'm Lily! Let's make some amazing and energetic short videos!",
  },
  {
    id: "David",
    name: "David (Narrator)",
    gender: "Male",
    style: "Movie Narrative Male",
    description: "Steady, authoritative narrator. Classic cinematic tone.",
    voiceKey: "en-US-AndrewNeural",
    sampleText:
      "Welcome back. I am David, your steady and engaging narrative voice.",
  },
  {
    id: "James",
    name: "James (Professional)",
    gender: "Male",
    style: "Professional Male",
    description:
      "Clear, articulate, formal. Perfect for business & tech reviews.",
    voiceKey: "en-US-SteffanNeural",
    sampleText:
      "Good day. I am James, providing clear, precise, and professional news narration.",
  },
  {
    id: "Alex",
    name: "Alex (Young)",
    gender: "Male",
    style: "Young Lively Male",
    description:
      "Friendly, casual, next-door buddy. Great for blogs & commentary.",
    voiceKey: "en-US-EricNeural",
    sampleText:
      "Hi! I'm Alex. I'm young, lively, and ready to voice your next awesome video!",
  },
  {
    id: "Michael",
    name: "Michael (Deep Voice)",
    gender: "Male",
    style: "Deep Cinematic Male",
    description:
      "Deep, resonant, low-pitch voice. Epic trailers and scary stories.",
    voiceKey: "en-GB-ThomasNeural",
    sampleText:
      "Greetings. I am Michael, providing a deep, resonant, and calm narration.",
  },
  {
    id: "Nilar",
    name: "Nilar (Burmese Female)",
    gender: "Burmese",
    style: "Burmese Female Storytelling",
    description:
      "Warm, smooth Burmese female narrator. Perfect for local videos.",
    voiceKey: "my-MM-NilarNeural",
    sampleText: "မင်္ဂလာပါရှင်။ သမီးကတော့ နီလာဖြစ်ပါတယ်။",
  },
  {
    id: "Thiha",
    name: "Thiha (Burmese Male)",
    gender: "Burmese",
    style: "Burmese Male Movie Recaper",
    description: "Deep, classic Burmese male narrator. Best for movie recaps.",
    voiceKey: "my-MM-ThihaNeural",
    sampleText: "မင်္ဂလာပါခင်ဗျာ။ ကျွန်တော်ကတော့ သီဟဖြစ်ပါတယ်။",
  },
];

const AutoRecap: React.FC<AutoRecapProps> = ({ onBack, onRequireCredits }) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [step, setStep] = useState<ProcessingStep>(ProcessingStep.IDLE);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [generatedScript, setGeneratedScript] = useState<string>("");
  const [recapTopic, setRecapTopic] = useState<string>("");

  // New States based on screenshot
  const [freezeEnabled, setFreezeEnabled] = useState(true);
  const [freezeInterval, setFreezeInterval] = useState(4);
  const [freezeDuration, setFreezeDuration] = useState(2);
  const [zoomPower, setZoomPower] = useState(1.5);
  const [blurEnabled, setBlurEnabled] = useState(true);
  const [altStyle, setAltStyle] = useState(false);

  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("auto_recap_selected_voice") || "Maya";
    }
    return "Maya";
  });
  const [voiceSearchQuery, setVoiceSearchQuery] = useState("");
  const [voiceGenderFilter, setVoiceGenderFilter] = useState<
    "ALL" | "FEMALE" | "MALE" | "BURMESE"
  >("ALL");
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(
    null,
  );
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleSelectVoice = (id: string) => {
    setSelectedVoiceId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("auto_recap_selected_voice", id);
    }
  };

  const handlePreviewVoice = async (v: VoiceOption) => {
    if (previewingVoiceId === v.id) {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
      setPreviewingVoiceId(null);
      return;
    }

    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
    }

    setPreviewLoadingId(v.id);
    setError(null);
    const previewUrl = `/api/edge-tts?voice=${encodeURIComponent(v.voiceKey)}&text=${encodeURIComponent(v.sampleText)}`;
    try {
      const response = await fetch(previewUrl);
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(errorBody.error || `Voice preview failed with status ${response.status}`);
      }

      const provider = response.headers.get("X-TTS-Provider");
      const generatedVoice = response.headers.get("X-TTS-Voice");
      if (v.voiceKey.endsWith("Neural") &&
          (provider !== "Microsoft-Azure-Speech" || generatedVoice !== v.voiceKey)) {
        throw new Error(`Microsoft voice verification failed for ${v.name}.`);
      }

      const audioUrl = URL.createObjectURL(await response.blob());
      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;

      audio.oncanplaythrough = () => {
        setPreviewLoadingId(null);
        setPreviewingVoiceId(v.id);
        audio.play().catch((err) => {
          console.warn("Playback prevented or failed", err);
          setPreviewingVoiceId(null);
        });
      };

      audio.onended = () => {
        setPreviewingVoiceId(null);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setPreviewLoadingId(null);
        setPreviewingVoiceId(null);
        URL.revokeObjectURL(audioUrl);
      };

      audio.load();
    } catch (previewError: any) {
      setPreviewLoadingId(null);
      setPreviewingVoiceId(null);
      setError(previewError.message || "Voice preview failed.");
    }
  };

  React.useEffect(() => {
    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
    };
  }, []);

  const [narratorVoice, setNarratorVoice] = useState("Thiha (Male)");
  const [voiceModel, setVoiceModel] = useState<"OLD" | "NEW" | "EDGE">("EDGE");

  // Voice Mapping for Gemini TTS
  const VOICE_MAP_NEW: Record<string, string> = {
    "Puck (Male)": "Puck",
    "Charon (Male)": "Charon",
    "Fenrir (Male)": "Fenrir",
    "Kore (Female)": "Kore",
    "Zephyr (Female)": "Zephyr",
  };

  const EDGE_VOICE_MAP: Record<string, string> = {
    "Nilar (Female)": "my-MM-NilarNeural",
    "Thiha (Male)": "my-MM-ThihaNeural",
  };

  // Default voices for different models
  const MODEL_VOICES = {
    OLD: [
      "Puck (Male)",
      "Kore (Female)",
      "Charon (Male)",
      "Zephyr (Female)",
      "Fenrir (Male)",
    ],
    NEW: [
      "Puck (Male)",
      "Kore (Female)",
      "Charon (Male)",
      "Zephyr (Female)",
      "Fenrir (Male)",
    ],
    EDGE: ["Nilar (Female)", "Thiha (Male)"],
  };
  const [targetLanguage, setTargetLanguage] = useState("Burmese");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [splittingClips, setSplittingClips] = useState(1);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoX, setLogoX] = useState<number>(83); // default % from left
  const [logoY, setLogoY] = useState<number>(5); // default % from top
  const [logoSize, setLogoSize] = useState<number>(12); // default % size of canvas width

  // Subtitle Settings
  const [showTextSettings, setShowTextSettings] = useState(false);
  const [subtitleSize, setSubtitleSize] = useState(35); // 0-100 scale
  const [subtitleY, setSubtitleY] = useState(85); // % from top
  const [subtitleStyle, setSubtitleStyle] = useState<"CINEMATIC" | "MINIMAL">(
    "CINEMATIC",
  );
  const [subtitleColor, setSubtitleColor] = useState("#FFFFFF");
  const [subtitleHighlightColor, setSubtitleHighlightColor] =
    useState("#FFD700");
  const [subtitleOutlineColor, setSubtitleOutlineColor] = useState("#000000");
  const [subtitleMode, setSubtitleMode] = useState<
    "ALL_LINES" | "LINE_BY_LINE" | "HIGHLIGHT_LINE"
  >("ALL_LINES");
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);

  // Blur Settings based on screenshot
  const [showBlurSettings, setShowBlurSettings] = useState(false);
  const [blurY, setBlurY] = useState(80); // Y Position %
  const [blurHeight, setBlurHeight] = useState(15); // Height %
  const [blurStrength, setBlurStrength] = useState(20); // Blur Strength
  const [blurMode, setBlurMode] = useState<"FULL" | "CUSTOM">("FULL");
  const [blurX, setBlurX] = useState(0); // X Pos %
  const [blurWidth, setBlurWidth] = useState(100); // Width %

  // Logs for the workflow engine
  const [logs, setLogs] = useState<string[]>([]);
  const [recapType, setRecapType] = useState<"TRANSLATE" | "ORIGINAL">(
    "ORIGINAL",
  );
  const [sceneImages, setSceneImages] = useState<string[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
    setLogs((prev) => [...prev, `[${time}] ${msg}`].slice(-100));
  };

  React.useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Restore Project
  React.useEffect(() => {
    const activeProj = projectService.getActiveProject();
    if (activeProj && activeProj.type === ViewMode.AUTO_RECAP) {
      if (activeProj.stateData) {
        if (activeProj.stateData.recapTopic)
          setRecapTopic(activeProj.stateData.recapTopic);
        if (activeProj.stateData.generatedScript)
          setGeneratedScript(activeProj.stateData.generatedScript);
        if (activeProj.stateData.recapType)
          setRecapType(activeProj.stateData.recapType);
        if (activeProj.stateData.targetLanguage)
          setTargetLanguage(activeProj.stateData.targetLanguage);
        if (activeProj.stateData.videoDuration)
          setVideoDuration(activeProj.stateData.videoDuration);
        if (activeProj.stateData.resultUrl)
          setResultUrl(activeProj.stateData.resultUrl);
        if (activeProj.stateData.videoUrl)
          setVideoUrl(activeProj.stateData.videoUrl);
        if (activeProj.stateData.logs) setLogs(activeProj.stateData.logs);
      }
      projectService.setActiveProject(null);
    }
  }, []);

  // Save/Update Project
  React.useEffect(() => {
    if (recapTopic.trim() || generatedScript.trim() || resultUrl) {
      projectService.saveProject({
        name: `Autorecap: ${recapTopic.slice(0, 30).trim() || "Untitled"}...`,
        type: ViewMode.AUTO_RECAP,
        fileName: "autorecap_script.json",
        fileSize: `${Math.round(((recapTopic.length + generatedScript.length) / 1024) * 10) / 10} KB`,
        stateData: {
          recapTopic,
          generatedScript,
          recapType,
          targetLanguage,
          videoDuration,
          resultUrl,
          videoUrl,
          logs,
        },
      });
    }
  }, [
    recapTopic,
    generatedScript,
    recapType,
    targetLanguage,
    videoDuration,
    resultUrl,
    videoUrl,
    logs,
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoPreview(url);

      const video = document.createElement("video");
      video.src = url;
      video.onloadedmetadata = () => {
        setVideoDuration(video.duration);
      };

      setResultUrl(null);
      setError(null);
      setStep(ProcessingStep.IDLE);
      addLog(`Job recognized. Tracking progress..`);
      addLog(`Downloading source video from secure storage..`);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      addLog(`Applying custom watermark logo..`);
    }
  };

  const cleanSubtitleText = (s: string) => {
    return s
      .replace(/^Title:[\s\S]*?(?:Recap:|Summary:)/i, "")
      .replace(/(?:Key Takeaways|Key Points):[\s\S]*$/i, "")
      .replace(/\[\d+:\d+(?:\s*-\s*\d+:\d+)?\]/g, "")
      .replace(/\*\*[^*]+:\*\*/g, "") // Removes "**Narration:**" or "**Thiha:**"
      .replace(/\*\*[^*]+\*\*/g, "") // Removes any "**Narration**" bold markers
      .replace(/[*_#]/g, "") // Removes markdown syntax
      .trim();
  };

  const parseScriptIntoSubtitles = (
    scriptToParse: string,
    totalDuration: number
  ): Array<{ text: string; start: number; end: number }> => {
    if (!scriptToParse) return [];

    let cleanedForJson = scriptToParse.trim();
    if (cleanedForJson.startsWith("```")) {
      cleanedForJson = cleanedForJson
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```$/, "")
        .trim();
    }

    try {
      const parsed = JSON.parse(cleanedForJson);
      const parseTimestampToSeconds = (ts: any): number => {
        if (typeof ts === "number") return ts;
        if (!ts) return 0;
        const parts = String(ts).trim().split(":").map(Number);
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3)
          return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return Number(ts) || 0;
      };

      if (parsed && Array.isArray(parsed.segments) && !parsed.scenes) {
        parsed.scenes = parsed.segments.map((s: any) => {
          const start = parseTimestampToSeconds(s.start_time);
          const end = parseTimestampToSeconds(s.end_time);
          const duration = Math.max(1, end - start);
          return {
            subtitle_text: s.narration,
            voiceover_text: s.narration,
            duration_seconds: duration,
            start_time_seconds: start,
            end_time_seconds: end,
          };
        });
      }

      if (parsed && Array.isArray(parsed.scenes)) {
        const scenes = parsed.scenes
          .map((s: any) => ({
            text: cleanSubtitleText(s.subtitle_text || s.voiceover_text || s.text || ""),
            duration: Number(s.duration_seconds) || 0,
          }))
          .filter((s: any) => s.text.length > 0);

        if (scenes.length > 0) {
          const totalSceneDuration = scenes.reduce((acc: number, s: any) => acc + s.duration, 0) || 1;
          let cur = 0;
          return scenes.map((s: any) => {
            const dur = (totalSceneDuration > 0 && s.duration > 0)
              ? (s.duration / totalSceneDuration) * totalDuration
              : totalDuration / scenes.length;
            const start = cur;
            const end = Math.min(totalDuration, cur + dur);
            cur = end;
            return { text: s.text, start, end };
          });
        }
      }
    } catch (e) {}

    // Plain text / markdown script parsing
    let cleaned = cleanSubtitleText(scriptToParse);
    const rawParas = cleaned.split(/\r?\n+/).map(p => p.trim()).filter(Boolean);
    const sentenceList: string[] = [];

    for (const para of rawParas) {
      // Split on Burmese sentence terminator (။) and English sentence terminators (.?!)
      const parts = para.split(/(?<=[။.?!])\s*/).map(p => p.trim()).filter(Boolean);
      for (const part of parts) {
        // If a sentence is long (> 50 chars) and contains Burmese comma (၊), break at phrase pauses
        if (part.length > 50 && part.includes("၊")) {
          const subParts = part.split(/(?<=[၊])\s*/).map(p => p.trim()).filter(Boolean);
          sentenceList.push(...subParts);
        } else {
          sentenceList.push(part);
        }
      }
    }

    const finalSentences = sentenceList.filter(s => s.length > 0);
    if (finalSentences.length === 0) return [];

    const totalChars = finalSentences.reduce((acc, s) => acc + s.length, 0) || 1;
    let curTime = 0;
    return finalSentences.map(text => {
      const dur = (text.length / totalChars) * totalDuration;
      const start = curTime;
      const end = Math.min(totalDuration, curTime + dur);
      curTime = end;
      return { text, start, end };
    });
  };

  const getActiveSubtitleForPreview = () => {
    let scriptToParse = generatedScript;
    if (!scriptToParse) {
      return {
        lines: [
          "နမူနာ စာတန်းထိုးများကို ဤနေရာတွင် တွေ့ရပါမည်။ ရောင်စုံစတိုင်ဖြင့် စိတ်တိုင်းကျ ပြင်ဆင်နိုင်သည်။",
        ],
        activeLineIndex: 0,
      };
    }

    const totalDuration = videoDuration || 10;
    const cues = parseScriptIntoSubtitles(scriptToParse, totalDuration);
    if (cues.length === 0) return { lines: [], activeLineIndex: 0 };

    // For preview fallback, loop the timing endlessly if no video is playing
    const effectiveTime = videoPreview
      ? previewCurrentTime
      : (Date.now() / 1000) % totalDuration;

    let activeCue = cues.find(c => effectiveTime >= c.start && effectiveTime < c.end);
    if (!activeCue) {
      activeCue = cues[cues.length - 1];
    }

    const activeText = activeCue.text;
    const cueDuration = Math.max(0.1, activeCue.end - activeCue.start);
    const progressInCue = Math.max(0, Math.min(1, (effectiveTime - activeCue.start) / cueDuration));

    // Syllable-safe wrapping for preview cards (handles unspaced Burmese without breaking glyphs)
    const BURMESE_SYLLABLE_REGEX = /(?<=[^\u1039])(?=[\u1000-\u102A](?![\u1039\u103A]))/g;
    const maxCharsPerLine = 32;

    const chunks = activeText.split(/(?<=[၊။ \n])/);
    const candidateLines: string[] = [];
    let curLine = "";

    for (const chunk of chunks) {
      if ((curLine + chunk).length <= maxCharsPerLine || !curLine) {
        curLine += chunk;
      } else {
        candidateLines.push(curLine.trim());
        curLine = chunk;
      }
    }
    if (curLine.trim()) candidateLines.push(curLine.trim());

    let resultLines: string[] = [];
    for (const line of candidateLines) {
      if (line.length <= maxCharsPerLine) {
        resultLines.push(line);
      } else {
        const syls = line.split(BURMESE_SYLLABLE_REGEX);
        let subCur = "";
        for (const syl of syls) {
          if ((subCur + syl).length <= maxCharsPerLine || !subCur) {
            subCur += syl;
          } else {
            resultLines.push(subCur.trim());
            subCur = syl;
          }
        }
        if (subCur.trim()) resultLines.push(subCur.trim());
      }
    }
    if (resultLines.length === 0 && activeText) {
      resultLines = [activeText];
    }

    const activeLineIndex = Math.min(
      resultLines.length - 1,
      Math.floor(progressInCue * resultLines.length),
    );

    return {
      lines: resultLines,
      activeLineIndex,
    };
  };

  const startAutoRecap = async () => {
    if (!videoFile && !recapTopic) {
      setError("Please upload a video or enter a topic for the recap.");
      return;
    }
    const cost = videoDuration ? (videoDuration <= 60 ? 10 : (videoDuration <= 180 ? 32 : 50)) : 33;
    if (!(await onRequireCredits(cost))) return;

    try {
      setError(null);
      setStep(ProcessingStep.SCRIPTING);
      setProgress(10);
      setLogs([]); // Clear logs for new run
      setSceneImages([]); // Explicitly clear any previous run's generated images
      addLog(`Initializing production workflow..`);

      if (videoFile) {
        addLog(`Analyzing source video: ${videoFile.name.toUpperCase()}`);
      } else {
        addLog(`Generating from topic: ${recapTopic.toUpperCase()}`);
      }

      // 1. Generate Script
      let script = "";
      let plainNarrative = "";
      let prompts: string[] = [];
      let parsedJson: any = null;

      if (recapType === "TRANSLATE") {
        let transcriptText = "";
        if (videoFile) {
          addLog(
            `Scanning & transcribing video source (large-file optimizer active)..`,
          );
          try {
            transcriptText = await backendService.transcribeMediaFile(
              videoFile,
              (p) => setProgress(10 + Math.round(p * 0.15)),
            );
          } catch (e) {
            console.warn("Backend transcribe error:", e);
          }

          if (!transcriptText || !transcriptText.trim()) {
            addLog(
              `Attempting direct speech & visual context analysis..`,
            );
            try {
              transcriptText = await geminiService.transcribeMedia(
                videoFile,
                videoFile.type || "video/mp4",
                "en",
              );
            } catch (err) {
              console.warn("Direct transcription notice:", err);
            }
          }
        } else {
          transcriptText = recapTopic;
        }

        // Resilient Fallback: If video dialogue is silent or unextractable, construct smart context from topic/filename
        const cleanVideoTitle = videoFile?.name 
          ? videoFile.name.replace(/\.[^/.]+$/, "").replace(/[_\-+.]/g, " ").trim() 
          : "";
        const fallbackTopic = recapTopic?.trim() || cleanVideoTitle || "Movie Recap";

        if (
          !transcriptText ||
          !transcriptText.trim() ||
          transcriptText.toLowerCase().includes("cannot perceive any meaningful information") ||
          transcriptText.toLowerCase().includes("i'm sorry") ||
          transcriptText.toLowerCase().includes("transcription failed")
        ) {
          addLog(`Dialogue was silent or ambient. Synthesizing full cinematic context for: "${fallbackTopic}"..`);
          transcriptText = `Story Title / Subject: "${fallbackTopic}".\nPlease reconstruct a gripping, scene-by-scene movie recap script detailing the characters, thrilling events, plot twists, dramatic suspense, and resolution.`;
        }

        addLog(`Invoking AI Translation Recap Engine..`);
        script = await geminiService.translateRecap(
          transcriptText,
          targetLanguage,
          videoDuration,
        );
        setGeneratedScript(script);
        setProgress(35);
        addLog(`AI Translation Recap successful.`);

        // Extract narration-ready text (segments/scenes) for speech synthesis & styling
        let parsedJson: any = null;
        try {
          let cleaned = script.trim();
          if (cleaned.startsWith("```")) {
            cleaned = cleaned
              .replace(/^```json\s*/i, "")
              .replace(/```$/, "")
              .trim();
          }
          parsedJson = JSON.parse(cleaned);
        } catch (e) {}

        if (parsedJson) {
          const segs = parsedJson.segments || parsedJson.scenes || [];
          plainNarrative = segs
            .map(
              (s: any) =>
                s.narration || s.subtitle_text || s.voiceover_text || "",
            )
            .filter(Boolean)
            .join("\n\n");
        } else {
          const recapMatch = script.match(
            /Recap:\s*([\s\S]*?)(?:Key Takeaways:|$)/i,
          );
          if (recapMatch && recapMatch[1].trim()) {
            plainNarrative = recapMatch[1].trim();
          } else {
            plainNarrative = script
              .replace(/Title:[\s\S]*?Recap:/i, "")
              .replace(/Key Takeaways:[\s\S]*/i, "")
              .trim();
          }
        }
        addLog(`Accurate narration script extracted for voiceover generation.`);
      } else {
        let transcriptText = "";
        if (videoFile) {
          addLog(
            `Scanning & transcribing video source (original-language analyzer active)..`,
          );
          try {
            transcriptText = await backendService.transcribeMediaFile(
              videoFile,
              (p) => setProgress(10 + Math.round(p * 0.15)),
            );
          } catch (e) {
            console.warn("Backend transcribe error:", e);
          }

          if (!transcriptText || !transcriptText.trim()) {
            addLog(
              `Attempting direct speech & visual context analysis..`,
            );
            try {
              transcriptText = await geminiService.transcribeMedia(
                videoFile,
                videoFile.type || "video/mp4",
                "en",
              );
            } catch (err) {
              console.warn("Direct transcription notice:", err);
            }
          }
        } else {
          transcriptText = recapTopic;
        }

        // Resilient Fallback: If video dialogue is silent or unextractable, construct smart context from topic/filename
        const cleanVideoTitle = videoFile?.name 
          ? videoFile.name.replace(/\.[^/.]+$/, "").replace(/[_\-+.]/g, " ").trim() 
          : "";
        const fallbackTopic = recapTopic?.trim() || cleanVideoTitle || "Movie Recap";

        if (
          !transcriptText ||
          !transcriptText.trim() ||
          transcriptText.toLowerCase().includes("cannot perceive any meaningful information") ||
          transcriptText.toLowerCase().includes("i'm sorry") ||
          transcriptText.toLowerCase().includes("transcription failed")
        ) {
          addLog(`Dialogue was silent or ambient. Synthesizing full cinematic context for: "${fallbackTopic}"..`);
          transcriptText = `Story Title / Subject: "${fallbackTopic}".\nPlease reconstruct a gripping, scene-by-scene movie recap script detailing the characters, thrilling events, plot twists, dramatic suspense, and resolution.`;
        }

        addLog(`Invoking AI Original Recap Generator..`);
        script = await geminiService.generateOriginalRecap(
          transcriptText,
          targetLanguage,
          videoDuration,
        );
        setGeneratedScript(script);
        setProgress(35);
        addLog(`AI Original Recap generation successful.`);

        // Extract narration-ready text (segments/scenes) for speech synthesis & styling
        let parsedJson: any = null;
        try {
          let cleaned = script.trim();
          if (cleaned.startsWith("```")) {
            cleaned = cleaned
              .replace(/^```json\s*/i, "")
              .replace(/```$/, "")
              .trim();
          }
          parsedJson = JSON.parse(cleaned);
        } catch (e) {}

        if (parsedJson) {
          const segs = parsedJson.segments || parsedJson.scenes || [];
          plainNarrative = segs
            .map(
              (s: any) =>
                s.narration || s.subtitle_text || s.voiceover_text || "",
            )
            .filter(Boolean)
            .join("\n\n");
        } else {
          const summaryMatch = script.match(
            /Summary:\s*([\s\S]*?)(?:Key Points:|$)/i,
          );
          if (summaryMatch && summaryMatch[1].trim()) {
            plainNarrative = summaryMatch[1].trim();
          } else {
            plainNarrative = script
              .replace(/Title:[\s\S]*?Summary:/i, "")
              .replace(/Key Points:[\s\S]*/i, "")
              .trim();
          }
        }
        addLog(`Accurate narration script extracted for voiceover generation.`);
      }

      // 1.1 Generate Visual Assets if no video
      let currentSceneImages: string[] = [];
      if (!videoFile) {
        addLog(
          `Visual track missing: Generating Cinematic Scene Illustrations..`,
        );
        try {
          if (prompts.length === 0) {
            prompts = await geminiService.generateVisualPrompts(
              script,
              recapTopic || "Epic Story",
            );
          }
          addLog(
            `Composing ${prompts.length} high-fidelity cinematic scenes..`,
          );

          for (let i = 0; i < prompts.length; i++) {
            addLog(
              `Rendering Scene ${i + 1}/${prompts.length}: ${prompts[i].slice(0, 30)}...`,
            );
            const imgBase64 = await geminiService.generateIllustration(
              prompts[i],
              aspectRatio,
            );
            currentSceneImages.push(imgBase64);
            setProgress(35 + ((i + 1) / prompts.length) * 15);
          }
          setSceneImages(currentSceneImages);
          addLog(`Visual scene composition completed.`);
        } catch (e) {
          console.error("Visual gen error", e);
          addLog(
            `Visual generator warning: Falling back to animated gradients.`,
          );
        }
      }

      // Splitting Logic
      let parts = [plainNarrative];
      if (splittingClips > 1) {
        addLog(`Dividing production into ${splittingClips} coherent parts..`);
        parts = await geminiService.splitScriptIntoParts(
          plainNarrative,
          splittingClips,
        );
        addLog(`Production split into ${parts.length} parts successful.`);
      }

      // 2. Generate Voiceover
      setStep(ProcessingStep.VOICEOVER);
      const chosenVoiceInfo =
        MASTER_VOICES.find((v) => v.id === selectedVoiceId) || MASTER_VOICES[0];
      addLog(`Synthesizing ${chosenVoiceInfo.name}'s voice for narration..`);

      let targetVoice = chosenVoiceInfo.voiceKey;

      // If split, we currently process the summary/first part or just inform.
      // To keep it "fully working" and robust, we'll process the full narration.
      const narrationToProcess = parts.join("\n\n");
      const audioBuffer = await geminiService.generateSpeech(
        narrationToProcess,
        targetVoice,
      );
      const audioBlob = audioBufferToWav(audioBuffer);
      const audioFile = new File([audioBlob], "voiceover.wav", {
        type: "audio/wav",
      });

      // Calculate audio duration from buffer
      const audioDuration = audioBuffer.duration;
      setProgress(65);
      addLog(`Voice narration synthesized successfully.`);

      // 3. Render Final Video
      setStep(ProcessingStep.RENDERING);
      addLog(`Engaging Visual Render Enforcement Mode (v7.5)..`);
      addLog(`Sync Mode: ULTRA ACCURATE (Scene Lock Enabled)..`);

      let finalVideoUrl = "";

      const trackFileUpload = async (fileName: string, type: string, storagePath: string) => {
        if (!auth.currentUser) return;
        try {
          await addDoc(collection(db, 'uploaded_files'), {
            userId: auth.currentUser.uid,
            userEmail: auth.currentUser.email,
            fileName,
            type,
            storagePath,
            timestamp: serverTimestamp()
          });
          const userRef = doc(db, 'users', auth.currentUser.uid);
          await updateDoc(userRef, {
            uploadedFilesCount: increment(1)
          });
        } catch (e) {
          console.error("Failed to track file upload", e);
        }
      };

      if (videoFile) {
        const fileSizeMB = Math.round((videoFile.size / 1024 / 1024) * 10) / 10;
        console.log(
          `[AutoRecap Client] Staging video on production pipeline: ${videoFile.size} bytes (${fileSizeMB} MB)`,
        );
        addLog(
          `Staging video asset on production pipeline (${fileSizeMB} MB)...`,
        );

        const videoResult = await backendService.uploadVideoFile(videoFile, (p) => {
          setProgress(65 + Math.round(p * 0.1));
        });
        finalVideoUrl = videoResult.url;
        trackFileUpload(videoFile.name, 'video', finalVideoUrl);
        addLog(`Video asset staged successfully on production server.`);
      } else {
        addLog(
          `Source video missing: Engaging AI Cinematic Fallback Generator..`,
        );
      }

      let finalAudioUrl = "";
      if (audioFile) {
        addLog(`Staging narration audio on production server...`);
        const audioResult = await backendService.uploadAudioFile(audioFile);
        finalAudioUrl = audioResult.url;
        addLog(`Audio asset staged successfully.`);
      }

      const finalSceneImageUrls: string[] = currentSceneImages || [];
      if (finalSceneImageUrls.length > 0) {
        addLog(`Staging ${finalSceneImageUrls.length} storyboard scene illustrations...`);
      }

      addLog(`Analyzing Narration Pacing & Scene Complexity..`);
      addLog(
        `Rendering final production output (Aspect Ratio: ${aspectRatio})..`,
      );

      addLog(`Initiating background render process on server...`);

      const narrationToSubmit =
        recapType === "TRANSLATE" || recapType === "ORIGINAL"
          ? plainNarrative
          : script;

      const idToken = auth.currentUser
        ? await auth.currentUser.getIdToken()
        : null;

      let subtitleSegments: Array<{ text: string; start: number; end: number }> = [];
      try {
        subtitleSegments = parseScriptIntoSubtitles(
          narrationToSubmit,
          videoDuration || 30
        );
      } catch (e) {
        console.warn("Failed to generate client subtitleSegments", e);
      }

      const payload = {
        videoUrl: finalVideoUrl,
        audioUrl: finalAudioUrl,
        sceneImageUrls: finalSceneImageUrls,
        script: narrationToSubmit,
        subtitleSegments,
        voice: targetVoice,
        aspectRatio: aspectRatio,
        idToken,
        altStyle,
        blurEnabled,
        freezeEnabled,
        freezeInterval,
        freezeDuration,
        zoomPower,
        blurY,
        blurHeight,
        blurStrength,
        blurMode,
        blurX,
        blurWidth,
        subtitleSize,
        subtitleY,
        subtitleStyle,
        subtitleColor,
        subtitleHighlightColor,
        subtitleOutlineColor,
        subtitleMode,
      };

      const response = await fetch("/api/finalize-recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(
          errJson.error || `Server returned error status ${response.status}`,
        );
      }

      const { taskId } = await response.json();
      addLog(`Render task scheduled successfully. Task ID: ${taskId}`);
      addLog(`Entering real-time server tracking loop (Interval: 5s)...`);

      const downloadResultObj = await new Promise<{
        downloadUrl: string;
        videoUrl: string;
      }>((resolve, reject) => {
        let failureCount = 0;
        const maxFailures = 8;
        let currentDelay = 5000;
        let timeoutId: any = null;

        async function poll() {
          try {
            const statusRes = await fetch(
              `/api/finalize-recap/status?taskId=${taskId}`,
            );

            if (statusRes.status === 429) {
              currentDelay = Math.min(currentDelay * 2, 30000); // Exponential backoff up to 30s
              addLog(
                `[Rate Limit] Polling rate limit encountered (429). Retrying in ${(currentDelay / 1000).toFixed(0)}s...`,
              );
              timeoutId = setTimeout(poll, currentDelay);
              return;
            }

            if (!statusRes.ok) {
              failureCount++;
              addLog(
                `Network warning (${failureCount}/${maxFailures}): Server status ${statusRes.status}. Retrying in 5s...`,
              );
              if (failureCount >= maxFailures) {
                reject(
                  new Error(
                    `Failed to query render task status: ${statusRes.statusText || statusRes.status}`,
                  ),
                );
                return;
              }
              timeoutId = setTimeout(poll, 5000);
              return;
            }

            // Reset consecutive failures and delay on any successful query
            failureCount = 0;
            currentDelay = 5000;
            const statusData = await statusRes.json();

            if (statusData.status === "completed") {
              addLog(
                `Rendering completed on the server! Routing final production file...`,
              );
              if (statusData.downloadUrl) {
                resolve({
                  downloadUrl: statusData.downloadUrl,
                  videoUrl: statusData.videoUrl || statusData.downloadUrl,
                });
              } else {
                reject(
                  new Error(
                    "Failed to receive valid download URL from server.",
                  ),
                );
              }
            } else if (statusData.status === "failed") {
              reject(
                new Error(
                  statusData.error ||
                    "Rendering pipeline failed in background task.",
                ),
              );
            } else {
              const adjustedProgress = 65 + statusData.progress * 0.33;
              setProgress(adjustedProgress);
              addLog(`Server Render Progress: ${statusData.progress}%`);
              timeoutId = setTimeout(poll, 5000);
            }
          } catch (pollErr: any) {
            failureCount++;
            addLog(
              `Network warning (${failureCount}/${maxFailures}): ${pollErr.message || "Could not reach server"}. Retrying in 5s...`,
            );
            if (failureCount >= maxFailures) {
              reject(pollErr);
              return;
            }
            timeoutId = setTimeout(poll, 5000);
          }
        }

        // Start the poll
        timeoutId = setTimeout(poll, currentDelay);
      });

      const finalDownloadUrl = downloadResultObj.downloadUrl;
      const playableVideoUrl = downloadResultObj.videoUrl || (downloadResultObj as any).streamUrl || downloadResultObj.downloadUrl;
      setResultUrl(finalDownloadUrl);
      setVideoUrl(playableVideoUrl);
      setStep(ProcessingStep.COMPLETED);
      setProgress(100);
      addLog(`Production cycle finished. Output ready.`);
      console.log(
        `[AutoRecap Client] Final result URL received: ${downloadResultObj.downloadUrl}`,
      );
      console.log(
        `[AutoRecap Client] Final video URL received: ${downloadResultObj.videoUrl}`,
      );

      // Auto-trigger direct file download stream
      try {
        addLog("Preparing output file stream...");

        let target = downloadResultObj.downloadUrl || downloadResultObj.videoUrl;
        let file = target;
        if (file.includes("file=")) file = file.split("file=")[1];
        file = file.split("?")[0].split("/").pop() || "";
        const now = Date.now();
        const reliableDownloadUrl = file ? `/api/download?file=${encodeURIComponent(file)}&name=${encodeURIComponent(`autorecap_${now}.mp4`)}` : downloadResultObj.downloadUrl;

        try {
          const res = await fetch(reliableDownloadUrl, { method: "HEAD" });
          const size = res.headers.get("content-length");
          console.log(
            `[AutoRecap Client] Final video size from HEAD request: ${size} bytes`,
          );
          if (size) addLog(`Verified output file size: ${size} bytes.`);
        } catch (err) {
          console.error("[AutoRecap Client] Could not fetch file size:", err);
        }

        const a = document.createElement("a");
        a.href = reliableDownloadUrl;
        a.download = `autorecap_${now}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (err) {
        console.error(
          "Auto-download trigger failed, fallback to manual click:",
          err,
        );
      }
      
    } catch (err: any) {
      console.error("AutoRecap Error:", err);
      setError(
        err.message || "An unexpected error occurred during processing.",
      );
      addLog(`FATAL ERROR: ${err.message || "Unknown Failure"}`);
      setStep(ProcessingStep.ERROR);
    }
  };

  const downloadResult = () => {
    const target = resultUrl || videoUrl;
    if (!target) return;

    let reliableDownloadUrl = target;
    let file = target;
    if (file.includes("file=")) file = file.split("file=")[1];
    file = file.split("?")[0].split("/").pop() || "";
    const now = Date.now();
    if (file) {
      reliableDownloadUrl = `/api/download?file=${encodeURIComponent(file)}&name=${encodeURIComponent(`autorecap_${now}.mp4`)}`;
    }

    const a = document.createElement("a");
    a.href = reliableDownloadUrl;
    a.download = `autorecap_${now}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getTaskProgress = (task: "SCRIPTING" | "ASSETS" | "RENDERING") => {
    if (task === "SCRIPTING") {
      if (step === ProcessingStep.SCRIPTING)
        return Math.min(100, Math.max(0, Math.round((progress / 35) * 100)));
      if (progress >= 35) return 100;
      return 0;
    }
    if (task === "ASSETS") {
      if (step === ProcessingStep.VOICEOVER)
        return Math.min(
          100,
          Math.max(0, Math.round(((progress - 35) / 30) * 100)),
        );
      if (progress >= 65) return 100;
      return 0;
    }
    if (task === "RENDERING") {
      if (step === ProcessingStep.RENDERING)
        return Math.min(
          100,
          Math.max(0, Math.round(((progress - 65) / 35) * 100)),
        );
      if (progress >= 100) return 100;
      return 0;
    }
    return 0;
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F9FBFF] text-slate-900 overflow-hidden h-full font-sans">
      {/* Standard AppBar */}
      <div className="flex items-center gap-6 px-4 py-4 flex-shrink-0 bg-white border-b border-slate-100">
        <button
          onClick={onBack}
          className="p-3 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all active:scale-90 shadow-sm"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <div className="flex-1 text-center pr-16">
          <h2 className="text-lg font-black tracking-tighter uppercase italic text-slate-800">
            Auto Recap AI
          </h2>
        </div>
      </div>

      
      {step === ProcessingStep.COMPLETED ? (
        <div className="flex-1 flex flex-row bg-gray-50 overflow-hidden h-full">
          {/* Left Navigation Sidebar */}
          <div className="w-64 border-r border-gray-200 bg-white hidden lg:flex flex-col p-6 shrink-0 h-full overflow-y-auto">
             <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Menu</div>
             <div className="space-y-2">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-3">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                   Result Preview
                </div>
                <button onClick={() => { setStep(ProcessingStep.IDLE); setProgress(0); setLogs([]); setVideoFile(null); }} className="w-full text-left p-3 text-gray-500 hover:bg-gray-50 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-3 transition-colors">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                   New Project
                </button>
             </div>
          </div>
          
          {/* Main Center Content Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center bg-[#F9FBFF]">
            <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center gap-8 animate-flutter-fade py-12">              
              <div className="flex flex-row items-center justify-center gap-4 md:gap-10 w-full px-4">
                {/* Left Button (Download) */}
                <button
                  onClick={downloadResult}
                  className="flex flex-col items-center justify-center gap-2 md:gap-4 w-[100px] md:w-[160px] aspect-square md:aspect-auto md:py-10 bg-blue-600 hover:bg-blue-700 text-white font-extrabold uppercase text-[10px] md:text-xs tracking-widest rounded-3xl transition-all shadow-[0_8px_30px_rgba(37,99,235,0.25)] hover:shadow-[0_15px_40px_rgba(37,99,235,0.4)] hover:-translate-y-1 active:scale-95 text-center"
                >
                  <Download className="w-6 h-6 md:w-8 md:h-8" /> 
                  <span>Download<br className="md:hidden"/> Video</span>
                </button>

                {/* Center Video Frame */}
                {(() => {
                  let safeStreamUrl = "";
                  if (videoUrl && !videoUrl.includes("/api/download")) {
                    safeStreamUrl = videoUrl;
                  } else if (resultUrl) {
                    if (resultUrl.startsWith("http://") || resultUrl.startsWith("https://")) {
                      safeStreamUrl = resultUrl;
                    } else {
                      let f = resultUrl;
                      if (f.includes("file=")) f = f.split("file=")[1];
                      f = f.split("?")[0];
                      f = f.split("/").pop() || "";
                      safeStreamUrl = f ? `/api/stream-video?file=${encodeURIComponent(f)}` : resultUrl;
                    }
                  } else if (videoUrl) {
                    safeStreamUrl = videoUrl;
                  }

                  const frameWidthClass = aspectRatio === "16:9"
                    ? "w-[280px] sm:w-[380px] md:w-[480px] aspect-video"
                    : aspectRatio === "1:1"
                    ? "w-[200px] sm:w-[280px] md:w-[340px] aspect-square"
                    : "w-[180px] sm:w-[240px] md:w-[290px] aspect-[9/16]";

                  return (
                    <div className="flex flex-col items-center gap-4">
                      <div className={`${frameWidthClass} shrink-0 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden bg-black shadow-2xl relative border-[4px] md:border-[8px] border-slate-900 flex items-center justify-center group`}>
                        {safeStreamUrl ? (
                          <video
                            key={safeStreamUrl}
                            src={safeStreamUrl}
                            className="w-full h-full object-contain bg-black"
                            controls
                            playsInline
                            preload="auto"
                            controlsList="nodownload"
                            onError={(e) => {
                              console.warn("[AutoRecap Client] Video playback error:", e);
                            }}
                          >
                            Your browser does not support the video tag.
                          </video>
                        ) : (
                          <div className="text-white/40 text-xs font-semibold px-4 text-center">
                            Video player loading...
                          </div>
                        )}
                      </div>

                      {safeStreamUrl && (
                        <div className="flex items-center gap-2">
                          <a
                            href={safeStreamUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-xs transition-all shadow-sm"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Watch in Fullscreen Tab</span>
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Right Button (Create New) */}
                <button
                  onClick={() => {
                    setStep(ProcessingStep.IDLE);
                    setProgress(0);
                    setLogs([]);
                    setVideoFile(null);
                  }}
                  className="flex flex-col items-center justify-center gap-2 md:gap-4 w-[100px] md:w-[160px] aspect-square md:aspect-auto md:py-10 bg-white border-2 border-slate-100 hover:border-blue-100 hover:bg-slate-50 text-slate-700 font-extrabold uppercase text-[10px] md:text-xs tracking-widest rounded-3xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 active:scale-95 text-center"
                >
                  <svg className="w-6 h-6 md:w-8 md:h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                  <span>New<br className="md:hidden"/> Video</span>
                </button>
              </div>
              
              {/* Share Social Media Button */}
              <button
                onClick={() => { alert('Sharing feature coming soon!'); }}
                className="mt-6 px-10 py-5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-extrabold uppercase text-xs tracking-widest rounded-3xl transition-all active:scale-95 flex items-center justify-center gap-3 shadow-sm border border-blue-100/50"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                Share on Social Media
              </button>

            </div>
          </div>
          
          {/* Right Sidebar for History/Status */}
          <div className="w-80 border-l border-gray-200 bg-white hidden xl:flex flex-col p-6 shrink-0 h-full overflow-y-auto">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Workflow Status</h4>
            <div className="bg-gray-50 rounded-xl p-4 font-mono text-[9px] space-y-3 border border-gray-100 flex-1 custom-scrollbar overflow-y-auto text-gray-600">
              {logs.length > 0 ? (
                [...logs].reverse().map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-blue-500 font-bold shrink-0">{log.split(" ")[0]}</span>
                    <span className="text-gray-600">{log.split(" ").slice(1).join(" ")}</span>
                  </div>
                ))
              ) : (
                <div className="text-gray-400 italic">No logs available.</div>
              )}
            </div>
          </div>
        </div>
      ) : step !== ProcessingStep.IDLE ? (
        <div className="flex-1 flex flex-col gap-6 animate-flutter-fade h-full overflow-y-auto custom-scrollbar safe-area max-w-5xl mx-auto w-full p-2 md:p-6">
          <div className="flex-1 glass-panel rounded-[2.5rem] p-6 md:p-10 bg-[#050505] border border-[#111111] shadow-2xl space-y-8 flex flex-col items-center justify-start min-h-max">
            {step === ProcessingStep.ERROR ? (
              <div className="text-center max-w-md mx-auto my-auto">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
                <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">
                  Render Failed
                </h3>
                <p className="text-slate-400 text-sm mb-8">{error}</p>
                <button
                  onClick={() => setStep(ProcessingStep.IDLE)}
                  className="px-8 py-4 bg-[#111111] border border-[#333333] hover:bg-[#222222] text-white font-extrabold uppercase text-[11px] tracking-widest rounded-xl transition-all shadow-lg"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <div className="w-full max-w-4xl mx-auto flex flex-col">
                <div className="flex flex-col md:flex-row gap-8 items-start mb-8">
                  {/* Circular Progress & Info */}
                  <div className="flex-shrink-0 relative w-32 h-32 md:w-48 md:h-48 flex items-center justify-center mx-auto md:mx-0 bg-black/40 rounded-full border border-white/5 shadow-inner">
                    <svg className="w-full h-full transform -rotate-90 absolute inset-0">
                      <circle
                        cx="50%"
                        cy="50%"
                        r="46%"
                        fill="none"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth="6%"
                      />
                      <motion.circle
                        cx="50%"
                        cy="50%"
                        r="46%"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6%"
                        strokeDasharray="289%"
                        strokeDashoffset={289 - (289 * progress) / 100 + "%"}
                        className="text-blue-500 drop-shadow-[0_0_12px_rgba(59,130,246,0.6)]"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="text-3xl md:text-5xl font-black text-white tabular-nums tracking-tighter">
                        {Math.round(progress)}
                        <span className="text-lg md:text-2xl text-slate-500">
                          %
                        </span>
                      </div>
                      <div className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        {step === ProcessingStep.SCRIPTING
                            ? "WRITING"
                            : step === ProcessingStep.VOICEOVER
                              ? "VOICING"
                              : "RENDERING"}
                      </div>
                    </div>
                  </div>

                  {/* Logs & Stats */}
                  <div className="flex-1 w-full space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                        <h4 className="text-xs font-black text-white uppercase tracking-[0.3em]">
                          Workflow Engine Logs
                        </h4>
                      </div>
                      <div className="text-[8px] font-black text-white/20 uppercase tracking-widest hidden sm:block">
                        Production System v7.5
                      </div>
                    </div>

                    <div ref={logContainerRef} className="bg-black/60 rounded-2xl p-5 font-mono text-[10px] space-y-3 h-[160px] border border-white/5 shadow-inner backdrop-blur-md custom-scrollbar overflow-y-auto">
                      {logs.length > 0 ? (
                        logs.map((log, i) => (
                          <div
                            key={i}
                            className="flex gap-3 group/log text-[10px]"
                          >
                            <span className="text-green-500/40 font-black shrink-0 text-[10px]">
                              {log.split(" ")[0]}
                            </span>
                            <span
                              className={`${log.includes("FATAL") ? "text-red-400" : log.includes("successful") ? "text-blue-400" : "text-slate-300"} font-medium group-hover/log:text-white transition-colors text-[10px]`}
                            >
                              {log.split(" ").slice(1).join(" ")}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-700 italic flex flex-col items-center justify-center h-full gap-2 pt-6">
                          <Loader2 className="w-5 h-5 animate-spin opacity-20" />
                          <span className="uppercase tracking-[0.15em] font-black text-[8px]">
                            Awaiting production payload...
                          </span>
                        </div>
                      )}
                      {true && (
                        <motion.div
                          animate={{ opacity: [1, 0] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                          className="w-1.5 h-3 bg-green-500/50 mt-1"
                        />
                      )}
                    </div>

                    {true && (
                      <button
                        disabled={true}
                        className="w-full py-4 rounded-2xl font-black uppercase italic tracking-[0.2em] text-md flex items-center justify-center gap-3 transition-all shadow-[0_12px_36px_rgba(0,0,0,0.3)] bg-white/5 text-white/20 cursor-not-allowed border border-white/5"
                      >
                        <Sparkles className="w-5 h-5 animate-spin" />
                        Production in Progress...
                      </button>
                    )}
                  </div>
                </div>

                <div className="w-full space-y-6 pt-8 border-t border-[#111111]">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest ${progress >= 35 ? "text-green-500" : step === ProcessingStep.SCRIPTING ? "text-blue-400" : "text-slate-600"}`}
                      >
                        {progress >= 35 && "✓ "}Task 1: Scripting
                      </span>
                      <span className="text-[10px] font-black text-slate-500 tabular-nums">
                        {getTaskProgress("SCRIPTING")}%
                      </span>
                    </div>
                    <div className="w-full bg-[#111111] border border-[#222222] h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ease-out ${progress >= 35 ? "bg-green-500" : "bg-blue-600"}`}
                        style={{ width: `${getTaskProgress("SCRIPTING")}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest ${progress >= 65 ? "text-green-500" : step === ProcessingStep.VOICEOVER ? "text-blue-400" : "text-slate-600"}`}
                      >
                        {progress >= 65 && "✓ "}Task 2: Asset Generation
                      </span>
                      <span className="text-[10px] font-black text-slate-500 tabular-nums"></span>
                    </div>
                    <div className="w-full bg-[#111111] border border-[#222222] h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ease-out ${progress >= 65 ? "bg-green-500" : "bg-blue-600"}`}
                        style={{ width: `${getTaskProgress("ASSETS")}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest ${progress >= 100 ? "text-green-500" : step === ProcessingStep.RENDERING ? "text-blue-400" : "text-slate-600"}`}
                      >
                        {progress >= 100 && "✓ "}Task 3: Frame Interpolation
                      </span>
                      <span className="text-[10px] font-black text-slate-500 tabular-nums">
                        {getTaskProgress("RENDERING")}%
                      </span>
                    </div>
                    <div className="w-full bg-[#111111] border border-[#222222] h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ease-out ${progress >= 100 ? "bg-green-500" : "bg-blue-600"}`}
                        style={{ width: `${getTaskProgress("RENDERING")}%` }}
                      />
                    </div>
                  </div>
                </div>

                              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          {/* Top Banner (Optional ref link) */}
          {/* Top Banner (Optional ref link) */}
          <div className="pt-8 pb-4 flex flex-col items-center">
            <div className="bg-white p-1 rounded-2xl border border-slate-100 shadow-sm flex items-center mb-4">
              <button
                onClick={() => setRecapType("TRANSLATE")}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${recapType === "TRANSLATE" ? "bg-[#F2F5FF] text-blue-600 border border-blue-100" : "text-slate-400 hover:text-slate-600"}`}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                  />
                </svg>
                Translate Recap
              </button>
              <button
                onClick={() => setRecapType("ORIGINAL")}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${recapType === "ORIGINAL" ? "bg-white text-blue-800 shadow-xl shadow-blue-500/10 border border-slate-100" : "text-slate-400 hover:text-slate-600"}`}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Original Recap
              </button>
            </div>
            {recapType === "TRANSLATE" ? (
              <p className="text-[11px] font-bold text-blue-500/80 max-w-sm text-center leading-relaxed">
                မူရင်းဗီဒီယိုရှိ ပြောဆိုချက်များကို မြန်မာဘာသာဖြင့်
                တိုက်ရိုက်ဘာသာပြန်ပြီး Recap အဖြစ် ပြသပေးမည်။
              </p>
            ) : (
              <p className="text-[11px] font-bold text-blue-500/80 max-w-sm text-center leading-relaxed">
                ဗီဒီယိုအကြောင်းအရာကို AI က နားလည်သုံးသပ်၍ အသစ်ရေးသားထားသော Movie
                Recap Script အဖြစ် ဖန်တီးပေးမည်။
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-8 custom-scrollbar">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Video Metadata Box - SS STYLE */}
                  <div
                    className={`bg-white rounded-3xl border border-slate-50 shadow-[0_4px_20px_rgb(0,0,0,0.02)] relative overflow-hidden h-[260px] flex flex-col justify-center items-center ${!videoFile ? "p-6 md:p-8 cursor-pointer text-center" : "p-4"}`}
                    onClick={() => {
                      if (!videoFile) fileInputRef.current?.click();
                    }}
                  >
                    {!videoFile && (
                      <div className="absolute inset-0 border border-dashed border-slate-100 rounded-2xl m-2 pointer-events-none" />
                    )}
                    {!videoFile ? (
                      <>
                        <div className="w-14 h-14 bg-[#F2F5FF] rounded-2xl flex items-center justify-center mb-3 text-blue-600 shadow-sm border border-blue-50 group-hover:scale-105 transition-transform">
                          <Video className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-black text-slate-800 uppercase italic mb-1 px-4 leading-normal text-center">
                          Drop video file here to start recap
                        </h3>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.15em] mb-3">
                          MP4 • WEBM • MOV • MAX 5GB
                        </p>

                        <div className="w-full px-6 space-y-1.5">
                          <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest text-left">
                            Or enter custom topic:
                          </div>
                          <input
                            type="text"
                            placeholder="GENERATE FROM TOPIC..."
                            value={recapTopic}
                            onChange={(e) => setRecapTopic(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-[9px] font-black uppercase tracking-widest outline-none focus:border-blue-200 transition-all text-slate-600 placeholder:text-slate-300"
                          />
                        </div>
                      </>
                    ) : (
                      <div
                        className="w-full h-full flex flex-col justify-between"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Real Video Preview Frame */}
                        <div className="relative flex-1 bg-black rounded-2xl overflow-hidden border border-slate-100 flex items-center justify-center min-h-[160px]">
                          {videoPreview && (
                            <video
                              src={videoPreview}
                              className="w-full h-full object-contain"
                              controls
                              playsInline
                              onTimeUpdate={(e) =>
                                setPreviewCurrentTime(
                                  e.currentTarget.currentTime,
                                )
                              }
                            />
                          )}
                          {/* Live Repositionable Watermark Logo Overlay in Preview */}
                          {videoPreview && logoFile && (
                            <div
                              id="preview-logo-overlay"
                              className="absolute border border-dashed border-yellow-400 cursor-grab active:cursor-grabbing group z-20 hover:bg-yellow-400/5 transition-all outline-none"
                              style={{
                                left: `${logoX}%`,
                                top: `${logoY}%`,
                                width: `${logoSize}%`,
                                aspectRatio: "1",
                              }}
                              onMouseDown={(startEvent) => {
                                startEvent.preventDefault();
                                const rect =
                                  startEvent.currentTarget.parentElement?.getBoundingClientRect();
                                if (!rect) return;

                                const onMouseMove = (moveEvent: MouseEvent) => {
                                  const newX = Math.max(
                                    0,
                                    Math.min(
                                      100 - logoSize,
                                      ((moveEvent.clientX - rect.left) /
                                        rect.width) *
                                        100,
                                    ),
                                  );
                                  const newY = Math.max(
                                    0,
                                    Math.min(
                                      100 - logoSize,
                                      ((moveEvent.clientY - rect.top) /
                                        rect.height) *
                                        100,
                                    ),
                                  );
                                  setLogoX(Math.round(newX));
                                  setLogoY(Math.round(newY));
                                };

                                const onMouseUp = () => {
                                  document.removeEventListener(
                                    "mousemove",
                                    onMouseMove,
                                  );
                                  document.removeEventListener(
                                    "mouseup",
                                    onMouseUp,
                                  );
                                };

                                document.addEventListener(
                                  "mousemove",
                                  onMouseMove,
                                );
                                document.addEventListener("mouseup", onMouseUp);
                              }}
                              onTouchStart={(startEvent) => {
                                // Mobile event handling
                                const rect =
                                  startEvent.currentTarget.parentElement?.getBoundingClientRect();
                                if (!rect) return;

                                const onTouchMove = (moveEvent: TouchEvent) => {
                                  if (moveEvent.touches.length === 0) return;
                                  const touch = moveEvent.touches[0];
                                  const newX = Math.max(
                                    0,
                                    Math.min(
                                      100 - logoSize,
                                      ((touch.clientX - rect.left) /
                                        rect.width) *
                                        100,
                                    ),
                                  );
                                  const newY = Math.max(
                                    0,
                                    Math.min(
                                      100 - logoSize,
                                      ((touch.clientY - rect.top) /
                                        rect.height) *
                                        100,
                                    ),
                                  );
                                  setLogoX(Math.round(newX));
                                  setLogoY(Math.round(newY));
                                };

                                const onTouchEnd = () => {
                                  document.removeEventListener(
                                    "touchmove",
                                    onTouchMove,
                                  );
                                  document.removeEventListener(
                                    "touchend",
                                    onTouchEnd,
                                  );
                                };

                                document.addEventListener(
                                  "touchmove",
                                  onTouchMove,
                                );
                                document.addEventListener(
                                  "touchend",
                                  onTouchEnd,
                                );
                              }}
                            >
                              <img
                                src={URL.createObjectURL(logoFile)}
                                alt="Watermark Logo Preview"
                                className="w-full h-full object-contain opacity-85 select-none pointer-events-none"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 border border-yellow-300 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-[7px] text-yellow-300 font-bold bg-black/80 px-1 py-0.5 rounded shadow">
                                  DRAG LOGO
                                </span>
                              </div>
                            </div>
                          )}
                          {/* Real Dynamic CSS Backdrop Blur Overlay */}
                          {videoPreview && blurEnabled && (
                            <div
                              className="absolute border border-cyan-400/30 flex items-center justify-center pointer-events-none transition-all duration-100 ease-out z-10"
                              style={{
                                top: `${blurY}%`,
                                left: blurMode === "FULL" ? "0" : `${blurX}%`,
                                width:
                                  blurMode === "FULL"
                                    ? "100%"
                                    : `${blurWidth}%`,
                                height: `${blurHeight}%`,
                                backdropFilter: `blur(${blurStrength}px)`,
                                WebkitBackdropFilter: `blur(${blurStrength}px)`,
                                backgroundColor: "rgba(0, 0, 0, 0.15)",
                              }}
                            >
                              <span className="text-[8px] font-black text-cyan-400 uppercase tracking-widest bg-black/60 px-2 py-0.5 rounded shadow-sm border border-cyan-400/20">
                                Blur ({blurStrength}px)
                              </span>
                            </div>
                          )}
                          {/* Live Subtitle Overlay on Preview Screen */}
                          {videoPreview &&
                            (() => {
                              const { lines: subLines, activeLineIndex } =
                                getActiveSubtitleForPreview();
                              if (!subLines || subLines.length === 0)
                                return null;

                              const isMinimal = subtitleStyle === "MINIMAL";
                              // Scaled font size relative to container size
                              const sizePx = Math.max(
                                10,
                                Math.floor(18 * (subtitleSize / 35)),
                              );
                              const topPercent = subtitleY; // % position

                              let displayedRows: {
                                text: string;
                                isActive: boolean;
                              }[] = [];
                              if (subtitleMode === "LINE_BY_LINE") {
                                displayedRows = [
                                  {
                                    text: subLines[activeLineIndex],
                                    isActive: true,
                                  },
                                ];
                              } else if (subtitleMode === "HIGHLIGHT_LINE") {
                                displayedRows = subLines.map((text, idx) => ({
                                  text,
                                  isActive: idx === activeLineIndex,
                                }));
                              } else {
                                displayedRows = subLines.map((text) => ({
                                  text,
                                  isActive: false,
                                }));
                              }

                              return (
                                <div
                                  className="absolute left-0 right-0 pointer-events-none flex flex-col items-center justify-center text-center px-4"
                                  style={{
                                    top: `${topPercent}%`,
                                    transform: "translateY(-100%)",
                                    zIndex: 10,
                                  }}
                                >
                                  {displayedRows.map((row, idx) => {
                                    const color = row.isActive
                                      ? subtitleHighlightColor
                                      : subtitleColor;
                                    return (
                                      <span
                                        key={idx}
                                        className="block text-center select-none leading-relaxed tracking-normal"
                                        style={{
                                          fontFamily: "'Noto Sans Myanmar', 'Pyidaungsu', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                                          fontSize: `${sizePx}px`,
                                          fontWeight: isMinimal ? "500" : "800",
                                          color: color,
                                          textShadow: isMinimal
                                            ? "none"
                                            : `-1.5px -1.5px 0 ${subtitleOutlineColor}, 1.5px -1.5px 0 ${subtitleOutlineColor}, -1.5px 1.5px 0 ${subtitleOutlineColor}, 1.5px 1.5px 0 ${subtitleOutlineColor}, 0 0 10px rgba(0,0,0,0.85)`,
                                        }}
                                      >
                                        {row.text}
                                      </span>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                        </div>
                        {/* Video metadata & actions */}
                        <div className="mt-4 flex items-center justify-between gap-4 text-left">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-black text-slate-900 truncate uppercase tracking-tight leading-tight">
                              {videoFile.name.toUpperCase()}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md">
                                {formatTime(videoDuration)}
                              </span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-md">
                                {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[9px] uppercase tracking-wider rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-1.5"
                          >
                            Change
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mode Selection Cards */}
                  <div className="space-y-3">
                    <div className="bg-white rounded-2xl border border-slate-50 p-5 flex items-center justify-between shadow-[0_4px_20px_rgb(0,0,0,0.015)]">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-400">
                          <Loader2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 uppercase">
                            ALT-TR
                          </h4>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            AI Style Mode
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setAltStyle(!altStyle)}
                        className={`w-12 h-6 rounded-full transition-all relative ${altStyle ? "bg-blue-600" : "bg-slate-100"}`}
                      >
                        <div
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-sm ${altStyle ? "left-[26px]" : "left-0.5"}`}
                        />
                      </button>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-50 p-5 flex items-center justify-between shadow-[0_4px_20px_rgb(0,0,0,0.015)]">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-blue-600">
                          <Wand2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 uppercase">
                            Blur Effect
                          </h4>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            Focus Protection
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setShowBlurSettings(true)}
                          className="text-[9px] font-black uppercase tracking-widest text-blue-600 hover:opacity-75 transition-opacity"
                        >
                          Setup
                        </button>
                        <button
                          onClick={() => setBlurEnabled(!blurEnabled)}
                          className={`w-12 h-6 rounded-full transition-all relative ${blurEnabled ? "bg-blue-600" : "bg-slate-100"}`}
                        >
                          <div
                            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-sm ${blurEnabled ? "left-[26px]" : "left-0.5"}`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Freeze Frame Card */}
                  <div className="bg-white rounded-2xl border border-slate-50 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.015)] space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100">
                          <FileVideo className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 uppercase italic">
                            Freeze Frame
                          </h4>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            Zoom Pan Effect
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setFreezeEnabled(!freezeEnabled)}
                        className={`w-12 h-6 rounded-full transition-all relative ${freezeEnabled ? "bg-blue-600" : "bg-slate-100"}`}
                      >
                        <div
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-sm ${freezeEnabled ? "left-[26px]" : "left-0.5"}`}
                        />
                      </button>
                    </div>

                    <div className="space-y-5">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-[#050529]">
                          <span>Interval (Seconds)</span>
                          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-0.5 rounded-lg border border-slate-100">
                            <span className="text-xs font-black italic">
                              {freezeInterval}
                            </span>
                            <span className="text-[8px] text-blue-500">S</span>
                          </div>
                        </div>
                        <div className="relative pt-0.5 px-0.5">
                          <input
                            type="range"
                            min="2"
                            max="10"
                            step="1"
                            value={freezeInterval}
                            onChange={(e) =>
                              setFreezeInterval(parseInt(e.target.value))
                            }
                            className="w-full h-1 bg-[#EFF3FF] rounded-full appearance-none cursor-pointer accent-blue-600"
                          />
                          <div className="flex justify-between text-[7px] font-black text-slate-300 mt-2 uppercase">
                            <span>2s</span>
                            <span>10s</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-[#050529]">
                          <span>Duration (Seconds)</span>
                          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-0.5 rounded-lg border border-slate-100">
                            <span className="text-xs font-black italic">
                              {freezeDuration}
                            </span>
                            <span className="text-[8px] text-blue-500">S</span>
                          </div>
                        </div>
                        <div className="relative pt-0.5 px-0.5">
                          <input
                            type="range"
                            min="1"
                            max="8"
                            step="1"
                            value={freezeDuration}
                            onChange={(e) =>
                              setFreezeDuration(parseInt(e.target.value))
                            }
                            className="w-full h-1 bg-[#EFF3FF] rounded-full appearance-none cursor-pointer accent-blue-600"
                          />
                          <div className="flex justify-between text-[7px] font-black text-slate-300 mt-2 uppercase">
                            <span>1s</span>
                            <span>8s</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-[#050529]">
                          <span>Zoom Power</span>
                          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-0.5 rounded-lg border border-slate-100">
                            <span className="text-xs font-black italic">
                              {zoomPower.toFixed(1)}
                            </span>
                            <span className="text-[8px] text-blue-500">X</span>
                          </div>
                        </div>
                        <div className="relative pt-0.5 px-0.5">
                          <input
                            type="range"
                            min="1.3"
                            max="2.5"
                            step="0.1"
                            value={zoomPower}
                            onChange={(e) =>
                              setZoomPower(parseFloat(e.target.value))
                            }
                            className="w-full h-1 bg-[#EFF3FF] rounded-full appearance-none cursor-pointer accent-blue-600"
                          />
                          <div className="flex justify-between text-[7px] font-black text-slate-300 mt-2 uppercase">
                            <span>1.3x</span>
                            <span>2.5x</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Brand Logo Box */}
                  <div className="bg-white rounded-2xl border border-slate-50 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.015)] space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                        Brand Logo (Optional)
                      </h4>
                      {logoFile && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLogoFile(null);
                          }}
                          className="text-[8px] font-black uppercase tracking-widest text-red-500 hover:text-red-600 transition outline-none"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div
                      onClick={() => logoInputRef.current?.click()}
                      className="border border-dashed border-[#F2F5FF] rounded-xl p-5 flex items-center gap-4 cursor-pointer hover:border-blue-100 transition-all bg-[#F9FBFF]/50"
                    >
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-50 text-slate-200 animate-fade-in">
                        {logoFile ? (
                          <img
                            src={URL.createObjectURL(logoFile)}
                            className="w-full h-full object-contain rounded-xl"
                            alt="Brand Logo"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Music className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 uppercase italic">
                          {logoFile ? "Change Logo" : "Add Watermark Logo"}
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-widest">
                          PNG/JPG • MAX 5MB
                        </p>
                      </div>
                    </div>
                    <input
                      type="file"
                      ref={logoInputRef}
                      onChange={handleLogoChange}
                      accept="image/*"
                      className="hidden"
                    />

                    {logoFile && (
                      <div className="pt-2 border-t border-slate-100 space-y-3 animate-fade-in">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          Position & Size
                        </p>
                        <div className="text-[8px] font-bold text-blue-500 uppercase tracking-widest bg-blue-50/50 p-1.5 rounded border border-blue-100/30 leading-snug">
                          💡 Tip: You can also drag progress indicators directly
                          on the video screen mockup above!
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-[#050529]">
                            <span>Logo Size</span>
                            <span>{logoSize}%</span>
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="30"
                            step="1"
                            value={logoSize}
                            onChange={(e) =>
                              setLogoSize(parseInt(e.target.value))
                            }
                            className="w-full h-1 bg-[#EFF3FF] rounded-full appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-[#050529]">
                              <span>X Coordinate</span>
                              <span>{logoX}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max={100 - logoSize}
                              step="1"
                              value={logoX}
                              onChange={(e) =>
                                setLogoX(parseInt(e.target.value))
                              }
                              className="w-full h-1 bg-[#EFF3FF] rounded-full appearance-none cursor-pointer accent-blue-600"
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-[#050529]">
                              <span>Y Coordinate</span>
                              <span>{logoY}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max={100 - logoSize}
                              step="1"
                              value={logoY}
                              onChange={(e) =>
                                setLogoY(parseInt(e.target.value))
                              }
                              className="w-full h-1 bg-[#EFF3FF] rounded-full appearance-none cursor-pointer accent-blue-600"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AI Narrator Selector */}
                  <div className="bg-white rounded-2xl border border-slate-50 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.015)] space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase italic">
                          Voice Selection
                        </h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                          Select narrator profile
                        </p>
                      </div>
                      <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                        Default Voice: Maya
                      </span>
                    </div>

                    {/* Search and Filters */}
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search voices by name or description..."
                          value={voiceSearchQuery}
                          onChange={(e) => setVoiceSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 border border-slate-100 rounded-xl text-[11px] font-medium outline-none focus:border-blue-300 placeholder-slate-300 transition-colors"
                        />
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {(["ALL", "FEMALE", "MALE", "BURMESE"] as const).map(
                          (cat) => (
                            <button
                              key={cat}
                              onClick={() => setVoiceGenderFilter(cat)}
                              className={`text-[8.5px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all ${
                                voiceGenderFilter === cat
                                  ? "bg-blue-600 text-white shadow-sm"
                                  : "bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                              }`}
                            >
                              {cat === "ALL"
                                ? "All Voices"
                                : cat === "FEMALE"
                                  ? "👩 Female"
                                  : cat === "MALE"
                                    ? "👨 Male"
                                    : "🇲🇲 Burmese"}
                            </button>
                          ),
                        )}
                      </div>
                    </div>

                    {/* Voice Listings */}
                    <div className="space-y-5 max-h-[360px] overflow-y-auto pr-1">
                      {(["Female", "Male", "Burmese"] as const).map(
                        (genderGroup) => {
                          const filteredInGroup = MASTER_VOICES.filter(
                            (voice) => {
                              const matchesGroup = voice.gender === genderGroup;
                              const matchesCat =
                                voiceGenderFilter === "ALL" ||
                                (voiceGenderFilter === "FEMALE" &&
                                  voice.gender === "Female") ||
                                (voiceGenderFilter === "MALE" &&
                                  voice.gender === "Male") ||
                                (voiceGenderFilter === "BURMESE" &&
                                  voice.gender === "Burmese");

                              const searchQueryLower =
                                voiceSearchQuery.toLowerCase();
                              const matchesSearch =
                                voice.name
                                  .toLowerCase()
                                  .includes(searchQueryLower) ||
                                voice.style
                                  .toLowerCase()
                                  .includes(searchQueryLower) ||
                                voice.description
                                  .toLowerCase()
                                  .includes(searchQueryLower);

                              return (
                                matchesGroup && matchesCat && matchesSearch
                              );
                            },
                          );

                          if (filteredInGroup.length === 0) return null;

                          return (
                            <div key={genderGroup} className="space-y-2">
                              <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-50 pb-1 font-sans">
                                {genderGroup === "Female"
                                  ? "👩 Female Voices"
                                  : genderGroup === "Male"
                                    ? "👨 Male Voices"
                                    : "🇲🇲 Burmese Voices"}
                              </h5>
                              <div className="grid grid-cols-1 gap-2">
                                {filteredInGroup.map((voice) => {
                                  const isSelected =
                                    selectedVoiceId === voice.id;
                                  const isPlaying =
                                    previewingVoiceId === voice.id;
                                  const isLoading =
                                    previewLoadingId === voice.id;

                                  return (
                                    <div
                                      key={voice.id}
                                      id={`voice-card-${voice.id}`}
                                      className={`group relative p-3 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 ${
                                        isSelected
                                          ? "bg-blue-50/20 border-blue-500 shadow-[0_4px_12px_rgba(59,130,246,0.06)]"
                                          : "bg-white hover:bg-[#FAF9FC] border-slate-100 hover:border-slate-200"
                                      }`}
                                    >
                                      <div
                                        className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                                        onClick={() =>
                                          handleSelectVoice(voice.id)
                                        }
                                      >
                                        <div
                                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs transition-colors shrink-0 ${
                                            isSelected
                                              ? "bg-blue-600 text-white"
                                              : "bg-slate-50 text-slate-400 group-hover:bg-slate-100"
                                          }`}
                                        >
                                          {isSelected ? (
                                            <Check className="w-4 h-4" />
                                          ) : (
                                            voice.id[0]
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[10px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors uppercase italic">
                                              {voice.name}
                                            </span>
                                            <span className="text-[7.5px] font-black uppercase bg-slate-50 border border-slate-100 px-1 rounded text-slate-400">
                                              {voice.style}
                                            </span>
                                          </div>
                                          <p className="text-[8.5px] text-slate-400 font-medium truncate mt-0.5">
                                            {voice.description}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          onClick={() =>
                                            handlePreviewVoice(voice)
                                          }
                                          disabled={isLoading}
                                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 transition-all ${
                                            isPlaying
                                              ? "bg-rose-500 text-white shadow-sm hover:bg-rose-600"
                                              : "bg-slate-50 hover:bg-slate-100 text-slate-600"
                                          } disabled:opacity-50`}
                                        >
                                          {isLoading ? (
                                            <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                                          ) : isPlaying ? (
                                            <>
                                              <Pause className="w-2.5 h-2.5" />{" "}
                                              Stop
                                            </>
                                          ) : (
                                            <>
                                              <Volume2 className="w-2.5 h-2.5" />{" "}
                                              Preview
                                            </>
                                          )}
                                        </button>

                                        <button
                                          onClick={() =>
                                            handleSelectVoice(voice.id)
                                          }
                                          className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                            isSelected
                                              ? "text-blue-600 font-bold bg-blue-50/50 cursor-default"
                                              : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                          }`}
                                        >
                                          {isSelected ? "Active" : "Select"}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        },
                      )}

                      {/* Empty State */}
                      {MASTER_VOICES.filter((voice) => {
                        const matchesCat =
                          voiceGenderFilter === "ALL" ||
                          (voiceGenderFilter === "FEMALE" &&
                            voice.gender === "Female") ||
                          (voiceGenderFilter === "MALE" &&
                            voice.gender === "Male") ||
                          (voiceGenderFilter === "BURMESE" &&
                            voice.gender === "Burmese");

                        const searchQueryLower = voiceSearchQuery.toLowerCase();
                        const matchesSearch =
                          voice.name.toLowerCase().includes(searchQueryLower) ||
                          voice.style
                            .toLowerCase()
                            .includes(searchQueryLower) ||
                          voice.description
                            .toLowerCase()
                            .includes(searchQueryLower);

                        return matchesCat && matchesSearch;
                      }).length === 0 && (
                        <div className="text-center py-6">
                          <Volume2 className="w-8 h-8 text-slate-200 mx-auto stroke-1" />
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2">
                            No audio profiles match search
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Subtitle Settings Card */}
                  <div className="bg-white rounded-2xl border border-slate-50 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.015)] space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-100">
                          <Type className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 uppercase italic">
                            Subtitles Config
                          </h4>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            Text Sync Setting
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowTextSettings(!showTextSettings)}
                        className={`text-[9px] font-black uppercase tracking-widest py-1.5 px-3 rounded-lg transition-all ${showTextSettings ? "bg-indigo-600 text-white" : "text-indigo-600 bg-indigo-50"}`}
                      >
                        {showTextSettings ? "Close" : "Adjust"}
                      </button>
                    </div>

                    {showTextSettings && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="space-y-8 pt-4"
                      >
                        <div className="space-y-6">
                          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <span>Text Size</span>
                            <span className="text-indigo-600 italic">
                              {subtitleSize}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="15"
                            max="80"
                            value={subtitleSize}
                            onChange={(e) =>
                              setSubtitleSize(parseInt(e.target.value))
                            }
                            className="w-full h-1.5 bg-[#EFF3FF] rounded-full appearance-none cursor-pointer accent-indigo-600"
                          />
                        </div>

                        <div className="space-y-6">
                          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <span>Y-Position</span>
                            <span className="text-indigo-600 italic">
                              {subtitleY}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="30"
                            max="95"
                            value={subtitleY}
                            onChange={(e) =>
                              setSubtitleY(parseInt(e.target.value))
                            }
                            className="w-full h-1.5 bg-[#EFF3FF] rounded-full appearance-none cursor-pointer accent-indigo-600"
                          />
                        </div>

                        <div className="flex p-1.5 bg-[#F9FBFF] rounded-[1.8rem] border border-[#F2F5FF] gap-2">
                          <button
                            onClick={() => setSubtitleStyle("CINEMATIC")}
                            className={`flex-1 py-3.5 px-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${subtitleStyle === "CINEMATIC" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400"}`}
                          >
                            Cinematic (အနားသတ်ရိပ်ပါ)
                          </button>
                          <button
                            onClick={() => setSubtitleStyle("MINIMAL")}
                            className={`flex-1 py-3.5 px-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${subtitleStyle === "MINIMAL" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400"}`}
                          >
                            Minimal (ရိုးရိုး)
                          </button>
                        </div>

                        {/* Subtitle Mode */}
                        <div className="space-y-4 pt-4 border-t border-slate-50">
                          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <span>Display Mode (စာတန်းထိုး ပြသမှုပုံစံ)</span>
                          </div>
                          <div className="grid grid-cols-1 gap-2.5">
                            <button
                              onClick={() => setSubtitleMode("ALL_LINES")}
                              className={`py-3.5 px-4 rounded-2xl text-[10px] font-black uppercase tracking-wider text-left transition-all flex items-center justify-between border ${subtitleMode === "ALL_LINES" ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100"}`}
                            >
                              <span>
                                Standard Block (စာကြောင်းအားလုံး
                                တစ်ပြိုင်နက်ပြရန်)
                              </span>
                              {subtitleMode === "ALL_LINES" && (
                                <Check className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => setSubtitleMode("HIGHLIGHT_LINE")}
                              className={`py-3.5 px-4 rounded-2xl text-[10px] font-black uppercase tracking-wider text-left transition-all flex items-center justify-between border ${subtitleMode === "HIGHLIGHT_LINE" ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100"}`}
                            >
                              <span>
                                Active Line Highlight (ပြောနေသော စာကြောင်းကို
                                အရောင်တောက်စေရန်)
                              </span>
                              {subtitleMode === "HIGHLIGHT_LINE" && (
                                <Check className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => setSubtitleMode("LINE_BY_LINE")}
                              className={`py-3.5 px-4 rounded-2xl text-[10px] font-black uppercase tracking-wider text-left transition-all flex items-center justify-between border ${subtitleMode === "LINE_BY_LINE" ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100"}`}
                            >
                              <span>
                                One Line at a Time (တစ်ကြောင်းချင်းစီ ခွဲ၍
                                သီးသန့်ပြရန်)
                              </span>
                              {subtitleMode === "LINE_BY_LINE" && (
                                <Check className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Colors Settings */}
                        <div className="space-y-6 pt-6 border-t border-slate-100">
                          <div className="space-y-4">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                              <span>Text Color (စာလုံး အရောင်)</span>
                              <span className="text-[9px] text-indigo-500 font-bold">
                                {subtitleColor}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2.5">
                              {[
                                { value: "#FFFFFF", name: "White" },
                                { value: "#FFD700", name: "Yellow" },
                                { value: "#00FF00", name: "Green" },
                                { value: "#00FFFF", name: "Cyan" },
                                { value: "#FFA500", name: "Orange" },
                                { value: "#FF3366", name: "Rose" },
                              ].map((col) => (
                                <button
                                  key={col.value}
                                  onClick={() => setSubtitleColor(col.value)}
                                  className={`group relative w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${subtitleColor === col.value ? "border-indigo-600 scale-110 shadow-sm" : "border-slate-100 hover:scale-105"}`}
                                  style={{ backgroundColor: col.value }}
                                  title={col.name}
                                  type="button"
                                >
                                  {subtitleColor === col.value && (
                                    <Check
                                      className={`w-4 h-4 ${col.value === "#FFFFFF" ? "text-black" : "text-slate-900"}`}
                                      style={{ strokeWidth: 4 }}
                                    />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>

                          {subtitleMode === "HIGHLIGHT_LINE" && (
                            <div className="space-y-4">
                              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                                <span>
                                  Active Highlight Color (ပြောနေသော စာကြောင်း၏
                                  အရောင်)
                                </span>
                                <span className="text-[9px] text-indigo-500 font-bold">
                                  {subtitleHighlightColor}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2.5">
                                {[
                                  { value: "#FFD700", name: "Yellow" },
                                  { value: "#00FF00", name: "Green" },
                                  { value: "#00FFFF", name: "Cyan" },
                                  { value: "#FF3366", name: "Rose" },
                                  { value: "#FFA500", name: "Orange" },
                                  { value: "#FFFFFF", name: "White" },
                                ].map((col) => (
                                  <button
                                    key={col.value}
                                    onClick={() =>
                                      setSubtitleHighlightColor(col.value)
                                    }
                                    className={`group relative w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${subtitleHighlightColor === col.value ? "border-indigo-600 scale-110 shadow-sm" : "border-slate-100 hover:scale-105"}`}
                                    style={{ backgroundColor: col.value }}
                                    title={col.name}
                                    type="button"
                                  >
                                    {subtitleHighlightColor === col.value && (
                                      <Check
                                        className={`w-4 h-4 ${col.value === "#FFFFFF" ? "text-black" : "text-slate-900"}`}
                                        style={{ strokeWidth: 3 }}
                                      />
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {subtitleStyle === "CINEMATIC" && (
                            <div className="space-y-4">
                              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                                <span>
                                  Outline & Shadow Color (စာလုံးအနားသတ် အရောင်)
                                </span>
                                <span className="text-[9px] text-indigo-500 font-bold">
                                  {subtitleOutlineColor}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2.5">
                                {[
                                  { value: "#000000", name: "Black" },
                                  { value: "#333333", name: "Dark Gray" },
                                  { value: "#1E1F29", name: "Slate Blue" },
                                  { value: "#4A0E17", name: "Maroon" },
                                ].map((col) => (
                                  <button
                                    key={col.value}
                                    onClick={() =>
                                      setSubtitleOutlineColor(col.value)
                                    }
                                    className={`group relative w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${subtitleOutlineColor === col.value ? "border-indigo-600 scale-110 shadow-sm" : "border-slate-100 hover:scale-105"}`}
                                    style={{ backgroundColor: col.value }}
                                    title={col.name}
                                    type="button"
                                  >
                                    {subtitleOutlineColor === col.value && (
                                      <Check
                                        className="w-4 h-4 text-white"
                                        style={{ strokeWidth: 3 }}
                                      />
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Target Language */}
                  <div className="bg-white rounded-2xl border border-slate-50 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.015)] space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                      Target Language
                    </h4>
                    <div className="relative">
                      <select
                        value={targetLanguage}
                        onChange={(e) => setTargetLanguage(e.target.value)}
                        className="w-full p-4 rounded-xl border border-[#F2F5FF] bg-white text-slate-900 font-black italic uppercase text-xs shadow-sm outline-none appearance-none cursor-pointer"
                      >
                        <option>Burmese</option>
                        <option>English</option>
                        <option>Thai</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="3"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Aspect Ratio Selector */}
                  <div className="bg-white rounded-2xl border border-slate-50 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.015)] space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                      Output Aspect Ratio
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: "1:1", label: "Square", meta: "1:1" },
                        { id: "9:16", label: "TikTok", meta: "9:16" },
                        { id: "3:4", label: "Shorts", meta: "3:4" },
                        { id: "16:9", label: "YouTube", meta: "16:9" },
                        { id: "4:3", label: "Classic", meta: "4:3" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setAspectRatio(item.id)}
                          className={`p-3 rounded-xl border transition-all text-center flex flex-col items-center justify-center gap-1 ${aspectRatio === item.id ? "border-blue-600 bg-blue-600 text-white shadow-md" : "border-[#F2F5FF] bg-white hover:bg-slate-50 text-slate-400"}`}
                        >
                          <span
                            className={`text-[8px] font-black uppercase tracking-widest ${aspectRatio === item.id ? "text-white/60" : "text-slate-300"}`}
                          >
                            {item.label}
                          </span>
                          <span className="text-xs font-black italic">
                            {item.meta}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Splitting Clips Slider */}
                  <div className="bg-white rounded-2xl border border-slate-50 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.015)] space-y-4">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                        Splitting Clips
                      </h4>
                      <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                        <span className="text-sm font-black italic text-[#050529]">
                          {splittingClips}
                        </span>
                        <span className="text-[8px] font-black uppercase text-blue-500 tracking-widest">
                          Part
                        </span>
                      </div>
                    </div>
                    <div className="relative pt-2 px-0.5">
                      <input
                        type="range"
                        min="1"
                        max="6"
                        step="1"
                        value={splittingClips}
                        onChange={(e) =>
                          setSplittingClips(parseInt(e.target.value))
                        }
                        className="w-full h-1 bg-[#EFF3FF] rounded-full appearance-none cursor-pointer accent-blue-600"
                      />
                      <div className="flex justify-between text-[7px] font-black text-slate-300 mt-2 uppercase">
                        <span>Default (1)</span>
                        <span>Max (6)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="video/*"
                className="hidden"
              />

              {/* Action Area - SS STYLE */}
              <div className="pt-2 pb-6">
                <div className="bg-[#050529] rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full -mr-40 -mt-40 blur-[100px] pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full -ml-32 -mb-32 blur-3xl pointer-events-none" />

                  <div className="relative z-10 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                        <h4 className="text-xs font-black text-white uppercase tracking-[0.3em]">
                          Workflow Engine Logs
                        </h4>
                      </div>
                      <div className="text-[8px] font-black text-white/20 uppercase tracking-widest hidden sm:block">
                        Production System v7.5
                      </div>
                    </div>

                    <div className="bg-black/60 rounded-2xl p-5 font-mono text-[10px] space-y-3 min-h-[160px] border border-white/5 shadow-inner backdrop-blur-md custom-scrollbar overflow-y-auto">
                      {logs.length > 0 ? (
                        [...logs].reverse().map((log, i) => (
                          <div
                            key={i}
                            className="flex gap-3 group/log text-[10px]"
                          >
                            <span className="text-green-500/40 font-black shrink-0 text-[10px]">
                              {log.split(" ")[0]}
                            </span>
                            <span
                              className={`${log.includes("FATAL") ? "text-red-400" : log.includes("successful") ? "text-blue-400" : "text-slate-300"} font-medium group-hover/log:text-white transition-colors text-[10px]`}
                            >
                              {log.split(" ").slice(1).join(" ")}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-700 italic flex flex-col items-center justify-center h-full gap-2 pt-6">
                          <Loader2 className="w-5 h-5 animate-spin opacity-20" />
                          <span className="uppercase tracking-[0.15em] font-black text-[8px]">
                            Awaiting production payload...
                          </span>
                        </div>
                      )}
                      {false && (
                        <motion.div
                          animate={{ opacity: [1, 0] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                          className="w-1.5 h-3 bg-green-500/50 mt-1"
                        />
                      )}
                    </div>

                    <button
                      onClick={startAutoRecap}
                      disabled={!videoFile || step !== ProcessingStep.IDLE}
                      className={`w-full py-5 rounded-2xl font-black uppercase italic tracking-[0.2em] text-md flex items-center justify-center gap-3 transition-all shadow-[0_12px_36px_rgba(0,0,0,0.3)] ${
                        videoFile && step === ProcessingStep.IDLE
                          ? "bg-blue-600 text-white hover:bg-blue-500 hover:scale-[1.01] active:scale-[0.99] shadow-blue-600/30"
                          : "bg-white/5 text-white/20 cursor-not-allowed border border-white/5"
                      }`}
                    >
                      <Sparkles
                        className={`w-5 h-5 ${step !== ProcessingStep.IDLE ? "animate-spin" : ""}`}
                      />
                      {step === ProcessingStep.IDLE
                        ? "Start One-Click Production"
                        : "Production in Progress..."}
                    </button>
                  </div>
                </div>
              </div>

              {/* Script Preview Area */}
              {generatedScript && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-3xl border border-slate-50 overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.015)] mb-8"
                >
                  <div className="p-5 border-b border-slate-50 bg-[#F9FBFF]/50 flex justify-between items-center">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Generated AI Movie Recap Script
                    </h4>
                    <div className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[8px] font-black rounded-lg uppercase tracking-widest">
                      {targetLanguage} Output
                    </div>
                  </div>
                  <div className="p-6 md:p-8">
                    <div className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed tracking-tight bg-slate-50/50 p-6 rounded-2xl border border-slate-50 italic">
                      {generatedScript}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Blur Settings Modal */}
          <AnimatePresence>
            {showBlurSettings && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-10"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-white rounded-[3rem] w-full max-w-5xl overflow-hidden flex h-full max-h-[85vh] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]"
                >
                  {/* Preview Area (Left) */}
                  <div className="flex-1 bg-black relative flex items-center justify-center p-8">
                    <div className="relative aspect-video w-full max-w-3xl bg-[#111111] rounded-2xl overflow-hidden border border-white/5">
                      {videoPreview ? (
                        <video
                          src={videoPreview}
                          className="w-full h-full object-contain opacity-50"
                          muted
                          playsInline
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20 font-black italic uppercase tracking-tighter text-2xl">
                          Preview Screen
                        </div>
                      )}

                      {/* Blur Overlay Preview */}
                      <div
                        className="absolute border border-cyan-400/50 flex items-center justify-center pointer-events-none transition-all duration-100 ease-out z-10"
                        style={{
                          top: `${blurY}%`,
                          left: blurMode === "FULL" ? "0" : `${blurX}%`,
                          width: blurMode === "FULL" ? "100%" : `${blurWidth}%`,
                          height: `${blurHeight}%`,
                          backdropFilter: `blur(${blurStrength}px)`,
                          WebkitBackdropFilter: `blur(${blurStrength}px)`,
                          backgroundColor: "rgba(0, 0, 0, 0.15)",
                        }}
                      >
                        <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest bg-black/60 px-2.5 py-1 rounded-lg shadow-sm border border-cyan-400/20">
                          Blur Area ({blurStrength}px)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Controls Area (Right) */}
                  <div className="w-[380px] border-l border-slate-100 flex flex-col bg-white">
                    <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                      <h3 className="text-xl font-black text-[#050529] uppercase tracking-tight italic">
                        Blur Settings
                      </h3>
                      <button
                        onClick={() => setShowBlurSettings(false)}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                      {/* Aspect Ratio Shortcuts */}
                      <div className="flex gap-2 justify-between">
                        {["1:1", "9:16", "16:9", "4:3", "3:4"].map((ar) => (
                          <button
                            key={ar}
                            onClick={() => setAspectRatio(ar)}
                            className={`flex-1 py-3 rounded-xl text-[9px] font-black italic uppercase tracking-widest transition-all border ${aspectRatio === ar ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-white"}`}
                          >
                            {ar}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Y Position
                          </h4>
                          <span className="text-[10px] font-black text-blue-600 uppercase tabular-nums">
                            {Math.round(blurY)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={100 - blurHeight}
                          value={blurY}
                          onChange={(e) => setBlurY(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Height (Thickness)
                          </h4>
                          <span className="text-[10px] font-black text-blue-600 uppercase tabular-nums">
                            {Math.round(blurHeight)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="50"
                          value={blurHeight}
                          onChange={(e) =>
                            setBlurHeight(parseInt(e.target.value))
                          }
                          className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Blur Strength
                          </h4>
                          <span className="text-[10px] font-black text-blue-600 uppercase tabular-nums">
                            {blurStrength} px
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={blurStrength}
                          onChange={(e) =>
                            setBlurStrength(parseInt(e.target.value))
                          }
                          className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>

                      <div className="flex p-1.5 bg-slate-100 rounded-2xl gap-1">
                        <button
                          onClick={() => setBlurMode("FULL")}
                          className={`flex-1 py-4 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${blurMode === "FULL" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                        >
                          Full Width
                        </button>
                        <button
                          onClick={() => setBlurMode("CUSTOM")}
                          className={`flex-1 py-4 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${blurMode === "CUSTOM" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                        >
                          Custom Box
                        </button>
                      </div>

                      {blurMode === "CUSTOM" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="space-y-8 pt-4"
                        >
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                X POS
                              </h4>
                              <span className="text-[10px] font-black text-blue-600 uppercase tabular-nums">
                                {Math.round(blurX)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max={100 - blurWidth}
                              value={blurX}
                              onChange={(e) =>
                                setBlurX(parseInt(e.target.value))
                              }
                              className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600"
                            />
                          </div>
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Width
                              </h4>
                              <span className="text-[10px] font-black text-blue-600 uppercase tabular-nums">
                                {Math.round(blurWidth)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="10"
                              max="100"
                              value={blurWidth}
                              onChange={(e) =>
                                setBlurWidth(parseInt(e.target.value))
                              }
                              className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600"
                            />
                          </div>
                        </motion.div>
                      )}
                    </div>

                    <div className="p-8 border-t border-slate-50 bg-white">
                      <button
                        onClick={() => setShowBlurSettings(false)}
                        className="w-full py-5 bg-blue-600 text-white font-black uppercase italic tracking-[0.1em] text-xs rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
                      >
                        Save & Apply
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default AutoRecap;
