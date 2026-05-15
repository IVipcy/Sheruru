import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GYAOSUU - 営業力強化AIアバター',
  description: 'みずほリース / エムエルITADソリューション 営業力強化AIアバターシステム',
}

export const dynamic = 'force-dynamic'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
