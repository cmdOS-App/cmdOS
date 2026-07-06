/**
 * @file inTabToasts.ts
 * @description Injects and displays visual toast notifications inside active browser tabs.
 */

/**
 * Shows a premium toast notification in the active browser tab by injecting a DOM element.
 * Respects restricted pages (like `chrome://` settings) and routes through extension message
 * channels if the active tab is an extension-managed page where scripting injection is prohibited.
 *
 * @param title The title header of the toast notification (e.g. "cmdOS Notification").
 * @param message The main message content to display.
 */
export async function showInTabToast(title: string, message: string) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab || !tab.id) {
      console.warn('[Background] No active tab with ID found for toast');
      return;
    }

    const isRestricted = tab.url?.startsWith('chrome://') && !tab.url?.includes('AltS_search_newtab');
    const isOurExtension =
      tab.url?.startsWith('chrome-extension://' + chrome.runtime.id) || tab.url?.includes('AltS_search_newtab');

    if (isRestricted && !isOurExtension) {
      console.warn('[Background] Cannot show toast on a restricted system page:', tab.url);
      return;
    }
    // If it's our extension page, we MUST use sendMessage as executeScript is restricted
    if (isOurExtension) {
      chrome.tabs
        .sendMessage(tab.id, {
          type: 'SHOW_TOAST',
          message: `${title}: ${message}`,
          toastType: 'info',
        })
        .catch(err => console.warn('[Background] Failed to send toast message to extension tab:', err));
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (t: string, m: string) => {
        const id = 'cmdos-toast-' + Date.now();
        const toast = document.createElement('div');
        toast.id = id;
        toast.innerHTML = `
          <div style="
            position: fixed; top: 24px; right: 24px; z-index: 2147483647;
            background: rgba(18, 18, 18, 0.95); backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1); border-left: 4px solid #3b82f6;
            border-radius: 16px; padding: 16px 20px; width: 320px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.4);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: white; transform: translateX(400px); transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
            display: flex; flex-direction: column; gap: 4px;
          ">
            <div style="font-size: 14px; font-weight: 700; color: #3b82f6; letter-spacing: 0.5px;">${t}</div>
            <div style="font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.9); line-height: 1.4;">${m}</div>
            <div style="margin-top: 8px; font-size: 11px; color: rgba(255,255,255,0.4);">Click to dismiss</div>
          </div>
        `;
        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
          const el = toast.firstElementChild as HTMLElement;
          if (el) el.style.transform = 'translateX(0)';
        });

        // Auto dismiss
        const dismiss = () => {
          const el = toast.firstElementChild as HTMLElement;
          if (el) el.style.transform = 'translateX(400px)';
          setTimeout(() => toast.remove(), 500);
        };
        toast.onclick = dismiss;
        setTimeout(dismiss, 5000);
      },
      args: [title, message],
    });
  } catch (err) {
    console.error('[Background] Failed to show in-tab toast:', err);
  }
}
