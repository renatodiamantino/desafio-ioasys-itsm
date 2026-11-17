import type { Metadata } from 'next';
import './globals.css';
import { LocaleProvider } from '@/components/locale-provider';

export const metadata: Metadata = {
  title: 'ITSM Platform',
  description: 'Plataforma de Gestão de Serviços de TI',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
