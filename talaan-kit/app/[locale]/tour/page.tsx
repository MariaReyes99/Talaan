import { getTranslations, setRequestLocale } from 'next-intl/server';
import TalaTour from '../../../components/tour/TalaTour';
import '../../../components/tour/tour.css';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'controls' });
  return { title: t('tourTitle') };
}

export default async function TourPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TalaTour />;
}
