
import React, { useState } from 'react';
import { authService } from '../services/authService';

interface ForgotPasswordViewProps {
  onBack: () => void;
  onEmailSent: (email: string) => void;
}

const ForgotPasswordView: React.FC<ForgotPasswordViewProps> = ({ onBack, onEmailSent }) => {
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsSending(true);
    await authService.sendPasswordResetEmail(email);
    setIsSending(false);
    setSent(true);
    // Note: We keep the user on this screen to see the success message instead of immediately navigating away
  };

  return (
    <div className="flex-1 flex flex-col gap-8 animate-flutter-fade bg-black h-full overflow-hidden">
      <div className="flex items-center gap-6 px-4">
        <button 
          onClick={onBack} 
          className="p-4 rounded-2xl bg-[#111111] border border-[#222222] text-white hover:bg-blue-600 hover:border-blue-500 transition-all active:scale-90 shadow-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 text-center pr-16 md:pr-24">
          <h2 className="text-xl font-black tracking-tighter uppercase italic">Recover Access</h2>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-[2.5rem] p-8 md:p-12 overflow-y-auto custom-scrollbar bg-[#050505] border-[#111111] flex flex-col items-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl mb-8 border border-indigo-500/20">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>

        <h3 className="text-3xl font-black tracking-tighter text-white mb-2">Reset Password</h3>
        
        {!sent ? (
          <>
            <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-10 text-center max-w-xs">
              Enter your email to receive a password change link
            </p>

            <form onSubmit={handleReset} className="w-full max-w-md space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Terminal Email</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-[#333333] group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input 
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter registered email"
                    className="w-full bg-[#0A0A0A] border border-[#222222] text-white rounded-2xl pl-14 pr-6 py-5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold text-sm placeholder:text-[#222222]"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isSending || !email}
                className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/30 text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] transition-all shadow-2xl active:scale-95 border-b-4 border-blue-800 flex items-center justify-center gap-3"
              >
                {isSending ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : "Get Reset Link"}
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center animate-in zoom-in-95">
             <p className="text-slate-300 font-medium text-center mb-8 leading-relaxed">
               We sent you a password change link to<br/><span className="text-blue-400 font-bold">{email}</span>.
             </p>
             <button 
                onClick={onBack}
                className="px-10 py-4 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95"
             >
                Sign In
             </button>
          </div>
        )}

        <div className="mt-16 text-[9px] font-black text-[#111111] uppercase tracking-[0.8em]">
          GENIUS AI SECURITY TERMINAL
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordView;
