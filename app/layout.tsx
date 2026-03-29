import type { Metadata } from 'next'
import { Syne, DM_Sans } from 'next/font/google'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-syne',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-dm',
})

export const metadata: Metadata = {
  title: 'MyDawai — Same Salt. Better Price.',
  description:
    'Find cheaper generic alternatives to your medicine. Compare prices by salt composition. Built for India.',
  keywords: 'generic medicine, cheaper alternatives, medicine price comparison, India',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable}`}>
      <body className="bg-white font-sans antialiased">{children}</body>
    </html>
  )
}