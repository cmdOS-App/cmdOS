export const getUserId = async (): Promise<string> => 'local_user';
export const getUserName = async (): Promise<string> => 'Local User';
export class AuthError extends Error {}

// ─── All other APIs removed — stubbed as no-ops to prevent import errors ─────

export const getUserInfo = async (_userId: string): Promise<any> => null;
export const CMDOS_SIGN_UP_URL = '';
export const CMDOS_SIGN_IN_URL = '';
export const CMDOS_DASHBOARD_URL = '';
export const CMDOS_PROFILE_URL = '';
export const CMDOS_SUBSCRIPTION_URL = '';

export const migrateCloudToLocal = async () => ({
  success: false,
  message: 'Feature not supported in open source.',
  counts: { workspaces: 0, folders: 0, notes: 0, links: 0, todos: 0, snippets: 0, automations: 0 }
});

export const checkHasCloudData = async (): Promise<boolean> => false;
