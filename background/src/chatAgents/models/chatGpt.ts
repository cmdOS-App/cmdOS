/**
 * @file chatGpt.ts
 * @description Automation handler for injecting and submitting prompts into ChatGPT.
 */

import type { AutoSubmitRequest } from '@automation/runtime_Execution_Engine/runner';

/**
 * Injects a content script into the specified ChatGPT tab to automatically fill
 * the chat input with the provided text/images and trigger the submission.
 * Handles edge cases like uploading images, waiting for the submit button to
 * become enabled, and mimicking native user events to bypass React synthetic event blocks.
 *
 * @param tabId The ID of the tab where ChatGPT is open.
 * @param request The auto-submit configuration detailing the prompt and optional images.
 */
export async function executeChatGPTSubmit(tabId: number, request: AutoSubmitRequest) {
  if (!chrome.scripting?.executeScript) return;

  // Use calendar prompt if needed
  let promptToUse = request.prompt;
  if (request.kind === 'calendar') {
    promptToUse = `Act as a professional AI personal assistant and calendar manager. Access the Google Calendar. Optimize the schedule for productivity, allow for breaks, and manage conflicts. When scheduling, consider existing appointments. ${request.prompt}`;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      args: ['chatgpt', promptToUse, request.images || null, tabId],
      world: 'MAIN',
      func: (
        kind: string,
        promptFromExtension: string,
        imagesFromExtension?: { base64: string; mimeType: string; filename: string }[] | null,
        currentTabId?: number,
      ) => {
        const getResolvedPrompt = (): string => {
          if (promptFromExtension && promptFromExtension.trim()) {
            return promptFromExtension.trim();
          }
          try {
            const url = new URL(window.location.href);
            const fromQuery = url.searchParams.get('q') || '';
            return fromQuery.trim();
          } catch (error) {
            console.warn('[auto-submit] failed to parse URL', error);
            return '';
          }
        };

        const markKey = `tasklabsAutoSubmit-${kind}`;
        const timestampKey = `${markKey}-timestamp`;

        const stopMonitoring = () => {
          if ((window as any)[timestampKey + '-stopped']) return;
          (window as any)[timestampKey + '-stopped'] = true;

          if ((window as any)[timestampKey + '-interval']) {
            window.clearTimeout((window as any)[timestampKey + '-interval']);
            (window as any)[timestampKey + '-interval'] = null;
          }

          try {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage && currentTabId !== undefined) {
              chrome.runtime.sendMessage({ action: 'prompt_injected_success', tabId: currentTabId });
            }
          } catch (e) {
            console.warn('[auto-submit] failed to send completion signal', e);
          }
        };

        const resolvedPrompt = getResolvedPrompt();
        if (!resolvedPrompt && (!imagesFromExtension || imagesFromExtension.length === 0)) {
          stopMonitoring();
          return;
        }

        const dataURLtoFile = (dataurl: string, filename: string) => {
          const arr = dataurl.split(',');
          const mime = arr[0].match(/:(.*?);/)?.[1];
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          return new File([u8arr], filename, { type: mime });
        };

        let imageUploadAttempted = false;
        const filesInjected = false;
        let lastImageUpload = 0;
        const lastPlusBtnClick = 0;
        let lastTextUpdate = 0;
        let lastSubmitClick = 0;
        const lastReadyToSubmit = 0;
        const uploadState: 'idle' | 'opening' | 'menu-open' | 'waiting-input' | 'done' = 'idle';
        const textInjectedOnce = false;
        const firstUploadAttempt = 0;
        const lastUploadClick = 0;
        const lastReadyCheck = new WeakMap<HTMLButtonElement, number>();

        const wakeUpBackgroundTab = () => {
          Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
          Object.defineProperty(document, 'hidden', { value: false, writable: true });
          document.dispatchEvent(new Event('visibilitychange'));
          const _reflow = document.body.offsetHeight;
        };

        window.scrollTo(0, document.body.scrollHeight);

        const setNativeValue = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
          const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
          const prototype = Object.getPrototypeOf(element);
          const prototypeValueSetter = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value')?.set : undefined;
          if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
            prototypeValueSetter.call(element, value);
          } else if (valueSetter) {
            valueSetter.call(element, value);
          } else {
            (element as any).value = value;
          }
        };

        const focusAndFill = (element: HTMLInputElement | HTMLTextAreaElement) => {
          element.focus();
          setNativeValue(element, '');
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          setNativeValue(element, resolvedPrompt);
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const clickAvailableButton = (
          selectors: string[],
          stopMonitoring?: () => void,
        ): { clicked: boolean; button: HTMLButtonElement | null } => {
          for (const selector of selectors) {
            const candidate = document.querySelector(selector) as HTMLButtonElement | null;
            if (candidate && !candidate.disabled) {
              const opts = {
                bubbles: true,
                cancelable: true,
                view: window,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true,
              };

              if (typeof PointerEvent !== 'undefined') {
                candidate.dispatchEvent(new PointerEvent('pointerdown', opts));
                candidate.dispatchEvent(new PointerEvent('mousedown', opts));
                candidate.dispatchEvent(new PointerEvent('pointerup', opts));
                candidate.dispatchEvent(new PointerEvent('mouseup', opts));
              } else {
                candidate.dispatchEvent(new MouseEvent('mousedown', opts));
                candidate.dispatchEvent(new MouseEvent('mouseup', opts));
              }

              candidate.click();

              if (stopMonitoring) {
                stopMonitoring();
              }

              return { clicked: true, button: candidate };
            }
          }
          return { clicked: false, button: null };
        };

        const submitChatGPT = (stopMonitoring?: () => void): boolean => {
          const textareaSelectors = [
            '#prompt-textarea',
            'textarea[data-id="root"]',
            'textarea[id="prompt-textarea"]',
            'div[contenteditable="true"]',
            'textarea',
          ];

          let node: HTMLTextAreaElement | HTMLInputElement | HTMLElement | null = null;
          let isContentEditable = false;

          for (const selector of textareaSelectors) {
            const found = document.querySelector(selector) as HTMLElement | null;
            if (found) {
              node = found;
              isContentEditable =
                (found as HTMLElement).isContentEditable || found.getAttribute('contenteditable') === 'true';
              break;
            }
          }

          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

          if (!node) {
            return false;
          }

          if (imagesFromExtension && imagesFromExtension.length > 0 && !imageUploadAttempted) {
            if (fileInput) {
              try {
                const dataTransfer = new DataTransfer();
                for (const img of imagesFromExtension) {
                  const file = dataURLtoFile(img.base64, img.filename);
                  dataTransfer.items.add(file);
                }
                fileInput.files = dataTransfer.files;
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                fileInput.dispatchEvent(new Event('input', { bubbles: true }));
                imageUploadAttempted = true;
                lastImageUpload = Date.now();
                return false;
              } catch (e) {
                console.error('[auto-submit][chatgpt] ERROR: Image injection failed', e);
                imageUploadAttempted = true;
              }
            } else {
              if (!(window as any)[timestampKey + '-imageStart']) {
                (window as any)[timestampKey + '-imageStart'] = Date.now();
              }
              const elapsed = Date.now() - (window as any)[timestampKey + '-imageStart'];
              if (elapsed > 10000) {
                console.warn('[auto-submit][chatgpt] File input not found after 10s, skipping image upload');
                imageUploadAttempted = true;
              } else {
                return false;
              }
            }
          }

          const now = Date.now();
          const timeSinceImageUpload = now - lastImageUpload;

          if (
            imagesFromExtension &&
            imagesFromExtension.length > 0 &&
            imageUploadAttempted &&
            timeSinceImageUpload < 3000
          ) {
            return false;
          }

          const getCurrentValue = (): string => {
            if (isContentEditable) return (node as HTMLElement).innerText || (node as HTMLElement).textContent || '';
            return (node as HTMLTextAreaElement).value || '';
          };

          const setCurrentValue = (value: string) => {
            node?.focus();
            const el = node as HTMLElement;

            const dispatchStandardEvents = () => {
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            };

            if (getCurrentValue().trim()) {
              if (isContentEditable) {
                document.execCommand('selectAll', false);
                document.execCommand('delete', false);
              } else {
                (el as HTMLInputElement).value = '';
              }
            }

            try {
              const dataTransfer = new DataTransfer();
              dataTransfer.setData('text/plain', value);
              const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: dataTransfer,
              });
              el.dispatchEvent(pasteEvent);
            } catch (e) {}

            if (getCurrentValue().trim() === value.trim()) {
              dispatchStandardEvents();
              return;
            }

            if (isContentEditable) {
              if (el.innerText !== value) el.innerText = '';

              const sel = window.getSelection();
              if (sel) {
                const range = document.createRange();
                range.selectNodeContents(el);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
              }

              el.dispatchEvent(new Event('compositionstart', { bubbles: true }));
              el.dispatchEvent(new Event('keydown', { bubbles: true }));
              el.dispatchEvent(new Event('keypress', { bubbles: true }));

              const success = document.execCommand('insertText', false, value);

              el.dispatchEvent(new Event('textInput', { bubbles: true }));
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('keyup', { bubbles: true }));
              el.dispatchEvent(new Event('compositionend', { bubbles: true }));

              if (!success || el.innerText !== value) {
                el.innerText = value;
                dispatchStandardEvents();
              }
            } else {
              const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype,
                'value',
              )?.set;
              if (nativeTextAreaValueSetter) {
                nativeTextAreaValueSetter.call(el, value);
              } else {
                (el as HTMLTextAreaElement).value = value;
              }
              dispatchStandardEvents();
            }
          };

          const currentValue = getCurrentValue();
          if (currentValue.trim() !== resolvedPrompt.trim()) {
            setCurrentValue(resolvedPrompt);
            lastTextUpdate = Date.now();
            return false;
          }

          const timeSinceTextUpdate = now - lastTextUpdate;
          if (timeSinceTextUpdate < 1000) return false;

          const buttonSelectors = [
            'button[data-testid="send-button"]',
            'button[data-testid="fruitjuice-send-button"]',
            'button[aria-label="Send prompt"]',
            'button[aria-label="Send message"]',
            'button[type="submit"]',
          ];

          let foundButton: HTMLButtonElement | null = null;
          for (const selector of buttonSelectors) {
            const btn = document.querySelector(selector) as HTMLButtonElement | null;
            if (btn) {
              foundButton = btn;
              break;
            }
          }

          if (foundButton) {
            if (!foundButton.disabled) {
              if (Date.now() - lastSubmitClick < 1500) return false;
              foundButton.click();
              lastSubmitClick = Date.now();
              if (stopMonitoring) stopMonitoring();
              return true;
            } else {
              const timeoutThreshold = imagesFromExtension && imagesFromExtension.length > 0 ? 12000 : 4000;
              if (imagesFromExtension && imagesFromExtension.length > 0 && now - lastImageUpload < timeoutThreshold)
                return false;

              if (now - lastTextUpdate < timeoutThreshold) return false;
            }
          } else {
            const enterEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true,
            });
            node?.dispatchEvent(enterEvent);
            if (stopMonitoring) stopMonitoring();
            return true;
          }

          return false;
        };

        const attemptSubmission = (stopMonitoring?: () => void) => {
          const success = submitChatGPT(stopMonitoring);
          if (success) {
            (window as any)[markKey] = true;
            (window as any)[timestampKey] = Date.now();
          }
          return success;
        };

        const hasContent = () => {
          const textareaSelectors = [
            '#prompt-textarea',
            'textarea[data-id="message-textarea"]',
            'textarea[aria-label*="Message"]',
            'form textarea',
            'textarea',
          ];
          for (const selector of textareaSelectors) {
            const textarea = document.querySelector(selector) as HTMLTextAreaElement | HTMLElement | null;
            if (textarea) {
              if ((textarea as HTMLTextAreaElement).value !== undefined) {
                if ((textarea as HTMLTextAreaElement).value.trim().length > 0) return true;
              } else if (textarea.textContent && textarea.textContent.trim().length > 0) {
                return true;
              }
            }
          }
          return false;
        };

        const start = Date.now();
        const maxDuration = imagesFromExtension && imagesFromExtension.length > 0 ? 300000 : 60000;
        let attemptCount = 0;
        let textWasEverSet = false;

        let lastAttemptCountLog = 0;
        const scheduleNextAttempt = () => {
          attemptCount++;

          let delay = 100;
          if (attemptCount > 40) delay = 1000;
          else if (attemptCount > 20) delay = 500;

          if (attemptCount - lastAttemptCountLog >= 50) {
            lastAttemptCountLog = attemptCount;
          }

          (window as any)[timestampKey + '-interval'] = window.setTimeout(() => {
            if (textWasEverSet && !hasContent()) {
              stopMonitoring();
              return;
            }

            const requestIdle = window.requestIdleCallback || ((cb: Function) => window.setTimeout(cb, 1));
            requestIdle(() => {
              const result = attemptSubmission(stopMonitoring);

              if (!textWasEverSet && hasContent()) {
                textWasEverSet = true;
              }

              if (result) {
                stopMonitoring();
                return;
              }

              if (Date.now() - start > maxDuration) {
                stopMonitoring();
                return;
              }

              scheduleNextAttempt();
            });
          }, delay);
        };

        scheduleNextAttempt();

        window.setTimeout(() => {
          if (attemptSubmission(stopMonitoring)) {
            stopMonitoring();
          }
        }, 50);
      },
    });
  } catch (error) {
    console.error('[auto-submit] failed to execute script for ChatGPT', error);
  }
}
