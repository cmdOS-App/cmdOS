/**
 * @file visualPicker.ts
 * @description Background message handler for the visual element picker feature.
 * Facilitates communication between the popup/sidebar and the content script
 * to enable users to visually select DOM elements for automations.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createNotification } from '@notifications/notifications';

/**
 * Handles incoming messages related to the visual element picker.
 * Triggers the picker in the content script and stores the resulting selection in local storage.
 *
 * @param request The message payload.
 * @param sender The sender information.
 * @param sendResponse Callback for asynchronous responses.
 * @returns {boolean | undefined} True if handled, false otherwise.
 */
export const handleElementPickerMessage = (
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void,
): boolean | undefined => {
  if (request.action === 'start_selector_mode') {
    chrome.storage.local.set(
      {
        pending_automation_state: request.payload,
      },
      () => {},
    );

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs.length > 0 && tabs[0].id) {
        const tabId = tabs[0].id;
        chrome.tabs.sendMessage(tabId, { action: 'init_picker' });
      }
    });
    return true;
  }

  if (request.action === 'element_selected') {
    chrome.storage.local.set(
      {
        pending_selection: request.payload,
      },
      () => {
        createNotification(null, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icon.png'),
          title: 'Element Selected',
          message: `Selected: ${request.payload.name}. Open Alt+S to continue.`,
        });
      },
    );
    return true;
  }
  return false;
};
