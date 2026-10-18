import { defineRouting } from 'next-intl/routing';

/** URL language codes. Chinese uses the zh-Hans message file (Simplified). */
export const routing = defineRouting({
  locales: ['en', 'tl', 'zh'],
  defaultLocale: 'en',
});

export const MESSAGE_FILE: Record<string, string> = { en: 'en', tl: 'tl', zh: 'zh-Hans' };
