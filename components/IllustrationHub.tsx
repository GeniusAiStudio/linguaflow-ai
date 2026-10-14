import React, { useState, useRef, useEffect } from "react";
import { geminiService } from "../services/geminiService";

interface IllustrationHubProps {
  onRequireCredits: (amount: number) => Promise<boolean>;
}

const IllustrationHub: React.FC<IllustrationHubProps> = ({
  onRequireCredits,
}) => {
  const [artStyle, setArtStyle] = useState<"REALISTIC" | "ILLUSTRATION">(
    "REALISTIC",
  );
  const [prompt, setPrompt] = useState("");
  const [headline, setHeadline] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");

  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);

  const [logoImage, setLogoImage] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);

  const refInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Helper to convert File to raw Base64 (no header) for API
  const fileToRawBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the data:image/xyz;base64, prefix
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleReferenceSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReferenceImage(file);
      setReferencePreview(URL.createObjectURL(file));
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoImage(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    if (!(await onRequireCredits(5))) return;
    setIsGenerating(true);
    try {
      // Handle Reference Image
      let referenceBase64: string | undefined = undefined;
      if (referenceImage) {
        referenceBase64 = await fileToRawBase64(referenceImage);
      }

      // First, translate/enhance the user's prompt (which may be in Burmese) into a solid English visual description
      // using the requested Gemini pro/flash-lite logic.
      const englishVisualDescription =
        await geminiService.enhanceImagePrompt(prompt);

      // PROMPT ENGINEERING:
      // We strictly instruct Gemini NOT to render text.
      // We will handle the Myanmar text overlay on the client side for perfect font rendering.
      const enhancedPrompt = `
You are a professional thumbnail background artist.

GOAL:
Generate a high-quality, eye-catching thumbnail background image based on the following description.

DESIGN RULES:
- Style: ${artStyle === "REALISTIC" ? "Photorealistic, true-to-life photography" : "Cinematic digital art, illustration"}
- Subject: ${englishVisualDescription}
- Composition: Create a clean composition with space at the top or center where text can be overlaid later.
- Colors: Vibrant, high contrast, YouTube-optimized.
- IMPORTANT: DO NOT GENERATE ANY TEXT, LETTERS, OR CHARACTERS IN THE IMAGE. The image should be entirely text-free.

IMAGE QUALITY:
- High resolution
- Sharp edges
- Professional lighting
      `.trim();

      const imageUrl = await geminiService.generateIllustration(
        enhancedPrompt,
        aspectRatio,
        referenceBase64,
      );
      setResultImage(imageUrl);
      
    } catch (err: any) {
      console.error("Frontend Error generating thumbnail:", err);
      alert(`Thumbnail generation failed: ${err.message || err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadComposite = async () => {
    if (!resultImage) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = resultImage;

    // Wait for main image load
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
    });

    canvas.width = img.width;
    canvas.height = img.height;

    // 1. Draw Background Image
    ctx.drawImage(img, 0, 0);

    // 2. Draw Logo Overlay (if exists)
    if (logoImage) {
      try {
        const logoUrl = URL.createObjectURL(logoImage);
        const logoImg = new Image();
        logoImg.src = logoUrl;
        await new Promise<void>((resolve) => {
          logoImg.onload = () => resolve();
          logoImg.onerror = () => resolve(); // proceed even if fail
        });

        // Corner positioning (Top Right)
        const logoSize = canvas.width * 0.15; // 15% width
        const padding = canvas.width * 0.05; // 5% padding
        const x = canvas.width - logoSize - padding;
        const y = padding;

        ctx.drawImage(logoImg, x, y, logoSize, logoSize);
        URL.revokeObjectURL(logoUrl);
      } catch (e) {
        console.warn("Could not composite logo");
      }
    }

    // 3. Draw Text Overlay (if exists)
    if (headline.trim()) {
      const maxWidth = canvas.width * 0.95; // 95% of width
      let fontSize = Math.floor(canvas.width * 0.08); // start at 8% of width

      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const x = canvas.width / 2;
      let y = canvas.height * 0.02; // Start very close to top to avoid cutting diacritics

      // Function to split text into lines and measure them
      const getLines = (currentSize: number) => {
        ctx.font = `900 ${currentSize}px "Pyidaungsu", "Noto Sans Myanmar", sans-serif`;
        const result: string[] = [];
        const paragraphs = headline.split("\n");

        paragraphs.forEach((paragraph) => {
          const words = paragraph.split(" ");
          let currentLine = "";

          for (let i = 0; i < words.length; i++) {
            const testLine = currentLine + words[i] + " ";
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && i > 0) {
              result.push(currentLine.trim());
              currentLine = words[i] + " ";
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) {
            result.push(currentLine.trim());
          }
        });
        return result;
      };

      // Dynamically shrink font size if any line is too wide
      let lines = getLines(fontSize);
      while (
        lines.some((line) => ctx.measureText(line).width > maxWidth) &&
        fontSize > 20
      ) {
        fontSize -= 4;
        lines = getLines(fontSize);
      }

      const lineHeight = fontSize * 1.5; // generous line height for Burmese diacritics
      const totalTextHeight = lines.length * lineHeight;

      // Draw a full-width red banner at the top behind all the text
      ctx.fillStyle = "rgba(204, 0, 0, 0.9)"; // Dark Red banner
      const bannerPadding = canvas.height * 0.03;
      ctx.fillRect(0, 0, canvas.width, totalTextHeight + bannerPadding * 2);

      ctx.lineJoin = "round";
      ctx.miterLimit = 2;

      lines.forEach((line, index) => {
        // Add padding to lineY so top diacritics aren't cut
        const lineY = y + bannerPadding + index * lineHeight;

        // Glowing purple neon outline (Shadow)
        ctx.shadowColor = "#FF00FF"; // Magenta/Purple glow
        ctx.shadowBlur = fontSize * 0.25;
        ctx.lineWidth = fontSize * 0.15;
        ctx.strokeStyle = "#800080"; // Dark purple
        ctx.strokeText(line, x, lineY);

        // Remove shadow for inner strokes
        ctx.shadowBlur = 0;

        // Black crisp outline for pop-out effect
        ctx.lineWidth = fontSize * 0.06;
        ctx.strokeStyle = "black";
        ctx.strokeText(line, x, lineY);

        // Yellow fill with white center (gradient)
        const gradient = ctx.createLinearGradient(
          0,
          lineY,
          0,
          lineY + fontSize,
        );
        gradient.addColorStop(0, "#FFFFFF"); // Bold white inner font at top
        gradient.addColorStop(1, "#FFEA00"); // Yellow at bottom

        ctx.fillStyle = gradient;
        ctx.fillText(line, x, lineY);
      });
    }

    // 4. Trigger Download
    const link = document.createElement("a");
    link.download = `thumbnail_master_${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const AspectRatioButton = ({
    ratio,
    label,
    iconClass,
  }: {
    ratio: string;
    label: string;
    iconClass: string;
  }) => (
    <button
      onClick={() => setAspectRatio(ratio)}
      className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
        aspectRatio === ratio
          ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40"
          : "bg-[#0A0A0A] border-[#222222] text-slate-500 hover:border-slate-600"
      }`}
    >
      <div className={`border-2 border-current rounded-sm mb-2 ${iconClass}`} />
      <span className="text-[9px] font-black uppercase tracking-widest">
        {label}
      </span>
      <span className="text-[8px] opacity-60 mt-0.5">{ratio}</span>
    </button>
  );

  return (
    <div className="flex-1 flex flex-col gap-8 animate-flutter-fade h-full overflow-hidden safe-area max-w-4xl mx-auto w-full">
      {/* Header matching the design */}
      <div className="flex flex-col items-center justify-center pt-4 pb-6">
        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">
          AI Thumbnail Master
        </h2>
        <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em]">
          Neural Art V4 (Pro)
        </p>
      </div>

      <div className="flex-1 glass-panel rounded-[2.5rem] p-8 md:p-10 overflow-y-auto custom-scrollbar bg-[#050505] border-[#111111] shadow-2xl space-y-8">
        {/* Image Art Style */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">
            Image Art Style
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setArtStyle("REALISTIC")}
              className={`p-6 rounded-2xl border text-left transition-all ${
                artStyle === "REALISTIC"
                  ? "bg-blue-600 border-blue-500 text-white shadow-xl"
                  : "bg-[#0A0A0A] border-[#222222] text-slate-500 hover:border-slate-600"
              }`}
            >
              <span className="block text-sm font-black uppercase tracking-tight">
                Realistic Photo
              </span>
              <span className="block text-[10px] opacity-80 mt-1 font-medium">
                True-to-life photography
              </span>
            </button>
            <button
              onClick={() => setArtStyle("ILLUSTRATION")}
              className={`p-6 rounded-2xl border text-left transition-all ${
                artStyle === "ILLUSTRATION"
                  ? "bg-blue-600 border-blue-500 text-white shadow-xl"
                  : "bg-[#0A0A0A] border-[#222222] text-slate-500 hover:border-slate-600"
              }`}
            >
              <span className="block text-sm font-black uppercase tracking-tight">
                AI Illustration
              </span>
              <span className="block text-[10px] opacity-80 mt-1 font-medium">
                Cinematic digital art
              </span>
            </button>
          </div>
        </div>

        {/* Visual References & Brand Logo */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">
              Visual References (Optional)
            </label>
            <input
              type="file"
              ref={refInputRef}
              onChange={handleReferenceSelect}
              className="hidden"
            />
            <button
              onClick={() => refInputRef.current?.click()}
              className="w-full h-32 border-2 border-dashed border-[#222222] rounded-3xl flex flex-col items-center justify-center gap-2 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group overflow-hidden"
            >
              {referencePreview ? (
                <div className="relative w-full h-full p-2">
                  <div className="w-full h-full bg-[#111111] rounded-2xl flex items-center justify-center overflow-hidden relative">
                    <img
                      src={referencePreview}
                      alt="Reference"
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1 text-center">
                      <span className="text-[9px] text-white truncate block">
                        {referenceImage?.name}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full bg-[#111111] flex items-center justify-center text-slate-500 group-hover:text-blue-500">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </div>
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest group-hover:text-slate-400">
                    Add Reference
                  </span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">
              Channel Icon / Logo
            </label>
            <input
              type="file"
              ref={logoInputRef}
              onChange={handleLogoSelect}
              className="hidden"
            />
            <button
              onClick={() => logoInputRef.current?.click()}
              className="w-full h-32 border-2 border-dashed border-[#222222] rounded-3xl flex flex-col items-center justify-center gap-2 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group overflow-hidden"
            >
              {logoPreview ? (
                <div className="relative w-full h-full p-2">
                  <div className="w-full h-full bg-[#111111] rounded-2xl flex items-center justify-center overflow-hidden relative">
                    <img
                      src={logoPreview}
                      alt="Logo"
                      className="w-full h-full object-contain p-2"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1 text-center">
                      <span className="text-[9px] text-white truncate block">
                        {logoImage?.name}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full bg-[#111111] flex items-center justify-center text-slate-500 group-hover:text-blue-500">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      />
                    </svg>
                  </div>
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest group-hover:text-slate-400">
                    Upload Icon
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Image Context & Scene */}
        <div className="space-y-3">
          <div className="flex justify-between px-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
              Image Context & Scene
            </label>
            <span className="text-[9px] font-bold text-slate-700">
              {prompt.length} / 1500
            </span>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your vision in detail (e.g., A cinematic scene of a brave young man in a bustling market...)"
            rows={4}
            style={{
              fontFamily: '"Pyidaungsu", "Noto Sans Myanmar", sans-serif',
            }}
            className="w-full bg-[#0A0A0A] border border-[#222222] rounded-3xl p-6 text-white text-sm font-medium focus:outline-none focus:border-blue-500/50 transition-all resize-none placeholder:text-[#333333]"
          />
        </div>

        {/* Main Headline */}
        <div className="space-y-3">
          <div className="flex justify-between px-1">
            <label className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">
              Main Headline (With Burmese Support)
            </label>
            <span className="text-[9px] font-bold text-slate-700">
              {headline.length} / 100
            </span>
          </div>
          <input
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Enter bold headline (supports multiple lines)..."
            style={{
              fontFamily: '"Pyidaungsu", "Noto Sans Myanmar", sans-serif',
            }}
            className="w-full bg-[#0A0A0A] border border-[#222222] rounded-2xl px-6 py-4 text-white text-sm font-bold focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-[#222222]"
          />
        </div>

        {/* Accent Texts (Optional) */}
        <div className="flex justify-between items-center px-1">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
            Accent Texts (Optional)
          </label>
          <button className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:text-white transition-colors">
            + Add Sub-Text
          </button>
        </div>

        {/* Display Mode */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">
            Display Mode
          </label>
          <div className="grid grid-cols-4 gap-4">
            <AspectRatioButton ratio="1:1" label="Social" iconClass="w-4 h-4" />
            <AspectRatioButton ratio="3:4" label="Shorts" iconClass="w-4 h-5" />
            <AspectRatioButton
              ratio="9:16"
              label="TikTok"
              iconClass="w-4 h-7"
            />
            <AspectRatioButton
              ratio="16:9"
              label="YouTube"
              iconClass="w-7 h-4"
            />
          </div>
        </div>

        {/* Generate Button */}
        <div className="pt-4">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl transition-all active:scale-[0.98] border-b-4 flex items-center justify-center gap-3 ${
              isGenerating
                ? "bg-slate-800 text-slate-500 border-slate-900 cursor-wait"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-indigo-800"
            }`}
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                Processing Neural Art...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                  />
                </svg>
                Generate Thumbnail
              </>
            )}
          </button>
        </div>

        {/* Result Area */}
        {resultImage && (
          <div className="mt-8 animate-in slide-in-from-bottom-8 duration-700">
            <div className="flex items-center justify-between px-1 mb-4">
              <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">
                Neural Output
              </h3>
              <button
                onClick={downloadComposite}
                className="text-[10px] font-black text-white uppercase tracking-widest hover:text-blue-400 flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download PNG
              </button>
            </div>

            {/* Visual Preview Container with Client-Side Overlay */}
            <div className="rounded-[2rem] overflow-hidden border border-emerald-500/30 shadow-2xl relative group bg-black">
              <img
                src={resultImage}
                alt="Generated Thumbnail"
                className="w-full h-auto"
              />

              {/* CSS Text Overlay for Preview */}
              {headline && (
                <div
                  className="absolute top-0 left-0 w-full z-10 pointer-events-none"
                  style={{
                    backgroundColor: "rgba(204, 0, 0, 0.9)",
                    paddingBottom: "1rem",
                    paddingTop: "1rem",
                  }}
                >
                  <h2
                    className="text-center font-black leading-[1.4] px-4"
                    style={{
                      fontFamily:
                        '"Pyidaungsu", "Noto Sans Myanmar", sans-serif',
                      fontSize: "clamp(24px, 5vw, 48px)",
                      color: "#FFFFFF", // Fallback
                      backgroundImage:
                        "linear-gradient(to bottom, #FFFFFF, #FFEA00)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      // Complex shadow to simulate stroke + neon glow
                      filter: `
                                        drop-shadow(0 0 10px #FF00FF) 
                                        drop-shadow(0 0 20px #800080)
                                      `,
                      WebkitTextStroke: "2px black",
                    }}
                  >
                    {headline}
                  </h2>
                </div>
              )}

              {/* CSS Logo Overlay for Preview */}
              {logoPreview && (
                <img
                  src={logoPreview}
                  alt="Logo Overlay"
                  className="absolute top-[5%] right-[5%] w-[15%] h-[15%] object-contain z-20 pointer-events-none"
                />
              )}
            </div>

            <div className="mt-4 px-2">
              <p className="text-[10px] text-slate-500 italic">
                * Note: The Myanmar text and Logo are overlaid using client-side
                rendering. They will be included in the downloaded PNG.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IllustrationHub;
