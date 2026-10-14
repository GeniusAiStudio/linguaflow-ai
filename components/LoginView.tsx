import React, { useState } from 'react';
import { motion } from 'motion/react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface LoginViewProps {
  onBack: () => void;
  onLoginSuccess?: (userData: { email: string; uid: string; name: string; emailVerified: boolean }) => void;
  onNavigateToVerify: (email: string) => void;
  onForgotPassword?: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onBack, onLoginSuccess }) => {
  const [membershipId, setMembershipId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    if (!membershipId.trim()) {
      setError('Please enter a Membership ID');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const membershipRef = doc(db, 'memberships', membershipId.trim());
      const membershipSnap = await getDoc(membershipRef);
      
      if (membershipSnap.exists()) {
        const data = membershipSnap.data();
        if (data.isActive) {
          // Device Binding Logic
          let localDeviceId = localStorage.getItem('genius_device_id');
          if (!localDeviceId) {
            localDeviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
            localStorage.setItem('genius_device_id', localDeviceId);
          }

          if (data.deviceId && data.deviceId !== localDeviceId) {
            setError('This Pass Key is already bound to another device.');
            setIsLoading(false);
            return;
          }

          if (!data.deviceId) {
            await setDoc(membershipRef, { deviceId: localDeviceId }, { merge: true });
          }

          localStorage.setItem('isVipMember', 'true');
          localStorage.setItem('vip_membership_id', membershipId.trim());
          sessionStorage.setItem('isGuestSession', 'false');
          
          if (onLoginSuccess) {
            onLoginSuccess({
              uid: membershipId.trim(),
              email: `${membershipId.trim()}@vip.user`,
              name: 'VIP Member',
              emailVerified: true
            });
          }
        } else {
          setError('This Membership ID is inactive or expired.');
        }
      } else {
        setError('Invalid Membership ID.');
      }
    } catch (err: any) {
      console.error('Error verifying membership:', err);
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuest = () => {
    sessionStorage.setItem('isGuestSession', 'true');
    localStorage.removeItem('isVipMember');
    // Call onBack to bypass login and route to the main dashboard
    onBack();
  };

  return (
    <div className="w-full h-full flex flex-col justify-center items-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md bg-[#0A0A0A] border border-[#222222] rounded-3xl p-8 shadow-2xl overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-[60px] pointer-events-none -mr-24 -mt-24" />
        
        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-900 to-black border border-blue-500/30 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-widest text-center">Security Access</h2>
          <p className="text-slate-400 text-sm font-medium mt-2 text-center">
            Enter your VIP Membership ID to unlock unlimited access to all features.
          </p>
        </div>

        <div className="space-y-4 relative z-10">
          <div>
            <input
              type="text"
              value={membershipId}
              onChange={(e) => setMembershipId(e.target.value)}
              placeholder="Enter Membership ID..."
              className="w-full px-5 py-4 bg-[#111111] border border-[#333333] rounded-xl text-white placeholder-slate-600 font-bold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
            {error && (
              <p className="text-red-500 text-xs font-bold mt-2 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
              </p>
            )}
          </div>

          <button 
            onClick={handleVerify}
            disabled={isLoading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black rounded-xl uppercase tracking-widest text-[11px] transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] border-b-4 border-blue-800 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Access App"
            )}
          </button>

          <div className="relative py-4 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#333333]"></div></div>
            <div className="relative bg-[#0A0A0A] px-4 text-xs font-black text-slate-500 uppercase tracking-widest">OR</div>
          </div>

          <button 
            onClick={handleGuest}
            className="w-full py-4 bg-transparent border border-[#333333] hover:bg-[#111111] text-slate-300 font-bold rounded-xl uppercase tracking-widest text-[10px] transition-all"
          >
            Close & Continue as Guest
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginView;
