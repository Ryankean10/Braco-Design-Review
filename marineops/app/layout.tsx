import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MarineOps',
  description: 'Multi-vessel yacht planned maintenance, document and stock management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
