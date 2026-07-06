/**
 * @file auth.ts
 * @description Background service manager for handling authentication status checks
 * and proxying HTTP requests to avoid Cross-Origin Resource Sharing (CORS) restrictions.
 */
import { nowUtc } from '../../../../src/shared-components/utils';

import { SUPABASE_BASE_URL, SUPABASE_ANON_TOKEN } from '@config/config';

/**
 * Handles incoming authentication and network messages from the content scripts or popup.
 *
 * Supports actions:
 * - `check_auth`: Retrieves active session information from local storage.
 * - `http_fetch`: Proxies HTTP requests to the Supabase backend with anon headers to bypass CORS.
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
        console.log('[AuthManager] Successfully received and saved token from content script');
        sendResponse({ success: true });
      })
      .catch(err => {
        console.error('[AuthManager] Failed to save token from content script', err);
        sendResponse({ success: false, error: String(err) });
      });
    return true; // Keep channel open for async response
  }

  // Proxy fetch for content scripts to avoid CORS: request: { action: 'http_fetch', path, method?, headers?, body? }
  if (request.action === 'http_fetch') {
    const BASE_URL = SUPABASE_BASE_URL;
    const TOKEN = SUPABASE_ANON_TOKEN;

    const url = (request.url as string) || `${BASE_URL}${request.path || ''}`;
    const method = (request.method as string) || 'GET';
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      ...(request.headers || {}),
    } as Record<string, string>;

    const fetchInit: RequestInit = {
      method,
      headers,
      body: request.body ? JSON.stringify(request.body) : undefined,
    };

    fetch(url, fetchInit)
      .then(async resp => {
        const contentType = resp.headers.get('content-type') || '';
        const data = contentType.includes('application/json') ? await resp.json() : await resp.text();
        sendResponse({ ok: resp.ok, status: resp.status, data });
      })
      .catch(err => {
        console.error('http_fetch error:', err);
        sendResponse({ ok: false, status: 0, error: String(err) });
      });
    return true; // async
  }

  return undefined;
}

// Listen for external messages from the cmdOS web application
if (chrome.runtime.onMessageExternal) {
  chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    // Only accept messages from allowed origins specified in manifest.json (externally_connectable)
    if (request.type === 'auth_token' && request.payload) {
      chrome.storage.local
        .set({
          accessToken: request.payload.userId,
          profileImg: request.payload.profileImageUrl,
          loggedIn: true,
        })
        .then(() => {
          console.log('[AuthManager] Successfully received and saved auth_token from web app');
          sendResponse({ status: 'success' });
        })
        .catch(err => {
          console.error('[AuthManager] Failed to save token from web app', err);
          sendResponse({ status: 'error', error: String(err) });
        });
      return true; // Keep channel open for async response
    }

    if (request.type === 'sign_out' || request.action === 'logout_success') {
      const keysToRemove = [
        'accessToken',
        'profileImg',
        'loggedIn',
        'user_name',
        'user_email',
        'myCachedAllData',
        'orgRefreshCounters',
        'last_org_counter_check_timestamp',
        'last_org_counter_check_result',
      ];
      chrome.storage.local
        .remove(keysToRemove)
        .then(() => {
          console.log('[AuthManager] Successfully logged out via web app');
          sendResponse({ status: 'success' });
        })
        .catch(err => {
          sendResponse({ status: 'error', error: String(err) });
        });
      return true;
    }

    // Default return for unrecognized messages
    return false;
  });
}
