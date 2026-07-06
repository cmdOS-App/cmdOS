import { db } from '../indexDB/dbConfig';

const TUTORIAL_WATCHED_KEY = 'tutorial_watched';

/**
 * Checks if the onboarding is completed.
 * Onboarding is completed if:
 * 1. At least one workspace exists in IndexedDB (db.workspaces).
 * 2. The tutorial has been watched (tutorial_watched is true in chrome.storage.local).
 */
export async function isOnboardingCompleted(): Promise<boolean> {
  try {
    // 1. Check if at least one workspace exists in Dexie
    const workspacesCount = await db.workspaces.count();
    if (workspacesCount === 0) {
      return false;
    }

    // 2. Check if the tutorial has been watched
    let tutorialWatched = false;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get([TUTORIAL_WATCHED_KEY]);
      tutorialWatched = !!data[TUTORIAL_WATCHED_KEY];
    } else {
      tutorialWatched = localStorage.getItem(TUTORIAL_WATCHED_KEY) === 'true';
    }

    return tutorialWatched;
  } catch (error) {
    console.error('[onboardingStorage] Error checking onboarding status:', error);
    return false;
  }
}
