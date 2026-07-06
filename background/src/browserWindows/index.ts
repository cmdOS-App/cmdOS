/**
 * @file index.ts
 * @description Central message routing for browser window and tab operations.
 * Delegates incoming Chrome extension messages to specific session or tab handlers.
 */

import { handleLinksMessage } from './linksRuntimeEngine';
import { handleAiTabMessage } from './chatRuntimeEngine';
import { handleSessionMessage } from './sessions';

/**
 * Routes incoming browser window/tab related messages to their respective handlers.
 *
 * @param request The message payload sent from the client/content script.
 * @param sender The sender information.
 * @param sendResponse The callback to send a response back.
 * @returns {boolean | undefined} True if the message requires an asynchronous response.
 */
export function handleBrowserWindowMessage(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void,
): boolean | undefined {
  if (handleLinksMessage(request, sender, sendResponse)) return true;
  if (handleAiTabMessage(request, sender, sendResponse)) return true;
  if (handleSessionMessage(request, sender, sendResponse)) return true;

  return undefined;
}

export * from './sessions';
export * from './chatRuntimeEngine';
export * from './linksRuntimeEngine';
