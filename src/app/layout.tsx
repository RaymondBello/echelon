import './globals.css'
import type { Metadata } from 'next'
import { Inter, AR_One_Sans } from 'next/font/google'

const inter = AR_One_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'WebGPU 6502 CPU',
  description: 'By Ray © 2023',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
