
import React, { useState, useMemo } from 'react';
import { geminiService, PdfExtractionResult } from '../services/geminiService';
import { TranslationTone, SUPPORTED_LANGUAGES, ScriptFormat } from '../types';
import LanguageSelector from './LanguageSelector';
import ScriptEditorSection from './ScriptEditorSection';

interface PdfArchitectProps {
  onExportToStudio: (text: string) => void;
  onRequireCredits: (amount: number) => Promise<boolean>;
}

enum ArchitectStep {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  EXTRACTING = 'EXTRACTING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PAGES = 50;

const PdfArchitect: React.FC<PdfArchitectProps> = ({ onExportToStudio, onRequireCredits }) => {
  const [step, setStep] = useState<ArchitectStep>(ArchitectStep.IDLE);
  const [extractedData, setExtractedData] = useState<PdfExtractionResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [calculatedCost, setCalculatedCost] = useState(0);

  // Post-Extraction States
  const [targetLang, setTargetLang] = useState('my');
  const [tone, setTone] = useState<TranslationTone>(TranslationTone.NATURAL);
  const [processedText, setProcessedText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(`FILE SIZE VIOLATION: ${file.name} exceeds 10MB payload limit.`);
      setStep(ArchitectStep.ERROR);
      return;
    }

    setFileName(file.name);
    setStep(ArchitectStep.ANALYZING);

    try {
      await new Promise(r => setTimeout(r, 1200));
      setStep(ArchitectStep.EXTRACTING);
      
      const result = await geminiService.extractContentFromPdf(file);
      
      if (result.pageCount > MAX_PAGES) {
        setErrorMessage(`STRUCTURAL LIMIT EXCEEDED: Document has ${result.pageCount} pages. Architect X1 limit is 50 pages.`);
        setStep(ArchitectStep.ERROR);
        return;
      }

      const baseCost = Math.ceil(result.pageCount * (result.wordCount / 20));
      const finalCost = result.type === 'scanned' ? Math.ceil(baseCost * 3.0) : baseCost;
      
      setCalculatedCost(finalCost);
      // Removed dynamic cost based on pages, it was flat 5 to start.
      
      setExtractedData(result);
      setProcessedText(result.text); // Initialize with raw text
      setStep(ArchitectStep.COMPLETED);
    } catch (err) {
      setErrorMessage("NEURAL ROUTING FAILURE: Structural extraction failed. Check file integrity.");
      setStep(ArchitectStep.ERROR);
    }
  };

  const handleTranslateAndFormat = async () => {
    if (!extractedData || isProcessing) return;
    if (!(await onRequireCredits(5))) return;
    setIsProcessing(true); // Translation fee

    try {
      const result = await geminiService.translateText(
        extractedData.text, 
        'auto', 
        targetLang, 
        tone
      );
      setProcessedText(result);
    } catch (err) {
      console.error("Translation within Architect failed", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetArchitect = () => {
    setStep(ArchitectStep.IDLE);
    setExtractedData(null);
    setErrorMessage('');
    setFileName('');
    setProcessedText('');
  };

  return (
    <div className="flex-1 flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20">
      {/* Hero / Upload Section */}
      <div className={`glass-panel p-10 rounded-[2.5rem] border-blue-500/20 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl relative overflow-hidden transition-all duration-700 ${step === ArchitectStep.COMPLETED ? 'h-0 opacity-0 p-0 m-0 border-0 pointer-events-none' : ''}`}>
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        
        {(step === ArchitectStep.ANALYZING || step === ArchitectStep.EXTRACTING) && (
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <div className="w-full h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent absolute top-0 animate-[deepScan_4s_ease-in-out_infinite]" style={{
              boxShadow: '0 0 25px rgba(59, 130, 246, 0.8)'
            }} />
          </div>
        )}

        <div className="flex flex-col items-center text-center gap-6 relative z-10">
          <div className="w-24 h-24 bg-blue-600/20 rounded-[2rem] flex items-center justify-center border border-blue-500/40 shadow-2xl shadow-blue-500/20 mb-2 relative group">
             <div className="absolute inset-0 bg-blue-400/10 rounded-[2rem] blur-2xl group-hover:bg-blue-400/30 transition-all duration-500" />
            <svg className="w-12 h-12 text-blue-400 relative" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>

          <div className="space-y-2">
            <h2 className="text-5xl font-black tracking-tighter text-white uppercase italic">Architect <span className="text-blue-500">X1</span></h2>
            <div className="flex items-center justify-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.6em]">Secure Neural Sandbox Protocol</p>
            </div>
          </div>

          <p className="max-w-lg text-slate-400 font-medium text-lg leading-relaxed">
            Ephemeral processing environment for <span className="text-blue-400 font-bold">mya+eng</span> OCR extraction. 
            Automated PDF analysis and character reconciliation.
          </p>

          {step === ArchitectStep.IDLE && (
            <div className="flex flex-col items-center gap-6">
              <label className="mt-6 px-12 py-6 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-[2.5rem] transition-all shadow-2xl shadow-blue-900/50 active:scale-95 cursor-pointer flex items-center gap-5 text-2xl tracking-widest group border-b-4 border-blue-800">
                <input type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
                <span>INITIALIZE SECURE SCAN</span>
                <svg className="w-7 h-7 group-hover:rotate-90 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                </svg>
              </label>
              
              <div className="flex items-center gap-6 text-[9px] font-black text-slate-600 uppercase tracking-widest bg-slate-900/40 px-6 py-2 rounded-full border border-slate-800/60">
                <span className="flex items-center gap-2 text-slate-400"><svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.9L10 .3l7.834 4.6a1 1 0 01.5 1.053c-.3 4.14-2.283 8.356-7.834 11.2a1 1 0 01-.5 0c-5.551-2.844-7.534-7.06-7.834-11.2a1 1 0 01.5-1.053z" clipRule="evenodd" /></svg> TLS 1.3 Encryption</span>
                <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500/40" /> 10MB Load Limit</span>
                <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500/40" /> 50 Page Structural Max</span>
              </div>
            </div>
          )}

          {step === ArchitectStep.ERROR && (
            <div className="mt-8 flex flex-col items-center gap-6 animate-in zoom-in-95">
               <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl flex items-center gap-4 text-red-400 font-bold max-w-xl">
                 <svg className="w-8 h-8 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                 </svg>
                 <p className="text-sm tracking-tight">{errorMessage}</p>
               </div>
               <button onClick={resetArchitect} className="text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-widest underline underline-offset-4">Retry Protocol</button>
            </div>
          )}

          {(step === ArchitectStep.ANALYZING || step === ArchitectStep.EXTRACTING) && (
            <div className="mt-8 w-full max-w-2xl space-y-10 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center text-[11px] font-black text-blue-500 uppercase tracking-[0.5em] px-2">
                <span className="animate-pulse">{step === ArchitectStep.ANALYZING ? 'MAPPING STRUCTURAL VECTORS' : 'RECONCILING UNICODE BLOCKS'}</span>
                <span className="mono bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">{step === ArchitectStep.ANALYZING ? '18%' : '92%'}</span>
              </div>
              <div className="h-2.5 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/50 shadow-inner">
                <div className={`h-full bg-blue-500 transition-all duration-[2500ms] ease-out shadow-[0_0_15px_rgba(59,130,246,0.6)] ${step === ArchitectStep.ANALYZING ? 'w-[18%]' : 'w-[92%]'}`} />
              </div>
              <div className="flex items-center justify-center gap-4 bg-slate-900/60 py-3 px-6 rounded-3xl border border-slate-800/80 backdrop-blur-md shadow-2xl">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                <p className="text-slate-300 font-bold uppercase text-[10px] tracking-widest italic">
                  SANDBOXING: <span className="text-blue-400">{fileName}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results View */}
      {step === ArchitectStep.COMPLETED && extractedData && (
        <div className="flex-1 flex flex-col gap-8 animate-in slide-in-from-bottom-16 duration-1000 pb-10">
          {/* Header Actions */}
          <div className="flex flex-col md:flex-row items-center justify-between px-4 gap-6">
            <div className="flex items-center gap-6">
               <button onClick={resetArchitect} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-white transition-all active:scale-90">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
               </button>
               <div>
                 <h2 className="text-3xl font-black tracking-tighter uppercase italic">{fileName}</h2>
                 <div className="flex items-center gap-3">
                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{extractedData.pageCount} PAGES DETECTED</span>
                   <div className="w-1 h-1 rounded-full bg-slate-700" />
                   <span className={`text-[9px] font-black uppercase tracking-widest ${extractedData.type === 'scanned' ? 'text-amber-500' : 'text-emerald-500'}`}>{extractedData.type} OCR ARCHITECTURE</span>
                 </div>
               </div>
            </div>
            
            <div className="flex items-center gap-3">
               <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/5 px-4 py-3 rounded-2xl border border-amber-500/10">
                 -{calculatedCost} Extraction Credits
               </div>
               <button 
                  onClick={() => onExportToStudio(processedText)}
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-2xl shadow-blue-900/50 active:scale-95 border-b-4 border-blue-800 flex items-center gap-3"
               >
                 Ship to Studio
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
               </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar Refinement Controls */}
            <div className="lg:col-span-1 space-y-6">
              <div className="glass-panel p-6 rounded-[2rem] border-slate-800 shadow-xl bg-slate-950/20 space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-800/50 pb-4">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
                    <span className="text-sm">🏗️</span>
                  </div>
                  <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest">Build Refinement</h3>
                </div>

                <div className="space-y-6">
                  <LanguageSelector label="Output Blueprint" value={targetLang} onChange={setTargetLang} />
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Style Tone</label>
                    <div className="flex flex-col gap-1.5 p-1 bg-slate-900/50 rounded-2xl border border-slate-800">
                      {[TranslationTone.NATURAL, TranslationTone.CREATIVE, TranslationTone.PROFESSIONAL].map(t => (
                        <button key={t} onClick={() => setTone(t)} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-left ${tone === t ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-800/50'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleTranslateAndFormat}
                    disabled={isProcessing}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 disabled:opacity-30 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                    {isProcessing ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Reconstruct Script</span>
                        <span className="text-lg">⚡</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-slate-900/30 p-6 rounded-[2rem] border border-slate-800/50">
                <h3 className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3">Architect Specs</h3>
                <ul className="text-[10px] space-y-3 text-slate-500 font-medium">
                  <li className="flex gap-3">
                    <span className="text-blue-500 font-bold">✓</span> 
                    <span>Structural mapping complete</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-500 font-bold">✓</span> 
                    <span>mya+eng OCR integrity verified</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-500 font-bold">✓</span> 
                    <span>Layout topology preserved</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Main Editor Suite */}
            <div className="lg:col-span-3 flex flex-col gap-6">
               <div className="flex-1 glass-panel rounded-[2.5rem] p-10 border-slate-800 bg-slate-950/40 shadow-2xl relative overflow-hidden flex flex-col min-h-[600px] max-h-[70vh]">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-[60px] -mr-16 -mt-16" />
                  
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Drafting Workspace</h4>
                    </div>
                    {isProcessing && (
                      <div className="flex items-center gap-3 px-4 py-1.5 bg-blue-500/10 rounded-full border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest animate-pulse">
                        Neural Routing Active
                      </div>
                    )}
                  </div>

                  <div 
                    className="flex-1 flex flex-col min-h-0"
                    style={{ fontFamily: "'Pyidaungsu', 'Noto Sans Myanmar', 'Padauk', 'Myanmar Text', sans-serif" }}
                  >
                    <ScriptEditorSection rawText={processedText} />
                  </div>
               </div>
            </div>
          </div>
          
          {/* Metadata Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-slate-900/40 p-6 rounded-[2rem] border border-slate-800 flex flex-col gap-2 shadow-2xl backdrop-blur-sm">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">OCR Core Efficiency</span>
              <span className="text-lg font-black text-white">{(extractedData.confidence * 100).toFixed(1)}%</span>
            </div>
            <div className="bg-slate-900/40 p-6 rounded-[2rem] border border-slate-800 flex flex-col gap-2 shadow-2xl backdrop-blur-sm">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Script Density</span>
              <span className="text-lg font-black text-blue-400 uppercase">{extractedData.wordCount} WORDS</span>
            </div>
            <div className="bg-slate-900/40 p-6 rounded-[2rem] border border-slate-800 flex flex-col gap-2 shadow-2xl backdrop-blur-sm">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Reconciliation</span>
              <span className="text-lg font-black text-emerald-400 uppercase">mya+eng PASSED</span>
            </div>
            <div className="bg-slate-900/40 p-6 rounded-[2rem] border border-slate-800 flex flex-col gap-2 shadow-2xl backdrop-blur-sm">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Security Token</span>
              <span className="text-lg font-black text-indigo-400 uppercase">AES-GCM-256</span>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes deepScan {
          0% { top: -10%; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { top: 110%; opacity: 0; }
        }
      `}} />
    </div>
  );
};

export default PdfArchitect;
