/**
 * @file index.ts
 * @description Central message router for pre-built extraction commands.
 */
import { handleTextScraperMessage } from './textExtractor';
import { handleImagesCommand } from './imageExtractor';
import { handleScreenshotCommand } from './screenshotExtractor';
import { handleTablesCommand } from './tableExtractor';

/**
 * Routes extraction command messages to their respective module handlers.
 *
 * @param request The message payload sent from the client or content script.
 * @param sender Information about the script context that sent the message.
 * @param sendResponse Callback function to send a JSON response back to the caller.
 * @returns {boolean | undefined} Returns true if the message handler is responding asynchronously.
 */
export function handleExtractorMessage(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void,
): boolean | undefined {
  if (handleTextScraperMessage(request, sender, sendResponse)) return true;
  if (handleImagesCommand(request, sender, sendResponse)) return true;
  if (handleScreenshotCommand(request, sender, sendResponse)) return true;
  if (handleTablesCommand(request, sender, sendResponse)) return true;
  return undefined;
}
