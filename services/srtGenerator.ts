
export class SrtGenerator {
  /**
   * Generate SRT from text using the AutoTiming algorithm.
   * Logic synchronized with Dart AutoTimingSrtGenerator.
   * Default charsPerSecond set to 18.0 to accommodate scripts with high character-to-syllable counts (like Burmese).
   * 
   * @param text The source text lines.
   * @param startTimeMs Offset to start timing from (default 0).
   * @param charsPerSecond Reading speed multiplier (default 18.0 for Unicode scripts).
   * @param minDurationMs Minimum visibility duration (default 1500ms).
   * @param maxDurationMs Maximum visibility duration (default 6000ms).
   * @param gapMs Gap between subtitles (default 400ms).
   */
  static generate(
    text: string, 
    startTimeMs: number = 0, 
    charsPerSecond: number = 18.0,
    minDurationMs: number = 1500,
    maxDurationMs: number = 6000,
    gapMs: number = 400
  ): string {
    const lines = text
      .split('\n')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    let result = '';
    let currentTime = startTimeMs;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // estimatedMs = (line.length / charsPerSecond * 1000).round()
      const estimatedMs = Math.round((line.length / charsPerSecond) * 1000);
      
      let duration = estimatedMs;

      // Clamping logic: minDuration <= duration <= maxDuration
      if (duration < minDurationMs) duration = minDurationMs;
      if (duration > maxDurationMs) duration = maxDurationMs;

      const start = currentTime;
      const end = currentTime + duration;

      // SRT Format construction
      result += `${i + 1}\n`;
      result += `${this.formatTime(start)} --> ${this.formatTime(end)}\n`;
      result += `${line}\n\n`;

      // Advance clock: currentTime = end + gap
      currentTime = end + gapMs;
    }

    return result.trim();
  }

  /**
   * Formats duration into SRT time format: HH:mm:ss,mmm
   * Mirroring the _format(Duration d) method in Dart.
   */
  private static formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    const remainingMs = Math.floor(ms % 1000);

    const pad = (n: number, z: number = 2) => n.toString().padStart(z, '0');

    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(remainingMs, 3)}`;
  }
}
