import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing, MESSAGE_FILE } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return { locale, messages: (await import(`../messages/${MESSAGE_FILE[locale]}.json`)).default };
});
