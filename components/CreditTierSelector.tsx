import React from "react";

export interface CreditTier {
  limit: number;
  credits: number;
}

export const CREDIT_TIERS: CreditTier[] = [
  { limit: 5000, credits: 4 },
  { limit: 10000, credits: 8 },
  { limit: 15000, credits: 12 },
  { limit: 20000, credits: 16 },
  { limit: 25000, credits: 20 },
  { limit: 30000, credits: 24 },
];

interface CreditTierSelectorProps {
  selectedLimit: number;
  onChange: (limit: number) => void;
}

export default function CreditTierSelector({
  selectedLimit,
  onChange,
}: CreditTierSelectorProps) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-2 mt-2">
        SELECT CREDIT TIER (CHAR-COUNT)
      </span>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {CREDIT_TIERS.map((tier, idx) => {
          const isActive = tier.limit === selectedLimit;
          return (
            <button
              key={idx}
              onClick={() => onChange(tier.limit)}
              className={`rounded-2xl p-4 flex flex-col items-center justify-center border transition-all hover:scale-[1.02] active:scale-95 ${isActive ? "bg-[#4D45E5] border-[#4D45E5] text-white shadow-md" : "bg-white border-slate-200 text-slate-700 shadow-sm hover:border-slate-300"}`}
            >
              <span
                className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isActive ? "text-white/80" : "text-slate-400"}`}
              >
                UNDER {tier.limit.toLocaleString()} CHARS
              </span>
              <span className="text-sm font-black tracking-wider">
                {tier.credits} Credits
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
