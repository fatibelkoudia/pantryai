import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PantryAI',
  description: 'Intelligent food stock management and waste reduction',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
