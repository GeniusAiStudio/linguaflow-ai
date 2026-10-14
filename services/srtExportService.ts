
export class SrtExportService {
  /**
   * Exports SRT content as a file download.
   * Mirrors the Dart SrtExportService.export method.
   */
  static async export(fileName: string, srtContent: string): Promise<void> {
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.srt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
