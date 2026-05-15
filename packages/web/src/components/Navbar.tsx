'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// The five Trashy pillars. Scan and Shopping list aren't pillars; they're reached
// from inside Home/Inventory instead of the top nav. Log out lives on Profile.
const LINKS = [
  { href: '/home', label: 'Home' },
  { href: '/stocks', label: 'Inventory' },
  { href: '/recipes', label: 'Meal Ideas' },
  { href: '/learn', label: 'Learn' },
  { href: '/profile', label: 'Profile' },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="border-b border-border bg-surface-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/home" className="text-lg font-extrabold tracking-tight text-brand">
          Trashy
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
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
