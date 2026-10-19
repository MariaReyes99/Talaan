import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '../../i18n/routing';

export const metadata: Metadata = {
  title: 'Talaan',
  description: 'Talaan: Philippine payroll and compliance for bookkeeping firms. Every payslip. Every deadline.',
  icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
};
export const viewport: Viewport = { themeColor: '#0B2350' };

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return (
    <html lang={locale === 'zh' ? 'zh-Hans' : locale}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
