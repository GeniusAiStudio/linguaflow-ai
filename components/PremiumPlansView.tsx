
import React from 'react';

interface PremiumPlansViewProps {
  onBack: () => void;
  onSelectPlan: (planId: string) => void;
}

interface PlanCardProps {
  id: string;
  title: string;
  price: string;
  features: string[];
  buttonText: string;
  onAction: (id: string) => void;
  highlight?: boolean;
  badge?: string;
}

const PlanCard: React.FC<PlanCardProps> = ({ id, title, price, features, buttonText, onAction, highlight = false, badge }) => {
  return (
    <div className={`glass-panel p-8 rounded-[2.5rem] border-slate-800 transition-all duration-500 relative flex flex-col gap-6 group hover:scale-[1.02] ${highlight ? 'ring-2 ring-blue-500/50 shadow-2xl shadow-blue-500/10 bg-slate-950/40' : 'bg-slate-900/20'}`}>
      {badge && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-black px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg">
          {badge}
        </div>
      )}
      
      <div className="space-y-2">
        <h3 className="text-xl font-black text-white tracking-tighter uppercase italic">{title}</h3>
        <p className="text-2xl font-black text-blue-400 tracking-tight">{price}</p>
      </div>

      <div className="flex-1 space-y-3">
        {features.map((feature, idx) => (
          feature === "" ? (
            <div key={idx} className="h-px bg-slate-800/50 my-2" />
          ) : (
            <div key={idx} className="flex items-start gap-3">
              <span className="text-blue-500 text-xs font-bold">•</span>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">{feature}</p>
            </div>
          )
        ))}
      </div>

      <button 
        onClick={() => onAction(id)}
        className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl active:scale-95 border-b-4 ${highlight ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-800' : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-900'}`}
      >
        {buttonText}
      </button>
    </div>
  );
};

const PremiumPlansView: React.FC<PremiumPlansViewProps> = ({ onBack, onSelectPlan }) => {
  const handleOpenLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex-1 flex flex-col gap-8 animate-flutter-fade bg-black h-full overflow-hidden">
      <div className="flex items-center gap-6 px-4">
        <button 
          onClick={onBack} 
          className="p-4 rounded-2xl bg-[#111111] border border-[#222222] text-white hover:bg-blue-600 hover:border-blue-500 transition-all active:scale-90"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-2xl font-black tracking-tighter uppercase italic">Premium Plans</h2>
          <p className="text-[10px] font-black text-[#444444] uppercase tracking-[0.4em]">Upgrade your AI Media Workflow</p>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-[2.5rem] p-8 md:p-12 overflow-y-auto custom-scrollbar bg-[#050505] border-[#111111]">
        <div className="max-w-5xl mx-auto space-y-12 pb-12">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <PlanCard 
              id="premium_standard_1m"
              title="Premium (1 Month)"
              price="24,000 MMK (6$)"
              buttonText="Buy Now"
              onAction={onSelectPlan}
              features={[
                "App Shared API",
                "Limited 2 times per task a day",
                "Your Own API",
                "Limited 5 times per task a day",
                "",
                "Transcribe - Video to text",
                "Translate - Text to Script",
                "SRT Translator - Translate Long SRT",
                "AI Voice - Script to AI Voice & Subtitle",
                "Sub Generator - Video & Script to Subtitle",
                "Content Creator - Professional Script",
                "AI Image Illustration",
                "",
                "200 Initial Credits included",
                "Credits deducted based on usage",
                "Sometimes your own API is required for AI Voice"
              ]}
            />

            <PlanCard 
              id="premium_plus_1m"
              title="Premium+ (1 Month)"
              price="40,000 MMK (10$)"
              highlight={true}
              badge="Best Value"
              buttonText="Buy Now"
              onAction={onSelectPlan}
              features={[
                "App Shared API",
                "Limited 10 times per task a day",
                "Your Own API",
                "Unlimited",
                "",
                "Transcribe - Video to text",
                "Translate - Text to Script",
                "SRT Translator - Translate Long SRT (5/day)",
                "AI Voice - Script to AI Voice & Subtitle (4/day)",
                "Sub Generator - Video & Script to Subtitle",
                "Content Creator - Professional Script",
                "AI Image Illustration",
                "",
                "500 Initial Credits (Best Value)",
                "Credits deducted based on usage",
                "Sometimes your own API is required for AI Voice"
              ]}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8">
            <section className="space-y-6">
              <h3 className="text-xs font-black text-blue-500 uppercase tracking-[0.3em] border-b border-[#222222] pb-4">
                OUR RECOMMENDATION
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed font-medium italic border-l-2 border-blue-500/30 pl-4">
                While using App API with credits, we highly recommend connecting your private free API key. This helps when daily limits are reached or better flexibility is needed.
              </p>
            </section>

            <section className="space-y-6">
              <h3 className="text-xs font-black text-amber-500 uppercase tracking-[0.3em] border-b border-[#222222] pb-4">
                SUBSCRIPTION RULES
              </h3>
              <ul className="space-y-3 text-slate-300 text-xs font-medium">
                <li className="flex gap-3"><span className="text-amber-500">•</span> Plans are valid for 30 days from activation</li>
                <li className="flex gap-3"><span className="text-amber-500">•</span> Credits are provided based on the selected plan</li>
                <li className="flex gap-3"><span className="text-amber-500">•</span> Monthly renewal is required</li>
                <li className="flex gap-3"><span className="text-amber-500 font-bold">•</span> SRT: 10 CR | AI Voice: 15 CR | AI Image: 25 CR | Transcribe: 25 CR</li>
              </ul>
            </section>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-10">
            <button 
              onClick={() => handleOpenLink("https://t.me/ArakanAIStudio")}
              className="px-6 py-3 rounded-xl bg-[#111111] border border-[#222222] text-blue-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all active:scale-95"
            >
              How To Use
            </button>
            <button 
              onClick={() => handleOpenLink("https://m.me/ArakanAIStudio")}
              className="px-6 py-3 rounded-xl bg-[#111111] border border-[#222222] text-blue-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all active:scale-95"
            >
              Access Blog
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PremiumPlansView;
