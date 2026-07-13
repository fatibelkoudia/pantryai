'use client';

import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import trashyExcellent from '../../../../shared/src/assets/mascot/trashy_excellent.png';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const bullets = [
    t('onboarding.slides.scanTitle'),
    t('onboarding.slides.trackTitle'),
    t('onboarding.slides.cookTitle'),
  ];

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel, hidden on small screens where the card is all there's room for. */}
      <aside className="hidden flex-col items-center justify-center gap-6 bg-mint-hero p-10 lg:flex">
        <Image src={trashyExcellent} alt="" width={200} height={200} priority />
        <h1 className="text-3xl font-extrabold text-brand-deep">PantryAI</h1>
        <ul className="flex flex-col gap-3">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-center gap-3 text-charcoal">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-hidden />
              <span className="font-semibold">{bullet}</span>
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-card border border-border bg-surface-card p-6 shadow-sm">
          {children}
        </div>
      </div>
    </main>
  );
}
