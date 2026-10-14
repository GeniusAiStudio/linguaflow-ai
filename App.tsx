import React, { useState, useEffect } from 'react';
import { ViewMode, UserProfile, UserTier, TranslationProvider, TranslationTone } from './types';
import { projectService, RecentProject } from './services/projectService';
import TranslationEditor from './components/TranslationEditor';
import ScriptGenerator from './components/ScriptGenerator';
import CreditWallet from './components/CreditWallet';
import { CreditModal } from './components/CreditModal';

import UserProfileView from './components/UserProfileView';
import PdfArchitect from './components/PdfArchitect';
import IllustrationHub from './components/IllustrationHub';
import VoiceStudio from './components/VoiceStudio';
import PrivacyPolicyView from './components/PrivacyPolicyView';
import TermsOfServiceView from './components/TermsOfServiceView';
import AboutUsView from './components/AboutUsView';
import ContactUsView from './components/ContactUsView';
import LoginView from './components/LoginView';
import PremiumPlansView from './components/PremiumPlansView';
import PaymentMethodView from './components/PaymentMethodView';
import VerificationPendingView from './components/VerificationPendingView';
import ForgotPasswordView from './components/ForgotPasswordView';
import RecapScriptWriter from './components/RecapScriptWriter';
import VideoEditor from './components/VideoEditor';
import SmartLinkAd from './components/SmartLinkAd';
import SystemStatusView from './components/SystemStatusView';
import StoryTeller from './components/StoryTeller';
import VideoTranscriber from './components/VideoTranscriber';
import AudioSplitter from './components/AudioSplitter';
import TikTokDownloader from './components/TikTokDownloader';
import AutoRecap from './components/AutoRecap';
import AdminDashboard from './components/AdminDashboard';
import { authService } from './services/authService';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './services/firebase';
import { UserProfileDropdown } from './components/UserProfileDropdown';
import { auth } from './services/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all duration-200 group ${
      active 
        ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-[0_0_20px_rgba(37,99,235,0.15)]' 
        : 'text-slate-500 hover:bg-slate-800/40 hover:text-slate-300 border border-transparent'
    }`}
  >
    <span className={`transition-colors duration-200 ${active ? 'text-blue-500' : 'text-slate-600 group-hover:text-slate-400'}`}>
      {icon}
    </span>
    <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
    {active && (
      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
    )}
  </button>
);

const FeatureCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}> = ({ title, icon, color, onClick }) => (
  <div 
    onClick={onClick}
    className="bg-[#111111] hover:bg-[#161616] border border-[#222222] hover:border-blue-500/40 rounded-2xl p-6 cursor-pointer group transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-blue-900/10 flex flex-col items-center text-center gap-4 h-full justify-center"
  >
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-lg`} style={{ backgroundColor: `${color}15`, color: color }}>
      {icon}
    </div>
    <span className="text-sm font-bold text-slate-200 uppercase tracking-widest group-hover:text-white transition-colors">{title}</span>
  </div>
);

const getProjectIcon = (type: ViewMode) => {
  switch (type) {
    case ViewMode.CONVERSATION:
    case ViewMode.SRT_TRANSLATOR:
      return (
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </div>
      );
    case ViewMode.GENERATOR:
      return (
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20 shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </div>
      );
    case ViewMode.STORY_TELLER:
      return (
        <div className="w-10 h-10 rounded-xl bg-fuchsia-500/10 text-fuchsia-400 flex items-center justify-center border border-fuchsia-500/20 shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
        </div>
      );
    case ViewMode.AUTO_RECAP:
      return (
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        </div>
      );
    default:
      return (
        <div className="w-10 h-10 rounded-xl bg-slate-500/10 text-slate-400 flex items-center justify-center border border-slate-500/20 shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        
</div>
      );
  }
};

const getProjectTypeName = (type: ViewMode) => {
  switch (type) {
    case ViewMode.CONVERSATION:
      return 'Script Architect / Translator';
    case ViewMode.SRT_TRANSLATOR:
      return 'SRT Translator';
    case ViewMode.GENERATOR:
      return 'Script Creator';
    case ViewMode.STORY_TELLER:
      return 'Story Teller';
    case ViewMode.AUTO_RECAP:
      return 'Autorecap AI';
    default:
      return 'Task Document';
  }
};

const isPublicView = (mode: ViewMode) => {
  return [
    ViewMode.LOGIN,
    ViewMode.FORGOT_PASSWORD,
    ViewMode.VERIFY_EMAIL,
    ViewMode.PRIVACY_POLICY,
    ViewMode.TERMS_OF_SERVICE,
    ViewMode.ABOUT_US,
    ViewMode.CONTACT_US
  ].includes(mode);
};


// Isolated Adsterra Ad Component
const AdsterraAd = ({ width, height, adKey }: { width: number, height: number, adKey: string }) => {
  const srcDoc = `<!DOCTYPE html><html><head><style>body{margin:0;padding:0;overflow:hidden;background:transparent;display:flex;justify-content:center;align-items:center;}</style></head><body><script type="text/javascript">var atOptions = {'key' : '${adKey}', 'format' : 'iframe', 'height' : ${height}, 'width' : ${width}, 'params' : {}};</script><script type="text/javascript" src="https://www.highperformanceformat.com/${adKey}/invoke.js"></script></body></html>`;
  return (
    <iframe
      srcDoc={srcDoc}
      width={width}
      height={height}
      frameBorder="0"
      scrolling="no"
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      style={{ border: 'none', overflow: 'hidden', width: `${width}px`, height: `${height}px` }}
    />
  );
};

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const isVip = localStorage.getItem('isVipMember');
      const isGuest = sessionStorage.getItem('isGuestSession');
      if (isVip !== 'true' && isGuest !== 'true') {
        return ViewMode.LOGIN;
      }
    }
    return ViewMode.HOME;
  });
  const [isMobileAdVisible, setIsMobileAdVisible] = useState(true);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(undefined);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string>('');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  useEffect(() => {
    if (viewMode === ViewMode.HOME) {
      setRecentProjects(projectService.getRecentProjects().slice(0, 5));
    }
  }, [viewMode]);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      return savedTheme !== 'light';
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    const el = document.body;
    if (isDarkMode) {
      el.classList.remove('light-mode');
    } else {
      el.classList.add('light-mode');
    }
  }, [isDarkMode]);
  
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [user, setUser] = useState<UserProfile>(() => {
    let guestCredits = 500;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('guest_credits');
      if (stored !== null) guestCredits = parseInt(stored, 10);
      else localStorage.setItem('guest_credits', '500');
    }
    return {
      id: 'usr_guest',
      name: 'Guest User',
      email: 'guest@linguaflow.mm',
      tier: UserTier.FREE,
      credits: guestCredits,
      dailyLimitUsed: 0,
      srtLimit: 0,
      voiceLimit: 0,
      emailVerified: false
    };
  });

  // Handle persistence & Auth changes
  useEffect(() => {
    authService.initialize().catch(err => {
      console.error("Auth service initialization failed:", err);
      setIsAuthLoading(false);
    });

    const isVip = localStorage.getItem('isVipMember') === 'true';
    const vipId = localStorage.getItem('vip_membership_id');

    if (isVip && vipId) {
      setUser(prev => ({
        ...prev,
        id: vipId,
        name: 'VIP Member',
        email: `${vipId}@vip.user`,
        emailVerified: true,
        tier: UserTier.PRO
      }));
      setIsAuthLoading(false);
      // We don't subscribe to authStateChanged if VIP. 
      // But we need to return a dummy unsubscribe function
      return () => {};
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          let userCredits = 100;
          if (userSnap.exists()) {
             userCredits = userSnap.data().credits ?? 100;
          } else {
             await setDoc(userRef, { credits: 100 }, { merge: true });
          }

          setUser(prev => ({
            ...prev,
            id: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            email: firebaseUser.email || '',
            emailVerified: firebaseUser.emailVerified,
            tier: UserTier.PRO,
            credits: userCredits
          }));
        } catch (e) {
          console.error("Failed to fetch user credits", e);
          setUser(prev => ({
            ...prev,
            id: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            email: firebaseUser.email || '',
            emailVerified: firebaseUser.emailVerified,
            tier: UserTier.PRO
          }));
        }
      } else {
        let guestCredits = 500;
        const stored = localStorage.getItem('guest_credits');
        if (stored !== null) guestCredits = parseInt(stored, 10);
        
        setUser({
          id: 'usr_guest',
          name: 'Guest User',
          email: 'guest@linguaflow.mm',
          tier: UserTier.FREE,
          credits: guestCredits,
          dailyLimitUsed: 0,
          srtLimit: 0,
          voiceLimit: 0,
          emailVerified: false
        });
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Redirection when auth state loads or view mode changes
  useEffect(() => {
    if (localStorage.getItem('isVipMember') === 'true' && user.id && user.id !== 'usr_guest') {
      const unsub = onSnapshot(doc(db, 'memberships', user.id), (docSnap) => {
        if (docSnap.exists()) {
           const data = docSnap.data();
           setUser(prev => ({ ...prev, credits: data.credits || 0 }));
        }
      });
      return () => unsub();
    }
  }, [user.id]);

  useEffect(() => {
    if (!isAuthLoading) {
      const isLoggedIn = user && user.id !== 'usr_guest';
      if (!isLoggedIn && !isPublicView(viewMode)) {
        setViewMode(ViewMode.LOGIN);
      }
    }
  }, [viewMode, user, isAuthLoading]);

  const handleLogout = async () => {
      await authService.signOut();
      localStorage.removeItem('isVipMember');
      sessionStorage.removeItem('isGuestSession');
      setUser({
        id: 'usr_guest',
        name: 'Guest User',
        email: 'guest@linguaflow.mm',
        tier: UserTier.FREE,
        credits: 500,
        dailyLimitUsed: 0,
        srtLimit: 0,
        voiceLimit: 0,
        emailVerified: false
      });
      setViewMode(ViewMode.LOGIN);
  };

  
  
  const handleRequireCredits = async (amount: number): Promise<boolean> => {
    if (user.credits >= amount) {
      const newCredits = Math.max(0, user.credits - amount);
      setUser(prev => ({ ...prev, credits: newCredits }));

      if (user.id === 'usr_guest') {
        localStorage.setItem('guest_credits', newCredits.toString());
      } else if (localStorage.getItem('isVipMember') === 'true') {
        const membershipRef = doc(db, 'memberships', user.id);
        setDoc(membershipRef, { credits: newCredits }, { merge: true }).catch(err => {
          console.warn("Failed to sync VIP credits to Firestore (background):", err);
        });
      } else {
        const userRef = doc(db, 'users', user.id);
        setDoc(userRef, { credits: newCredits }, { merge: true }).catch(err => {
          console.warn("Failed to sync credits to Firestore (background):", err);
        });
      }
      
      return true;
    }
    
    setIsCreditModalOpen(true);
    return false;
  };

  const handleFeatureClick = (targetViewMode: ViewMode) => {
    const isLoggedIn = user && user.id !== 'usr_guest';
    if (!isLoggedIn) {
      // Log in မဝင်ထားရင် Login page ကို ပို့ပေးပါ
      setViewMode(ViewMode.LOGIN);
    } else {
      // Log in ဝင်ထားရင် သက်ဆိုင်ရာ Feature ကိုသွားပါ
      setViewMode(targetViewMode);
    }
  };

  const handleResumeProject = (project: RecentProject) => {
    projectService.setActiveProject(project.id);
    setViewMode(project.type);
  };

  const handleDeleteProject = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    projectService.deleteProject(projectId);
    setRecentProjects(projectService.getRecentProjects().slice(0, 5));
  };

  const renderMainView = () => {
    switch (viewMode) {
        case ViewMode.HOME:
          return (
            <div className="flex-1 p-8 md:p-12 pb-24 lg:pb-12 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-500">
              <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex flex-col gap-2">
                  <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">Home Screen</h2>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em]">Genius AI Production Suite</p>
                </div>
                
                <SmartLinkAd 
                  url="https://www.profitableratecpmnetwork.com/chrbrcmv?key=cfd8b4cec862e05e73279ed9652eb11b"
                  title="Genius Special Offer"
                  description="Check out this sponsor link to earn bonus units and support the platform!"
                  buttonText="Claim Offer"
                />

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  <FeatureCard 
                    title="Script Architect" 
                    color="#3b82f6"
                    onClick={() => handleFeatureClick(ViewMode.CONVERSATION)}
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                  />
                  <FeatureCard 
                    title="Script Creator" 
                    color="#4f46e5"
                    onClick={() => handleFeatureClick(ViewMode.GENERATOR)}
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
                  />
                  <FeatureCard 
                    title="Story Teller" 
                    color="#d946ef"
                    onClick={() => handleFeatureClick(ViewMode.STORY_TELLER)}
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
                  />
                  <FeatureCard 
                    title="Video Transcriber" 
                    color="#10b981"
                    onClick={() => handleFeatureClick(ViewMode.VIDEO_TRANSCRIBER)}
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                  />
                  <FeatureCard 
                    title="PDF Reader" 
                    color="#f59e0b"
                    onClick={() => handleFeatureClick(ViewMode.PDF_ARCHITECT)}
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                  />
                  <FeatureCard 
                    title="Thumbnail Maker" 
                    color="#10b981"
                    onClick={() => handleFeatureClick(ViewMode.ILLUSTRATOR)}
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                  />
                  <FeatureCard 
                    title="AI Voice" 
                    color="#ec4899"
                    onClick={() => handleFeatureClick(ViewMode.VOICE_STUDIO)}
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>}
                  />
                  <FeatureCard 
                    title="Recap Scriptwriter" 
                    color="#ef4444"
                    onClick={() => handleFeatureClick(ViewMode.RECAP_SCRIPT_WRITER)}
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
                  />
                  <FeatureCard 
                    title="Video Recap" 
                    color="#8b5cf6"
                    onClick={() => handleFeatureClick(ViewMode.VIDEO_EDITOR)}
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                  />
                  <FeatureCard 
                    title="Autorecap AI" 
                    color="#3b82f6"
                    onClick={() => handleFeatureClick(ViewMode.AUTO_RECAP)}
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                  />
                  <FeatureCard 
                    title="SRT Translator" 
                    color="#14b8a6"
                    onClick={() => handleFeatureClick(ViewMode.SRT_TRANSLATOR)}
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>}
                  />
                  <FeatureCard 
                    title="Audio Split" 
                    color="#3b82f6"
                    onClick={() => handleFeatureClick(ViewMode.AUDIO_SPLITTER)}
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>}
                  />
                  <FeatureCard 
                    title="TikTok Downloader" 
                    color="#141824"
                    onClick={() => handleFeatureClick(ViewMode.TIKTOK_DOWNLOADER)}
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
                  />
                  <FeatureCard 
                    title="Wallet" 
                    color="#eab308"
                    onClick={() => handleFeatureClick(ViewMode.WALLET)}
                    icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
                  />
                </div>

                {/* Recent Projects Section */}
                <div className="space-y-4 pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black text-white tracking-tight uppercase italic">Recent Projects</h3>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Resume your previous tasks instantly</p>
                    </div>
                    {recentProjects.length > 0 && (
                      <button 
                        onClick={() => {
                          if (confirm("Are you sure you want to clear your project list?")) {
                            localStorage.removeItem('genius_ai_recent_projects_v1');
                            setRecentProjects([]);
                          }
                        }}
                        className="text-[10px] font-black text-slate-500 hover:text-red-400 uppercase tracking-wider transition-colors border border-transparent hover:border-red-500/10 px-3 py-1.5 rounded-xl bg-slate-800/10 hover:bg-red-500/5 cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {recentProjects.length === 0 ? (
                    <div className="bg-[#0c0c0c] border border-[#161616] rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-600 border border-[#222]">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-300">No recent tasks detected</p>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm">Select and use any of the creator tools above. Your edited text, scripts, and audio outputs will automatically populate here.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#0A0A0A] border border-[#1a1a1a] rounded-2xl overflow-hidden divide-y divide-[#161616] shadow-xl">
                      {recentProjects.map((project) => (
                        <div 
                          key={project.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 hover:bg-[#111111]/80 transition-colors duration-200 group relative"
                        >
                          <div 
                            className="flex items-center gap-4 cursor-pointer flex-1 min-w-0"
                            onClick={() => handleResumeProject(project)}
                          >
                            {getProjectIcon(project.type)}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-slate-200 truncate group-hover:text-blue-400 transition-colors uppercase tracking-wide">
                                  {project.name}
                                </span>
                                <span className="px-2 py-0.5 bg-slate-800/60 rounded-md text-[9px] font-black uppercase text-slate-400 tracking-wider border border-[#222]">
                                  {getProjectTypeName(project.type)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  {new Date(project.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                                {project.fileName && (
                                  <>
                                    <span className="text-slate-700">•</span>
                                    <span className="text-slate-400 lowercase">{project.fileName}</span>
                                    <span className="text-slate-700">•</span>
                                    <span>{project.fileSize}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0 justify-end">
                            <button 
                              onClick={() => handleResumeProject(project)}
                              className="px-4 py-2 bg-slate-900 border border-[#222] hover:border-blue-500/30 hover:bg-blue-600/10 text-slate-300 hover:text-blue-400 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                            >
                              Resume
                            </button>
                            <button 
                              onClick={(e) => handleDeleteProject(project.id, e)}
                              className="p-2 bg-transparent text-slate-600 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-colors border border-transparent hover:border-red-500/10 cursor-pointer"
                              title="Delete task from history"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* System Preferences / Information Links */}
                <div className="space-y-4 pt-6">
                  <div>
                      <h3 className="text-xl font-black text-white tracking-tight uppercase italic">Information</h3>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Policies and Contact Links</p>
                  </div>
                  <div className="glass-panel rounded-[2rem] border-[#222222] bg-[#0A0A0A] overflow-hidden divide-y divide-[#1A1A1A]">
                    {[
                      { mode: ViewMode.PRIVACY_POLICY, icon: '📜', label: 'Privacy Policy', desc: 'View our commitment to your data' },
                      { mode: ViewMode.TERMS_OF_SERVICE, icon: '⚖️', label: 'Terms of Service', desc: 'App usage rules and guidelines' },
                      { mode: ViewMode.ABOUT_US, icon: 'ℹ️', label: 'About Us', desc: 'Learn about our mission and vision' },
                      { mode: ViewMode.CONTACT_US, icon: '💬', label: 'Contact Us', desc: 'Get help from our Myanmar team' },
                    ].map(item => (
                      <button 
                        key={item.label} 
                        onClick={() => setViewMode(item.mode)}
                        className="w-full p-6 hover:bg-[#111111] transition-all flex items-center gap-6 group text-left cursor-pointer"
                      >
                        <span className="text-2xl grayscale group-hover:grayscale-0 transition-all">{item.icon}</span>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-slate-200">{item.label}</h4>
                          <p className="text-xs text-slate-500">{item.desc}</p>
                        </div>
                        <svg className="w-5 h-5 text-slate-700 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        case ViewMode.CONVERSATION:
        case ViewMode.EDITOR:
            return <TranslationEditor 
                sourceLang="en" 
                targetLang="my" 
                tone={TranslationTone.NATURAL} 
                provider={TranslationProvider.GEMINI} 
                onRequireCredits={handleRequireCredits} 
            />;
        case ViewMode.SRT_TRANSLATOR:
            return <TranslationEditor 
                sourceLang="en" 
                targetLang="my" 
                tone={TranslationTone.NATURAL} 
                provider={TranslationProvider.GEMINI} 
                onRequireCredits={handleRequireCredits} 
            />;
        case ViewMode.GENERATOR:
            return <ScriptGenerator 
                onTransferToStudio={(text) => {
                    setViewMode(ViewMode.CONVERSATION);
                }}
                onRequireCredits={handleRequireCredits}
                onBack={() => setViewMode(ViewMode.CONVERSATION)}
            />;
        case ViewMode.STORY_TELLER:
            return <StoryTeller 
                onBack={() => setViewMode(ViewMode.HOME)}
                onRequireCredits={handleRequireCredits}
                onTransferToStudio={(text) => setViewMode(ViewMode.CONVERSATION)}
            />;
        case ViewMode.VIDEO_TRANSCRIBER:
            return <VideoTranscriber 
                onBack={() => setViewMode(ViewMode.HOME)}
            />;
        case ViewMode.AUDIO_SPLITTER:
            return <AudioSplitter 
                onBack={() => setViewMode(ViewMode.HOME)}
            />;
                case ViewMode.TIKTOK_DOWNLOADER:
            return <TikTokDownloader 
                onBack={() => setViewMode(ViewMode.HOME)}
            />;
        case ViewMode.WALLET:
            return <CreditWallet 
                user={user} 
                onRefresh={() => {}} 
                onSelectPlan={(id) => {
                    setSelectedPlanId(id);
                    setViewMode(ViewMode.PAYMENT_METHOD);
                }} 
            />;
        case ViewMode.PROFILE:
            return <UserProfileView 
                user={user} 
                onLogout={handleLogout} 
                onNavigate={setViewMode}
                onUpdateProfile={(updates) => setUser(prev => ({ ...prev, ...updates }))}
            />;
        case ViewMode.PDF_ARCHITECT:
            return <PdfArchitect 
                onExportToStudio={(text) => setViewMode(ViewMode.CONVERSATION)}
                onRequireCredits={handleRequireCredits}
            />;
        case ViewMode.ILLUSTRATOR:
            return <IllustrationHub onRequireCredits={handleRequireCredits} />;
        case ViewMode.VOICE_STUDIO:
            return <VoiceStudio onRequireCredits={handleRequireCredits} />;
        case ViewMode.RECAP_SCRIPT_WRITER:
            return <RecapScriptWriter 
                onBack={() => setViewMode(ViewMode.CONVERSATION)} 
                onTransferToStudio={() => setViewMode(ViewMode.CONVERSATION)}
                onRequireCredits={handleRequireCredits}
            />;
        case ViewMode.VIDEO_EDITOR:
            return <VideoEditor onBack={() => setViewMode(ViewMode.CONVERSATION)} />;
        case ViewMode.AUTO_RECAP:
            return <AutoRecap onBack={() => setViewMode(ViewMode.HOME)} onRequireCredits={handleRequireCredits} />;
        case ViewMode.SYSTEM_STATUS:
            return <SystemStatusView onBack={() => setViewMode(ViewMode.PROFILE)} />;
        case ViewMode.LOGIN:
            return <LoginView 
                onBack={() => setViewMode(ViewMode.HOME)} 
                onLoginSuccess={(u) => {
                    setUser(prev => ({
                        ...prev,
                        id: u.uid,
                        name: u.name || 'User',
                        email: u.email,
                        emailVerified: u.emailVerified,
                        tier: UserTier.PRO
                    }));
                    setViewMode(ViewMode.HOME);
                }}
                onNavigateToVerify={(email) => {
                    setPendingVerificationEmail(email);
                    setViewMode(ViewMode.VERIFY_EMAIL);
                }}
                onForgotPassword={() => setViewMode(ViewMode.FORGOT_PASSWORD)}
            />;
         case ViewMode.PREMIUM:
            return <PremiumPlansView 
                onBack={() => setViewMode(ViewMode.PROFILE)}
                onSelectPlan={(id) => {
                    setSelectedPlanId(id);
                    setViewMode(ViewMode.PAYMENT_METHOD);
                }}
            />;
         case ViewMode.PAYMENT_METHOD:
            return <PaymentMethodView 
                onBack={() => setViewMode(ViewMode.PREMIUM)}
                planId={selectedPlanId}
            />;
         case ViewMode.PRIVACY_POLICY:
            return <PrivacyPolicyView onBack={() => setViewMode(ViewMode.HOME)} />;
         case ViewMode.TERMS_OF_SERVICE:
            return <TermsOfServiceView onBack={() => setViewMode(ViewMode.HOME)} />;
         case ViewMode.ABOUT_US:
            return <AboutUsView onBack={() => setViewMode(ViewMode.HOME)} />;
         case ViewMode.CONTACT_US:
            return <ContactUsView onBack={() => setViewMode(ViewMode.HOME)} />;
         case ViewMode.VERIFY_EMAIL:
            return <VerificationPendingView 
                email={pendingVerificationEmail || user.email} 
                onBack={() => setViewMode(ViewMode.LOGIN)}
                onVerified={(authUserData) => {
                setUser(prev => ({
                    ...prev,
                    id: authUserData.uid,
                    name: authUserData.displayName,
                    email: authUserData.email,
                    emailVerified: true,
                    tier: UserTier.PRO
                }));
                setViewMode(ViewMode.PROFILE);
            }}
            />;
         case ViewMode.FORGOT_PASSWORD:
            return <ForgotPasswordView 
                onBack={() => setViewMode(ViewMode.LOGIN)}
                onEmailSent={() => setViewMode(ViewMode.LOGIN)}
            />;
         case ViewMode.ADMIN:
            return <AdminDashboard />;
        default:
            return <TranslationEditor sourceLang="en" targetLang="my" tone={TranslationTone.NATURAL} provider={TranslationProvider.GEMINI} 
                onRequireCredits={handleRequireCredits} />;
    }
  };

  const sidebarItems = [
    { label: 'Home', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>, action: () => setViewMode(ViewMode.HOME), active: viewMode === ViewMode.HOME },
    { label: 'Script Architect', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>, action: () => handleFeatureClick(ViewMode.CONVERSATION), active: viewMode === ViewMode.CONVERSATION },
    { label: 'Script Creator', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>, action: () => handleFeatureClick(ViewMode.GENERATOR), active: viewMode === ViewMode.GENERATOR },
    { label: 'Story Teller', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>, action: () => handleFeatureClick(ViewMode.STORY_TELLER), active: viewMode === ViewMode.STORY_TELLER },
    { label: 'Video Transcriber', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>, action: () => handleFeatureClick(ViewMode.VIDEO_TRANSCRIBER), active: viewMode === ViewMode.VIDEO_TRANSCRIBER },
    { label: 'PDF Reader', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>, action: () => handleFeatureClick(ViewMode.PDF_ARCHITECT), active: viewMode === ViewMode.PDF_ARCHITECT },
    { label: 'Thumbnail Maker', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>, action: () => handleFeatureClick(ViewMode.ILLUSTRATOR), active: viewMode === ViewMode.ILLUSTRATOR },
    { label: 'AI Voice', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>, action: () => handleFeatureClick(ViewMode.VOICE_STUDIO), active: viewMode === ViewMode.VOICE_STUDIO },
    { label: 'Recap Scriptwriter', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>, action: () => handleFeatureClick(ViewMode.RECAP_SCRIPT_WRITER), active: viewMode === ViewMode.RECAP_SCRIPT_WRITER },
    { label: 'Video Recap', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>, action: () => handleFeatureClick(ViewMode.VIDEO_EDITOR), active: viewMode === ViewMode.VIDEO_EDITOR },
    { label: 'Autorecap AI', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, action: () => handleFeatureClick(ViewMode.AUTO_RECAP), active: viewMode === ViewMode.AUTO_RECAP },
    { label: 'SRT Translator', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>, action: () => handleFeatureClick(ViewMode.SRT_TRANSLATOR), active: viewMode === ViewMode.SRT_TRANSLATOR },
    { label: 'Audio Split', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>, action: () => handleFeatureClick(ViewMode.AUDIO_SPLITTER), active: viewMode === ViewMode.AUDIO_SPLITTER },
        { label: 'TikTok Downloader', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>, action: () => handleFeatureClick(ViewMode.TIKTOK_DOWNLOADER), active: viewMode === ViewMode.TIKTOK_DOWNLOADER },
    { label: 'Wallet', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>, action: () => handleFeatureClick(ViewMode.WALLET), active: viewMode === ViewMode.WALLET },
  ];

  if (user && user.id === 'Rt0Ov1qdoEfXUwgbPiw9V6sydf03') {
    sidebarItems.push({
      label: 'Admin',
      icon: <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
      action: () => setViewMode(ViewMode.ADMIN),
      active: viewMode === ViewMode.ADMIN
    });
  }

  const isLoggedIn = user && user.id !== 'usr_guest';

  if (isAuthLoading) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black text-white gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-slate-900" />
          <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin shadow-[0_0_15px_rgba(37,99,235,0.5)]" />
        </div>
        <div className="flex flex-col items-center gap-1.5 animate-pulse mt-4">
          <h1 className="font-black text-xl tracking-tighter italic text-white">
            GeniusAi<span className="text-amber-500">Studio</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">
            Securing Connection...
          </p>
          

</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    const renderPublicView = () => {
      switch (viewMode) {
        case ViewMode.FORGOT_PASSWORD:
          return (
            <ForgotPasswordView 
              onBack={() => setViewMode(ViewMode.LOGIN)}
              onEmailSent={() => setViewMode(ViewMode.LOGIN)}
            />
          );
        case ViewMode.VERIFY_EMAIL:
          return (
            <VerificationPendingView 
              email={pendingVerificationEmail || user.email} 
              onBack={() => setViewMode(ViewMode.LOGIN)}
              onVerified={(authUserData) => {
                setUser(prev => ({
                  ...prev,
                  id: authUserData.uid,
                  name: authUserData.displayName || 'User',
                  email: authUserData.email,
                  emailVerified: true,
                  tier: UserTier.PRO
                }));
                setViewMode(ViewMode.HOME);
              }}
            />
          );
        case ViewMode.PRIVACY_POLICY:
          return <PrivacyPolicyView onBack={() => setViewMode(ViewMode.LOGIN)} />;
        case ViewMode.TERMS_OF_SERVICE:
          return <TermsOfServiceView onBack={() => setViewMode(ViewMode.LOGIN)} />;
        case ViewMode.ABOUT_US:
          return <AboutUsView onBack={() => setViewMode(ViewMode.LOGIN)} />;
        case ViewMode.CONTACT_US:
          return <ContactUsView onBack={() => setViewMode(ViewMode.LOGIN)} />;
        case ViewMode.LOGIN:
        default:
          return (
            <LoginView 
              onBack={() => setViewMode(ViewMode.HOME)} 
              onLoginSuccess={(u) => {
                setUser(prev => ({
                  ...prev,
                  id: u.uid,
                  name: u.name || 'User',
                  email: u.email,
                  emailVerified: u.emailVerified,
                  tier: UserTier.PRO
                }));
                setViewMode(ViewMode.HOME);
              }}
              onNavigateToVerify={(email) => {
                setPendingVerificationEmail(email);
                setViewMode(ViewMode.VERIFY_EMAIL);
              }}
              onForgotPassword={() => setViewMode(ViewMode.FORGOT_PASSWORD)}
            />
          );
      }
    };

    return (
      <div className="flex-1 w-full bg-black min-h-[100dvh] text-slate-200 flex items-center justify-center p-4">
        <div className="w-full max-w-[1600px] h-full flex flex-col justify-center">
          {renderPublicView()}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-[1600px] mx-auto p-4 md:p-6 flex gap-6 overflow-hidden bg-[var(--bg-color)] min-h-[100dvh] text-slate-200 pb-[80px] lg:pb-4">
        <style dangerouslySetInnerHTML={{ __html: `
            :root {
                --bg-color: ${isDarkMode ? '#000000' : '#F8FAFC'};
                --element-bg: ${isDarkMode ? '#111111' : '#F1F5F9'};
                --text-main: ${isDarkMode ? '#ffffff' : '#0F172A'};
                --text-secondary: ${isDarkMode ? '#94a3b8' : '#475569'};
                --border-color: ${isDarkMode ? '#222222' : '#E2E8F0'};
                --card-bg: ${isDarkMode ? '#0A0A0A' : '#FFFFFF'};
                --sidebar-bg: ${isDarkMode ? '#050505' : '#FFFFFF'};
            }
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
            
            /* Specific overrides when not dark mode */
            ${!isDarkMode ? `
              body {
                background-color: #F8FAFC !important;
                color: #0F172A !important;
              }
              aside, main, .bg-\\[\\#050505\\], .bg-\\[\\#000000\\], .bg-black {
                background-color: var(--sidebar-bg) !important;
                border-color: var(--border-color) !important;
              }
              .bg-\\[\\#111111\\], .bg-\\[\\#0A0A0A\\], .bg-\\[\\#161616\\] {
                background-color: #ffffff !important;
                border-color: var(--border-color) !important;
              }
              .text-white, .text-slate-200, .text-slate-300 {
                color: #0F172A !important;
              }
              .text-slate-500, .text-slate-600 {
                color: #475569 !important;
              }
              .border-\\[\\#111111\\], .border-\\[\\#222222\\], .border-transparent {
                border-color: var(--border-color) !important;
              }
              aside button:hover {
                background-color: var(--element-bg) !important;
                color: var(--text-main) !important;
              }
            ` : ''}        `}} />
        
        <aside className="w-64 bg-[var(--sidebar-bg)] border-r border-[var(--border-color)] hidden lg:flex flex-col overflow-y-auto custom-scrollbar pr-4 py-2 gap-2 shrink-0 transition-colors duration-300 rounded-3xl">
            <div className="p-4 mb-1 flex items-center gap-3">
               <div className="w-10 h-10 flex-shrink-0">
                 <img 
                   src="https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Genius" 
                   alt="GeniusAI Logo" 
                   className="w-full h-full rounded-xl shadow-lg bg-black border border-blue-900/30" 
                 />
               </div>
               <h1 className="font-black text-lg tracking-tighter italic text-[var(--text-main)]">
                 GeniusAi<span className="text-amber-500">Studio</span>
               </h1>
            </div>

            {/* Clickable Theme Switcher */}
            <div className="px-4 mb-3 select-none">
              <div className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 px-1">
                Theme
              </div>
              <div 
                id="theme-toggle-btn"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 cursor-pointer ${
                  isDarkMode 
                    ? 'bg-[#000000] border-[#222222] hover:bg-[#07070a]' 
                    : 'bg-[#f8fafc]/50 border-slate-200/80 hover:bg-[#f1f5f9]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {!isDarkMode ? (
                    <div className="w-5 h-5 flex items-center justify-center bg-amber-500/10 text-amber-500 rounded-lg">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="4" />
                        <line x1="12" y1="2" x2="12" y2="4" />
                        <line x1="12" y1="20" x2="12" y2="22" />
                        <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
                        <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
                        <line x1="2" y1="12" x2="4" y2="12" />
                        <line x1="20" y1="12" x2="22" y2="12" />
                        <line x1="6.34" y1="17.66" x2="4.93" y2="19.07" />
                        <line x1="19.07" y1="4.93" x2="17.66" y2="6.34" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-5 h-5 flex items-center justify-center bg-blue-500/10 text-blue-400 rounded-lg">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                      </svg>
                    </div>
                  )}
                  <span className={`text-[10px] font-black uppercase tracking-wider ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-700'
                  }`}>
                    {isDarkMode ? 'Dark Mode' : 'Light Mode'}
                  </span>
                </div>
                
                <div className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-300 flex items-center ${
                  isDarkMode ? 'bg-blue-600' : 'bg-slate-300'
                }`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                    isDarkMode ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 flex-1 pr-2">
                {sidebarItems.map((item, index) => (
                    <SidebarItem 
                        key={index}
                        icon={item.icon}
                        label={item.label}
                        active={item.active}
                        onClick={item.action}
                    />
                ))}
            </div>

            <div className="mt-auto pt-8 opacity-90 transition-opacity">
                {/* PRO UPGRADE BUTTON */}
                <div className="mb-4 px-2">
                    <button
                        onClick={() => setViewMode(ViewMode.PREMIUM)}
                        className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] active:scale-95 border-b-2 border-amber-700 flex items-center justify-center gap-2 group"
                    >
                        <svg className="w-3.5 h-3.5 group-hover:scale-125 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        Upgrade Pro
                    </button>

                </div>
                
                <div className="bg-[#0A0A0A] rounded-2xl border border-[#222222] overflow-hidden">
                    {user.id !== 'usr_guest' ? (
                        <div className="p-4 flex items-center gap-3">
                            <div 
                                onClick={() => setViewMode(ViewMode.PROFILE)}
                                className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white border border-blue-400/30 cursor-pointer hover:bg-blue-500 transition-colors"
                            >
                                {user.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-200 truncate">{user.name}</p>
                                <p className="text-[9px] text-slate-500 truncate">{user.email}</p>
                            </div>
                            <button onClick={handleLogout} className="text-slate-500 hover:text-red-500 transition-colors p-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            </button>
                        </div>
                    ) : (
                        <div className="p-4">
                            <button 
                                onClick={() => setViewMode(ViewMode.LOGIN)}
                                className="w-full py-3 bg-[#111111] hover:bg-[#1A1A1A] text-slate-200 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 border border-[#222222]"
                            >
                                Login Account
                            </button>
                        </div>
                    )}
                </div>
                
                

                {/* DESKTOP AD BANNER */}
                <div className="mt-4 flex justify-center items-center w-full min-h-[250px] bg-[var(--element-bg)] rounded-xl overflow-hidden border border-[var(--border-color)] shrink-0">
                    <AdsterraAd width={300} height={250} adKey="2790948312e2d03dae525901dda0519e" />
                </div>
            </div>
        </aside>




        {/* Mobile Slide-over Drawer */}
        <AnimatePresence>
          {isMobileDrawerOpen && (
            <>
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileDrawerOpen(false)}
                className="lg:hidden fixed inset-0 bg-black z-[100]"
              />
              {/* Drawer Content */}
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="lg:hidden fixed inset-y-0 left-0 w-72 bg-[var(--sidebar-bg)] border-r border-[var(--border-color)] p-6 z-[101] flex flex-col gap-4 overflow-y-auto custom-scrollbar shadow-2xl"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 flex-shrink-0">
                       <img 
                         src="https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Genius" 
                         alt="GeniusAI Logo" 
                         className="w-full h-full rounded-lg shadow-md bg-black border border-blue-900/30" 
                       />
                     </div>
                     <h1 className="font-black text-base tracking-tighter italic text-[var(--text-main)]">
                       GeniusAi<span className="text-amber-500">Studio</span>
                     </h1>
                  </div>
                  <button 
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-main)]"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Theme Switcher inside Mobile Drawer */}
                <div className="mb-2 select-none">
                  <div 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all duration-300 cursor-pointer ${
                      isDarkMode 
                        ? 'bg-[#000000] border-[#222222] hover:bg-[#07070a]' 
                        : 'bg-[#f8fafc]/50 border-slate-200/80 hover:bg-[#f1f5f9]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {!isDarkMode ? (
                        <div className="w-5 h-5 flex items-center justify-center bg-amber-500/10 text-amber-500 rounded-lg">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="4" />
                            <line x1="12" y1="2" x2="12" y2="4" />
                            <line x1="12" y1="20" x2="12" y2="22" />
                            <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
                            <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
                            <line x1="2" y1="12" x2="4" y2="12" />
                            <line x1="20" y1="12" x2="22" y2="12" />
                            <line x1="6.34" y1="17.66" x2="4.93" y2="19.07" />
                            <line x1="19.07" y1="4.93" x2="17.66" y2="6.34" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-5 h-5 flex items-center justify-center bg-blue-500/10 text-blue-400 rounded-lg">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                          </svg>
                        </div>
                      )}
                      <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-main)]">
                        {isDarkMode ? 'Dark Mode' : 'Light Mode'}
                      </span>
                    </div>
                    
                    <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-300 flex items-center ${
                      isDarkMode ? 'bg-blue-600' : 'bg-slate-300'
                    }`}>
                      <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                        isDarkMode ? 'translate-x-3.5' : 'translate-x-0'
                      }`} />
                    </div>
                  </div>
                </div>

                <div className="space-y-1 overflow-y-auto custom-scrollbar pr-1 flex-1">
                  {sidebarItems.map((item, index) => (
                    <button 
                      key={index}
                      onClick={() => {
                        item.action();
                        setIsMobileDrawerOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left ${
                        item.active 
                          ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-500/10' 
                          : 'text-[var(--text-secondary)] hover:bg-[var(--element-bg)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      <span className={item.active ? 'text-blue-500' : 'text-slate-500'}>{item.icon}</span>
                      <span className="text-[11px] uppercase font-bold tracking-wider">{item.label}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-auto pt-4 border-t border-[var(--border-color)]">
                    <button
                        onClick={() => {
                            setViewMode(ViewMode.PREMIUM);
                            setIsMobileDrawerOpen(false);
                        }}
                        className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] flex items-center justify-center gap-2"
                    >
                        Upgrade Pro
                    </button>

                    <div className="mt-3 bg-[var(--element-bg)] rounded-xl border border-[var(--border-color)] p-3 flex items-center gap-3">
                        {user.id !== 'usr_guest' ? (
                            <>
                                <div 
                                    onClick={() => {
                                        setViewMode(ViewMode.PROFILE);
                                        setIsMobileDrawerOpen(false);
                                    }}
                                    className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold text-white border border-blue-400/30 cursor-pointer"
                                >
                                    {user.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-200 truncate">{user.name}</p>
                                    <p className="text-[9px] text-slate-500 truncate">{user.email}</p>
                                </div>
                                <button 
                                  onClick={() => {
                                    handleLogout();
                                    setIsMobileDrawerOpen(false);
                                  }} 
                                  className="text-slate-500 hover:text-red-500 transition-colors p-1"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                </button>
                            </>
                        ) : (
                            <button 
                                onClick={() => {
                                    setViewMode(ViewMode.LOGIN);
                                    setIsMobileDrawerOpen(false);
                                }}
                                className="w-full py-2 bg-[var(--sidebar-bg)] hover:bg-[var(--border-color)] text-slate-200 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all border border-[var(--border-color)]"
                            >
                                Login Account
                            </button>
                        )}
                    </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#000000] relative rounded-3xl border border-[#111111] overflow-hidden transition-colors duration-300">
            {/* Top Navbar */}
            <header className="h-16 border-b border-[var(--border-color)] flex items-center justify-between px-6 shrink-0 relative z-50 bg-[var(--sidebar-bg)]/85 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    {/* Mobile Menu Hamburger and Logo Row */}
                    <div className="flex lg:hidden items-center gap-2">
                        <button 
                          onClick={() => setIsMobileDrawerOpen(true)}
                          className="w-8 h-8 rounded-lg bg-[var(--element-bg)] border border-[var(--border-color)] flex items-center justify-center cursor-pointer hover:scale-105 transition-all text-[var(--text-main)]"
                          aria-label="Open menu"
                        >
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <div 
                          onClick={() => setViewMode(ViewMode.HOME)}
                          className="w-8 h-8 rounded-lg bg-[var(--element-bg)] border border-[var(--border-color)] flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
                          title="Home"
                        >
                            <img 
                              src="https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Genius" 
                              alt="GeniusAI Logo" 
                              className="w-6 h-6 rounded-md bg-black border border-blue-900/30"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 select-none">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Workspace</span>
                        <span className="text-[10px] font-black text-[var(--text-secondary)]">/</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-main)]">{getProjectTypeName(viewMode)}</span>
                    </div>
                </div>

                {/* Right Area: Credits Display (Badge) + User Profile Dropdown */}
                <div className="flex items-center gap-4">
                    {/* Compact Credits Display Badge */}
                    <div 
                        onClick={() => setViewMode(ViewMode.WALLET)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full cursor-pointer hover:bg-amber-500/20 transition-all duration-300 group"
                        title="View credits wallet"
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider group-hover:text-amber-400 transition-colors">
                            {user.credits} Credits
                        </span>
                    </div>

                    {/* Modern Dropdown */}
                    <UserProfileDropdown 
                        user={user}
                        onLogout={handleLogout}
                        onNavigate={setViewMode}
                    />
                </div>
            </header>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                {renderMainView()}
            </div>

            {/* Bottom Navigation on Mobile Viewports */}
            <div className="lg:hidden h-16 border-t border-[var(--border-color)] bg-[var(--sidebar-bg)]/90 backdrop-blur-md flex items-center justify-around px-4 shrink-0 relative z-50">
                <button 
                  onClick={() => setViewMode(ViewMode.HOME)}
                  className={`flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
                    viewMode === ViewMode.HOME ? 'text-blue-500 font-bold' : 'text-slate-400'
                  }`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" /></svg>
                    <span className="text-[9px] uppercase font-black tracking-wider">Features</span>
                </button>

                <button 
                  onClick={() => setViewMode(ViewMode.PROFILE)}
                  className={`flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
                    viewMode === ViewMode.PROFILE ? 'text-blue-500 font-bold' : 'text-slate-400'
                  }`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    <span className="text-[9px] uppercase font-black tracking-wider">Profile</span>
                </button>

                <button 
                  onClick={() => setViewMode(ViewMode.WALLET)}
                  className={`flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
                    viewMode === ViewMode.WALLET ? 'text-blue-500 font-bold' : 'text-slate-400'
                  }`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    <span className="text-[9px] uppercase font-black tracking-wider">Wallet</span>
                </button>
            </div>
                </main>
      {/* Global Modals */}
      <CreditModal 
        isOpen={isCreditModalOpen}
        onClose={() => setIsCreditModalOpen(false)}
        onTopUp={() => { setIsCreditModalOpen(false); setViewMode(ViewMode.WALLET); }}
      />

        
        {/* MOBILE STICKY AD */}
        {isMobileAdVisible && (
            <div className="fixed bottom-0 left-0 w-full z-[100] bg-[var(--sidebar-bg)] border-t border-[var(--border-color)] flex flex-col items-center justify-center lg:hidden shadow-[0_-5px_20px_rgba(0,0,0,0.8)] pb-safe">
                <button 
                    onClick={() => setIsMobileAdVisible(false)}
                    className="absolute -top-7 right-2 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-t-lg px-3 py-1 flex items-center justify-center text-xs font-bold text-slate-400 hover:text-[var(--text-main)] shadow-lg"
                >
                    Close (X)
                </button>
                <div className="w-full flex justify-center py-1 overflow-hidden">
                    <AdsterraAd width={320} height={50} adKey="6eaca2407476410ebed3b745f10017d9" />
                </div>
            </div>
        )}
    </div>
  );
};

export default App;
