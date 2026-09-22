import './globals.css';
import './research.css';
import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { Header } from '@/components/Header';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-space-grotesk',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://valuearena.github.io'),
  title: 'ValueArena',
  description: 'Explore model values with EigenBench: published rankings, uncertainty, and the judgments behind them. A project of LAISR Lab.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/laisr-icon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'ValueArena',
    description: 'Language model values, rankings, and the responses and judgments behind EigenBench evaluations.',
    siteName: 'ValueArena',
    type: 'website',
    images: [{ url: '/laisr-preview.png', width: 1200, height: 630, alt: 'LAISR Lab pixel logo' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ValueArena',
    description: 'Language model values, rankings, and the responses and judgments behind EigenBench evaluations.',
    images: ['/laisr-preview.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Hydrate theme before paint to avoid flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('va-theme');if(t!=='dark'){t='light';}document.documentElement.dataset.theme=t;}catch(e){}})();",
          }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <Header />
        <main id="main-content" className="va-main">{children}</main>
      </body>
    </html>
  );
}
