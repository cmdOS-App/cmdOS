export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export const getUserId = async (): Promise<string> => {
  return 'local_user';
};

export const getUserName = async (): Promise<string> => {
  const result = await chrome.storage.local.get('user_name');
  const userName = result.user_name;

  if (!userName || typeof userName !== 'string') {
    return 'Local User';
  }

  return userName;
};
