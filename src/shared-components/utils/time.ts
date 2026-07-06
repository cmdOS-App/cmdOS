import { useState, useEffect } from 'react';

export function nowUtc(): string {
  return new Date().toISOString();
}

/**
 * Returns a relative format for the last saved time.
 */
export const formatRelativeSavedTime = (date: Date | null | undefined): string => {
  if (!date) return 'Saved';
  
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 5) return 'Saved just now';
  if (seconds < 60) return `Saved ${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Saved ${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Saved ${hours}h ago`;
  
  return `Saved at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

/**
 * React hook that returns a reactively updating relative saved time string.
 */
export function useRelativeSavedTime(lastSavedAt: Date | null | undefined): string {
  const [formatted, setFormatted] = useState(() => formatRelativeSavedTime(lastSavedAt));

  useEffect(() => {
    // Update immediately when the lastSavedAt changes
    setFormatted(formatRelativeSavedTime(lastSavedAt));

    if (!lastSavedAt) return undefined;

    // Check and update every 5 seconds to keep the relative string fresh
    const interval = setInterval(() => {
      setFormatted(formatRelativeSavedTime(lastSavedAt));
    }, 5000);

    return () => clearInterval(interval);
  }, [lastSavedAt]);

  return formatted;
}
