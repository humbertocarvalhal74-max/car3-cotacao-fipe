import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'CAR3 Cotação FIPE', description: 'Fundação técnica CAR3',
};
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
