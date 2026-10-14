import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface CreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTopUp: () => void;
}

export const CreditModal: React.FC<CreditModalProps> = ({ isOpen, onClose, onTopUp }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-[#0A0A0A] border border-[#222222] rounded-3xl p-8 shadow-2xl overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-[50px] pointer-events-none -mr-16 -mt-16" />
            
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
              <span className="text-2xl">💎</span>
            </div>

            <h2 className="text-xl font-black text-white mb-2 uppercase tracking-wide">
              Not enough credits
            </h2>
            <p className="text-slate-400 text-sm font-medium mb-8">
              You do not have enough credits to generate this content. Please top up your account or enter your VIP Membership ID to continue.
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  onTopUp();
                  onClose();
                }}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-amber-950 font-black rounded-xl uppercase tracking-widest text-[10px] transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)]"
              >
                Top Up Credits
              </button>
              <button 
                onClick={onClose}
                className="w-full py-3.5 bg-transparent border border-[#333] hover:bg-[#111] text-white font-bold rounded-xl uppercase tracking-widest text-[10px] transition-all"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
