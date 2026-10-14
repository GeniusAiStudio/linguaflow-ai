
export class ExportService {
  /**
   * Triggers a browser download for a text file
   */
  exportAsTxt(content: string, fileName: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    this.downloadBlob(blob, `${fileName}.txt`);
  }

  /**
   * Triggers a browser download for an SRT subtitle file
   */
  exportAsSrt(content: string, fileName: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    this.downloadBlob(blob, `${fileName}.srt`);
  }

  /**
   * Triggers a browser download for a Word-compatible document
   * Uses an HTML-to-Word blob wrapper for instant compatibility
   */
  exportAsDocx(content: string, fileName: string) {
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                    <head><meta charset='utf-8'><title>Export</title>
                    <style>
                      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20pt; }
                      .body { line-height: 1.6; font-size: 11pt; }
                    </style>
                    </head><body>`;
    const footer = "</body></html>";
    // Flutter template used {{body}}, we simulate that by wrapping the content in a div
    const sourceHTML = header + `<div class="body">${content.replace(/\n/g, '<br>')}</div>` + footer;
    
    const blob = new Blob(['\ufeff', sourceHTML], {
      type: 'application/msword'
    });
    
    this.downloadBlob(blob, `${fileName}.doc`);
  }

  /**
   * Uses Web Share API if available (matching Flutter share_plus dependency)
   */
  async shareContent(title: string, text: string): Promise<boolean> {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: text,
        });
        return true;
      } catch (err) {
        console.error("Sharing failed", err);
        return false;
      }
    }
    return false;
  }

  async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      console.warn("navigator.clipboard.writeText failed, trying fallback:", err);
    }

    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    } catch (fallbackErr) {
      console.error("Clipboard copy fallback failed:", fallbackErr);
      return false;
    }
  }

  private downloadBlob(blob: Blob, fullFileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fullFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const exportService = new ExportService();
