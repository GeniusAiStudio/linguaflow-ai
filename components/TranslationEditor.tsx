import React, { useState, useEffect } from "react";
import { TranslationProvider, TranslationTone, ViewMode } from "../types";
import { backendService } from "../services/backendService";
import { projectService } from "../services/projectService";
import { Loader2, CheckCircle2, AlertCircle, Clock, Sparkles, Copy, FileText, File, Subtitles } from "lucide-react";
import TranslatedTextBox from "./TranslatedTextBox";
import LanguageSelector from "./LanguageSelector";
import ApiModeToggle, { ApiMode } from "./ApiModeToggle";
import CreditTierSelector from "./CreditTierSelector";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../services/firebase";
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, deleteDoc } from "firebase/firestore";

interface ScriptHistoryItem {
  id: string;
  userId: string;
  sourceText: string;
  translatedText: string;
  targetLang: string;
  timestamp: number;
  duration: string;
  status: string;
}


interface TranslationEditorProps {
  initialText?: string;
  sourceLang: string;
  targetLang: string;
  tone: TranslationTone;
  provider: TranslationProvider;
  onCopy?: () => void;
  onRequireCredits?: (amount: number) => Promise<boolean>;
}

interface ChunkProgress {
  index: number;
  status: "Pending" | "Translating" | "Success" | "Failed";
  errorMsg?: string;
}

const TranslationEditor: React.FC<TranslationEditorProps> = ({
  initialText = "",
  sourceLang: initSource,
  targetLang: initTarget,
  tone: initTone,
  provider,
  onCopy,
  onRequireCredits,
}) => {
  const [sourceText, setSourceText] = useState(initialText);
  const [thumbnailHook, setThumbnailHook] = useState("");
  const [sourceLang, setSourceLang] = useState(initSource);
  const [targetLang, setTargetLang] = useState(initTarget);
  const [tone, setTone] = useState<TranslationTone>(initTone);
  const [rawTranslatedText, setRawTranslatedText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [chunksProgress, setChunksProgress] = useState<ChunkProgress[]>([]);
  const [isTiming, setIsTiming] = useState(false);
  const [isSrtMode, setIsSrtMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiMode, setApiMode] = useState<ApiMode>("app");
  const [selectedCreditLimit, setSelectedCreditLimit] = useState<number>(25000);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawTranslatedText);
      showToast('Script copied to clipboard');
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([rawTranslatedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'script.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded TXT');
  };

  const handleDownloadDoc = () => {
    const htmlContent = `<html><head><meta charset="utf-8"></head><body>${rawTranslatedText.replace(/\n/g, '<br>')}</body></html>`;
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'script.doc';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded DOC');
  };

  const handleDownloadSrt = () => {
    const lines = rawTranslatedText.split('\n').filter(line => line.trim() !== '');
    let srtContent = '';
    
    lines.forEach((line, index) => {
      const startSeconds = index * 5;
      const endSeconds = startSeconds + 5;
      
      const formatTime = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},000`;
      };
      
      srtContent += `${index + 1}\n`;
      srtContent += `${formatTime(startSeconds)} --> ${formatTime(endSeconds)}\n`;
      srtContent += `${line}\n\n`;
    });

    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'script.srt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded SRT');
  };
  const [lastSaved, setLastSaved] = useState<string>('');
  const [scriptHistory, setScriptHistory] = useState<ScriptHistoryItem[]>([]);

  // Real-time synchronization of Script Architect History with Firestore and localStorage
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    const setupSync = (userId: string) => {
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }

      const q = query(
        collection(db, 'script_history'),
        where('userId', '==', userId),
        where('status', '==', 'completed'),
        orderBy('timestamp', 'desc')
      );

      unsubscribeFirestore = onSnapshot(q, (snapshot) => {
        const items: ScriptHistoryItem[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          items.push({
            id: doc.id,
            userId: data.userId || userId,
            sourceText: data.sourceText || '',
            translatedText: data.translatedText || '',
            targetLang: data.targetLang || '',
            timestamp: data.timestamp || Date.now(),
            duration: data.duration || '0.000',
            status: data.status || 'completed'
          });
        });

        setScriptHistory(items);
        localStorage.setItem('ai_script_history_v1', JSON.stringify(items));
      }, (error) => {
        console.warn("Firestore script_history subscription failed (using localStorage):", error);
        const localData = localStorage.getItem('ai_script_history_v1');
        if (localData) {
          try {
            setScriptHistory(JSON.parse(localData));
          } catch (e) {}
        }
      });
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      const userId = firebaseUser?.uid || 'usr_guest';
      
      const localData = localStorage.getItem('ai_script_history_v1');
      if (localData) {
        try {
          const parsed = JSON.parse(localData) as ScriptHistoryItem[];
          const filtered = parsed.filter(item => item.userId === userId && item.status === 'completed');
          setScriptHistory(filtered);
        } catch (e) {}
      }

      if (firebaseUser) {
        setupSync(userId);
      } else {
        if (unsubscribeFirestore) {
          unsubscribeFirestore();
          unsubscribeFirestore = null;
        }
      }
    });

    return () => {
      if (unsubscribeFirestore) unsubscribeFirestore();
      unsubscribeAuth();
    };
  }, []);

  const handleSelectHistoryItem = (item: ScriptHistoryItem) => {
    setSourceText(item.sourceText);
    setRawTranslatedText(item.translatedText);
    setTargetLang(item.targetLang);
  };

  const stateRef = React.useRef({ sourceText, rawTranslatedText, sourceLang, targetLang, tone });
  useEffect(() => {
    stateRef.current = { sourceText, rawTranslatedText, sourceLang, targetLang, tone };
  }, [sourceText, rawTranslatedText, sourceLang, targetLang, tone]);

  useEffect(() => {
    if (initialText) setSourceText(initialText);
  }, [initialText]);

  useEffect(() => {
    const srtPattern =
      /(\d{2}:\d{2}:\d{2},\d{3})\s-->\s(\d{2}:\d{2}:\d{2},\d{3})/;
    setIsSrtMode(srtPattern.test(sourceText));
  }, [sourceText]);

  // Restore project state on load
  useEffect(() => {
    const activeProj = projectService.getActiveProject();
    if (
      activeProj &&
      (activeProj.type === ViewMode.CONVERSATION ||
        activeProj.type === ViewMode.SRT_TRANSLATOR)
    ) {
      if (activeProj.stateData) {
        if (activeProj.stateData.sourceText !== undefined)
          setSourceText(activeProj.stateData.sourceText);
        if (activeProj.stateData.sourceLang !== undefined)
          setSourceLang(activeProj.stateData.sourceLang);
        if (activeProj.stateData.targetLang !== undefined)
          setTargetLang(activeProj.stateData.targetLang);
        if (activeProj.stateData.rawTranslatedText !== undefined)
          setRawTranslatedText(activeProj.stateData.rawTranslatedText);
        if (activeProj.stateData.tone !== undefined)
          setTone(activeProj.stateData.tone);
      }
      projectService.setActiveProject(null);
    } else {
      const savedDraft = localStorage.getItem('genius_ai_script_architect_draft');
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          if (draft.sourceText) setSourceText(draft.sourceText);
          if (draft.rawTranslatedText) setRawTranslatedText(draft.rawTranslatedText);
          if (draft.sourceLang) setSourceLang(draft.sourceLang);
          if (draft.targetLang) setTargetLang(draft.targetLang);
          if (draft.tone) setTone(draft.tone);
        } catch (e) {
          console.error("Failed to restore Script Architect draft", e);
        }
      }
    }
  }, []);

  // Save/Update recent project entry when text or configuration changes
  useEffect(() => {
    if (sourceText.trim() || rawTranslatedText.trim()) {
      projectService.saveProject({
        name: isSrtMode
          ? `Subtitles: ${sourceText.trim().slice(0, 30) || "Empty"}...`
          : `Script: ${sourceText.trim().slice(0, 30) || "Empty"}...`,
        type: ViewMode.CONVERSATION,
        fileName: isSrtMode
          ? "translation_subtitles.srt"
          : "translated_script.txt",
        fileSize: `${Math.round(((sourceText.length + rawTranslatedText.length) / 1024) * 10) / 10} KB`,
        stateData: {
          sourceText,
          sourceLang,
          targetLang,
          rawTranslatedText,
          tone,
        },
      });
    }
  }, [sourceText, sourceLang, targetLang, rawTranslatedText, tone, isSrtMode]);

  // Auto-save interval of 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const current = stateRef.current;
      if (current.sourceText.trim() || current.rawTranslatedText.trim()) {
        localStorage.setItem(
          'genius_ai_script_architect_draft',
          JSON.stringify(current)
        );
        const now = new Date().toLocaleTimeString();
        setLastSaved(now);
      } else {
        localStorage.removeItem('genius_ai_script_architect_draft');
        setLastSaved('');
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleTranslate = async () => {
    const trimmedInput = sourceText.trim();
    if (trimmedInput === "") {
      setError("Please write a script first");
      return;
    }

    const startTime = Date.now();
    setIsTranslating(true);
    setError(null);
    setChunksProgress([]);
    try {
      let result = "";
      if (provider === TranslationProvider.GEMINI) {
        const onProgress = (totalChunks: number, currentChunkIndex: number, status: "Pending" | "Translating" | "Success" | "Failed", errorMsg?: string) => {
          setChunksProgress(prev => {
            if (prev.length !== totalChunks) {
              const newProgress: ChunkProgress[] = [];
              for (let i = 0; i < totalChunks; i++) {
                newProgress.push({
                  index: i,
                  status: i === currentChunkIndex ? status : "Pending",
                  errorMsg: i === currentChunkIndex ? errorMsg : undefined,
                });
              }
              return newProgress;
            } else {
              return prev.map((item, idx) => {
                if (idx === currentChunkIndex) {
                  return { ...item, status, errorMsg };
                }
                return item;
              });
            }
          });
        };

        result = await backendService.translateWithBackendProxy(
          trimmedInput,
          sourceLang,
          targetLang,
          tone,
          isSrtMode,
          onProgress,
        );
      } else {
        result = await backendService.translateText(trimmedInput, targetLang);
      }

      if (!result || !result.trim()) {
        throw new Error("ဘာသာပြန်စာသား ထွက်မလာသေးပါ။ ကျေးဇူးပြု၍ စာသားကို စစ်ဆေးပြီး ထပ်မံကြိုးစားပေးပါ။ (Empty translation result)");
      }

      // Display the translated text immediately
      setRawTranslatedText(result);
      setIsTranslating(false);

      // Deduct credits immediately after successful generation
      if (onRequireCredits) {
        let requiredCredits = 4;
        if (selectedCreditLimit <= 5000) requiredCredits = 4;
        else if (selectedCreditLimit <= 10000) requiredCredits = 8;
        else if (selectedCreditLimit <= 15000) requiredCredits = 12;
        else if (selectedCreditLimit <= 20000) requiredCredits = 16;
        else if (selectedCreditLimit <= 25000) requiredCredits = 20;
        else requiredCredits = 24;

        onRequireCredits(requiredCredits).catch(creditErr => {
          console.warn("Credit deduction notice:", creditErr);
        });
      }

      // Save to Script Architect History (real-time snapshot, zero-lag)
      const durationSec = ((Date.now() - startTime) / 1000).toFixed(3);
      const userId = auth.currentUser?.uid || 'usr_guest';
      const timestamp = Date.now();
      const newItem = {
        userId,
        sourceText: trimmedInput,
        translatedText: result,
        targetLang: targetLang,
        timestamp,
        duration: durationSec,
        status: 'completed'
      };

      try {
        const localItem = { id: 'temp_' + Math.random().toString(36).substring(7), ...newItem };
        setScriptHistory(prev => [localItem, ...prev]);

        const localData = localStorage.getItem('ai_script_history_v1');
        let currentItems = [];
        if (localData) {
          try {
            currentItems = JSON.parse(localData);
          } catch (e) {}
        }
        localStorage.setItem('ai_script_history_v1', JSON.stringify([localItem, ...currentItems]));

        if (auth.currentUser) {
          addDoc(collection(db, 'script_history'), newItem).catch(err => {
            console.warn("Firestore history background save failed:", err);
          });
        }
      } catch (historyErr) {
        console.error("Failed to process script history:", historyErr);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.toString());
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSmartTime = async () => {
    if (!sourceText.trim() || isTiming) return;
    setIsTiming(true);
    setError(null);
    try {
      const result = await backendService.smartTimeWithBackendProxy(
        sourceText,
        sourceLang,
      );
      setSourceText(result);
    } catch (err: any) {
      console.error("Smart timing failed", err);
      setError("AI Timing alignment failed.");
    } finally {
      setIsTiming(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 animate-flutter-fade duration-700 bg-[#F4F5F9] h-full p-4 md:p-8 overflow-y-auto custom-scrollbar">
      {!(rawTranslatedText || isTranslating) && !error ? (
        // INPUT SECTION (Picture 1 Style)
        <div className="max-w-4xl mx-auto w-full flex flex-col gap-6 min-h-0 pb-10">
          {/* Top Toggles / Quota */}
          <ApiModeToggle mode={apiMode} onChange={setApiMode} />

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                APP QUOTA (TODAY)
              </span>
              <span className="text-2xl font-black text-[#4D45E5] tracking-tight">
                Unlimited
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                CLASS
              </span>
              <span className="text-sm font-black text-slate-700 tracking-wider">
                MEMBER+
              </span>
            </div>
          </div>

          <div className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm flex flex-col min-h-[350px]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                  SOURCE CONTENT
                </span>
                {lastSaved && (
                  <span className="text-[10px] text-[#4D45E5] font-bold flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4D45E5]"></span>
                    Auto-saved {lastSaved}
                  </span>
                )}
              </div>
              <div className="flex gap-4">
                <button
                  className="text-xs font-black text-emerald-600 hover:text-emerald-500 uppercase tracking-wider flex items-center gap-1"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setSourceText(text);
                    } catch (err) {}
                  }}
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
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  PASTE
                </button>
                <button
                  onClick={() => {
                    setSourceText("");
                    setError(null);
                    localStorage.removeItem('genius_ai_script_architect_draft');
                    setLastSaved('');
                  }}
                  className="text-xs font-black text-red-500 hover:text-red-400 uppercase tracking-wider"
                >
                  CLEAR
                </button>
              </div>
            </div>
            <div className="flex-1 relative">
              <textarea
                value={sourceText}
                onChange={(e) => {
                  const text = e.target.value;
                  if (text.length <= selectedCreditLimit) {
                    setSourceText(text);
                  } else {
                    setSourceText(text.slice(0, selectedCreditLimit));
                  }
                  if (error) setError(null);
                }}
                placeholder={`Paste transcript or content here (Max ${selectedCreditLimit.toLocaleString()})...`}
                className="absolute inset-0 w-full h-full p-6 bg-transparent text-slate-800 resize-none focus:outline-none custom-scrollbar text-base leading-relaxed placeholder:text-slate-400 font-medium"
              />
            </div>
            <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
              <span
                className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${sourceText.length >= selectedCreditLimit ? "text-red-600 bg-red-100" : "text-[#4D45E5] bg-[#4D45E5]/10"}`}
              >
                {sourceText.length.toLocaleString()} /{" "}
                {selectedCreditLimit.toLocaleString()} CHARS
              </span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
              TARGET LANGUAGE
            </span>
            <div className="w-48">
              <LanguageSelector
                label=""
                value={targetLang}
                onChange={setTargetLang}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button className="bg-[#4D45E5] rounded-2xl p-5 flex items-center gap-4 text-left shadow-md border-b-4 border-[#3d36b8] active:translate-y-1 active:border-b-0 transition-all">
              <div className="w-5 h-5 rounded-full border-4 border-white flex-shrink-0" />
              <div className="flex flex-col">
                <span className="text-white font-black text-lg tracking-tight uppercase italic">
                  1: PURE TRANSLATION SCRIPT
                </span>
                <span className="text-white/80 text-[10px] font-black uppercase tracking-widest">
                  Accurate & Professional Flow (Mandatory)
                </span>
              </div>
            </button>
            <button
              disabled
              className="bg-white rounded-2xl p-5 flex items-center gap-4 text-left border border-slate-200 shadow-sm opacity-60"
            >
              <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0" />
              <div className="flex flex-col">
                <span className="text-slate-700 font-black text-lg tracking-tight uppercase italic">
                  2: DEEP MEANING & INSIGHTS
                </span>
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  Subtext for Movies or Lessons
                </span>
              </div>
            </button>
            <button
              disabled
              className="bg-white rounded-2xl p-5 flex items-center gap-4 text-left border border-slate-200 shadow-sm opacity-60"
            >
              <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0" />
              <div className="flex flex-col">
                <span className="text-slate-700 font-black text-lg tracking-tight uppercase italic">
                  3: TITLE & THUMBNAIL HOOKS
                </span>
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  Viral social media text
                </span>
              </div>
            </button>
          </div>

          <CreditTierSelector
            selectedLimit={selectedCreditLimit}
            onChange={setSelectedCreditLimit}
          />

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-1 mt-4">
            <span className="text-xl">✨</span>
            <span className="text-emerald-600 font-black text-xs uppercase tracking-widest">
              PREMIUM ACCOUNT ACTIVE
            </span>
            <span className="text-emerald-600/70 font-black text-[10px] uppercase tracking-widest">
              ADS BYPASSED AUTOMATICALLY
            </span>
          </div>

          <button
            onClick={handleTranslate}
            disabled={isTranslating || !sourceText.trim()}
            className={`mt-6 w-full py-5 text-white rounded-full font-black text-lg transition-all shadow-sm active:scale-[0.98] uppercase tracking-widest flex items-center justify-center gap-3 ${isTranslating || !sourceText.trim() ? "bg-slate-300 opacity-50" : "bg-[#4D45E5] hover:bg-[#3d36b8]"}`}
          >
            TRANSLATE & ANALYZE
          </button>
        </div>
      ) : (
        // OUTPUT SECTION (Picture 2 Style)
        <div className="max-w-4xl mx-auto w-full flex flex-col gap-6 min-h-0 relative pb-10">
          <div className="bg-white rounded-[2rem] overflow-hidden border border-slate-200 shadow-xl flex flex-col relative h-[600px]">
            {/* Blue Header */}
            <div className="bg-[#4D45E5] px-6 py-5 flex items-center justify-between shrink-0">
              <span className="text-xs font-black text-white uppercase tracking-widest">
                1: TRANSLATED SCRIPT
              </span>
              <button
                onClick={() => onCopy && onCopy()}
                className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors text-white"
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
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </div>

            {error && (() => {
              const errorLower = error.toLowerCase();
              const isQuotaError = errorLower.includes("429") || errorLower.includes("quota") || errorLower.includes("resource_exhausted") || errorLower.includes("limit");
              
              return (
                <div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-white/95 backdrop-blur-md rounded-[2rem] overflow-y-auto">
                  <div className="text-center max-w-md space-y-5 py-6">
                    <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto border border-red-200">
                      <svg
                        className="w-7 h-7 text-red-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    </div>
                    
                    {isQuotaError ? (
                      <div className="space-y-4 text-left">
                        <div className="text-center">
                          <h4 className="text-red-600 font-black text-sm uppercase tracking-wider">
                            Gemini API Quota Limit Hit (429 Error)
                          </h4>
                          <p className="text-xs text-red-500 font-bold mt-1">
                            စနစ်အသုံးပြုမှု အကန့်အသတ် ပြည့်သွားပါပြီ။
                          </p>
                        </div>
                        
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-[11px] text-slate-600 leading-relaxed space-y-2">
                          <p className="font-bold text-slate-800 uppercase tracking-wider text-[9px] text-center mb-1">
                            💡 ဘယ်လို ဖြေရှင်းမလဲ (How to Resolve)
                          </p>
                          <p>
                            <strong>၁။</strong> Google AI Studio ၏ အခမဲ့ဗားရှင်း (Free Tier) သည် တစ်နေ့တာ စာလုံးအရေအတွက် ကန့်သတ်ချက် (Daily Quota) ရှိပါသည်။ ၂၄ နာရီ မစောင့်ချင်ပါက <strong>Pay-As-You-Go (Billing Account)</strong> သို့ အဆင့်မြှင့်တင်သုံးစွဲပါ။
                          </p>
                          <p>
                            <strong>၂။</strong> ၎င်းကို <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-[#4D45E5] underline font-bold">Google AI Studio</a> တွင် billing account ချိတ်ဆက်၍ တိုးမြှင့်နိုင်ပါသည်။
                          </p>
                          <p>
                            <strong>၃။</strong> သင်၏ ကိုယ်ပိုင် API Key အသစ်ကို ဤ Developer Panel ၏ <strong>Settings &gt; Secrets</strong> တွင် သွားရောက် ထည့်သွင်းပေးပါ။
                          </p>
                        </div>
                        
                        <p className="text-[10px] text-slate-400 text-center italic">
                          Detailed error: {error}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <h4 className="text-red-600 font-black text-sm uppercase tracking-wider">
                          Translation Interrupted
                        </h4>
                        <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 max-h-40 overflow-y-auto">
                          {error}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                      <button
                        onClick={handleTranslate}
                        className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-slate-800 transition-all shadow-sm"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={() => setError(null)}
                        className="w-full sm:w-auto px-6 py-2.5 bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-slate-200 transition-all"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {(() => {
              if (!isTranslating) return null;
              const totalChunks = chunksProgress.length;
              const completedChunks = chunksProgress.filter(c => c.status === "Success").length;
              const failedChunks = chunksProgress.filter(c => c.status === "Failed").length;
              const translatingChunks = chunksProgress.filter(c => c.status === "Translating").length;
              const overallPercent = totalChunks > 0 ? Math.round(((completedChunks + failedChunks) / totalChunks) * 100) : 0;

              return (
                <div className="absolute inset-0 z-10 flex flex-col bg-[#F8FAFC] p-6 md:p-10 rounded-[2rem] overflow-y-auto custom-scrollbar">
                  {/* Header card with status overview */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col gap-4 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#4D45E5]/10 flex items-center justify-center text-[#4D45E5] animate-pulse">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                            Controlled Concurrency AI Translation Engine
                          </h4>
                          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">
                            Meticulous batch-by-batch alignment & context retention
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                            TOTAL SECTIONS
                          </span>
                          <span className="text-lg font-black text-slate-700">
                            {totalChunks || "1"}
                          </span>
                        </div>
                        <div className="h-8 w-px bg-slate-100" />
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                            COMPLETED
                          </span>
                          <span className="text-lg font-black text-emerald-600">
                            {completedChunks} / {totalChunks || "1"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Master Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        <span>Overall Progress</span>
                        <span>{overallPercent}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#4D45E5] to-indigo-500 transition-all duration-500 rounded-full"
                          style={{ width: `${overallPercent}%` }}
                        />
                      </div>
                    </div>

                    {completedChunks === totalChunks && totalChunks > 0 && (
                      <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl mt-3 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-bold text-emerald-800">ဘာသာပြန်ခြင်း အောင်မြင်ပါသည် (Completed)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsTranslating(false)}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer"
                        >
                          View Result / စာသားကြည့်ရန်
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Status List */}
                  <div className="flex-1 flex flex-col gap-3 min-h-0">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      SECTION STATUS PIPELINE
                    </h5>
                    
                    {chunksProgress.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10 bg-white rounded-2xl border border-slate-100">
                        <Loader2 className="w-8 h-8 text-[#4D45E5] animate-spin" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest animate-pulse">
                          Analyzing contents & initiating chunks...
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {chunksProgress.map((chunk) => {
                          const isPending = chunk.status === "Pending";
                          const isTranslating = chunk.status === "Translating";
                          const isSuccess = chunk.status === "Success";
                          const isFailed = chunk.status === "Failed";

                          return (
                            <div 
                              key={chunk.index} 
                              className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                                isTranslating 
                                  ? "bg-indigo-50/50 border-indigo-200 shadow-sm" 
                                  : isSuccess 
                                  ? "bg-emerald-50/20 border-slate-100" 
                                  : isFailed 
                                  ? "bg-red-50/20 border-red-100" 
                                  : "bg-white border-slate-100 opacity-60"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                                  isTranslating 
                                    ? "bg-[#4D45E5] text-white animate-pulse" 
                                    : isSuccess 
                                    ? "bg-emerald-500 text-white" 
                                    : isFailed 
                                    ? "bg-red-500 text-white" 
                                    : "bg-slate-100 text-slate-500"
                                }`}>
                                  {chunk.index + 1}
                                </div>
                                <div>
                                  <span className="font-black text-sm text-slate-700 tracking-tight">
                                    Section {chunk.index + 1}
                                  </span>
                                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                                    {isPending && "Awaiting preceding translations..."}
                                    {isTranslating && "Active LLM query with context parsing..."}
                                    {isSuccess && "Completed & post-processing filters applied"}
                                    {isFailed && (chunk.errorMsg || "Processing aborted / engine retries exhausted")}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 self-end md:self-auto">
                                {isPending && (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black text-slate-400 bg-slate-50 uppercase tracking-wider border border-slate-200">
                                    <Clock className="w-3.5 h-3.5" />
                                    Pending
                                  </span>
                                )}
                                {isTranslating && (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black text-indigo-600 bg-indigo-50 uppercase tracking-wider border border-indigo-200 animate-pulse">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Translating
                                  </span>
                                )}
                                {isSuccess && (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black text-emerald-600 bg-emerald-50 uppercase tracking-wider border border-emerald-200">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Success
                                  </span>
                                )}
                                {isFailed && (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black text-red-600 bg-red-50 uppercase tracking-wider border border-red-200">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Failed
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {(rawTranslatedText || isTranslating) && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-hidden relative rounded-2xl border border-[#222222]">
                  <TranslatedTextBox
                    translatedText={rawTranslatedText}
                    editable={true}
                    onTextChange={setRawTranslatedText}
                  />
                </div>
                {rawTranslatedText && (
                  <div className="flex justify-end items-center gap-2 mt-4 flex-shrink-0">
                    <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-2 bg-[#111111] border border-[#222222] hover:bg-[#222222] text-slate-200 hover:text-white text-[11px] font-bold rounded-xl transition-all uppercase tracking-widest">
                      <Copy className="w-3.5 h-3.5" />
                      Full Copy Script
                    </button>
                    
                    <div className="w-[1px] h-4 bg-[#333333] mx-1"></div>
                    
                    <button onClick={handleDownloadTxt} className="flex items-center gap-1.5 px-3 py-2 bg-[#111111] border border-[#222222] hover:bg-[#222222] text-slate-200 hover:text-white text-[11px] font-bold rounded-xl transition-all uppercase tracking-widest">
                      <FileText className="w-3.5 h-3.5" />
                      TXT
                    </button>
                    
                    <button onClick={handleDownloadDoc} className="flex items-center gap-1.5 px-3 py-2 bg-[#111111] border border-[#222222] hover:bg-[#222222] text-slate-200 hover:text-white text-[11px] font-bold rounded-xl transition-all uppercase tracking-widest">
                      <File className="w-3.5 h-3.5" />
                      DOC
                    </button>
                    
                    <button onClick={handleDownloadSrt} className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold rounded-xl transition-all uppercase tracking-widest shadow-[0_0_15px_rgba(147,51,234,0.3)]">
                      <Subtitles className="w-3.5 h-3.5" />
                      Auto SRT
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setRawTranslatedText("");
              setError(null);
              setSourceText(""); // Or keep it if you want them to translate same content again
            }}
            className="w-full py-5 bg-[#0F172A] hover:bg-slate-800 text-white rounded-full font-black text-sm transition-all shadow-xl active:scale-[0.98] uppercase tracking-widest"
          >
            TRANSLATE ANOTHER CONTENT
          </button>

          <div className="flex flex-col gap-4 mt-6">
            <h3 className="text-xl font-black text-slate-800 tracking-tight">
              Recent History
            </h3>
            {scriptHistory.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                  No generated scripts yet
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {scriptHistory.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectHistoryItem(item)}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-[#4D45E5] hover:shadow-md cursor-pointer flex justify-between items-center transition-all group"
                  >
                    <div className="flex flex-col gap-2 flex-1 min-w-0 pr-4">
                      <p className="text-slate-800 font-bold text-sm truncate">
                        {item.duration || "0.000"} seconds{" "}
                        <span className="font-medium text-slate-600">
                          {item.sourceText}
                        </span>
                      </p>
                      <div className="flex gap-4">
                        <span className="text-slate-400 text-xs font-medium">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                        <span className="text-emerald-500 text-xs font-bold uppercase tracking-widest">
                          {item.targetLang}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          // Use functional state update to prevent stale closures when rapidly deleting items
                          // Safely get an ID to compare against
                          const itemId = item.id;
                          
                          setScriptHistory(prev => {
                            // If itemId is undefined, we compare by timestamp as fallback
                            const updated = prev.filter(h => itemId ? h.id !== itemId : h.timestamp !== item.timestamp);
                            
                            // Also read from localStorage directly to ensure we don't overwrite with stale data
                            const localData = localStorage.getItem('ai_script_history_v1');
                            if (localData) {
                              try {
                                const parsed = JSON.parse(localData);
                                const filteredLocal = parsed.filter(h => itemId ? h.id !== itemId : h.timestamp !== item.timestamp);
                                localStorage.setItem('ai_script_history_v1', JSON.stringify(filteredLocal));
                              } catch (e) {
                                localStorage.setItem('ai_script_history_v1', JSON.stringify(updated));
                              }
                            } else {
                              localStorage.setItem('ai_script_history_v1', JSON.stringify(updated));
                            }
                            
                            return updated;
                          });

                          // If it's a real document in Firestore, delete it there too
                          if (itemId && !itemId.startsWith('temp_')) {
                            try {
                              await deleteDoc(doc(db, 'script_history', itemId));
                            } catch (e) {
                              console.warn('Could not delete from Firestore, may be local only.', e);
                            }
                          }
                        } catch (err) {
                          console.error("Failed to delete history item:", err);
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                      title="Delete History"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TranslationEditor;
