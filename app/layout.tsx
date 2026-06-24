import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tournament Predictor',
  description: 'Predict match scores, compete with friends on the leaderboard.',
  metadataBase: new URL('https://tournament-predictor.vercel.app'),
  openGraph: {
    title: 'Tournament Predictor',
    description: 'Predict every score. Compete with friends.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0d1117',
}

const themeInitScript = `
(function () {
  try {
    var storageKey = 'theme';
    var darkColor = '#0d1117';
    var lightColor = '#f6f8fa';
    var saved = localStorage.getItem(storageKey);
    var theme = saved === 'light' || saved === 'dark' ? saved : 'dark';
    var root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    function updateThemeColor() {
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', theme === 'light' ? lightColor : darkColor);
    }
    updateThemeColor();
    document.addEventListener('DOMContentLoaded', updateThemeColor);
  } catch (_) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
