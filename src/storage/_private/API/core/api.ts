import { getUserId, getUserName, AuthError } from './identity';
export { getUserId, getUserName, AuthError };

// ─── All other APIs removed — stubbed as no-ops to prevent import errors ─────

export const fetchTeams = async () => null;
export const fetchFolders = async (_org_id: string | null, _workspace_id: string | null) => null;
export const getAll = async (_force?: boolean, _isBackground?: boolean): Promise<any[]> => [];

export const getUserInfo = async (_userId: string): Promise<any> => null;

export interface SubscriptionRecord {
  org_id: string;
  organization_id?: string;
  stripe_user_id?: string | null;
  status?: string;
}

export const getActiveSubscriptions = async (_userId: string, _orgId?: string): Promise<SubscriptionRecord[]> => [];

export interface CreateCheckoutSessionPayload {
  user_id: string;
  checkout_type: 'main_subscription' | 'recharge_credits';
  price_id: string;
  success_url: string;
  cancel_url: string;
  quantity?: number;
  customer_email?: string;
  metadata?: Record<string, string>;
  team?: { organization_name: string; free_org_id?: string };
  recharge?: { parent_subscription_id: string; parent_plan_id: string };
}

export interface CheckoutSessionResponse {
  success?: boolean;
  checkout_type?: 'main_subscription' | 'recharge_credits';
  checkout_url?: string;
  url?: string;
  session_id?: string;
  mode?: 'payment' | 'subscription';
}

export const createCheckoutSession = async (_payload: CreateCheckoutSessionPayload): Promise<CheckoutSessionResponse> => ({});

export const syncCounterStats = async (_userId: string, _payload: any) => null;

export const createAutomation = async (_data: any, _storageMode?: 'local' | 'cloud') => null;
export const updateAutomation = async (_data: any, _storageMode?: 'local' | 'cloud') => null;
export const deleteAutomation = async (_id: number, _storageMode?: 'local' | 'cloud') => null;

export const getModuleCatalog = async (): Promise<any[]> => [];
export const syncInstalledModulesToStorage = async (): Promise<any[]> => [];
export const installModule = async (_moduleId: string, _options?: any) => null;
export const uninstallModule = async (_moduleId: string) => null;
export const updateInstallation = async (_moduleId: string, _installationId: number, _data: any) => null;
export const getInstalledModules = async (): Promise<any[]> => [];
export const getFavoritedModules = async (_userId: string): Promise<any[]> => [];
export const fetchModuleMetadata = async (): Promise<any[]> => [];
export const assignModuleHotkey = async (_moduleId: string, _hotkey: string) => null;
export const removeModuleHotkey = async (_moduleId: string, _hotkey?: string) => null;
export const favoriteModule = async (_moduleId: string) => null;
export const resetAllSyncTimers = async () => {};

export const getOrgUserDetail = async (_orgId: string, _userId: string): Promise<any> => null;
export const getMembersInOrganization = async (_orgId: string): Promise<any> => [];
export const removeMemberFromOrganization = async (_orgId: string, _userId: string): Promise<any> => null;
export const getUsageData = async (_userId: string, _year: number, _month: number): Promise<any> => null;
