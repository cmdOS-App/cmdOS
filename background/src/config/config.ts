/**
 * @file config.ts
 * @description Configuration settings for the Chrome Extension background script.
 * Defines essential constants such as base domains, URLs for external
 * services, and Supabase authentication details required for API communication.
 */

import { SUPABASE_BASE_URL as BASE_URL, SUPABASE_TOKEN } from '../../../src/storage/_private/API/core/apiConfig';

/** The core domain used by the application */
export const CMD_DOMAIN = 'cmdos.app';

/** The base URL for the command OS application */
export const CMD_URL = `https://${CMD_DOMAIN}`;

/** The installation page URL for the CMDOS application */
export const CMDOS_INSTALL_URL = `https://www.${CMD_DOMAIN}/install`;

/** The base URL for Supabase Edge Functions */
export const SUPABASE_BASE_URL = `${BASE_URL}/functions/v1`;

/** The anonymous token used for authenticating requests to Supabase */
export const SUPABASE_ANON_TOKEN = SUPABASE_TOKEN;
