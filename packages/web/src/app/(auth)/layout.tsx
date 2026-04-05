export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-card border border-border bg-surface-card p-6 shadow-sm">
        {children}
      </div>
    </main>
  );
}
