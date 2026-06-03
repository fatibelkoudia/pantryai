'use client';

import Link from 'next/link';
import { ReceiptUploader } from '@/components/ReceiptUploader';

export default function ScanPage() {
  return (
    <section className="mx-auto flex max-w-xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Scan a receipt</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload a receipt photo or PDF and we&apos;ll extract the items and add them to your stock.
        </p>
      </header>

      <ReceiptUploader />

      <Link href="/stocks" className="text-sm font-medium text-brand hover:underline">
        ← Back to my stock
      </Link>
    </section>
  );
}
