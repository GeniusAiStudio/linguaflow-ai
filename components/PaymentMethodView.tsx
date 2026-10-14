
import React from 'react';

interface PaymentMethodViewProps {
  onBack: () => void;
  planId?: string;
}

const PaymentMethodView: React.FC<PaymentMethodViewProps> = ({ onBack, planId }) => {
  const handleOpenLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Logic matched to: console.log("Selected plan:", plan);
  React.useEffect(() => {
    if (planId) {
      console.log("Selected plan from route arguments:", planId);
    }
  }, [planId]);

  const getPlanDetails = (id?: string) => {
    switch (id) {
      case 'starter': return { name: 'Starter Pack', price: '5,000 MMK' };
      case 'creator': return { name: 'Creator Pro', price: '15,000 MMK' };
      case 'studio': return { name: 'Studio Bundle', price: '60,000 MMK' };
      case 'premium_standard_1m': return { name: 'Premium (1 Month)', price: '24,000 MMK' };
      case 'premium_plus_1m': return { name: 'Premium+ (1 Month)', price: '40,000 MMK' };
      default: return null;
    }
  };

  const plan = getPlanDetails(planId);

  const PaymentCard = ({ 
    title, 
    subtitle, 
    onClick 
  }: { 
    title: string; 
    subtitle: string; 
    onClick?: () => void 
  }) => (
    <div 
      onClick={onClick}
      className={`bg-[#111111] p-6 rounded-[2rem] border border-[#222222] flex items-center justify-between group transition-all shadow-xl mb-4 gap-4 ${
        onClick ? 'cursor-pointer hover:border-blue-500/50 active:scale-[0.98]' : ''
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-800/50 flex items-center justify-center border border-slate-700/30 text-slate-400 group-hover:text-blue-400 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold text-white uppercase tracking-tight">{title}</span>
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none mt-1">{subtitle}</span>
        </div>
      </div>
      
      {onClick && (
        <div className="text-slate-800 group-hover:text-blue-500 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col gap-8 animate-flutter-fade bg-black h-full overflow-hidden">
      {/* AppBar Equivalent */}
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
          <h2 className="text-2xl font-black tracking-tighter uppercase italic">Checkout Terminal</h2>
          <p className="text-[10px] font-black text-[#444444] uppercase tracking-[0.4em]">Secure Transaction Gateway</p>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-[2.5rem] p-8 md:p-12 overflow-y-auto custom-scrollbar bg-[#050505] border-[#111111]">
        <div className="max-w-3xl mx-auto flex flex-col h-full">
          
          {/* Order Summary Header */}
          {plan && (
            <div className="bg-[#111111] border border-blue-500/20 rounded-[2rem] p-8 mb-10 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[60px] -mr-16 -mt-16" />
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.4em]">Active Selection</span>
                  <h3 className="text-2xl font-black text-white italic tracking-tighter">{plan.name}</h3>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-1">Total Due</span>
                  <span className="text-3xl font-black text-white tracking-tighter">{plan.price}</span>
                </div>
              </div>
            </div>
          )}

          {/* Payment Options Area */}
          <div className="mb-10">
            <h4 className="text-[10px] font-black text-[#444444] uppercase tracking-[0.4em] mb-4 px-2">Select Channel</h4>
            <PaymentCard 
              title="Stripe" 
              subtitle="Card, Apple Pay, Google Pay" 
              onClick={() => handleOpenLink("https://buy.stripe.com")} 
            />
            <PaymentCard 
              title="K Pay" 
              subtitle="Manual payment transfer" 
            />
            <PaymentCard 
              title="Wave Pay" 
              subtitle="Manual payment transfer" 
            />
            <PaymentCard 
              title="PayPal" 
              subtitle="Global Credit/Debit" 
              onClick={() => handleOpenLink("https://www.paypal.com")} 
            />
          </div>

          <section className="bg-[#111111] p-8 rounded-[2.5rem] border border-[#222222] mb-10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-[60px] -mr-16 -mt-16" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">Activation Protocol</h3>
              </div>
              <p className="text-slate-300 text-base leading-relaxed font-medium">
                <span className="text-white font-bold block mb-2 text-lg italic">Verification Required:</span>
                Capture a screenshot of your successful transaction and transmit it to our support channels for instant ledger update.
              </p>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => handleOpenLink("https://m.me/ArakanAIStudio")}
              className="py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 border-b-4 border-blue-800 shadow-xl shadow-blue-900/20 flex items-center justify-center gap-3"
            >
              Messenger Verify
            </button>
            <button 
              onClick={() => handleOpenLink("https://t.me/ArakanAIStudio")}
              className="py-5 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 border-b-4 border-sky-800 shadow-xl shadow-sky-900/20 flex items-center justify-center gap-3"
            >
              Telegram Verify
            </button>
          </div>

          <div className="mt-auto pt-16 text-center opacity-20">
            <p className="text-[10px] font-black text-white uppercase tracking-[0.8em]">© 2026 GENIUS AI PRODUCTION SYSTEM</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodView;
