import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Fugaz_One, Work_Sans } from 'next/font/google'
import './globals.css'

const fugazOne = Fugaz_One({
  variable: '--font-fugaz-one',
  subsets: ['latin'],
  weight: '400',
})

const workSans = Work_Sans({
  variable: '--font-work-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Morchi — Indumentaria esencial',
  description: 'Indumentaria contemporánea hecha para moverte.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`${fugazOne.variable} ${workSans.variable} antialiased`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
