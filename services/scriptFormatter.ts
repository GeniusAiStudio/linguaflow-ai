
import { ScriptFormat } from '../types';

export class ScriptFormatter {
  /**
   * Dialogue formatting: Identifies speakers via lines ending with a colon.
   * Logic: bool isSpeakerLine(String line) => line.endsWith(':');
   */
  static formatDialogue(rawText: string): string {
    const lines = rawText.split('\n');
    const resultLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Detect speaker line
      if (trimmed.endsWith(':')) {
        resultLines.push(trimmed);
      } else {
        // Dialogue lines are indented by 4 spaces
        resultLines.push(`    ${trimmed}`);
      }
    }
    return resultLines.join('\n');
  }

  /**
   * Narration formatting: Joins paragraphs with double newlines.
   * Mirrors Flutter ScriptFormatter.formatNarration exactly.
   */
  static formatNarration(rawText: string): string {
    const paragraphs = rawText
      .split(/\n+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    return paragraphs.join('\n\n');
  }

  /**
   * Primary logic dispatcher matching the Dart 'apply' method.
   */
  static apply(text: string, format: ScriptFormat): string {
    if (!text) return "";
    
    switch (format) {
      case ScriptFormat.DIALOGUE:
        return this.formatDialogue(text);
      case ScriptFormat.NARRATION:
        return this.formatNarration(text);
      case ScriptFormat.NONE:
      default:
        return text;
    }
  }
}
