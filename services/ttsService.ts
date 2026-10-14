
export class TtsService {
  private synth: SpeechSynthesis | null = null;
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth && this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (!this.synth) return;
    try {
      const voices = this.synth.getVoices();
      // Try to find a good US English voice as default
      this.voice = voices.find(v => v.lang === 'en-US') || voices[0] || null;
    } catch (e) {
      console.warn("Failed to load synthesis voices:", e);
    }
  }

  /**
   * Standard System TTS implementation
   * Mirroring Flutter snippet parameters:
   * Language: en-US, Rate: 0.45, Pitch: 1.0, Volume: 1.0
   */
  async speak(text: string, options?: { rate?: number; pitch?: number; volume?: number; lang?: string }) {
    if (!text || !this.synth) return;

    try {
      this.synth.cancel(); // flutterTts.stop()

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = this.voice;
      utterance.lang = options?.lang || 'en-US';
      utterance.rate = options?.rate ?? 0.45; // Matches Flutter setSpeechRate(0.45)
      utterance.pitch = options?.pitch ?? 1.0;
      utterance.volume = options?.volume ?? 1.0;

      return new Promise<void>((resolve) => {
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        this.synth?.speak(utterance);
      });
    } catch (e) {
      console.error("Speech synthesis failed:", e);
    }
  }

  stop() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (e) {
        console.error("Failed to stop synthesis:", e);
      }
    }
  }
}

export const ttsService = new TtsService();
