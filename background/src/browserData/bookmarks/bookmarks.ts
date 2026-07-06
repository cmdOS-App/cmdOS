/**
 * @file bookmarks.ts
 * @description Background service handler for interacting with Chrome's native Bookmarks API.
 */

/**
 * Message handler for bookmark queries. Supports basic searching and retrieving
 * the entire bookmark tree structure with folder paths.
 *
 * @param request The message payload (actions: `search_bookmarks`, `bookmarks_search`, `bookmarks_get_tree`).
 * @param sender Information about the script context that sent the message.
 * @param sendResponse Callback function to send a JSON response back to the caller.
 * @returns {boolean | undefined} Returns true if the message handler is responding asynchronously.
 */
export function handleBookmarksSearch(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void,
): boolean | undefined {
  if (request.action === 'search_bookmarks') {
    chrome.bookmarks.search(request.query, results => {
      sendResponse(results || []);
    });
    return true;
  }

  if (request.action === 'bookmarks_search') {
    const query = (request.query as string) || '';

    if (!chrome.bookmarks?.search) {
      sendResponse({ ok: false, results: [], error: 'bookmarks_api_unavailable' });
      return false; // synchronous
    }
    try {
      chrome.bookmarks.search(query, nodes => {
        const results = (nodes || [])
          .filter(n => !!n.url)
          .map(n => ({ id: n.id, title: n.title || n.url || '', url: n.url || '' }));

        sendResponse({ ok: true, results });
      });
      return true; // async
    } catch (err) {
      sendResponse({ ok: false, results: [], error: String(err) });
      return false; // synchronous
    }
  }

  // Bookmarks get tree - returns all bookmarks with folder paths for content scripts
  if (request.action === 'bookmarks_get_tree') {
    if (!chrome.bookmarks?.getTree) {
      sendResponse({ ok: false, results: [], error: 'bookmarks_api_unavailable' });
      return false;
    }
    try {
      chrome.bookmarks.getTree(tree => {
        const results: Array<{ id: string; title: string; url: string; folderPath: string }> = [];

        const traverse = (nodes: chrome.bookmarks.BookmarkTreeNode[], path: string[] = []) => {
          for (const node of nodes) {
            if (node.url) {
              results.push({
                id: node.id,
                title: node.title || node.url,
                url: node.url,
                folderPath: path.join(' / ') || 'Bookmarks',
              });
            }
            if (node.children) {
              traverse(node.children, node.parentId === '0' ? [] : [...path, node.title]);
            }
          }
        };

        traverse(tree[0]?.children || []);
        sendResponse({ ok: true, results });
      });
      return true; // async
    } catch (err) {
      sendResponse({ ok: false, results: [], error: String(err) });
      return false;
    }
  }

  return undefined;
}
