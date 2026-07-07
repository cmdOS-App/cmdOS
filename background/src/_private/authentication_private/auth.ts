/**
 * @file auth.mock.ts
 * @description Mocked background service manager for handling authentication status checks
 * and stubbing network requests.
 */
import { nowUtc } from '../../../../src/shared-components/utils';

/**
 * Handles incoming authentication and network messages from the content scripts or popup.
 *
 * Supports actions:
 * - `check_auth`: Retrieves active session information from local storage.
 *
 * @param request The message payload sent by the calling script.
 * @param sender Details about the script/tab that sent the message.
 * @param sendResponse Callback function to send a JSON response back to the caller.
 * @returns {boolean | undefined} Returns true if the response is asynchronous, otherwise undefined.
 */
export function handleAuthMessage(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void,
): boolean | undefined {
  if (request.action === 'check_auth') {
    chrome.storage.local.get(['accessToken', 'loggedIn'], function (result) {
      sendResponse({
        isLoggedIn: !!result.loggedIn,
        userId: result.accessToken,
        timestamp: nowUtc(),
      });
    });
    return true; // Keep the message channel open for async response
  }

  // Handle login from content script
  if (request.action === 'login_success' && request.token) {
    chrome.storage.local
      .set({
        accessToken: request.token,
        loggedIn: true,
      })
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(err => {
        sendResponse({ success: false, error: String(err) });
      });
    return true; // Keep channel open for async response
  }

  return undefined;
}
