import React from 'react';

interface AboutUsViewProps {
  onBack: () => void;
}

const AboutUsView: React.FC<AboutUsViewProps> = ({ onBack }) => {
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
          <h2 className="text-2xl font-black tracking-tighter uppercase italic">About Us</h2>
          <p className="text-[10px] font-black text-[#444444] uppercase tracking-[0.4em]">Creator Mission Hub</p>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-[2.5rem] p-8 md:p-12 overflow-y-auto custom-scrollbar bg-[#050505] border-[#111111]">
        <div className="max-w-3xl mx-auto space-y-10">
          <section className="space-y-6">
            <h3 className="text-xl font-black text-white uppercase italic tracking-tight border-b border-[#222222] pb-4">
              About Us (English)
            </h3>
            <div className="text-slate-300 text-base leading-[1.8] font-medium space-y-6">
              <p>This app is built to help writers, creators, and storytellers work faster and smarter.</p>
              <p>We focus on AI-powered tools for transcription, translation, script writing, subtitles, and voice generation.</p>
              <p>Our goal is to make creative work easier, more accessible, and more professional.</p>
            </div>
          </section>

          <div className="h-px bg-[#222222] w-full" />

          <section className="space-y-6">
            <h3 className="text-xl font-black text-white uppercase italic tracking-tight border-b border-[#222222] pb-4 text-burmese">
              ကျွန်ုပ်တို့အကြောင်း (Burmese)
            </h3>
            <div className="text-slate-300 text-lg leading-[2] font-medium space-y-6 text-burmese">
              <p>ဤအက်ပ်ကို စာရေးသူများ၊ ဖန်တီးသူများနှင့် ဇာတ်လမ်းပြောသူများအတွက် အလုပ်လုပ်ရလွယ်ကူစေရန် ဖန်တီးထားပါသည်။</p>
              <p>transcription၊ translation၊ script writing၊ subtitle နှင့် အသံထုတ်လုပ်မှုအတွက် AI အခြေပြု ကိရိယာများကို အဓိကထားပါသည်။</p>
              <p>ဖန်တီးမှုလုပ်ငန်းများကို ပိုမိုလွယ်ကူ၊ ပိုမိုရရှိလွယ်ကူပြီး ပရော်ဖက်ရှင်နယ် ဖြစ်စေရန် ရည်ရွယ်ပါသည်။</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AboutUsView;