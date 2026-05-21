'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, LogOut, Menu } from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { APP_NAME, APP_LOGO_PATH, NAV_ITEMS } from '@/lib/constants'
import MobileNavDrawer from '@/components/MobileNavDrawer'

const BADGE_IMAGES: Record<number, string> = {
  1: '/badges/good-blue.png',
  2: '/badges/good-orange.png',
  3: '/badges/good-purple.png',
}

interface HeaderProps {
  displayName?: string
  badgeRank?: number
  isSherpa?: boolean
  selectedBadge?: 'good' | 'sherpa'
  unreadCount?: number
  onLogout?: () => void
}

export default function Header({
  displayName = 'ユーザー',
  badgeRank = 1,
  isSherpa = false,
  selectedBadge = 'good',
  unreadCount = 0,
  onLogout,
}: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [showNotif, setShowNotif] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    if (onLogout) {
      onLogout()
      return
    }
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const showSherpa = selectedBadge === 'sherpa' && isSherpa
  const badgeImage = showSherpa ? '/badges/sherpa.png' : (BADGE_IMAGES[badgeRank] || BADGE_IMAGES[1])

  return (
    <>
      <header className="z-50 flex-shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-sm">
        <div className="flex h-14 w-full items-center gap-2 pl-2 pr-3 sm:gap-4 sm:pl-4 sm:pr-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-light)] hover:text-[var(--color-text)] lg:hidden"
            aria-label="メニューを開く"
          >
            <Menu size={22} />
          </button>

          <Link href="/" className="flex shrink-0 items-center gap-2" onClick={() => setMenuOpen(false)}>
            <Image
              src={APP_LOGO_PATH}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
              priority
            />
            <span className="text-lg font-bold tracking-wider text-[var(--color-accent)] sm:text-xl">
              {APP_NAME}
            </span>
          </Link>

          <nav className="ml-6 hidden gap-1 lg:flex lg:ml-20 xl:ml-28">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-light)] hover:text-[var(--color-text)]'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotif(!showNotif)}
                className="relative rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-light)] hover:text-[var(--color-text)]"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
              {showNotif && (
                <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-xl">
                  <p className="mb-2 text-xs font-semibold text-[var(--color-text-muted)]">通知</p>
                  <p className="text-sm text-[var(--color-text-muted)]">新しい通知はありません</p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => router.push('/account')}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--color-surface-light)] sm:px-3"
            >
              <Image src={badgeImage} alt="badge" width={32} height={32} className="h-8 w-8" />
              <div className="hidden text-left sm:block">
                <p className="text-xs font-medium leading-tight">{displayName}</p>
                {showSherpa && <p className="text-[10px] leading-tight text-pink-500">Sherpa</p>}
              </div>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              title="ログアウト"
              className="hidden rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-light)] hover:text-red-400 lg:block"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <MobileNavDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        displayName={displayName}
        badgeImage={badgeImage}
        showSherpa={showSherpa}
        onLogout={handleLogout}
      />
    </>
  )
}
