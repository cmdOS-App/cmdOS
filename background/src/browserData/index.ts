/**
 * @file index.ts
 * @description Central message router for browser data (history and bookmarks) features.
 */

import { handleHistorySearch } from './history/history';
import { handleBookmarksSearch } from './bookmarks/bookmarks';

/**
 * Routes search and retrieval messages for browser history and bookmarks
 * to their respective module handlers.
 *
 * @param request The message payload sent from the client or content script.
 * @param sender Information about the script context that sent the message.
 * @param sendResponse Callback function to send a JSON response back to the caller.
 * @returns {boolean | undefined} Returns true if the message handler is responding asynchronously.
 */
export function handleSearchMessage(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void,
): boolean | undefined {
  if (handleHistorySearch(request, sender, sendResponse)) return true;
  if (handleBookmarksSearch(request, sender, sendResponse)) return true;

  return undefined;
}
