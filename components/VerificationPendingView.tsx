
import React, { useState } from 'react';
import { authService, AuthUser } from '../services/authService';

interface VerificationPendingViewProps {
  email: string;
  onBack: () => void;
  onVerified: (verifiedUser: AuthUser) => void;
}

const VerificationPendingView: React.FC<VerificationPendingViewProps> = ({ email, onBack, onVerified }) => {
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleResend = async () => {
    setIsResending(true);
    await authService.sendEmailVerification(email);
    setIsResending(false);
  };

  const handleSimulateLinkClick = async () => {
    setIsVerifying(true);
    // Simulate the user clicking the link in their email client which updates the backend state
    const verifiedUser = await authService.simulateVerifyUser(email);
    setIsVerifying(false);
    
    if (verifiedUser) {
      alert("Verification Successful! Logging in automatically...");
      onVerified(verifiedUser);
    } else {
      alert("Email Verification simulated, please try signing in.");
      onBack();
    }
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
          <h2 className="text-xl font-black tracking-tighter uppercase italic">Verify Identity</h2>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-[2.5rem] p-8 md:p-12 overflow-y-auto custom-scrollbar bg-[#050505] border-[#111111] flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-amber-500/10 rounded-[2.5rem] flex items-center justify-center border border-amber-500/20 mb-8 animate-bounce duration-[3000ms]">
          <svg className="w-12 h-12 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        <h3 className="text-3xl font-black tracking-tighter text-white mb-4">Check your Email</h3>
        <p className="text-slate-400 font-medium text-base max-w-sm mb-10 leading-relaxed">
          We have sent you a verification email to <br/>
          <span className="text-blue-400 font-bold text-lg">{email}</span>.
          <br/><br/>
          Verify it and log in.
        </p>

        <div className="w-full max-w-xs space-y-4">
          <button 
            onClick={onBack}
            className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 border-b-4 border-blue-800 flex items-center justify-center gap-2"
          >
             Go to Login
          </button>
          
          <div className="flex items-center gap-2 pt-4">
             <button 
                onClick={handleResend}
                disabled={isResending}
                className="flex-1 py-3 bg-transparent text-slate-500 hover:text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all border border-[#222222] hover:border-[#444]"
             >
                {isResending ? "Dispatching..." : "Resend Link"}
             </button>
             <button 
                onClick={handleSimulateLinkClick}
                disabled={isVerifying}
                className="flex-1 py-3 bg-transparent text-slate-500 hover:text-green-400 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all border border-[#222222] hover:border-green-500/30"
             >
                {isVerifying ? "Verifying..." : "(Simulate) Click Link"}
             </button>
          </div>
        </div>

        <div className="mt-16 text-[9px] font-black text-[#222222] uppercase tracking-[0.5em]">
          GENIUS AI SECURITY PROTOCOL
        </div>
      </div>
    </div>
  );
};

export default VerificationPendingView;
