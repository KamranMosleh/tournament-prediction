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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
