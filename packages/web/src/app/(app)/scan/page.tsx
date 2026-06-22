'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ReceiptUploader } from '@/components/ReceiptUploader';

export default function ScanPage() {
  const { t } = useTranslation();
  return (
    <section className="mx-auto flex max-w-xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{t('scan.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('scan.subtitle')}</p>
      </header>

      <ReceiptUploader />

      <Link href="/stocks" className="text-sm font-medium text-brand hover:underline">
        {t('scan.back')}
      </Link>
    </section>
  );
}
