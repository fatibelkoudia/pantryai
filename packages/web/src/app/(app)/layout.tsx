import { AppShell } from './app-shell';

// These pages are gated by an in-memory access token and fetch all data client-side, so there
// is nothing to statically prerender. Opt the whole group out of build-time static generation.
export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
