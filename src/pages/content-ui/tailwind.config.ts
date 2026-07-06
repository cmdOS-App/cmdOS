import baseConfig from '@extension/tailwindcss-config';
import { withUI } from '@extension/ui';

export default withUI({
  ...baseConfig,
  content: ['./src/**/*.{ts,tsx}', '../AltS_search_newtab/src/components/Shared/GlobalCreateMenuModal.tsx'],
});
