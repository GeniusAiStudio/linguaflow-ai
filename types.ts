
export enum ViewMode {
  HOME = 'HOME',
  CONVERSATION = 'CONVERSATION',
  EDITOR = 'EDITOR',
  GENERATOR = 'GENERATOR',
  WALLET = 'WALLET',
  PROFILE = 'PROFILE',
  PDF_ARCHITECT = 'PDF_ARCHITECT',
  ILLUSTRATOR = 'ILLUSTRATOR',
  VOICE_STUDIO = 'VOICE_STUDIO',
  PRIVACY_POLICY = 'PRIVACY_POLICY',
  TERMS_OF_SERVICE = 'TERMS_OF_SERVICE',
  ABOUT_US = 'ABOUT_US',
  CONTACT_US = 'CONTACT_US',
  LOGIN = 'LOGIN',
  PREMIUM = 'PREMIUM',
  PAYMENT_METHOD = 'PAYMENT_METHOD',
  VERIFY_EMAIL = 'VERIFY_EMAIL',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
  RECAP_SCRIPT_WRITER = 'RECAP_SCRIPT_WRITER',
  VIDEO_EDITOR = 'VIDEO_EDITOR',
  SRT_TRANSLATOR = 'SRT_TRANSLATOR',
  STORY_TELLER = 'STORY_TELLER',
  VIDEO_TRANSCRIBER = 'VIDEO_TRANSCRIBER',
  SYSTEM_STATUS = 'SYSTEM_STATUS',
  AUDIO_SPLITTER = 'AUDIO_SPLITTER',
  TIKTOK_DOWNLOADER = 'TIKTOK_DOWNLOADER',
  AUTO_RECAP = 'AUTO_RECAP',
  ADMIN = 'ADMIN'
}

export enum TranscriptionProvider {
  GEMINI_LIVE = 'GEMINI_LIVE',
  WHISPER_BACKEND = 'WHISPER_BACKEND'
}

export enum TranslationProvider {
  GEMINI = 'GEMINI',
  BACKEND = 'BACKEND'
}

export enum TranslationTone {
  NATURAL = 'NATURAL',
  CREATIVE = 'CREATIVE',
  PROFESSIONAL = 'PROFESSIONAL'
}

export enum TranscriptionMode {
  TEXT = 'TEXT',
  SUBTITLES = 'SUBTITLES'
}

export enum ScriptType {
  VIDEO_SCRIPT = 'VIDEO_SCRIPT',
  NARRATION = 'NARRATION',
  STORY = 'STORY',
  PODCAST = 'PODCAST'
}

export enum ScriptFormat {
  DIALOGUE = 'DIALOGUE',
  NARRATION = 'NARRATION',
  NONE = 'NONE'
}

export enum UserTier {
  FREE = 'FREE',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE'
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  tier: UserTier;
  credits: number;
  dailyLimitUsed: number;
  srtLimit: number;
  voiceLimit: number;
  emailVerified: boolean;
  preferredLanguage?: string;
}

export interface TranslationEntry {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
  transcriptionProvider: TranscriptionProvider;
  translationProvider: TranslationProvider;
  tone?: TranslationTone;
  isSrt?: boolean;
}

export interface Language {
  code: string;
  name: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'my', name: 'Burmese', flag: '🇲🇲' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
];
