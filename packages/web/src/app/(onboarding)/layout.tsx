// Minimal full-screen shell for the first-run flow. No navbar on purpose, since
// the welcome flow lives outside the app chrome, which is why it can't sit under (app).
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-6">{children}</main>
  );
}
