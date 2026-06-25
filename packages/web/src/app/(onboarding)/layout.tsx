// Minimal full-screen shell for the first-run flow. No navbar on purpose, since
// the welcome flow lives outside the app chrome, which is why it can't sit under (app).
// No background here either: the body already paints the cream, and an opaque main
// would cover the fixed aurora blobs the welcome page puts behind itself.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center p-6">{children}</main>;
}
