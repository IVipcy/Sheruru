import type { Metadata } from 'next'
import './globals.css'
import { APP_NAME, FAVICON_PATH } from '@/lib/constants'

export const metadata: Metadata = {
  title: `${APP_NAME} - 営業力強化AIアバター`,
  description: 'みずほリース / エムエルITADソリューション 営業力強化AIアバターシステム',
  icons: {
    icon: [{ url: FAVICON_PATH, type: 'image/png' }],
    apple: [{ url: FAVICON_PATH, type: 'image/png' }],
  },
}

export const dynamic = 'force-dynamic'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
