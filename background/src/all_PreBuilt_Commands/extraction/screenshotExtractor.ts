/**
 * @file screenshotExtractor.ts
 * @description Handles capture and extraction of webpage screenshots.
 */
import { nowUtc } from '../../../../src/shared-components/utils';

export const handleScreenshotCommand = (
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void,
): boolean | undefined => {
  if (request.action === 'CAPTURE_ELEMENT') {
    const { rect } = request;

    chrome.tabs.captureVisibleTab({ format: 'png' }, async dataUrl => {
      if (!dataUrl) {
        console.error('Failed to capture visible tab');
        return;
      }

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) throw new Error('No active tab');

        const croppedDataUrlResults = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async (imgUrl: string, cropRect: any) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            const img = new Image();
            img.src = imgUrl;
            await new Promise(r => {
              img.onload = r;
            });

            canvas.width = cropRect.width * cropRect.dpr;
            canvas.height = cropRect.height * cropRect.dpr;

            ctx.drawImage(
              img,
              cropRect.x * cropRect.dpr,
              cropRect.y * cropRect.dpr,
              cropRect.width * cropRect.dpr,
              cropRect.height * cropRect.dpr,
              0,
              0,
              cropRect.width * cropRect.dpr,
              cropRect.height * cropRect.dpr,
            );

            return canvas.toDataURL('image/png');
          },
          args: [dataUrl, rect],
        });

        const finalUrl = croppedDataUrlResults[0]?.result;
        if (!finalUrl) throw new Error('Failed to crop image');

        const timestamp = nowUtc().replace(/[:.]/g, '-');
        const filename = `tasklabs-element-${timestamp}.png`;

        chrome.downloads.download({
          url: finalUrl,
          filename: filename,
          saveAs: false,
        });
      } catch (err) {
        console.error('Element capture failed:', err);
      }
    });
    return true;
  }

  if (request.action === 'CAPTURE_VISIBLE_TAB') {
    chrome.tabs.captureVisibleTab({ format: 'png' }, async dataUrl => {
      if (!dataUrl) {
        sendResponse({ success: false, error: 'Failed to capture visible tab' });
        return;
      }
      try {
        const timestamp = nowUtc().replace(/[:.]/g, '-');
        chrome.downloads.download({
          url: dataUrl,
          filename: `tasklabs-screenshot-${timestamp}.png`,
          saveAs: false,
        });
        sendResponse({ success: true });
      } catch (err: any) {
        sendResponse({ success: false, error: err.message });
      }
    });
    return true; // Keep message channel open for async response
  }

  if (request.action === 'CAPTURE_FULL_PAGE') {
    // For now, implement CAPTURE_FULL_PAGE as a simple CAPTURE_VISIBLE_TAB fallback
    chrome.tabs.captureVisibleTab({ format: 'png' }, async dataUrl => {
      if (!dataUrl) {
        sendResponse({ success: false, error: 'Failed to capture full page' });
        return;
      }
      try {
        const timestamp = nowUtc().replace(/[:.]/g, '-');
        chrome.downloads.download({
          url: dataUrl,
          filename: `tasklabs-fullpage-${timestamp}.png`,
          saveAs: false,
        });
        sendResponse({ success: true });
      } catch (err: any) {
        sendResponse({ success: false, error: err.message });
      }
    });
    return true; // Keep message channel open for async response
  }

  return undefined;
};
