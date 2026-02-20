import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Outfit } from 'next/font/google'

import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-serif',
})

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: '루카바둑 | LUCA BADUK',
  description: '기존 바둑에 새로움을 더한 루카바둑을 소개하고, 연구하며, 교육합니다.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className={`${outfit.variable} ${plusJakarta.variable} font-sans antialiased`}>{children}</body>
    </html>
  )
}
