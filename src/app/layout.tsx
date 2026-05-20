import type { Metadata } from 'next'
import './globals.css'
import { APP_NAME, APP_LOGO_PATH } from '@/lib/constants'

export const metadata: Metadata = {
  title: `${APP_NAME} - 営業力強化AIアバター`,
  description: 'みずほリース / エムエルITADソリューション 営業力強化AIアバターシステム',
  icons: {
    icon: APP_LOGO_PATH,
    apple: APP_LOGO_PATH,
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
