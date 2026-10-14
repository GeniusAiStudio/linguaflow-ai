import { GoogleGenAI } from "@google/genai";

/**
 * UTILS FOR MYANMAR UNICODE SANITIZATION, VALIDATION, AND INTEGRITY CHECKS
 * Designed to ensure generated Burmese voiceover scripts are 100% compliant, readable, and render correctly across all devices.
 */

const ZAWGYI_DETECT_REGEX = /[\u1033\u1034\u1039\u103C\u103D\u103E\u105A\u1060-\u1069\u106C\u106D\u1070-\u1074\u107B-\u1085\u108A\u1090\u1091\u1094\u1095]/;

/**
 * Heuristics to check if text contains Zawgyi encoded sequences
 */
export function isZawgyi(text: string): boolean {
  if (!text) return false;
  const hasBurmese = /[\u1000-\u109F]/.test(text);
  if (!hasBurmese) return false;

  // Specific visual-order Zawgyi patterns or non-Unicode combinations
  const zawgyiIndicators = [
    /[\u1000-\u1021]\u103C[\u102B-\u1030]/,   // Zawgyi visual order for medials/vowels
    /[\u1060-\u1085]/,                        // Subscript/stacked consonants in Shan/Karen range (hijacked in Zawgyi)
    /\u103B[\u1000-\u1021]/,                  // Medial y placed before consonant (visual typing)
    /\u1031[\u1000-\u1021]/,                  // Vowel e placed before consonant (visual typing)
    /[\u1000-\u1021]\u1039[^\u1000-\u1021]/,   // Subscript spacer not followed by consonant
    /[\u102F\u1030][\u103B-\u103E]/,          // Vowels before medials
  ];

  return zawgyiIndicators.some(regex => regex.test(text)) || ZAWGYI_DETECT_REGEX.test(text);
}

/**
 * Fixes common typos or incorrect orders of combining diacritics in standard Unicode
 */
export function correctCombiningMarksOrder(text: string): string {
  if (!text) return text;
  let corrected = text;

  // 1. Correct ordering: vowel 'i' (\u102D) must be before vowel 'u' (\u102F) for standard 'o' sound (ို)
  corrected = corrected.replace(/\u102F\u102D/g, "\u102D\u102F"); // ုိ -> ို
  corrected = corrected.replace(/\u1030\u102D/g, "\u102D\u1030"); // ူိ -> ီု
  corrected = corrected.replace(/\u102F\u102E/g, "\u102E\u102F"); // ုီ -> ီု
  corrected = corrected.replace(/\u1030\u102E/g, "\u102E\u1030"); // ူီ -> ီူ

  // 2. Remove duplicate diacritics that render as overlapping layers
  corrected = corrected.replace(/\u102B\u102B+/g, "\u102B");
  corrected = corrected.replace(/\u102C\u102C+/g, "\u102C");
  corrected = corrected.replace(/\u102D\u102D+/g, "\u102D");
  corrected = corrected.replace(/\u102E\u102E+/g, "\u102E");
  corrected = corrected.replace(/\u102F\u102F+/g, "\u102F");
  corrected = corrected.replace(/\u1030\u1030+/g, "\u1030");
  corrected = corrected.replace(/\u1037\u1037+/g, "\u1037");
  corrected = corrected.replace(/\u1038\u1038+/g, "\u1038");
  corrected = corrected.replace(/\u103A\u103A+/g, "\u103A");

  // Remove duplicate separators
  corrected = corrected.replace(/\u200B\u200B+/g, "\u200B");
  corrected = corrected.replace(/\u200C\u200C+/g, "\u200C");

  return corrected;
}

/**
 * Inserts Zero-Width Spaces (ZWSP) at syllable boundaries
 * This allows proper line wrapping in renderers (Flutter, iOS, Android, web browsers) 
 * without splitting individual Myanmar words incorrectly.
 */
export function insertZeroWidthSpaces(text: string): string {
  if (!text) return text;

  // Insert a Zero-Width Space (\u200B) between a vowel sign/tone/asat and the next consonant.
  // This guides the renderer to break only at syllable boundaries.
  // We exclude consonants preceded by virama \u1039 which forms stacked consonants.
  return text.replace(/([\u102B-\u1032\u1036-\u1038\u103A])([\u1000-\u1021])/g, "$1\u200B$2");
}

/**
 * Cleans Markdown formatting (*, _, etc.) from inside narration lines 
 * while leaving speaker bold labels intact, ensuring plain text narration only.
 */
export function cleanMarkdownFromNarration(text: string): string {
  if (!text) return text;

  const lines = text.split("\n");
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    // Check for Speaker dialogue/narration lines with bold headers: "**Speaker Name:** Dialogue..." or "**Speaker Name**:"
    const speakerMatch = trimmed.match(/^(\*\*[^*]+:\*\*|\*\*[^*]+\*\*:\s*)\s*(.*)$/);
    if (speakerMatch) {
      const header = speakerMatch[1];
      let dialogue = speakerMatch[2];

      // Remove internal bolding or italics from inside the dialogue itself
      dialogue = dialogue.replace(/\*\*([^*]+)\*\*/g, "$1")
                         .replace(/\*([^*]+)\*/g, "$1")
                         .replace(/_([^_]+)_/g, "$1")
                         .replace(/`([^`]+)`/g, "$1");

      return `${header} ${dialogue.trim()}`;
    }

    // Standard plain line: clean all Markdown
    let cleanLine = trimmed;
    if (cleanLine.startsWith("**") && cleanLine.endsWith("**")) {
      cleanLine = cleanLine.slice(2, -2).trim();
    }
    if (cleanLine.startsWith("_") && cleanLine.endsWith("_")) {
      cleanLine = cleanLine.slice(1, -1).trim();
    }

    cleanLine = cleanLine.replace(/\*\*([^*]+)\*\*/g, "$1")
                         .replace(/\*([^*]+)\*/g, "$1")
                         .replace(/_([^_]+)_/g, "$1")
                         .replace(/`([^`]+)`/g, "$1");

    return cleanLine;
  });

  return processedLines.join("\n");
}

/**
 * Validates Myanmar text block for potential issues.
 */
export function validateMyanmarUnicode(text: string): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!text) return { isValid: true, issues };

  // Check for presence of Zawgyi
  if (isZawgyi(text)) {
    issues.push("Zawgyi encoding patterns or visual stacks detected");
  }

  // Check for misplaced vowels (ုိ U+102F U+102D)
  if (/\u102F\u102D/.test(text)) {
    issues.push("Misordered vowel signs (ုိ instead of ို) found");
  }

  // Check for duplicate adjacent marks
  if (/\u102C\u102C+/.test(text) || /\u102D\u102D+/.test(text) || /\u102F\u102F+/.test(text)) {
    issues.push("Duplicate adjacent combining marks found");
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Runs consonant-level integrity check to make sure no words disappeared
 */
export function runMyanmarIntegrityCheck(originalText: string, processedText: string): { success: boolean; issue?: string } {
  const getConsonants = (t: string) => (t.match(/[\u1000-\u1021]/g) || []).join("");
  const origCons = getConsonants(originalText);
  const procCons = getConsonants(processedText);

  if (origCons.length === 0) {
    return { success: true };
  }

  const ratio = procCons.length / origCons.length;
  // If we lose more than 10% of consonants, we flag it.
  if (ratio < 0.90) {
    return {
      success: false,
      issue: `Consonant count dropped significantly (ratio: ${ratio.toFixed(2)}). Original: ${origCons.length}, Processed: ${procCons.length}.`
    };
  }

  return { success: true };
}

/**
 * Main function to post-process, repair, and format Myanmar text scripts
 */
export function repairAndNormalizeMyanmarText(text: string): string {
  if (!text) return text;

  // 1. Correct misplaced Combining Marks
  let result = correctCombiningMarksOrder(text);

  // 2. Clear internal narration Markdown formatting
  result = cleanMarkdownFromNarration(result);

  // ZWSP injection removed as it causes syllable fragmentation and rendering bugs.
  // result = insertZeroWidthSpaces(result);

  return result;
}

/**
 * Lossless fallback converter leveraging Gemini if Zawgyi is detected
 */
export async function convertZawgyiToUnicodeWithGemini(text: string, apiKey: string): Promise<string> {
  if (!isZawgyi(text)) return text;

  let attempt = 0;
  const maxAttempts = 3;
  let lastError: any = null;

  while (attempt < maxAttempts) {
    try {
      const ai = typeof window !== "undefined"
        ? {
            models: {
              generateContent: async (options: any) => {
                const response = await fetch("/api/gemini-generate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(options)
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "Failed to call Gemini");
                return data;
              }
            }
          }
        : new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-flash-lite-latest",
        contents: `Convert the following Zawgyi encoded text to standard compliant Myanmar Unicode (UTF-8). Preserve every single word, sentence, punctuation, speaker mark, and paragraph exactly. Output ONLY the resulting Unicode string, with no commentary or markdown backticks.\n\n"${text}"`,
        config: {
          systemInstruction: "You are an expert Myanmar language engineer. Convert Zawgyi to standard Unicode (UTF-8) perfectly and losslessly.",
          temperature: 0.1,
          maxOutputTokens: 8192,
        }
      });

      const unicodeResult = response.text?.trim();
      if (unicodeResult) {
        // Validate that it has roughly correct content preservation
        const check = runMyanmarIntegrityCheck(text, unicodeResult);
        if (check.success) {
          return unicodeResult;
        }
      }
      throw new Error("Empty result or failed integrity check");
    } catch (err: any) {
      lastError = err;
      attempt++;
      console.warn(`Zawgyi conversion attempt ${attempt} failed:`, err.message);
      
      if (attempt < maxAttempts) {
        if (err.message && err.message.includes("429")) {
          console.log("Zawgyi converter: Rate limit hit! Waiting 30 seconds before retry...");
          await new Promise((resolve) => setTimeout(resolve, 30000));
        } else {
          await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
        }
      }
    }
  }

  console.error("Gemini Zawgyi converter final error:", lastError?.message || lastError);
  return text; // Return original if conversion/validation failed after retries
}


/**
 * Fixes spaces inserted by PDF parsers between Myanmar syllables and characters.
 * Preserves paragraphs and intentional double spaces.
 */
export function fixMyanmarPdfTextSpaces(text: string): string {
  if (!text) return text;
  
  let result = text;

  let prev = "";
  while (prev !== result) {
    prev = result;
    // 1. Remove spaces before any vowel/medial/tone/asat (102B-103F)
    result = result.replace(/([\u1000-\u109F])[ \t]+([\u102B-\u103F])/g, '$1$2');

    // 2. Remove spaces after pre-base vowels/medials (ေ 1031, ြ 103C)
    result = result.replace(/([\u1031\u103C])[ \t]+([\u1000-\u109F])/g, '$1$2');

    // 3. Remove spaces before a consonant that is part of a syllable coda (e.g., has Asat 103A, or Virama 1039)
    result = result.replace(/([\u1000-\u109F])[ \t]+([\u1000-\u102A][\u1039\u103A])/g, '$1$2');
  }

  // 4. Remove exact single spaces between any Myanmar characters to glue fragmented words
  // (Double spaces and newlines are preserved as intentional sentence breaks or formatting)
  let prev2 = "";
  while (prev2 !== result) {
    prev2 = result;
    result = result.replace(/([\u1000-\u109F]) ([\u1000-\u109F])/g, '$1$2');
  }
  
  return result;
}
