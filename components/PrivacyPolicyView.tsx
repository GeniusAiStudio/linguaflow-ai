
import React from 'react';

interface PrivacyPolicyViewProps {
  onBack: () => void;
}

const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({ onBack }) => {
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
          <h2 className="text-2xl font-black tracking-tighter uppercase italic">Privacy Policy</h2>
          <p className="text-[10px] font-black text-[#444444] uppercase tracking-[0.4em]">Legal & Compliance Hub</p>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-[2.5rem] p-8 md:p-12 overflow-y-auto custom-scrollbar bg-[#050505] border-[#111111]">
        <div className="max-w-3xl mx-auto space-y-10">
          <section className="space-y-6">
            <h3 className="text-xl font-black text-white uppercase italic tracking-tight border-b border-[#222222] pb-4">
              Privacy Policy (English)
            </h3>
            <div className="text-slate-300 text-base leading-[1.8] font-medium space-y-6">
              <p>We respect your privacy and are committed to protecting your data.</p>
              <p>Audio, video, and text you submit are processed only to provide app features such as transcription, translation, script generation, and text-to-speech.</p>
              <p>We do not sell, rent, or share your personal data with third parties for marketing purposes.</p>
              <p>Uploaded content may be temporarily stored to complete processing and is automatically deleted after processing.</p>
              <p>We use industry-standard security measures to protect your information.</p>
              <p>By using this app, you agree to this Privacy Policy.</p>
            </div>
          </section>

          <div className="h-px bg-[#222222] w-full" />

          <section className="space-y-6">
            <h3 className="text-xl font-black text-white uppercase italic tracking-tight border-b border-[#222222] pb-4 text-burmese">
              ကိုယ်ရေးကိုယ်တာ မူဝါဒ (Burmese)
            </h3>
            <div className="text-slate-300 text-lg leading-[2] font-medium space-y-6 text-burmese">
              <p>သင်၏ ကိုယ်ရေးကိုယ်တာ အချက်အလက်များကို လေးစားကာ ကာကွယ်ပေးရန် ကျွန်ုပ်တို့ ကတိပြုပါသည်။</p>
              <p>သင် တင်သွင်းသော အသံ၊ ဗီဒီယို နှင့် စာသားများကို transcription၊ translation၊ script generation နှင့် text-to-speech အင်္ဂါရပ်များ ပေးနိုင်ရန်သာ အသုံးပြုပါသည်။</p>
              <p>သင်၏ ကိုယ်ရေးကိုယ်တာ အချက်အလက်များကို ကြော်ငြာရည်ရွယ်ချက်အတွက် တတိယပုဂ္ဂိုလ်များထံ မရောင်းချ၊ မမျှဝေပါ။</p>
              <p>လုပ်ငန်းစဉ်ပြီးစီးရန်အတွက် ဒေတာများကို ယာယီသိမ်းဆည်းထားနိုင်ပြီး လုပ်ငန်းစဉ်ပြီးဆုံးသည်နှင့် အလိုအလျောက် ဖျက်သိမ်းပါမည်။</p>
              <p>သင်၏ အချက်အလက်များကို ကာကွယ်ရန် စံချိန်မီ လုံခြုံရေး နည်းလမ်းများကို အသုံးပြုပါသည်။</p>
              <p>ဤအက်ပ်ကို အသုံးပြုခြင်းဖြင့် ဤကိုယ်ရေးကိုယ်တာ မူဝါဒကို သဘောတူညီပါသည်။</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyView;
