'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';

// The five Trashy pillars. Scan and Shopping list aren't pillars; they're reached
// from inside Home/Inventory instead of the top nav. Log out lives on Profile.
const LINKS = [
  { href: '/home', label: 'nav.home' },
  { href: '/stocks', label: 'nav.inventory' },
  { href: '/recipes', label: 'nav.mealIdeas' },
  { href: '/learn', label: 'nav.learn' },
  { href: '/profile', label: 'nav.profile' },
] as const;

export function Navbar() {
  const { t } = useTranslation();
  const pathname = usePathname();

  return (
    <nav aria-label={t('nav.mainA11y')} className="border-b border-border bg-surface-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/home" className="text-lg font-extrabold tracking-tight text-brand">
          {t('nav.brand')}
        </Link>
        <ul className="flex items-center gap-4 text-sm">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={
                    active ? 'font-semibold text-brand' : 'text-slate-600 hover:text-slate-900'
                  }
                >
                  {t(link.label)}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
