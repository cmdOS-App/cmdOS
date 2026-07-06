import type React from 'react';
import { useEffect, useState } from 'react';

interface SnippetPopupIframeWindowProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'createlinks' | 'createsession' | 'createnotes' | 'createsnippet' | 'createtodo';
}

export const SnippetPopupIframeWindow: React.FC<SnippetPopupIframeWindowProps> = ({ isOpen, onClose, type }) => {
  const [iframeUrl, setIframeUrl] = useState('');

  console.log(
    '[ContentUI] SnippetPopupIframeWindow rendering. isOpen:',
    isOpen,
    'type:',
    type,
    'iframeUrl:',
    iframeUrl,
  );

  useEffect(() => {
    if (isOpen) {
      const extensionId = chrome.runtime.id;
      const base = `chrome-extension://${extensionId}/AltS_search_newtab/index.html`;
      const urlParams = new URLSearchParams();
      urlParams.set('open_sheet', type);
      urlParams.set('embed', 'true');
      urlParams.set('active_tab_url', window.location.href);
      urlParams.set('active_tab_title', document.title);

      const targetUrl = `${base}?${urlParams.toString()}`;
      console.log('[ContentUI] SnippetPopupIframeWindow generating URL:', targetUrl);
      setIframeUrl(targetUrl);
    } else {
      setIframeUrl('');
    }
  }, [isOpen, type]);

  // Listen for close/cancel actions inside the iframe via window postMessage
  useEffect(() => {
    const handleIframeMessage = (event: MessageEvent) => {
      if (event.data && event.data.type) {
        console.log('[ContentUI] Received message from iframe:', event.data);
      }
      if (event.data && event.data.type === 'tasklabs:close-embed-creator') {
        console.log('[ContentUI] Closing iframe drawer');
        onClose();
      }
    };
    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200000] flex items-center justify-center bg-black/45 backdrop-blur-[2px] font-sans pointer-events-auto"
      onClick={onClose}>
      <div className="w-full h-full flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {iframeUrl && (
          <iframe
            src={iframeUrl}
            className="w-full h-full border-none bg-transparent"
            title="Create Item"
            allow="clipboard-write"
          />
        )}
      </div>
    </div>
  );
};
