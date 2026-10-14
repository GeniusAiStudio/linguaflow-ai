
import React from 'react';

interface TermsOfServiceViewProps {
  onBack: () => void;
}

const TermsOfServiceView: React.FC<TermsOfServiceViewProps> = ({ onBack }) => {
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
          <h2 className="text-2xl font-black tracking-tighter uppercase italic">Terms of Service</h2>
          <p className="text-[10px] font-black text-[#444444] uppercase tracking-[0.4em]">Legal & Compliance Hub</p>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-[2.5rem] p-8 md:p-12 overflow-y-auto custom-scrollbar bg-[#050505] border-[#111111]">
        <div className="max-w-3xl mx-auto space-y-10">
          <section className="space-y-6">
            <h3 className="text-xl font-black text-white uppercase italic tracking-tight border-b border-[#222222] pb-4">
              Terms of Service (English)
            </h3>
            <div className="text-slate-300 text-base leading-[1.8] font-medium space-y-6">
              <p>By using this app, you agree to comply with these terms.</p>
              <p>This app provides AI-powered features including transcription, translation, script writing, and text-to-speech.</p>
              <p>You are responsible for the content you upload or generate using the app.</p>
              <p>You agree not to use the app for unlawful, harmful, or abusive purposes.</p>
              <p>We do not guarantee that the service will be error-free or uninterrupted.</p>
              <p>We may update these terms from time to time without prior notice.</p>
            </div>
          </section>

          <div className="h-px bg-[#222222] w-full" />

          <section className="space-y-6">
            <h3 className="text-xl font-black text-white uppercase italic tracking-tight border-b border-[#222222] pb-4 text-burmese">
              အသုံးပြုမှု စည်းမျဉ်းများ (Burmese)
            </h3>
            <div className="text-slate-300 text-lg leading-[2] font-medium space-y-6 text-burmese">
              <p>ဤအက်ပ်ကို အသုံးပြုခြင်းဖြင့် ဤစည်းမျဉ်းများကို သဘောတူညီသည်ဟု ဆိုလိုပါသည်။</p>
              <p>ဤအက်ပ်တွင် AI အခြေပြု transcription၊ translation၊ script writing နှင့် text-to-speech အင်္ဂါရပ်များ ပါဝင်ပါသည်။</p>
              <p>သင် တင်သွင်း သို့မဟုတ် ဖန်တီးသော အကြောင်းအရာများအတွက် သင်ကိုယ်တိုင် တာဝန်ယူရပါမည်။</p>
              <p>ဥပဒေမဲ့၊ အန္တရာယ်ဖြစ်စေသော သို့မဟုတ် အလွဲသုံးစားလုပ်သော ရည်ရွယ်ချက်များအတွက် ဤအက်ပ်ကို မအသုံးပြုရပါ။</p>
              <p>ဝန်ဆောင်မှုသည် အမှားမရှိကြောင်း သို့မဟုတ် အဆက်မပြတ် အလုပ်လုပ်မည်ဟု အာမခံမပေးပါ။</p>
              <p>လိုအပ်ပါက ဤစည်းမျဉ်းများကို ကြိုတင်အကြောင်းကြားခြင်းမရှိဘဲ ပြင်ဆင်နိုင်ပါသည်။</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServiceView;
