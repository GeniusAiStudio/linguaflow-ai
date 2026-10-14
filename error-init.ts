if (typeof window !== 'undefined') {
  const renderGlobalError = (title: string, message: string, stack: string) => {
    const container = document.getElementById('root') || document.body;
    if (container) {
      container.innerHTML = `
        <div style="background-color: #050505; color: #ef4444; padding: 40px; font-family: monospace; height: 100vh; overflow: auto; box-sizing: border-box; display: flex; flex-direction: column; gap: 20px; z-index: 99999; position: fixed; top: 0; left: 0; width: 100vw; text-align: left;">
          <h1 style="color: #ffffff; font-size: 24px; font-weight: bold; margin: 0; font-family: sans-serif;">${title}</h1>
          <p style="font-size: 16px; font-weight: bold; color: #fca5a5; margin: 0;">Error: ${message}</p>
          <pre style="background-color: #111111; padding: 20px; border-radius: 8px; border: 1px solid #222222; color: #94a3b8; white-space: pre-wrap; font-size: 12px; line-height: 1.5; margin: 0; font-family: monospace;">${stack}</pre>
          <button onclick="localStorage.clear(); window.location.reload();" style="padding: 12px 24px; background-color: #ef4444; color: #ffffff; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; align-self: flex-start; font-family: sans-serif;">Clear Cache & Reload</button>
        </div>
      `;
    }
  };

  window.addEventListener('error', (event) => {
    const errMsg = event.message || '';
    if (errMsg.toLowerCase().includes('websocket') || errMsg.toLowerCase().includes('vite')) {
      return;
    }
    console.error("Global captured error:", event.error);
    renderGlobalError(
      'Global Script Error',
      event.message || 'Unknown error',
      event.error?.stack || `Filename: ${event.filename}\nLine: ${event.lineno}:${event.colno}`
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = String(event.reason?.message || event.reason || '');
    if (reasonStr.toLowerCase().includes('websocket') || reasonStr.toLowerCase().includes('vite')) {
      return;
    }
    console.error("Global captured promise rejection:", event.reason);
    renderGlobalError(
      'Unhandled Promise Rejection',
      event.reason?.message || String(event.reason),
      event.reason?.stack || 'No stack trace available'
    );
  });
  
  console.log("Global error catcher initialized first.");
}
export {};
