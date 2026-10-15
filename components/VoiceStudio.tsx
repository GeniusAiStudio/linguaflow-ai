import { get, set } from 'idb-keyval';

import React, { useState, useRef, useEffect } from 'react';
import { calculateTextCost } from '../utils/creditCosts';
import { geminiService } from '../services/geminiService';
import { ttsService } from '../services/ttsService';
import { audioBufferToWav, downloadAudio } from '../services/audioUtils';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../services/firebase';
import { Music, Trash2, Play, Pause, History, X } from 'lucide-react';

interface VoiceHistoryItem {
  id: string;
  userId: string;
  scriptText: string;
  voiceName: string;
  audioUrl: string;
  timestamp: number;
}

interface VoiceStudioProps {
  onRequireCredits: (amount: number) => Promise<boolean>;
}

enum VoiceEngine {
  NEURAL = 'NEURAL',
  SYSTEM = 'SYSTEM'
}

interface AICharacter {
  id: string;
  name: string;
  gender: 'MALE' | 'FEMALE';
  desc: string;
}

const MALE_VOICES: AICharacter[] = [
  { id: 'Charon', name: 'Charon', gender: 'MALE', desc: 'Deep & Resonant (Neural)' },
  { id: 'Fenrir', name: 'Fenrir', gender: 'MALE', desc: 'Strong & Narrative (Neural)' },
  { id: 'Puck', name: 'Puck', gender: 'MALE', desc: 'Energetic & Youthful (Neural)' },
  { id: 'my-MM-ThihaNeural', name: 'Thiha', gender: 'MALE', desc: 'Microsoft Burmese Male' },
];

const FEMALE_VOICES: AICharacter[] = [
  { id: 'Kore', name: 'Kore', gender: 'FEMALE', desc: 'Professional & Authoritative (Neural)' },
  { id: 'Zephyr', name: 'Zephyr', gender: 'FEMALE', desc: 'Bright & Friendly (Neural)' },
  { id: 'my-MM-NilarNeural', name: 'Nilar', gender: 'FEMALE', desc: 'Microsoft Burmese Female' },
];

interface CharacterCardProps {
  character: AICharacter;
  isSelected: boolean;
  isGenerating: boolean;
  isPlaying: boolean;
  onSelect: (id: string) => void;
  onPlay: (id: string) => void;
}

const CharacterCard: React.FC<CharacterCardProps> = ({ 
  character, 
  isSelected, 
  isGenerating, 
  isPlaying,
  onSelect, 
  onPlay 
}) => {
  return (
    <div 
      onClick={() => onSelect(character.id)}
      className={`relative group p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${
        isSelected 
          ? 'bg-blue-600/10 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.15)]' 
          : 'bg-[#080808] border-[#222222] hover:border-[#333333]'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
           <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${isSelected ? 'bg-blue-600 text-white' : 'bg-[#111111] text-[#333333]'}`}>
             {character.name[0]}
           </div>
           <div>
             <div className="flex items-center gap-2">
               <h4 className={`text-sm font-black uppercase tracking-tight ${isSelected ? 'text-white' : 'text-slate-400'}`}>{character.name}</h4>
               <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${
                 character.gender === 'MALE' 
                   ? 'text-blue-400 border-blue-400/20 bg-blue-400/5' 
                   : 'text-rose-400 border-rose-400/20 bg-rose-400/5'
               }`}>
                 {character.gender}
               </span>
             </div>
             <p className="text-[10px] text-slate-600 font-medium truncate max-w-[120px]">{character.desc}</p>
           </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-black uppercase tracking-widest hidden md:block ${isSelected ? 'text-blue-400' : 'text-slate-600'}`}>Play Test</span>
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(character.id);
              onPlay(character.id);
            }}
            disabled={isGenerating || isPlaying}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              isSelected 
                ? 'bg-blue-500 text-white hover:bg-blue-400 shadow-lg shadow-blue-500/20' 
                : 'bg-slate-800 text-slate-400 hover:text-white'
            } disabled:opacity-20 active:scale-90`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>


    </div>
  );
};
const VoiceStudio: React.FC<VoiceStudioProps> = ({ onRequireCredits }) => {
  const [script, setScript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [engine, setEngine] = useState<VoiceEngine>(VoiceEngine.NEURAL);
  const [lastGeneratedBlob, setLastGeneratedBlob] = useState<Blob | null>(null);
  
  // Manual playback state for generated MP3/WAV
  const [manualAudioUrl, setManualAudioUrl] = useState<string | null>(null);
  const manualAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isManualPlaying, setIsManualPlaying] = useState(false);
  const [manualPlaybackProgress, setManualPlaybackProgress] = useState(0);
  const [manualAudioDuration, setManualAudioDuration] = useState(0);
  const [manualCurrentTime, setManualCurrentTime] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // New states for real-time Voice History
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<VoiceHistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [playingHistoryId, setPlayingHistoryId] = useState<string | null>(null);
  const historyAudioRef = useRef<HTMLAudioElement | null>(null);
  const playTestAudioRef = useRef<HTMLAudioElement | null>(null);

  const getVoiceDisplayName = (id: string) => {
    if (id === 'my-MM-ThihaNeural') return 'Thiha (Microsoft)';
    if (id === 'my-MM-NilarNeural') return 'Nilar (Microsoft)';
    return id;
  };

  const getVoiceHistoryName = (id: string) => {
    if (id === 'my-MM-ThihaNeural') return 'Thiha (Male) - Microsoft';
    if (id === 'my-MM-NilarNeural') return 'Nilar (Female) - Microsoft';
    if (id === 'Charon') return 'Charon (Male) - Neural';
    if (id === 'Fenrir') return 'Fenrir (Male) - Neural';
    if (id === 'Puck') return 'Puck (Male) - Neural';
    if (id === 'Kore') return 'Kore (Female) - Neural';
    if (id === 'Zephyr') return 'Zephyr (Female) - Neural';
    return `${id} - Neural`;
  };

  const stopAllAudio = () => {
    // Stop Web Audio source
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
      } catch (e) {}
      activeSourceRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    setIsPlaying(false);

    // Stop manual audio
    if (manualAudioRef.current) {
      try {
        manualAudioRef.current.pause();
      } catch (e) {}
      setIsManualPlaying(false);
    }

    // Stop history audio
    if (historyAudioRef.current) {
      try {
        historyAudioRef.current.pause();
      } catch (e) {}
      setPlayingHistoryId(null);
    }

    // Stop play test audio
    if (playTestAudioRef.current) {
      try {
        playTestAudioRef.current.pause();
      } catch (e) {}
      playTestAudioRef.current = null;
    }

    // Cancel speech synthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  // Cleanup on unmount or when changing components/features
  useEffect(() => {
    return () => {
      stopAllAudio();
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (e) {}
        audioContextRef.current = null;
      }
    };
  }, []);

  // Real-time synchronization of Voice History with Firestore and localStorage
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    const setupSync = (userId: string) => {
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }

      const q = query(
        collection(db, 'voice_history'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc')
      );

      unsubscribeFirestore = onSnapshot(q, (snapshot) => {
        const items: VoiceHistoryItem[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          items.push({
            id: doc.id,
            userId: data.userId || userId,
            scriptText: data.scriptText || '',
            voiceName: data.voiceName || '',
            audioUrl: data.audioUrl || '',
            timestamp: data.timestamp || Date.now()
          });
        });

        setHistory(items);
        set('ai_voice_history_v1', items).catch(e => { console.error('IndexedDB quota exceeded:', e); setToastMessage('Storage limit reached! Please delete some voice history to free up space.'); });
      }, (error) => {
        console.warn("Firestore onSnapshot subscription failed (using localStorage):", error);
        // Fallback to localStorage
        get('ai_voice_history_v1').then(data => {
            if (data) setHistory(data);
          }).catch(e => console.error('Failed to read from IndexedDB', e));
      });
    };

    // Listen to auth state changes to dynamically resync the correct user's history!
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      const userId = firebaseUser?.uid || 'usr_guest';
      
      // First, load from localStorage instantly
      get('ai_voice_history_v1').then((parsed: any) => {
        if (parsed) {
          const filtered = parsed.filter((item: any) => item.userId === userId);
          setHistory(filtered);
        }
      }).catch(e => console.error('Failed to read from IndexedDB', e));

      if (firebaseUser) {
        setupSync(userId);
      } else {
        // Guest mode - unsubscribe from Firestore, use local storage only
        if (unsubscribeFirestore) {
          unsubscribeFirestore();
          unsubscribeFirestore = null;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  }, []);

  // Play/Pause toggle handler for History List items
  const handleTogglePlayHistory = (item: VoiceHistoryItem) => {
    if (playingHistoryId === item.id) {
      if (historyAudioRef.current) {
        historyAudioRef.current.pause();
      }
      setPlayingHistoryId(null);
      return;
    }

    // Stop any currently playing audio
    stopAllAudio();
    if (historyAudioRef.current) {
      historyAudioRef.current.pause();
      historyAudioRef.current = null;
    }

    const audio = new Audio(item.audioUrl);
    historyAudioRef.current = audio;
    setPlayingHistoryId(item.id);

    audio.play().catch(err => {
      console.error("Failed to play history audio:", err);
      setPlayingHistoryId(null);
    });

    audio.onended = () => {
      setPlayingHistoryId(null);
    };
  };

  // Delete handler for History List items
  const handleDeleteHistoryItem = async (itemId: string) => {
    // 1. Stop playing if this item is currently playing
    if (playingHistoryId === itemId) {
      if (historyAudioRef.current) {
        historyAudioRef.current.pause();
      }
      setPlayingHistoryId(null);
    }

    // 2. Instantly remove from local state and localStorage for zero-lag UI
    setHistory(prev => prev.filter(item => item.id !== itemId));
    
    get('ai_voice_history_v1').then((parsed: any) => {
      if (parsed) {
        const filtered = parsed.filter((item: any) => item.id !== itemId);
        set('ai_voice_history_v1', filtered).catch(e => { console.error('IndexedDB quota exceeded:', e); setToastMessage('Storage limit reached! Please delete some voice history to free up space.'); });
      }
    }).catch(e => console.error('Failed to read from IndexedDB', e));

    // 3. Asynchronously remove from Firestore if logged in and not a temp id
    if (auth.currentUser && !itemId.startsWith('temp_')) {
      try {
        await deleteDoc(doc(db, 'voice_history', itemId));
      } catch (err) {
        console.error("Failed to delete record from Firestore", err);
      }
    }
  };

  // Set up manual audio player when lastGeneratedBlob changes
  useEffect(() => {
    if (lastGeneratedBlob) {
      const url = URL.createObjectURL(lastGeneratedBlob);
      setManualAudioUrl(url);

      const audio = new Audio(url);
      manualAudioRef.current = audio;

      audio.onloadedmetadata = () => {
        setManualAudioDuration(audio.duration || 0);
      };

      audio.ontimeupdate = () => {
        setManualCurrentTime(audio.currentTime || 0);
        setManualPlaybackProgress(
          audio.duration ? (audio.currentTime / audio.duration) * 100 : 0
        );
      };

      audio.onended = () => {
        setIsManualPlaying(false);
        setManualCurrentTime(0);
        setManualPlaybackProgress(0);
      };

      return () => {
        audio.pause();
        URL.revokeObjectURL(url);
        manualAudioRef.current = null;
        setIsManualPlaying(false);
        setManualCurrentTime(0);
        setManualPlaybackProgress(0);
      };
    } else {
      setManualAudioUrl(null);
      manualAudioRef.current = null;
    }
  }, [lastGeneratedBlob]);

  const handleToggleManualPlay = () => {
    if (!manualAudioRef.current) return;

    if (isManualPlaying) {
      manualAudioRef.current.pause();
      setIsManualPlaying(false);
    } else {
      // Pause any web audio play tests first
      if (activeSourceRef.current) {
        try {
          activeSourceRef.current.stop();
        } catch (e) {}
        activeSourceRef.current = null;
        setIsPlaying(false);
      }

      manualAudioRef.current.play().then(() => {
        setIsManualPlaying(true);
      }).catch(err => {
        console.error("Manual play failed", err);
      });
    }
  };

  const handleSeekManual = (percent: number) => {
    if (!manualAudioRef.current || !manualAudioDuration) return;
    const newTime = (percent / 100) * manualAudioDuration;
    manualAudioRef.current.currentTime = newTime;
    setManualCurrentTime(newTime);
    setManualPlaybackProgress(percent);
  };

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return '0:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleGenerateAndPlay = async (voiceOverride?: string) => {
    const voiceToUse = voiceOverride || selectedVoice;
    const isPlayTest = !!voiceOverride;
    
    // For preview buttons, use a default text if script is empty
    let textToSpeak = script.trim();
    if (!textToSpeak) {
      const voiceForFallback = voiceToUse || 'Kore';
      if (voiceForFallback === 'my-MM-ThihaNeural') {
        textToSpeak = 'မင်္ဂလာပါ၊ ကျွန်တော်က သီဟ ဖြစ်ပါတယ်။';
      } else if (voiceForFallback === 'my-MM-NilarNeural') {
        textToSpeak = 'မင်္ဂလာပါ၊ ကျွန်မက နီလာ ဖြစ်ပါတယ်။';
      } else if (voiceForFallback === 'Kore') {
        textToSpeak = 'Hello! My name is Kore. I am a professional and authoritative female voice.';
      } else if (voiceForFallback === 'Zephyr') {
        textToSpeak = 'Hello! My name is Zephyr. I am a bright and friendly female voice.';
      } else if (voiceForFallback === 'Charon') {
        textToSpeak = 'Hello! My name is Charon. I am a deep and resonant male voice.';
      } else if (voiceForFallback === 'Fenrir') {
        textToSpeak = 'Hello! My name is Fenrir. I am a strong and narrative male voice.';
      } else if (voiceForFallback === 'Puck') {
        textToSpeak = 'Hello! My name is Puck. I am an energetic and youthful male voice.';
      } else {
        textToSpeak = `Hello, I am ${voiceForFallback}.`;
      }
    }

    if (!textToSpeak) {
      setToastMessage("Please enter some text to generate speech.");
      return;
    }
    
    if (isGenerating) return;
    
    // If it's a real script generation, clear the previous blob first
    if (!isPlayTest) {
      setLastGeneratedBlob(null);
    }

    // If it's a play test, we bypass system voice fallback to ensure high-fidelity preview
    if (engine === VoiceEngine.SYSTEM && !isPlayTest) {
      stopAllAudio();
      setIsPlaying(true);
      await ttsService.speak(textToSpeak, {
        rate: 0.45,
        pitch: 1.0,
        volume: 1.0
      });
      setIsPlaying(false);
      return;
    }

    setIsGenerating(true);
    try {
      const audioBuffer = await geminiService.generateSpeech(textToSpeak, voiceToUse);
      
      const wavBlob = audioBufferToWav(audioBuffer);
      setLastGeneratedBlob(wavBlob);

      // Save to voice history immediately (real-time, zero-lag)
      try {
        const reader = new FileReader();
        reader.readAsDataURL(wavBlob);
        reader.onloadend = async () => {
          const base64Url = reader.result as string;
          const userId = auth.currentUser?.uid || 'usr_guest';
          const newItem = {
            userId,
            scriptText: textToSpeak,
            voiceName: voiceToUse,
            audioUrl: base64Url,
            timestamp: Date.now()
          };

          const tempId = 'temp_' + Date.now();
          const localItem: VoiceHistoryItem = { id: tempId, ...newItem };
          
          setHistory(prev => [localItem, ...prev]);

          // Sync with localStorage
          get('ai_voice_history_v1').then((currentItems: any) => {
            const items = currentItems || [];
            set('ai_voice_history_v1', [localItem, ...items]).catch(e => { 
                console.error('IndexedDB quota exceeded:', e); 
                setToastMessage('Storage limit reached! Please delete some voice history to free up space.'); 
            });
          }).catch(e => console.error('Failed to read/write IndexedDB', e));

          // Save to Firestore if logged in
          if (auth.currentUser) {
            try {
              await addDoc(collection(db, 'voice_history'), newItem);
            } catch (fsErr) {
              console.error("Firestore save failed, fallback to local only:", fsErr);
            }
          }
        };
      } catch (historyErr) {
        console.error("Failed to process voice history:", historyErr);
      }

      // Stop any actively playing audio
      stopAllAudio();

      if (isPlayTest) {
        // Direct profile clicks ("Play Test") should immediately autoplay using the HTML5 Audio API
        const audioUrl = URL.createObjectURL(wavBlob);
        const playTestAudio = new Audio(audioUrl);
        playTestAudioRef.current = playTestAudio;

        playTestAudio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
          if (playTestAudioRef.current === playTestAudio) {
            playTestAudioRef.current = null;
          }
        };

        playTestAudio.onerror = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
          if (playTestAudioRef.current === playTestAudio) {
            playTestAudioRef.current = null;
          }
        };

        setIsPlaying(true);
        playTestAudio.play().catch(err => {
          console.error("Play test audio playback failed:", err);
          setIsPlaying(false);
        });
      } else {
        // Main generate script voiceover does NOT autoplay now.
        // It saves to lastGeneratedBlob, which displays the beautiful manual audio controller.
        setIsPlaying(false);
      }
      
      
    } catch (err: any) {
      console.error("Voice generation failed.", err);
      const isMicrosoftVoice = voiceToUse.endsWith('Neural') && voiceToUse.includes('-');
      setToastMessage(
        isMicrosoftVoice
          ? `Microsoft ${getVoiceHistoryName(voiceToUse)} voice failed: ${err.message}. No substitute voice was used.`
          : `Neural synthesis failed: ${err.message}`,
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!lastGeneratedBlob) return;
    downloadAudio(lastGeneratedBlob, `voice_over_${Date.now()}.wav`);
  };

  return (
    <div className="flex-1 flex flex-col gap-6 animate-flutter-fade bg-black rounded-[2.5rem] p-10 shadow-2xl border border-[#111111] max-w-5xl mx-auto w-full">
      <div className="flex flex-col md:flex-row items-center justify-between border-b border-[#111111] pb-6 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight uppercase italic">AI Voice Studio</h2>
            <p className="text-[10px] font-bold text-[#444444] uppercase tracking-[0.3em]">Neural Character Selection</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#080808] hover:bg-[#111111] text-slate-300 hover:text-white border border-[#222222] rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
          >
            <History className="w-3.5 h-3.5 text-red-500" />
            Voice History ({history.length})
          </button>

          <div className="flex p-1 bg-[#080808] rounded-xl border border-[#222222]">
            <button 
              onClick={() => setEngine(VoiceEngine.NEURAL)}
              className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${engine === VoiceEngine.NEURAL ? 'bg-red-600 text-white shadow-sm' : 'text-[#444444] hover:text-[#666666]'}`}
            >
              Neural Core
            </button>
            <button 
              onClick={() => setEngine(VoiceEngine.SYSTEM)}
              className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${engine === VoiceEngine.SYSTEM ? 'bg-slate-700 text-white shadow-sm' : 'text-[#444444] hover:text-[#666666]'}`}
            >
              System Legacy
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Script Input */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Production Script</label>
            <span className="text-[9px] font-bold text-slate-700 uppercase">{script.length} / 20,000</span>
          </div>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value.slice(0, 20000))}
            rows={12}
            placeholder="Enter text for high-fidelity voice synthesis..."
            className="w-full p-8 bg-[#050505] border border-[#222222] rounded-[2rem] text-white focus:outline-none focus:border-blue-500/50 resize-none font-medium text-lg leading-relaxed placeholder:text-[#111111] custom-scrollbar shadow-inner"
          />
          <div className="flex justify-between items-center px-2">
            <div className="flex gap-4">
               {lastGeneratedBlob && (
                 <button onClick={handleDownload} className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-400 flex items-center gap-2 transition-colors">
                   <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                   Export Master WAV
                 </button>
               )}
            </div>
            <button 
              onClick={() => setScript('')}
              className="text-[9px] font-black text-slate-600 hover:text-red-500 uppercase tracking-widest transition-colors"
            >
              Clear Buffer
            </button>
          </div>
        </div>

        {/* Right Column: Character Selection */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          {engine === VoiceEngine.NEURAL ? (
            <>
              {/* FEMALE GROUP: Kore, Zephyr, Nilar */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Female Characters
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {FEMALE_VOICES.map(v => (
                    <CharacterCard 
                      key={v.id} 
                      character={v}
                      isSelected={selectedVoice === v.id}
                      isGenerating={isGenerating}
                      isPlaying={isPlaying}
                      onSelect={setSelectedVoice}
                      onPlay={(id) => handleGenerateAndPlay(id)}
                    />
                  ))}
                </div>
              </div>

              {/* MALE GROUP: Charon, Fenrir, Puck */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Male Characters
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {MALE_VOICES.map(v => (
                    <CharacterCard 
                      key={v.id} 
                      character={v} 
                      isSelected={selectedVoice === v.id}
                      isGenerating={isGenerating}
                      isPlaying={isPlaying}
                      onSelect={setSelectedVoice}
                      onPlay={(id) => handleGenerateAndPlay(id)}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
             <div className="flex-1 bg-[#080808] border border-[#222222] rounded-[2rem] p-10 flex flex-col items-center justify-center text-center gap-6">
              <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h4 className="text-white font-black uppercase text-xs tracking-[0.2em] mb-2">Legacy Engine Active</h4>
                <p className="text-[10px] text-slate-600 font-medium leading-relaxed max-w-[200px] mx-auto">Using native OS synthesis. Audio quality and character personalities are restricted.</p>
              </div>
              <button 
                onClick={() => setEngine(VoiceEngine.NEURAL)}
                className="px-6 py-2 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all"
              >
                Restore Neural Core
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Execution Bar */}
      <div className="mt-6 pt-6 border-t border-[#111111]">
        <button
          onClick={() => handleGenerateAndPlay()}
          disabled={isGenerating || isPlaying || (!script.trim() && engine !== VoiceEngine.SYSTEM)}
          className={`w-full py-5 rounded-2xl font-black transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-4 border-b-4 ${
            isPlaying 
              ? 'bg-blue-500 text-white animate-pulse border-blue-700' 
              : 'bg-red-600 hover:bg-red-500 text-white border-red-800'
          } disabled:opacity-20`}
        >
          {isGenerating ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="text-xs uppercase tracking-[0.2em]">Processing Audio...</span>
            </>
          ) : isPlaying ? (
            <span className="text-xs uppercase tracking-[0.2em] italic">Streaming: {getVoiceDisplayName(selectedVoice)}...</span>
          ) : (
            <>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              </svg>
              <span className="text-sm uppercase tracking-[0.2em]">Generate {getVoiceDisplayName(selectedVoice)} Voiceover</span>
            </>
          )}
        </button>
      </div>

      {/* Monitor Sandbox */}
      <div className="bg-[#050505] rounded-[2rem] p-8 min-h-[140px] flex flex-col items-center justify-center border border-[#111111] relative overflow-hidden group mt-4">
        <div className="absolute inset-0 bg-red-600/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        {isPlaying ? (
           <div className="flex flex-col items-center gap-5 animate-flutter-fade w-full">
             <div className="flex gap-2 items-end h-10">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.08}s`, height: `${Math.random() * 32 + 12}px` }} />
                ))}
             </div>
             <div className="flex flex-col items-center">
               <p className="text-blue-400 font-black text-center text-[10px] uppercase tracking-[0.4em]">
                 Neural Vocal Pipeline: Active
               </p>
               <span className="text-[8px] text-slate-700 uppercase font-black tracking-widest mt-1">Real-time PCM Streaming @ 24kHz</span>
             </div>
           </div>
        ) : lastGeneratedBlob ? (
          <div className="w-full flex flex-col gap-4 animate-flutter-fade">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleManualPlay}
                  className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-all active:scale-95"
                >
                  {isManualPlaying ? (
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 fill-current ml-1" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </button>
                <div>
                  <h4 className="text-white font-black text-xs uppercase tracking-wider">Generated Voiceover Master</h4>
                  <p className="text-[9px] text-slate-500 font-bold tracking-widest mt-0.5">
                    {formatTime(manualCurrentTime)} / {formatTime(manualAudioDuration)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {isManualPlaying && (
                  <div className="flex gap-1 items-end h-5 mr-2">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="w-1 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s`, height: `${Math.random() * 16 + 4}px` }} />
                    ))}
                  </div>
                )}
                <button
                  onClick={handleDownload}
                  className="p-2 bg-[#080808] border border-[#222222] hover:border-red-600 text-slate-400 hover:text-white rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download WAV
                </button>
              </div>
            </div>
            
            {/* Scrubbable progress bar */}
            <div className="w-full flex items-center gap-3">
              <span className="text-[9px] font-mono text-slate-600">{formatTime(manualCurrentTime)}</span>
              <div 
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const percent = Math.min(Math.max((clickX / rect.width) * 100, 0), 100);
                  handleSeekManual(percent);
                }}
                className="flex-1 h-2 bg-[#111111] rounded-full cursor-pointer relative group/bar overflow-hidden"
              >
                <div 
                  className="h-full bg-red-600 rounded-full transition-all duration-100"
                  style={{ width: `${manualPlaybackProgress}%` }}
                />
                <div 
                  className="absolute h-full top-0 bg-white/20 transition-all pointer-events-none" 
                  style={{ left: `${manualPlaybackProgress}%`, width: '2px' }}
                />
              </div>
              <span className="text-[9px] font-mono text-slate-600">{formatTime(manualAudioDuration)}</span>
            </div>
          </div>
        ) : (
          <div className="text-[#111111] flex flex-col items-center gap-4">
            <svg className="w-10 h-10 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-[0.6em] opacity-40">Sandbox Pipeline Standby</span>
          </div>
        )}
      </div>

      {/* Sleek Voice History Panel */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          {/* Backdrop Click */}
          <div className="absolute inset-0" onClick={() => setIsHistoryOpen(false)} />
          
          {/* Drawer Body */}
          <div className="relative w-full max-w-md bg-[#050505] border-l border-[#111111] h-full flex flex-col shadow-2xl p-6 md:p-8 animate-slide-in-right">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#111111] pb-6 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-600/10 border border-red-500/20 rounded-xl flex items-center justify-center text-red-500">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">AI Voice History</h3>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Completed Generations ({history.length})</p>
                </div>
              </div>
              
              <button 
                onClick={() => setIsHistoryOpen(false)}
                className="w-10 h-10 rounded-xl bg-[#080808] border border-[#222222] hover:bg-[#111111] text-slate-400 hover:text-white flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#080808] border border-[#222222] flex items-center justify-center text-slate-600">
                    <Music className="w-5 h-5 opacity-40" />
                  </div>
                  <div>
                    <h4 className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-1">No voice history</h4>
                    <p className="text-[9px] text-slate-600 font-medium leading-relaxed max-w-[180px] mx-auto">Generate a voiceover to save it here.</p>
                  </div>
                </div>
              ) : (
                history.map((item) => {
                  const isItemPlaying = playingHistoryId === item.id;
                  return (
                    <div 
                      key={item.id}
                      className={`p-4 rounded-2xl border transition-all duration-300 ${
                        isItemPlaying 
                          ? 'bg-red-600/5 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.05)]' 
                          : 'bg-[#080808] border-[#222222] hover:border-[#333333]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          {/* Music Note Icon on the Left */}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                            isItemPlaying 
                              ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' 
                              : 'bg-slate-900 border border-slate-800 text-slate-400'
                          }`}>
                            <Music className="w-4 h-4" />
                          </div>
                          
                          {/* Main Title and Subtitle */}
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-black text-white truncate uppercase tracking-wide">
                              {item.scriptText || 'No Script Text'}
                            </h4>
                            <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wider truncate">
                              {getVoiceHistoryName(item.voiceName)}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Play/Pause Toggle Button */}
                          <button
                            onClick={() => handleTogglePlayHistory(item)}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                              isItemPlaying
                                ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                                : 'bg-[#111111] hover:bg-[#1b1b1b] text-slate-300 hover:text-white border border-[#222222]'
                            }`}
                          >
                            {isItemPlaying ? (
                              <Pause className="w-4 h-4 fill-current animate-pulse" />
                            ) : (
                              <Play className="w-4 h-4 fill-current ml-0.5" />
                            )}
                          </button>

                          {/* Red 'Delete' Trash Icon */}
                          <button
                            onClick={() => handleDeleteHistoryItem(item.id)}
                            className="w-9 h-9 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-[#1a1a1a] border border-[#333] text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-in fade-in slide-in-from-bottom-4">
          <span className="text-sm font-medium">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-slide-in-right {
          animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default VoiceStudio;
