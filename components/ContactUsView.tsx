import React from 'react';

interface ContactUsViewProps {
  onBack: () => void;
}

const ContactUsView: React.FC<ContactUsViewProps> = ({ onBack }) => {
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
          <h2 className="text-2xl font-black tracking-tighter uppercase italic">Contact Us</h2>
          <p className="text-[10px] font-black text-[#444444] uppercase tracking-[0.4em]">Support & Feedback Hub</p>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-[2.5rem] p-8 md:p-12 overflow-y-auto custom-scrollbar bg-[#050505] border-[#111111]">
        <div className="max-w-3xl mx-auto space-y-12">
          {/* Social Channels Section */}
          <section className="space-y-6">
            <h3 className="text-xl font-black text-white uppercase italic tracking-tight border-b border-[#222222] pb-4">
              Social Channels
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Facebook Messenger ListTile */}
              <button 
                onClick={() => handleOpenLink("https://m.me/ArakanAIStudio")}
                className="bg-[#111111] p-6 rounded-[2rem] border border-[#222222] group hover:border-blue-500/50 transition-all text-left flex items-center gap-5 active:scale-[0.98] shadow-xl"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-600/10 flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-600/20 transition-all">
                  <svg className="w-7 h-7 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.455 5.503 3.734 7.222V22l3.374-1.851A12.015 12.015 0 0012 20.516c5.523 0 10-4.145 10-9.258C22 6.145 17.523 2 12 2zm1.096 12.433l-2.733-2.913-5.333 2.913 5.864-6.225 2.81 2.913 5.256-2.913-5.864 6.225z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Facebook Messenger</p>
                  <p className="text-sm font-bold text-white group-hover:text-blue-100 transition-colors">Chat with us on Messenger</p>
                </div>
              </button>

              {/* Telegram ListTile */}
              <button 
                onClick={() => handleOpenLink("https://t.me/ArakanAIStudio")}
                className="bg-[#111111] p-6 rounded-[2rem] border border-[#222222] group hover:border-sky-500/50 transition-all text-left flex items-center gap-5 active:scale-[0.98] shadow-xl"
              >
                <div className="w-14 h-14 rounded-2xl bg-sky-500/10 flex items-center justify-center border border-sky-500/20 group-hover:bg-sky-500/20 transition-all">
                  <svg className="w-7 h-7 text-sky-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.891 7.021l-2.022 9.531c-.15.675-.546.844-1.114.525l-3.081-2.272-1.486 1.432c-.164.164-.302.302-.619.302l.221-3.131 5.698-5.148c.248-.22-.054-.343-.382-.124l-7.043 4.434-3.033-.948c-.66-.206-.673-.66.138-.976l11.854-4.569c.549-.2.1.343.1.343z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest mb-1">Telegram Official</p>
                  <p className="text-sm font-bold text-white group-hover:text-sky-100 transition-colors">Message us on Telegram</p>
                </div>
              </button>
            </div>
          </section>

          {/* Traditional Support Section */}
          <section className="space-y-6">
            <h3 className="text-xl font-black text-white uppercase italic tracking-tight border-b border-[#222222] pb-4">
              Direct Inquiries
            </h3>
            <div className="text-slate-300 text-base leading-[1.8] font-medium space-y-6">
              <p>If you have any detailed questions, feedback, or enterprise support requests, please reach out via our direct production email.</p>
              <div className="bg-[#111111] p-8 rounded-[2rem] border border-[#222222] group hover:border-blue-500/50 transition-all shadow-inner">
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">Direct Support Email</p>
                <a href="mailto:support@linguaflow.mm" className="text-2xl font-black text-white hover:text-blue-400 transition-colors underline decoration-blue-500/30 underline-offset-8">support@linguaflow.mm</a>
              </div>
            </div>
          </section>

          {/* Burmese Translation Section */}
          <div className="h-px bg-[#222222] w-full" />

          <section className="space-y-6">
            <h3 className="text-xl font-black text-white uppercase italic tracking-tight border-b border-[#222222] pb-4 text-burmese">
              ဆက်သွယ်ရန်
            </h3>
            <div className="text-slate-300 text-lg leading-[2] font-medium space-y-6 text-burmese">
              <p>မေးခွန်းများ၊ အကြံပြုချက်များ သို့မဟုတ် အကူအညီလိုအပ်ပါက အထက်ပါ Messenger၊ Telegram သို့မဟုတ် အီးမေးလ်မှတစ်ဆင့် ဆက်သွယ်နိုင်ပါသည်။</p>
              <p>သင့်အမြင်များကို အမြဲ ကြိုဆိုပါသည်။ ကျွန်ုပ်တို့၏ မြန်မာအဖွဲ့သားများမှ အမြန်ဆုံး အကြောင်းပြန်ပေးပါမည်။</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ContactUsView;