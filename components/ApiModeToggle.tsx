import React from "react";

export type ApiMode = "app" | "own";

interface ApiModeToggleProps {
  mode: ApiMode;
  onChange: (mode: ApiMode) => void;
}

export default function ApiModeToggle({ mode, onChange }: ApiModeToggleProps) {
  return (
    <div className="flex bg-white rounded-full p-1 border border-slate-200 shadow-sm mb-2">
      <button
        onClick={() => onChange("app")}
        className={`flex-1 rounded-full py-3 text-xs font-black uppercase tracking-widest transition-all ${mode === "app" ? "bg-[#4D45E5] text-white shadow-md" : "text-slate-500 hover:text-slate-700 bg-transparent"}`}
      >
        APP API
      </button>
      <button
        onClick={() => onChange("own")}
        className={`flex-1 rounded-full py-3 text-xs font-black uppercase tracking-widest transition-all ${mode === "own" ? "bg-[#4D45E5] text-white shadow-md" : "text-slate-500 hover:text-slate-700 bg-transparent"}`}
      >
        OWN API
      </button>
    </div>
  );
}
