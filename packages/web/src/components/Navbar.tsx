'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const LINKS = [
  { href: '/stocks', label: 'My stock' },
  { href: '/stocks/new', label: 'Add item' },
  { href: '/scan', label: 'Scan receipt' },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <nav aria-label="Main" className="border-b border-border bg-surface-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/stocks" className="text-lg font-bold text-brand">
            PantryAI
          </Link>
          <ul className="flex items-center gap-4 text-sm">
            {LINKS.map((link) => {
              const active = pathname === link.href;
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
        <div className="flex items-center gap-3 text-sm">
          {user?.email ? <span className="text-slate-500">{user.email}</span> : null}
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-md border border-border px-3 py-1 font-medium hover:bg-slate-50"
          >
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}
