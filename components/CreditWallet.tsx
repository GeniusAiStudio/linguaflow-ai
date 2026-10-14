
import React from 'react';
import { UserProfile } from '../types';
import SmartLinkAd from './SmartLinkAd';

interface CreditWalletProps {
  user: UserProfile;
  onRefresh: () => void;
  onSelectPlan: (planId: string) => void;
}

const CreditWallet: React.FC<CreditWalletProps> = ({ user, onRefresh, onSelectPlan }) => {
  const packs = [
    { id: 'starter', name: 'Starter Pack', credits: 500, price: '5,000 MMK' },
    { id: 'creator', name: 'Creator Pro', credits: 2000, price: '15,000 MMK' },
    { id: 'studio', name: 'Studio Bundle', credits: 10000, price: '60,000 MMK' },
  ];

  const handleSelectPlan = (planId: string) => {
    console.log("Selected:", planId);
    onSelectPlan(planId);
  };

  return (
    <div className="flex-1 flex flex-col gap-10 animate-flutter-fade safe-area max-w-4xl mx-auto w-full px-4">
      {/* Balance Overview Card */}
      <div className="bg-[#0A0A0A] border border-[#222222] p-10 rounded-[2rem] shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-[80px] -mr-24 -mt-24 group-hover:bg-blue-500/10 transition-all duration-700" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10">
          <div className="space-y-2">
            <h2 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em]">Account Balance</h2>
            <div className="flex items-baseline gap-3">
              <span className="text-6xl font-black tracking-tighter text-white">{user.credits}</span>
              <span className="text-lg font-bold text-slate-500 uppercase tracking-widest">Units</span>
            </div>
          </div>
          <button 
            onClick={onRefresh}
            className="px-8 py-4 bg-[#111111] border border-[#222222] text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-[#1A1A1A] transition-all active:scale-95 shadow-lg"
          >
            Sync Ledger
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.4em] px-1">Earn Free Units</h3>
        <SmartLinkAd 
          url="https://www.profitableratecpmnetwork.com/chrbrcmv?key=cfd8b4cec862e05e73279ed9652eb11b"
          title="Earn 500 Free Credits"
          description="Click here to visit our sponsor and support the platform to receive bonus units!"
          buttonText="Claim Credits"
        />
      </div>

      <div className="space-y-6">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.4em] px-1">Acquire Production Units</h3>
        
        {/* Plan Grid - Matched to Flutter specification */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {packs.map((pack) => (
            <div 
              key={pack.id}
              onClick={() => handleSelectPlan(pack.id)}
              className="flex flex-col p-8 rounded-[12px] border border-gray-300/20 bg-[#0A0A0A] hover:bg-[#111111] transition-all cursor-pointer group active:scale-[0.98] shadow-xl text-center gap-4"
            >
              {/* Flutter: Text("Starter Pack", style: TextStyle(fontSize: 18)) */}
              <h3 className="text-[18px] font-bold text-white group-hover:text-blue-400 transition-colors">
                {pack.name}
              </h3>
              
              <div className="space-y-1">
                {/* Flutter: Text("500 Units", style: TextStyle(fontSize: 24)) */}
                <h2 className="text-[24px] font-black text-white tracking-tighter">
                  {pack.credits} Units
                </h2>
                
                {/* Flutter: Text("Buy for 5,000 MMK") */}
                <p className="text-sm font-medium text-slate-500">
                  Buy for {pack.price}
                </p>
              </div>

              {/* Matched to provided Specification for Buy Button */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectPlan(pack.id);
                }}
                className="mt-4 w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-blue-900/20 transition-all border-b-4 border-blue-800"
              >
                Buy Now
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Branding */}
      <div className="pt-12 pb-8 text-center opacity-20">
        <p className="text-[10px] font-black text-white uppercase tracking-[0.8em]">© 2026 GENIUS AI PRODUCTION LEGER</p>
      </div>
    </div>
  );
};

export default CreditWallet;
